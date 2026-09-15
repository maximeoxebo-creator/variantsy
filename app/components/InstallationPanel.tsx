import { Button, Card } from "@shopify/polaris";
import { Link } from "@remix-run/react";
import type { ReactNode } from "react";
import {
  BEIGE,
  BLUE,
  FicheMiniature,
  SchemaAssignation,
  SchemaAvantApres,
  SchemaEditeurTheme,
  SchemaGroupe,
  SchemaOptions,
  SchemaRetraitOption,
  Vignette,
} from "./schemas";

/* ==========================================================================
   Guide d'installation

   Même guide que LinguaBar, pour garder l'unité de la famille d'apps : une
   frise « comment ça marche » en trois temps, puis des étapes sur un rail
   numéroté. Chaque étape montre où cliquer et ce qu'on doit voir, par un
   schéma plutôt que par une phrase — un marchand ne lit pas « ouvrez l'onglet
   Apps », il cherche à quoi l'écran ressemble.

   Le guide suit le mode choisi en tête de page : les deux modèles de catalogue
   ne s'installent pas de la même façon, et montrer les étapes de l'autre ne
   ferait qu'égarer.

   Variantsy ne sait lire ni le thème ni les médias des variantes : chaque étape
   porte donc « Check once », jamais une coche qu'on ne peut pas garantir.
   ========================================================================== */

const ARGILE = "#C0715A";

type OngletCible = "apparence" | "groupes";

