import prisma, { withRetry } from "./db.server";
import { getSettings, listSwatchValues, normalize } from "./settings.server";
import { guessColor } from "./colors";

/**
 * Produits liés — un coloris par fiche produit.
 *
 * Pour les catalogues où chaque couleur est un produit distinct. Shopify offre
 * « Combined Listings » pour ça, mais elle est RÉSERVÉE AUX COMPTES PLUS : la
 * majorité des marchands n'y a pas accès.
 *
 * Où vit la vérité : dans les métadonnées des produits, pas dans notre base.
 * Le Liquid les lit sans appel réseau, la charge utile du proxy ne gonfle pas
 * avec le catalogue, et les groupes survivent à une désinstallation. La table
 * `ProductGroup` n'est qu'un index — Shopify ne sachant pas chercher un produit
 * par métadonnée, sans elle l'admin devrait balayer tout le catalogue.
 */

export const NAMESPACE = "variantsy";

export type GroupMember = {
  /** gid://shopify/Product/… */
  id: string;
  handle: string;
  title: string;
  /** Le coloris que CETTE fiche représente. */
  value: string;
};

export type Group = {
  id: string;
  key: string;
  label: string;
  members: GroupMember[];
};

type GraphqlAdmin = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

/** Slug stable dérivé du libellé, unique par boutique. */
export function slugify(input: string): string {
  const base = String(input || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "group";
}

export async function listGroups(shop: string): Promise<Group[]> {
  const rows = await withRetry(() =>
    prisma.productGroup.findMany({ where: { shop }, orderBy: { updatedAt: "desc" } }),
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    members: (r.members as unknown as GroupMember[]) ?? [],
  }));
}

const SET = `#graphql
  mutation VariantsyGroupSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message code }
    }
  }
`;

