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
import { listGroups, saveGroup, deleteGroup } from "../groups.server";
import { SwatchPreview } from "../components/SwatchPreview";
import { InstallationPanel } from "../components/InstallationPanel";
import { LiensProduitsPanel } from "../components/LiensProduitsPanel";

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

  const groups = await listGroups(session.shop);

  return { settings, themeName, deepLink, groups };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();

  // Une seule route sert les réglages ET les groupes : l'app tient sur une page
  // à onglets, et deux routes d'action obligeraient à sortir de cette page.
  const intention = form.get("_intent");

  if (intention === "group-save") {
    const resultat = await saveGroup(admin, session.shop, {
      id: (form.get("id") as string) || undefined,
      label: (form.get("label") as string) || "Color",
      members: JSON.parse((form.get("members") as string) || "[]"),
    });
    return { ok: resultat.ok, groupErrors: resultat.errors, kind: "group" as const };
  }

  if (intention === "group-delete") {
    await deleteGroup(admin, session.shop, form.get("id") as string);
    return { ok: true, groupErrors: [], kind: "group-deleted" as const };
  }

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
    photoScale: Math.min(220, Math.max(100, int("photoScale", DEFAULT_SETTINGS.photoScale))),
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
  { id: "apparence", content: "Appearance", panelID: "panel-apparence" },
  { id: "titre", content: "Title", panelID: "panel-titre" },
  { id: "combinees", content: "Linked products", panelID: "panel-combinees" },
];

