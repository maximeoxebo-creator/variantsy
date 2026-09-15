import { BlockStack, Text } from "@shopify/polaris";

/* ==========================================================================
   Schémas de l'admin

   Extraits du volet Installation, qui en avait l'exclusivité alors qu'ils
   illustrent des notions dont plusieurs écrans parlent : le retrait de
   l'option couleur appartient autant au volet « Produits liés », où il est
   contextuel, qu'à la notice. Les partager évite de les redessiner.

   Tout est inline — aucune image à charger, et le rendu suit les jetons de
   couleur de Polaris, donc le thème clair comme le sombre.
   ========================================================================== */

/** Teintes des maquettes : un camaïeu d'orange, pour l'unité avec la marque.
 *
 *  Elles remplacent le bleu, le beige et la terracotta d'origine en recopiant
 *  leur CLARTÉ (L* 38 / 80 / 64) : chaque schéma garde l'équilibre de contraste
 *  pour lequel il avait été dessiné, et les trois restent distinctes à l'œil,
 *  daltonien compris — l'écart de clarté porte la différence, pas la teinte. */
export const RUST = "#9E3A12";
export const APRICOT = "#F8BB85";
export const TANGERINE = "#F07A22";

/** Couleur de MARQUE de Variantsy — orange Soleil, celle de l'icône.
 *
 *  Réservée aux endroits où c'est VARIANTSY qui est dessiné : le câblage des
 *  fiches liées, la galerie filtrée, l'app dans l'éditeur de thème. Les
 *  maquettes de l'interface SHOPIFY gardent les jetons Polaris : y mettre la
 *  marque ferait croire que Shopify porte nos couleurs.
 *
 *  `MARQUE` est plus sombre que l'orange de l'icône : elle sert à des traits
 *  fins et à du texte de 8 px sur blanc, où la teinte claire disparaît. */
export const MARQUE = "#EA580C";
export const DEGRADE_MARQUE = "linear-gradient(145deg,#FFB53F 0%,#FF8C3B 46%,#F2623A 100%)";

/** Teinte d'une silhouette posée sur un aplat de couleur.
 *
 *  Une seule valeur, sans exception : la version précédente assombrissait la
 *  silhouette sur le beige pour gagner du contraste, et le tee-shirt beige n'y
 *  ressemblait plus aux autres. Un même vêtement doit se lire pareil d'un
 *  schéma à l'autre — c'est ce qui prime ici sur le contraste. */
export const TEINTE_SILHOUETTE = "rgba(255,255,255,.34)";

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

