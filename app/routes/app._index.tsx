import { useCallback, useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, SerializeFrom } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Collapsible,
  Divider,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  RangeSlider,
  Select,
  Tabs,
  Text,
  TextField,
  Banner,
} from "@shopify/polaris";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { TEMPLATE_VARIABLES, renderTemplate } from "../shared";
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

const TABS = [
  { id: "apparence", content: "Apparence", panelID: "panel-apparence" },
  { id: "comportement", content: "Comportement", panelID: "panel-comportement" },
  { id: "titre", content: "Titre", panelID: "panel-titre" },
];

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [form, setForm] = useState(settings);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState(0);

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
      subtitle="Apparence des swatches, titre dynamique et intégration au thème"
      primaryAction={{
        content: "Enregistrer",
        onAction: save,
        loading: fetcher.state !== "idle",
        disabled: !dirty,
      }}
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
                <p>
                  Rien ne s&apos;affiche sur votre boutique tant que cette option est désactivée.
                  Réactivez-la dans l&apos;onglet « Comportement ».
                </p>
              </Banner>
            )}

            <Card padding="0">
              <Tabs tabs={TABS} selected={tab} onSelect={setTab} fitted>
                <Box padding="400">
                  {tab === 0 && <ApparencePanel form={form} set={set} />}
                  {tab === 1 && <ComportementPanel form={form} set={set} />}
                  {tab === 2 && <TitrePanel form={form} set={set} />}
                </Box>
              </Tabs>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Box position="sticky" insetBlockStart="400">
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
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

/* ========================================================================== */
/* Panneaux                                                                   */
/*                                                                            */
/* Les réglages étaient auparavant empilés dans un seul défilement de cinq     */
/* cartes, réglages de style et sélecteurs CSS mêlés. Le découpage suit        */
/* désormais la question que se pose le marchand : à quoi ça ressemble, ce que */
/* ça fait, ce que ça écrit, et comment ça s'entend avec le thème.             */
/* ========================================================================== */

// SerializeFrom et non le type Prisma brut : après passage par le loader,
// les dates sont des chaînes, pas des Date.
type Settings = SerializeFrom<typeof loader>["settings"];

type PanelProps = {
  form: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

function SectionTitle({ children, help }: { children: string; help?: string }) {
  return (
    <BlockStack gap="100">
      <Text as="h3" variant="headingSm">
        {children}
      </Text>
      {help && (
        <Text as="p" variant="bodySm" tone="subdued">
          {help}
        </Text>
      )}
    </BlockStack>
  );
}

/** Réglages techniques, repliés par défaut : la plupart des thèmes n'en ont pas besoin. */
function Advanced({ id, children }: { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <BlockStack gap="200">
      <Divider />
      <InlineStack>
        <Button
          variant="plain"
          disclosure={open ? "up" : "down"}
          onClick={() => setOpen((v) => !v)}
        >
          Réglages avancés
        </Button>
      </InlineStack>
      <Collapsible id={`avances-${id}`} open={open}>
        <Box paddingBlockStart="200">
          <BlockStack gap="400">{children}</BlockStack>
        </Box>
      </Collapsible>
    </BlockStack>
  );
}

/**
 * Choix de la forme sur des formes réellement dessinées.
 *
 * Une liste déroulante « Cercle / Carré arrondi / Carré » oblige le marchand à
 * se représenter le résultat, puis à essayer chaque valeur pour comparer. Les
 * trois formes affichées côte à côte suppriment cet aller-retour.
 */
function ShapePicker({
  value,
  cornerRadius,
  selectedColor,
  onChange,
}: {
  value: string;
  cornerRadius: number;
  selectedColor: string;
  onChange: (value: string) => void;
}) {
  const shapes = [
    { id: "circle", label: "Cercle", radius: "50%" },
    { id: "rounded", label: "Arrondi", radius: `${cornerRadius}px` },
    { id: "square", label: "Carré", radius: "2px" },
  ];

  return (
    <BlockStack gap="200">
      <Text as="p" variant="bodyMd">
        Forme
      </Text>
      <InlineStack gap="300">
        {shapes.map((shape) => {
          const active = value === shape.id;
          return (
            <button
              key={shape.id}
              type="button"
              onClick={() => onChange(shape.id)}
              aria-pressed={active}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                borderRadius: 10,
                cursor: "pointer",
                background: active ? "var(--p-color-bg-surface-selected)" : "transparent",
                border: active
                  ? `2px solid ${selectedColor}`
                  : "1px solid var(--p-color-border)",
                // PIÈGE N°5 : reset du chrome natif sur tout bouton custom.
                WebkitAppearance: "none",
                appearance: "none",
                outline: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: shape.radius,
                  background: "#C9CFD6",
                  border: "1px solid #B0B7BF",
                  display: "block",
                }}
              />
              <Text as="span" variant="bodySm">
                {shape.label}
              </Text>
            </button>
          );
        })}
      </InlineStack>
    </BlockStack>
  );
}

