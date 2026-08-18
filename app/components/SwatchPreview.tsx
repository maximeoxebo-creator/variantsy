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
  { label: "Noir", color: "#1A1A1A", available: true },
  { label: "Bleu marine", color: "#1F3A5F", available: true },
  { label: "Beige", color: "#D8C3A5", available: true },
  { label: "Terracotta", color: "#C1614B", available: false },
  { label: "Blanc", color: "#F5F5F0", available: true },
];

const DEMO_PRODUCT = "Sweat en coton bio";
const DEMO_SIZE = "M";

export function SwatchPreview({ settings }: { settings: PreviewSettings }) {
  const [selected, setSelected] = useState(1);

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
      price: "59,00 €",
      compare_at_price: "79,00 €",
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
      <div style={{ fontSize: 16, color: "#616161", marginBottom: 20 }}>59,00 €</div>

      {settings.showOptionName && (
        <div style={{ fontSize: 13, marginBottom: 10, color: "#4A4A4A" }}>
          Couleur : <strong>{DEMO_VALUES[selected].label}</strong>
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
            width: "100%",
            maxWidth: settings.dropdownFullWidth ? "100%" : 320,
            minHeight: 44,
            padding: "0 44px 0 14px",
            border: `${settings.borderWidth}px solid ${
              settings.controlSelectedStyle === "none"
                ? settings.borderColor
                : settings.selectedColor
            }`,
            borderRadius: settings.controlRadius,
            background:
              settings.controlSelectedStyle === "fill" ? settings.selectedColor : "#fff",
            font: "inherit",
            color:
              settings.controlSelectedStyle === "fill"
                ? contrasteSur(settings.selectedColor)
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
                      ? settings.selectedColor
                      : "#fff",
                  border: isSelected
                    ? `${settings.selectedWidth}px solid ${settings.selectedColor}`
                    : `${settings.borderWidth}px solid ${settings.borderColor}`,
                  color:
                    isSelected && settings.controlSelectedStyle === "fill"
                      ? contrasteSur(settings.selectedColor)
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
                }px ${settings.selectedColor}`
              : isSelected && settings.selectedStyle === "shadow"
                ? `0 2px 8px ${settings.selectedColor}66`
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
                  width: settings.size,
                  height: settings.size,
                  borderRadius: radius,
                  background: value.color,
                  border:
                    isSelected && settings.selectedStyle === "border"
                      ? `${settings.selectedWidth}px solid ${settings.selectedColor}`
                      : `${settings.borderWidth}px solid ${settings.borderColor}`,
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
