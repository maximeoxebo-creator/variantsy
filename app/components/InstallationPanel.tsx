import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  InlineGrid,
  InlineStack,
  List,
  Text,
} from "@shopify/polaris";

/* ========================================================================== */
/* Volet Installation                                                         */
/*                                                                            */
/* Extrait de sa page dédiée pour rejoindre les onglets : un marchand qui      */
/* installe l'app ne devrait pas avoir à naviguer entre quatre écrans pour     */
/* comprendre trois gestes.                                                   */
/* ========================================================================== */

const BLUE = "#2C5AA0";
const BEIGE = "#D8C3A5";

/** Pastille étoilée : marque une photo assignée à une variante. */
function Etoile() {
  return (
    <span
      style={{
        position: "absolute",
        top: -8,
        right: -8,
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: "#1A1A1A",
        color: "#fff",
        fontSize: 11,
        lineHeight: "20px",
        textAlign: "center",
        fontWeight: 700,
        boxShadow: "0 1px 3px rgba(0,0,0,.25)",
      }}
    >
      ★
    </span>
  );
}

/** Silhouette de tee-shirt, lisible dès 30 px. Inline : rien à charger. */
function Silhouette({ tint, large }: { tint: string; large?: boolean }) {
  const taille = large ? 76 : 40;
  return (
    <svg viewBox="0 0 48 48" width={taille} height={taille} aria-hidden="true">
      <path
        d="M18 7 L24 10.5 L30 7 L42 13 L37.5 22.5 L33.5 20 L33.5 41.5 Q24 43.5 14.5 41.5 L14.5 20 L10.5 22.5 L6 13 Z"
        fill={tint}
      />
    </svg>
  );
}

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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 54,
          height: 54,
          borderRadius: 10,
          background: `color-mix(in srgb, ${color} 24%, #fff)`,
          opacity: faded ? 0.25 : 1,
          boxShadow: faded ? "none" : "0 1px 2px rgba(0,0,0,.06)",
        }}
      >
        <Silhouette tint={color} />
        {pinned && <Etoile />}
      </span>
      {legende && (
        <Text as="span" variant="bodyXs" tone="subdued">
          {legende}
        </Text>
      )}
    </BlockStack>
  );
}

/**
 * Fiche produit miniature : image principale, pastilles, miniatures.
 *
 * Deux fiches côte à côte montrent le même produit dans deux coloris, chacune
 * avec SES miniatures — plus la photo commune, mise en évidence. Un avant/après
 * n'expliquait que le filtrage ; ceci explique aussi pourquoi certaines photos
 * survivent à tous les coloris, ce qui est la question suivante du marchand.
 */
function FicheMiniature({
  titre,
  couleur,
  pastilles,
  choisie,
  miniatures,
}: {
  titre: string;
  couleur: string;
  pastilles: string[];
  choisie: number;
  miniatures: number;
}) {
  return (
    <span
      style={{
        display: "flex",
        gap: 14,
        padding: 14,
        borderRadius: 16,
        background: "#fff",
        border: "1px solid var(--p-color-border-secondary)",
        boxShadow: "0 2px 8px rgba(0,0,0,.06)",
      }}
    >
      <span style={{ flex: "0 0 108px" }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 108,
            height: 108,
            borderRadius: 12,
            background: `color-mix(in srgb, ${couleur} 24%, #fff)`,
          }}
        >
          <Silhouette tint={couleur} large />
        </span>
      </span>

      <span style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <Text as="span" variant="headingSm">
          {titre}
        </Text>

        <span style={{ display: "flex", gap: 8 }}>
          {pastilles.map((c, i) => (
            <span
              key={i}
              style={{
                display: "block",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: c,
                boxShadow:
                  i === choisie
                    ? `0 0 0 2px #fff, 0 0 0 4px ${c}`
                    : "inset 0 0 0 1px rgba(0,0,0,.14)",
              }}
            />
          ))}
        </span>

        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {Array.from({ length: miniatures }).map((_, i) => (
            <span
              key={i}
              style={{
                display: "block",
                width: 30,
                height: 30,
                borderRadius: 7,
                background: `color-mix(in srgb, ${couleur} 24%, #fff)`,
              }}
            />
          ))}
        </span>
      </span>
    </span>
  );
}

/**
 * Où déclarer les valeurs d'une option, dans l'admin Shopify.
 *
 * Shopify attache désormais une couleur à chaque valeur d'option, visible
 * directement dans l'éditeur de variantes. Le marchand n'a donc pas besoin de
 * ressaisir ses teintes ailleurs pour que le nuancier soit juste — c'est ce
 * que ce schéma montre, avant même de parler de la Bibliothèque de swatches.
 */
