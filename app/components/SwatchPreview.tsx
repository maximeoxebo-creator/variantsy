import { useMemo, useState } from "react";
import { renderTemplate } from "../shared";

export type PreviewSettings = {
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
  swatchFallback: string;
  photoScale: number;
  dropdownFullWidth: boolean;
  showLabels: boolean;
  showOptionName: boolean;
  soldOutStyle: string;
  updateTitle: boolean;
  titleTemplate: string;
};

/**
 * Noir ou blanc, selon ce qui se lit le mieux sur la couleur donnée.
 * Miroir de `contrasteSur()` dans variantsy.js : un aperçu qui montrerait un
 * autre contraste que le storefront mentirait au marchand.
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

type PreviewValue = { label: string; color: string; available: boolean };

const DEMO_VALUES: PreviewValue[] = [
  { label: "Black", color: "#1A1A1A", available: true },
  { label: "Navy", color: "#1F3A5F", available: true },
  { label: "Beige", color: "#D8C3A5", available: true },
  { label: "Terracotta", color: "#C1614B", available: false },
  { label: "White", color: "#F5F5F0", available: true },
];

const DEMO_PRODUCT = "Organic cotton sweatshirt";
const DEMO_SIZE = "M";

export function SwatchPreview({ settings }: { settings: PreviewSettings }) {
  const [selected, setSelected] = useState(1);

  // « auto » est une consigne pour le storefront, où la feuille de style dérive
  // la teinte de currentColor. Ce n'est PAS une couleur CSS : passée telle
  // quelle, elle produisait des déclarations invalides et l'aperçu perdait son
  // anneau de sélection comme ses bordures — le marchand ne voyait plus quelle
  // pastille était choisie. L'aperçu simule une boutique claire, le cas de très
  // loin le plus courant, et montre donc ce que « auto » y donne.
  const estAuto = (v: string) => !v || v.trim().toLowerCase() === "auto";
  const couleurSelection = estAuto(settings.selectedColor) ? "#111111" : settings.selectedColor;
  const couleurBordure = estAuto(settings.borderColor)
    ? "rgba(0, 0, 0, 0.22)"
    : settings.borderColor;

  // Doit rester aligné sur le calcul de --vtsy-radius dans variantsy.js :
  // un aperçu qui ment au marchand est pire que pas d'aperçu du tout.
  const radius =
    settings.shape === "circle"
      ? "50%"
      : settings.shape === "rounded"
        ? `${settings.cornerRadius}px`
        : "0px";

  const title = useMemo(() => {
    if (!settings.updateTitle) return DEMO_PRODUCT;
    const value = DEMO_VALUES[selected];
    return renderTemplate(settings.titleTemplate, {
      product_title: DEMO_PRODUCT,
      variant_title: `${value.label} / ${DEMO_SIZE}`,
      option1: value.label,
      option2: DEMO_SIZE,
      option3: "",
      price: "$59.00",
      compare_at_price: "$79.00",
      sku: "SWT-001",
    });
  }, [selected, settings.titleTemplate, settings.updateTitle]);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E3E3E3",
        borderRadius: 12,
        padding: 20,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          lineHeight: 1.35,
          marginBottom: 4,
          minHeight: 28,
          color: "#1A1A1A",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 16, color: "#616161", marginBottom: 20 }}>$59.00</div>

      {settings.showOptionName && (
        <div style={{ fontSize: 13, marginBottom: 10, color: "#4A4A4A" }}>
          Color: <strong>{DEMO_VALUES[selected].label}</strong>
        </div>
      )}

      {/* Le mode d'affichage doit se refléter ici, sinon l'aperçu montre des
          pastilles à un marchand qui vient de choisir une liste déroulante —
          et un aperçu qui ment est pire que pas d'aperçu du tout. */}
      {settings.displayMode === "dropdown" ? (
        <select
          value={DEMO_VALUES[selected].label}
          onChange={(event) =>
            setSelected(DEMO_VALUES.findIndex((v) => v.label === event.target.value))
          }
          style={{
            display: "block",
            width: settings.dropdownFullWidth ? "100%" : "auto",
            minWidth: 140,
            maxWidth: "100%",
            minHeight: 44,
            padding: "0 44px 0 14px",
            border: `${Math.max(1, settings.borderWidth)}px solid ${
              settings.controlSelectedStyle === "none"
                ? couleurBordure
                : couleurSelection
            }`,
            borderRadius: settings.controlRadius,
            background:
              settings.controlSelectedStyle === "fill" ? couleurSelection : "#fff",
            font: "inherit",
            color:
              settings.controlSelectedStyle === "fill"
                ? contrasteSur(couleurSelection)
                : "#1A1A1A",
            cursor: "pointer",
            // La flèche native du navigateur se place où elle veut : l'aperçu
            // montrait donc un espacement différent du storefront. On dessine
            // la même que variantsy.css, aux mêmes coordonnées.
            WebkitAppearance: "none",
            appearance: "none",
            backgroundImage:
              "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
            backgroundPosition: "calc(100% - 22px) center, calc(100% - 17px) center",
            backgroundSize: "5px 5px, 5px 5px",
            backgroundRepeat: "no-repeat",
          }}
        >
          {DEMO_VALUES.filter((v) => v.available || settings.soldOutStyle !== "hide").map((v) => (
            <option key={v.label} value={v.label}>
              {v.available ? v.label : `${v.label} — indisponible`}
            </option>
          ))}
        </select>
      ) : settings.displayMode === "text" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: settings.gap }}>
          {DEMO_VALUES.map((value, index) => {
            if (!value.available && settings.soldOutStyle === "hide") return null;
            const isSelected = index === selected;
            return (
              <button
                key={value.label}
                type="button"
                onClick={() => setSelected(index)}
                aria-pressed={isSelected}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  padding: "0 14px",
                  borderRadius: settings.controlRadius,
                  background:
                    isSelected && settings.controlSelectedStyle === "fill"
                      ? couleurSelection
                      : "#fff",
                  // « Aucun » doit vraiment n'appliquer aucun accent : la case
                  // choisie garde la bordure des autres.
                  border:
                    isSelected && settings.controlSelectedStyle !== "none"
                      ? `${settings.selectedWidth}px solid ${couleurSelection}`
                      : `${settings.borderWidth}px solid ${couleurBordure}`,
                  color:
                    isSelected && settings.controlSelectedStyle === "fill"
                      ? contrasteSur(couleurSelection)
                      : value.available
                        ? "#1A1A1A"
                        : "#9A9A9A",
                  textDecoration: value.available ? "none" : "line-through",
                  opacity: !value.available && settings.soldOutStyle === "dim" ? 0.45 : 1,
                  font: "inherit",
                  fontSize: 15,
                  cursor: "pointer",
                  // PIÈGE N°5 : reset du chrome natif.
                  WebkitAppearance: "none",
                  appearance: "none",
                  outline: "none",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {value.label}
              </button>
            );
          })}
        </div>
      ) : (
      <div style={{ display: "flex", flexWrap: "wrap", gap: settings.gap }}>
        {DEMO_VALUES.map((value, index) => {
          if (!value.available && settings.soldOutStyle === "hide") return null;
          const isSelected = index === selected;
          const unavailable = !value.available;

          // Même formule que la règle [data-selected-style="ring"] de
          // variantsy.css : l'écart d'abord en blanc, puis le trait par-dessus.
          const ring =
            isSelected && settings.selectedStyle === "ring"
              ? `0 0 0 ${settings.selectedGap}px #fff, 0 0 0 ${
                  settings.selectedGap + settings.selectedWidth
                }px ${couleurSelection}`
              : isSelected && settings.selectedStyle === "shadow"
                ? `0 2px 8px ${couleurSelection}66`
                : "none";

          return (
            <div
              key={value.label}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
            >
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-pressed={isSelected}
                aria-label={value.label}
                style={{
                  // L'aperçu doit refléter l'agrandissement des photos : en
                  // mode « photo du produit », les pastilles sont plus grandes
                  // sur la boutique qu'ici sans cet ajustement.
                  width:
                    settings.swatchFallback === "image"
                      ? Math.round((settings.size * settings.photoScale) / 100)
                      : settings.size,
                  height:
                    settings.swatchFallback === "image"
                      ? Math.round((settings.size * settings.photoScale) / 100)
                      : settings.size,
                  borderRadius: radius,
                  background: value.color,
                  border:
                    isSelected && settings.selectedStyle === "border"
                      ? `${settings.selectedWidth}px solid ${couleurSelection}`
                      : // En mode anneau, la bordure neutre de la pastille
                        // choisie s'efface : sinon elle dessine un SECOND
                        // contour collé à l'anneau. `transparent` et non `0`,
                        // pour que la pastille ne change pas de taille quand on
                        // la choisit. Même règle que variantsy.css — l'aperçu
                        // ne vaut que s'il montre ce que verra le client.
                        `${settings.borderWidth}px solid ${
                          isSelected && settings.selectedStyle === "ring"
                            ? "transparent"
                            : couleurBordure
                        }`,
                  boxShadow: ring,
                  cursor: "pointer",
                  padding: 0,
                  position: "relative",
                  opacity: unavailable && settings.soldOutStyle === "dim" ? 0.35 : 1,
                  transition: "box-shadow 120ms ease, transform 120ms ease",
                  // PIÈGE N°5 : reset du chrome natif dès la première version.
                  WebkitAppearance: "none",
                  appearance: "none",
                  outline: "none",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {unavailable && settings.soldOutStyle === "strikethrough" && (
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "block",
                      background:
                        "linear-gradient(to top left, transparent calc(50% - 1px), rgba(150,150,150,.9) 50%, transparent calc(50% + 1px))",
                      borderRadius: radius,
                    }}
                  />
                )}
              </button>
              {settings.showLabels && (
                <span style={{ fontSize: 11, color: "#616161", maxWidth: 64, textAlign: "center" }}>
                  {value.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