/**
 * Choix du style de sélection sur des pastilles réellement stylées.
 *
 * « Anneau extérieur », « Bordure épaisse » et « Ombre portée » sont trois
 * intitulés qui ne disent rien tant qu'on ne les a pas vus. Chaque option est
 * donc rendue avec ses propres réglages, dans son état sélectionné.
 */
function SelectionPicker({
  value,
  color,
  width,
  gap,
  radius,
  onChange,
}: {
  value: string;
  color: string;
  width: number;
  gap: number;
  radius: string;
  onChange: (value: string) => void;
}) {
  const styles: { id: string; label: string; shadow: string; border: string }[] = [
    {
      id: "ring",
      label: "Anneau",
      shadow: `0 0 0 ${gap}px #fff, 0 0 0 ${gap + width}px ${color}`,
      border: "1px solid #B0B7BF",
    },
    { id: "border", label: "Bordure", shadow: "none", border: `${width}px solid ${color}` },
    {
      id: "shadow",
      label: "Ombre",
      shadow: `0 2px 8px ${color}66`,
      border: "1px solid #B0B7BF",
    },
  ];

  return (
    <BlockStack gap="200">
      <Text as="p" variant="bodyMd">
        Sélection
      </Text>
      <InlineStack gap="300">
        {styles.map((style) => {
          const active = value === style.id;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onChange(style.id)}
              aria-pressed={active}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                padding: "14px 18px",
                borderRadius: 10,
                cursor: "pointer",
                background: active ? "var(--p-color-bg-surface-selected)" : "transparent",
                border: active ? `2px solid ${color}` : "1px solid var(--p-color-border)",
                WebkitAppearance: "none",
                appearance: "none",
                outline: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: radius,
                  background: "#C9CFD6",
                  border: style.border,
                  boxShadow: style.shadow,
                  display: "block",
                }}
              />
              <Text as="span" variant="bodySm">
                {style.label}
              </Text>
            </button>
          );
        })}
      </InlineStack>
    </BlockStack>
  );
}

