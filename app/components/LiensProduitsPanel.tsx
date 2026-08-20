import { useEffect, useRef, useState } from "react";
import {
  Badge, Banner, BlockStack, Box, Button, Card, EmptyState, InlineGrid,
  InlineStack, Text, TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { Group, GroupMember } from "../groups.server";

type MembreEdite = GroupMember & { aDesCouleurs?: boolean };

/* ==========================================================================
   Volet « Produits liés »

   Pour les catalogues où chaque coloris est une fiche produit distincte.
   Shopify offre « Combined Listings » pour ça, mais elle est RÉSERVÉE AUX
   COMPTES PLUS — la majorité des marchands n'y a pas accès. C'est la raison
   d'être de cet écran.

   Ce que l'app NE fait PAS, et c'est délibéré : fusionner les fiches. Chaque
   produit garde son adresse, donc son référencement, ses avis et ses liens
   entrants. On ajoute un sélecteur qui mène d'une fiche à l'autre.
   ========================================================================== */

type Brouillon = { id?: string; label: string; members: MembreEdite[] };

const VIDE: Brouillon = { label: "Color", members: [] };

export function LiensProduitsPanel({
  groups,
  onSave,
  onDelete,
  enregistrement,
  erreurs,
}: {
  groups: Group[];
  onSave: (b: Brouillon) => void;
  onDelete: (id: string) => void;
  enregistrement: boolean;
  erreurs: string[];
}) {
  const shopify = useAppBridge();
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
    const selection = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      // Les fiches déjà dans le groupe reviennent cochées : sans ça, rouvrir le
      // sélecteur pour ajouter une couleur effacerait toutes les autres.
      selectionIds: (brouillon?.members ?? []).map((m) => ({ id: m.id })),
    });
    if (!selection) return;
    const anciens = new Map((brouillon?.members ?? []).map((m) => [m.id, m]));
    // Le nom de l'option des produits choisis, quand ils en ont une de couleur.
    // Le pré-remplir vaut mieux que l'expliquer : c'est lui qui décide si les
    // fiches liées rejoignent le nuancier existant ou forment une seconde
    // rangée, et une boutique française gardait « Color » sans savoir.
    const nomOption = selection
      .flatMap((p: { options?: { name: string }[] }) => p.options ?? [])
      .map((o) => o.name)
      .find((n) => /colou?r|couleur|farbe|kleur|colore/i.test(n));
    setBrouillon((b) => ({
      ...(b ?? VIDE),
      label: b?.id ? b.label : nomOption || b?.label || VIDE.label,
      members: selection.map(
        (p: { id: string; handle: string; title: string; options?: { name: string }[] }) => ({
          id: p.id,
          handle: p.handle,
          title: p.title,
          // Volontairement VIDE, jamais le titre du produit : pré-remplir avec
          // « ALMA25 — Cocotte ronde en fonte bleu marine » donnait une pastille
          // dont le libellé était la fiche entière, et personne ne pensait à le
          // corriger. Un champ vide se remplit ; un champ faux se recopie.
          value: anciens.get(p.id)?.value ?? "",
          // Sert uniquement à avertir : ce produit gère déjà ses coloris en
          // variantes, le grouper ferait doublon.
          aDesCouleurs: (p.options ?? []).some((o) =>
            /colou?r|couleur|farbe|kleur|colore/i.test(o.name),
          ),
        }),
      ),
    }));
  };

  const majValeur = (id: string, value: string) =>
    setBrouillon((b) =>
      b ? { ...b, members: b.members.map((m) => (m.id === id ? { ...m, value } : m)) } : b,
    );

  const retirer = (id: string) =>
    setBrouillon((b) => (b ? { ...b, members: b.members.filter((m) => m.id !== id) } : b));

  if (brouillon) {
    const pretAEnregistrer =
      brouillon.members.length >= 2 && brouillon.members.every((m) => m.value.trim());

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
          <BlockStack gap="400">
            <TextField
              label="Option name"
              value={brouillon.label}
              onChange={(label) => setBrouillon({ ...brouillon, label })}
              autoComplete="off"
              helpText="Shown above the swatches on the product page, the way a Shopify option name would be — Color, Finish, Leather."
            />

            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingSm">
                Products in this group
              </Text>
              <Button onClick={choisirProduits}>
                {brouillon.members.length ? "Change products" : "Choose products"}
              </Button>
            </InlineStack>

            {brouillon.members.length === 0 ? (
              <Text as="p" tone="subdued">
                Pick every product that is the same item in a different color.
              </Text>
            ) : (
              <BlockStack gap="300">
                {brouillon.members.map((m) => (
                  <Box
                    key={m.id}
                    background="bg-surface-secondary"
                    padding="300"
                    borderRadius="200"
                  >
                    <InlineStack gap="300" blockAlign="center" wrap={false}>
                      <Box minWidth="0" width="100%">
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" tone="subdued" truncate>
                            {m.title}
                          </Text>
                          <TextField
                            label="Color shown for this product"
                            labelHidden
                            value={m.value}
                            onChange={(v) => majValeur(m.id, v)}
                            autoComplete="off"
                            placeholder="Blue"
                          />
                        </BlockStack>
                      </Box>
                      <Button variant="tertiary" onClick={() => retirer(m.id)}>
                        Remove
                      </Button>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            )}

            {brouillon.members.length === 1 && (
              <Text as="p" variant="bodySm" tone="subdued">
                A group needs at least two products — one is nothing to switch between.
              </Text>
            )}

            {brouillon.members.some((m) => m.aDesCouleurs) && (
              <Banner tone="critical" title="These products still carry a color option">
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm">
                    Remove it in the Shopify admin before grouping them. As long as it is
                    there, Variantsy ignores the group and nothing you set here will show
                    on the storefront.
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    That is deliberate: a color present both as a variant and as a link
                    would appear twice, and the shopper could not tell which is which.
                  </Text>
                </BlockStack>
              </Banner>
            )}

            <InlineStack gap="200">
              <Button
                variant="primary"
                disabled={!pretAEnregistrer}
                loading={enregistrement}
                onClick={() => onSave(brouillon)}
              >
                Save group
              </Button>
              <Button onClick={() => setBrouillon(null)}>Cancel</Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="400">
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center">
          <Text as="h3" variant="headingMd">How is your catalog built?</Text>
          <Badge tone="info">Works on any plan</Badge>
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          There are two ways to sell the same item in several colors, and Variantsy
          supports both. Pick one per product — never both, or the same color appears
          twice.
        </Text>
      </BlockStack>

      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <Box background="bg-surface-secondary" padding="400" borderRadius="300">
          <BlockStack gap="200">
            <Text as="p" variant="bodySm" fontWeight="semibold">
              One product, colors as variants
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              The usual way. Your product carries a Color option, and each color has its
              photos assigned to its variant. Variantsy filters the gallery to the chosen
              color and rewrites the title.
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Nothing to do on this tab — everything is set under Appearance.
            </Text>
          </BlockStack>
        </Box>

        <Box background="bg-surface-secondary" padding="400" borderRadius="300">
          <BlockStack gap="200">
            <Text as="p" variant="bodySm" fontWeight="semibold">
              One product per color, linked together
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Each color is its own product page, with its own address, photos and stock.
              Group them here and every page shows the whole range; a click opens the
              right product.
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              This is what Shopify calls a combined listing — a feature reserved to Plus
              plans. Variantsy gives it to every plan.
            </Text>
          </BlockStack>
        </Box>
      </InlineGrid>

      <Banner tone="warning" title="Remove the color option from grouped products">
        <BlockStack gap="200">
          <Text as="p" variant="bodySm">
            A product you group here must <strong>not</strong> also carry a Color option
            in the Shopify admin. The two describe the same thing, so the shopper would
            see the same color twice — once as a variant, once as a link — with no way to
            tell them apart.
          </Text>
          <Text as="p" variant="bodySm">
            Variantsy protects you from that: a product with a color option ignores its
            group entirely. Which also means the group stays invisible until you remove
            that option.
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Keep your other options — size, material, length. Only the color one is in
            conflict.
          </Text>
        </BlockStack>
      </Banner>

      <Box background="bg-surface-secondary" padding="400" borderRadius="300">
        <BlockStack gap="200">
          <Text as="p" variant="bodySm" fontWeight="semibold">Grouping, step by step</Text>
          <Text as="p" variant="bodySm" tone="subdued">
            1. In the Shopify admin, remove the Color option from each product you are
            about to group. Its photos stay where they are.
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            2. Come back here and pick those products.
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            3. Type the color each one stands for — Blue, Beige, Charcoal.
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            4. Save. Nothing is merged: each product keeps its own address, and with it
            its search ranking, reviews and inbound links.
          </Text>
        </BlockStack>
      </Box>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            heading="No group yet"
            action={{ content: "Create a group", onAction: () => setBrouillon(VIDE) }}
            image=""
          >
            <p>Group the products that are the same item in different colors.</p>
          </EmptyState>
        </Card>
      ) : (
        <BlockStack gap="300">
          {groups.map((g) => (
            <Card key={g.id}>
              <InlineStack align="space-between" blockAlign="center" gap="300">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">{g.label}</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {g.members.map((m) => m.value).join(" · ")}
                  </Text>
                </BlockStack>
                <InlineStack gap="200">
                  <Button
                    onClick={() =>
                      setBrouillon({ id: g.id, label: g.label, members: g.members })
                    }
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
          <InlineStack>
            <Button onClick={() => setBrouillon(VIDE)}>Create another group</Button>
          </InlineStack>
        </BlockStack>
      )}
    </BlockStack>
  );
}