export function Vignette({
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
export function FicheMiniature({
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
export function SchemaOptions() {
  const valeurs = [
    { nom: "Apricot", couleur: APRICOT },
    { nom: "Rust", couleur: RUST },
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
        Shopify admin › Products › your product › <strong>Variants</strong>
      </span>

      <span style={{ display: "block", padding: "14px" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          Color
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
                background: "var(--p-color-bg-surface-secondary)",
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
export function SchemaAssignation() {
  const lignes = [
    { valeur: "Rust", couleur: RUST },
    { valeur: "Apricot", couleur: APRICOT },
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
        Shopify admin › Products › your product › <strong>Variants</strong>
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
              border: "2px solid #EA580C",
              boxShadow: "0 0 0 3px #FFF1E6",
            }}
          >
            <Silhouette tint={ligne.couleur} />
            <Etoile />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{ligne.valeur}</span>
          <span style={{ marginInlineStart: "auto", fontSize: 12, color: "#8A8A8A" }}>
            $129.00
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
/**
 * L'option Couleur, barrée : le geste que le marchand doit faire AVANT de
 * grouper. Un schéma dit mieux qu'un paragraphe qu'il s'agit de supprimer.
 */
export function SchemaRetraitOption() {
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
        Shopify admin › Products › your product › <strong>Variants</strong>
      </span>
      <span style={{ display: "block", padding: 14 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--p-color-bg-fill-critical-secondary)",
            border: "1px solid var(--p-color-border-critical)",
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "line-through",
              color: "var(--p-color-text-critical)",
            }}
          >
            Color · Apricot, Rust
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--p-color-text-critical)" }}>
            to remove
          </span>
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {["Size · 22, 25, 36", "Material · Cast iron"].map((autre) => (
            <span
              key={autre}
              style={{
                fontSize: 13,
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--p-color-bg-surface-secondary)",
                border: "1px solid var(--p-color-border-secondary)",
                color: "var(--p-color-text-secondary)",
              }}
            >
              {autre} — leave it alone
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

/** Trois fiches distinctes réunies par un groupe. */
export function SchemaGroupe() {
  // Le schéma alignait trois fiches produit et s'arrêtait là : on y voyait
  // trois articles distincts, jamais ce qui les relie — c'est-à-dire tout
  // l'intérêt de la fonctionnalité.
  //
  // Trois choses portent maintenant le lien : l'ADRESSE de chaque page, la
  // MÊME rangée de pastilles détachée sur sa bande au bas des trois fiches, et
  // un CÂBLAGE qui descend de ces rangées vers une barre commune. Les « ↔ »
  // seuls suggéraient un va-et-vient, pas un sélecteur partagé.
  const fiches = [
    { nom: "Rust", couleur: RUST, sku: "COC-RUS", stock: 12 },
    { nom: "Apricot", couleur: APRICOT, sku: "COC-APR", stock: 4 },
    { nom: "Tangerine", couleur: TANGERINE, sku: "COC-TAN", stock: 9 },
  ];

  return (
    <span style={{ display: "block" }}>
      <span style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
        {fiches.map((f, i) => (
          <span key={f.nom} style={{ display: "contents" }}>
            {i > 0 && (
              <span
                aria-hidden="true"
                style={{
                  alignSelf: "center",
                  fontSize: 13,
                  lineHeight: 1,
                  color: "var(--p-color-text-secondary)",
                }}
              >
                ↔
              </span>
            )}
            <span
              style={{
                flex: "1 1 0",
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                borderRadius: 10,
                overflow: "hidden",
                background: "#fff",
                border:
                  i === 0
                    ? "2px solid #303030"
                    : "1px solid var(--p-color-border-secondary)",
              }}
            >
              {/* L'adresse : ce sont bien trois pages, pas trois variantes. Le
                  préfixe /products/ est coupé — identique partout, il mangeait
                  la place et tronquait ce qui distingue les trois. */}
              <span
                style={{
                  display: "block",
                  padding: "4px 6px",
                  fontSize: 9,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: "var(--p-color-text-secondary)",
                  background: "var(--p-color-bg-surface-secondary)",
                  borderBottom: "1px solid var(--p-color-border-secondary)",
                }}
              >
                …/cocotte-{f.nom.toLowerCase()}
              </span>

              <span style={{ padding: 6 }}>
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    height: 52,
                    borderRadius: 6,
                    background: f.couleur,
                  }}
                >
                  <Silhouette tint={TEINTE_SILHOUETTE} />
                </span>

                <span
                  style={{
                    display: "block",
                    marginTop: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Cocotte · {f.nom}
                </span>

                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontSize: 8,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: "var(--p-color-text-secondary)",
                  }}
                >
                  {f.sku} · {f.stock} left
                </span>

                {/* La rangée identique sur les trois pages, détachée sur sa
                    propre bande : c'est elle qui relie, elle ne doit pas se
                    lire comme un détail de la fiche. */}
                <span
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 5,
                    marginTop: 6,
                    padding: "4px 0",
                    borderRadius: 6,
                    background: "var(--p-color-bg-surface-secondary)",
                  }}
                >
                  {fiches.map((autre) => (
                    <span
                      key={autre.nom}
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: "50%",
                        background: autre.couleur,
                        boxShadow:
                          autre.nom === f.nom
                            ? "0 0 0 1.5px #fff, 0 0 0 3px #303030"
                            : "none",
                      }}
                    />
                  ))}
                </span>
              </span>
            </span>
          </span>
        ))}
      </span>

      {/* Le câblage : trois montants qui descendent des rangées de pastilles
          et se rejoignent sur une barre commune. */}
      <span style={{ display: "block", position: "relative", height: 34, marginTop: 2 }}>
        {[16.7, 50, 83.3].map((x) => (
          <span
            key={x}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: 0,
              width: 1.5,
              height: 8,
              background: MARQUE,
            }}
          />
        ))}
        <span
          style={{
            position: "absolute",
            left: "16.7%",
            right: "16.7%",
            top: 7,
            height: 1.5,
            background: MARQUE,
          }}
        />
        <span
          style={{
            position: "absolute",
            insetInline: 0,
            top: 11,
            textAlign: "center",
            fontSize: 9,
            color: "var(--p-color-text-secondary)",
          }}
        >
          one selector · three pages
        <span style={{ display: "block", marginTop: 1 }}>
          each with its own SKU, barcode and stock
        </span>
        </span>
      </span>
    </span>
  );
}


export function SchemaEditeurTheme() {
  const arbre = [
    { texte: "Product information", niveau: 0, actif: false },
    { texte: "Media", niveau: 1, actif: false },
    { texte: "Details", niveau: 1, actif: false },
    { texte: "Add block", niveau: 2, actif: true },
    { texte: "Title", niveau: 2, actif: false },
    { texte: "Price", niveau: 2, actif: false },
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
              background: ligne.actif ? "#FFF1E6" : "transparent",
              border: ligne.actif
                ? "1.5px solid #EA580C"
                : "1.5px solid transparent",
              color: ligne.actif
                ? "#9A3412"
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
            Blocks
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
            Apps
          </span>
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            background: "#FFF1E6",
            border: "1.5px solid #EA580C",
            fontWeight: 600,
          }}
        >
          <span
            style={{
              display: "block",
              width: 18,
              height: 18,
              borderRadius: 4,
              background: DEGRADE_MARQUE,
              flex: "0 0 auto",
            }}
          />
          Variantsy
        </span>
      </span>
    </span>
  );
}

