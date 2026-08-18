import {
  BlockStack,
  Divider,
  Checkbox,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import type { SerializeFrom } from "@remix-run/node";
import type { loader } from "../routes/app._index";

type Settings = SerializeFrom<typeof loader>["settings"];

/**
 * Volet Galerie : plusieurs images par coloris.
 *
 * C'est la fonctionnalité n°1 de l'app, et elle vivait sur une page séparée que
 * le marchand ne trouvait qu'en cherchant. Elle rejoint les onglets.
 */
export function GaleriePanel({
  form,
  set,
}: {
  form: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}) {
  return (
    <BlockStack gap="400">
      <Text as="p" variant="bodySm" tone="subdued">
        Shopify n&apos;autorise qu&apos;une seule image par variante. Variantsy lève cette limite
        en lisant l&apos;ordre de vos médias — voyez l&apos;onglet Installation pour la règle.
      </Text>

<Checkbox
  label="Filtrer la galerie selon la variante sélectionnée"
  helpText="Décochez pour revenir au comportement natif de Shopify (une seule image par variante)."
  checked={form.galleryEnabled}
  onChange={(v) => set("galleryEnabled", v)}
/>
<Select
  label="Option qui porte les images"
  options={[
    { label: "Détection automatique (recommandé)", value: "auto" },
    { label: "1re option", value: "option1" },
    { label: "2e option", value: "option2" },
    { label: "3e option", value: "option3" },
  ]}
  helpText="En automatique, Variantsy identifie l'option sur laquelle vos images sont réellement assignées — la couleur dans la quasi-totalité des cas."
  value={form.groupBy}
  onChange={(v) => set("groupBy", v)}
  disabled={!form.galleryEnabled}
/>
<Select
  label="Images placées avant le premier coloris"
  options={[
    { label: "Visibles pour tous les coloris", value: "append" },
    { label: "Visibles sur le premier coloris uniquement", value: "first" },
    { label: "Toujours masquées", value: "hide" },
  ]}
  helpText="Typiquement un guide des tailles ou une vidéo de marque, placés en tête de galerie."
  value={form.commonMediaMode}
  onChange={(v) => set("commonMediaMode", v)}
  disabled={!form.galleryEnabled}
/>

<Divider />

<Checkbox
  label="Utiliser aussi le texte alternatif des images"
  helpText="Une image dont le texte alternatif contient « Bleu marine » est rattachée à ce coloris, même si elle n'est assignée à aucune variante. Pratique quand vos médias sont importés automatiquement."
  checked={form.altFallback}
  onChange={(v) => set("altFallback", v)}
  disabled={!form.galleryEnabled}
/>
<TextField
  label="Préfixe exigé dans le texte alternatif (optionnel)"
  value={form.altPrefix}
  onChange={(v) => set("altPrefix", v)}
  disabled={!form.galleryEnabled || !form.altFallback}
  autoComplete="off"
  placeholder="#"
  helpText="Avec « # », seules les images dont le texte alternatif contient « #bleu marine » sont rattachées. Laissez vide pour une simple recherche du nom du coloris."
/>

<Divider />

<Checkbox
  label="Ne pas filtrer si toutes les images tombent dans un seul groupe"
  helpText="Garde-fou : sur un produit mal rangé, mieux vaut afficher toute la galerie que de la vider."
  checked={form.skipSingleGroup}
  onChange={(v) => set("skipSingleGroup", v)}
  disabled={!form.galleryEnabled}
/>
<TextField
  label="Sélecteur CSS des miniatures (optionnel)"
  value={form.thumbSelectorCss}
  onChange={(v) => set("thumbSelectorCss", v)}
  disabled={!form.galleryEnabled}
  autoComplete="off"
  placeholder="Laisser vide pour la détection automatique"
  helpText="À renseigner seulement si les miniatures de votre thème ne se filtrent pas."
/>
    </BlockStack>
  );
}
