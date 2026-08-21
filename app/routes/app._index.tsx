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
import type { ProduitChoisi } from "../components/LiensProduitsPanel";
import { SchemaAvantApres, SchemaGroupe } from "../components/schemas";

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
  const jsonOuNull = (key: string) => {
    const brut = form.get(key);
    if (typeof brut !== "string" || !brut || brut === "null") return null;
    try {
      const v: unknown = JSON.parse(brut);
      return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

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
    linkedOverride: bool("linkedOverride"),
    // Surcharges des produits liés. On refuse silencieusement un JSON illisible
    // plutôt que de faire échouer tout l'enregistrement : le reste des réglages
    // du marchand n'a pas à en pâtir.
    linkedStyle: jsonOuNull("linkedStyle"),
    linkedTitle: jsonOuNull("linkedTitle"),
  });

  return { ok: true };
};

/*
 * Ordre délibéré : les produits liés d'abord.
 *
 * C'est la décision de structure — un coloris par fiche, ou tous les coloris en
 * variantes — et elle conditionne tout le reste. L'apparence et le titre
 * s'ajustent ensuite. L'installation ferme la marche : elle se consulte une
 * fois, au premier jour.
 */
/** Les onglets dépendent de la fonctionnalité choisie : chacune a son
 *  apparence et son titre, et le mode « produits liés » ajoute la gestion des
 *  groupes. On désigne l'onglet actif par son identifiant, jamais par son
 *  indice — les deux listes n'ont pas la même longueur. */
const ONGLETS = {
  variants: [
    { id: "apparence", content: "Appearance", panelID: "panel-apparence" },
    { id: "titre", content: "Title", panelID: "panel-titre" },
    { id: "installation", content: "Installation", panelID: "panel-installation" },
  ],
  linked: [
    { id: "groupes", content: "Groups", panelID: "panel-groupes" },
    { id: "apparence", content: "Appearance", panelID: "panel-apparence" },
    { id: "titre", content: "Title", panelID: "panel-titre" },
    { id: "installation", content: "Installation", panelID: "panel-installation" },
  ],
} as const;

type Mode = keyof typeof ONGLETS;

/** Réglages qui peuvent avoir une valeur propre aux produits liés.
 *  Mêmes clés que les blocs `style` et titre envoyés au storefront : les
 *  laisser dériver ferait éditer un réglage qui n'atteindrait jamais la
 *  boutique. */
const CLES_STYLE = [
  "shape", "size", "gap", "borderWidth", "borderColor", "selectedStyle",
  "selectedColor", "selectedWidth", "selectedGap", "cornerRadius", "displayMode",
  "controlRadius", "controlSelectedStyle", "dropdownFullWidth", "swatchFallback",
  "photoScale", "neutralColor", "showLabels", "showOptionName", "maxVisible",
  "customCss",
] as const;

const CLES_TITRE = [
  "updateTitle", "titleTemplate", "titleSelectorCss", "updateDocumentTitle",
] as const;

/** Les deux fonctionnalités de l'app, posées dès l'arrivée.
 *
 *  Elles coexistent — un catalogue peut mêler les deux modèles — donc ce
 *  sélecteur navigue, il ne verrouille rien : on passe de l'un à l'autre sans
 *  rien perdre. C'est la différence avec l'ancien écran « Setup », qui posait
 *  la même question pour ne montrer que des instructions, et renvoyait vers un
 *  onglet au lieu d'y mener. */