function SchemaOptions() {
  const valeurs = [
    { nom: "Beige", couleur: BEIGE },
    { nom: "Blue", couleur: BLUE },
  ];

  return (
    <span
      style={{
        display: "block",
        borderRadius: 14,
        background: "#fff",
        border: "1px solid var(--p-color-border-secondary)",
        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "block",
          padding: "10px 14px",
          background: "var(--p-color-bg-surface-secondary)",
          borderBottom: "1px solid var(--p-color-border-secondary)",
          fontSize: 12,
          color: "var(--p-color-text-secondary)",
        }}
      >
        Admin Shopify › Produits › votre produit › <strong>Variantes</strong>
      </span>

      <span style={{ display: "block", padding: "14px" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          Couleur
        </span>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {valeurs.map((v) => (
            <span
              key={v.nom}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px 6px 8px",
                borderRadius: 8,
                background: "var(--p-color-bg-surface-info)",
                fontSize: 13,
              }}
            >
              <span
                style={{
                  display: "block",
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: v.couleur,
                  border: "1px solid rgba(0,0,0,.12)",
                }}
              />
              {v.nom}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

/**
 * Où assigner une photo à une variante, dans l'admin Shopify.
 *
 * C'est le geste que l'app demande, et le seul qu'elle ne peut pas faire à la
 * place du marchand. Le décrire en mots — « ouvrez la variante, section
 * Médias » — suppose qu'il sache déjà à quoi ressemble l'écran. Une maquette
 * du tableau des variantes, avec l'emplacement d'image mis en évidence, le
 * dispense de chercher.
 */
function SchemaAssignation() {
  const lignes = [
    { valeur: "Blue", couleur: BLUE },
    { valeur: "Beige", couleur: BEIGE },
  ];

  return (
    <span
      style={{
        display: "block",
        borderRadius: 14,
        background: "#fff",
        border: "1px solid var(--p-color-border-secondary)",
        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "block",
          padding: "10px 14px",
          background: "var(--p-color-bg-surface-secondary)",
          borderBottom: "1px solid var(--p-color-border-secondary)",
          fontSize: 12,
          color: "var(--p-color-text-secondary)",
        }}
      >
        Admin Shopify › Produits › votre produit › <strong>Variantes</strong>
      </span>

      {lignes.map((ligne) => (
        <span
          key={ligne.valeur}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderTop: "1px solid var(--p-color-border-secondary)",
          }}
        >
          <span
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 8,
              flex: "0 0 auto",
              background: `color-mix(in srgb, ${ligne.couleur} 22%, #fff)`,
              border: "2px solid var(--p-color-border-info)",
              boxShadow: "0 0 0 3px var(--p-color-bg-surface-info)",
            }}
          >
            <Silhouette tint={ligne.couleur} />
            <Etoile />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{ligne.valeur}</span>
          <span style={{ marginInlineStart: "auto", fontSize: 12, color: "#8A8A8A" }}>
            129,00 €
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * L'éditeur de thème, tel qu'on le voit au moment d'ajouter le bloc.
 *
 * Le geste se décrivait en cinq puces, ce qui suppose de savoir à quoi
 * ressemble l'écran. Reproduire l'arborescence et le sélecteur de blocs permet
 * de reconnaître au lieu de chercher — et l'onglet « Applis », que presque tout
 * le monde manque parce qu'il n'est pas ouvert par défaut, saute aux yeux.
 */
function SchemaEditeurTheme() {
  const arbre = [
    { texte: "Product information", niveau: 0, actif: false },
    { texte: "Media", niveau: 1, actif: false },
    { texte: "Details", niveau: 1, actif: false },
    { texte: "Add block", niveau: 2, actif: true },
    { texte: "Titre", niveau: 2, actif: false },
    { texte: "Prix", niveau: 2, actif: false },
  ];

  return (
    <span
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
        gap: 12,
        alignItems: "start",
      }}
    >
      <span
        style={{
          display: "block",
          borderRadius: 12,
          background: "#fff",
          border: "1px solid var(--p-color-border-secondary)",
          padding: "10px 12px",
          fontSize: 12,
        }}
      >
        <span style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>Template</span>
        {arbre.map((ligne) => (
          <span
            key={ligne.texte}
            style={{
              display: "block",
              padding: "5px 8px",
              marginInlineStart: ligne.niveau * 12,
              borderRadius: 6,
              background: ligne.actif ? "var(--p-color-bg-surface-info)" : "transparent",
              border: ligne.actif
                ? "1.5px solid var(--p-color-border-info)"
                : "1.5px solid transparent",
              color: ligne.actif
                ? "var(--p-color-text-info)"
                : "var(--p-color-text-secondary)",
              fontWeight: ligne.actif ? 600 : 400,
            }}
          >
            {ligne.actif ? "⊕ " : ""}
            {ligne.texte}
          </span>
        ))}
      </span>

      <span
        style={{
          display: "block",
          borderRadius: 12,
          background: "#fff",
          border: "1px solid var(--p-color-border-secondary)",
          padding: 12,
          fontSize: 12,
        }}
      >
        <span
          style={{
            display: "flex",
            borderRadius: 8,
            background: "var(--p-color-bg-surface-secondary)",
            padding: 3,
            marginBottom: 10,
          }}
        >
          <span style={{ flex: 1, textAlign: "center", padding: "5px 0", color: "#8A8A8A" }}>
            Blocs
          </span>
          <span
            style={{
              flex: 1,
              textAlign: "center",
              padding: "5px 0",
              borderRadius: 6,
              background: "#fff",
              fontWeight: 700,
              boxShadow: "0 1px 2px rgba(0,0,0,.12)",
            }}
          >
            Applis
          </span>
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            background: "var(--p-color-bg-surface-info)",
            border: "1.5px solid var(--p-color-border-info)",
            fontWeight: 600,
          }}
        >
          <span
            style={{
              display: "block",
              width: 18,
              height: 18,
              borderRadius: 4,
              background: BLUE,
              flex: "0 0 auto",
            }}
          />
          Variantsy
        </span>
      </span>
    </span>
  );
}

export function InstallationPanel({
  themeName,
  deepLink,
  embedLink,
}: {
  themeName: string | null;
  deepLink: string | null;
  embedLink: string | null;
}) {
  return (
    <BlockStack gap="500">

<Card>
  <BlockStack gap="300">
    <InlineStack gap="200" blockAlign="center">
      <Badge tone="info">Step 1</Badge>
      <Text as="h2" variant="headingMd">
        Enable the block on the product page
      </Text>
    </InlineStack>
    <Text as="p">
      Variantsy is added as an app block in the theme editor
      {themeName ? ` (${themeName})` : ""}. Place it just above the
      &ldquo;Add to cart&rdquo; button of your product template.
    </Text>
    {deepLink && (
      <InlineStack>
        <Button variant="primary" url={deepLink} target="_blank">
          Open the theme editor
        </Button>
      </InlineStack>
    )}
    <Box background="bg-surface-secondary" padding="400" borderRadius="300">
      <BlockStack gap="300">
        <SchemaEditeurTheme />
        <Text as="p" variant="bodySm" tone="subdued">
          Under <strong>Details</strong>, click &ldquo;Add block&rdquo;, then open the
          <strong>Apps</strong> tab — it is not the one shown by default, and that is where
          almost everyone gets stuck.
        </Text>
      </BlockStack>
    </Box>

    <List type="number">
      <List.Item>
        At the top of the editor, switch to the <strong>Product</strong> template — the
        block does not exist on other templates.
      </List.Item>
      <List.Item>
        In the main section, click &ldquo;Add block&rdquo;, then open the
        <strong>Apps</strong> tab.
      </List.Item>
      <List.Item>Choose &ldquo;Variantsy&rdquo;.</List.Item>
      <List.Item>Drag it above the add-to-cart button.</List.Item>
      <List.Item>Save.</List.Item>
    </List>
  </BlockStack>
</Card>


<Card>
  <BlockStack gap="300">
    <InlineStack gap="200" blockAlign="center">
      <Badge tone="info">Step 2</Badge>
      <Text as="h2" variant="headingMd">
        Enable swatches on your collection pages
      </Text>
      <Badge>Optional</Badge>
    </InlineStack>
    <Text as="p">
      Collection cards are rendered by your theme, inside a loop no app can reach. Swatches
      therefore do not go through a block, but through an <strong>app embed</strong> — filed
      elsewhere in the theme editor.
    </Text>
    <Banner tone="info">
      <Text as="p" variant="bodySm">
        This is the most common confusion: people look for &ldquo;Variantsy&rdquo; in the
        block list of a collection page and cannot find it. That is expected — it is not
        there.
      </Text>
    </Banner>
    {embedLink && (
      <InlineStack>
        <Button variant="primary" url={embedLink} target="_blank">
          Open app embeds
        </Button>
      </InlineStack>
    )}
    <List type="number">
      <List.Item>
        In the theme editor, scroll the left panel to the bottom and click
        <strong>App embeds</strong> (the plug icon).
      </List.Item>
      <List.Item>
        Turn on <strong>&ldquo;Variantsy collections&rdquo;</strong>.
      </List.Item>
      <List.Item>Save.</List.Item>
    </List>
    <Text as="p" variant="bodySm" tone="subdued">
      Two switches control this display, and both must be on: this one loads the script,
      and the one on the <strong>Appearance</strong> tab decides whether anything is drawn.
      To turn catalog swatches off day to day, use the Appearance one — it does not send you
      back to the theme editor.
    </Text>
  </BlockStack>
</Card>

<Card>
  <BlockStack gap="300">
    <InlineStack gap="200" blockAlign="center">
      <Badge tone="info">Step 3</Badge>
      <Text as="h2" variant="headingMd">
        Put your photos in order
      </Text>
    </InlineStack>
    <Text as="p">
      One rule only: in the Shopify admin, assign the{" "}
      <strong>first photo of each color</strong> to its variant, and place the other photos
      of that same color right after it.
    </Text>

    <Box background="bg-surface-secondary" padding="400" borderRadius="300">
      <BlockStack gap="300">
        <Text as="p" variant="bodySm" fontWeight="semibold">
          1. Declare your colors and their shade
        </Text>
        <SchemaOptions />
        <Text as="p" variant="bodySm" tone="subdued">
          A color can be attached to every option value.{" "}
          <strong>Variantsy reads it directly</strong>: fill it in here and your palette is
          correct, with nothing else to enter. Even an in-house shade no dictionary knows.
        </Text>
      </BlockStack>
    </Box>

    <Box background="bg-surface-secondary" padding="400" borderRadius="300">
      <BlockStack gap="300">
        <Text as="p" variant="bodySm" fontWeight="semibold">
          2. Assign one photo to each color
        </Text>
        <SchemaAssignation />
        <Text as="p" variant="bodySm" tone="subdued">
          On the product page, under <strong>Variants</strong>: click the image slot on the
          left of the row and pick the photo. This is the one step Variantsy cannot do for
          you.
        </Text>
      </BlockStack>
    </Box>

    <Box background="bg-surface-secondary" padding="400" borderRadius="300">
      <BlockStack gap="400">
        <Text as="p" variant="bodySm" fontWeight="semibold">
          3. Place the remaining photos behind it
        </Text>
        <InlineStack gap="300" blockAlign="start" wrap>
          <Vignette color={BLUE} pinned legende="Blue" />
          <Vignette color={BLUE} legende="Blue" />
          <Vignette color={BLUE} legende="Blue" />
          <Vignette color={BEIGE} pinned legende="Beige" />
          <Vignette color={BEIGE} legende="Beige" />
        </InlineStack>
        <BlockStack gap="150">
          <Text as="p" variant="bodySm">
            <strong>★ = the photo you assigned to the variant.</strong> It opens that
            color&apos;s group; the photos following it join the same group, up to the next
            assigned photo.
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            So you assign a single photo per color, not all four.
          </Text>
        </BlockStack>
      </BlockStack>
    </Box>

    <Divider />

    <Text as="p" variant="headingSm">
      What your shopper sees
    </Text>
    <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
      <FicheMiniature
        titre="Tee · Blue"
        couleur={BLUE}
        pastilles={[BLUE, BEIGE]}
        choisie={0}
        miniatures={2}
      />
      <FicheMiniature
        titre="Tee · Beige"
        couleur={BEIGE}
        pastilles={[BLUE, BEIGE]}
        choisie={1}
        miniatures={2}
      />
    </InlineGrid>
    <Text as="p" variant="bodySm" tone="subdued">
      Same product, two colors: each shopper sees only the photos of theirs.
    </Text>

    <InlineStack>
      <Button url="/app/images">Inspect a product</Button>
    </InlineStack>
  </BlockStack>
</Card>

<Card>
  <BlockStack gap="300">
    <InlineStack gap="200" blockAlign="center">
      <Badge tone="info">Step 4</Badge>
      <Text as="h2" variant="headingMd">
        Adjust the style
      </Text>
    </InlineStack>
    <Text as="p">
      Shape, size, selection style, sold-out handling and the title template are all set
      under &ldquo;Settings&rdquo;, with a live preview.
    </Text>
    <InlineStack>
      <Button url="/app">Go to settings</Button>
    </InlineStack>
  </BlockStack>
</Card>

<Card>
  <BlockStack gap="300">
    <Text as="h2" variant="headingMd">
      My theme&apos;s own selector still shows
    </Text>
    <Text as="p">
      Variantsy detects the selectors of the official themes (Dawn, Refresh, Craft, Sense,
      Studio…) and of most premium themes automatically. For a heavily customized theme,
      enter the CSS selector of the block to hide under
      &ldquo;Settings → Image and theme integration&rdquo;.
    </Text>
    <Text as="p" tone="subdued">
      The native selector is never removed, only hidden: Variantsy drives it in the
      background, so the cart always receives the right variant even if another script in
      the theme listens to it.
    </Text>
  </BlockStack>
</Card>
              </BlockStack>
  );
}
