import { useMemo, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData, useRevalidator } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  EmptyState,
  IndexTable,
  InlineStack,
  Layout,
  Modal,
  Page,
  Select,
  Text,
  TextField,
  Thumbnail,
  useIndexResourceState,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  deleteSwatchValue,
  getSettings,
  listSwatchValues,
  upsertSwatchValue,
} from "../settings.server";
import { normalize } from "../shared";
import { guessColor } from "../colors";

/**
 * Récupère les valeurs d'options existantes dans le catalogue.
 * Limité à 250 produits : au-delà, l'import devient lent et le marchand a de
 * toute façon intérêt à mapper au fil de l'eau. Un vrai plan "catalogue large"
 * passerait par un bulk operation — noté dans CLAUDE.md comme évolution.
 */
const PRODUCT_OPTIONS_QUERY = `#graphql
  query VariantsyProductOptions($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        options { name values }
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [values, settings] = await Promise.all([
    listSwatchValues(session.shop),
    getSettings(session.shop),
  ]);
  return { values, colorOptionNames: settings.colorOptionNames };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    await deleteSwatchValue(session.shop, form.get("id") as string);
    return { ok: true };
  }

  if (intent === "upsert") {
    await upsertSwatchValue(session.shop, {
      optionName: form.get("optionName") as string,
      label: form.get("label") as string,
      kind: (form.get("kind") as string) || "color",
      colorHex: form.get("colorHex") as string,
      colorHex2: form.get("colorHex2") as string,
      imageUrl: form.get("imageUrl") as string,
    });
    return { ok: true };
  }

  if (intent === "import") {
    const settings = await getSettings(session.shop);
    const colorOptions = settings.colorOptionNames.split(",").map(normalize).filter(Boolean);
    const existing = new Set(
      (await listSwatchValues(session.shop)).map((v) => `${v.optionName}::${v.value}`),
    );

    const discovered = new Map<string, { optionName: string; label: string }>();
    let cursor: string | null = null;
    let pages = 0;

    do {
      const response: Response = await admin.graphql(PRODUCT_OPTIONS_QUERY, {
        variables: { cursor },
      });
      const body = (await response.json()) as {
        data?: {
          products?: {
            pageInfo: { hasNextPage: boolean; endCursor: string };
            nodes: { options: { name: string; values: string[] }[] }[];
          };
        };
      };
      const products = body?.data?.products;
      if (!products) break;

      for (const product of products.nodes) {
        for (const option of product.options) {
          if (!colorOptions.includes(normalize(option.name))) continue;
          for (const value of option.values) {
            const key = `${normalize(option.name)}::${normalize(value)}`;
            if (existing.has(key) || discovered.has(key)) continue;
            discovered.set(key, { optionName: option.name, label: value });
          }
        }
      }

      cursor = products.pageInfo.hasNextPage ? products.pageInfo.endCursor : null;
      pages += 1;
    } while (cursor && pages < 3);

    let matched = 0;
    for (const item of discovered.values()) {
      const hex = guessColor(item.label);
      if (hex) matched += 1;
      await upsertSwatchValue(session.shop, {
        optionName: item.optionName,
        label: item.label,
        kind: "color",
        colorHex: hex ?? "#CCCCCC",
      });
    }

    return { ok: true, imported: discovered.size, matched };
  }

  return { ok: false };
};

type SwatchRow = {
  id: string;
  optionName: string;
  value: string;
  label: string;
  kind: string;
  colorHex: string | null;
  colorHex2: string | null;
  imageUrl: string | null;
};

export default function SwatchesPage() {
  const { values, colorOptionNames } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();

  const [editing, setEditing] = useState<Partial<SwatchRow> | null>(null);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = normalize(query);
    return (values as SwatchRow[]).filter(
      (v) => !q || v.value.includes(q) || v.optionName.includes(q),
    );
  }, [values, query]);

  const resourceState = useIndexResourceState(rows as unknown as { [key: string]: unknown }[]);
  const defaultOption = colorOptionNames.split(",")[0]?.trim() || "Couleur";
  const busy = fetcher.state !== "idle";

  const runImport = () => {
    fetcher.submit({ intent: "import" }, { method: "POST" });
  };

  const submitEdit = () => {
    if (!editing?.label) return;
    fetcher.submit(
      {
        intent: "upsert",
        optionName: editing.optionName || defaultOption,
        label: editing.label,
        kind: editing.kind || "color",
        colorHex: editing.colorHex || "",
        colorHex2: editing.colorHex2 || "",
        imageUrl: editing.imageUrl || "",
      },
      { method: "POST" },
    );
    setEditing(null);
    shopify.toast.show("Swatch enregistré");
    setTimeout(() => revalidator.revalidate(), 300);
  };

  const remove = (id: string) => {
    fetcher.submit({ intent: "delete", id }, { method: "POST" });
    setTimeout(() => revalidator.revalidate(), 300);
  };

  return (
    <Page
      title="Bibliothèque de swatches"
      subtitle="Associez chaque valeur d'option à une couleur ou une image. Le mapping s'applique à toute la boutique."
      primaryAction={{
        content: "Importer depuis mes produits",
        onAction: runImport,
        loading: busy,
      }}
      secondaryActions={[{ content: "Ajouter manuellement", onAction: () => setEditing({ kind: "color" }) }]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {fetcher.data && "imported" in fetcher.data && (
              <Banner
                tone={fetcher.data.imported ? "success" : "info"}
                title={
                  fetcher.data.imported
                    ? `${fetcher.data.imported} valeur(s) importée(s)`
                    : "Aucune nouvelle valeur trouvée"
                }
              >
                {fetcher.data.imported ? (
                  <p>
                    {fetcher.data.matched} reconnue(s) automatiquement par leur nom. Les autres sont
                    en gris — corrigez-les en cliquant dessus.
                  </p>
                ) : (
                  <p>
                    Vérifiez que le nom de vos options figure bien dans « Options traitées comme des
                    couleurs » dans les réglages.
                  </p>
                )}
              </Banner>
            )}

            <Card padding="0">
              {rows.length === 0 ? (
                <EmptyState
                  heading="Aucun swatch pour l'instant"
                  action={{ content: "Importer depuis mes produits", onAction: runImport, loading: busy }}
                  secondaryAction={{ content: "Ajouter manuellement", onAction: () => setEditing({ kind: "color" }) }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    L&apos;import parcourt votre catalogue et reconnaît automatiquement les noms de
                    couleurs courants en français et en anglais.
                  </p>
                </EmptyState>
              ) : (
                <BlockStack gap="0">
                  <div style={{ padding: 12 }}>
                    <TextField
                      label="Rechercher"
                      labelHidden
                      value={query}
                      onChange={setQuery}
                      placeholder="Rechercher une valeur…"
                      autoComplete="off"
                      clearButton
                      onClearButtonClick={() => setQuery("")}
                    />
                  </div>
                  <IndexTable
                    resourceName={{ singular: "swatch", plural: "swatches" }}
                    itemCount={rows.length}
                    selectedItemsCount={resourceState.selectedResources.length}
                    onSelectionChange={resourceState.handleSelectionChange}
                    headings={[
                      { title: "Aperçu" },
                      { title: "Valeur" },
                      { title: "Option" },
                      { title: "Type" },
                      { title: "" },
                    ]}
                  >
                    {rows.map((row, index) => (
                      <IndexTable.Row
                        id={row.id}
                        key={row.id}
                        position={index}
                        selected={resourceState.selectedResources.includes(row.id)}
                        onClick={() => setEditing(row)}
                      >
                        <IndexTable.Cell>
                          <SwatchDot row={row} />
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Text as="span" fontWeight="semibold">
                            {row.label}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>{row.optionName}</IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={row.kind === "image" ? "info" : undefined}>
                            {row.kind === "image" ? "Image" : row.kind === "gradient" ? "Bicolore" : "Couleur"}
                          </Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Button
                            variant="tertiary"
                            tone="critical"
                            onClick={() => remove(row.id)}
                            accessibilityLabel={`Supprimer ${row.label}`}
                          >
                            Supprimer
                          </Button>
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                </BlockStack>
              )}
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.id ? `Modifier « ${editing.label} »` : "Ajouter un swatch"}
          primaryAction={{ content: "Enregistrer", onAction: submitEdit, disabled: !editing.label }}
          secondaryActions={[{ content: "Annuler", onAction: () => setEditing(null) }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <InlineStack gap="300" blockAlign="center">
                <SwatchDot row={editing as SwatchRow} size={48} />
                <Text as="span" tone="subdued">
                  Aperçu
                </Text>
              </InlineStack>
              <TextField
                label="Valeur de l'option"
                value={editing.label || ""}
                onChange={(v) => setEditing({ ...editing, label: v })}
                helpText="Doit correspondre exactement à la valeur dans vos produits (la casse et les accents sont ignorés)."
                autoComplete="off"
              />
              <TextField
                label="Nom de l'option"
                value={editing.optionName || defaultOption}
                onChange={(v) => setEditing({ ...editing, optionName: v })}
                autoComplete="off"
              />
              <Select
                label="Type de swatch"
                options={[
                  { label: "Couleur unie", value: "color" },
                  { label: "Bicolore (dégradé)", value: "gradient" },
                  { label: "Image / texture", value: "image" },
                ]}
                value={editing.kind || "color"}
                onChange={(v) => setEditing({ ...editing, kind: v })}
              />
              {editing.kind !== "image" && (
                <InlineStack gap="300">
                  <TextField
                    label="Couleur"
                    value={editing.colorHex || ""}
                    onChange={(v) => setEditing({ ...editing, colorHex: v })}
                    placeholder="#1F3A5F"
                    autoComplete="off"
                  />
                  {editing.kind === "gradient" && (
                    <TextField
                      label="Deuxième couleur"
                      value={editing.colorHex2 || ""}
                      onChange={(v) => setEditing({ ...editing, colorHex2: v })}
                      placeholder="#FFFFFF"
                      autoComplete="off"
                    />
                  )}
                </InlineStack>
              )}
              {editing.kind === "image" && (
                <TextField
                  label="URL de l'image"
                  value={editing.imageUrl || ""}
                  onChange={(v) => setEditing({ ...editing, imageUrl: v })}
                  helpText="Téléversez le fichier dans Contenu → Fichiers, puis collez son URL ici."
                  placeholder="https://cdn.shopify.com/s/files/..."
                  autoComplete="off"
                />
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}

function SwatchDot({ row, size = 28 }: { row: Partial<SwatchRow>; size?: number }) {
  if (row.kind === "image" && row.imageUrl) {
    return <Thumbnail source={row.imageUrl} alt={row.label || ""} size="small" />;
  }
  const background =
    row.kind === "gradient" && row.colorHex && row.colorHex2
      ? `linear-gradient(135deg, ${row.colorHex} 0 50%, ${row.colorHex2} 50% 100%)`
      : row.colorHex || "#CCCCCC";
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background,
        border: "1px solid rgba(0,0,0,.12)",
      }}
    />
  );
}
