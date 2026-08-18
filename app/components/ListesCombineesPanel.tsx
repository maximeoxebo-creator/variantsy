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
const NAVY = "#1F3A5F";
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
            {[NAVY, BEIGE].map((c) => (
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
            Un coloris par produit ?
          </Text>
          <Badge tone="info">Fonctionnalité Shopify</Badge>
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          Variantsy travaille à l&apos;intérieur d&apos;un produit : il regroupe ses photos et
          filtre sa galerie selon la variante choisie. Si chacun de vos coloris est un produit
          distinct, il n&apos;a rien à relier entre eux — mais Shopify sait le faire.
        </Text>
      </BlockStack>

      <Box background="bg-surface-secondary" padding="400" borderRadius="300">
        <BlockStack gap="400">
          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
            <BlockStack gap="300">
              <InlineStack>
                <Badge tone="critical">Aujourd&apos;hui</Badge>
              </InlineStack>
              <BlockStack gap="200">
                <Fiche titre="Sweat bleu marine" couleur={NAVY} />
                <Fiche titre="Sweat beige" couleur={BEIGE} />
              </BlockStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Deux fiches sans rapport. Un client arrivé sur la bleue ignore que la beige
                existe.
              </Text>
            </BlockStack>

            <BlockStack gap="300">
              <InlineStack>
                <Badge tone="success">Avec une liste combinée</Badge>
              </InlineStack>
              <BlockStack gap="200">
                <Fiche titre="Sweat bleu marine" couleur={NAVY} relie />
                <Fiche titre="Sweat beige" couleur={BEIGE} relie />
              </BlockStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Un sélecteur de coloris sur chaque fiche, qui mène à l&apos;autre produit.
              </Text>
            </BlockStack>
          </InlineGrid>
        </BlockStack>
      </Box>

      <BlockStack gap="300">
        <Text as="h3" variant="headingSm">
          Pourquoi ce n&apos;est pas dans Variantsy
        </Text>
        <Text as="p" variant="bodySm">
          Parce que Shopify le fait mieux. Sa fonctionnalité est intégrée aux thèmes, gratuite, et
          surtout <strong>chaque produit garde son adresse</strong> — donc son référencement, ses
          avis et ses liens entrants. Une app qui fusionnerait vos fiches les détruirait.
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Les deux se complètent : Shopify relie vos fiches entre elles, Variantsy filtre les
          photos à l&apos;intérieur de chacune.
        </Text>
      </BlockStack>

      <Banner tone="info">
        <p>
          <strong>Deux points à vérifier avant de vous lancer.</strong> Votre thème doit prendre en
          charge les listes combinées — c&apos;est le cas de Dawn et des thèmes récents. Et la
          disponibilité peut dépendre de votre forfait Shopify : l&apos;installation vous le dira.
        </p>
      </Banner>

      <InlineStack gap="300">
        <Button variant="primary" url={LIEN_APP} target="_blank">
          Installer Combined Listings
        </Button>
        <Button
          url="https://help.shopify.com/manual/products/combined-listings"
          target="_blank"
        >
          Documentation Shopify
        </Button>
      </InlineStack>
    </BlockStack>
  );
}