const DELETE = `#graphql
  mutation VariantsyGroupClear($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;

/** Les quatre clés écrites sur chaque fiche d'un groupe. */
const CLES = [
  "group", "group_value", "group_label", "group_members", "group_color",
] as const;

/**
 * Couleur définitive d'un coloris, résolue À L'ENREGISTREMENT.
 *
 * Elle voyage dans une métadonnée pour que le Liquid peigne la pastille du
 * premier coup. Sans elle, le bloc posait la PHOTO de la fiche sœur et le
 * navigateur attendait la configuration — un aller-retour mesuré à huit
 * secondes sur une fonction froide — avant de la remplacer par la couleur.
 * L'acheteur voyait donc les pastilles changer sous ses yeux.
 *
 * La cascade reproduit exactement celle du storefront, sans quoi le JS
 * corrigerait ensuite ce que le Liquid vient de poser, et le clignotement
 * reviendrait par l'autre bout :
 *   1. la bibliothèque du marchand, qui prime toujours ;
 *   2. la devinette d'après le nom, mais UNIQUEMENT si le marchand a demandé
 *      des pastilles de couleur — en mode photo, il veut ses photos.
 * Rien de résolu : on n'écrit pas, et la photo garde sa place.
 */
async function resoudreCouleurs(
  shop: string,
  label: string,
  valeurs: string[],
): Promise<Map<string, string>> {
  const couleurs = new Map<string, string>();
  const [reglages, bibliotheque] = await Promise.all([
    getSettings(shop),
    listSwatchValues(shop),
  ]);

  const parCle = new Map(
    bibliotheque.map((v) => [`${v.optionName}::${v.value}`, v]),
  );
  const nomOption = normalize(label);

  for (const valeur of valeurs) {
    const brute = valeur.trim();
    if (!brute) continue;
    // Une valeur qui EST déjà un code couleur se suffit à elle-même.
    if (/^#[0-9a-f]{3,8}$/i.test(brute)) {
      couleurs.set(valeur, brute);
      continue;
    }
    const entree = parCle.get(`${nomOption}::${normalize(brute)}`);
    if (entree?.colorHex) {
      couleurs.set(valeur, entree.colorHex);
      continue;
    }
    if (reglages.swatchFallback === "color") {
      const devinee = guessColor(brute);
      if (devinee) couleurs.set(valeur, devinee);
    }
  }
  return couleurs;
}

async function ecrire(
  admin: GraphqlAdmin,
  shop: string,
  group: Omit<Group, "id">,
): Promise<string[]> {
  const handles = group.members.map((m) => m.handle);
  const couleurs = await resoudreCouleurs(
    shop,
    group.label,
    group.members.map((m) => m.value),
  );

  const metafields = group.members.flatMap((m) => {
    const couleur = couleurs.get(m.value);
    return [
      { ownerId: m.id, namespace: NAMESPACE, key: "group", type: "single_line_text_field", value: group.key },
      { ownerId: m.id, namespace: NAMESPACE, key: "group_value", type: "single_line_text_field", value: m.value },
      { ownerId: m.id, namespace: NAMESPACE, key: "group_label", type: "single_line_text_field", value: group.label },
      { ownerId: m.id, namespace: NAMESPACE, key: "group_members", type: "json", value: JSON.stringify(handles) },
      // La couleur n'est écrite que si elle a été résolue. `metafieldsSet`
      // REFUSE une chaîne vide — « Value can't be blank » — donc effacer une
      // couleur devenue caduque passe par une suppression, plus bas.
      ...(couleur
        ? [{ ownerId: m.id, namespace: NAMESPACE, key: "group_color", type: "single_line_text_field", value: couleur }]
        : []),
    ];
  });

  // Les fiches dont la couleur ne se résout plus doivent PERDRE la leur :
  // laissée en place, elle peindrait la pastille d'un coloris renommé avec la
  // teinte de l'ancien.
  const sansCouleur = group.members.filter((m) => !couleurs.get(m.value));
  if (sansCouleur.length) {
    await admin.graphql(DELETE, {
      variables: {
        metafields: sansCouleur.map((m) => ({
          ownerId: m.id,
          namespace: NAMESPACE,
          key: "group_color",
        })),
      },
    });
  }

  // `metafieldsSet` plafonne à 25 métadonnées par appel : cinq par fiche depuis
  // l'ajout de la couleur, donc cinq fiches. Un groupe de vingt coloris
  // dépasserait sans ce découpage.
  const erreurs: string[] = [];
  for (let i = 0; i < metafields.length; i += 25) {
    const response = await admin.graphql(SET, {
      variables: { metafields: metafields.slice(i, i + 25) },
    });
    const body = (await response.json()) as {
      data?: { metafieldsSet?: { userErrors: { message: string }[] } };
    };
    for (const e of body?.data?.metafieldsSet?.userErrors ?? []) erreurs.push(e.message);
  }
  return erreurs;
}

/** Retire les quatre métadonnées des fiches qui quittent le groupe. */
async function effacer(admin: GraphqlAdmin, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const metafields = ids.flatMap((ownerId) =>
    CLES.map((key) => ({ ownerId, namespace: NAMESPACE, key })),
  );
  for (let i = 0; i < metafields.length; i += 24) {
    await admin.graphql(DELETE, { variables: { metafields: metafields.slice(i, i + 24) } });
  }
}

export async function saveGroup(
  admin: GraphqlAdmin,
  shop: string,
  input: { id?: string; label: string; members: GroupMember[] },
): Promise<{ ok: boolean; errors: string[] }> {
  const label = input.label.trim() || "Color";
  const members = input.members.filter((m) => m.id && m.handle);
  if (members.length < 2) {
    return { ok: false, errors: ["Un groupe demande au moins deux fiches produit."] };
  }

  const existant = input.id
    ? await withRetry(() => prisma.productGroup.findFirst({ where: { id: input.id, shop } }))
    : null;

  // La clé ne change JAMAIS après création : elle est écrite dans les
  // métadonnées de chaque fiche, et la renommer les désolidariserait toutes.
  let key = existant?.key ?? slugify(label);
  if (!existant) {
    let n = 1;
    while (await withRetry(() => prisma.productGroup.findFirst({ where: { shop, key } }))) {
      key = `${slugify(label)}-${++n}`;
    }
  }

  const erreurs = await ecrire(admin, shop, { key, label, members });
  if (erreurs.length) return { ok: false, errors: erreurs };

  // Les fiches retirées du groupe doivent perdre leurs métadonnées, sinon elles
  // continueraient d'afficher une rangée pointant vers un groupe qu'elles ont
  // quitté.
  const anciens = ((existant?.members as unknown as GroupMember[]) ?? []).map((m) => m.id);
  const restants = new Set(members.map((m) => m.id));
  await effacer(admin, anciens.filter((id) => !restants.has(id)));

  await withRetry(() =>
    existant
      ? prisma.productGroup.update({
          where: { id: existant.id },
          data: { label, members: members as never },
        })
      : prisma.productGroup.create({
          data: { shop, key, label, members: members as never },
        }),
  );

  return { ok: true, errors: [] };
}

export async function deleteGroup(
  admin: GraphqlAdmin,
  shop: string,
  id: string,
): Promise<void> {
  const row = await withRetry(() => prisma.productGroup.findFirst({ where: { id, shop } }));
  if (!row) return;
  await effacer(admin, ((row.members as unknown as GroupMember[]) ?? []).map((m) => m.id));
  await withRetry(() => prisma.productGroup.deleteMany({ where: { id, shop } }));
}
