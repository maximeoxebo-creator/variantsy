import { useState } from "react";
import { AppProvider, Page, Layout, Card, Tabs, BlockStack, Box, Text } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { ApparencePanel, TitrePanel, SelecteurMode, ONGLETS } from "./app._index";
import type { Mode } from "./app._index";
import { InstallationPanel } from "../components/InstallationPanel";
import { LiensProduitsPanel } from "../components/LiensProduitsPanel";
import { SwatchPreview } from "../components/SwatchPreview";

/**
 * Page d'aperçu TEMPORAIRE — à supprimer.
 *
 * L'admin est embarqué dans Shopify : impossible de le regarder d'ici, et j'ai
 * annoncé deux refontes sans pouvoir vérifier leur rendu. Cette page rend les
 * mêmes volets hors du cadre Shopify, avec des réglages factices, uniquement
 * pour les voir.
 */
export const links = () => [{ rel: "stylesheet", href: polarisStyles }];



export default function Apercu() {
  // Valeurs recopiées plutôt qu'importées : settings.server est un module
  // serveur, et l'importer ici le ferait entrer dans le bundle client.
  const [form, setForm] = useState({
    enabled: true, shape: "circle", size: 40, gap: 10, borderWidth: 1,
    borderColor: "#D9D9D9", selectedStyle: "ring", selectedColor: "#111111",
    selectedWidth: 2, selectedGap: 2, cornerRadius: 8, displayMode: "swatch",
    controlRadius: 6, controlSelectedStyle: "outline", dropdownFullWidth: false,
    swatchFallback: "image", photoScale: 100, neutralColor: "#ECECEC",
    showLabels: false, showOptionName: true, maxVisible: 0,
    soldOutStyle: "strikethrough", hideNativeSelector: true, nativeSelectorCss: "",
    updateUrl: true, preloadOnHover: true, swapImage: true, imageSelectorCss: "",
    galleryEnabled: true, groupBy: "auto", commonMediaMode: "append",
    altFallback: true, altPrefix: "", thumbSelectorCss: "", skipSingleGroup: true,
    updateTitle: true, titleTemplate: "{{product_title}} — {{variant_title}}",
    titleSelectorCss: "", updateDocumentTitle: false,
    colorOptionNames: "Color,Colour,Couleur", customCss: "",
  } as never);
  const [mode, setMode] = useState<Mode>("variants");
  const [tab, setTab] = useState(0);
  const onglets = ONGLETS[mode];
  const actif = onglets[Math.min(tab, onglets.length - 1)].id;
  const set = (cle: string, valeur: unknown) =>
    setForm((f: Record<string, unknown>) => ({ ...f, [cle]: valeur }) as never);

  return (
    <AppProvider i18n={{}}>
      <Page title="Aperçu" subtitle="Page temporaire de contrôle visuel">
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <SelecteurMode
                mode={mode}
                onChange={(m) => { setMode(m); setTab(0); }}
                nbGroupes={0}
              />

              <Card padding="0">
                <Tabs
                  tabs={onglets as unknown as { id: string; content: string }[]}
                  selected={Math.min(tab, onglets.length - 1)}
                  onSelect={setTab}
                  fitted
                />
              </Card>
              <BlockStack gap="400">
                {actif === "groupes" && (
                  <LiensProduitsPanel
                    groups={[]}
                    onPickProducts={async () => [
                      { id: "gid://shopify/Product/1", handle: "cocotte-blue",
                        title: "Cocotte · Blue", options: [{ name: "Size" }] },
                      { id: "gid://shopify/Product/2", handle: "cocotte-beige",
                        title: "Cocotte · Beige", options: [{ name: "Color" }] },
                    ]}
                    onSave={() => {}}
                    onDelete={() => {}}
                    enregistrement={false}
                    erreurs={[]}
                  />
                )}
                {actif === "apparence" && <ApparencePanel form={form} set={set as never} />}
                {actif === "titre" && <TitrePanel form={form} set={set as never} />}
                {actif === "installation" && (
                  <InstallationPanel themeName="Dawn" deepLink="https://example.com" mode={mode} />
                )}
                {(actif === "apparence" || actif === "titre") && (
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h2" variant="headingMd">Preview</Text>
                      <SwatchPreview settings={form} />
                    </BlockStack>
                  </Card>
                )}
              </BlockStack>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>
    </AppProvider>
  );
}
