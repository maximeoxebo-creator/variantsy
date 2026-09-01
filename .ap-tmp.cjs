// ../../../../private/tmp/claude-501/-Users-maxime-Documents-la-fonderie-v2/8e7705b1-69d3-44d5-a1b9-b1ab8ae73462/scratchpad/apercu.tsx
var import_server = require("react-dom/server");

// app/components/SwatchPreview.tsx
var import_react = require("react");

// app/shared.ts
function normalize(input) {
  return String(input || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function lookup(vars, rawKey) {
  const key = rawKey.trim();
  if (vars[key] !== void 0)
    return vars[key];
  const lower = normalize(key);
  if (vars[lower] !== void 0)
    return vars[lower];
  const match = /^option\s*:\s*(.+)$/i.exec(key);
  if (match) {
    const candidate = "option:" + normalize(match[1]);
    if (vars[candidate] !== void 0)
      return vars[candidate];
  }
  return "";
}
function renderTemplate(template, vars) {
  let out = String(template || "").replace(/\[\[([\s\S]*?)\]\]/g, (_, inner) => {
    const keys = inner.match(/\{\{\s*[^}]+?\s*\}\}/g) || [];
    const empty = keys.some((token) => {
      const name = token.replace(/^\{\{\s*|\s*\}\}$/g, "");
      return !lookup(vars, name);
    });
    return empty ? "" : inner;
  });
  out = out.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => lookup(vars, key));
  return out.replace(/\s+/g, " ").replace(/([–—\-/|,])\s*(?=[–—\-/|,])/g, "").replace(/^[\s–—\-/|,]+/, "").replace(/[\s–—\-/|,]+$/, "").trim();
}