function ApparencePanel({ form, set }: PanelProps) {
  return (
    <BlockStack gap="500">
      <BlockStack gap="400">
        <SectionTitle help="La forme et la taille des pastilles telles que vos clients les verront.">
          Forme
        </SectionTitle>
        <ShapePicker
          value={form.shape}
          cornerRadius={form.cornerRadius}
          selectedColor={form.selectedColor}
          onChange={(v) => set("shape", v)}
        />
        {form.shape === "rounded" && (
          <RangeSlider
            label={`Arrondi — ${form.cornerRadius} px`}
            min={0}
            max={24}
            value={form.cornerRadius}
            onChange={(v) => set("cornerRadius", Number(v))}
            output
          />
        )}

        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
          <RangeSlider
            label={`Taille — ${form.size} px`}
            min={20}
            max={96}
            value={form.size}
            onChange={(v) => set("size", Number(v))}
            output
            helpText="44 px minimum est recommandé pour le tactile."
          />
          <RangeSlider
            label={`Espacement — ${form.gap} px`}
            min={0}
            max={40}
            value={form.gap}
            onChange={(v) => set("gap", Number(v))}
            output
          />
        </InlineGrid>
      </BlockStack>

      <Divider />

      <BlockStack gap="400">
        <SectionTitle help="Comment on distingue la pastille choisie des autres.">
          Sélection
        </SectionTitle>
        <SelectionPicker
          value={form.selectedStyle}
          color={form.selectedColor}
          width={form.selectedWidth}
          gap={form.selectedGap}
          radius={
            form.shape === "circle"
              ? "50%"
              : form.shape === "rounded"
                ? `${form.cornerRadius}px`
                : "2px"
          }
          onChange={(v) => set("selectedStyle", v)}
        />
        <ColorField
          label="Couleur de sélection"
          value={form.selectedColor}
          onChange={(v) => set("selectedColor", v)}
        />

        {form.selectedStyle !== "shadow" && (
          <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
            <RangeSlider
              label={`Épaisseur du trait — ${form.selectedWidth} px`}
              min={1}
              max={8}
              value={form.selectedWidth}
              onChange={(v) => set("selectedWidth", Number(v))}
              output
            />
            {form.selectedStyle === "ring" ? (
              <RangeSlider
                label={`Écart avec la pastille — ${form.selectedGap} px`}
                min={0}
                max={8}
                value={form.selectedGap}
                onChange={(v) => set("selectedGap", Number(v))}
                output
                helpText="À 0, l'anneau vient coller à la pastille."
              />
            ) : (
              <Box />
            )}
          </InlineGrid>
        )}
      </BlockStack>

      <Divider />

      <BlockStack gap="400">
        <SectionTitle help="Ce qu'affiche une pastille dont la couleur n'est pas encore renseignée.">
          Couleurs
        </SectionTitle>
        <Select
          label="Valeur sans couleur définie"
          options={[
            { label: "Deviner la couleur d'après son nom", value: "color" },
            { label: "Afficher la photo de la variante", value: "image" },
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
        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
          <ColorField
            label="Couleur de bordure"
            value={form.borderColor}
            onChange={(v) => set("borderColor", v)}
          />
          {form.swatchFallback !== "image" ? (
            <ColorField
              label="Teinte neutre"
              value={form.neutralColor}
              onChange={(v) => set("neutralColor", v)}
            />
          ) : (
            <Box />
          )}
        </InlineGrid>
        <RangeSlider
          label={`Épaisseur de bordure — ${form.borderWidth} px`}
          min={0}
          max={6}
          value={form.borderWidth}
          onChange={(v) => set("borderWidth", Number(v))}
          output
          helpText="Bordure de la pastille au repos, à ne pas confondre avec le trait de sélection."
        />
      </BlockStack>
    </BlockStack>
  );
}

function ComportementPanel({ form, set }: PanelProps) {
  return (
    <BlockStack gap="500">
      <BlockStack gap="400">
        <SectionTitle>Général</SectionTitle>
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

      <Divider />

      <BlockStack gap="400">
        <SectionTitle help="Ce que voit le client sur les libellés et les ruptures de stock.">
          Libellés et disponibilité
        </SectionTitle>
        <Checkbox
          label="Afficher le nom de la valeur sous chaque pastille"
          checked={form.showLabels}
          onChange={(v) => set("showLabels", v)}
        />
        <Checkbox
          label="Afficher « Couleur : Bleu marine » au-dessus des pastilles"
          checked={form.showOptionName}
          onChange={(v) => set("showOptionName", v)}
        />
        <Select
          label="Variantes en rupture"
          options={[
            { label: "Barrer la pastille", value: "strikethrough" },
            { label: "Atténuer (opacité réduite)", value: "dim" },
            { label: "Masquer complètement", value: "hide" },
          ]}
          helpText="Masquer complètement peut dérouter : le client ne sait pas que le coloris existe."
          value={form.soldOutStyle}
          onChange={(v) => set("soldOutStyle", v)}
        />
      </BlockStack>

      <Divider />

      <BlockStack gap="400">
        <SectionTitle help="Détails qui rendent la sélection plus fluide.">Confort</SectionTitle>
        <Checkbox
          label="Précharger l'image au survol d'une pastille"
          helpText="Le changement d'image paraît instantané au clic."
          checked={form.preloadOnHover}
          onChange={(v) => set("preloadOnHover", v)}
        />
        <Checkbox
          label="Mettre à jour l'URL (?variant=…) à la sélection"
          helpText="Permet de partager un lien qui ouvre directement le bon coloris."
          checked={form.updateUrl}
          onChange={(v) => set("updateUrl", v)}
        />
      </BlockStack>

      {/* Intégration au thème : replié par défaut. Ces réglages fonctionnent
          d'eux-mêmes sur la quasi-totalité des thèmes, et les exposer laissait
          croire qu'il fallait s'en occuper. */}
      <Advanced id="theme">
        <Text as="p" variant="bodySm" tone="subdued">
          Variantsy détecte seul le sélecteur et la galerie de votre thème. Ne touchez à ces
          réglages que si quelque chose ne s'affiche pas correctement.
        </Text>
        <Checkbox
          label="Masquer le sélecteur de variantes natif du thème"
          helpText="Variantsy continue de le piloter en arrière-plan : le panier reçoit toujours la bonne variante, même si un autre script l'écoute."
          checked={form.hideNativeSelector}
          onChange={(v) => set("hideNativeSelector", v)}
        />
        <Checkbox
          label="Changer l'image principale à la sélection"
          checked={form.swapImage}
          onChange={(v) => set("swapImage", v)}
        />
        <TextField
          label="Sélecteur CSS du bloc à masquer"
          value={form.nativeSelectorCss}
          onChange={(v) => set("nativeSelectorCss", v)}
          disabled={!form.hideNativeSelector}
          autoComplete="off"
          placeholder="Laisser vide pour la détection automatique"
          helpText="Utile sur un thème très personnalisé dont le sélecteur n'est pas reconnu."
        />
        <TextField
          label="Sélecteur CSS de la galerie"
          value={form.imageSelectorCss}
          onChange={(v) => set("imageSelectorCss", v)}
          disabled={!form.swapImage}
          autoComplete="off"
          placeholder="Laisser vide pour la détection automatique"
        />
      </Advanced>
    </BlockStack>
  );
}

const TITLE_PRESETS = [
  {
    label: "Nom du produit seul",
    hint: "Le titre ne change jamais.",
    value: "{{product_title}}",
  },
  {
    label: "Nom — Coloris",
    hint: "Pour un catalogue dont les noms ne mentionnent pas le coloris.",
    value: "{{product_title}} — {{option1}}",
  },
  {
    label: "Nom — Coloris / Taille",
    hint: "La taille disparaît d'elle-même sur les produits qui n'en ont pas.",
    value: "{{product_title}} — {{option1}}[[ / {{option2}}]]",
  },
  {
    label: "Nom — Référence",
    hint: "Affiche le SKU de la variante choisie.",
    value: "{{product_title}}[[ — {{sku}}]]",
  },
];

/** Deux produits fictifs : un à deux options, un à une seule. Leur intérêt est
 *  de rendre visible ce que font les blocs conditionnels — invisible sinon. */
const TITLE_EXAMPLES: { nom: string; vars: Record<string, string> }[] = [
  {
    nom: "Produit à deux options",
    vars: {
      product_title: "Sweat en coton bio",
      variant_title: "Bleu marine / M",
      option1: "Bleu marine",
      option2: "M",
      option3: "",
      "option:couleur": "Bleu marine",
      "option:taille": "M",
      price: "59,00 €",
      compare_at_price: "79,00 €",
      sku: "SWT-001-BM-M",
      barcode: "3760000000017",
      vendor: "Atelier Nord",
      product_type: "Sweat",
    },
  },
  {
    nom: "Produit à une seule option",
    vars: {
      product_title: "Cocotte en fonte",
      variant_title: "Navy",
      option1: "Navy",
      option2: "",
      option3: "",
      "option:couleur": "Navy",
      "option:taille": "",
      price: "129,00 €",
      compare_at_price: "",
      sku: "ALMA25-NV",
      barcode: "",
      vendor: "La Fonderie",
      product_type: "Cocotte",
    },
  },
];

const TITLE_FIELD_ID = "variantsy-title-template";

function TitrePanel({ form, set }: PanelProps) {
  // Insertion à la position du curseur, et non en fin de champ : ajouter
  // aveuglement à la fin produisait des templates que le marchand n'avait pas
  // voulus — c'est ainsi qu'un « {{price}} » s'est retrouvé collé à un titre.
  const insert = (token: string) => {
    const field = document.getElementById(TITLE_FIELD_ID) as HTMLInputElement | null;
    const value = form.titleTemplate;
    if (!field || field.selectionStart === null) {
      set("titleTemplate", value + token);
      return;
    }
    const start = field.selectionStart;
    const end = field.selectionEnd ?? start;
    set("titleTemplate", value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const actif = TITLE_PRESETS.find((p) => p.value === form.titleTemplate);

  return (
    <BlockStack gap="400">
      <SectionTitle help="Réécrit le titre affiché sur la page produit selon la variante choisie.">
        Titre dynamique
      </SectionTitle>

      <Checkbox
        label="Mettre à jour le titre du produit à la sélection"
        checked={form.updateTitle}
        onChange={(v) => set("updateTitle", v)}
      />

      {form.updateTitle && (
        <>
          <BlockStack gap="200">
            <Text as="p" variant="bodySm" fontWeight="semibold">
              Modèles prêts à l&apos;emploi
            </Text>
            <InlineStack gap="200" wrap>
              {TITLE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  size="slim"
                  pressed={preset.value === form.titleTemplate}
                  onClick={() => set("titleTemplate", preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </InlineStack>
            {actif && (
              <Text as="p" variant="bodySm" tone="subdued">
                {actif.hint}
              </Text>
            )}
          </BlockStack>

          <TextField
            id={TITLE_FIELD_ID}
            label="Modèle"
            value={form.titleTemplate}
            onChange={(v) => set("titleTemplate", v)}
            autoComplete="off"
            helpText="Les boutons ci-dessous insèrent à l'endroit de votre curseur."
          />

          <BlockStack gap="200">
            <Text as="p" variant="bodySm" tone="subdued">
              Insérer une variable
            </Text>
            <InlineStack gap="150" wrap>
              {TEMPLATE_VARIABLES.map((variable) => (
                <Button key={variable.token} size="micro" onClick={() => insert(variable.token)}>
                  {variable.label}
                </Button>
              ))}
            </InlineStack>
          </BlockStack>

          <Box background="bg-surface-secondary" padding="300" borderRadius="200">
            <BlockStack gap="300">
              <Text as="p" variant="bodySm" fontWeight="semibold">
                Ce que verront vos clients
              </Text>
              {TITLE_EXAMPLES.map((exemple) => {
                const rendu = renderTemplate(form.titleTemplate, exemple.vars);
                return (
                  <BlockStack key={exemple.nom} gap="050">
                    <Text as="p" variant="bodyXs" tone="subdued">
                      {exemple.nom}
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {rendu || "— (titre vide)"}
                    </Text>
                  </BlockStack>
                );
              })}
            </BlockStack>
          </Box>

          <Box background="bg-surface-secondary" padding="300" borderRadius="200">
            <BlockStack gap="150">
              <Text as="p" variant="bodySm" fontWeight="semibold">
                Faire disparaître un séparateur devenu inutile
              </Text>
              <Text as="p" variant="bodySm">
                Ce qui est placé entre <code>[[</code> et <code>]]</code> s&apos;efface
                entièrement dès qu&apos;une de ses variables est vide. Sans cela,
                <code> {"{{option1}} / {{option2}}"}</code> laisse un « / » orphelin sur les
                produits à une seule option — visible dans le second exemple ci-dessus.
              </Text>
            </BlockStack>
          </Box>

          <Advanced id="titre">
            <Checkbox
              label="Mettre aussi à jour le titre de l'onglet du navigateur"
              helpText="Le suffixe de votre thème (« – Ma Boutique ») est conservé."
              checked={form.updateDocumentTitle}
              onChange={(v) => set("updateDocumentTitle", v)}
            />
            <TextField
              label="Sélecteur CSS du titre"
              value={form.titleSelectorCss}
              onChange={(v) => set("titleSelectorCss", v)}
              autoComplete="off"
              placeholder="Laisser vide pour la détection automatique"
              helpText="À renseigner uniquement si votre thème utilise un balisage inhabituel."
            />
          </Advanced>
        </>
      )}
    </BlockStack>
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
