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
import { InstallationPanel } from "../components/InstallationPanel";

/** Thème publié : sert au lien direct vers l'éditeur, dans l'onglet Installation. */
const PUBLISHED_THEME_QUERY = `#graphql
  query VariantsyPublishedTheme {
    themes(first: 1, roles: [MAIN]) {
      nodes { id name }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const settings = await getSettings(session.shop);

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
    // L'onglet Installation reste utile sans le lien direct : on n'échoue pas
    // la page entière parce que l'API Admin est indisponible.
    console.error("[setup] thème publié introuvable", error);
  }

  const shopHandle = session.shop.replace(/\.myshopify\.com$/, "");
  const extensionUuid = process.env.SHOPIFY_VARIANT_ENGINE_ID || "";
  const deepLink =
    themeId && extensionUuid
      ? `https://admin.shopify.com/store/${shopHandle}/themes/${themeId}/editor?template=product&addAppBlockId=${extensionUuid}/variant-engine&target=mainSection`
      : themeId
        ? `https://admin.shopify.com/store/${shopHandle}/themes/${themeId}/editor?template=product`
        : null;

  return { settings, themeName, deepLink };
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
    displayMode: str("displayMode", DEFAULT_SETTINGS.displayMode),
    controlRadius: Math.min(20, Math.max(0, int("controlRadius", DEFAULT_SETTINGS.controlRadius))),
    controlSelectedStyle: str("controlSelectedStyle", DEFAULT_SETTINGS.controlSelectedStyle),
    dropdownFullWidth: bool("dropdownFullWidth"),
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
    galleryEnabled: bool("galleryEnabled"),
    groupBy: str("groupBy", DEFAULT_SETTINGS.groupBy),
    commonMediaMode: str("commonMediaMode", DEFAULT_SETTINGS.commonMediaMode),
    altFallback: bool("altFallback"),
    altPrefix: str("altPrefix", ""),
    thumbSelectorCss: str("thumbSelectorCss", ""),
    skipSingleGroup: bool("skipSingleGroup"),
  });

  return { ok: true };
};

const TABS = [
  { id: "installation", content: "Installation", panelID: "panel-installation" },
  { id: "apparence", content: "Apparence", panelID: "panel-apparence" },
  { id: "titre", content: "Titre", panelID: "panel-titre" },
];

