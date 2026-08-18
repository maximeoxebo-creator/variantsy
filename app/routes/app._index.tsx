import { useCallback, useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, SerializeFrom } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Badge,
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
  { id: "titre", content: "Titre", panelID: "panel-titre" },
  { id: "aide", content: "Aide", panelID: "panel-aide" },
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
            {/* L'interrupteur maître ne vit dans aucun onglet : c'est le seul
                réglage dont la réponse change tout, et le chercher derrière un
                onglet n'aurait aucun sens. */}
            <Card>
              <InlineStack align="space-between" blockAlign="center" gap="400">
                <BlockStack gap="100">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Variantsy
                    </Text>
                    <Badge tone={form.enabled ? "success" : undefined}>
                      {form.enabled ? "Actif" : "Inactif"}
                    </Badge>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {form.enabled
                      ? "Vos pastilles et vos galeries par coloris sont en ligne."
                      : "Rien ne s'affiche sur votre boutique tant que l'app est désactivée."}
                  </Text>
                </BlockStack>
                <Button
                  variant={form.enabled ? undefined : "primary"}
                  onClick={() => set("enabled", !form.enabled)}
                >
                  {form.enabled ? "Désactiver" : "Activer"}
                </Button>
              </InlineStack>
            </Card>

            <Card padding="0">
              <Tabs tabs={TABS} selected={tab} onSelect={setTab} fitted>
                <Box padding="400">
                  {tab === 0 && <ApparencePanel form={form} set={set} />}
                  {tab === 1 && <TitrePanel form={form} set={set} />}
                  {tab === 2 && <AidePanel />}
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
 * Choix présenté sur des rendus, pas sur des intitulés.
 *
 * « Anneau extérieur », « Deviner la couleur », « Barrer la pastille » ne
 * disent rien tant qu'on ne les a pas vus : le marchand devait essayer chaque
 * valeur pour comparer. Chaque option est donc dessinée avec les réglages en
 * cours, et le choix se fait à l'œil.
 */
function ChoiceCards({
  label,
  help,
  value,
  accent,
  options,
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  accent: string;
  options: { id: string; label: string; preview: React.ReactNode }[];
  onChange: (value: string) => void;
}) {
  return (
    <BlockStack gap="200">
      <BlockStack gap="050">
        <Text as="p" variant="bodyMd">
          {label}
        </Text>
        {help && (
          <Text as="p" variant="bodySm" tone="subdued">
            {help}
          </Text>
        )}
      </BlockStack>
      <InlineStack gap="300" wrap>
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={active}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                minWidth: 84,
                padding: "14px 12px",
                borderRadius: 10,
                cursor: "pointer",
                background: active ? "var(--p-color-bg-surface-selected)" : "transparent",
                border: active ? `2px solid ${accent}` : "1px solid var(--p-color-border)",
                // PIÈGE N°5 : reset du chrome natif sur tout bouton custom.
                WebkitAppearance: "none",
                appearance: "none",
                outline: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", height: 44 }}>
                {option.preview}
              </span>
              <Text as="span" variant="bodySm">
                {option.label}
              </Text>
            </button>
          );
        })}
      </InlineStack>
    </BlockStack>
  );
}

/** Pastille de démonstration, partagée par tous les sélecteurs ci-dessus. */
function Chip({
  radius,
  background,
  border,
  boxShadow,
  opacity,
  struck,
  size = 30,
}: {
  radius: string;
  background: string;
  border?: string;
  boxShadow?: string;
  opacity?: number;
  struck?: boolean;
  size?: number;
}) {
  return (
    <span
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: radius,
        background,
        border: border ?? "1px solid #B0B7BF",
        boxShadow,
        opacity,
        display: "block",
      }}
    >
      {struck && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            background:
              "linear-gradient(to top left, transparent calc(50% - 1px), rgba(120,120,120,.9) 50%, transparent calc(50% + 1px))",
          }}
        />
      )}
    </span>
  );
}