function SelecteurMode({
  mode,
  onChange,
  nbGroupes,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  nbGroupes: number;
}) {
  // La carte écartée s'efface, pour que l'œil se pose d'abord sur celle qui
  // est active. Elle se rallume au survol : atténuée en permanence, elle
  // passerait pour désactivée et personne n'essaierait de cliquer.
  const [survolee, setSurvolee] = useState<Mode | null>(null);
  const choix = [
    {
      id: "variants" as const,
      titre: "Product variants",
      sous: "One product page, options handled by Shopify variants",
      apercu: <SchemaAvantApres />,
      note: "Color, size, material… Filter the gallery, hide the theme's selector, rewrite the title.",
    },
    {
      id: "linked" as const,
      titre: "Linked products",
      sous: "One product page per color, linked together",
      apercu: <SchemaGroupe />,
      note:
        nbGroupes > 0
          ? `${nbGroupes} group${nbGroupes > 1 ? "s" : ""} set up.`
          : "What Shopify reserves to Plus plans. Here, on any plan.",
    },
  ];

  return (
    <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
      {choix.map((c) => {
        const actif = mode === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            onMouseEnter={() => setSurvolee(c.id)}
            onMouseLeave={() => setSurvolee(null)}
            onFocus={() => setSurvolee(c.id)}
            onBlur={() => setSurvolee(null)}
            aria-pressed={actif}
            style={{
              opacity: actif || survolee === c.id ? 1 : 0.55,
              transition: "opacity 150ms ease",
              // PIÈGE N°5 : un bouton étiré par la grille centre son contenu.
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              justifyContent: "flex-start",
              gap: 12,
              width: "100%",
              textAlign: "left",
              padding: 16,
              borderRadius: 14,
              cursor: "pointer",
              background: actif
                ? "var(--p-color-bg-surface-selected)"
                : "var(--p-color-bg-surface)",
              border: actif
                ? "2px solid var(--p-color-border-emphasis)"
                : "1px solid var(--p-color-border-secondary)",
              WebkitAppearance: "none",
              appearance: "none",
              outline: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span>
              <span style={{ display: "block", fontSize: 15, fontWeight: 650 }}>{c.titre}</span>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  marginTop: 2,
                  color: "var(--p-color-text-secondary)",
                }}
              >
                {c.sous}
              </span>
            </span>
            {c.apercu}
            <span
              style={{
                fontSize: 12,
                marginTop: "auto",
                color: "var(--p-color-text-secondary)",
              }}
            >
              {c.note}
            </span>
          </button>
        );
      })}
    </InlineGrid>
  );
}

