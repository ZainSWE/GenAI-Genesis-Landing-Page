/* GenAI Genesis — design system v1.3 → Figma
 * ------------------------------------------------------------------
 * A local development plugin that brings the Figma file in line with
 * design/DESIGN-SYSTEM.md v1.3 and design/system/ds.css:
 *   • new colour variables (status, muted, teal, lilac-ink, wells, overlay) in Color + Color Dark
 *   • new text styles (Heading/Page, Body/Caption, Label/Overline, Code/Inline) and effect styles
 *   • Read me page: cover, site vocabulary, guardrails, how to build a page, templates
 *   • Foundations page: a "v1.3 additions" board
 *   • Components page: the extended library (forms, status, overlays, navigation, content, data)
 *     and the skyline illustrations
 * Safe to run again: everything it made last time (tagged with plugin data) is removed first,
 * and variables / styles are updated in place rather than duplicated.
 * Works on the Starter plan: no new pages, one mode per collection.
 */

const SVG = __SVGS__;   // injected by build.js (baked skyline SVGs)
const TAG = "gag-ds-v13";
const log = [];
const note = (m) => { log.push(m); };

/* ------------------------------------------------------------------ colour utils */
function hex(h, a = 1) {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, a };
}
function rgba(r, g, b, a = 1) { return { r: r / 255, g: g / 255, b: b / 255, a }; }
const solid = (c) => ({ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a == null ? 1 : c.a });
// angle: "h" left→right, "v" top→bottom, "d" top-left→bottom-right
function grad(stops, angle = "h") {
  const T = { h: [[1, 0, 0], [0, 1, 0]], v: [[0, 1, 0], [-1, 0, 1]], d: [[0.5, 0.5, 0], [-0.5, 0.5, 0.5]] }[angle];
  return { type: "GRADIENT_LINEAR", gradientTransform: T, gradientStops: stops.map((c, i) => ({ position: i / (stops.length - 1), color: typeof c === "string" ? hex(c) : c })) };
}
const shadow = (y, blur, spread, c) => ({ type: "DROP_SHADOW", color: c, offset: { x: 0, y }, radius: blur, spread, visible: true, blendMode: "NORMAL" });

/* ------------------------------------------------------------------ palette (from ds.css) */
const P = {
  ink: "#0d0b16", inkSoft: "#3b3650", inkMuted: "#6e6889", haze: "#ece6fb", lilac: "#e09dff", lilacPale: "#f3daff",
  mint: "#00ffdd", mintDeep: "#22cbbd", mintInk: "#0b7f76", teal: "#0f9f95", lilacInk: "#8a3fc0", aquaPale: "#bcfeff",
  success: "#0b7f76", info: "#8a3fc0", warning: "#b2452f", danger: "#b8245e",
};
const TINT = {   // candid-card gradients
  mint: ["#bcfeff", "#8ff7e9"], lilac: ["#f3daff", "#d7a6ff"], peach: ["#ffe1d6", "#ffc9b0"], pink: ["#ffe1ea", "#ffb3c7"],
};
const STATUS = { success: { c: P.success, t: TINT.mint }, info: { c: P.info, t: TINT.lilac }, warning: { c: P.warning, t: TINT.peach }, danger: { c: P.danger, t: TINT.pink } };
const SH = {
  s1: shadow(8, 24, -14, rgba(70, 40, 140, 0.35)),
  card: shadow(20, 50, -24, rgba(70, 40, 140, 0.35)),
  s2: shadow(30, 70, -40, rgba(70, 40, 140, 0.45)),
  s3: shadow(40, 90, -30, rgba(40, 20, 90, 0.5)),
  mint: shadow(8, 24, -10, rgba(0, 200, 180, 0.9)),
  label: shadow(12, 30, -16, rgba(70, 40, 140, 0.45)),
};

