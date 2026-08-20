import { BlockStack, Badge, Box, Button, Card, Divider, InlineGrid, InlineStack, List, Text } from "@shopify/polaris";
import {
  BLUE, BEIGE, FicheMiniature, SchemaAssignation, SchemaEditeurTheme, SchemaOptions, Vignette,
} from "./schemas";

/* ==========================================================================
   Volet Installation (anciennement « Setup »)

   L'écran demandait d'abord « comment est bâti ce catalogue ? » et proposait
   deux cartes : couleurs en variantes, ou couleurs en fiches séparées. C'était
   redondant et circulaire — les onglets posent déjà la question, et répondre
   « fiches séparées » ne faisait que renvoyer vers l'onglet « Produits liés ».
   Le routeur a disparu.

   Il ne reste que ce qui est vraiment de l'installation : poser le bloc dans
   le thème, préparer ses photos, et le dépannage. Le modèle « une fiche par
   coloris » n'est plus un embranchement mais une simple ligne qui pointe vers
   son onglet, lequel se suffit à lui-même depuis sa refonte.
   ========================================================================== */

export function InstallationPanel({
  themeName,
  deepLink,
  mode,
}: {
  themeName: string | null;
  deepLink: string | null;
  /** Le rangement des photos par variante ne concerne que le mode « variantes » :
   *  une fiche liée n'a qu'un coloris, il n'y a rien à grouper. */
  mode: "variants" | "linked";
}) {
  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            {mode === "variants" && <Badge tone="info">Step 1</Badge>}
            <Text as="h2" variant="headingMd">Turn Variantsy on in your theme</Text>
          </InlineStack>
          <Text as="p">
            Variantsy is an app block. Add it once to your product template
            {themeName ? `, in ${themeName}` : ""}, just above the add-to-cart button.
          </Text>
          {deepLink && (
            <InlineStack>
              <Button variant="primary" url={deepLink} target="_blank">
                Open the theme editor
              </Button>
            </InlineStack>
          )}

          <Box background="bg-surface-secondary" padding="400" borderRadius="300">
            <BlockStack gap="300">
              <SchemaEditeurTheme />
              <Text as="p" variant="bodySm" tone="subdued">
                The <strong>Apps</strong> tab is not the one shown by default — that is
                where almost everyone gets stuck.
              </Text>
            </BlockStack>
          </Box>

          <List type="number">
            <List.Item>Switch to the <strong>Product</strong> template.</List.Item>
            <List.Item>
              Click &ldquo;Add block&rdquo;, then open the <strong>Apps</strong> tab.
            </List.Item>
            <List.Item>Choose &ldquo;Variantsy&rdquo; and drag it above add-to-cart.</List.Item>
            <List.Item>Save.</List.Item>
          </List>
        </BlockStack>
      </Card>

      {mode === "variants" && (
      <Card>
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Badge tone="info">Step 2</Badge>
            <Text as="h2" variant="headingMd">Assign one photo per color</Text>
          </InlineStack>
          <Text as="p">
            Assign the first photo of each color to its variant, and place that
            color&rsquo;s other photos right after it.
          </Text>

          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <Box background="bg-surface-secondary" padding="400" borderRadius="300">
              <BlockStack gap="300">
                <Text as="p" variant="bodySm" fontWeight="semibold">
                  Give each value its shade
                </Text>
                <SchemaOptions />
                <Text as="p" variant="bodySm" tone="subdued">
                  Variantsy reads it straight from Shopify — even an in-house shade no
                  dictionary knows.
                </Text>
              </BlockStack>
            </Box>

            <Box background="bg-surface-secondary" padding="400" borderRadius="300">
              <BlockStack gap="300">
                <Text as="p" variant="bodySm" fontWeight="semibold">
                  Attach a photo to the variant
                </Text>
                <SchemaAssignation />
                <Text as="p" variant="bodySm" tone="subdued">
                  The one step Variantsy cannot do for you.
                </Text>
              </BlockStack>
            </Box>
          </InlineGrid>

          <Box background="bg-surface-secondary" padding="400" borderRadius="300">
            <BlockStack gap="300">
              <Text as="p" variant="bodySm" fontWeight="semibold">
                Then let the others follow
              </Text>
              <InlineStack gap="300" blockAlign="start" wrap>
                <Vignette color={BLUE} pinned legende="Blue" />
                <Vignette color={BLUE} legende="Blue" />
                <Vignette color={BLUE} legende="Blue" />
                <Vignette color={BEIGE} pinned legende="Beige" />
                <Vignette color={BEIGE} legende="Beige" />
              </InlineStack>
              <Text as="p" variant="bodySm">
                <strong>★ = the photo you assigned.</strong> It opens that color&rsquo;s
                group; every photo after it joins the same group, up to the next ★. One
                photo per color, not all four.
              </Text>
            </BlockStack>
          </Box>

          <Divider />

          <Text as="p" variant="headingSm">What your shopper sees</Text>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <FicheMiniature
              titre="Tee · Blue" couleur={BLUE} pastilles={[BLUE, BEIGE]}
              choisie={0} miniatures={2}
            />
            <FicheMiniature
              titre="Tee · Beige" couleur={BEIGE} pastilles={[BLUE, BEIGE]}
              choisie={1} miniatures={2}
            />
          </InlineGrid>
          <Text as="p" variant="bodySm" tone="subdued">
            Same product, two colors: each shopper sees only the photos of theirs.
          </Text>

        </BlockStack>
      </Card>
      )}

      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">My theme&rsquo;s own selector still shows</Text>
          <Text as="p">
            Variantsy detects the official themes (Dawn, Refresh, Craft, Sense, Studio…)
            and most premium ones automatically. For a heavily customized theme, enter the
            CSS selector of the block to hide under Appearance → advanced settings.
          </Text>
          <Text as="p" tone="subdued">
            It is hidden, never removed: Variantsy drives it in the background, so the cart
            always receives the right variant.
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