export default function SettingsPage() {
  const { settings, themeName, deepLink, groups } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const [form, setForm] = useState(settings);
  const [dirty, setDirty] = useState(false);
  // Une boutique qui a déjà des groupes travaille sur les produits liés :
  // l'y déposer évite un clic à chaque visite. Calculé, donc stable au
  // rendu serveur — un localStorage désynchroniserait l'hydratation.
  const [mode, setMode] = useState<Mode>(groups.length > 0 ? "linked" : "variants");
  const [tab, setTab] = useState(0);
  const onglets = ONGLETS[mode];
  const actif = onglets[Math.min(tab, onglets.length - 1)].id;
  const changerMode = (m: Mode) => {
    setMode(m);
    setTab(0);
  };

  // Les produits liés n'ont leur propre habillage que si le marchand l'a
  // demandé. Tant qu'il ne l'a pas fait, les volets éditent les réglages
  // communs — donc rien ne change pour les boutiques existantes.
  const f = form as Record<string, unknown>;
  const detache = mode === "linked" && f.linkedOverride === true;

  const surcharge = {
    ...((f.linkedStyle as Record<string, unknown>) ?? {}),
    ...((f.linkedTitle as Record<string, unknown>) ?? {}),
  };
  // La surcharge est partielle : ce qu'elle ne dit pas est hérité, ce qui
  // évite de repartir des valeurs d'usine quand on détache.
  const vue = detache ? ({ ...form, ...surcharge } as typeof form) : form;

  /** Recopie les valeurs communes courantes dans une surcharge. */
  const graine = (cles: readonly string[], source: Record<string, unknown>) =>
    Object.fromEntries(cles.map((c) => [c, source[c]]));

  const ecrire = (cle: string, valeur: unknown) => {
    const cible = (CLES_STYLE as readonly string[]).includes(cle)
      ? "linkedStyle"
      : (CLES_TITRE as readonly string[]).includes(cle)
        ? "linkedTitle"
        : null;

    // Hors du mode « produits liés », ou pour un réglage qui ne se dédouble pas
    // — comportement, galerie, noms d'options — on écrit les réglages communs.
    if (mode !== "linked" || !cible) return set(cle as never, valeur as never);

    setForm((p) => {
      const q = p as Record<string, unknown>;
      // Premier changement fait depuis l'onglet des produits liés alors que
      // l'interrupteur est encore éteint : on détache TOUT SEUL.
      //
      // Sans ça, le marchand réglait l'apparence des fiches liées et voyait
      // celle des variantes bouger avec — il fallait avoir repéré un
      // interrupteur pour que l'écran fasse ce qu'il annonce. Éditer depuis cet
      // onglet EST la demande de détachement.
      if (q.linkedOverride === true) {
        return {
          ...p,
          [cible]: { ...((q[cible] as object) ?? {}), [cle]: valeur },
        } as typeof p;
      }
      // On recopie l'intégralité des deux jeux, pas seulement la clé touchée :
      // une surcharge partielle continuerait de suivre les réglages communs
      // pour tout le reste, ce qui surprend une fois qu'on se croit détaché.
      return {
        ...p,
        linkedOverride: true,
        linkedStyle: { ...graine(CLES_STYLE, q), ...((q.linkedStyle as object) ?? {}) },
        linkedTitle: { ...graine(CLES_TITRE, q), ...((q.linkedTitle as object) ?? {}) },
        [cible]: {
          ...graine(cible === "linkedStyle" ? CLES_STYLE : CLES_TITRE, q),
          ...((q[cible] as object) ?? {}),
          [cle]: valeur,
        },
      } as typeof p;
    });
    setDirty(true);
  };

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
      // Les surcharges sont des objets : String() en aurait fait
      // « [object Object] », et le réglage se serait perdu en silence.
      if (key === "linkedStyle" || key === "linkedTitle") {
        data.append(key, JSON.stringify(value));
        return;
      }
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
        content: "Save",
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
                      ? "Your swatches and per-color galleries are live."
                      : "Nothing shows on your storefront while the app is turned off."}
                  </Text>
                </BlockStack>
                {/* L'état et son interrupteur voyagent ensemble : le badge
                    nomme ce que la capsule montre, les séparer obligeait à
                    traverser la carte pour relier les deux. */}
                <InlineStack gap="300" blockAlign="center" wrap={false}>
                  <Badge tone={form.enabled ? "success" : undefined}>
                    {form.enabled ? "On" : "Off"}
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
                  Shoppers see every photo of the product, whatever color they pick. This is the
                  core of Variantsy — swatches and titles keep working without it,
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
                secondaryAction={{ content: "Discard", onAction: discard }}
              >
                <p>
                  Your changes appear in the preview, but not yet on your storefront.
                </p>
              </Banner>
            )}

            {/* La barre d'onglets garde sa carte ; le CONTENU en sort.
                Tant qu'il restait dedans, chaque bloc de réglages était une
                carte imbriquée dans une autre — Polaris les aplatit, et la mise
                en groupes ne se voyait pas. Posés sur le fond de la page, les
                blocs redeviennent des cartes à part entière. */}
            <SelecteurMode mode={mode} onChange={changerMode} nbGroupes={groups.length} />

            <Card padding="0">
              <Tabs
                tabs={onglets as unknown as { id: string; content: string }[]}
                selected={Math.min(tab, onglets.length - 1)}
                onSelect={setTab}
                fitted
              />
            </Card>

            {/* L'aperçu occupait un tiers de la page en colonne de droite et
                écrasait les volets. En pleine largeur il ne dispute la place à
                personne, et posé AVANT les réglages il est là dès l'arrivée :
                sous eux, il fallait traverser toute la page pour voir l'effet
                de ce qu'on venait de changer. Il n'a rien à montrer pendant
                qu'on lit une notice ou qu'on compose un groupe. */}
            {(actif === "apparence" || actif === "titre") && (
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Preview</Text>
                    <Text as="span" tone="subdued" variant="bodySm">Clickable</Text>
                  </InlineStack>
                  <SwatchPreview settings={vue} />
                  <Text as="p" tone="subdued" variant="bodySm">
                    Indicative preview: type and spacing will follow your theme once live.
                  </Text>
                </BlockStack>
              </Card>
            )}

            {mode === "linked" && (actif === "apparence" || actif === "titre") && (
              <Card>
                <InlineStack align="space-between" blockAlign="center" gap="400">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingSm">Independent settings</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {detache
                        ? "Linked products have their own look. Product variants are untouched."
                        : "Linked products follow the Product variants settings. Changing anything on this tab gives them their own."}
                    </Text>
                  </BlockStack>
                  <Interrupteur
                    actif={detache}
                    onChange={(v) => {
                      // En détachant, on part des valeurs COURANTES et non de
                      // celles d'usine : le marchand ne voit pas son storefront
                      // sauter au moment où il bascule l'interrupteur.
                      setForm((p) => {
                        const q = p as Record<string, unknown>;
                        if (!v) return { ...p, linkedOverride: false } as typeof p;
                        const style = Object.fromEntries(
                          CLES_STYLE.map((c) => [c, q[c]]),
                        );
                        const titre = Object.fromEntries(
                          CLES_TITRE.map((c) => [c, q[c]]),
                        );
                        return {
                          ...p,
                          linkedOverride: true,
                          linkedStyle: { ...style, ...((q.linkedStyle as object) ?? {}) },
                          linkedTitle: { ...titre, ...((q.linkedTitle as object) ?? {}) },
                        } as typeof p;
                      });
                      setDirty(true);
                    }}
                  />
                </InlineStack>
              </Card>
            )}

            <BlockStack gap="400">
                  {actif === "installation" && (
                    <InstallationPanel themeName={themeName} deepLink={deepLink} mode={mode} />
                  )}
                  {actif === "apparence" && <ApparencePanel form={vue} set={ecrire as never} />}
                  {actif === "titre" && <TitrePanel form={vue} set={ecrire as never} />}
                  {actif === "groupes" && <LiensProduitsPanel
                      groups={groups}
                      onPickProducts={async (dejaChoisis) => {
                        const selection = await shopify.resourcePicker({
                          type: "product",
                          multiple: true,
                          // Les fiches déjà dans le groupe reviennent cochées :
                          // sans ça, rouvrir le sélecteur pour ajouter une
                          // couleur effacerait toutes les autres.
                          selectionIds: dejaChoisis.map((id) => ({ id })),
                        });
                        return (selection as ProduitChoisi[] | undefined) ?? null;
                      }}
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
            </BlockStack>

          </BlockStack>
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
  label?: string;
  help?: string;
  value: string;
  accent: string;
  options: { id: string; label: string; preview: React.ReactNode }[];
  onChange: (value: string) => void;
}) {
  return (
    <BlockStack gap="300">
      {label ? (
        <SectionTitle help={help} accent={accent}>
          {label}
        </SectionTitle>
      ) : help ? (
        <Text as="p" tone="subdued" variant="bodySm">
          {help}
        </Text>
      ) : null}
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

/**
 * Bloc de réglages.
 *
 * L'onglet Apparence était une liste plate de douze réglages séparés par des
 * traits : rien ne disait lesquels allaient ensemble, et il fallait tout lire
 * pour trouver le bon. Chaque groupe porte désormais un titre, la raison pour
 * laquelle il existe, et une illustration de ce qu'il change.
 */
function Bloc({
  titre,
  raison,
  illustration,
  children,
}: {
  titre: string;
  raison: string;
  illustration?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <BlockStack gap="500">
        <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
          <BlockStack gap="050">
            <Text as="h3" variant="headingMd">
              {titre}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {raison}
            </Text>
          </BlockStack>
          {illustration}
        </InlineStack>
        <Divider />
        <BlockStack gap="500">{children}</BlockStack>
      </BlockStack>
    </Card>
  );
}

/** Aperçu miniature d'une rangée de pastilles, pour illustrer un bloc. */
function ApercuRangee({ radius, accent }: { radius: string; accent: string }) {
  return (
    <span style={{ display: "flex", gap: 6, alignItems: "center", flex: "0 0 auto" }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: radius,
          background: "#2C5AA0",
          boxShadow: `0 0 0 2px var(--p-color-bg-surface), 0 0 0 4px ${accent}`,
        }}
      />
      <span style={{ width: 22, height: 22, borderRadius: radius, background: "#D8C3A5" }} />
      <span style={{ width: 22, height: 22, borderRadius: radius, background: "#C0715A" }} />
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
      <Bloc titre="How your colors are shown" raison="Swatches, text buttons or a dropdown — pick what fits your theme. Color options only: sizes stay text buttons in every case.">
        <ChoiceCards
          value={form.displayMode}
          accent={accent}
          onChange={(v) => set("displayMode", v)}
          options={[
            {
              id: "swatch",
              label: "Swatches",
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
              label: "Text buttons",
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

      </Bloc>


      <Bloc titre="The selector itself" raison="Shape, size and the control your theme shows." illustration={<ApercuRangee radius={radius} accent={accent} />}>
        {enPastilles && (
          <>
        <ChoiceCards
          label="Swatch shape"
          value={form.shape}
          accent={accent}
          onChange={(v) => set("shape", v)}
          options={[
            { id: "circle", label: "Circle", preview: <Chip radius="50%" background="#C9CFD6" /> },
            {
              id: "rounded",
              label: "Rounded",
              preview: <Chip radius={`${form.cornerRadius}px`} background="#C9CFD6" />,
            },
            { id: "square", label: "Square", preview: <Chip radius="0px" background="#C9CFD6" /> },
          ]}
        />

        {form.shape === "rounded" && (
          <RangeSlider
            label={`Corner radius — ${form.cornerRadius} px`}
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
              label={`Corner radius — ${form.controlRadius} px`}
              min={0}
              max={20}
              value={form.controlRadius}
              onChange={(v) => set("controlRadius", Number(v))}
              output
              helpText={
                form.displayMode === "dropdown"
                  ? "Corners of the dropdown."
                  : "Corners of the buttons."
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
                label={`Size — ${form.size} px`}
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
              label={`Spacing — ${form.gap} px`}
              min={0}
              max={40}
              value={form.gap}
              onChange={(v) => set("gap", Number(v))}
              output
            />
          </InlineGrid>
        )}

      </Bloc>

      <Bloc titre="The chosen one" raison="How the selected color stands out from the others." illustration={<ApercuRangee radius={radius} accent={accent} />}>
        {enPastilles && (
          <>

        <ChoiceCards
          value={form.selectedStyle}
          accent={accent}
          onChange={(v) => set("selectedStyle", v)}
          options={[
            {
              id: "ring",
              label: "Ring",
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
              label: "Border",
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
              label: "Shadow",
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
              label={`Outline thickness — ${form.selectedWidth} px`}
              min={1}
              max={8}
              value={form.selectedWidth}
              onChange={(v) => set("selectedWidth", Number(v))}
              output
            />
            {form.selectedStyle === "ring" ? (
              <RangeSlider
                label={`Gap from the swatch — ${form.selectedGap} px`}
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
          label={`Border thickness — ${form.borderWidth} px`}
          min={0}
          max={6}
          value={form.borderWidth}
          onChange={(v) => set("borderWidth", Number(v))}
          output
        />

      </Bloc>

      <Bloc titre="When a color has no shade" raison="What a value missing from your library falls back to.">
        {enPastilles && (
          <>

        <ChoiceCards
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
            label={`Photo swatch size — ${form.photoScale} %`}
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

      </Bloc>

      <Bloc titre="Words and sold-out colors" raison="What the shopper reads around the selector, and what an unavailable color looks like.">


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
            Shoppers will never know this color exists, so they cannot ask to be notified when it
            is back in stock.
          </Text>
        )}


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

      </Bloc>

      <Bloc titre="Behavior" raison="Everything here already works on almost every theme. Only touch it if something behaves unexpectedly.">
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
      </Bloc>

    </BlockStack>
  );
}


/** Deux produits fictifs : un à deux options, un à une seule. Leur intérêt est
 *  de rendre visible ce que font les blocs conditionnels — invisible sinon. */
const TITLE_EXAMPLES: { nom: string; vars: Record<string, string> }[] = [
  {
    nom: "Product with two options",
    vars: {
      product_title: "Organic cotton sweatshirt",
      variant_title: "Navy / M",
      option1: "Navy",
      option2: "M",
      option3: "",
      "option:color": "Navy",
      "option:size": "M",
      price: "$59.00",
      compare_at_price: "$79.00",
      sku: "SWT-001-NV-M",
      barcode: "3760000000017",
      vendor: "Northfield",
      product_type: "Sweatshirt",
    },
  },
  {
    nom: "Product with a single option",
    vars: {
      product_title: "Linen tee",
      variant_title: "Ecru",
      option1: "Ecru",
      option2: "",
      option3: "",
      "option:color": "Ecru",
      "option:size": "",
      price: "$39.00",
      compare_at_price: "",
      sku: "TEE-EC",
      barcode: "",
      vendor: "Northfield",
      product_type: "Tee",
    },
  },
];

const TITLE_FIELD_ID = "variantsy-title-template";

/** Groupes de variables, pour ne pas jeter douze boutons d'un coup. */
const VARIABLE_GROUPS: { titre: string; teinte: string; tokens: string[] }[] = [
  { titre: "Product", teinte: "#1F3A5F", tokens: ["{{product_title}}", "{{vendor}}", "{{product_type}}"] },
  {
    titre: "Variant",
    teinte: "#2E7D32",
    tokens: ["{{variant_title}}", "{{option1}}", "{{option2}}", "{{option3}}", "{{option:Color}}"],
  },
  { titre: "Price", teinte: "#C1614B", tokens: ["{{price}}", "{{compare_at_price}}"] },
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
            <SectionTitle accent={accent}>What your shoppers will see</SectionTitle>
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
                      <Badge tone="success">Sweatshirt</Badge>
                      <Text as="span" variant="bodyXs" tone="subdued">
                        has a size
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
                      <Badge tone="critical">Tee</Badge>
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
                    The fix: wrap the optional part in brackets
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <code>
                      {"{{product_title}} — {{option1}}[[ — Size {{option2}}]]"}
                    </code>
                  </Text>
                </BlockStack>

                <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                  <BlockStack gap="150">
                    <InlineStack gap="150" blockAlign="center">
                      <Badge tone="success">Sweatshirt</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {renderTemplate(
                        "{{product_title}} — {{option1}}[[ — Size {{option2}}]]",
                        TITLE_EXAMPLES[0].vars,
                      )}
                    </Text>
                  </BlockStack>

                  <BlockStack gap="150">
                    <InlineStack gap="150" blockAlign="center">
                      <Badge tone="success">Tee</Badge>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {renderTemplate(
                        "{{product_title}} — {{option1}}[[ — Size {{option2}}]]",
                        TITLE_EXAMPLES[1].vars,
                      )}
                    </Text>
                    <Text as="p" variant="bodyXs" tone="success">
                      Everything inside the brackets is gone.
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
