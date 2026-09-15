import { Button } from "@shopify/polaris";
import { useRef } from "react";
import type { KeyboardEvent } from "react";

/**
 * Composants de marque de l'admin — la famille d'apps de Zeppelin Studio.
 *
 * Même en-tête et mêmes onglets que LiquidPop et LinguaBar : un marchand qui
 * passe d'une app à l'autre doit reconnaître la maison. Seule la couleur
 * d'accent change, l'orange Soleil de l'icône. Styles : app/styles/brand.css.
 */

/** Interrupteur iOS — le même que dans LiquidPop et LinguaBar. */
export function IosSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`vy-switch-track${checked ? " on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="vy-switch-thumb" />
    </button>
  );
}

export function ProBadge() {
  return <span className="vy-pro">PRO</span>;
}

/**
 * En-tête de l'admin : nom en deux tons, sous-titre, état, interrupteur, plan
 * et Upgrade, puis le bandeau d'aide.
 *
 * Le bouton Upgrade tient aussi l'exigence 1.2.1 de la revue Shopify : la page
 * de tarification doit rester joignable en un clic depuis l'app. Il est
 * affiché quel que soit le plan — « Manage plan » en Pro. Ne pas le retirer.
 */
export function BrandHero({
  plan,
  enabled,
  onToggle,
  upgradeUrl,
  deepLink,
}: {
  plan: "free" | "pro";
  /** Interrupteur maître : éteint, l'extension ne rend rien sur la boutique. */
  enabled: boolean;
  onToggle: (value: boolean) => void;
  upgradeUrl: string;
  /** Ouvre l'éditeur de thème sur la fiche produit ; absent si le thème est inconnu. */
  deepLink?: string | null;
}) {
  const pro = plan === "pro";
  return (
    <div className="vy-top-wrap">
      <header className="vy-top">
        <div>
          <h1 className="vy-top__title">
            Variant<span className="vy-grad">sy</span>
          </h1>
          <p className="vy-top__sub">Color galleries, swatches and dynamic titles for every product</p>
        </div>
        <div className="vy-top__actions">
          <span className="vy-status-pill">
            <span className={`vy-status-dot ${enabled ? "on" : "off"}`} aria-hidden="true" />
            {enabled ? "Selector active" : "Selector inactive"}
          </span>
          <IosSwitch checked={enabled} onChange={onToggle} label="Show Variantsy on my store" />
          <span className={`vy-plan-pill${pro ? " pro" : ""}`}>{pro ? "Pro" : "Free"}</span>
          <Button url={upgradeUrl} target="_top" variant={pro ? "secondary" : "primary"}>
            {pro ? "Manage plan" : "Upgrade"}
          </Button>
        </div>
      </header>

      <div className="vy-info">
        <span aria-hidden="true">💡</span>
        <span>
          To display Variantsy: <strong>Online Store → Themes → Customize</strong>, then add the{" "}
          <strong>"Variantsy"</strong> app block to your product page
          {deepLink && (
            <>
              {" "}— or <a href={deepLink} target="_top">open it for me</a>
            </>
          )}
          . Don't forget to <strong>Save</strong> here after each change.
        </span>
      </div>
    </div>
  );
}

/**
 * Onglets dans le style de la commande segmentée de LiquidPop.
 *
 * Contrairement à LinguaBar, la liste est passée en paramètre : chez Variantsy
 * les onglets changent avec le mode (variantes ou produits liés). Motif ARIA
 * « tabs » : flèches gauche/droite, Début et Fin, un seul onglet atteignable à
 * la tabulation.
 */
export function AdminTabs<T extends string>({
  onglets,
  value,
  onChange,
  label,
}: {
  onglets: ReadonlyArray<{ id: T; content: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const boutons = useRef<Array<HTMLButtonElement | null>>([]);

  const auClavier = (event: KeyboardEvent<HTMLDivElement>) => {
    const courant = onglets.findIndex((o) => o.id === value);
    const dernier = onglets.length - 1;
    const cible =
      event.key === "ArrowRight" ? (courant === dernier ? 0 : courant + 1)
      : event.key === "ArrowLeft" ? (courant <= 0 ? dernier : courant - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? dernier
      : null;
    if (cible === null) return;
    event.preventDefault();
    onChange(onglets[cible].id);
    boutons.current[cible]?.focus();
  };

  return (
    <div className="vy-seg" role="tablist" aria-label={label} onKeyDown={auClavier}>
      {onglets.map((onglet, i) => {
        const actif = onglet.id === value;
        return (
          <button
            key={onglet.id}
            ref={(el) => {
              boutons.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`vy-tab-${onglet.id}`}
            aria-selected={actif}
            aria-controls={`vy-panel-${onglet.id}`}
            tabIndex={actif ? 0 : -1}
            className={actif ? "active" : ""}
            onClick={() => onChange(onglet.id)}
          >
            {onglet.content}
          </button>
        );
      })}
    </div>
  );
}
