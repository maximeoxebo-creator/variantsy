import { useEffect, useRef, useState } from "react";
import {
  Badge, Banner, BlockStack, Box, Button, Card, InlineStack, Text, TextField,
  Thumbnail,
} from "@shopify/polaris";
import { MinusCircleIcon } from "@shopify/polaris-icons";
import { SchemaRetraitOption } from "./schemas";
import type { Group, GroupMember } from "../groups.server";

/* ==========================================================================
   Volet « Produits liés »

   Pour les catalogues où chaque coloris est une fiche produit distincte.
   Shopify offre « Combined Listings » pour ça, mais elle est RÉSERVÉE AUX
   COMPTES PLUS — la majorité des marchands n'y a pas accès. C'est la raison
   d'être de cet écran.

   Ce que l'app NE fait PAS, et c'est délibéré : fusionner les fiches. Chaque
   produit garde son adresse, donc son référencement, ses avis et ses liens
   entrants. On ajoute un sélecteur qui mène d'une fiche à l'autre.

   L'écran suivait auparavant la logique inverse : trois cent cinquante mots
   — deux encadrés comparant les deux modèles, un bandeau d'avertissement, une
   marche à suivre en quatre points — avant le moindre bouton. On reprend ici
   la forme de Combined Listings : un champ, une liste de produits, rien
   d'autre. Ce qui reste à dire est dit là où ça s'applique, et seulement quand
   ça s'applique : l'avertissement sur l'option couleur n'apparaît que si un
   produit choisi en porte réellement une.
   ========================================================================== */

const RE_COULEUR = /colou?r|couleur|farbe|kleur|colore/i;

/** Ce que le sélecteur de ressources de Shopify rend pour un produit. */
export type ProduitChoisi = {
  id: string;
  handle: string;
  title: string;
  options?: { name: string }[];
  images?: { originalSrc?: string; url?: string }[];
};

type MembreEdite = GroupMember & {
  /** Sert uniquement à avertir : ce produit gère déjà ses coloris en
   *  variantes, le grouper ferait doublon. */
  aDesCouleurs?: boolean;
  /** Vignette du sélecteur. Non enregistrée : à la réouverture d'un groupe on
   *  retombe sur le carré neutre, ce qui n'empêche rien. */
  image?: string;
};

type Brouillon = { id?: string; label: string; members: MembreEdite[] };

// Le champ démarre VIDE, pour que son texte indicatif se voie. Il portait
// « Color » comme valeur réelle : l'indication était donc invisible, et le
// marchand qui vend des finitions gardait « Color » sans se poser la question.
// Laissé vide à l'enregistrement, il retombe sur « Color » côté serveur.
const VIDE: Brouillon = { label: "", members: [] };

