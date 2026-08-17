import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Button,
  Card,
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
                  <List.Item>Dans le modèle « Produit », cliquez sur « Ajouter un bloc ».</List.Item>
                  <List.Item>Choisissez « Sélecteur de variantes Variantsy ».</List.Item>
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
                  Pour afficher plusieurs images par coloris, une seule règle : dans l&apos;admin
                  Shopify, assignez la <strong>première photo de chaque coloris</strong> à sa
                  variante, et placez les autres photos du même coloris juste après. Variantsy
                  s&apos;occupe du reste — aucune étiquette à poser, aucun réglage par produit.
                </Text>
                <Text as="p" tone="subdued">
                  Les photos placées avant le premier coloris (guide des tailles, vidéo de marque)
                  restent visibles pour toutes les variantes.
                </Text>
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