// app/components/SwatchPreview.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function contrasteSur(couleur) {
  let hex = String(couleur || "#111111").trim();
  const court = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (court)
    hex = `#${court[1]}${court[1]}${court[2]}${court[2]}${court[3]}${court[3]}`;
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m)
    return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = n >> 16 & 255;
  const v = n >> 8 & 255;
  const b = n & 255;
  return (r * 299 + v * 587 + b * 114) / 1e3 > 150 ? "#111111" : "#ffffff";
}
var DEMO_VALUES = [
  { label: "Black", color: "#1A1A1A", available: true },
  { label: "Navy", color: "#1F3A5F", available: true },
  { label: "Beige", color: "#D8C3A5", available: true },
  { label: "Terracotta", color: "#C1614B", available: false },
  { label: "White", color: "#F5F5F0", available: true }
];
var DEMO_PRODUCT = "Organic cotton sweatshirt";
var DEMO_SIZE = "M";
function SwatchPreview({ settings }) {
  const [selected, setSelected] = (0, import_react.useState)(1);
  const estAuto = (v) => !v || v.trim().toLowerCase() === "auto";
  const couleurSelection = estAuto(settings.selectedColor) ? "#111111" : settings.selectedColor;
  const couleurBordure = estAuto(settings.borderColor) ? "rgba(0, 0, 0, 0.22)" : settings.borderColor;
  const radius = settings.shape === "circle" ? "50%" : settings.shape === "rounded" ? `${settings.cornerRadius}px` : "0px";
  const title = (0, import_react.useMemo)(() => {
    if (!settings.updateTitle)
      return DEMO_PRODUCT;
    const value = DEMO_VALUES[selected];
    return renderTemplate(settings.titleTemplate, {
      product_title: DEMO_PRODUCT,
      variant_title: `${value.label} / ${DEMO_SIZE}`,
      option1: value.label,
      option2: DEMO_SIZE,
      option3: "",
      price: "$59.00",
      compare_at_price: "$79.00",
      sku: "SWT-001"
    });
  }, [selected, settings.titleTemplate, settings.updateTitle]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      style: {
        background: "#fff",
        border: "1px solid #E3E3E3",
        borderRadius: 12,
        padding: 20,
        fontFamily: "Inter, system-ui, sans-serif"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            style: {
              fontSize: 20,
              fontWeight: 600,
              lineHeight: 1.35,
              marginBottom: 4,
              minHeight: 28,
              color: "#1A1A1A"
            },
            children: title
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 16, color: "#616161", marginBottom: 20 }, children: "$59.00" }),
        settings.showOptionName && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 13, marginBottom: 10, color: "#4A4A4A" }, children: [
          "Color: ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: DEMO_VALUES[selected].label })
        ] }),
        settings.displayMode === "dropdown" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "select",
          {
            value: DEMO_VALUES[selected].label,
            onChange: (event) => setSelected(DEMO_VALUES.findIndex((v) => v.label === event.target.value)),
            style: {
              display: "block",
              width: settings.dropdownFullWidth ? "100%" : "auto",
              minWidth: 140,
              maxWidth: "100%",
              minHeight: 44,
              padding: "0 44px 0 14px",
              border: `${Math.max(1, settings.borderWidth)}px solid ${settings.controlSelectedStyle === "none" ? couleurBordure : couleurSelection}`,
              borderRadius: settings.controlRadius,
              background: settings.controlSelectedStyle === "fill" ? couleurSelection : "#fff",
              font: "inherit",
              color: settings.controlSelectedStyle === "fill" ? contrasteSur(couleurSelection) : "#1A1A1A",
              cursor: "pointer",
              // La flèche native du navigateur se place où elle veut : l'aperçu
              // montrait donc un espacement différent du storefront. On dessine
              // la même que variantsy.css, aux mêmes coordonnées.
              WebkitAppearance: "none",
              appearance: "none",
              backgroundImage: "linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)",
              backgroundPosition: "calc(100% - 22px) center, calc(100% - 17px) center",
              backgroundSize: "5px 5px, 5px 5px",
              backgroundRepeat: "no-repeat"
            },
            children: DEMO_VALUES.filter((v) => v.available || settings.soldOutStyle !== "hide").map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: v.label, children: v.available ? v.label : `${v.label} \u2014 indisponible` }, v.label))
          }
        ) : settings.displayMode === "text" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: settings.gap }, children: DEMO_VALUES.map((value, index) => {
          if (!value.available && settings.soldOutStyle === "hide")
            return null;
          const isSelected = index === selected;
          return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              onClick: () => setSelected(index),
              "aria-pressed": isSelected,
              style: {
                minWidth: 44,
                minHeight: 44,
                padding: "0 14px",
                borderRadius: settings.controlRadius,
                background: isSelected && settings.controlSelectedStyle === "fill" ? couleurSelection : "#fff",
                // « Aucun » doit vraiment n'appliquer aucun accent : la case
                // choisie garde la bordure des autres.
                border: isSelected && settings.controlSelectedStyle !== "none" ? `${settings.selectedWidth}px solid ${couleurSelection}` : `${settings.borderWidth}px solid ${couleurBordure}`,
                color: isSelected && settings.controlSelectedStyle === "fill" ? contrasteSur(couleurSelection) : value.available ? "#1A1A1A" : "#9A9A9A",
                textDecoration: value.available ? "none" : "line-through",
                opacity: !value.available && settings.soldOutStyle === "dim" ? 0.45 : 1,
                font: "inherit",
                fontSize: 15,
                cursor: "pointer",
                // PIÈGE N°5 : reset du chrome natif.
                WebkitAppearance: "none",
                appearance: "none",
                outline: "none",
                WebkitTapHighlightColor: "transparent"
              },
              children: value.label
            },
            value.label
          );
        }) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexWrap: "wrap", gap: settings.gap }, children: DEMO_VALUES.map((value, index) => {
          if (!value.available && settings.soldOutStyle === "hide")
            return null;
          const isSelected = index === selected;
          const unavailable = !value.available;
          const ring = isSelected && settings.selectedStyle === "ring" ? `0 0 0 ${settings.selectedGap}px #fff, 0 0 0 ${settings.selectedGap + settings.selectedWidth}px ${couleurSelection}` : isSelected && settings.selectedStyle === "shadow" ? `0 2px 8px ${couleurSelection}66` : "none";
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: () => setSelected(index),
                    "aria-pressed": isSelected,
                    "aria-label": value.label,
                    style: {
                      // L'aperçu doit refléter l'agrandissement des photos : en
                      // mode « photo du produit », les pastilles sont plus grandes
                      // sur la boutique qu'ici sans cet ajustement.
                      width: settings.swatchFallback === "image" ? Math.round(settings.size * settings.photoScale / 100) : settings.size,
                      height: settings.swatchFallback === "image" ? Math.round(settings.size * settings.photoScale / 100) : settings.size,
                      borderRadius: radius,
                      background: value.color,
                      border: isSelected && settings.selectedStyle === "border" ? `${settings.selectedWidth}px solid ${couleurSelection}` : (
                        // En mode anneau, la bordure neutre de la pastille
                        // choisie s'efface : sinon elle dessine un SECOND
                        // contour collé à l'anneau. `transparent` et non `0`,
                        // pour que la pastille ne change pas de taille quand on
                        // la choisit. Même règle que variantsy.css — l'aperçu
                        // ne vaut que s'il montre ce que verra le client.
                        `${settings.borderWidth}px solid ${isSelected && settings.selectedStyle === "ring" ? "transparent" : couleurBordure}`
                      ),
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
                      WebkitTapHighlightColor: "transparent"
                    },
                    children: unavailable && settings.soldOutStyle === "strikethrough" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "span",
                      {
                        style: {
                          position: "absolute",
                          inset: 0,
                          display: "block",
                          background: "linear-gradient(to top left, transparent calc(50% - 1px), rgba(150,150,150,.9) 50%, transparent calc(50% + 1px))",
                          borderRadius: radius
                        }
                      }
                    )
                  }
                ),
                settings.showLabels && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, color: "#616161", maxWidth: 64, textAlign: "center" }, children: value.label })
              ]
            },
            value.label
          );
        }) })
      ]
    }
  );
}

