import { useCallback, useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  RangeSlider,
  Select,
  Text,
  TextField,
  Banner,
} from "@shopify/polaris";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { TEMPLATE_VARIABLES } from "../shared";
import { authenticate } from "../shopify.server";
import { getSettings, updateSettings, DEFAULT_SETTINGS } from "../settings.server";
import { SwatchPreview } from "../components/SwatchPreview";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getSettings(session.shop);
  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();

  const bool = (key: string) => form.get(key) === "true";
  const int = (key: string, fallback: number) => {
    const raw = Number(form.get(key));
    return Number.isFinite(raw) ? raw : fallback;
  };
  const str = (key: string, fallback: string) => (form.get(key) as string) ?? fallback;

  await updateSettings(session.shop, {
    enabled: bool("enabled"),
    shape: str("shape", DEFAULT_SETTINGS.shape),
    size: Math.min(96, Math.max(20, int("size", DEFAULT_SETTINGS.size))),
    gap: Math.min(40, Math.max(0, int("gap", DEFAULT_SETTINGS.gap))),
    borderWidth: Math.min(6, Math.max(0, int("borderWidth", DEFAULT_SETTINGS.borderWidth))),
    borderColor: str("borderColor", DEFAULT_SETTINGS.borderColor),
    selectedStyle: str("selectedStyle", DEFAULT_SETTINGS.selectedStyle),
    selectedColor: str("selectedColor", DEFAULT_SETTINGS.selectedColor),
    selectedWidth: Math.min(8, Math.max(1, int("selectedWidth", DEFAULT_SETTINGS.selectedWidth))),
    selectedGap: Math.min(8, Math.max(0, int("selectedGap", DEFAULT_SETTINGS.selectedGap))),
    cornerRadius: Math.min(24, Math.max(0, int("cornerRadius", DEFAULT_SETTINGS.cornerRadius))),
    swatchFallback: str("swatchFallback", DEFAULT_SETTINGS.swatchFallback),
    neutralColor: str("neutralColor", DEFAULT_SETTINGS.neutralColor),
    showLabels: bool("showLabels"),
    showOptionName: bool("showOptionName"),
    soldOutStyle: str("soldOutStyle", DEFAULT_SETTINGS.soldOutStyle),
    hideNativeSelector: bool("hideNativeSelector"),
    nativeSelectorCss: str("nativeSelectorCss", ""),
    updateUrl: bool("updateUrl"),
    preloadOnHover: bool("preloadOnHover"),
    swapImage: bool("swapImage"),
    imageSelectorCss: str("imageSelectorCss", ""),
    updateTitle: bool("updateTitle"),
    titleTemplate: str("titleTemplate", DEFAULT_SETTINGS.titleTemplate),
    titleSelectorCss: str("titleSelectorCss", ""),
    updateDocumentTitle: bool("updateDocumentTitle"),
    colorOptionNames: str("colorOptionNames", DEFAULT_SETTINGS.colorOptionNames),
  });

  return { ok: true };
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [form, setForm] = useState(settings);
  const [dirty, setDirty] = useState(false);

  const set = useCallback(<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  useEffect(() => {
    if (dirty) shopify.saveBar.show("variantsy-save-bar");
    else shopify.saveBar.hide("variantsy-save-bar");
  }, [dirty, shopify]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      setDirty(false);
      shopify.toast.show("Réglages enregistrés");
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const save = () => {
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (key === "id" || key === "shop" || key === "createdAt" || key === "updatedAt") return;
      data.append(key, String(value));
    });
    fetcher.submit(data, { method: "POST" });
  };

  const discard = () => {
    setForm(settings);
    setDirty(false);
  };

  return (
    <Page
      title="Réglages"
      subtitle="Swatches, titre dynamique et intégration au thème"
      primaryAction={{ content: "Enregistrer", onAction: save, loading: fetcher.state !== "idle", disabled: !dirty }}
    >
      <SaveBar id="variantsy-save-bar">
        <button variant="primary" onClick={save} />
        <button onClick={discard} />
      </SaveBar>

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {!form.enabled && (
              <Banner tone="warning" title="Variantsy est désactivé">
                <p>Les swatches ne s&apos;affichent pas sur votre boutique tant que cette option est désactivée.</p>
              </Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Général
                </Text>
                <Checkbox
                  label="Activer Variantsy sur la boutique"
                  helpText="Coupe l'affichage partout sans avoir à retirer le bloc du thème."
                  checked={form.enabled}
                  onChange={(v) => set("enabled", v)}
                />
                <TextField
                  label="Options traitées comme des couleurs"
                  helpText="Ces options s'affichent en pastilles. Les autres (Taille, Matière…) s'affichent en boutons texte. Séparez par des virgules."
                  value={form.colorOptionNames}
                  onChange={(v) => set("colorOptionNames", v)}
                  autoComplete="off"
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Apparence
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <Select
                    label="Forme"
                    options={[
                      { label: "Cercle", value: "circle" },
                      { label: "Carré arrondi", value: "rounded" },
                      { label: "Carré", value: "square" },
                    ]}
                    value={form.shape}
                    onChange={(v) => set("shape", v)}
                  />
                  <Select
                    label="Style de sélection"
                    options={[
                      { label: "Anneau extérieur", value: "ring" },
                      { label: "Bordure épaisse", value: "border" },
                      { label: "Ombre portée", value: "shadow" },
                    ]}
                    value={form.selectedStyle}
                    onChange={(v) => set("selectedStyle", v)}
                  />
                </InlineGrid>

                <RangeSlider
                  label={`Taille — ${form.size} px`}
                  min={20}
                  max={96}
                  value={form.size}
                  onChange={(v) => set("size", v as number)}
                  output
                />
                <RangeSlider
                  label={`Espacement — ${form.gap} px`}
                  min={0}
                  max={40}
                  value={form.gap}
                  onChange={(v) => set("gap", v as number)}
                  output
                />
                <RangeSlider
                  label={`Épaisseur de bordure — ${form.borderWidth} px`}
                  min={0}
                  max={6}
                  value={form.borderWidth}
                  onChange={(v) => set("borderWidth", v as number)}
                  output
                  helpText="Bordure de la pastille au repos, à ne pas confondre avec le trait de sélection ci-dessous."
                />

                {form.shape === "rounded" && (
                  <RangeSlider
                    label={`Arrondi des coins — ${form.cornerRadius} px`}
                    min={0}
                    max={24}
                    value={form.cornerRadius}
                    onChange={(v) => set("cornerRadius", v as number)}
                    output
                  />
                )}

                {form.selectedStyle !== "shadow" && (
                  <RangeSlider
                    label={`Épaisseur du trait de sélection — ${form.selectedWidth} px`}
                    min={1}
                    max={8}
                    value={form.selectedWidth}
                    onChange={(v) => set("selectedWidth", v as number)}
                    output
                  />
                )}

                {form.selectedStyle === "ring" && (
                  <RangeSlider
                    label={`Écart entre la pastille et l'anneau — ${form.selectedGap} px`}
                    min={0}
                    max={8}
                    value={form.selectedGap}
                    onChange={(v) => set("selectedGap", v as number)}
                    output
                    helpText="À 0, l'anneau vient coller à la pastille."
                  />
                )}

                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <ColorField
                    label="Couleur de bordure"
                    value={form.borderColor}
                    onChange={(v) => set("borderColor", v)}
                  />
                  <ColorField
                    label="Couleur de sélection"
                    value={form.selectedColor}
                    onChange={(v) => set("selectedColor", v)}
                  />
                </InlineGrid>

                <Divider />
                <Select
                  label="Valeur sans couleur définie"
                  options={[
                    { label: "Afficher la photo de la variante", value: "image" },
                    { label: "Deviner la couleur d'après son nom", value: "color" },
                    { label: "Toujours la teinte neutre", value: "neutral" },
                  ]}
                  value={form.swatchFallback}
                  onChange={(v) => set("swatchFallback", v)}
                  helpText={
                    form.swatchFallback === "image"
                      ? "Trompeur quand toutes vos photos se ressemblent : vous obtenez une rangée de vignettes indiscernables au lieu d'un nuancier."
                      : form.swatchFallback === "color"
                        ? "Variantsy reconnaît les noms courants en français et en anglais (« Navy », « Bleu marine », « Terracotta »…). Les teintes maison se saisissent en hexadécimal dans la Bibliothèque de swatches."
                        : "Toutes les valeurs non renseignées prennent la même teinte."
                  }
                />
                {form.swatchFallback !== "image" && (
                  <ColorField
                    label="Teinte neutre"
                    value={form.neutralColor}
                    onChange={(v) => set("neutralColor", v)}
                  />
                )}

                <Divider />
                <Checkbox
                  label="Afficher le nom de la valeur sous chaque swatch"
                  checked={form.showLabels}
                  onChange={(v) => set("showLabels", v)}
                />
                <Checkbox
                  label="Afficher « Couleur : Bleu marine » au-dessus des swatches"
                  checked={form.showOptionName}
                  onChange={(v) => set("showOptionName", v)}
                />
                <Select
                  label="Variantes en rupture"
                  options={[
                    { label: "Barrer le swatch", value: "strikethrough" },
                    { label: "Atténuer (opacité réduite)", value: "dim" },
                    { label: "Masquer complètement", value: "hide" },
                  ]}
                  helpText="Masquer complètement peut dérouter : le client ne sait pas que le coloris existe."
                  value={form.soldOutStyle}
                  onChange={(v) => set("soldOutStyle", v)}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Titre dynamique
                </Text>
                <Checkbox
                  label="Mettre à jour le titre du produit à la sélection"
                  checked={form.updateTitle}
                  onChange={(v) => set("updateTitle", v)}
                />
                <TextField
                  label="Template du titre"
                  value={form.titleTemplate}
                  onChange={(v) => set("titleTemplate", v)}
                  disabled={!form.updateTitle}
                  autoComplete="off"
                  helpText="Cliquez sur une variable ci-dessous pour l'insérer."
                />

                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Variables disponibles
                  </Text>
                  <InlineStack gap="150" wrap>
                    {TEMPLATE_VARIABLES.map((variable) => (
                      <Button
                        key={variable.token}
                        size="micro"
                        disabled={!form.updateTitle}
                        onClick={() => set("titleTemplate", form.titleTemplate + variable.token)}
                      >
                        {variable.token}
                      </Button>
                    ))}
                  </InlineStack>
                </BlockStack>

                <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                  <BlockStack gap="150">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Blocs conditionnels
                    </Text>
                    <Text as="p" variant="bodySm">
                      Ce qui est entre <code>[[</code> et <code>]]</code> disparaît si l&apos;une des
                      variables du bloc est vide. Utile pour ne pas laisser un séparateur orphelin
                      sur les produits à une seule option.
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Exemple : <code>{"{{product_title}} — {{option1}}[[ / {{option2}}]]"}</code>
                    </Text>
                  </BlockStack>
                </Box>

                <Checkbox
                  label="Mettre aussi à jour le titre de l'onglet du navigateur"
                  helpText="Le suffixe de votre thème (« – Ma Boutique ») est conservé."
                  checked={form.updateDocumentTitle}
                  onChange={(v) => set("updateDocumentTitle", v)}
                  disabled={!form.updateTitle}
                />
                <TextField
                  label="Sélecteur CSS du titre (optionnel)"
                  value={form.titleSelectorCss}
                  onChange={(v) => set("titleSelectorCss", v)}
                  disabled={!form.updateTitle}
                  autoComplete="off"
                  placeholder="Laisser vide pour la détection automatique"
                  helpText="À renseigner uniquement si votre thème utilise un balisage inhabituel."
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Image et intégration au thème
                </Text>
                <Banner tone="info">
                  <p>
                    L&apos;affichage de <strong>plusieurs images par variante</strong> se configure
                    dans « Images par variante ». Les réglages ci-dessous ne concernent que le
                    repli utilisé quand le groupage ne s&apos;applique pas.
                  </p>
                </Banner>
                <Checkbox
                  label="Changer l'image principale à la sélection"
                  checked={form.swapImage}
                  onChange={(v) => set("swapImage", v)}
                />
                <TextField
                  label="Sélecteur CSS de la galerie (optionnel)"
                  value={form.imageSelectorCss}
                  onChange={(v) => set("imageSelectorCss", v)}
                  disabled={!form.swapImage}
                  autoComplete="off"
                  placeholder="Laisser vide pour la détection automatique"
                />
                <Checkbox
                  label="Précharger l'image au survol d'un swatch"
                  helpText="Le changement d'image paraît instantané au clic."
                  checked={form.preloadOnHover}
                  onChange={(v) => set("preloadOnHover", v)}
                />
                <Divider />
                <Checkbox
                  label="Masquer le sélecteur de variantes natif du thème"
                  helpText="Variantsy continue de le piloter en arrière-plan : le panier reçoit toujours la bonne variante."
                  checked={form.hideNativeSelector}
                  onChange={(v) => set("hideNativeSelector", v)}
                />
                <TextField
                  label="Sélecteur CSS à masquer (optionnel)"
                  value={form.nativeSelectorCss}
                  onChange={(v) => set("nativeSelectorCss", v)}
                  disabled={!form.hideNativeSelector}
                  autoComplete="off"
                  placeholder="Laisser vide pour la détection automatique"
                />
                <Checkbox
                  label="Mettre à jour l'URL (?variant=…) à la sélection"
                  helpText="Permet de partager un lien qui ouvre directement le bon coloris."
                  checked={form.updateUrl}
                  onChange={(v) => set("updateUrl", v)}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Box position="sticky" insetBlockStart="400">
            <BlockStack gap="300">
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Aperçu
                    </Text>
                    <Text as="span" tone="subdued" variant="bodySm">
                      Cliquable
                    </Text>
                  </InlineStack>
                  <SwatchPreview settings={form} />
                  <Text as="p" tone="subdued" variant="bodySm">
                    Aperçu indicatif : la typographie et les espacements reprennent ceux de votre
                    thème une fois en ligne.
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

/** Champ couleur : input natif + saisie hex, gardés synchronisés. */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      autoComplete="off"
      prefix={
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={label}
          style={{
            width: 24,
            height: 24,
            padding: 0,
            border: "1px solid #D9D9D9",
            borderRadius: 4,
            background: "none",
            cursor: "pointer",
            WebkitAppearance: "none",
            appearance: "none",
            outline: "none",
          }}
        />
      }
    />
  );
}