function ApparencePanel({ form, set }: PanelProps) {
  const radius =
    form.shape === "circle" ? "50%" : form.shape === "rounded" ? `${form.cornerRadius}px` : "0px";
  const accent = form.selectedColor;

  return (
    <BlockStack gap="500">
      <ChoiceCards
        label="Forme des pastilles"
        value={form.shape}
        accent={accent}
        onChange={(v) => set("shape", v)}
        options={[
          { id: "circle", label: "Cercle", preview: <Chip radius="50%" background="#C9CFD6" /> },
          {
            id: "rounded",
            label: "Arrondi",
            preview: <Chip radius={`${form.cornerRadius}px`} background="#C9CFD6" />,
          },
          { id: "square", label: "Carré", preview: <Chip radius="0px" background="#C9CFD6" /> },
        ]}
      />

      {form.shape === "rounded" && (
        <RangeSlider
          label={`Arrondi des angles — ${form.cornerRadius} px`}
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

      <Divider />

      <ChoiceCards
        label="Comment se voit la pastille choisie"
        value={form.selectedStyle}
        accent={accent}
        onChange={(v) => set("selectedStyle", v)}
        options={[
          {
            id: "ring",
            label: "Anneau",
            preview: (
              <Chip
                radius={radius}
                background="#C9CFD6"
                boxShadow={`0 0 0 ${form.selectedGap}px #fff, 0 0 0 ${form.selectedGap + form.selectedWidth}px ${accent}`}
              />
            ),
          },
          {
            id: "border",
            label: "Bordure",
            preview: (
              <Chip
                radius={radius}
                background="#C9CFD6"
                border={`${form.selectedWidth}px solid ${accent}`}
              />
            ),
          },
          {
            id: "shadow",
            label: "Ombre",
            preview: (
              <Chip radius={radius} background="#C9CFD6" boxShadow={`0 2px 8px ${accent}66`} />
            ),
          },
        ]}
      />

      <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
        <ColorField
          label="Couleur de sélection"
          value={form.selectedColor}
          onChange={(v) => set("selectedColor", v)}
        />
        <ColorField
          label="Couleur de bordure"
          value={form.borderColor}
          onChange={(v) => set("borderColor", v)}
        />
      </InlineGrid>

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
            />
          ) : (
            <Box />
          )}
        </InlineGrid>
      )}

      <RangeSlider
        label={`Épaisseur de bordure — ${form.borderWidth} px`}
        min={0}
        max={6}
        value={form.borderWidth}
        onChange={(v) => set("borderWidth", Number(v))}
        output
      />

      <Divider />

      <ChoiceCards
        label="Quand une couleur n'est pas renseignée"
        help="Ce que verra le client pour une valeur absente de votre Bibliothèque de swatches. Chaque aperçu montre trois valeurs différentes : Navy, Beige, Terracotta."
        value={form.swatchFallback}
        accent={accent}
        onChange={(v) => set("swatchFallback", v)}
        options={[
          {
            id: "color",
            label: "Une couleur par nom",
            preview: (
              <span style={{ display: "flex", gap: 4 }}>
                <Chip radius={radius} background="#1F3A5F" size={20} />
                <Chip radius={radius} background="#D8C3A5" size={20} />
                <Chip radius={radius} background="#C1614B" size={20} />
              </span>
            ),
          },
          {
            id: "image",
            label: "La photo du produit",
            preview: (
              <span style={{ display: "flex", gap: 4 }}>
                <Chip
                  radius={radius}
                  background="linear-gradient(135deg,#8FA3B5 0 50%,#6E8296 50%)"
                  size={20}
                />
                <Chip
                  radius={radius}
                  background="linear-gradient(135deg,#D6CCBB 0 50%,#B8AB94 50%)"
                  size={20}
                />
                <Chip
                  radius={radius}
                  background="linear-gradient(135deg,#C79A88 0 50%,#A97462 50%)"
                  size={20}
                />
              </span>
            ),
          },
          {
            id: "neutral",
            label: "Aucune couleur",
            preview: (
              <span style={{ display: "flex", gap: 4 }}>
                <Chip radius={radius} background={form.neutralColor} size={20} />
                <Chip radius={radius} background={form.neutralColor} size={20} />
                <Chip radius={radius} background={form.neutralColor} size={20} />
              </span>
            ),
          },
        ]}
      />

      {form.swatchFallback !== "image" && (
        <ColorField
          label="Teinte utilisée"
          value={form.neutralColor}
          onChange={(v) => set("neutralColor", v)}
        />
      )}

      {/* Piège réel : toutes les valeurs non renseignées prennent la MÊME
          teinte. Sans leur nom affiché, le client voit des pastilles
          identiques et ne peut pas choisir. Le mode reste légitime — c'est le
          seul qui n'invente rien — mais il exige les libellés. */}
      {form.swatchFallback === "neutral" && !form.showLabels && (
        <Banner
          tone="warning"
          title="Vos clients ne pourront pas distinguer les coloris"
          action={{
            content: "Afficher les noms",
            onAction: () => set("showLabels", true),
          }}
        >
          <p>
            Toutes les valeurs non renseignées prennent la même teinte. Sans leur nom sous la
            pastille, le client voit des ronds identiques. Affichez les noms, ou renseignez vos
            couleurs dans la Bibliothèque de swatches.
          </p>
        </Banner>
      )}

      <Divider />

      <ChoiceCards
        label="Quand un coloris est en rupture"
        value={form.soldOutStyle}
        accent={accent}
        onChange={(v) => set("soldOutStyle", v)}
        options={[
          {
            id: "strikethrough",
            label: "Barré",
            preview: <Chip radius={radius} background="#C9CFD6" struck />,
          },
          {
            id: "dim",
            label: "Atténué",
            preview: <Chip radius={radius} background="#C9CFD6" opacity={0.35} />,
          },
          {
            id: "hide",
            label: "Retiré",
            preview: (
              <Chip radius={radius} background="transparent" border="1px dashed #B0B7BF" />
            ),
          },
        ]}
      />
      {form.soldOutStyle === "hide" && (
        <Text as="p" variant="bodySm" tone="subdued">
          Le client ne saura pas que ce coloris existe — il ne pourra donc pas demander son retour
          en stock.
        </Text>
      )}

      <Divider />

      <BlockStack gap="300">
        <Text as="p" variant="bodyMd">
          Textes affichés
        </Text>
        <Checkbox
          label="Le nom de la couleur sous chaque pastille"
          checked={form.showLabels}
          onChange={(v) => set("showLabels", v)}
        />
        <Checkbox
          label="La ligne « Couleur : Bleu marine » au-dessus des pastilles"
          checked={form.showOptionName}
          onChange={(v) => set("showOptionName", v)}
        />
      </BlockStack>

      {/* Tout ce qui suit fonctionne d'emblée sur la quasi-totalité des thèmes.
          L'exposer laissait croire qu'il fallait s'en occuper — et allongeait
          une page que le marchand traverse pour arrondir ses pastilles. */}
      <Advanced id="avances">
        <Text as="p" variant="bodySm" tone="subdued">
          Ces réglages sont déjà actifs et se règlent seuls. N&apos;y touchez que si quelque
          chose ne s&apos;affiche pas correctement.
        </Text>
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
          label="Forcer certaines options en pastilles"
          helpText="Variantsy reconnaît une option de couleur à ses valeurs, quel que soit son nom. Ne remplissez ceci que pour un nuancier composé uniquement de teintes maison. Séparez par des virgules."
          value={form.colorOptionNames}
          onChange={(v) => set("colorOptionNames", v)}
          autoComplete="off"
        />
        <TextField
          label="Sélecteur CSS du bloc à masquer"
          value={form.nativeSelectorCss}
          onChange={(v) => set("nativeSelectorCss", v)}
          disabled={!form.hideNativeSelector}
          autoComplete="off"
          placeholder="Laisser vide pour la détection automatique"
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

