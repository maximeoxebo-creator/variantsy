import { useState } from "react";
import {
  Badge, Banner, BlockStack, Box, Button, Card, EmptyState, InlineStack,
  Text, TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
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
   ========================================================================== */

type Brouillon = { id?: string; label: string; members: GroupMember[] };

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
    setBrouillon((b) => ({
      ...(b ?? VIDE),
      members: selection.map((p: { id: string; handle: string; title: string }) => ({
        id: p.id,
        handle: p.handle,
        title: p.title,
        // On conserve le coloris déjà saisi ; le titre n'est qu'une amorce.
        value: anciens.get(p.id)?.value ?? p.title,
      })),
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
              helpText="Shown above the swatches on the product page, like Color or Finish."
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
          <Text as="h3" variant="headingMd">One color per product?</Text>
          <Badge tone="info">Any plan</Badge>
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          Variantsy works inside a single product. If each of your colors is a separate
          product, group them here: every page then shows the whole range, and a click
          leads to the right one. Each product keeps its own address, so its search
          ranking, reviews and inbound links stay where they are.
        </Text>
      </BlockStack>

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