export default function SettingsPage() {
  const { settings, themeName, deepLink } = useLoaderData<typeof loader>();
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
            <Card padding="0">
              <div
                style={{
                  borderInlineStart: `4px solid ${
                    form.enabled ? "var(--p-color-bg-fill-success)" : "var(--p-color-border)"
                  }`,
                  borderRadius: "inherit",
                  padding: "var(--p-space-400) var(--p-space-500)",
                }}
              >
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
                <Interrupteur
                  actif={form.enabled}
                  onChange={(v) => set("enabled", v)}
                />
              </InlineStack>
              </div>
            </Card>

            {/* La fonctionnalité principale coupée, et son interrupteur enterré
                dans un repli fermé : sans ce signal, un marchand cherche
                pendant des heures pourquoi ses photos ne se filtrent pas. */}
            {form.enabled && !form.galleryEnabled && (
              <Banner
                tone="warning"
                title="Le filtrage des photos par coloris est désactivé"
                action={{
                  content: "Réactiver",
                  onAction: () => set("galleryEnabled", true),
                }}
              >
                <p>
                  Vos clients voient toutes les photos du produit, quel que soit le coloris
                  choisi. C&apos;est la fonctionnalité principale de Variantsy — les pastilles et
                  le titre continuent de fonctionner sans elle.
                </p>
              </Banner>
            )}

            {/* La barre d'enregistrement de Shopify vit tout en haut du cadre.
                Sur une page longue, on règle en bas, on regarde l'aperçu, et
                on quitte sans avoir enregistré — trois diagnostics ont été
                lancés aujourd'hui sur des réglages jamais sauvegardés. */}
            {dirty && (
              <Banner
                tone="warning"
                title="Modifications non enregistrées"
                action={{
                  content: "Enregistrer",
                  onAction: save,
                  loading: fetcher.state !== "idle",
                }}
                secondaryAction={{ content: "Annuler", onAction: discard }}
              >
                <p>
                  Vos changements sont visibles dans l&apos;aperçu, mais pas encore sur votre
                  boutique.
                </p>
              </Banner>
            )}

            <Card padding="0">
              <Tabs tabs={TABS} selected={tab} onSelect={setTab} fitted>
                <Box padding="500">
                  {tab === 0 && (
                    <InstallationPanel themeName={themeName} deepLink={deepLink} />
                  )}
                  {tab === 1 && <ApparencePanel form={form} set={set} />}
                  {tab === 2 && <TitrePanel form={form} set={set} />}
                </Box>
              </Tabs>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* L'aperçu n'a rien à montrer pendant qu'on lit un guide d'installation :
            il occuperait un tiers de l'écran pour rien. */}
        {tab !== 0 && (
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
        )}
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

/**
 * Interrupteur en capsule.
 *
 * Polaris n'expose pas de composant de bascule : son motif officiel est un
 * bouton « Activer / Désactiver », qui oblige à lire le libellé pour connaître
 * l'état — et un bouton disant « Activer » sur une app active prête à
 * confusion. Une capsule montre l'état par sa position, ce qui se lit sans
 * lire.
 */
function Interrupteur({
  actif,
  onChange,
}: {
  actif: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={actif ? "Désactiver Variantsy" : "Activer Variantsy"}
      onClick={() => onChange(!actif)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: 52,
        height: 30,
        flex: "0 0 auto",
        padding: 3,
        borderRadius: 999,
        cursor: "pointer",
        background: actif
          ? "var(--p-color-bg-fill-success)"
          : "var(--p-color-bg-fill-tertiary)",
        border: "none",
        transition: "background 160ms ease",
        // PIÈGE N°5 : reset du chrome natif sur tout bouton custom.
        WebkitAppearance: "none",
        appearance: "none",
        outline: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        style={{
          display: "block",
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.28)",
          transform: actif ? "translateX(22px)" : "translateX(0)",
          transition: "transform 160ms ease",
        }}
      />
    </button>
  );
}

/**
 * Titre de section, avec un repère coloré.
 *
 * Un simple texte gras se perd dans une page qui en compte cinq. La pastille
 * donne un point d'ancrage à l'œil quand on parcourt, et introduit la couleur
 * de sélection du marchand dans l'interface plutôt que de la réserver aux
 * aperçus.
 */
function SectionTitle({
  children,
  help,
  accent,
}: {
  children: string;
  help?: string;
  accent?: string;
}) {
  return (
    <BlockStack gap="150">
      <InlineStack gap="200" blockAlign="center">
        <span
          style={{
            display: "block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: accent || "var(--p-color-bg-fill-brand)",
            flex: "0 0 auto",
          }}
        />
        <Text as="h3" variant="headingMd">
          {children}
        </Text>
      </InlineStack>
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
 *
 * Les cartes sont volontairement larges : ce sont les commandes principales de
 * la page, et une cible de 100 px se vise sans effort, y compris sur un écran
 * tactile. La sélection se signale par trois signaux redondants — bordure
 * colorée, fond teinté, pastille de validation — pour rester lisible quelle
 * que soit la couleur choisie par le marchand.
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
    <BlockStack gap="300">
      <SectionTitle help={help} accent={accent}>
        {label}
      </SectionTitle>
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
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                minWidth: 108,
                padding: "20px 16px 14px",
                borderRadius: 14,
                cursor: "pointer",
                background: active
                  ? `color-mix(in srgb, ${accent} 7%, var(--p-color-bg-surface))`
                  : "var(--p-color-bg-surface)",
                border: active
                  ? `2px solid ${accent}`
                  : "1px solid var(--p-color-border-secondary)",
                boxShadow: active
                  ? `0 2px 10px color-mix(in srgb, ${accent} 18%, transparent)`
                  : "0 1px 2px rgba(0,0,0,.04)",
                transition: "border-color 120ms ease, box-shadow 120ms ease, background 120ms ease",
                // PIÈGE N°5 : reset du chrome natif sur tout bouton custom.
                WebkitAppearance: "none",
                appearance: "none",
                outline: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {active && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: accent,
                    color: "#fff",
                    fontSize: 10,
                    lineHeight: "16px",
                    textAlign: "center",
                    fontWeight: 700,
                  }}
                >
                  ✓
                </span>
              )}
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 46,
                }}
              >
                {option.preview}
              </span>
              <Text as="span" variant="bodySm" fontWeight={active ? "semibold" : "regular"}>
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
  // Forme, taille, arrondi, style de sélection et repli de couleur n'ont
  // aucun effet sur des boutons texte ou une liste déroulante : les afficher
  // laisserait croire à un réglage sans conséquence.
  const enPastilles = form.displayMode === "swatch";

  return (
    <BlockStack gap="600">
      <ChoiceCards
        label="Comment s'affichent vos coloris"
        help="Ne concerne que les options de couleur. Les tailles restent des boutons texte dans tous les cas."
        value={form.displayMode}
        accent={accent}
        onChange={(v) => set("displayMode", v)}
        options={[
          {
            id: "swatch",
            label: "Pastilles",
            preview: (
              <span style={{ display: "flex", gap: 4 }}>
                <Chip radius={radius} background="#1F3A5F" size={20} />
                <Chip radius={radius} background="#D8C3A5" size={20} />
                <Chip radius={radius} background="#C1614B" size={20} />
              </span>
            ),
          },
          {
            id: "text",
            label: "Boutons texte",
            preview: (
              <span style={{ display: "flex", gap: 4 }}>
                {["S", "M", "L"].map((t) => (
                  <span
                    key={t}
                    style={{
                      minWidth: 22,
                      height: 22,
                      lineHeight: "20px",
                      textAlign: "center",
                      fontSize: 11,
                      borderRadius: 4,
                      border: "1px solid #B0B7BF",
                      color: "#4A4A4A",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </span>
            ),
          },
          {
            id: "dropdown",
            label: "Liste déroulante",
            preview: (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: 76,
                  height: 24,
                  padding: "0 7px",
                  fontSize: 11,
                  color: "#4A4A4A",
                  borderRadius: 4,
                  border: "1px solid #B0B7BF",
                }}
              >
                Navy
                <span style={{ fontSize: 8 }}>▼</span>
              </span>
            ),
          },
        ]}
      />

      <Divider />

      {enPastilles && (
        <>
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
        </>
      )}

      {/* Réglages propres aux deux autres modes : jusqu'ici ils héritaient d'un
          arrondi figé et d'une largeur maximale codée en dur, sans recours. */}
      {!enPastilles && (
        <BlockStack gap="400">
          <ChoiceCards
            label="Comment se voit la case choisie"
            value={form.controlSelectedStyle}
            accent={accent}
            onChange={(v) => set("controlSelectedStyle", v)}
            options={[
              {
                id: "outline",
                label: "Liseré",
                preview: (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 46,
                      height: 28,
                      padding: "0 10px",
                      fontSize: 12,
                      borderRadius: form.controlRadius,
                      border: `2px solid ${accent}`,
                      color: "#4A4A4A",
                      background: "#fff",
                    }}
                  >
                    M
                  </span>
                ),
              },
              {
                id: "fill",
                label: "Fond plein",
                preview: (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 46,
                      height: 28,
                      padding: "0 10px",
                      fontSize: 12,
                      borderRadius: form.controlRadius,
                      border: `1px solid ${accent}`,
                      background: accent,
                      color: contrasteSur(accent),
                    }}
                  >
                    M
                  </span>
                ),
              },
            ]}
          />
          <RangeSlider
            label={`Arrondi des angles — ${form.controlRadius} px`}
            min={0}
            max={20}
            value={form.controlRadius}
            onChange={(v) => set("controlRadius", Number(v))}
            output
            helpText={
              form.displayMode === "dropdown"
                ? "Angles de la liste déroulante."
                : "Angles des boutons."
            }
          />
          {form.displayMode === "dropdown" && (
            <Checkbox
              label="La liste occupe toute la largeur disponible"
              helpText="Sinon elle s'arrête à 320 px, ce qui convient à la plupart des fiches produit."
              checked={form.dropdownFullWidth}
              onChange={(v) => set("dropdownFullWidth", v)}
            />
          )}
        </BlockStack>
      )}

      {form.displayMode !== "dropdown" && (
        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
          {enPastilles ? (
            <RangeSlider
              label={`Taille — ${form.size} px`}
              min={20}
              max={96}
              value={form.size}
              onChange={(v) => set("size", Number(v))}
              output
              helpText="44 px minimum est recommandé pour le tactile."
            />
          ) : (
            <Box />
          )}
          <RangeSlider
            label={`Espacement — ${form.gap} px`}
            min={0}
            max={40}
            value={form.gap}
            onChange={(v) => set("gap", Number(v))}
            output
          />
        </InlineGrid>
      )}

      {enPastilles && (
        <>
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
        </>
      )}

      {/* Une seule couleur à découvert, et c'est celle qui se voit : le liseré
          de sélection, ou l'ombre selon le style choisi. La bordure au repos
          descend dans les avancés — elle reste utile, mais un gris discret
          convient à presque tout le monde. */}
      <ColorField
        label="Couleur de sélection"
        value={form.selectedColor}
        onChange={(v) => set("selectedColor", v)}
        help="Teinte du liseré, de la bordure épaisse ou de l'ombre, selon le style choisi ci-dessus."
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

      {enPastilles && (
        <>
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
        ]}
      />
        </>
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

      {/* Ces deux réglages ne parlent que de pastilles : le nom SOUS la
          pastille n'existe pas ailleurs, et la ligne au-dessus fait doublon
          avec une liste déroulante qui affiche déjà sa valeur. */}
      {enPastilles && (
        <BlockStack gap="300">
          <SectionTitle accent={accent} help="Ce qui accompagne les pastilles, en toutes lettres.">
            Textes affichés
          </SectionTitle>
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
      )}

      {/* Tout ce qui suit fonctionne d'emblée sur la quasi-totalité des thèmes.
          L'exposer laissait croire qu'il fallait s'en occuper — et allongeait
          une page que le marchand traverse pour arrondir ses pastilles. */}
      <Advanced id="avances">
        <Text as="p" variant="bodySm" tone="subdued">
          Ces réglages sont déjà actifs et se règlent seuls. N&apos;y touchez que si quelque
          chose ne s&apos;affiche pas correctement.
        </Text>
        <ColorField
          label="Couleur de bordure au repos"
          value={form.borderColor}
          onChange={(v) => set("borderColor", v)}
        />
        <Checkbox
          label="Filtrer la galerie selon le coloris choisi"
          helpText="C'est la fonctionnalité principale de Variantsy. Décochez pour revenir au comportement natif de Shopify — une seule image par variante. Le regroupement lui-même est entièrement automatique."
          checked={form.galleryEnabled}
          onChange={(v) => set("galleryEnabled", v)}
        />
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
      product_title: "Tee-shirt en lin",
      variant_title: "Écru",
      option1: "Écru",
      option2: "",
      option3: "",
      "option:couleur": "Écru",
      "option:taille": "",
      price: "39,00 €",
      compare_at_price: "",
      sku: "TSH-EC",
      barcode: "",
      vendor: "Atelier Nord",
      product_type: "Tee-shirt",
    },
  },
];

