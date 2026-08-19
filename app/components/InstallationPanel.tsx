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

const NAVY = "#1F3A5F";
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
    { nom: "Navy", couleur: NAVY },
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
    { valeur: "Navy", couleur: NAVY },
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
    { texte: "Informations sur le produit", niveau: 0, actif: false },
    { texte: "Support multimédia", niveau: 1, actif: false },
    { texte: "Détails", niveau: 1, actif: false },
    { texte: "Ajouter un bloc", niveau: 2, actif: true },
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
        <span style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>Modèle</span>
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
              background: NAVY,
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
      <Badge tone="info">Étape 1</Badge>
      <Text as="h2" variant="headingMd">
        Activer le bloc sur la page produit
      </Text>
    </InlineStack>
    <Text as="p">
      Variantsy s&apos;ajoute comme bloc d&apos;app dans l&apos;éditeur de thème
      {themeName ? ` (${themeName})` : ""}. Placez-le juste au-dessus du bouton
      « Ajouter au panier » de votre modèle produit.
    </Text>
    {deepLink && (
      <InlineStack>
        <Button variant="primary" url={deepLink} target="_blank">
          Ouvrir l&apos;éditeur de thème
        </Button>
      </InlineStack>
    )}
    <Box background="bg-surface-secondary" padding="400" borderRadius="300">
      <BlockStack gap="300">
        <SchemaEditeurTheme />
        <Text as="p" variant="bodySm" tone="subdued">
          Dans la section <strong>Détails</strong>, cliquez sur « Ajouter un bloc », puis
          ouvrez l&apos;onglet <strong>Applis</strong> — ce n&apos;est pas celui affiché par
          défaut, et c&apos;est là que presque tout le monde bloque.
        </Text>
      </BlockStack>
    </Box>

    <List type="number">
      <List.Item>
        En haut de l&apos;éditeur, basculez sur le modèle <strong>Produit</strong> —
        le bloc n&apos;existe pas sur les autres modèles.
      </List.Item>
      <List.Item>
        Dans la section principale, cliquez sur « Ajouter un bloc », puis ouvrez
        l&apos;onglet <strong>Apps</strong>.
      </List.Item>
      <List.Item>Choisissez « Variantsy ».</List.Item>
      <List.Item>Glissez-le au-dessus du bouton d&apos;ajout au panier.</List.Item>
      <List.Item>Enregistrez.</List.Item>
    </List>
  </BlockStack>
</Card>


<Card>
  <BlockStack gap="300">
    <InlineStack gap="200" blockAlign="center">
      <Badge tone="info">Étape 2</Badge>
      <Text as="h2" variant="headingMd">
        Activer les pastilles sur vos pages de collection
      </Text>
      <Badge>Facultatif</Badge>
    </InlineStack>
    <Text as="p">
      Les vignettes d&apos;une collection sont rendues par votre thème, dans une boucle
      à laquelle aucune application n&apos;a accès. Les pastilles n&apos;y passent donc
      pas par un bloc, mais par un <strong>module d&apos;application</strong> — rangé
      ailleurs dans l&apos;éditeur de thème.
    </Text>
    <Banner tone="info">
      <Text as="p" variant="bodySm">
        C&apos;est la confusion la plus fréquente : on cherche « Variantsy » dans la
        liste des blocs d&apos;une page de collection, et on ne le trouve pas. C&apos;est
        normal, il n&apos;y est pas.
      </Text>
    </Banner>
    {embedLink && (
      <InlineStack>
        <Button variant="primary" url={embedLink} target="_blank">
          Ouvrir les modules d&apos;application
        </Button>
      </InlineStack>
    )}
    <List type="number">
      <List.Item>
        Dans l&apos;éditeur de thème, ouvrez le panneau de gauche jusqu&apos;en bas et
        cliquez sur <strong>Modules d&apos;application</strong> (icône en forme de prise).
      </List.Item>
      <List.Item>
        Activez <strong>« Variantsy collections »</strong>.
      </List.Item>
      <List.Item>Enregistrez.</List.Item>
    </List>
    <Text as="p" variant="bodySm" tone="subdued">
      Deux interrupteurs commandent cet affichage, et les deux doivent être allumés :
      celui-ci charge le script, et celui de l&apos;onglet <strong>Apparence</strong>
      décide de l&apos;affichage. Pour couper les pastilles de collection au quotidien,
      utilisez celui de l&apos;onglet Apparence — il ne demande pas de repasser par
      l&apos;éditeur de thème.
    </Text>
  </BlockStack>
</Card>

