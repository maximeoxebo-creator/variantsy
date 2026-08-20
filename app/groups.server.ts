import prisma, { withRetry } from "./db.server";

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
const CLES = ["group", "group_value", "group_label", "group_members"] as const;

async function ecrire(admin: GraphqlAdmin, group: Omit<Group, "id">): Promise<string[]> {
  const handles = group.members.map((m) => m.handle);
  const metafields = group.members.flatMap((m) => [
    { ownerId: m.id, namespace: NAMESPACE, key: "group", type: "single_line_text_field", value: group.key },
    { ownerId: m.id, namespace: NAMESPACE, key: "group_value", type: "single_line_text_field", value: m.value },
    { ownerId: m.id, namespace: NAMESPACE, key: "group_label", type: "single_line_text_field", value: group.label },
    { ownerId: m.id, namespace: NAMESPACE, key: "group_members", type: "json", value: JSON.stringify(handles) },
  ]);

  // `metafieldsSet` plafonne à 25 métadonnées par appel : quatre par fiche, donc
  // six fiches. Un groupe de vingt coloris dépasserait sans ce découpage.
  const erreurs: string[] = [];
  for (let i = 0; i < metafields.length; i += 24) {
    const response = await admin.graphql(SET, {
      variables: { metafields: metafields.slice(i, i + 24) },
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

  const erreurs = await ecrire(admin, { key, label, members });
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