function Fleche() {
  return (
    <svg className="vy-how__arrow" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M4 10h11m-4-4 4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Etape({ n, titre, children }: { n: number; titre: string; children: ReactNode }) {
  return (
    <li className="vy-stepitem">
      <div className="vy-stepitem__rail">
        <span className="vy-step" aria-hidden="true">
          {n}
        </span>
      </div>
      <div className="vy-stepitem__body">
        <div className="vy-stepitem__head">
          <h3 className="vy-stepitem__title">
            <span className="vy-sr">Step {n}: </span>
            {titre}
          </h3>
          <span className="vy-status">Check once</span>
        </div>
        {children}
      </div>
    </li>
  );
}

/** Le chemin de clics, écran par écran. */
function Chemin({ etapes }: { etapes: string[] }) {
  return (
    <ol className="vy-path" aria-label="Where to click">
      {etapes.map((etape) => (
        <li key={etape}>
          <span className="vy-path__crumb">{etape}</span>
        </li>
      ))}
    </ol>
  );
}

function Figure({ legende, children }: { legende?: ReactNode; children: ReactNode }) {
  return (
    <div className="vy-figure">
      {children}
      {legende && <p className="vy-figure__cap">{legende}</p>}
    </div>
  );
}

/** Trois pastilles, la première choisie : le sélecteur, en miniature. */
function MiniPastilles({ choisie = 0 }: { choisie?: number }) {
  return (
    <span className="vy-mini-dots" aria-hidden="true">
      {[BLUE, BEIGE, ARGILE].map((c, i) => (
        <i key={c} className={i === choisie ? "on" : ""} style={{ background: c }} />
      ))}
    </span>
  );
}

export function InstallationPanel({
  themeName,
  deepLink,
  mode,
  pro = false,
  onGoTo,
}: {
  themeName: string | null;
  deepLink: string | null;
  mode: "variants" | "linked";
  /** Le filtrage de la galerie est payant : en gratuit, l'étape de vérification le dit. */
  pro?: boolean;
  /** Ouvre un onglet de la page ; absent, les liens d'onglet disparaissent. */
  onGoTo?: (onglet: OngletCible) => void;
}) {
  const lie = mode === "linked";

  return (
    <Card>
      <div className="vy-guide">
        <div className="vy-guide__head">
          <h2>{lie ? "Set up linked products" : "Set up Variantsy"}</h2>
          <p>
            Four steps from install to a product page where{" "}
            {lie ? "every color page shares one selector" : "each color shows only its own photos"}.
            Variantsy can&rsquo;t read your theme or your product media, so check each step once.
          </p>
        </div>

        {/* Les trois temps : c'est la confusion entre eux qui bloque les marchands. */}
        {lie ? (
          <div className="vy-how">
            <div className="vy-how__card">
              <span className="vy-how__label">Shopify</span>
              <span className="vy-how__visual" aria-hidden="true">
                <span className="vy-mini-url">…/tee-blue</span>
                <span className="vy-mini-url">…/tee-beige</span>
              </span>
              <span className="vy-how__title">1. One page per color</span>
              <span className="vy-how__text">Each with its own URL, SKU and stock.</span>
            </div>
            <Fleche />
            <div className="vy-how__card">
              <span className="vy-how__label">Variantsy</span>
              <span className="vy-how__visual" aria-hidden="true">
                <MiniPastilles />
              </span>
              <span className="vy-how__title">2. Group the pages</span>
              <span className="vy-how__text">Name the color each page stands for.</span>
            </div>
            <Fleche />
            <div className="vy-how__card">
              <span className="vy-how__label">Your store</span>
              <span className="vy-how__visual" aria-hidden="true">
                <MiniPastilles choisie={1} />
              </span>
              <span className="vy-how__title">3. One selector everywhere</span>
              <span className="vy-how__text">A click opens the right page.</span>
            </div>
          </div>
        ) : (
          <div className="vy-how">
            <div className="vy-how__card">
              <span className="vy-how__label">Shopify</span>
              <span className="vy-how__visual" aria-hidden="true">
                <Vignette color={BLUE} pinned legende="Blue" />
                <Vignette color={BEIGE} pinned legende="Beige" />
              </span>
              <span className="vy-how__title">1. One photo per color</span>
              <span className="vy-how__text">The first photo of each color goes on its variant.</span>
            </div>
            <Fleche />
            <div className="vy-how__card">
              <span className="vy-how__label">Your theme</span>
              <span className="vy-how__visual" aria-hidden="true">
                <span className="vy-mini-block">
                  <i />
                  Variantsy
                </span>
              </span>
              <span className="vy-how__title">2. Add the block</span>
              <span className="vy-how__text">Once, on your product template.</span>
            </div>
            <Fleche />
            <div className="vy-how__card">
              <span className="vy-how__label">Your store</span>
              <span className="vy-how__visual" aria-hidden="true">
                <MiniPastilles />
              </span>
              <span className="vy-how__title">3. Shoppers pick a color</span>
              <span className="vy-how__text">The gallery keeps only that color&rsquo;s photos.</span>
            </div>
          </div>
        )}
        <p className="vy-how__note">
          {lie
            ? "You need all three. Pages that are not grouped show no selector; a block that is not added shows nothing at all."
            : "You need all three. Without a photo per color, Variantsy cannot tell which photos belong together; without the block, it shows nothing."}
        </p>

        <ol className="vy-steps">
          <Etape n={1} titre="Add the Variantsy block to your product page">
            <p className="vy-text">
              Variantsy is an app block. Add it once to your product template
              {themeName ? <>, in <strong>{themeName}</strong></> : ""}, just above the add-to-cart
              button.
            </p>
            <Chemin
              etapes={["Online Store", "Themes", "Customize", "Product", "Add block", "Apps", "Variantsy", "Save"]}
            />
            <Figure
              legende={
                <>
                  The <strong>Apps</strong> tab is not the one shown by default — that is where
                  almost everyone gets stuck.
                </>
              }
            >
              <SchemaEditeurTheme />
            </Figure>
            {deepLink && (
              <div className="vy-actions">
                <Button variant="primary" url={deepLink} target="_blank">
                  Open the theme editor
                </Button>
                <span className="vy-text">Opens your product template. Add the block, then Save.</span>
              </div>
            )}
          </Etape>

          {lie ? (
            <>
              <Etape n={2} titre="Group the pages of one product">
                <p className="vy-text">
                  Pick the product pages that are the same item in different colors, and name the
                  color each one stands for. Every page of the group then shows the whole range.
                </p>
                {/* Sans légende : le schéma porte déjà la sienne, et la répéter
                    dessous la faisait se chevaucher. */}
                <Figure>
                  <SchemaGroupe />
                </Figure>
                {onGoTo && (
                  <button type="button" className="vy-link" onClick={() => onGoTo("groupes")}>
                    Go to Groups →
                  </button>
                )}
              </Etape>

              <Etape n={3} titre="Remove the color option from those pages">
                <p className="vy-text">
                  A page that still carries a Color option would show the same value twice, so
                  Variantsy ignores its group until the option is gone. Options about something
                  else — a size next to a color group — are fine and stay.
                </p>
                <Chemin
                  etapes={["Products", "Each color page", "Variants", "Color option", "Delete", "Save"]}
                />
                <Figure>
                  <SchemaRetraitOption />
                </Figure>
              </Etape>
            </>
          ) : (
            <>
              <Etape n={2} titre="Give each color its shade">
                <p className="vy-text">
                  Variantsy reads the shade you set on each option value straight from Shopify —
                  even an in-house color no dictionary knows.
                </p>
                <Figure legende="Set once per value; every product that uses it follows.">
                  <SchemaOptions />
                </Figure>
                <details className="vy-more">
                  <summary>A shade Variantsy can&rsquo;t read?</summary>
                  <ul className="vy-fixes">
                    <li>
                      <strong>No access to option swatches?</strong> Name a file after the value in
                      Content › Files, or set the color in the{" "}
                      <Link className="vy-link" to="/app/swatches">
                        Color library
                      </Link>
                      .
                    </li>
                    <li>
                      <strong>Nothing set at all?</strong> Variantsy guesses the color from the
                      value&rsquo;s name — « Navy blue » becomes navy.
                    </li>
                  </ul>
                </details>
              </Etape>

              <Etape n={3} titre="Attach one photo per color">
                <p className="vy-text">
                  Attach the first photo of each color to its variant, and place that color&rsquo;s
                  other photos right after it. This is the one step Variantsy cannot do for you.
                </p>
                <Chemin
                  etapes={["Products", "Your product", "Variants", "Blue", "Add image", "First Blue photo", "Save"]}
                />
                <div className="vy-figures">
                  <Figure legende="Attach a photo to each variant.">
                    <SchemaAssignation />
                  </Figure>
                  <Figure
                    legende={
                      <>
                        <strong>★ = the photo you attached.</strong> Every photo after it joins
                        that color, up to the next ★.
                      </>
                    }
                  >
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      <Vignette color={BLUE} pinned legende="Blue" />
                      <Vignette color={BLUE} legende="Blue" />
                      <Vignette color={BLUE} legende="Blue" />
                      <Vignette color={BEIGE} pinned legende="Beige" />
                      <Vignette color={BEIGE} legende="Beige" />
                    </span>
                  </Figure>
                </div>
              </Etape>
            </>
          )}

          <Etape n={4} titre="Check your product page">
            {!lie && (
              <Figure legende="Without Variantsy, every color mixes in the gallery. With it, only the chosen one stays.">
                <SchemaAvantApres />
              </Figure>
            )}
            <div className="vy-figures">
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
            </div>
            {!lie && !pro && (
              <p className="vy-alert">
                Filtering the gallery by color is on the <strong>Pro</strong> plan. On the free
                plan the swatches and the title work, and the main image follows the color — but
                every photo stays in the gallery.
              </p>
            )}
            <details className="vy-more">
              <summary>Something missing?</summary>
              <ul className="vy-fixes">
                {lie ? (
                  <>
                    <li>
                      <strong>No selector on the page?</strong> The page must belong to a group
                      (step 2) and the block be added (step 1).
                    </li>
                    <li>
                      <strong>A color shows twice?</strong> The page still carries its Color option
                      (step 3).
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <strong>Every photo still shows?</strong> Each color needs one attached photo
                      (step 3)
                      {!pro ? ", and filtering is on the Pro plan" : ""}.
                    </li>
                    <li>
                      <strong>Your theme&rsquo;s own selector still shows?</strong> Variantsy detects
                      most themes. For a heavily customized one, enter its CSS selector under{" "}
                      {onGoTo ? (
                        <button type="button" className="vy-link" onClick={() => onGoTo("apparence")}>
                          Appearance › Advanced settings
                        </button>
                      ) : (
                        "Appearance › Advanced settings"
                      )}
                      . It is hidden, never removed: the cart always receives the right variant.
                    </li>
                  </>
                )}
                <li>
                  <strong>A saved change doesn&rsquo;t show yet?</strong> Settings are cached for a
                  few minutes so shoppers never wait. Reload the product page once or twice.
                </li>
              </ul>
            </details>
          </Etape>
        </ol>
      </div>
    </Card>
  );
}
