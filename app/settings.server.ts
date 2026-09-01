import { Prisma } from "@prisma/client";
import type { ShopSettings, SwatchValue } from "@prisma/client";
import prisma, { withRetry } from "./db.server";
import { normalize } from "./shared";
import { COLOR_DICTIONARY } from "./colors";

export { normalize };

/**
 * Valeurs par défaut. Elles sont dupliquées ici (et pas seulement dans le
 * schéma Prisma) pour une raison précise : si la base est injoignable
 * (cold-start Neon), l'endpoint storefront doit quand même répondre quelque
 * chose de valide. Un marchand préfère des swatches au style par défaut
 * qu'un produit sans swatches du tout.
 */
export type SettingsInput = {
  enabled: boolean;
  shape: string;
  size: number;
  gap: number;
  borderWidth: number;
  borderColor: string;
  selectedStyle: string;
  selectedColor: string;
  selectedWidth: number;
  selectedGap: number;
  cornerRadius: number;
  displayMode: string;
  controlRadius: number;
  controlSelectedStyle: string;
  dropdownFullWidth: boolean;
  swatchFallback: string;
  photoScale: number;
  neutralColor: string;
  showLabels: boolean;
  showOptionName: boolean;
  maxVisible: number;
  soldOutStyle: string;
  hideNativeSelector: boolean;
  nativeSelectorCss: string;
  updateUrl: boolean;
  preloadOnHover: boolean;
  swapImage: boolean;
  imageSelectorCss: string;
  galleryEnabled: boolean;
  groupBy: string;
  commonMediaMode: string;
  altFallback: boolean;
  altPrefix: string;
  thumbSelectorCss: string;
  skipSingleGroup: boolean;
  updateTitle: boolean;
  titleTemplate: string;
  titleSelectorCss: string;
  updateDocumentTitle: boolean;
  colorOptionNames: string;
  customCss: string;
};

export const DEFAULT_SETTINGS: SettingsInput = {
  enabled: true,
  shape: "circle",
  size: 40,
  gap: 10,
  borderWidth: 1,
  borderColor: "auto",
  selectedStyle: "ring",
  selectedColor: "auto",
  selectedWidth: 2,
  selectedGap: 2,
  cornerRadius: 8,
  displayMode: "swatch",
  controlRadius: 6,
  controlSelectedStyle: "outline",
  dropdownFullWidth: false,
  swatchFallback: "image",
  photoScale: 100,
  neutralColor: "#ECECEC",
  showLabels: false,
  showOptionName: true,
  maxVisible: 0,
  soldOutStyle: "strikethrough",
  hideNativeSelector: true,
  nativeSelectorCss: "",
  updateUrl: true,
  preloadOnHover: true,
  swapImage: true,
  imageSelectorCss: "",
  galleryEnabled: true,
  groupBy: "auto",
  commonMediaMode: "append",
  altFallback: true,
  altPrefix: "",
  thumbSelectorCss: "",
  skipSingleGroup: true,
  updateTitle: true,
  titleTemplate: "{{product_title}} — {{variant_title}}",
  titleSelectorCss: "",
  updateDocumentTitle: false,
  colorOptionNames: "Color,Colour,Couleur,Farbe,Kleur,Colore,Color/Couleur",
  customCss: "",
};

export async function getSettings(shop: string): Promise<ShopSettings> {
  return withRetry(async () => {
    const existing = await prisma.shopSettings.findUnique({ where: { shop } });
    if (existing) return existing;
    // upsert plutôt que create : deux requêtes concurrentes au premier
    // chargement (loader + preview) provoqueraient sinon une violation d'unicité.
    return prisma.shopSettings.upsert({
      where: { shop },
      create: { shop, ...DEFAULT_SETTINGS },
      update: {},
    });
  });
}

/** Les surcharges « produits liés » ne font pas partie de SettingsInput :
 *  celui-ci décrit le repli servi quand la base est injoignable, et une
 *  surcharge absente s'y traduit simplement par un héritage. */
export type SurchargesLiees = {
  linkedOverride?: boolean;
  linkedStyle?: Record<string, unknown> | null;
  linkedTitle?: Record<string, unknown> | null;
};