export default function SettingsPage() {
  const { settings, themeName, deepLink, groups } = useLoaderData<typeof loader>();
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
    if (fetcher.state !== "idle" || !fetcher.data?.ok) return;
    // La même action sert les réglages et les groupes : sans cette distinction,
    // enregistrer un groupe annonçait « Settings saved » et effaçait l'état
    // « modifications non enregistrées » du formulaire de réglages.
    const kind = (fetcher.data as { kind?: string }).kind;
    if (kind === "group") {
      shopify.toast.show("Group saved");
    } else if (kind === "group-deleted") {
      shopify.toast.show("Group deleted");
    } else {
      setDirty(false);
      shopify.toast.show("Settings saved");
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
      title="Settings"
      subtitle="Swatch appearance, dynamic title and theme integration"
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
                  <Text as="h2" variant="headingMd">
                    Variantsy
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {form.enabled
                      ? "Vos pastilles et vos galeries par coloris sont en ligne."
                      : "Nothing shows on your storefront while the app is turned off."}
                  </Text>
                </BlockStack>
                {/* L'état et son interrupteur voyagent ensemble : le badge
                    nomme ce que la capsule montre, les séparer obligeait à
                    traverser la carte pour relier les deux. */}
                <InlineStack gap="300" blockAlign="center" wrap={false}>
                  <Badge tone={form.enabled ? "success" : undefined}>
                    {form.enabled ? "Actif" : "Inactif"}
                  </Badge>
                  <Interrupteur actif={form.enabled} onChange={(v) => set("enabled", v)} />
                </InlineStack>
              </InlineStack>
              </div>
            </Card>

            {/* La fonctionnalité principale coupée, et son interrupteur enterré
                dans un repli fermé : sans ce signal, un marchand cherche
                pendant des heures pourquoi ses photos ne se filtrent pas. */}
            {form.enabled && !form.galleryEnabled && (
              <Banner
                tone="warning"
                title="Photo filtering by color is turned off"
                action={{
                  content: "Turn back on",
                  onAction: () => set("galleryEnabled", true),
                }}
              >
                <p>
                  Vos clients voient toutes les photos du produit, quel que soit le coloris
                  chosen. This is the core of Variantsy — swatches and titles keep working without it,
                  but the gallery no longer follows the color.
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
                title="Unsaved changes"
                action={{
                  content: "Save",
                  onAction: save,
                  loading: fetcher.state !== "idle",
                }}
                secondaryAction={{ content: "Annuler", onAction: discard }}
              >
                <p>
                  Your changes appear in the preview, but not yet on your storefront.
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
                  {tab === 3 && <LiensProduitsPanel
                      groups={groups}
                      enregistrement={fetcher.state !== "idle"}
                      erreurs={
                        (fetcher.data as { groupErrors?: string[] } | undefined)
                          ?.groupErrors ?? []
                      }
                      onSave={(b) => {
                        const data = new FormData();
                        data.append("_intent", "group-save");
                        if (b.id) data.append("id", b.id);
                        data.append("label", b.label);
                        data.append("members", JSON.stringify(b.members));
                        fetcher.submit(data, { method: "POST" });
                      }}
                      onDelete={(id) => {
                        const data = new FormData();
                        data.append("_intent", "group-delete");
                        data.append("id", id);
                        fetcher.submit(data, { method: "POST" });
                      }}
                    />}
                </Box>
              </Tabs>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* L'aperçu n'a rien à montrer pendant qu'on lit un guide d'installation :
            il occuperait un tiers de l'écran pour rien. */}
        {tab !== 0 && tab !== 3 && (
        <Layout.Section variant="oneThird">
          <Box position="sticky" insetBlockStart="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Preview
                  </Text>
                  <Text as="span" tone="subdued" variant="bodySm">
                    Clickable
                  </Text>
                </InlineStack>
                <SwatchPreview settings={form} />
                <Text as="p" tone="subdued" variant="bodySm">
                  Indicative preview: type and spacing will follow your theme once live.
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
  // Le libellé était figé sur « Variantsy » : réutiliser le composant pour un
  // second réglage aurait annoncé « Désactiver Variantsy » à un lecteur d'écran
  // en coupant seulement les collections.
  quoi = "Variantsy",
}: {
  actif: boolean;
  onChange: (value: boolean) => void;
  quoi?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={(actif ? "Turn off " : "Turn on ") + quoi}
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
          Advanced settings
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

/**
 * Vignette miniature servant d'aperçu au choix « toujours visibles / au survol ».
 *
 * Le mode survol est illustré par une rangée estompée surmontée d'un curseur :
 * une case vide ne dirait pas que les pastilles existent, seulement qu'elles
 * ont disparu.
 */
function VignetteApercu({ revele }: { revele: boolean }) {
  return (
    <span
      style={{
        position: "relative",
        display: "block",
        width: 54,
        height: 44,
        borderRadius: 6,
        background: "linear-gradient(160deg,#DFE4EA,#C3CBD4)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: "auto 0 0 0",
          display: "flex",
          gap: 3,
          justifyContent: "center",
          padding: "8px 0 5px",
          opacity: revele ? 1 : 0.28,
          transform: revele ? "none" : "translateY(3px)",
        }}
      >
        {["#1F3A5F", "#D8C3A5"].map((c) => (
          <span
            key={c}
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: c,
              border: "1px solid rgba(255,255,255,.85)",
            }}
          />
        ))}
      </span>
      {!revele && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: 8,
            bottom: 6,
            width: 0,
            height: 0,
            borderLeft: "7px solid #2B3038",
            borderBottom: "5px solid transparent",
            transform: "rotate(-35deg)",
            filter: "drop-shadow(0 0 1px #fff)",
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
        label="How your colors are shown"
        help="Applies to color options only. Sizes stay text buttons in every case."
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
            label: "Dropdown",
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
                Blue
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
        label="Swatch shape"
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
          { id: "square", label: "Square", preview: <Chip radius="0px" background="#C9CFD6" /> },
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
            label="How the chosen box is shown"
            value={form.controlSelectedStyle}
            accent={accent}
            onChange={(v) => set("controlSelectedStyle", v)}
            options={[
              {
                id: "outline",
                label: "Outline",
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
                ? "Corners of the dropdown."
                : "Angles des boutons."
            }
          />
          {form.displayMode === "dropdown" && (
            <Checkbox
              label="The dropdown fills the available width"
              helpText="Otherwise it stops at 320 px, which suits most product pages."
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
              helpText="44 px minimum is recommended for touch."
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
        label="How the chosen swatch is shown"
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
        label="Selection color"
        value={form.selectedColor}
        onChange={(v) => set("selectedColor", v)}
        help="Shade of the outline, thick border or shadow, depending on the style chosen above."
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
        label="When a color is not defined"
        help="What a shopper sees for a value missing from your swatch library. Each preview shows three different values: Blue, Beige, Terracotta."
        value={form.swatchFallback}
        accent={accent}
        onChange={(v) => set("swatchFallback", v)}
        options={[
          {
            id: "color",
            label: "A color guessed from the name",
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
            label: "The product photo",
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

      {form.swatchFallback === "image" && (
        <RangeSlider
          label={`Taille des pastilles photo — ${form.photoScale} %`}
          min={100}
          max={220}
          step={10}
          value={form.photoScale}
          onChange={(v) => set("photoScale", Number(v))}
          output
          helpText={`A photo shrunk to ${form.size} px is not recognizable, where a flat color is. Only swatches carrying a photo are enlarged — ${Math.round(
            (form.size * form.photoScale) / 100,
          )} px here.`}
        />
      )}
        </>
      )}

      <Divider />

      <Divider />

      <ChoiceCards
        label="When a color is sold out"
        value={form.soldOutStyle}
        accent={accent}
        onChange={(v) => set("soldOutStyle", v)}
        options={[
          {
            id: "strikethrough",
            label: "Struck through",
            preview: <Chip radius={radius} background="#C9CFD6" struck />,
          },
          {
            id: "dim",
            label: "Dimmed",
            preview: <Chip radius={radius} background="#C9CFD6" opacity={0.35} />,
          },
          {
            id: "hide",
            label: "Removed",
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
        <SectionTitle accent={accent} help="What accompanies the selector, in words.">
          Labels shown
        </SectionTitle>
        {/* Le nom SOUS la pastille n'a pas d'équivalent ailleurs : en boutons
            texte le nom EST le bouton, et une liste affiche déjà sa valeur. */}
        {enPastilles && (
          <Checkbox
            label="The color name under each swatch"
            checked={form.showLabels}
            onChange={(v) => set("showLabels", v)}
          />
        )}
        <Checkbox
          label="The &ldquo;Color: Blue&rdquo; line above the selector"
          checked={form.showOptionName}
          onChange={(v) => set("showOptionName", v)}
        />
      </BlockStack>

      {/* Tout ce qui suit fonctionne d'emblée sur la quasi-totalité des thèmes.
          L'exposer laissait croire qu'il fallait s'en occuper — et allongeait
          une page que le marchand traverse pour arrondir ses pastilles. */}
      <Advanced id="avances">
        <Text as="p" variant="bodySm" tone="subdued">
          These are already on and look after themselves. Only touch them if something
          behaves unexpectedly.
        </Text>
        <ColorField
          label="Border color at rest"
          value={form.borderColor}
          onChange={(v) => set("borderColor", v)}
        />
        <Checkbox
          label="Filter the gallery to the chosen color"
          helpText="This is the core of Variantsy. Uncheck to fall back to the native behavior — one image per variant. The grouping itself is entirely automatic."
          checked={form.galleryEnabled}
          onChange={(v) => set("galleryEnabled", v)}
        />
        <Checkbox
          label="Preload the image when a swatch is hovered"
          helpText="The image change then feels instant on click."
          checked={form.preloadOnHover}
          onChange={(v) => set("preloadOnHover", v)}
        />
        <Checkbox
          label="Update the URL (?variant=…) on selection"
          helpText="Lets you share a link that opens straight on the right color."
          checked={form.updateUrl}
          onChange={(v) => set("updateUrl", v)}
        />
        <Checkbox
          label="Hide the theme's own variant selector"
          helpText="Variantsy keeps driving it in the background: the cart always receives the right variant, even if another script listens to it."
          checked={form.hideNativeSelector}
          onChange={(v) => set("hideNativeSelector", v)}
        />
        <Checkbox
          label="Change the main image on selection"
          checked={form.swapImage}
          onChange={(v) => set("swapImage", v)}
        />
        <TextField
          label="Force certain options into swatches"
          helpText="Variantsy recognizes a color option by its values, whatever its name. Fill this in only for a palette made entirely of in-house shades. Separate with commas."
          value={form.colorOptionNames}
          onChange={(v) => set("colorOptionNames", v)}
          autoComplete="off"
        />
        <TextField
          label="CSS selector of the block to hide"
          value={form.nativeSelectorCss}
          onChange={(v) => set("nativeSelectorCss", v)}
          disabled={!form.hideNativeSelector}
          autoComplete="off"
          placeholder="Leave empty for automatic detection"
        />
        <TextField
          label="CSS selector of the gallery"
          value={form.imageSelectorCss}
          onChange={(v) => set("imageSelectorCss", v)}
          disabled={!form.swapImage}
          autoComplete="off"
          placeholder="Leave empty for automatic detection"
        />
      </Advanced>
    </BlockStack>
  );
}


/** Deux produits fictifs : un à deux options, un à une seule. Leur intérêt est
 *  de rendre visible ce que font les blocs conditionnels — invisible sinon. */
const TITLE_EXAMPLES: { nom: string; vars: Record<string, string> }[] = [
  {
    nom: "Product with two options",
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
    nom: "Product with a single option",
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
    tokens: ["{{variant_title}}", "{{option1}}", "{{option2}}", "{{option3}}", "{{option:Color}}"],
  },
  { titre: "Prix", teinte: "#C1614B", tokens: ["{{price}}", "{{compare_at_price}}"] },
  { titre: "References", teinte: "#6D5B8E", tokens: ["{{sku}}", "{{barcode}}"] },
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
        label="Rewrite the product title from the chosen variant"
        helpText="Your product page title then follows the selected color or size."
        checked={form.updateTitle}
        onChange={(v) => set("updateTitle", v)}
      />

      {form.updateTitle && (
        <>
          <BlockStack gap="300">
            <SectionTitle accent={accent} help="Compose it with the variables below.">
              Your template
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
              help="Your products do not all carry the same options. A template that mentions size leaves a stray word on a product that has none."
            >
              One template for your whole catalog
            </SectionTitle>

            <Box background="bg-surface-secondary" padding="400" borderRadius="300">
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="p" variant="bodyXs" tone="subdued">
                    The template
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <code>{"{{product_title}} — {{option1}} — Size {{option2}}"}</code>
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
                        "{{product_title}} — {{option1}} — Size {{option2}}",
                        TITLE_EXAMPLES[0].vars,
                      )}
                    </Text>
                  </BlockStack>

                  <BlockStack gap="150">
                    <InlineStack gap="150" blockAlign="center">
                      <Badge tone="critical">T-shirt</Badge>
                      <Text as="span" variant="bodyXs" tone="subdued">
                        has none
                      </Text>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {renderTemplate(
                        "{{product_title}} — {{option1}} — Size {{option2}}",
                        TITLE_EXAMPLES[1].vars,
                      )}
                    </Text>
                    <Text as="p" variant="bodyXs" tone="critical">
                      The word &ldquo;Size&rdquo; stays, with nothing after it.
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
              You only need this if your template has <strong>text</strong> around a variable. A dash
              or a slash left on its own is cleaned up automatically.
            </Text>
          </BlockStack>

          <Banner tone="info">
            <p>
              If the color is already in your product names — &ldquo;Blue tee&rdquo; — a template that adds
              it will repeat itself. Prefer a name without the color in that case.
            </p>
          </Banner>

          <Advanced id="titre">
            <Checkbox
              label="Also update the browser tab title"
              helpText="The variant name is already placed there, so turning this on can make it appear twice."
              checked={form.updateDocumentTitle}
              onChange={(v) => set("updateDocumentTitle", v)}
            />
            <TextField
              label="CSS selector of the title"
              value={form.titleSelectorCss}
              onChange={(v) => set("titleSelectorCss", v)}
              autoComplete="off"
              placeholder="Leave empty for automatic detection"
              helpText="Only needed if your theme uses unusual markup."
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
