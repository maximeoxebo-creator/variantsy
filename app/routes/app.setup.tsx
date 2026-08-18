import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  InlineGrid,
  InlineStack,
  Layout,
  List,
  Page,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

/**
 * Requête du thème publié : sert à construire le deep link vers l'éditeur de
 * thème avec le bloc Variantsy pré-sélectionné. Un marchand qui doit chercher
 * lui-même où activer le bloc est un marchand qui désinstalle.
 */
const PUBLISHED_THEME_QUERY = `#graphql
  query VariantsyPublishedTheme {
    themes(first: 1, roles: [MAIN]) {
      nodes { id name }
    }
  }
`;

/* ========================================================================== */
/* Schémas                                                                    */
/*                                                                            */
/* La règle de groupage est LA chose qu'un marchand doit comprendre, et la     */
/* seule qu'aucune phrase n'explique bien : « le média assigné ouvre son       */
/* groupe, les suivants le rejoignent » demande trois lectures. Un dessin la   */
/* rend évidente d'un regard. Tout est en CSS : rien à charger, rien à         */
/* maintenir, et les schémas suivent les couleurs de l'admin.                  */
/* ========================================================================== */

const NAVY = "#1F3A5F";
const BEIGE = "#D8C3A5";
const GRIS = "#C9CFD6";