const TITLE_FIELD_ID = "variantsy-title-template";

/** Groupes de variables, pour ne pas jeter douze boutons d'un coup. */
const VARIABLE_GROUPS: { titre: string; teinte: string; tokens: string[] }[] = [
  { titre: "Produit", teinte: "#1F3A5F", tokens: ["{{product_title}}", "{{vendor}}", "{{product_type}}"] },
  {
    titre: "Variante",
    teinte: "#2E7D32",
    tokens: ["{{variant_title}}", "{{option1}}", "{{option2}}", "{{option3}}", "{{option:Couleur}}"],
  },
  { titre: "Prix", teinte: "#C1614B", tokens: ["{{price}}", "{{compare_at_price}}"] },
  { titre: "Références", teinte: "#6D5B8E", tokens: ["{{sku}}", "{{barcode}}"] },
];

function TitrePanel({ form, set }: PanelProps) {
  const accent = form.selectedColor;

  // Insertion à la position du curseur, et non en fin de champ : ajouter
  // aveuglement à la fin produisait des modèles que le marchand n'avait pas
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

  return (
    <BlockStack gap="600">
      <Checkbox
        label="Réécrire le titre du produit selon la variante choisie"
        helpText="Le titre de votre page produit suit alors le coloris ou la taille sélectionnés."
        checked={form.updateTitle}
        onChange={(v) => set("updateTitle", v)}
      />

      {form.updateTitle && (
        <>
          <BlockStack gap="300">
            <SectionTitle accent={accent} help="Composez-le avec les variables ci-dessous.">
              Votre modèle
            </SectionTitle>

            <TextField
              id={TITLE_FIELD_ID}
              label=""
              labelHidden
              value={form.titleTemplate}
              onChange={(v) => set("titleTemplate", v)}
              autoComplete="off"
            />

            {VARIABLE_GROUPS.map((groupe) => (
              <InlineStack key={groupe.titre} gap="200" blockAlign="center" wrap>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 92,
                    fontSize: 12,
                    color: "var(--p-color-text-secondary)",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: groupe.teinte,
                    }}
                  />
                  {groupe.titre}
                </span>
                {groupe.tokens.map((token) => {
                  const variable = TEMPLATE_VARIABLES.find((v) => v.token === token);
                  return (
                    <Button key={token} size="micro" onClick={() => insert(token)}>
                      {variable ? variable.label : token}
                    </Button>
                  );
                })}
              </InlineStack>
            ))}
          </BlockStack>

          {/* Le résultat, rendu comme un vrai titre de fiche produit : c'est la
              seule façon de juger une longueur et une ponctuation. */}
          <BlockStack gap="300">
            <SectionTitle accent={accent}>Ce que verront vos clients</SectionTitle>
            <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
              {TITLE_EXAMPLES.map((exemple, index) => {
                const rendu = renderTemplate(form.titleTemplate, exemple.vars);
                return (
                  <Box
                    key={exemple.nom}
                    background="bg-surface-secondary"
                    padding="400"
                    borderRadius="300"
                  >
                    <BlockStack gap="200">
                      <InlineStack gap="150" blockAlign="center">
                        <span
                          style={{
                            display: "block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: index === 0 ? "#2E7D32" : "#C1614B",
                          }}
                        />
                        <Text as="span" variant="bodyXs" tone="subdued">
                          {exemple.nom}
                        </Text>
                      </InlineStack>
                      <span
                        style={{
                          display: "block",
                          fontSize: 17,
                          fontWeight: 650,
                          lineHeight: 1.3,
                          color: rendu ? "var(--p-color-text)" : "var(--p-color-text-critical)",
                        }}
                      >
                        {rendu || "Titre vide"}
                      </span>
                    </BlockStack>
                  </Box>
                );
              })}
            </InlineGrid>
          </BlockStack>

          {/* Expliquer la syntaxe ne sert à rien tant que la SITUATION n'est
              pas posée : le marchand ne se demande pas ce que font deux
              crochets, il se demande pourquoi son titre est bancal sur
              certains produits. */}
          <BlockStack gap="300">
            <SectionTitle
              accent={accent}
              help="Vos produits n'ont pas tous le même nombre d'options. Un modèle qui mentionne la taille laisse un mot en trop sur un produit qui n'en a pas."
            >
              Un seul modèle pour tout votre catalogue
            </SectionTitle>

            <Box background="bg-surface-secondary" padding="400" borderRadius="300">
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="p" variant="bodyXs" tone="subdued">
                    Le modèle
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <code>{"{{product_title}} — {{option1}} — Taille {{option2}}"}</code>
                  </Text>
                </BlockStack>

                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <BlockStack gap="150">
                    <InlineStack gap="150" blockAlign="center">
                      <Badge tone="success">Sweat</Badge>
                      <Text as="span" variant="bodyXs" tone="subdued">
                        a une taille
                      </Text>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {renderTemplate(
                        "{{product_title}} — {{option1}} — Taille {{option2}}",
                        TITLE_EXAMPLES[0].vars,
                      )}
                    </Text>
                  </BlockStack>

                  <BlockStack gap="150">
                    <InlineStack gap="150" blockAlign="center">
                      <Badge tone="critical">Tee-shirt</Badge>
                      <Text as="span" variant="bodyXs" tone="subdued">
                        n&apos;en a pas
                      </Text>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {renderTemplate(
                        "{{product_title}} — {{option1}} — Taille {{option2}}",
                        TITLE_EXAMPLES[1].vars,
                      )}
                    </Text>
                    <Text as="p" variant="bodyXs" tone="critical">
                      Le mot « Taille » reste, sans rien derrière.
                    </Text>
                  </BlockStack>
                </InlineGrid>
              </BlockStack>
            </Box>

            <Box background="bg-surface-secondary" padding="400" borderRadius="300">
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="p" variant="bodyXs" tone="subdued">
                    La correction : encadrez la partie facultative
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <code>
                      {"{{product_title}} — {{option1}}[[ — Taille {{option2}}]]"}
                    </code>
                  </Text>
                </BlockStack>

                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <BlockStack gap="150">
                    <InlineStack gap="150" blockAlign="center">
                      <Badge tone="success">Sweat</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {renderTemplate(
                        "{{product_title}} — {{option1}}[[ — Taille {{option2}}]]",
                        TITLE_EXAMPLES[0].vars,
                      )}
                    </Text>
                  </BlockStack>

                  <BlockStack gap="150">
                    <InlineStack gap="150" blockAlign="center">
                      <Badge tone="success">Tee-shirt</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {renderTemplate(
                        "{{product_title}} — {{option1}}[[ — Taille {{option2}}]]",
                        TITLE_EXAMPLES[1].vars,
                      )}
                    </Text>
                    <Text as="p" variant="bodyXs" tone="success">
                      Tout le passage entre crochets a disparu.
                    </Text>
                  </BlockStack>
                </InlineGrid>
              </BlockStack>
            </Box>

            <Text as="p" variant="bodySm" tone="subdued">
              Vous n&apos;en avez besoin que si votre modèle contient du <strong>texte</strong>
              autour d&apos;une variable. Un tiret ou une barre oblique restés seuls sont
              nettoyés automatiquement.
            </Text>
          </BlockStack>

          <Banner tone="info">
            <p>
              Si le coloris figure déjà dans le nom de vos produits — « Sweat bleu marine » —
              un modèle qui l&apos;ajoute produira une répétition. Préférez alors « Nom du
              produit seul », ou n&apos;ajoutez que la taille.
            </p>
          </Banner>

          <Advanced id="titre">
            <Checkbox
              label="Mettre aussi à jour le titre de l'onglet du navigateur"
              helpText="Shopify y place déjà le nom de la variante : activer ceci peut donc le faire apparaître deux fois."
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

/**
 * Noir ou blanc, selon ce qui se lit le mieux sur la couleur donnée.
 * Miroir de `contrasteSur()` dans variantsy.js : l'aperçu doit montrer
 * exactement le contraste que le storefront appliquera.
 */
function contrasteSur(couleur: string): string {
  let hex = String(couleur || "#111111").trim();
  const court = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (court) hex = `#${court[1]}${court[1]}${court[2]}${court[2]}${court[3]}${court[3]}`;
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const v = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + v * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff";
}

/** Champ couleur : input natif + saisie hex, gardés synchronisés. */
function ColorField({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
}) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      helpText={help}
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