/* ------------------------------------------------------------------ fonts + text */
const FAM = "Google Sans Flex";
let FONT_OK = true, CODE = { family: "Roboto Mono", style: "Regular" };
const W = { 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold" };
async function loadFonts() {
  for (const s of ["Regular", "Medium", "SemiBold", "Bold"]) {
    try { await figma.loadFontAsync({ family: FAM, style: s }); } catch (e) { FONT_OK = false; }
  }
  try { await figma.loadFontAsync({ family: FAM, style: "ExtraBold" }); } catch (e) { W[800] = "Bold"; }
  if (!FONT_OK) { note("Google Sans Flex not available — fell back to Inter"); for (const s of ["Regular", "Medium", "Semi Bold", "Bold"]) await figma.loadFontAsync({ family: "Inter", style: s }); }
  try { await figma.loadFontAsync(CODE); } catch (e) { CODE = FONT_OK ? { family: FAM, style: "Regular" } : { family: "Inter", style: "Regular" }; }
}
function fontName(weight) {
  if (FONT_OK) return { family: FAM, style: W[weight] || "Regular" };
  return { family: "Inter", style: { 400: "Regular", 500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Bold" }[weight] || "Regular" };
}
let TS = {};   // text styles by name
/** text(chars, {size, weight, color, style, width, lh, ls, upper, align, code, underline}) */
async function text(chars, o = {}) {
  const t = figma.createText();
  t.fontName = o.code ? CODE : fontName(o.weight || 400);
  t.characters = String(chars);
  if (o.style && TS[o.style]) { try { await t.setTextStyleIdAsync(TS[o.style].id); } catch (e) {} }
  else {
    t.fontSize = o.size || 17;
    t.lineHeight = { unit: "PERCENT", value: (o.lh || 1.5) * 100 };
    if (o.ls) t.letterSpacing = { unit: "PERCENT", value: o.ls };
  }
  if (o.upper) t.textCase = "UPPER";
  if (o.underline) t.textDecoration = "UNDERLINE";
  t.fills = [paint(o.color || "ink")];
  if (o.align) t.textAlignHorizontal = o.align;
  if (o.width) { t.textAutoResize = "HEIGHT"; t.resize(o.width, t.height); }
  return t;
}

/* ------------------------------------------------------------------ variables */
const V = {};   // "color/..." in the light collection → Variable
let COL = null, COLD = null;
async function loadVariables() {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  COL = cols.find((c) => c.name === "Color" || c.name === "Color (Light)") || null;
  COLD = cols.find((c) => c.name === "Color Dark") || null;
  const vars = await figma.variables.getLocalVariablesAsync();
  for (const v of vars) if (COL && v.variableCollectionId === COL.id) V[v.name] = v;
  V.__dark = {};
  for (const v of vars) if (COLD && v.variableCollectionId === COLD.id) V.__dark[v.name] = v;
  if (!COL) note("No 'Color' collection found — new colours are drawn as plain fills");
}
async function ensureColor(name, light, dark, web, scopes) {
  if (!COL) return;
  const set = async (coll, store, value) => {
    let v = store[name];
    if (!v) { v = figma.variables.createVariable(name, coll, "COLOR"); store[name] = v; }
    v.setValueForMode(coll.modes[0].modeId, value);
    try { v.setVariableCodeSyntax("WEB", web); } catch (e) {}
    if (scopes) v.scopes = scopes;
  };
  await set(COL, V, light);
  if (COLD) await set(COLD, V.__dark, dark);
}
// paint for a semantic name: binds the light variable when it exists, else a solid fill
const FALLBACK = {
  ink: P.ink, inkSoft: P.inkSoft, inkMuted: P.inkMuted, white: "#ffffff", mint: P.mint, mintDeep: P.mintDeep, mintInk: P.mintInk,
  teal: P.teal, lilac: P.lilac, lilacPale: P.lilacPale, lilacInk: P.lilacInk, haze: P.haze,
  success: P.success, info: P.info, warning: P.warning, danger: P.danger,
};
const BIND = {
  ink: "color/text/primary", inkSoft: "color/text/secondary", inkMuted: "color/text/muted", mintDeep: "color/text/accent-mint", mintInk: "color/text/mint-small",
  teal: "color/text/teal", lilacInk: "color/text/lilac-small", mint: "color/bg/mint", lilacPale: "color/bg/lilac-pale", haze: "color/bg/page",
  success: "color/status/success", info: "color/status/info", warning: "color/status/warning", danger: "color/status/danger",
};
function paint(key, alpha) {
  if (typeof key === "object") return key;
  const base = solid(hex(FALLBACK[key] || key, alpha == null ? 1 : alpha));
  const vn = BIND[key];
  if (vn && V[vn] && alpha == null) { try { return figma.variables.setBoundVariableForPaint(base, "color", V[vn]); } catch (e) {} }
  return base;
}
const WHITE = (a = 1) => solid(hex("#ffffff", a));
const GLASS = () => WHITE(0.58);
const RULE = () => solid(rgba(13, 11, 22, 0.09));
const RULE2 = () => solid(rgba(13, 11, 22, 0.18));

/* ------------------------------------------------------------------ layout helpers */
/** frame(name, {dir, gap, pad:[t,r,b,l]|n, fill, radius, stroke, sw, w, h, hug, align, justify, effects, wrap, clip}) */
function frame(name, o = {}) {
  const f = figma.createFrame();
  f.name = name;
  f.fills = o.fill ? (Array.isArray(o.fill) ? o.fill : [o.fill]) : [];
  if (o.dir !== "none") {
    f.layoutMode = o.dir === "h" ? "HORIZONTAL" : "VERTICAL";
    f.itemSpacing = o.gap || 0;
    const p = typeof o.pad === "number" ? [o.pad, o.pad, o.pad, o.pad] : o.pad || [0, 0, 0, 0];
    [f.paddingTop, f.paddingRight, f.paddingBottom, f.paddingLeft] = p;
    f.primaryAxisSizingMode = "AUTO"; f.counterAxisSizingMode = "AUTO";
    if (o.align) f.counterAxisAlignItems = o.align;        // MIN CENTER MAX BASELINE
    if (o.justify) f.primaryAxisAlignItems = o.justify;    // MIN CENTER MAX SPACE_BETWEEN
    if (o.wrap) { f.layoutWrap = "WRAP"; f.counterAxisSpacing = o.wrapGap == null ? o.gap || 0 : o.wrapGap; }
  }
  if (o.radius != null) f.cornerRadius = o.radius;
  if (o.stroke) { f.strokes = [o.stroke]; f.strokeWeight = o.sw || 1; f.strokeAlign = "INSIDE"; }
  if (o.effects) f.effects = o.effects;
  f.clipsContent = !!o.clip;
  if (o.w || o.h) {
    f.resize(o.w || 100, o.h || 100);
    if (o.dir !== "none") {
      const horiz = o.dir === "h";
      if (o.w) { if (horiz) f.primaryAxisSizingMode = "FIXED"; else f.counterAxisSizingMode = "FIXED"; }
      if (o.h) { if (horiz) f.counterAxisSizingMode = "FIXED"; else f.primaryAxisSizingMode = "FIXED"; }
    }
  }
  return f;
}
function add(parent, ...kids) { for (const k of kids) if (k) parent.appendChild(k); return parent; }
function fill(node, axis = "h") { try { if (axis === "h" || axis === "both") node.layoutSizingHorizontal = "FILL"; if (axis === "v" || axis === "both") node.layoutSizingVertical = "FILL"; } catch (e) {} return node; }
function rect(w, h, o = {}) { const r = figma.createRectangle(); r.resize(w, h); r.fills = o.fill ? [o.fill] : []; if (o.radius != null) r.cornerRadius = o.radius; if (o.stroke) { r.strokes = [o.stroke]; r.strokeWeight = o.sw || 1; r.strokeAlign = "INSIDE"; } if (o.effects) r.effects = o.effects; return r; }
function dot(d, o = {}) { const e = figma.createEllipse(); e.resize(d, d); e.fills = o.fill ? [o.fill] : []; if (o.stroke) { e.strokes = [o.stroke]; e.strokeWeight = o.sw || 1; e.strokeAlign = "INSIDE"; } if (o.effects) e.effects = o.effects; return e; }
function icon(svg, size = 18) { const n = figma.createNodeFromSvg(svg); n.name = "icon"; n.resize(size, size); n.fills = []; return n; }
const ICON = {
  check: (c = "#0d0b16") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  info: (c = "#0d0b16") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 11v6M12 7v.5" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  warn: (c = "#0d0b16") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 7v7M12 17.5v.5" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  x: (c = "#3b3650") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  plus: (c = "#0d0b16") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  chevron: (c = "#6e6889") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  search: (c = "#6e6889") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="${c}" stroke-width="2"/><path d="M16 16l4 4" stroke="${c}" stroke-width="2" stroke-linecap="round"/></svg>`,
  upload: (c = "#0d0b16") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  box: (c = "#0d0b16") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 7h16v12H4zM8 7V5h8v2" stroke="${c}" stroke-width="2" stroke-linejoin="round"/></svg>`,
  doc: (c = "#0d0b16") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 4h10l4 4v12H5zM14 4v5h5" stroke="${c}" stroke-width="2" stroke-linejoin="round"/></svg>`,
  share: (c = "#0d0b16") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="2.5" stroke="${c}" stroke-width="2"/><circle cx="18" cy="6" r="2.5" stroke="${c}" stroke-width="2"/><circle cx="18" cy="18" r="2.5" stroke="${c}" stroke-width="2"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" stroke="${c}" stroke-width="2"/></svg>`,
  edit: (c = "#6e6889") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 20h4L19 9l-4-4L4 16z" stroke="${c}" stroke-width="2" stroke-linejoin="round"/></svg>`,
  link: (c = "#6e6889") => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 15l6-6M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1" stroke="${c}" stroke-width="2" stroke-linecap="round"/></svg>`,
};

/* component helpers */
function comp(name, node, description) {
  const c = figma.createComponent();
  c.name = name;
  // copy the frame's layout onto the component and move its children across
  c.layoutMode = node.layoutMode;
  if (node.layoutMode !== "NONE") {
    c.itemSpacing = node.itemSpacing; c.paddingTop = node.paddingTop; c.paddingRight = node.paddingRight; c.paddingBottom = node.paddingBottom; c.paddingLeft = node.paddingLeft;
    c.primaryAxisAlignItems = node.primaryAxisAlignItems; c.counterAxisAlignItems = node.counterAxisAlignItems;
    c.layoutWrap = node.layoutWrap; if (node.layoutWrap === "WRAP") c.counterAxisSpacing = node.counterAxisSpacing;
  }
  c.fills = node.fills; c.strokes = node.strokes; c.strokeAlign = node.strokeAlign; c.effects = node.effects; c.clipsContent = node.clipsContent;
  if (typeof node.strokeWeight === "number") c.strokeWeight = node.strokeWeight;
  else for (const k of ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"]) c[k] = node[k];
  if (typeof node.cornerRadius === "number") c.cornerRadius = node.cornerRadius;
  else for (const k of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]) c[k] = node[k];
  if (node.dashPattern && node.dashPattern.length) c.dashPattern = node.dashPattern;
  if (node.opacity != null && node.opacity !== 1) c.opacity = node.opacity;
  c.resize(node.width, node.height);
  if (node.layoutMode !== "NONE") { c.primaryAxisSizingMode = node.primaryAxisSizingMode; c.counterAxisSizingMode = node.counterAxisSizingMode; }
  for (const k of [...node.children]) c.appendChild(k);
  node.remove();
  if (description) c.description = description;
  return c;
}
function variants(name, comps, parent, description, { dir = "h", gap = 24, wrap = false } = {}) {
  for (const c of comps) parent.appendChild(c);
  const set = figma.combineAsVariants(comps, parent);
  set.name = name;
  set.layoutMode = dir === "h" ? "HORIZONTAL" : "VERTICAL";
  set.itemSpacing = gap; set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 24;
  set.primaryAxisSizingMode = "AUTO"; set.counterAxisSizingMode = "AUTO";
  if (wrap) { set.layoutWrap = "WRAP"; set.counterAxisSpacing = gap; }
  set.fills = [WHITE(0.35)]; set.cornerRadius = 20;
  set.strokes = [solid(rgba(151, 71, 255, 1))]; set.strokeWeight = 1; set.dashPattern = [6, 4];
  if (description) set.description = description;
  return set;
}

/* ------------------------------------------------------------------ section scaffolding */
async function board(page, title, kicker, intro, width = 1600) {
  const b = frame(title, { dir: "v", gap: 32, pad: 64, fill: WHITE(0.92), radius: 32, effects: [SH.s2] });
  b.resize(width, 100); b.counterAxisSizingMode = "FIXED"; b.primaryAxisSizingMode = "AUTO";
  b.setPluginData("tag", TAG);
  page.appendChild(b);
  add(b, await text(kicker, { size: 13, weight: 700, color: "inkSoft", upper: true, ls: 8 }));
  add(b, await text(title, { size: 48, weight: 600, lh: 1.08, ls: -3 }));
  if (intro) add(b, await text(intro, { size: 19, lh: 1.45, color: "inkSoft", width: 980 }));
  return b;
}
async function group(parent, title, rules) {
  const g = frame(title, { dir: "v", gap: 18 });
  add(parent, g); fill(g);
  add(g, await text(title, { size: 22, weight: 700, lh: 1.2 }));
  const row = frame("items", { dir: "h", gap: 32, wrap: true, wrapGap: 32, align: "MIN" });
  add(g, row); fill(row);
  if (rules) add(g, await text(rules, { size: 14, color: "inkMuted", width: 1100, lh: 1.5 }));
  return row;
}

/* ================================================================== 1. tokens */
async function buildTokens() {
  const C = (h, a) => hex(h, a);
  const items = [
    ["color/text/muted", C("#6e6889"), C("#9a93b8"), "var(--ink-muted)", ["TEXT_FILL"]],
    ["color/text/mint-small", C("#0b7f76"), C("#3df0d8"), "var(--mint-ink)", ["TEXT_FILL", "STROKE_COLOR"]],
    ["color/text/teal", C("#0f9f95"), C("#3df0d8"), "var(--teal)", ["TEXT_FILL"]],
    ["color/text/lilac-small", C("#8a3fc0"), C("#eab4ff"), "var(--lilac-ink)", ["TEXT_FILL", "STROKE_COLOR"]],
    ["color/status/success", C("#0b7f76"), C("#6ff0da"), "var(--success)", ["TEXT_FILL", "STROKE_COLOR", "SHAPE_FILL"]],
    ["color/status/info", C("#8a3fc0"), C("#eab4ff"), "var(--info)", ["TEXT_FILL", "STROKE_COLOR", "SHAPE_FILL"]],
    ["color/status/warning", C("#b2452f"), C("#ffc2a8"), "var(--warning)", ["TEXT_FILL", "STROKE_COLOR", "SHAPE_FILL"]],
    ["color/status/danger", C("#b8245e"), C("#ff9fbd"), "var(--danger)", ["TEXT_FILL", "STROKE_COLOR", "SHAPE_FILL"]],
    ["color/status/success-ring", C("#0f9f95", 0.24), C("#6ff0da", 0.3), "var(--success-ring)", ["STROKE_COLOR"]],
    ["color/status/info-ring", C("#8a3fc0", 0.22), C("#eab4ff", 0.3), "var(--info-ring)", ["STROKE_COLOR"]],
    ["color/status/warning-ring", C("#b2452f", 0.22), C("#ffc2a8", 0.3), "var(--warning-ring)", ["STROKE_COLOR"]],
    ["color/status/danger-ring", C("#b8245e", 0.22), C("#ff9fbd", 0.3), "var(--danger-ring)", ["STROKE_COLOR"]],
    ["color/bg/sunk", C("#c9bdf7", 0.22), C("#b996f5", 0.1), "var(--surface-sunk)", ["FRAME_FILL", "SHAPE_FILL"]],
    ["color/bg/overlay", C("#46288c", 0.28), C("#05020e", 0.62), "var(--overlay)", ["FRAME_FILL"]],
    ["color/border/strong", C("#0d0b16", 0.18), C("#ffffff", 0.24), "var(--rule-strong)", ["STROKE_COLOR"]],
  ];
  for (const [n, l, d, web, sc] of items) await ensureColor(n, l, d, web, sc);
  note(`Colour variables: ${items.length} added or updated`);

  // text styles
  const want = [
    ["Heading/Page", 72, 600, 1.08, -3.5, "Sub-page title (.h1). clamp(2.5rem, 5.6vw, 4.5rem)"],
    ["Body/Caption", 12.5, 500, 1.4, 0, "Captions, timestamps (.caption)"],
    ["Label/Overline", 12.5, 700, 1.2, 8, "Small caps label (.overline). Set text case to UPPER."],
    ["Label/Badge", 11.5, 600, 1, 6, "Status badge (.badge) — same as the award pill. UPPER."],
    ["Code/Inline", 15, 400, 1.6, 0, "Code only (code, kbd, pre). System mono in code."],
  ];
  const existing = await figma.getLocalTextStylesAsync();
  for (const [n, size, w, lh, ls, d] of want) {
    let s = existing.find((x) => x.name === n) || figma.createTextStyle();
    s.name = n; s.fontName = n.startsWith("Code") ? CODE : fontName(w); s.fontSize = size;
    s.lineHeight = { unit: "PERCENT", value: lh * 100 }; s.letterSpacing = { unit: "PERCENT", value: ls }; s.description = d;
    if (n === "Label/Overline" || n === "Label/Badge") { try { s.textCase = "UPPER"; } catch (e) {} }
  }
  // effect styles
  const effs = [
    ["Shadow/Chip", [SH.s1], "--shadow-1: chips, alerts, small floating UI"],
    ["Shadow/Overlay", [SH.s3], "--shadow-3: dialogs, drawers, menus, toasts"],
    ["Shadow/Label", [SH.label], "Station label / menu card shadow"],
  ];
  const ex2 = await figma.getLocalEffectStylesAsync();
  for (const [n, e, d] of effs) { const s = ex2.find((x) => x.name === n) || figma.createEffectStyle(); s.name = n; s.effects = e; s.description = d; }
  TS = Object.fromEntries((await figma.getLocalTextStylesAsync()).map((s) => [s.name, s]));
  note("Text styles: Heading/Page, Body/Caption, Label/Overline, Label/Badge, Code/Inline · Effect styles: Shadow/Chip, Shadow/Overlay, Shadow/Label");
}

/* ================================================================== 2. components */
/* ---------- primitives used by several components */
async function btn(label, style = "mint", size = "md") {
  const h = size === "sm" ? 40 : 48;
  const f = frame("Button", { dir: "h", gap: 8, pad: [0, size === "sm" ? 18 : 22, 0, size === "sm" ? 18 : 22], radius: 999, h, align: "CENTER", justify: "CENTER" });
  f.primaryAxisSizingMode = "AUTO";
  const col = { mint: "ink", ink: "white", glass: "ink", ghost: "ink", danger: "danger", disabled: "inkMuted" }[style];
  if (style === "mint") { f.fills = [grad(["#3fe9d9", "#00ffdd"])]; f.effects = [SH.mint]; }
  if (style === "ink") { f.fills = [paint("ink")]; f.effects = [SH.card]; }
  if (style === "glass") { f.fills = [GLASS()]; f.strokes = [WHITE(0.85)]; f.strokeWeight = 1; }
  if (style === "danger") { f.fills = [WHITE(0.95)]; f.strokes = [solid(hex(P.danger, 0.22))]; f.strokeWeight = 1.5; f.effects = [shadow(4, 12, -8, rgba(184, 36, 94, 0.4))]; }
  if (style === "disabled") { f.fills = [GLASS()]; f.strokes = [RULE()]; f.strokeWeight = 1; }
  add(f, await text(label, { size: size === "sm" ? 14.5 : 16, weight: 700, lh: 1, color: col === "white" ? "#ffffff" : col }));
  return f;
}
async function badge(label, status) {
  const f = frame("Badge", { dir: "h", gap: 7, pad: [6, 11, 6, 11], radius: 999, fill: WHITE(), align: "CENTER" });
  const c = status && STATUS[status] ? STATUS[status].c : P.inkSoft;
  f.strokes = [solid(status === "live" ? hex(P.teal, 0.24) : status ? hex(c, 0.24) : rgba(13, 11, 22, 0.1))]; f.strokeWeight = 1;
  if (status === "live") add(f, dot(8, { fill: paint("mint"), effects: [{ type: "DROP_SHADOW", color: rgba(63, 233, 217, 0.3), offset: { x: 0, y: 0 }, radius: 0, spread: 3, visible: true, blendMode: "NORMAL" }] }));
  add(f, await text(label, { size: 11.5, weight: 600, lh: 1, ls: 6, upper: true, color: status === "live" ? "ink" : c }));
  return f;
}
async function field(label, inner, { help, error, req } = {}) {
  const f = frame("Field", { dir: "v", gap: 8 });
  const l = frame("label", { dir: "h", gap: 4 });
  add(l, await text(label, { size: 16, weight: 700, lh: 1.3 }));
  if (req) add(l, await text("*", { size: 16, weight: 700, lh: 1.3, color: "mintDeep" }));
  add(f, l, inner);
  if (help) add(f, await text(help, { size: 14, color: "inkMuted" }));
  if (error) add(f, await text("● " + error, { size: 14, weight: 600, color: "danger" }));
  return f;
}
async function box(placeholder, { state = "default", h = 48, pill = false, iconSvg, trailing } = {}) {
  const f = frame("Input", { dir: "h", gap: 10, pad: [0, 14, 0, 14], radius: pill ? 999 : 14, h, align: h > 48 ? "MIN" : "CENTER", fill: state === "focus" ? WHITE() : GLASS() });
  if (h > 48) { f.paddingTop = 12; }
  f.strokes = [state === "error" ? paint("danger") : state === "focus" ? paint("mintDeep") : RULE()];
  f.strokeWeight = state === "error" ? 1.5 : state === "focus" ? 2 : 1;
  if (state === "disabled") f.opacity = 0.55;
  f.resize(320, h); f.counterAxisSizingMode = "FIXED";
  if (iconSvg) add(f, icon(iconSvg, 18));
  const t = await text(placeholder, { size: 16, color: state === "default" || state === "disabled" ? "inkMuted" : "ink" });
  add(f, t); fill(t);
  if (trailing) add(f, icon(trailing, 18));
  return f;
}
function tile(tint, size = 40, r = 14, rotate = 0) {
  const f = frame("tile", { dir: "h", radius: r, w: size, h: size, align: "CENTER", justify: "CENTER", fill: grad(TINT[tint], "d") });
  if (rotate) f.rotation = rotate;
  return f;
}
async function avatar(initials, tint = "mint", s = 48) {
  const f = frame("Avatar", { dir: "h", radius: s / 2, w: s, h: s, align: "CENTER", justify: "CENTER", fill: grad(TINT[tint], "d"), stroke: WHITE(), sw: 3, effects: [shadow(10, 20, -12, rgba(70, 40, 140, 0.5))] });
  f.strokeAlign = "OUTSIDE";
  add(f, await text(initials, { size: Math.round(s * 0.36), weight: 700, lh: 1 }));
  return f;
}
async function card(name, { pad = 28, gap = 10, w = 340, glow } = {}) {
  const f = frame(name, { dir: "v", gap, pad, radius: 28, w, fill: grad([hex("#ffffff", 0.88), hex("#ffffff", 0.7)], "d"), stroke: WHITE(0.85), effects: [SH.card] });
  if (glow) { f.strokes = [solid(hex(P.mintDeep, 0.45))]; f.strokeWeight = 1.5; f.effects = [SH.s2]; }
  return f;
}

/* ---------- sections */
async function sectionActions(page) {
  const b = await board(page, "Actions", "Components · v1.3 additions", "New button styles and sizes, and links. Everything stays a pill; nothing is grey.");
  let row = await group(b, "Button — extra styles", "Ghost: dismissive action next to a Primary. Danger: the Partner pill with pink text + ring, only for irreversible actions inside a confirm dialog. Disabled: an empty glass pill. Small (40px): toolbars, tables, cards only.");
  const vs = [];
  for (const [st, lab] of [["ghost", "Cancel"], ["danger", "Withdraw application"], ["disabled", "Applications closed"]])
    for (const sz of ["md", "sm"]) vs.push(comp(`Style=${st[0].toUpperCase() + st.slice(1)}, Size=${sz === "md" ? "Default" : "Small"}`, await btn(lab, st, sz)));
  add(row, variants("Button / Extra", vs, row, "Ghost / Danger / Disabled × Default (48) / Small (40). See ds.css .btn-ghost .btn-danger .btn[disabled] .btn-sm", { wrap: false }));
  // icon buttons
  const ib = [];
  for (const st of ["Glass", "Mint"]) {
    const f = frame("Icon button", { dir: "h", radius: 22, w: 44, h: 44, align: "CENTER", justify: "CENTER", fill: st === "Mint" ? grad(["#3fe9d9", "#00ffdd"]) : GLASS(), stroke: st === "Glass" ? WHITE(0.85) : null, effects: st === "Mint" ? [SH.mint] : [] });
    add(f, icon(st === "Mint" ? ICON.plus() : ICON.share(), 18));
    ib.push(comp(`Style=${st}`, f));
  }
  add(row, variants("Icon button", ib, row, "44px circle. Always has an aria-label; add .tip for a hover label."));
  row = await group(b, "Links", "Ink text with a 2px mint underline (set the underline colour to --mint-deep in code). Inline links always underline.");
  const l1 = frame("Link / Inline", { dir: "h", gap: 0 }); add(l1, await text("code of conduct", { size: 17, weight: 600, underline: true }));
  const l2 = frame("Link / Text link", { dir: "h", gap: 0 }); add(l2, await text("See every 2026 project on Devpost →", { size: 17, weight: 700, underline: true }));
  const l3 = frame("Link / Back", { dir: "h", gap: 0 }); add(l3, await text("← Back to resources", { size: 17, weight: 700, color: "inkSoft" }));
  add(row, comp("Link / Inline", l1, ".link"), comp("Link / Text link", l2, ".text-link"), comp("Link / Back", l3, ".back-link"));
  return b;
}

async function sectionForms(page) {
  const b = await board(page, "Forms", "Components · v1.3 additions", "Label above, 48px glass field, helper or error below. Checked states use the mint button gradient; a checked radio is a metro station.");
  let row = await group(b, "Text input", "Errors start with what to do. Mark required (mint *) or optional, whichever is rarer.");
  const st = [];
  for (const [s, ph, extra] of [["Default", "Ada Lovelace", {}], ["Focus", "Ada Lovelace", {}], ["Error", "ada@", { error: "Enter an email like name@school.edu" }], ["Disabled", "Shipyard", {}]]) {
    const f = await field(s === "Error" ? "Email" : "Full name", await box(ph, { state: s.toLowerCase() }), { req: s !== "Disabled", ...extra });
    f.resize(320, f.height); f.counterAxisSizingMode = "FIXED";
    st.push(comp(`State=${s}`, f));
  }
  add(row, variants("Text field", st, row, ".field › .label › .input › .help/.error-text"));
  const sel = await field("Shirt size", await box("Choose a size", { trailing: ICON.chevron() })); sel.resize(320, sel.height); sel.counterAxisSizingMode = "FIXED";
  const sea = await field("Search projects", await box("Agents, health, AR…", { pill: true, iconSvg: ICON.search() })); sea.resize(320, sea.height); sea.counterAxisSizingMode = "FIXED";
  const ta = await field("What will you build?", await box("One or two sentences", { h: 120 }), { help: "0 / 280" }); ta.resize(320, ta.height); ta.counterAxisSizingMode = "FIXED";
  add(row, comp("Select", sel, "Native <select>, styled (.select)"), comp("Search", sea, ".input.search inside .input-group"), comp("Textarea + counter", ta, "textarea[data-max] + .counter (turns pink when over)"));

  row = await group(b, "Choices", "Checkbox for many-of, radio for one-of, option card when each choice needs a description, segmented for 2–3 short options, switch for settings that apply immediately.");
  const cb = [];
  for (const on of [true, false]) {
    const f = frame("Checkbox", { dir: "h", gap: 12, align: "CENTER" });
    const bx = frame("box", { dir: "h", radius: 7, w: 22, h: 22, align: "CENTER", justify: "CENTER", fill: on ? grad(["#3fe9d9", "#00ffdd"], "d") : WHITE(), stroke: on ? null : RULE2(), sw: 1.5, effects: on ? [shadow(4, 12, -6, rgba(0, 200, 180, 0.9))] : [] });
    if (on) add(bx, icon(ICON.check(), 14));
    add(f, bx, await text("Vegetarian", { size: 17 }));
    cb.push(comp(`Checked=${on ? "On" : "Off"}`, f));
  }
  add(row, variants("Checkbox", cb, row, ".check input[type=checkbox]"));
  const rb = [];
  for (const on of [true, false]) {
    const f = frame("Radio", { dir: "h", gap: 12, align: "CENTER" });
    add(f, dot(22, { fill: WHITE(), stroke: on ? paint("ink") : RULE2(), sw: on ? 6 : 1.5 }), await text("First hackathon", { size: 17 }));
    rb.push(comp(`Checked=${on ? "On" : "Off"}`, f));
  }
  add(row, variants("Radio", rb, row, "Checked radio = metro station: white dot, thick ink ring."));
  const sw = [];
  for (const on of [true, false]) {
    const f = frame("Switch", { dir: "h", gap: 12, align: "CENTER" });
    const tr = frame("track", { dir: "h", radius: 14, w: 46, h: 28, pad: [3, 3, 3, 3], justify: on ? "MAX" : "MIN", align: "CENTER", fill: on ? grad(["#3fe9d9", "#00ffdd"]) : RULE2(), effects: on ? [shadow(6, 16, -8, rgba(0, 200, 180, 0.9))] : [] });
    add(tr, dot(22, { fill: WHITE(), effects: [shadow(2, 6, 0, rgba(0, 0, 0, 0.2))] }));
    add(f, tr, await text("Email me when applications open", { size: 17 }));
    sw.push(comp(`On=${on ? "True" : "False"}`, f));
  }
  add(row, variants("Switch", sw, row, "role=switch. Only for settings that apply immediately."));
  const oc = [];
  for (const on of [true, false]) {
    const f = frame("Option card", { dir: "h", gap: 12, pad: [16, 18, 16, 18], radius: 20, w: 240, fill: on ? WHITE() : GLASS(), stroke: on ? paint("mintDeep") : RULE(), sw: on ? 2 : 1, effects: on ? [{ type: "DROP_SHADOW", color: rgba(63, 233, 217, 0.18), offset: { x: 0, y: 0 }, radius: 0, spread: 5, visible: true, blendMode: "NORMAL" }] : [] });
    const tx = frame("text", { dir: "v", gap: 2 });
    add(tx, await text("Health", { size: 17, weight: 700 }), await text("Care, diagnostics, wellbeing", { size: 14, color: "inkSoft" }));
    add(f, dot(22, { fill: WHITE(), stroke: on ? paint("ink") : RULE2(), sw: on ? 6 : 1.5 }), tx);
    oc.push(comp(`Selected=${on ? "True" : "False"}`, f));
  }
  add(row, variants("Option card", oc, row, ".option-card — a radio/checkbox as a card"));
  const seg = frame("Segmented", { dir: "h", gap: 6, pad: 6, radius: 999, fill: GLASS(), stroke: WHITE(0.85), w: 320 });
  for (const [l, on] of [["In person", true], ["Online", false]]) {
    const o = frame(l, { dir: "h", radius: 999, h: 44, align: "CENTER", justify: "CENTER", fill: on ? paint("ink") : null });
    add(o, await text(l, { size: 15, weight: 600, color: on ? "#ffffff" : "inkSoft" })); add(seg, o); fill(o);
  }
  add(row, comp("Segmented", seg, "2–3 short options; aria-pressed"));

  row = await group(b, "Upload & range", "Dropzone: glass with a dashed lavender border and a mint icon tile; say accepted types and size. Range: always show the value.");
  const dz = frame("Dropzone", { dir: "v", gap: 8, pad: [28, 20, 28, 20], radius: 28, w: 320, align: "CENTER", fill: GLASS(), stroke: solid(hex("#b996f5", 0.7)), sw: 2 });
  dz.dashPattern = [8, 6];
  const t1 = tile("mint", 48, 16); add(t1, icon(ICON.upload(), 22));
  add(dz, t1, await text("Drop a file or browse", { size: 17, weight: 700 }), await text("PDF only · max 5 MB", { size: 14, color: "inkSoft" }));
  add(row, comp("Dropzone", dz, "label.dropzone + ul.file-list"));
  const rg = frame("Range", { dir: "v", gap: 12, w: 320 });
  add(rg, await text("Team size you're looking for: 3", { size: 16, weight: 700 }));
  const trk = frame("track", { dir: "none", w: 320, h: 24 });
  const base = rect(320, 8, { fill: paint("lilacPale"), radius: 4 }); base.y = 8;
  const filled = rect(213, 8, { fill: paint("mintDeep"), radius: 4 }); filled.y = 8;
  const th = dot(24, { fill: WHITE(), stroke: paint("mintDeep"), sw: 2, effects: [SH.s1] }); th.x = 201;
  add(trk, base, filled, th); add(rg, trk);
  add(row, comp("Range", rg, "input.range — mint fill, lilac-pale track"));
  return b;
}

async function sectionStatus(page) {
  const b = await board(page, "Status & feedback", "Components · v1.3 additions", "Status colours are the candid-card swatches — mint, lilac, peach, pink. Badges are the award pill; alerts are glass panels with a tinted tile; toasts are the ink egg-toast.");
  let row = await group(b, "Chips, badges, count, tag", "Chip: interactive filter (glass → ink when on). Badge: status only — this is 'pills mean status'. Tag: quiet metadata, lilac, 8px radius.");
  const ch = [];
  for (const on of [true, false]) {
    const f = frame("Chip", { dir: "h", pad: [0, 16, 0, 16], radius: 999, h: 40, align: "CENTER", fill: on ? paint("ink") : GLASS(), stroke: on ? null : WHITE(0.85) });
    add(f, await text(on ? "All" : "Health", { size: 15, weight: 600, color: on ? "#ffffff" : "inkSoft" }));
    ch.push(comp(`Selected=${on ? "True" : "False"}`, f));
  }
  add(row, variants("Chip", ch, row, ".chip[aria-pressed]"));
  const bd = [];
  for (const [s, l] of [["neutral", "Draft"], ["success", "Open"], ["info", "Online"], ["warning", "Closing soon"], ["danger", "Closed"], ["live", "Live now"]])
    bd.push(comp(`Status=${s[0].toUpperCase() + s.slice(1)}`, await badge(l, s === "neutral" ? null : s)));
  add(row, variants("Badge", bd, row, "White pill, small caps, 1px tinted ring, text in the status colour (≥ 4.5:1). Live = pulsing mint station dot.", { gap: 12 }));
  const cnt = frame("Count", { dir: "h", pad: [0, 7, 0, 7], radius: 11, h: 22, align: "CENTER", justify: "CENTER", fill: grad(["#3fe9d9", "#00ffdd"]) });
  add(cnt, await text("3", { size: 12, weight: 800, lh: 1 }));
  const tg = frame("Tag", { dir: "h", pad: [4, 10, 4, 10], radius: 8, fill: paint("lilacPale") });
  add(tg, await text("LangChain", { size: 13, weight: 600, color: "inkSoft", lh: 1.3 }));
  add(row, comp("Count", cnt, ".count"), comp("Tag", tg, ".tag — metadata, never status"));

  row = await group(b, "Alerts, callout, banner", "Alert sits next to what it's about: bold title says what happened, one line says what to do. role=alert only for errors. Banner: one site-wide line above the nav.");
  const al = [];
  for (const [s, ttl, body, tint, ic] of [["Info", "Applications open in January", "We'll email you the moment they do.", "lilac", ICON.info()], ["Success", "You're on the list", "Check your inbox to confirm your email.", "mint", ICON.check()], ["Warning", "Submissions close at 9:00 AM", "Push your final commit before then.", "peach", ICON.warn()], ["Danger", "We couldn't submit your application", "Check your connection and try again.", "pink", ICON.warn()]]) {
    const f = frame("Alert", { dir: "h", gap: 14, pad: [14, 16, 14, 14], radius: 20, w: 460, align: "CENTER", fill: WHITE(0.72), stroke: s === "Danger" ? solid(hex(P.danger, 0.22)) : WHITE(0.85), sw: s === "Danger" ? 1.5 : 1, effects: [SH.s1] });
    const t = tile(tint, 40, 14); add(t, icon(ic, 20));
    const tx = frame("text", { dir: "v", gap: 1 }); add(tx, await text(ttl, { size: 16, weight: 700 }), await text(body, { size: 15, color: "inkSoft" }));
    add(f, t, tx); fill(tx);
    al.push(comp(`Status=${s}`, f));
  }
  add(row, variants("Alert", al, row, ".alert (+ -success -warning -danger)", { dir: "v", gap: 12 }));
  const side = frame("col", { dir: "v", gap: 24 });
  const co = frame("Callout", { dir: "h", gap: 0, radius: 20, w: 420, fill: GLASS(), stroke: WHITE(0.85) });
  const bar = rect(4, 10, { fill: paint("lilac") }); add(co, bar); fill(bar, "v");
  const cot = frame("text", { dir: "v", gap: 4, pad: [20, 22, 20, 18] }); add(cot, await text("Tip for judges", { size: 16, weight: 700 }), await text("Score the demo you saw, not the one you imagined.", { size: 15, color: "inkSoft", width: 360 }));
  add(co, cot);
  const bn = frame("Banner", { dir: "h", gap: 12, pad: [10, 24, 10, 24], w: 420, justify: "CENTER", align: "CENTER", fill: grad(["#15102a", "#0d0b16", "#1d1236"]) });
  add(bn, await text("Applications close Friday", { size: 14, weight: 700, color: "mint" }), await text("Apply now", { size: 14, weight: 600, color: "#ffffff", underline: true }));
  add(side, comp("Callout", co, ".callout — glass + lilac rule"), comp("Banner", bn, ".banner — the marquee strip; max one per site"));
  add(row, side);

  row = await group(b, "Toast, progress, stepper, loading, empty", "Toast: confirmations only, 4s, bottom centre. Spinner for waits inside a control; skeleton for content; empty state is friendly and specific.");
  const to = frame("Toast", { dir: "h", gap: 12, pad: [12, 12, 12, 20], radius: 999, align: "CENTER", fill: solid(hex("#0d0b16")), effects: [shadow(18, 40, -18, rgba(13, 11, 22, 0.7))] });
  add(to, icon(ICON.check("#00ffdd"), 18), await text("Link copied", { size: 15, weight: 600, color: "#ffffff" }));
  const ok = frame("ok", { dir: "h", pad: [6, 12, 6, 12], radius: 999, fill: WHITE(0.12) }); add(ok, await text("OK", { size: 13.5, weight: 700, color: "#ffffff" })); add(to, ok);
  add(row, comp("Toast", to, "DS.toast('…') — the candid-egg toast"));
  const pg = frame("Progress", { dir: "v", gap: 8, w: 320 });
  add(pg, await text("Profile 70%", { size: 14 }));
  const tr = frame("track", { dir: "h", radius: 4, h: 8, w: 320, fill: paint("lilacPale"), clip: true });
  const fl = rect(224, 8, { fill: grad([P.mintDeep, P.lilac]), radius: 4 }); add(tr, fl); add(pg, tr);
  add(row, comp("Progress", pg, ".progress — the form card's bar"));
  const sp = frame("Stepper", { dir: "h", gap: 8, w: 420 });
  for (const [l, s] of [["Profile", "done"], ["Team", "current"], ["Project", "next"], ["Review", "next"]]) {
    const it = frame(l, { dir: "v", gap: 8 });
    const bar2 = rect(100, 6, { radius: 3, fill: s === "done" ? paint("mintDeep") : s === "current" ? grad([P.mintDeep, P.lilac]) : paint("lilacPale") });
    add(it, bar2, await text(l, { size: 14, weight: 600, color: s === "next" ? "inkMuted" : "ink" })); fill(bar2);
    add(sp, it); fill(it);
  }
  add(row, comp("Stepper", sp, "ol.stepper — flows of 3+ steps"));
  const sk = await card("Skeleton card", { w: 300, gap: 12 });
  for (const [w, h] of [[90, 14], [180, 26], [244, 14], [200, 14]]) add(sk, rect(w, h, { radius: 8, fill: solid(hex("#c9bdf7", 0.28)) }));
  add(row, comp("Skeleton", sk, ".skeleton — lavender shimmer, never grey"));
  const em = await card("Empty state", { w: 300, gap: 10 }); em.counterAxisAlignItems = "CENTER";
  const et = tile("lilac", 72, 22, -4); et.effects = [shadow(16, 30, -18, rgba(70, 40, 140, 0.6))]; add(et, icon(ICON.box(), 30));
  add(em, et, await text("No projects yet", { size: 20, weight: 700, align: "CENTER" }), await text("Projects appear here once judging starts on Sunday morning.", { size: 16, color: "inkSoft", align: "CENTER", width: 240 }));
  add(row, comp("Empty state", em, ".empty"));
  return b;
}

async function sectionOverlays(page) {
  const b = await board(page, "Overlays", "Components · v1.3 additions", "Native <dialog> and popover in code. Dialogs are the section card (white → lavender, mint glow); menus are the station label; tooltips are ink pills.");
  const row = await group(b, "Dialog, sheet, menu, tooltip", "Dialogs: decisions and ≤ 3 fields; safe action on the left. Drawer becomes a bottom sheet on phones. Menu ≤ 7 items, destructive last in pink.");
  const dl = frame("Dialog", { dir: "v", gap: 14, pad: 28, radius: 28, w: 460, fill: grad(["#ffffff", "#f8f3ff"], "v"), stroke: WHITE(0.95), effects: [SH.s3] });
  add(dl, await text("Withdraw your application?", { size: 20, weight: 700 }), await text("Your spot goes to the next person on the waitlist. You can apply again until applications close.", { size: 16, color: "inkSoft", width: 404 }));
  const ft = frame("footer", { dir: "h", gap: 12, justify: "MAX" }); add(ft, await btn("Keep it", "ghost"), await btn("Withdraw", "danger")); add(dl, ft); fill(ft);
  add(row, comp("Dialog", dl, "dialog.dialog over a lavender veil (--overlay)"));
  const sh = frame("Sheet (phone)", { dir: "v", gap: 16, pad: 28, radius: 28, w: 390, fill: grad(["#ffffff", "#f8f3ff"], "v"), effects: [SH.s3] });
  sh.topLeftRadius = 28; sh.topRightRadius = 28; sh.bottomLeftRadius = 0; sh.bottomRightRadius = 0;
  add(sh, await text("Filter projects", { size: 20, weight: 700 }));
  const cbx = frame("check", { dir: "h", gap: 12, align: "CENTER" }); const bx = frame("box", { dir: "h", radius: 7, w: 22, h: 22, align: "CENTER", justify: "CENTER", fill: grad(["#3fe9d9", "#00ffdd"], "d") }); add(bx, icon(ICON.check(), 14)); add(cbx, bx, await text("Health", { size: 17 })); add(sh, cbx);
  const sb = await btn("Show 24 projects", "mint"); add(sh, sb); fill(sb);
  add(row, comp("Drawer / Sheet", sh, "dialog.drawer — side panel on desktop, bottom sheet ≤ 760px"));
  const mn = frame("Menu", { dir: "v", gap: 0, pad: 6, radius: 20, w: 220, fill: WHITE(0.95), stroke: solid(rgba(13, 11, 22, 0.06)), effects: [SH.label] });
  for (const [l, ic, d] of [["Edit team", ICON.edit(), false], ["Copy invite link", ICON.link(), false], ["—", null, false], ["Leave team", null, true]]) {
    if (l === "—") { const hr = rect(196, 1, { fill: RULE() }); add(mn, hr); continue; }
    const it = frame(l, { dir: "h", gap: 10, pad: [10, 12, 10, 12], radius: 12, align: "CENTER" });
    if (ic) add(it, icon(ic, 18));
    add(it, await text(l, { size: 16, weight: 500, color: d ? "danger" : "ink" })); add(mn, it); fill(it);
  }
  add(row, comp("Menu", mn, ".menu[popover]"));
  const tp = frame("Tooltip", { dir: "h", pad: [7, 12, 7, 12], radius: 999, fill: paint("ink") }); add(tp, await text("Share", { size: 12.5, weight: 600, color: "#ffffff" }));
  add(row, comp("Tooltip", tp, ".tip[data-tip] — icon buttons only"));
  return b;
}

async function sectionNav(page) {
  const b = await board(page, "Navigation", "Components · v1.3 additions", null);
  const row = await group(b, "Breadcrumbs, pagination, sub-nav", "Breadcrumbs on pages 2+ levels deep. Pagination for lists over 24 items (filters first). Sub-nav on long pages, sticky, current section marked with a mint rule.");
  const bc = frame("Breadcrumbs", { dir: "h", gap: 8, align: "CENTER" });
  for (const [l, cur] of [["Home", 0], ["/", 2], ["Resources", 0], ["/", 2], ["Judging guide", 1]]) add(bc, await text(l, { size: 14, weight: cur === 2 ? 400 : 600, color: cur === 1 ? "ink" : cur === 2 ? "inkMuted" : "inkSoft" }));
  add(row, comp("Breadcrumbs", bc, "nav.breadcrumbs"));
  const pg = frame("Pagination", { dir: "h", gap: 6, align: "CENTER" });
  for (const [l, on] of [["←", 0], ["1", 0], ["2", 1], ["3", 0], ["…", 0], ["9", 0], ["→", 0]]) {
    const it = frame(l, { dir: "h", radius: 22, w: 44, h: 44, align: "CENTER", justify: "CENTER", fill: on ? paint("ink") : null });
    add(it, await text(l, { size: 16, weight: 600, color: on ? "#ffffff" : "inkSoft" })); add(pg, it);
  }
  add(row, comp("Pagination", pg, "nav.pagination"));
  const sn = frame("Sub-nav", { dir: "v", gap: 2, w: 220 });
  for (const [l, on] of [["Overview", 0], ["Scoring", 1], ["Logistics", 0], ["FAQ", 0]]) {
    const it = frame(l, { dir: "h", pad: [8, 14, 8, 14], fill: on ? GLASS() : null });
    if (on) { it.strokes = [paint("mintDeep")]; it.strokeLeftWeight = 2; it.strokeTopWeight = 0; it.strokeRightWeight = 0; it.strokeBottomWeight = 0; it.topRightRadius = 12; it.bottomRightRadius = 12; }
    add(it, await text(l, { size: 15, weight: on ? 700 : 500, color: on ? "ink" : "inkSoft" })); add(sn, it); fill(it);
  }
  add(row, comp("Sub-nav", sn, "nav.subnav — scroll-spied"));
  return b;
}

async function sectionContent(page) {
  const b = await board(page, "Content & data", "Components · v1.3 additions", "Cards, people, tables, schedule, timeline and long-form. Tiles and avatars use the candid-card gradients; the timeline is the world-route metro line.");
  let row = await group(b, "Cards", "Link card: whole card is the link, tilted gradient tile, mint-underlined arrow. Prize: tabular figures; only one .first (mint glow, award gradient on the amount).");
  const mc = await card("Media card", { pad: 0, gap: 0, w: 300 }); mc.clipsContent = true;
  const media = rect(300, 168, { fill: grad(TINT.lilac, "d") }); add(mc, media); fill(media);
  const mb = frame("body", { dir: "v", gap: 8, pad: [22, 24, 26, 24] });
  add(mb, await text("Workshop", { size: 12.5, weight: 700, upper: true, ls: 8, color: "inkSoft" }), await text("Shipping agents that don't hallucinate", { size: 20, weight: 700, lh: 1.2, width: 252 }), await text("Saturday · 11:00 AM · Room 1160", { size: 14, color: "inkSoft" }));
  add(mc, mb); fill(mb);
  add(row, comp("Media card", mc, ".media-card"));
  const lc = await card("Link card", { w: 300 });
  const lt = tile("mint", 52, 16, -4); add(lt, icon(ICON.doc(), 24));
  add(lc, lt, await text("Hacker guide", { size: 20, weight: 700 }), await text("Everything you need for the weekend, in one page.", { size: 15, color: "inkSoft", width: 244 }), await text("Read the guide →", { size: 16, weight: 700, underline: true }));
  add(row, comp("Link card", lc, "a.card.link-card"));
  const pr = [];
  for (const first of [true, false]) {
    const c = await card("Prize", { w: 260, glow: first });
    const amt = await text(first ? "$5,000" : "$3,000", { size: 48, weight: 700, lh: 1, ls: -4 });
    if (first) amt.fills = [grad(["#a64bc0", "#6f5bd8", "#2a8db6", "#1d9384"])];
    add(c, await text(first ? "1st place" : "2nd place", { size: 12.5, weight: 700, upper: true, ls: 8, color: "inkSoft" }), amt, await text("Plus mentorship from our partners.", { size: 15, color: "inkSoft", width: 204 }));
    pr.push(comp(`First=${first ? "True" : "False"}`, c));
  }
  add(row, variants("Prize card", pr, row, ".card.prize (+ .first)"));

  row = await group(b, "People", "Real people only, with permission. Initials on a candid-card gradient with a white ring when there's no photo. Organisation in teal.");
  const av = [];
  for (const tint of ["mint", "lilac", "peach"]) for (const [sz, s] of [["Small", 32], ["Default", 48], ["Large", 88]]) av.push(comp(`Tone=${tint[0].toUpperCase() + tint.slice(1)}, Size=${sz}`, await avatar(tint === "mint" ? "AL" : tint === "lilac" ? "GH" : "RK", tint, s)));
  add(row, variants("Avatar", av, row, ".avatar (.sm .lg; .lilac .peach)", { gap: 16 }));
  const ps = frame("Person", { dir: "v", gap: 14, w: 200 });
  const pt = frame("text", { dir: "v", gap: 2 });
  add(pt, await text("Name TBD", { size: 19, weight: 700 }), await text("Research Scientist", { size: 15, color: "inkSoft" }), await text("Organisation", { size: 15, weight: 700, color: "teal" }));
  add(ps, await avatar("AL", "mint", 88), pt);
  add(row, comp("Person", ps, ".person — judges, mentors, speakers"));

  row = await group(b, "Table, facts, checklist", "Table headers are the small-caps label; numbers right-aligned in tabular figures; rows stack into cards on phones.");
  const tb = frame("Table", { dir: "v", gap: 0, radius: 28, w: 640, fill: grad([hex("#ffffff", 0.88), hex("#ffffff", 0.7)], "d"), stroke: WHITE(0.85), effects: [SH.card], clip: true });
  const cols = [260, 130, 140, 110];
  const rowf = async (cells, head) => {
    const r = frame("row", { dir: "h", gap: 0, align: "CENTER" });
    for (let i = 0; i < cells.length; i++) {
      const c = frame("cell", { dir: "h", pad: [14, 20, 14, 20], w: cols[i], justify: i === 3 ? "MAX" : "MIN", align: "CENTER" });
      const v = cells[i];
      if (v && v.badge) add(c, await badge(v.badge, v.s)); else add(c, await text(v, head ? { size: 12, weight: 700, upper: true, ls: 8, color: "inkSoft" } : { size: 15 }));
      add(r, c);
    }
    r.strokes = [RULE()]; r.strokeTopWeight = 0; r.strokeLeftWeight = 0; r.strokeRightWeight = 0; r.strokeBottomWeight = 1;
    return r;
  };
  add(tb, await rowf(["Track", "Sponsor", "Status", "Prize"], true));
  add(tb, await rowf(["Best AI for Community Impact", "Google", { badge: "Open", s: "success" }, "$2,000"]));
  add(tb, await rowf(["Best Health Care Hack", "Sun Life", { badge: "Closing soon", s: "warning" }, "$1,500"]));
  add(row, comp("Table", tb, ".table-wrap › table.table (+ .table-stack)"));
  const ck = frame("Checklist", { dir: "v", gap: 10 });
  for (const l of ["Laptop and charger", "Student ID or government ID", "A reusable water bottle"]) {
    const it = frame("item", { dir: "h", gap: 12, align: "CENTER" });
    const d = frame("tick", { dir: "h", radius: 10, w: 20, h: 20, align: "CENTER", justify: "CENTER", fill: grad(["#3fe9d9", "#00ffdd"], "d") }); add(d, icon(ICON.check(), 13));
    add(it, d, await text(l, { size: 17 })); add(ck, it);
  }
  add(row, comp("Checklist", ck, "ul.checklist"));

  row = await group(b, "Schedule, timeline, countdown", "Agenda: time column, title, one line, tags/badges; the current item gets a mint station dot. Timeline: mint track to --done, white stations with ink rings.");
  const ag = [];
  for (const now of [false, true]) {
    const f = frame("Agenda item", { dir: "h", gap: 20, pad: [18, 0, 18, 0], w: 460 });
    const tcol = frame("time", { dir: "h", gap: 8, w: 110, align: "CENTER" });
    if (now) add(tcol, dot(10, { fill: paint("mint"), effects: [{ type: "DROP_SHADOW", color: rgba(63, 233, 217, 0.3), offset: { x: 0, y: 0 }, radius: 0, spread: 4, visible: true, blendMode: "NORMAL" }] }));
    add(tcol, await text(now ? "7:30 PM" : "6:00 PM", { size: 17, weight: 700 }));
    const body = frame("body", { dir: "v", gap: 4 });
    add(body, await text(now ? "Opening ceremony" : "Check-in opens", { size: 18, weight: 700 }), await text(now ? "Keynote, rules and sponsor intros." : "Myhal Centre lobby. Bring your ID.", { size: 15, color: "inkSoft" }));
    if (now) { const m = frame("meta", { dir: "h", gap: 8 }); const tg2 = frame("Tag", { dir: "h", pad: [4, 10, 4, 10], radius: 8, fill: paint("lilacPale") }); add(tg2, await text("MY150", { size: 13, weight: 600, color: "inkSoft" })); add(m, await badge("Live now", "live"), tg2); add(body, m); }
    add(f, tcol, body); fill(body);
    f.strokes = [RULE()]; f.strokeTopWeight = 0; f.strokeLeftWeight = 0; f.strokeRightWeight = 0; f.strokeBottomWeight = 1;
    ag.push(comp(`Now=${now ? "True" : "False"}`, f));
  }
  add(row, variants("Agenda item", ag, row, ".agenda-item (+ .is-now)", { dir: "v", gap: 0 }));
  const tl = [];
  for (const st of ["Done", "Current", "Upcoming"]) {
    const f = frame("Timeline stop", { dir: "h", gap: 14, w: 320 });
    const rail = frame("rail", { dir: "v", gap: 0, w: 22, align: "CENTER" });
    add(rail, dot(22, { fill: st === "Done" ? solid(hex("#bdfbf4")) : WHITE(), stroke: paint("ink"), sw: st === "Current" ? 5 : 3.5, effects: st === "Current" ? [{ type: "DROP_SHADOW", color: rgba(63, 233, 217, 0.28), offset: { x: 0, y: 0 }, radius: 0, spread: 6, visible: true, blendMode: "NORMAL" }] : [] }));
    const ln = rect(5, 56, { radius: 3, fill: st === "Upcoming" ? paint("lilacPale") : paint("mintDeep") }); add(rail, ln);
    const body = frame("body", { dir: "v", gap: 2 });
    add(body, await text({ Done: "November", Current: "January", Upcoming: "March 2027" }[st], { size: 14, weight: 700, color: "teal" }), await text({ Done: "Judge applications open", Current: "Hacker applications open", Upcoming: "GenAI Genesis" }[st], { size: 18, weight: 700 }));
    add(f, rail, body);
    tl.push(comp(`State=${st}`, f));
  }
  add(row, variants("Timeline stop", tl, row, "ol.timeline — the world-route metro line", { dir: "v", gap: 0 }));
  const cd = frame("Countdown", { dir: "h", gap: 10 });
  for (const [n, l] of [["130", "Days"], ["19", "Hours"], ["33", "Min"], ["12", "Sec"]]) {
    const c = frame(l, { dir: "v", gap: 6, pad: [16, 10, 14, 10], radius: 20, w: 80, align: "CENTER", fill: grad([hex("#ffffff", 0.9), hex("#ffffff", 0.68)], "d"), stroke: WHITE(0.85), effects: [SH.card] });
    add(c, await text(n, { size: 32, weight: 700, lh: 1, ls: -3 }), await text(l, { size: 11.5, weight: 700, upper: true, ls: 8, color: "inkSoft" }));
    add(cd, c);
  }
  add(row, comp("Countdown", cd, ".countdown[data-countdown] — one per page, real dates only"));

  row = await group(b, "Long-form, quote, code", "Prose: ≤ 68ch, mint list markers, lilac-rule quotes, ink links with mint underline. Quotes are real and attributed. Code block is the dark sponsor-wall card.");
  const pz = frame("Prose", { dir: "v", gap: 14, w: 460 });
  add(pz, await text("Code of conduct", { size: 28, weight: 700, lh: 1.15 }), await text("GenAI Genesis is for everyone. We expect every participant, mentor, judge and sponsor to help keep it welcoming and safe.", { size: 17, color: "inkSoft", width: 460 }));
  for (const l of ["Be kind and assume good intent.", "Respect people's time, space and work."]) { const li = frame("li", { dir: "h", gap: 10, align: "CENTER" }); add(li, dot(6, { fill: paint("mintDeep") }), await text(l, { size: 17, color: "inkSoft" })); add(pz, li); }
  const bq = frame("blockquote", { dir: "h", gap: 16 }); const qb = rect(3, 30, { fill: paint("lilac") }); add(bq, qb, await text("Build boldly, and look out for each other.", { size: 18 })); fill(qb, "v"); add(pz, bq);
  add(row, comp("Prose", pz, ".prose"));
  const qt = await card("Quote", { w: 360, gap: 16 });
  add(qt, await text("“", { size: 48, weight: 700, lh: 0.6, color: "lilac" }), await text("The most organised hackathon I've judged.", { size: 24, weight: 500, lh: 1.35, width: 304 }));
  const qa = frame("by", { dir: "h", gap: 12, align: "CENTER" }); const qn = frame("n", { dir: "v", gap: 0 }); add(qn, await text("Real name only", { size: 15, weight: 700 }), await text("Role, Organisation · with permission", { size: 13, color: "inkSoft" })); add(qa, await avatar("J", "mint", 32), qn); add(qt, qa);
  add(row, comp("Quote", qt, "figure.quote — never invented testimonials"));
  const cb2 = frame("Code block", { dir: "v", pad: [20, 22, 20, 22], radius: 20, w: 420, fill: grad(["#1d1240", "#120c26", "#1a1036"], "d"), stroke: WHITE(0.07) });
  add(cb2, await text("curl https://api.genaigenesis.ca/v1/teams \\\n  -H \"Authorization: Bearer $TOKEN\"", { code: true, size: 14, lh: 1.65, color: "#e9e4ff" }));
  add(row, comp("Code block", cb2, "pre.code-block"));
  return b;
}

async function sectionIllustration(page) {
  const b = await board(page, "Illustration — Toronto skyline", "Components · v1.3", "Flat buildings in the site palette. On pages: once, card-wide, standing on a section card (the card overlaps the bases by 12px). The horizon set (no CN Tower) is for the 3D TTC street. Clouds drift left → right in code.");
  const placeSvg = (name, key, w) => {
    if (!SVG[key]) return null;
    try { const n = figma.createNodeFromSvg(SVG[key]); n.name = name; if (w) { const s = w / n.width; n.resize(w, n.height * s); } return n; } catch (e) { note("SVG failed: " + key); return null; }
  };
  let row = await group(b, "Compositions", "skyline-card (sponsor wall / form card) and skyline-horizon (TTC finale). Light and night versions.");
  for (const [n, k, w] of [["Skyline / Card / Light", "card-light", 660], ["Skyline / Card / Dark", "card-dark", 660], ["Skyline / Horizon / Light", "horizon-light", 660], ["Skyline / Horizon / Dark", "horizon-dark", 660]]) {
    const svg = placeSvg(n, k, w); if (!svg) continue;
    const wrap = frame(n, { dir: "v", pad: 16, radius: 20, fill: k.endsWith("dark") ? solid(hex("#120b26")) : solid(hex("#ece6fb")) });
    add(wrap, svg); add(row, comp(n, wrap));
  }
  row = await group(b, "Buildings", "Single buildings are for slides, social and print — not for scattering around the site. New buildings are added in landing/skyline.js, then exported.");
  for (const k of Object.keys(SVG).filter((k) => k.startsWith("building-") && k.endsWith("-light"))) {
    const svg = placeSvg(k.replace("building-", "Building / ").replace("-light", ""), k, null);
    if (!svg) continue;
    const wrap = frame(svg.name, { dir: "v", pad: 12, radius: 16, fill: solid(hex("#ece6fb")), align: "CENTER", justify: "MAX" });
    add(wrap, svg); add(row, comp(svg.name, wrap));
  }
  return b;
}

/* ================================================================== 3. foundations + read me */
async function foundationsBoard(page) {
  const b = await board(page, "Foundations · v1.3 additions", "Foundations · 04", "Status colours come from the candid-card swatches (mint, lilac, peach, pink) — never traffic-light green/amber/red. New text tokens, elevation levels, layers and durations.");
  let row = await group(b, "Status", "Text colour on a white pill (≥ 4.5:1) · tint for tiles and avatars · 1px ring at ~22% for outlines.");
  for (const [n, s] of Object.entries(STATUS)) {
    const c = frame(n, { dir: "v", gap: 8, w: 220 });
    const sw = frame("swatch", { dir: "h", radius: 16, h: 84, w: 220, fill: grad(s.t, "d"), clip: true, align: "MAX", pad: 10 });
    const pill = await badge(n, n); add(sw, pill);
    add(c, sw, await text(`--${n}`, { size: 15, weight: 700 }), await text(`${s.c} on white\ntint ${s.t[0]} → ${s.t[1]}`, { code: true, size: 12, color: "inkMuted" }));
    add(row, c);
  }
  row = await group(b, "Text tokens", null);
  for (const [n, h, use] of [["--ink-muted", "#6e6889", "Captions, placeholders"], ["--mint-ink", "#0b7f76", "Small mint text (--mint-deep is 2:1 — large only)"], ["--teal", "#0f9f95", "Award text, active station, organisation"], ["--lilac-ink", "#8a3fc0", "Small lilac text, icons"]]) {
    const c = frame(n, { dir: "v", gap: 6, w: 260 });
    add(c, rect(260, 56, { radius: 14, fill: solid(hex(h)) }), await text(n, { size: 15, weight: 700 }), await text(`${h} · ${use}`, { size: 13, color: "inkMuted", width: 260 }));
    add(row, c);
  }
  row = await group(b, "Elevation", "Four levels. Never invent shadows.");
  for (const [n, e] of [["--shadow-1 · chips, alerts", SH.s1], ["--shadow · cards", SH.card], ["--shadow-2 · section cards", SH.s2], ["--shadow-3 · overlays", SH.s3]]) {
    const c = frame(n, { dir: "v", gap: 10 });
    add(c, rect(200, 110, { radius: 24, fill: WHITE(), effects: [e] }), await text(n, { size: 14, weight: 600 }));
    add(row, c);
  }
  row = await group(b, "Layers & durations", null);
  add(row, await text("z-index  sticky 30 · nav 40 · drawer 60 · dialog 70 · toast 80 · tooltip 90\nduration press 180ms · fast 250ms · base 450ms · slow 800ms\ncurves  --ease (0.22,1,0.36,1) · --spring (0.5,1.35,0.4,1) · --bounce (0.34,1.45,0.5,1)", { code: true, size: 14, lh: 1.8, color: "inkSoft" }));
  return b;
}

async function readMe(page) {
  const out = [];
  // cover
  const cover = frame("Cover", { dir: "v", gap: 24, pad: 96, radius: 40, fill: grad(["#1d1240", "#120c26", "#1a1036"], "d") });
  cover.resize(1600, 100); cover.counterAxisSizingMode = "FIXED"; cover.primaryAxisSizingMode = "AUTO"; cover.setPluginData("tag", TAG);
  page.appendChild(cover);
  add(cover, await text("GenAI Genesis 2027 · Web design system · v1.3", { size: 14, weight: 700, upper: true, ls: 8, color: "mint" }));
  const ttl = frame("title", { dir: "h", gap: 22 });
  add(ttl, await text("Build what", { size: 112, weight: 500, lh: 1.02, ls: -3.5, color: "#ffffff" }), await text("next.", { size: 112, weight: 700, lh: 1.02, ls: -3.5, color: "mint" }));
  add(cover, ttl, await text("Tokens, type, components, illustration and guardrails for every page of genaigenesis.ca. Everything maps 1:1 to design/system/ds.css — link it, then build only from what's here. The landing page is the reference; the judge application is the template for form pages.", { size: 20, lh: 1.45, color: "#ffffff", width: 980 }));
  const nav = frame("pages", { dir: "h", gap: 16 });
  for (const [k, v] of [["01", "Read me — vocabulary, rules, how to build a page"], ["02", "Foundations — colour, type, space, elevation, motion (+ v1.3 additions)"], ["03", "Components — landing parts + the extended library + skyline"]]) {
    const c = frame(k, { dir: "v", gap: 6, pad: 24, radius: 20, w: 440, fill: WHITE(0.08) });
    add(c, await text(k, { size: 15, weight: 700, color: "mint" }), await text(v, { size: 16, color: "#ffffff", width: 392 })); add(nav, c);
  }
  add(cover, nav); out.push(cover);

  const blocks = [
    ["The site's vocabulary", "Build new parts from these — not from a generic UI kit.", [
      ["Pills with tinted rings", "White or glass pills with a 1px tinted ring: the award pill, the candid hint, the partner button. Badges, chips, danger buttons all come from here."],
      ["Candid-card gradients", "Mint, lilac, peach, pink. The only fills for tiles, avatars, empty states and status. No traffic-light colours."],
      ["Metro stations", "White dot, ink ring, mint halo when current, aqua when passed. Radios, timelines, 'live' dots."],
      ["Ink pills", "Toasts, tooltips, selected tabs/chips, the current page number."],
      ["The sponsor-wall card", "Dark gradient #1d1240 → #120c26 with a mint glow from the top: anything dark (code, dark dialogs, dark-mode cards)."],
      ["Mint underlines", "Links are ink with a 2px mint underline. Never blue, never violet."],
    ]],
    ["Guardrails", "Hard rules for every page. Anything not covered: ask design.", [
      ["Legibility over art", "Text never sits on 3D, the train, globe or glow. Use a text surface or the frosted nav."],
      ["One Primary per screen", "One mint button per viewport; Ink/Glass for the rest; Partner only for 'Partner with us'."],
      ["One status line", "Application-status copy comes from one place and is identical everywhere."],
      ["One accent word", "At most one mint or lilac word per heading, usually the last."],
      ["Contrast", "Body ≥ 4.5:1, large ≥ 3:1, both themes. --mint-deep is large text only; small mint is --mint-ink."],
      ["Pills mean status", "Badges for status, chips for filters. Facts go in the fact sheet or stats."],
      ["Tokens only", "No raw hex, no new shadows, no greys, no square corners, no second font (code excepted)."],
      ["Motion", "--ease by default, --spring only into place, 180–900ms; everything off under reduced motion."],
      ["Mobile ≤ 760px", "Single column, 44px targets, 2-col full-width buttons, nothing over the hero headline."],
      ["Skyline once", "One skyline per page, card-wide, standing on a section card. Never full-bleed."],
    ]],
    ["How to build a page", "Engineers: this is the whole workflow.", [
      ["1 · Start from a template", "Landing sections or the judge application (form pages). Copy markup, don't start blank."],
      ["2 · Link the system", "Google Sans Flex, design/system/ds.css, your page CSS (layout only), ds.js (defer), and the gag-theme line in <head>."],
      ["3 · Assemble from parts", "Every part here has a ds.css class; the gallery (design/system/index.html) shows them live in both themes."],
      ["4 · Check", "1440 / 1000 / 760 / 390 / 360px, light + dark, reduced motion, Lighthouse a11y ≥ 95."],
      ["5 · Review", "Post light, dark and phone screenshots. Review order: structure → tokens → type → components → hierarchy → illustration → responsive/a11y → copy."],
      ["Next templates", "Hacker application · Schedule · Prizes & tracks · Judges & mentors · Hacker guide · Code of conduct · 404."],
    ]],
  ];
  for (const [title, intro, items] of blocks) {
    const b = frame(title, { dir: "v", gap: 28, pad: 64, radius: 32, fill: WHITE(0.92), effects: [SH.s2] });
    b.resize(1600, 100); b.counterAxisSizingMode = "FIXED"; b.primaryAxisSizingMode = "AUTO"; b.setPluginData("tag", TAG);
    page.appendChild(b);
    add(b, await text(title, { size: 48, weight: 600, lh: 1.08, ls: -3 }), await text(intro, { size: 19, color: "inkSoft" }));
    const grid = frame("items", { dir: "h", gap: 24, wrap: true, wrapGap: 24 }); add(b, grid); fill(grid);
    let i = 1;
    for (const [h, body] of items) {
      const c = frame(h, { dir: "v", gap: 10, pad: 28, radius: 24, w: 472, fill: GLASS(), stroke: WHITE(0.85) });
      add(c, await text(String(i++).padStart(2, "0"), { size: 14, weight: 700, color: "lilacInk" }), await text(h, { size: 20, weight: 700, lh: 1.2 }), await text(body, { size: 16, color: "inkSoft", width: 416 }));
      add(grid, c);
    }
    out.push(b);
  }
  return out;
}

/* ================================================================== run */
function stack(nodes, x0, y0, gap = 120) { let y = y0; for (const n of nodes) { if (!n) continue; n.x = x0; n.y = y; y += n.height + gap; } return y; }
function bottomOf(page, except) { let m = 0; for (const n of page.children) { if (except.includes(n)) continue; m = Math.max(m, n.y + n.height); } return m; }
function rightOf(page, except) { let m = 0; for (const n of page.children) { if (except.includes(n)) continue; m = Math.max(m, n.x + n.width); } return m; }

async function run() {
  await figma.loadAllPagesAsync();
  await loadFonts();
  await loadVariables();
  // remove everything this plugin made last time
  for (const pg of figma.root.children) for (const n of pg.findAll((x) => x.getPluginData && x.getPluginData("tag") === TAG)) { try { n.remove(); } catch (e) {} }

  const before = new Set();
  for (const pg of figma.root.children) for (const n of pg.children) before.add(n.id);
  const pages = figma.root.children;
  const find = (re, i) => pages.find((p) => re.test(p.name)) || pages[i] || pages[0];
  const pRead = find(/read ?me|guideline/i, 0), pFound = find(/foundation/i, 1), pComp = find(/component/i, 2);

  const steps = [
    ["Tokens & styles", async () => buildTokens()],
    ["Read me", async () => { const nodes = await readMe(pRead); const keep = pRead.children.filter((n) => !nodes.includes(n)); const y = keep.length ? bottomOf(pRead, nodes) + 200 : 0; stack(nodes, 0, y); }],
    ["Foundations", async () => { const b = await foundationsBoard(pFound); const others = pFound.children.filter((n) => n !== b); b.x = others.length ? rightOf(pFound, [b]) + 200 : 0; b.y = 0; }],
    ["Components", async () => {
      const made = [];
      for (const fn of [sectionActions, sectionForms, sectionStatus, sectionOverlays, sectionNav, sectionContent, sectionIllustration]) {
        try { made.push(await fn(pComp)); } catch (e) { note(`${fn.name} failed: ${e.message}`); }
      }
      const x = rightOf(pComp, made) + 240;
      stack(made, x, 0, 160);
    }],
  ];
  for (const [name, fn] of steps) {
    try { await fn(); note(`✓ ${name}`); } catch (e) { note(`✗ ${name}: ${e && e.message}`); console.error(e); }
  }
  // anything a failed step left loose at a page's top level is removed, so a re-run starts clean
  for (const pg of figma.root.children) for (const n of [...pg.children]) if (!before.has(n.id) && n.getPluginData("tag") !== TAG) { try { n.remove(); } catch (e) {} }
  await figma.setCurrentPageAsync(pComp);
  const tagged = pComp.children.filter((n) => n.getPluginData("tag") === TAG);
  if (tagged.length) figma.viewport.scrollAndZoomIntoView(tagged);
  console.log(log.join("\n"));
  const failed = log.filter((l) => l.startsWith("✗") || l.includes("failed"));
  figma.closePlugin(failed.length ? `Done with ${failed.length} issue(s) — see the console (Plugins → Development → Show/Hide console)` : "GenAI Genesis design system v1.3 is in the file ✓");
}
run().catch((e) => { console.error(e); figma.closePlugin("Plugin error: " + e.message); });
