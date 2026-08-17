import type { ShopSettings, SwatchValue } from "@prisma/client";
import prisma, { withRetry } from "./db.server";
import { normalize } from "./shared";

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
  borderColor: "#D9D9D9",
  selectedStyle: "ring",
  selectedColor: "#111111",
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

export async function updateSettings(
  shop: string,
  data: Partial<SettingsInput>,
): Promise<ShopSettings> {
  return withRetry(() =>
    prisma.shopSettings.upsert({
      where: { shop },
      create: { shop, ...DEFAULT_SETTINGS, ...data },
      update: data,
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
  colorOptions: string[];
  /** clé = `${optionName}::${value}` normalisés */
  swatches: Record<string, { kind: string; c1?: string; c2?: string; img?: string }>;
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
  return {
    v: 1,
    enabled: settings.enabled,
    style: {
      shape: settings.shape,
      size: settings.size,
      gap: settings.gap,
      borderWidth: settings.borderWidth,
      borderColor: settings.borderColor,
      selectedStyle: settings.selectedStyle,
      selectedColor: settings.selectedColor,
      showLabels: settings.showLabels,
      showOptionName: settings.showOptionName,
      maxVisible: settings.maxVisible,
      customCss: settings.customCss,
    },
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
  };
}