<Card>
  <BlockStack gap="300">
    <InlineStack gap="200" blockAlign="center">
      <Badge tone="info">Étape 3</Badge>
      <Text as="h2" variant="headingMd">
        Ranger vos photos dans l&apos;ordre
      </Text>
    </InlineStack>
    <Text as="p">
      Une seule règle : dans l&apos;admin Shopify, assignez la{" "}
      <strong>première photo de chaque coloris</strong> à sa variante, et placez les
      autres photos du même coloris juste après.
    </Text>

    <Box background="bg-surface-secondary" padding="400" borderRadius="300">
      <BlockStack gap="300">
        <Text as="p" variant="bodySm" fontWeight="semibold">
          1. Déclarez vos coloris et leur teinte
        </Text>
        <SchemaOptions />
        <Text as="p" variant="bodySm" tone="subdued">
          Shopify attache une couleur à chaque valeur d&apos;option.{" "}
          <strong>Variantsy la lit directement</strong> : renseignez-la ici et votre
          nuancier est juste, sans aucune autre saisie. Même une teinte maison
          qu&apos;aucun dictionnaire ne connaît.
        </Text>
      </BlockStack>
    </Box>

    <Box background="bg-surface-secondary" padding="400" borderRadius="300">
      <BlockStack gap="300">
        <Text as="p" variant="bodySm" fontWeight="semibold">
          2. Assignez une photo à chaque coloris
        </Text>
        <SchemaAssignation />
        <Text as="p" variant="bodySm" tone="subdued">
          Dans la fiche produit, section <strong>Variantes</strong> : cliquez sur
          l&apos;emplacement d&apos;image à gauche de la ligne, et choisissez la
          photo. C&apos;est le seul geste que Variantsy ne peut pas faire à votre
          place.
        </Text>
      </BlockStack>
    </Box>

    <Box background="bg-surface-secondary" padding="400" borderRadius="300">
      <BlockStack gap="400">
        <Text as="p" variant="bodySm" fontWeight="semibold">
          3. Rangez les autres photos derrière
        </Text>
        <InlineStack gap="300" blockAlign="start" wrap>
          <Vignette color={NAVY} pinned legende="Navy" />
          <Vignette color={NAVY} legende="Navy" />
          <Vignette color={NAVY} legende="Navy" />
          <Vignette color={BEIGE} pinned legende="Beige" />
          <Vignette color={BEIGE} legende="Beige" />
        </InlineStack>
        <BlockStack gap="150">
          <Text as="p" variant="bodySm">
            <strong>★ = la photo que vous avez assignée à la variante.</strong> Elle
            ouvre le groupe de son coloris ; les photos qui la suivent le rejoignent,
            jusqu&apos;à la prochaine photo assignée.
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Vous n&apos;assignez donc qu&apos;une seule photo par coloris, pas les
            quatre.
          </Text>
        </BlockStack>
      </BlockStack>
    </Box>

    <Divider />

    <Text as="p" variant="headingSm">
      Ce que voit votre client
    </Text>
    <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
      <FicheMiniature
        titre="Cocotte · Navy"
        couleur={NAVY}
        pastilles={[NAVY, BEIGE]}
        choisie={0}
        miniatures={2}
      />
      <FicheMiniature
        titre="Cocotte · Beige"
        couleur={BEIGE}
        pastilles={[NAVY, BEIGE]}
        choisie={1}
        miniatures={2}
      />
    </InlineGrid>
    <Text as="p" variant="bodySm" tone="subdued">
      Même produit, deux coloris : chaque client ne voit que les photos du sien.
    </Text>

    <InlineStack>
      <Button url="/app/images">Vérifier un produit</Button>
    </InlineStack>
  </BlockStack>
</Card>

<Card>
  <BlockStack gap="300">
    <InlineStack gap="200" blockAlign="center">
      <Badge tone="info">Étape 4</Badge>
      <Text as="h2" variant="headingMd">
        Ajuster le style
      </Text>
    </InlineStack>
    <Text as="p">
      Forme, taille, style de sélection, gestion des ruptures et template de titre se
      règlent dans « Réglages », avec un aperçu en direct.
    </Text>
    <InlineStack>
      <Button url="/app">Aller aux réglages</Button>
    </InlineStack>
  </BlockStack>
</Card>

<Card>
  <BlockStack gap="300">
    <Text as="h2" variant="headingMd">
      Le sélecteur natif de mon thème s&apos;affiche encore
    </Text>
    <Text as="p">
      Variantsy détecte automatiquement les sélecteurs des thèmes Shopify officiels
      (Dawn, Refresh, Craft, Sense, Studio…) et de la plupart des thèmes premium. Pour un
      thème très personnalisé, renseignez le sélecteur CSS du bloc à masquer dans
      « Réglages → Image et intégration au thème ».
    </Text>
    <Text as="p" tone="subdued">
      Le sélecteur natif n&apos;est jamais supprimé, seulement masqué : Variantsy le
      pilote en arrière-plan, donc le panier reçoit toujours la bonne variante même si un
      autre script du thème l&apos;écoute.
    </Text>
  </BlockStack>
</Card>
              </BlockStack>
  );
}