/** Avant / après, côté client — pas côté admin.
 *
 *  Le sélecteur de mode montrait jusqu'ici une capture de l'admin Shopify
 *  (« Products › Variants »), c'est-à-dire un réglage, pas un résultat. Or ce
 *  qu'on vend est visible sur la fiche : une galerie où les coloris se
 *  mélangent, et la même une fois filtrée. La capture d'admin reste utile dans
 *  la notice, où elle enseigne un geste ; ici elle ne racontait rien.
 */
export function SchemaAvantApres() {
  // Le coloris retenu par le client, celui que le filtre conserve.
  const CHOISI = RUST;

  const Zone = ({
    etiquette,
    teinte,
    photos,
    accentue,
  }: {
    etiquette: string;
    teinte: string;
    photos: string[];
    accentue?: boolean;
  }) => (
    <span
      style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "block",
        padding: 8,
        borderRadius: 10,
        background: "#fff",
        // Le cadre délimite les deux situations : sans lui les deux grilles
        // se lisaient comme une seule galerie de dix photos.
        border: accentue
          ? `1.5px solid ${MARQUE}`
          : "1px solid var(--p-color-border-secondary)",
      }}
    >
      <span
        style={{
          display: "block",
          marginBottom: 6,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: ".04em",
          color: teinte,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {etiquette}
      </span>
      <span
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 4,
          // Hauteur commune : sans elle la galerie filtrée, plus courte, ne se
          // comparait plus à l'autre.
          minHeight: 104,
          alignContent: "start",
        }}
      >
        {photos.map((c, i) => (
          <span
            key={i}
            style={{
              display: "grid",
              placeItems: "center",
              height: 48,
              borderRadius: 6,
              background: c,
            }}
          >
            <Silhouette tint={TEINTE_SILHOUETTE} />
          </span>
        ))}
      </span>
    </span>
  );

  return (
    <span style={{ display: "block" }}>
      <span style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        {/* Les coloris se suivent au lieu d'être panachés : c'est l'ordre
            réel d'une galerie Shopify, et le contraste porte alors sur le
            filtrage, pas sur un rangement fantaisiste. */}
        <Zone
          etiquette="WITHOUT VARIANTSY"
          teinte="var(--p-color-text-secondary)"
          photos={[CHOISI, CHOISI, APRICOT, APRICOT, TANGERINE, TANGERINE]}
        />
        <Zone
          etiquette="WITH VARIANTSY"
          teinte={MARQUE}
          photos={[CHOISI, CHOISI, CHOISI, CHOISI]}
          accentue
        />
      </span>

      {/* Le coloris choisi, une seule fois : c'est lui qui explique le filtre. */}
      <span style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 10 }}>
        {[CHOISI, APRICOT, TANGERINE].map((c) => (
          <span
            key={c}
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: c,
              boxShadow:
                c === CHOISI
                  ? "0 0 0 2px #fff, 0 0 0 4px #303030"
                  : "none",
            }}
          />
        ))}
      </span>
    </span>
  );
}
