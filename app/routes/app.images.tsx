import { useCallback, useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineStack,
  Layout,
  Page,
  Text,
  Thumbnail,
} from "@shopify/polaris";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getSettings, updateSettings, DEFAULT_SETTINGS } from "../settings.server";
import { computeGroups } from "../grouping.js";

/**
 * Requête d'inspection : tout ce qu'il faut pour rejouer exactement le groupage
 * que fera le storefront. `media(first: 1)` sur la variante donne l'image
 * assignée nativement — c'est elle qui ouvre un groupe.
 */
const INSPECT_QUERY = `#graphql
  query VariantsyInspect($id: ID!) {
    product(id: $id) {
      id
      title
      options { name position values }
      media(first: 100) {
        nodes {
          id
          alt
          mediaContentType
          preview { image { url altText } }
        }
      }
      variants(first: 100) {
        nodes {
          id
          title
          selectedOptions { name value }
          media(first: 1) { nodes { id } }
        }
      }
    }
  }
`;

/** `gid://shopify/MediaImage/123` → 123 */
function numericId(gid: string | null | undefined): number | null {
  if (!gid) return null;
  const tail = String(gid).split("/").pop();
  const value = Number(tail);
  return Number.isFinite(value) ? value : null;
}

type MediaView = { id: number; url: string; alt: string; type: string };

/**
 * Forme du retour de `computeGroups`. Le moteur est en JavaScript pur (il doit
 * tourner tel quel dans Node pour le test de comparaison avec le storefront),
 * d'où ce typage explicite côté appelant.
 */
type GroupResult = {
  index: number;
  groups: Record<string, number[]>;
  common: number[];
  order: number[];
  firstKey: string;
} | null;

type Inspection = {
  productTitle: string;
  optionName: string | null;
  groups: { value: string; media: MediaView[] }[];
  common: MediaView[];
  reason: string | null;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getSettings(session.shop);
  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "save") {
    const bool = (key: string) => form.get(key) === "true";
    const str = (key: string, fallback: string) => (form.get(key) as string) ?? fallback;

    await updateSettings(session.shop, {
      galleryEnabled: bool("galleryEnabled"),
      groupBy: str("groupBy", DEFAULT_SETTINGS.groupBy),
      commonMediaMode: str("commonMediaMode", DEFAULT_SETTINGS.commonMediaMode),
      altFallback: bool("altFallback"),
      altPrefix: str("altPrefix", ""),
      thumbSelectorCss: str("thumbSelectorCss", ""),
      skipSingleGroup: bool("skipSingleGroup"),
    });
    return { ok: true };
  }

  if (intent === "inspect") {
    const settings = await getSettings(session.shop);
    const productId = form.get("productId") as string;

    const response = await admin.graphql(INSPECT_QUERY, { variables: { id: productId } });
    const body = (await response.json()) as {
      data?: {
        product?: {
          title: string;
          options: { name: string; position: number; values: string[] }[];
          media: {
            nodes: {
              id: string;
              alt: string | null;
              mediaContentType: string;
              preview: { image: { url: string; altText: string | null } | null } | null;
            }[];
          };
          variants: {
            nodes: {
              id: string;
              title: string;
              selectedOptions: { name: string; value: string }[];
              media: { nodes: { id: string }[] };
            }[];
          };
        };
      };
    };

    const product = body?.data?.product;
    if (!product) return { ok: false, error: "product_not_found" as const };

    const mediaViews: MediaView[] = product.media.nodes
      .map((node) => ({
        id: numericId(node.id) ?? 0,
        url: node.preview?.image?.url ?? "",
        alt: node.alt ?? node.preview?.image?.altText ?? "",
        type: node.mediaContentType,
      }))
      .filter((media) => media.id > 0);

    const byId = new Map(mediaViews.map((media) => [media.id, media]));

    // Payload strictement identique à celui que le bloc Liquid envoie au
    // storefront : c'est la condition pour que l'inspecteur ne mente pas.
    const payload = {
      media: mediaViews.map((media) => ({ id: media.id, alt: media.alt })),
      options: product.options.map((option) => ({ name: option.name, values: option.values })),
      variants: product.variants.nodes.map((variant) => ({
        o: variant.selectedOptions.map((option) => option.value),
        m: numericId(variant.media.nodes[0]?.id),
      })),
    };

    const cfg = {
      enabled: settings.galleryEnabled,
      groupBy: settings.groupBy,
      commonMediaMode: settings.commonMediaMode,
      altFallback: settings.altFallback,
      altPrefix: settings.altPrefix,
      thumbSelectorCss: settings.thumbSelectorCss,
      skipSingleGroup: settings.skipSingleGroup,
    };

    const result = computeGroups(payload, cfg) as GroupResult;

    if (!result) {
      // Un diagnostic précis vaut mieux qu'un « ça ne marche pas » : c'est ce
      // qui évite les tickets de support.
      let reason = "No group detected.";
      if (!settings.galleryEnabled) {
        reason = "Variant galleries are turned off in the settings above.";
      } else if (!mediaViews.length) {
        reason = "This product has no media.";
      } else if (!payload.variants.some((variant) => variant.m)) {
        reason =
          "No image is assigned to a variant in the Shopify admin, and no alt text matches an option value. Assign the first image of each color to its variant.";
      } else {
        reason =
          "Every image falls into a single group. Check that each color has its own assigned image, or turn off &ldquo;Skip when a single group&rdquo; to force filtering.";
      }
      const inspection: Inspection = {
        productTitle: product.title,
        optionName: null,
        groups: [],
        common: mediaViews,
        reason,
      };
      return { ok: true, inspection };
    }

    const inspection: Inspection = {
      productTitle: product.title,
      optionName: product.options[result.index]?.name ?? null,
      groups: Object.keys(result.groups).map((value) => ({
        value,
        media: result.groups[value].map((id) => byId.get(id)).filter(Boolean) as MediaView[],
      })),
      common: result.common.map((id) => byId.get(id)).filter(Boolean) as MediaView[],
      reason: null,
    };
    return { ok: true, inspection };
  }

  return { ok: false };
};