function Vignette({
  color,
  pinned,
  faded,
  legende,
}: {
  color: string;
  pinned?: boolean;
  faded?: boolean;
  legende?: string;
}) {
  return (
    <BlockStack gap="100" inlineAlign="center">
      <span
        style={{
          position: "relative",
          display: "block",
          width: 46,
          height: 56,
          borderRadius: 8,
          background: color,
          opacity: faded ? 0.2 : 1,
          border: "1px solid rgba(0,0,0,.08)",
          boxShadow: faded ? "none" : "0 1px 2px rgba(0,0,0,.06)",
        }}
      >
        {pinned && (
          <span
            style={{
              position: "absolute",
              top: -8,
              right: -8,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#1A1A1A",
              color: "#fff",
              fontSize: 11,
              lineHeight: "20px",
              textAlign: "center",
              fontWeight: 700,
              boxShadow: "0 1px 3px rgba(0,0,0,.25)",
            }}
          >
            ★
          </span>
        )}
      </span>
      {legende && (
        <Text as="span" variant="bodyXs" tone="subdued">
          {legende}
        </Text>
      )}
    </BlockStack>
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  let themeId: string | null = null;
  let themeName: string | null = null;
  try {
    const response = await admin.graphql(PUBLISHED_THEME_QUERY);
    const body = (await response.json()) as {
      data?: { themes?: { nodes: { id: string; name: string }[] } };
    };
    const theme = body?.data?.themes?.nodes?.[0];
    if (theme) {
      themeId = theme.id.split("/").pop() ?? null;
      themeName = theme.name;
    }
  } catch (error) {
    console.error("[setup] thème publié introuvable", error);
  }

  const shopHandle = session.shop.replace(/\.myshopify\.com$/, "");
  // UUID de l'extension : injecté au build par le CLI Shopify. En dev il peut
  // être absent — le lien retombe alors sur l'éditeur de thème simple.
  const extensionUuid = process.env.SHOPIFY_VARIANT_ENGINE_ID || "";
  const deepLink =
    themeId && extensionUuid
      ? `https://admin.shopify.com/store/${shopHandle}/themes/${themeId}/editor?template=product&addAppBlockId=${extensionUuid}/variant-engine&target=mainSection`
      : themeId
        ? `https://admin.shopify.com/store/${shopHandle}/themes/${themeId}/editor?template=product`
        : null;

  return { themeName, deepLink };
};

export default function SetupPage() {
  const { themeName, deepLink } = useLoaderData<typeof loader>();

  return (
    <Page title="Installation" subtitle="Trois minutes, une seule fois.">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="attention">Étape 1</Badge>
                  <Text as="h2" variant="headingMd">
                    Activer le bloc dans votre thème
                  </Text>
                </InlineStack>
                <Text as="p">
                  Variantsy s&apos;ajoute comme bloc d&apos;app dans l&apos;éditeur de thème
                  {themeName ? ` (${themeName})` : ""}. Placez-le juste au-dessus du bouton
                  « Ajouter au panier » de votre modèle produit.
                </Text>
                {deepLink && (
                  <InlineStack>
                    <Button variant="primary" url={deepLink} target="_blank">
                      Ouvrir l&apos;éditeur de thème
                    </Button>
                  </InlineStack>
                )}
                <List type="number">
                  <List.Item>
                    En haut de l&apos;éditeur, basculez sur le modèle <strong>Produit</strong> —
                    le bloc n&apos;existe pas sur les autres modèles.
                  </List.Item>
                  <List.Item>
                    Dans la section principale, cliquez sur « Ajouter un bloc », puis ouvrez
                    l&apos;onglet <strong>Apps</strong>.
                  </List.Item>
                  <List.Item>Choisissez « Variantsy ».</List.Item>
                  <List.Item>Glissez-le au-dessus du bouton d&apos;ajout au panier.</List.Item>
                  <List.Item>Enregistrez.</List.Item>
                </List>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="attention">Étape 2</Badge>
                  <Text as="h2" variant="headingMd">
                    Ranger vos photos dans l&apos;ordre
                  </Text>
                </InlineStack>
                <Text as="p">
                  Une seule règle : dans l&apos;admin Shopify, assignez la{" "}
                  <strong>première photo de chaque coloris</strong> à sa variante, et placez les
                  autres photos du même coloris juste après.
                </Text>

                <Box background="bg-surface-secondary" padding="400" borderRadius="300">
                  <BlockStack gap="400">
                    <InlineStack gap="300" blockAlign="start" wrap>
                      <Vignette color={GRIS} legende="Commune" />
                      <Vignette color={NAVY} pinned legende="Navy" />
                      <Vignette color={NAVY} legende="Navy" />
                      <Vignette color={NAVY} legende="Navy" />
                      <Vignette color={BEIGE} pinned legende="Beige" />
                      <Vignette color={BEIGE} legende="Beige" />
                    </InlineStack>
                    <BlockStack gap="150">
                      <Text as="p" variant="bodySm">
                        <strong>★ = la photo que vous avez assignée à la variante.</strong> Elle
                        ouvre le groupe de son coloris ; les photos qui la suivent le rejoignent,
                        jusqu&apos;à la prochaine photo assignée.
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Vous n&apos;assignez donc qu&apos;une seule photo par coloris, pas les
                        quatre. Celles placées avant la première assignée — guide des tailles,
                        vidéo de marque — restent visibles pour tous les coloris.
                      </Text>
                    </BlockStack>
                  </BlockStack>
                </Box>

                <Divider />

                <Text as="p" variant="headingSm">
                  Ce que ça change pour vos clients
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <Box background="bg-surface-secondary" padding="400" borderRadius="300">
                    <BlockStack gap="300">
                      <Badge tone="critical">Sans Variantsy</Badge>
                      <InlineStack gap="200" wrap>
                        <Vignette color={GRIS} />
                        <Vignette color={NAVY} />
                        <Vignette color={NAVY} />
                        <Vignette color={BEIGE} />
                        <Vignette color={BEIGE} />
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Le client choisit Navy et voit encore du beige.
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box background="bg-surface-secondary" padding="400" borderRadius="300">
                    <BlockStack gap="300">
                      <Badge tone="success">Avec Variantsy</Badge>
                      <InlineStack gap="200" wrap>
                        <Vignette color={GRIS} />
                        <Vignette color={NAVY} />
                        <Vignette color={NAVY} />
                        <Vignette color={BEIGE} faded />
                        <Vignette color={BEIGE} faded />
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Seules les photos du coloris choisi restent, plus les communes.
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineGrid>

                <InlineStack>
                  <Button url="/app/images">Vérifier un produit</Button>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="attention">Étape 3</Badge>
                  <Text as="h2" variant="headingMd">
                    Importer vos couleurs
                  </Text>
                </InlineStack>
                <Text as="p">
                  Dans « Bibliothèque de swatches », lancez l&apos;import : Variantsy parcourt votre
                  catalogue et reconnaît automatiquement les noms de couleurs courants (français et
                  anglais). Vous n&apos;avez plus qu&apos;à corriger les teintes maison.
                </Text>
                <InlineStack>
                  <Button url="/app/swatches">Aller à la bibliothèque</Button>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="attention">Étape 4</Badge>
                  <Text as="h2" variant="headingMd">
                    Ajuster le style
                  </Text>
                </InlineStack>
                <Text as="p">
                  Forme, taille, style de sélection, gestion des ruptures et template de titre se
                  règlent dans « Réglages », avec un aperçu en direct.
                </Text>
                <InlineStack>
                  <Button url="/app">Aller aux réglages</Button>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Le sélecteur natif de mon thème s&apos;affiche encore
                </Text>
                <Text as="p">
                  Variantsy détecte automatiquement les sélecteurs des thèmes Shopify officiels
                  (Dawn, Refresh, Craft, Sense, Studio…) et de la plupart des thèmes premium. Pour un
                  thème très personnalisé, renseignez le sélecteur CSS du bloc à masquer dans
                  « Réglages → Image et intégration au thème ».
                </Text>
                <Text as="p" tone="subdued">
                  Le sélecteur natif n&apos;est jamais supprimé, seulement masqué : Variantsy le
                  pilote en arrière-plan, donc le panier reçoit toujours la bonne variante même si un
                  autre script du thème l&apos;écoute.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
