import { BlockStack, Badge, Banner, Box, Button, InlineGrid, InlineStack, Text } from "@shopify/polaris";

/* ========================================================================== */
/* Volet Listes combinées                                                     */
/*                                                                            */
/* Variantsy travaille À L'INTÉRIEUR d'un produit : il groupe ses médias et    */
/* filtre sa galerie. Il ne sait rien des autres produits du catalogue. Un     */
/* marchand dont chaque coloris est un produit distinct a donc un besoin réel  */
/* que cette app ne couvre pas — et que Shopify couvre nativement.             */
/*                                                                            */
/* Plutôt que de reconstruire une primitive de la plateforme, ce volet         */
/* explique la fonctionnalité native et y renvoie. Une app qui dit « ce n'est  */
/* pas mon rôle, voici l'outil qu'il vous faut » se fait plus confiance qu'une */
/* app qui fait mal ce qu'un autre fait bien.                                  */
/* ========================================================================== */

const LIEN_APP = "https://apps.shopify.com/combined-listings";
const BLUE = "#2C5AA0";
const BEIGE = "#D8C3A5";

/** Silhouette de tee-shirt, identique à celle du volet Installation. */
function Silhouette({ tint }: { tint: string }) {
  return (
    <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
      <path
        d="M18 7 L24 10.5 L30 7 L42 13 L37.5 22.5 L33.5 20 L33.5 41.5 Q24 43.5 14.5 41.5 L14.5 20 L10.5 22.5 L6 13 Z"
        fill={tint}
      />
    </svg>
  );
}

/** Fiche produit miniature, pour montrer deux produits séparés puis reliés. */
function Fiche({
  titre,
  couleur,
  relie,
}: {
  titre: string;
  couleur: string;
  relie?: boolean;
}) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: 10,
        borderRadius: 12,
        background: "#fff",
        border: "1px solid var(--p-color-border-secondary)",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 46,
          height: 46,
          flex: "0 0 auto",
          borderRadius: 8,
          background: `color-mix(in srgb, ${couleur} 24%, #fff)`,
        }}
      >
        <Silhouette tint={couleur} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <Text as="span" variant="bodySm" fontWeight="semibold">
          {titre}
        </Text>
        {relie ? (
          <span style={{ display: "flex", gap: 6 }}>
            {[BLUE, BEIGE].map((c) => (
              <span
                key={c}
                style={{
                  display: "block",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: c,
                  boxShadow:
                    c === couleur ? `0 0 0 1.5px #fff, 0 0 0 3px ${c}` : "inset 0 0 0 1px rgba(0,0,0,.15)",
                }}
              />
            ))}
          </span>
        ) : (
          <Text as="span" variant="bodyXs" tone="subdued">
            aucun lien vers l&apos;autre coloris
          </Text>
        )}
      </span>
    </span>
  );
}

export function ListesCombineesPanel() {
  return (
    <BlockStack gap="500">
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center">
          <Text as="h3" variant="headingMd">
            One color per product?
          </Text>
          <Badge tone="info">Shopify feature</Badge>
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          Variantsy works inside a single product: it groups its photos and filters the gallery
          to the chosen variant. If each of your colors is a separate product, there is nothing
          for it to link together — but Shopify can do exactly that.
        </Text>
      </BlockStack>

      <Box background="bg-surface-secondary" padding="400" borderRadius="300">
        <BlockStack gap="400">
          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
            <BlockStack gap="300">
              <InlineStack>
                <Badge tone="critical">Today</Badge>
              </InlineStack>
              <BlockStack gap="200">
                <Fiche titre="Blue tee" couleur={BLUE} />
                <Fiche titre="Beige tee" couleur={BEIGE} />
              </BlockStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Two unrelated pages. A shopper who lands on the blue one never learns the beige
                exists.
              </Text>
            </BlockStack>

            <BlockStack gap="300">
              <InlineStack>
                <Badge tone="success">With a combined listing</Badge>
              </InlineStack>
              <BlockStack gap="200">
                <Fiche titre="Blue tee" couleur={BLUE} relie />
                <Fiche titre="Sweat beige" couleur={BEIGE} relie />
              </BlockStack>
              <Text as="p" variant="bodySm" tone="subdued">
                A color selector on each page, leading to the other product.
              </Text>
            </BlockStack>
          </InlineGrid>
        </BlockStack>
      </Box>

      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">
          Why this is not part of Variantsy
        </Text>
        <Text as="p" variant="bodySm">
          Because Shopify does it better. The feature is built into themes, free, and above all
          <strong>every product keeps its own address</strong> — and with it its search ranking, its
          reviews and its inbound links. An app that merged your pages would destroy all three.
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          The two work together: Shopify links your pages to each other, Variantsy filters the
          photos inside each one.
        </Text>
      </BlockStack>

      <Banner tone="info">
        <p>
          <strong>Two things to check first.</strong> Your theme must support combined listings —
          Dawn and recent themes do. And availability can depend on your Shopify plan: the install
          flow will tell you.
        </p>
      </Banner>

      <InlineStack gap="300">
        <Button variant="primary" url={LIEN_APP} target="_blank">
          Install Combined Listings
        </Button>
        <Button
          url="https://help.shopify.com/manual/products/combined-listings"
          target="_blank"
        >
          Shopify documentation
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