export function LiensProduitsPanel({
  groups,
  onPickProducts,
  onSave,
  onDelete,
  enregistrement,
  erreurs,
}: {
  groups: Group[];
  /** Ouvre le sélecteur Shopify. Rendu par le parent : l'appel dépend d'App
   *  Bridge, qui n'existe que dans l'iframe, et ce volet doit rester
   *  regardable hors de Shopify. */
  onPickProducts: (dejaChoisis: string[]) => Promise<ProduitChoisi[] | null>;
  onSave: (b: { id?: string; label: string; members: GroupMember[] }) => void;
  onDelete: (id: string) => void;
  enregistrement: boolean;
  erreurs: string[];
}) {
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);

  // Refermer l'éditeur quand l'enregistrement aboutit. Sans cela le marchand
  // reste devant son formulaire, sans savoir si c'est passé, et n'a aucun
  // chemin visible vers un second groupe.
  const enCours = useRef(false);
  useEffect(() => {
    if (enregistrement) {
      enCours.current = true;
      return;
    }
    if (enCours.current) {
      enCours.current = false;
      if (erreurs.length === 0) setBrouillon(null);
    }
  }, [enregistrement, erreurs.length]);

  const choisirProduits = async () => {
    const selection = await onPickProducts((brouillon?.members ?? []).map((m) => m.id));
    if (!selection) return;
    const anciens = new Map((brouillon?.members ?? []).map((m) => [m.id, m]));
    // Le nom de l'option des produits choisis, quand ils en ont une de couleur.
    // Le pré-remplir vaut mieux que l'expliquer : c'est lui qui décide si les
    // fiches liées rejoignent le nuancier existant ou forment une seconde
    // rangée, et une boutique française gardait « Color » sans savoir.
    const nomOption = selection
      .flatMap((p) => p.options ?? [])
      .map((o) => o.name)
      .find((n) => RE_COULEUR.test(n));
    setBrouillon((b) => ({
      ...(b ?? VIDE),
      label: b?.id ? b.label : nomOption || b?.label || VIDE.label,
      members: selection.map((p) => ({
        id: p.id,
        handle: p.handle,
        title: p.title,
        // Volontairement VIDE, jamais le titre du produit : pré-remplir avec
        // « ALMA25 — Cocotte ronde en fonte bleu marine » donnait une pastille
        // dont le libellé était la fiche entière, et personne ne pensait à le
        // corriger. Un champ vide se remplit ; un champ faux se recopie.
        value: anciens.get(p.id)?.value ?? "",
        aDesCouleurs: (p.options ?? []).some((o) => RE_COULEUR.test(o.name)),
        image: p.images?.[0]?.originalSrc ?? p.images?.[0]?.url ?? anciens.get(p.id)?.image,
      })),
    }));
  };

  const majValeur = (id: string, value: string) =>
    setBrouillon((b) =>
      b ? { ...b, members: b.members.map((m) => (m.id === id ? { ...m, value } : m)) } : b,
    );

  const retirer = (id: string) =>
    setBrouillon((b) => (b ? { ...b, members: b.members.filter((m) => m.id !== id) } : b));

  /* ---------------------------------------------------------------- éditeur */
  if (brouillon) {
    const enConflit = brouillon.members.filter((m) => m.aDesCouleurs);
    const complet =
      brouillon.members.length >= 2 && brouillon.members.every((m) => m.value.trim());
    // Le nom de l'option étiquette chaque champ de valeur, comme le fait
    // Shopify : le marchand voit « Color » au-dessus de « Blue », et n'a plus à
    // deviner ce qu'on lui demande d'écrire.
    const etiquette = brouillon.label.trim() || "Color";

    return (
      <BlockStack gap="400">
        {erreurs.length > 0 && (
          <Banner tone="critical" title="This group was not saved">
            <BlockStack gap="100">
              {erreurs.map((e) => (
                <Text as="p" key={e} variant="bodySm">{e}</Text>
              ))}
            </BlockStack>
          </Banner>
        )}

        <Card>
          <TextField
            label="Option name"
            value={brouillon.label}
            onChange={(label) => setBrouillon({ ...brouillon, label })}
            autoComplete="off"
            // « Color » seul laissait croire que le champ n'accepte que ça,
            // alors qu'il nomme l'option affichée au-dessus des pastilles et
            // sert ensuite d'étiquette à chaque valeur. Trois exemples le
            // disent mieux qu'une phrase.
            placeholder="Name the option — Color, Finish, Material"
          />
        </Card>

        <Card padding="0">
          <Box padding="400" borderBlockEndWidth="025" borderColor="border-secondary">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingSm">Products</Text>
              <Button onClick={choisirProduits}>Add products</Button>
            </InlineStack>
          </Box>

          {brouillon.members.length === 0 ? (
            <Box padding="400">
              <Text as="p" tone="subdued">
                Pick the product pages that are the same item in another color.
              </Text>
            </Box>
          ) : (
            brouillon.members.map((m, i) => (
              <Box
                key={m.id}
                padding="400"
                borderBlockEndWidth={i < brouillon.members.length - 1 ? "025" : "0"}
                borderColor="border-secondary"
              >
                <BlockStack gap="300">
                  <InlineStack gap="300" blockAlign="center" wrap={false}>
                    {m.image ? (
                      <Thumbnail source={m.image} alt="" size="small" />
                    ) : (
                      <Box
                        background="bg-surface-secondary"
                        borderRadius="200"
                        minWidth="40px"
                        minHeight="40px"
                      />
                    )}
                    <Box minWidth="0" width="100%">
                      <BlockStack gap="050">
                        <Text as="p" variant="bodyMd" fontWeight="semibold" truncate>
                          {m.title}
                        </Text>
                        <Text as="p" variant="bodySm" tone="subdued" truncate>
                          /products/{m.handle}
                        </Text>
                      </BlockStack>
                    </Box>
                    {/* Le titre du produit prend toute la largeur disponible et
                        écrasait le badge, dont le texte se coupait en deux
                        lignes. Ce groupe ne rétrécit plus. */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {m.aDesCouleurs && <Badge tone="critical">Color option</Badge>}
                      <Button
                        variant="tertiary"
                        icon={MinusCircleIcon}
                        accessibilityLabel={`Remove ${m.title}`}
                        onClick={() => retirer(m.id)}
                      />
                    </div>
                  </InlineStack>
                  <TextField
                    label={etiquette}
                    value={m.value}
                    onChange={(v) => majValeur(m.id, v)}
                    autoComplete="off"
                    // Le libellé du champ EST le nom de l'option, qui peut être
                    // « Size » ou « Finish » : suggérer « Blue » y était absurde.
                    // L'indication reprend donc ce nom et dit quoi faire.
                    placeholder={`Type the ${etiquette.toLowerCase()} this page stands for`}
                  />
                </BlockStack>
              </Box>
            ))
          )}
        </Card>

        {/* Dit là où ça s'applique, et seulement quand ça s'applique. */}
        {enConflit.length > 0 && (
          <Banner tone="critical" title="Remove the color option from these products">
            <BlockStack gap="300">
              <Text as="p" variant="bodySm">
                {enConflit.map((m) => m.title).join(", ")} still carr
                {enConflit.length > 1 ? "y" : "ies"} a color option in the Shopify admin, so
                the same color would show twice. Variantsy ignores a group until you
                remove it.
              </Text>
              <SchemaRetraitOption />
            </BlockStack>
          </Banner>
        )}

        <InlineStack align="space-between" blockAlign="center">
          <Text as="p" variant="bodySm" tone="subdued">
            {brouillon.members.length < 2
              ? "A group needs at least two products."
              : complet
                ? ""
                : `Name the ${etiquette.toLowerCase()} each product stands for.`}
          </Text>
          <InlineStack gap="200">
            <Button onClick={() => setBrouillon(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!complet}
              loading={enregistrement}
              onClick={() =>
                onSave({
                  id: brouillon.id,
                  label: brouillon.label,
                  members: brouillon.members.map(({ id, handle, title, value }) => ({
                    id, handle, title, value,
                  })),
                })
              }
            >
              Save
            </Button>
          </InlineStack>
        </InlineStack>
      </BlockStack>
    );
  }

  /* ---------------------------------------------------------------- accueil */
  if (groups.length === 0) {
    // La carte de mode, juste au-dessus, porte déjà le discours et le schéma
    // des trois fiches liées. Le répéter ici mettait deux fois la même image à
    // vingt pixels d'écart : on va droit au geste.
    return (
      <Card>
        <BlockStack gap="300" inlineAlign="start">
          <Text as="p" tone="subdued">
            Group the product pages that are the same item in another color.
          </Text>
          <Button variant="primary" onClick={() => setBrouillon(VIDE)}>
            Create a group
          </Button>
        </BlockStack>
      </Card>
    );
  }

  return (
    <BlockStack gap="300">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h3" variant="headingMd">Groups</Text>
        <Button onClick={() => setBrouillon(VIDE)}>Create a group</Button>
      </InlineStack>

      {groups.map((g) => (
        <Card key={g.id}>
          <InlineStack align="space-between" blockAlign="center" gap="300">
            <Box minWidth="0">
              <BlockStack gap="050">
                <Text as="h4" variant="headingSm">{g.label}</Text>
                <Text as="p" variant="bodySm" tone="subdued" truncate>
                  {g.members.map((m) => m.value).join(" · ")}
                </Text>
              </BlockStack>
            </Box>
            <InlineStack gap="200" wrap={false}>
              <Button
                onClick={() => setBrouillon({ id: g.id, label: g.label, members: g.members })}
              >
                Edit
              </Button>
              <Button variant="tertiary" tone="critical" onClick={() => onDelete(g.id)}>
                Delete
              </Button>
            </InlineStack>
          </InlineStack>
        </Card>
      ))}
    </BlockStack>
  );
}