/* ========================================================================== */
/* Volet Aide                                                                 */
/*                                                                            */
/* La règle de groupage des photos est LA chose qu'un marchand doit           */
/* comprendre, et la seule qu'aucune phrase n'explique bien : « le média      */
/* assigné ouvre son groupe, les suivants le rejoignent » demande trois       */
/* lectures. Un schéma la rend évidente en un regard.                         */
/* ========================================================================== */

/** Vignette de schéma : un rectangle coloré, éventuellement épinglé. */
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
          borderRadius: 6,
          background: color,
          opacity: faded ? 0.25 : 1,
          border: "1px solid rgba(0,0,0,.08)",
        }}
      >
        {pinned && (
          <span
            style={{
              position: "absolute",
              top: -7,
              right: -7,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#1A1A1A",
              color: "#fff",
              fontSize: 11,
              lineHeight: "18px",
              textAlign: "center",
              fontWeight: 700,
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

const NAVY = "#1F3A5F";
const BEIGE = "#D8C3A5";
const GRIS = "#C9CFD6";

function AidePanel() {
  return (
    <BlockStack gap="500">
      {/* ---------------------------------------------------------------- */}
      <BlockStack gap="300">
        <SectionTitle help="Une seule règle à retenir, et aucun réglage produit par produit.">
          1. Rangez vos photos par coloris
        </SectionTitle>

        <Box background="bg-surface-secondary" padding="400" borderRadius="300">
          <BlockStack gap="400">
            <InlineStack gap="200" blockAlign="start" wrap>
              <Vignette color={GRIS} legende="Guide" />
              <Vignette color={NAVY} pinned legende="Navy" />
              <Vignette color={NAVY} legende="Navy" />
              <Vignette color={NAVY} legende="Navy" />
              <Vignette color={BEIGE} pinned legende="Beige" />
              <Vignette color={BEIGE} legende="Beige" />
            </InlineStack>

            <BlockStack gap="150">
              <Text as="p" variant="bodySm">
                <strong>★ = la photo que vous avez assignée à la variante</strong> dans
                l&apos;admin Shopify. Elle <strong>ouvre</strong> le groupe de son coloris.
              </Text>
              <Text as="p" variant="bodySm">
                Les photos qui la suivent <strong>rejoignent ce groupe</strong>, jusqu&apos;à la
                prochaine photo assignée. Vous n&apos;avez donc à assigner qu&apos;une seule
                photo par coloris — pas les quatre.
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Les photos placées <strong>avant</strong> la première assignée (guide des
                tailles, vidéo de marque) restent visibles pour tous les coloris.
              </Text>
            </BlockStack>
          </BlockStack>
        </Box>
      </BlockStack>

      <Divider />

      {/* ---------------------------------------------------------------- */}
      <BlockStack gap="300">
        <SectionTitle help="Le client ne voit plus que les photos du coloris qu'il a choisi.">
          2. Ce que ça change pour vos clients
        </SectionTitle>

        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
          <Box background="bg-surface-secondary" padding="400" borderRadius="300">
            <BlockStack gap="300">
              <Badge tone="critical">Sans Variantsy</Badge>
              <InlineStack gap="150" wrap>
                <Vignette color={GRIS} />
                <Vignette color={NAVY} />
                <Vignette color={NAVY} />
                <Vignette color={NAVY} />
                <Vignette color={BEIGE} />
                <Vignette color={BEIGE} />
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Toutes les photos, tout le temps. Le client choisit Navy et voit encore du beige.
              </Text>
            </BlockStack>
          </Box>

          <Box background="bg-surface-secondary" padding="400" borderRadius="300">
            <BlockStack gap="300">
              <Badge tone="success">Avec Variantsy</Badge>
              <InlineStack gap="150" wrap>
                <Vignette color={GRIS} />
                <Vignette color={NAVY} />
                <Vignette color={NAVY} />
                <Vignette color={NAVY} />
                <Vignette color={BEIGE} faded />
                <Vignette color={BEIGE} faded />
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Coloris Navy choisi : seules ses photos restent, plus les photos communes.
              </Text>
            </BlockStack>
          </Box>
        </InlineGrid>
      </BlockStack>

      <Divider />

      {/* ---------------------------------------------------------------- */}
      <BlockStack gap="300">
        <SectionTitle help="Trois vérifications qui règlent la quasi-totalité des cas.">
          3. Rien ne s&apos;affiche ?
        </SectionTitle>

        <BlockStack gap="200">
          <Text as="p" variant="bodySm">
            <strong>Le bloc n&apos;est pas dans votre thème.</strong> Il ne s&apos;ajoute jamais
            tout seul : éditeur de thème, modèle <em>Produit</em>, « Ajouter un bloc », onglet
            <em> Apps</em>, « Variantsy ».
          </Text>
          <Text as="p" variant="bodySm">
            <strong>Le produit n&apos;a qu&apos;une seule variante.</strong> Un sélecteur à un
            seul choix n&apos;a pas de sens : Variantsy ne rend rien, volontairement.
          </Text>
          <Text as="p" variant="bodySm">
            <strong>Aucune photo n&apos;est assignée à une variante.</strong> Sans point de
            départ, le groupage est impossible — Variantsy laisse alors la galerie entière
            plutôt que de la découper au hasard.
          </Text>
        </BlockStack>

        <InlineStack gap="200">
          <Button url="/app/setup">Guide d&apos;installation</Button>
          <Button url="/app/images">Vérifier un produit</Button>
        </InlineStack>
      </BlockStack>
    </BlockStack>
  );
}