export async function updateSettings(
  shop: string,
  data: Partial<SettingsInput> & SurchargesLiees,
): Promise<ShopSettings> {
  // Prisma refuse un `null` nu sur une colonne JSON nullable : il attend
  // `Prisma.DbNull`. La traduction se fait ici, une fois, pour que les
  // appelants continuent d'écrire `null` comme partout ailleurs.
  const prepare = <T extends SurchargesLiees>(o: T) => ({
    ...o,
    ...(o.linkedStyle === null ? { linkedStyle: Prisma.DbNull } : {}),
    ...(o.linkedTitle === null ? { linkedTitle: Prisma.DbNull } : {}),
  });
  const propre = prepare(data);
  return withRetry(() =>
    prisma.shopSettings.upsert({
      where: { shop },
      create: { shop, ...DEFAULT_SETTINGS, ...propre },
      update: propre,
    }),
  );
}

export async function listSwatchValues(shop: string): Promise<SwatchValue[]> {
  return withRetry(() =>
    prisma.swatchValue.findMany({
      where: { shop },
      orderBy: [{ optionName: "asc" }, { label: "asc" }],
    }),
  );
}

export async function upsertSwatchValue(
  shop: string,
  input: {
    optionName: string;
    label: string;
    kind: string;
    colorHex?: string | null;
    colorHex2?: string | null;
    imageUrl?: string | null;
  },
): Promise<SwatchValue> {
  const optionName = normalize(input.optionName);
  const value = normalize(input.label);
  const data = {
    label: input.label.trim(),
    kind: input.kind,
    colorHex: input.colorHex || null,
    colorHex2: input.colorHex2 || null,
    imageUrl: input.imageUrl || null,
  };
  return withRetry(() =>
    prisma.swatchValue.upsert({
      where: { shop_optionName_value: { shop, optionName, value } },
      create: { shop, optionName, value, ...data },
      update: data,
    }),
  );
}

export async function deleteSwatchValue(shop: string, id: string): Promise<void> {
  await withRetry(() => prisma.swatchValue.deleteMany({ where: { id, shop } }));
}

/**
 * Payload consommé par l'extension de thème.
 * Volontairement plat et compact : il transite sur chaque page produit, il est
 * mis en cache 60 s par le CDN Shopify/Vercel, et son poids compte.
 */
export type StorefrontConfig = {
  v: number;
  enabled: boolean;
  style: {
    shape: string;
    size: number;
    gap: number;
    borderWidth: number;
    borderColor: string;
    selectedStyle: string;
    selectedColor: string;
    selectedWidth: number;
    selectedGap: number;
    cornerRadius: number;
    displayMode: string;
    controlRadius: number;
    controlSelectedStyle: string;
    dropdownFullWidth: boolean;
    swatchFallback: string;
    photoScale: number;
    neutralColor: string;
    showLabels: boolean;
    showOptionName: boolean;
    maxVisible: number;
    customCss: string;
  };
  behavior: {
    soldOutStyle: string;
    hideNativeSelector: boolean;
    nativeSelectorCss: string;
    updateUrl: boolean;
    preloadOnHover: boolean;
    swapImage: boolean;
    imageSelectorCss: string;
    updateTitle: boolean;
    titleTemplate: string;
    titleSelectorCss: string;
    updateDocumentTitle: boolean;
  };
  gallery: {
    enabled: boolean;
    groupBy: string;
    commonMediaMode: string;
    altFallback: boolean;
    altPrefix: string;
    thumbSelectorCss: string;
    skipSingleGroup: boolean;
  };
  /**
   * Apparence propre aux pastilles de produits liés. ABSENT quand le marchand
   * n'a rien détaché : le storefront retombe alors sur `style`, ce qui garde
   * le comportement d'avant cette fonctionnalité sans aucune condition à
   * écrire côté client.
   */
  styleLinked?: StorefrontConfig["style"];
  /** Idem pour le titre dynamique sur une fiche liée. */
  titleLinked?: {
    updateTitle: boolean;
    titleTemplate: string;
    titleSelectorCss: string;
    updateDocumentTitle: boolean;
  };
  colorOptions: string[];
  /** clé = `${optionName}::${value}` normalisés */
  swatches: Record<string, { kind: string; c1?: string; c2?: string; img?: string }>;
  /**
   * Dictionnaire nom → hex, envoyé UNIQUEMENT en mode `swatchFallback: "color"`.
   * Il permet au storefront de deviner « Navy » ou « Bleu marine » sans que le
   * marchand ait rien saisi. On ne l'envoie pas dans les autres modes : ce
   * payload voyage sur chaque page produit, et il ne servirait à rien.
   */
  colors?: Record<string, string>;
};