// ../../../../private/tmp/claude-501/-Users-maxime-Documents-la-fonderie-v2/8e7705b1-69d3-44d5-a1b9-b1ab8ae73462/scratchpad/apercu.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var base = {
  shape: "circle",
  size: 40,
  gap: 10,
  borderWidth: 1,
  borderColor: "auto",
  selectedStyle: "ring",
  selectedColor: "auto",
  selectedWidth: 2,
  selectedGap: 2,
  cornerRadius: 8,
  displayMode: "swatch",
  controlRadius: 6,
  controlSelectedStyle: "outline",
  dropdownFullWidth: false,
  swatchFallback: "color",
  photoScale: 100,
  neutralColor: "#ECECEC",
  showLabels: false,
  showOptionName: true,
  maxVisible: 0,
  soldOutStyle: "strikethrough",
  updateTitle: true,
  titleTemplate: "{{product_title}} \u2014 {{variant_title}}"
};
var html = (0, import_server.renderToStaticMarkup)(
  /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "grid", gap: 20, padding: 24, background: "#F1F1F1", fontFamily: "Inter, sans-serif" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { background: "#fff", borderRadius: 12, padding: 18 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 12, opacity: 0.6, marginBottom: 10 }, children: "couleurs sur \xAB auto \xBB" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SwatchPreview, { settings: base })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { background: "#fff", borderRadius: 12, padding: 18 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { fontSize: 12, opacity: 0.6, marginBottom: 10 }, children: "couleurs explicites" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SwatchPreview, { settings: { ...base, borderColor: "#D9D9D9", selectedColor: "#C0392B" } })
    ] })
  ] })
);
process.stdout.write(`<!doctype html><meta charset="utf-8"><style>body{margin:0;font-family:Inter,system-ui,sans-serif}</style>${html}`);