export default function ImagesPage() {
  const { settings } = useLoaderData<typeof loader>();
  const saveFetcher = useFetcher<typeof action>();
  const inspectFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [form, setForm] = useState(settings);
  const [dirty, setDirty] = useState(false);

  const set = useCallback(<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  useEffect(() => {
    if (dirty) shopify.saveBar.show("variantsy-images-save-bar");
    else shopify.saveBar.hide("variantsy-images-save-bar");
  }, [dirty, shopify]);

  useEffect(() => {
    if (saveFetcher.state === "idle" && saveFetcher.data?.ok) {
      setDirty(false);
      shopify.toast.show("Settings saved");
    }
  }, [saveFetcher.state, saveFetcher.data, shopify]);

  const save = () => {
    saveFetcher.submit(
      {
        intent: "save",
        galleryEnabled: String(form.galleryEnabled),
        groupBy: form.groupBy,
        commonMediaMode: form.commonMediaMode,
        altFallback: String(form.altFallback),
        altPrefix: form.altPrefix,
        thumbSelectorCss: form.thumbSelectorCss,
        skipSingleGroup: String(form.skipSingleGroup),
      },
      { method: "POST" },
    );
  };

  const pickProduct = async () => {
    const selection = await shopify.resourcePicker({ type: "product", multiple: false });
    const product = selection?.[0];
    if (!product) return;
    inspectFetcher.submit({ intent: "inspect", productId: product.id }, { method: "POST" });
  };

  const inspection =
    inspectFetcher.data && "inspection" in inspectFetcher.data
      ? (inspectFetcher.data.inspection as Inspection)
      : null;

  return (
    <Page
      title="Inspecteur de produit"
      subtitle="See exactly how Variantsy groups a product's media."
      primaryAction={{
        content: "Enregistrer",
        onAction: save,
        loading: saveFetcher.state !== "idle",
        disabled: !dirty,
      }}
    >
      <SaveBar id="variantsy-images-save-bar">
        <button variant="primary" onClick={save} />
        <button
          onClick={() => {
            setForm(settings);
            setDirty(false);
          }}
        />
      </SaveBar>

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Inspect a product
                  </Text>
                  <Button onClick={pickProduct} loading={inspectFetcher.state !== "idle"}>
                    Choose a product
                  </Button>
                </InlineStack>
                <Text as="p" tone="subdued">
                  Shows exactly the grouping your shoppers will see, computed with the same engine
                  as the storefront. Use it before worrying about an unexpected display.
                </Text>

                {inspectFetcher.data &&
                  "error" in inspectFetcher.data &&
                  inspectFetcher.data.error === "product_not_found" && (
                    <Banner tone="critical" title="Product not found">
                      <p>Try another product.</p>
                    </Banner>
                  )}

                {inspection && (
                  <BlockStack gap="400">
                    <Text as="h3" variant="headingSm">
                      {inspection.productTitle}
                    </Text>

                    {inspection.reason ? (
                      <Banner tone="warning" title="No group detected">
                        <p>{inspection.reason}</p>
                      </Banner>
                    ) : (
                      <Banner tone="success" title={`Groupage par « ${inspection.optionName} »`}>
                        <p>
                          {inspection.groups.length} group(s) detected. Each color will show
                          uniquement ses images.
                        </p>
                      </Banner>
                    )}

                    {inspection.common.length > 0 && (
                      <MediaRow
                        title={
                          inspection.reason
                            ? "Product media"
                            : "Images communes (avant le premier coloris)"
                        }
                        tone="info"
                        media={inspection.common}
                      />
                    )}

                    {inspection.groups.map((group) => (
                      <MediaRow
                        key={group.value}
                        title={group.value}
                        media={group.media}
                        count
                      />
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function MediaRow({
  title,
  media,
  tone,
  count,
}: {
  title: string;
  media: MediaView[];
  tone?: "info";
  count?: boolean;
}) {
  return (
    <Box padding="300" background="bg-surface-secondary" borderRadius="200">
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center">
          <Text as="h4" variant="headingSm">
            {title}
          </Text>
          {tone === "info" && <Badge tone="info">Toujours visibles</Badge>}
          {count && <Badge>{`${media.length} media`}</Badge>}
        </InlineStack>
        <InlineStack gap="200" wrap>
          {media.map((item) => (
            <Thumbnail key={item.id} source={item.url} alt={item.alt} size="medium" />
          ))}
        </InlineStack>
      </BlockStack>
    </Box>
  );
}