export function toStorefrontConfig(
  settings: ShopSettings | SettingsInput,
  values: SwatchValue[],
): StorefrontConfig {
  const swatches: StorefrontConfig["swatches"] = {};
  for (const v of values) {
    swatches[`${v.optionName}::${v.value}`] = {
      kind: v.kind,
      ...(v.colorHex ? { c1: v.colorHex } : {}),
      ...(v.colorHex2 ? { c2: v.colorHex2 } : {}),
      ...(v.imageUrl ? { img: v.imageUrl } : {}),
    };
  }
  // Les colonnes de surcharge n'existent que sur la ligne Prisma, pas sur
  // SettingsInput — d'où l'accès prudent.
  const brut = settings as Partial<ShopSettings>;
  const detache = brut.linkedOverride === true;

  const style: StorefrontConfig["style"] = {
    shape: settings.shape,
    size: settings.size,
    gap: settings.gap,
    borderWidth: settings.borderWidth,
    borderColor: settings.borderColor,
    selectedStyle: settings.selectedStyle,
    selectedColor: settings.selectedColor,
    selectedWidth: settings.selectedWidth,
    selectedGap: settings.selectedGap,
    cornerRadius: settings.cornerRadius,
    displayMode: settings.displayMode,
    controlRadius: settings.controlRadius,
    controlSelectedStyle: settings.controlSelectedStyle,
    dropdownFullWidth: settings.dropdownFullWidth,
    swatchFallback: settings.swatchFallback,
    photoScale: settings.photoScale,
    neutralColor: settings.neutralColor,
    showLabels: settings.showLabels,
    showOptionName: settings.showOptionName,
    maxVisible: settings.maxVisible,
    customCss: settings.customCss,
  };

  const titre = {
    updateTitle: settings.updateTitle,
    titleTemplate: settings.titleTemplate,
    titleSelectorCss: settings.titleSelectorCss,
    updateDocumentTitle: settings.updateDocumentTitle,
  };

  return {
    v: 1,
    enabled: settings.enabled,
    style,
    // Fusion plutôt que remplacement : une surcharge partielle — le marchand
    // n'a changé que la forme — hérite du reste au lieu de repartir des
    // valeurs d'usine.
    ...(detache
      ? {
          styleLinked: { ...style, ...((brut.linkedStyle as object) ?? {}) },
          titleLinked: { ...titre, ...((brut.linkedTitle as object) ?? {}) },
        }
      : {}),
    behavior: {
      soldOutStyle: settings.soldOutStyle,
      hideNativeSelector: settings.hideNativeSelector,
      nativeSelectorCss: settings.nativeSelectorCss,
      updateUrl: settings.updateUrl,
      preloadOnHover: settings.preloadOnHover,
      swapImage: settings.swapImage,
      imageSelectorCss: settings.imageSelectorCss,
      updateTitle: settings.updateTitle,
      titleTemplate: settings.titleTemplate,
      titleSelectorCss: settings.titleSelectorCss,
      updateDocumentTitle: settings.updateDocumentTitle,
    },
    gallery: {
      enabled: settings.galleryEnabled,
      groupBy: settings.groupBy,
      commonMediaMode: settings.commonMediaMode,
      altFallback: settings.altFallback,
      altPrefix: settings.altPrefix,
      thumbSelectorCss: settings.thumbSelectorCss,
      skipSingleGroup: settings.skipSingleGroup,
    },
    colorOptions: settings.colorOptionNames
      .split(",")
      .map((s) => normalize(s))
      .filter(Boolean),
    swatches,
    ...(settings.swatchFallback === "color" ? { colors: COLOR_DICTIONARY } : {}),
  };
}
