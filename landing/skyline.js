/* GenAI Genesis — illustrated Toronto skyline (flat SVG, no dependencies)
 *
 * The building illustrations from the judge sign-up art, redrawn in the site palette:
 * white, lavender, lilac and periwinkle blocks with purple window grids, a few lit windows,
 * thin white "circuit" traces and mint glow strips. Every colour is a CSS custom property
 * (--sk-*, see styles.css), so dark mode re-tints the art without new files.
 *
 *   <div class="skyline skyline-card" data-skyline="card"></div>   → rendered by mountSkylines()
 *
 * Presets are hand-composed (not random) so each placement reads as a deliberate scene;
 * the RNG only decides which windows are lit, and is seeded so the art never changes
 * between visits. buildingSVG() / PRESETS are also used by tools/export-skyline.mjs to
 * write the standalone SVGs in design/skyline/ for Figma.
 */

/* ---------------------------------------------------------------- helpers */
function rng(seed) {             // mulberry32: small, stable, seedable
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r1 = (n) => Math.round(n * 10) / 10;
const rect = (x, y, w, h, fill, extra = "") => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="${fill}"${extra}/>`;
const poly = (pts, fill, extra = "") => `<polygon points="${pts.map((p) => p.map(r1).join(",")).join(" ")}" fill="${fill}"${extra}/>`;

/* gradients shared by every building in one SVG (ids are prefixed per SVG) */
const TONES = {
  white: ["--sk-white-a", "--sk-white-b"],
  lilac: ["--sk-lilac-a", "--sk-lilac-b"],
  peri: ["--sk-peri-a", "--sk-peri-b"],
  side: ["--sk-side-a", "--sk-side-b"],
  glass: ["--sk-glass-a", "--sk-glass-b"],
};
function defs(p) {
  const v = Object.entries(TONES).map(([k, [a, b]]) =>
    `<linearGradient id="${p}-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(${a})"/><stop offset="1" style="stop-color:var(${b})"/></linearGradient>`).join("");
  const drum = `<linearGradient id="${p}-drum" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--sk-side-b)"/><stop offset=".45" style="stop-color:var(--sk-white-a)"/><stop offset="1" style="stop-color:var(--sk-peri-b)"/></linearGradient>`;
  const dome = `<radialGradient id="${p}-dome" cx=".35" cy=".25" r=".9"><stop offset="0" style="stop-color:var(--sk-white-a)"/><stop offset=".55" style="stop-color:var(--sk-peri-a)"/><stop offset="1" style="stop-color:var(--sk-peri-b)"/></radialGradient>`;
  const cloud = `<linearGradient id="${p}-cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sk-cloud-a)"/><stop offset="1" style="stop-color:var(--sk-cloud-b)"/></linearGradient>`;
  return `<defs>${v}${drum}${dome}${cloud}</defs>`;
}
const G = (p, k) => `url(#${p}-${k})`;

/* window grid: purple panes, a few lit ones */
function windows(R, x, y, w, h, { cell = 10, pane = 6.4, lit = 0.12, round = 1 } = {}) {
  const cols = Math.max(1, Math.floor((w + (cell - pane)) / cell));
  const rows = Math.max(1, Math.floor((h + (cell - pane)) / cell));
  const ox = x + (w - (cols * cell - (cell - pane))) / 2;
  let s = "", l = "";
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const on = R() < lit;
    const piece = `<rect x="${r1(ox + i * cell)}" y="${r1(y + j * cell)}" width="${pane}" height="${pane}" rx="${round}"/>`;
    if (on) l += piece; else s += piece;
  }
  return `<g fill="var(--sk-win)">${s}</g><g class="sk-lit" fill="var(--sk-lit)">${l}</g>`;
}

/* a thin white circuit trace: up, a 45° jog, up again, ending in a dot */
function trace(x, y0, y1, jog, dir = 1) {
  const m = y0 + (y1 - y0) * 0.55;
  const pts = [[x, y0], [x, m], [x + jog * dir, m - Math.abs(jog)], [x + jog * dir, y1]];
  return `<polyline points="${pts.map((p) => p.map(r1).join(",")).join(" ")}" fill="none" stroke="var(--sk-line)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${r1(x + jog * dir)}" cy="${r1(y1)}" r="2.4" fill="var(--sk-line)"/>`;
}

/* ------------------------------------------------------------- buildings
 * Each takes the shared prefix p, the ground line gy, a seeded R, and its own options.
 * x is the left edge of the whole building (side face included); w the full width. */
const B = {
  /* window-grid tower: the most common block */
  grid(p, gy, R, { x, w, h, tone = "lilac", side = "l", lit = 0.12 }) {
    const sw = Math.round(w * 0.2), fw = w - sw, fx = side === "l" ? x + sw : x, sx = side === "l" ? x : x + fw;
    return rect(sx, gy - h + 6, sw, h - 6, G(p, "side")) +
      rect(fx, gy - h, fw, h, G(p, tone)) +
      rect(fx, gy - h, fw, 7, "var(--sk-cap)") +
      windows(R, fx + 9, gy - h + 18, fw - 18, h - 18, { lit });
  },

  /* banded slab: alternating white floors and glass strips, mint glow on some floors, a set-back crown */
  bands(p, gy, R, { x, w, h, side = "r", floor = 24 }) {
    const sw = Math.round(w * 0.22), fw = w - sw, fx = side === "l" ? x + sw : x, sx = side === "l" ? x : x + fw;
    const crown = Math.round(h * 0.16), body = h - crown;
    let s = rect(sx, gy - body + 4, sw, body - 4, G(p, "side")) + rect(fx, gy - body, fw, body, G(p, "white"));
    for (let y = gy - body + 10, k = 0; y < gy - 6; y += floor, k++) {
      s += rect(fx, y, fw, floor * 0.42, G(p, "glass"));
      s += rect(sx, y + 2, sw, floor * 0.42, "var(--sk-side-b)", ` opacity=".7"`);
      if (k % 3 === 1) s += rect(fx, y + floor * 0.42 + 2, fw, 2.2, "var(--sk-glow)", ` class="sk-glow"`);
    }
    const cw = fw * 0.62, cx = side === "l" ? fx + fw - cw : fx;   // crown hugs the far side
    s += rect(cx, gy - h, cw, crown, G(p, "white")) + rect(cx, gy - h + crown * 0.45, cw, crown * 0.3, G(p, "glass"));
    s += rect(side === "l" ? cx - sw * 0.6 : cx + cw, gy - h + 3, sw * 0.6, crown - 3, G(p, "side"));
    return s;
  },

  /* circuit spire: tall and thin, slanted roof, white traces, short lit slots */
  spire(p, gy, R, { x, w, h, tone = "lilac", side = "r", slant = 0.12 }) {
    const sw = Math.round(w * 0.3), fw = w - sw, fx = side === "l" ? x + sw : x, sx = side === "l" ? x : x + fw;
    const top = gy - h, drop = h * slant;
    const hiL = side === "r";                       // the roof rises toward the side face
    let s = poly([[sx, top + (hiL ? drop * 0.6 : 0)], [sx + sw, top + (hiL ? 0 : drop * 0.6)], [sx + sw, gy], [sx, gy]], G(p, "side"));
    s += poly([[fx, top + (hiL ? drop : 0)], [fx + fw, top + (hiL ? 0 : drop)], [fx + fw, gy], [fx, gy]], G(p, tone));
    s += trace(fx + fw * 0.3, gy, top + drop + 40, fw * 0.18, 1);
    s += trace(fx + fw * 0.62, gy, top + drop + 90, fw * 0.16, -1);
    const slotX = side === "r" ? sx + sw * 0.22 : sx + sw * 0.22;
    for (let y = top + drop + 30, k = 0; y < gy - 40; y += 46 + k * 4, k++) {
      if (R() < 0.75) s += `<rect class="sk-lit" x="${r1(slotX)}" y="${r1(y)}" width="${r1(sw * 0.56)}" height="5" rx="2.5" fill="var(--sk-lit)"/>`;
    }
    return s;
  },

  /* gabled block with a window grid and a round emblem */
  gable(p, gy, R, { x, w, h, tone = "lilac", side = "r", lit = 0.16 }) {
    const sw = Math.round(w * 0.32), fw = w - sw, fx = side === "l" ? x + sw : x, sx = side === "l" ? x : x + fw;
    const roof = fw * 0.32, top = gy - h;
    let s = rect(sx, top + roof * 0.55, sw, h - roof * 0.55, G(p, "side"));
    s += poly([[sx, top + roof * 0.55], [sx + sw, top + roof * 0.55], [sx + sw + (side === "r" ? -6 : 6), top + roof * 0.2], [sx + (side === "r" ? -2 : 2), top + roof * 0.2]], "var(--sk-cap)");
    s += poly([[fx, top + roof], [fx + fw / 2, top], [fx + fw, top + roof], [fx + fw, gy], [fx, gy]], G(p, tone));
    s += `<circle cx="${r1(fx + fw / 2)}" cy="${r1(top + roof * 0.72)}" r="${r1(fw * 0.07)}" fill="none" stroke="var(--sk-line)" stroke-width="1.6"/>`;
    s += windows(R, fx + 8, top + roof + 14, fw - 16, h - roof - 14, { lit, cell: 11, pane: 7.2 });
    return s;
  },

  /* dome stadium (a nod to the Rogers Centre roof) with circuit cracks */
  dome(p, gy, R, { x, w, h }) {
    const cx = x + w / 2, ry = h * 0.86, base = h - ry;
    let s = rect(x + w * 0.04, gy - base, w * 0.92, base, G(p, "side"));
    for (let i = 0, n = Math.floor(w / 16); i < n; i++) s += rect(x + w * 0.07 + i * (w * 0.86 / n), gy - base + 5, w * 0.86 / n - 5, base - 9, "var(--sk-win)", ` opacity=".55"`);
    s += `<path d="M${r1(x)},${r1(gy - base)} A${r1(w / 2)},${r1(ry)} 0 0 1 ${r1(x + w)},${r1(gy - base)} Z" fill="${G(p, "dome")}"/>`;
    s += `<path d="M${r1(x + 6)},${r1(gy - base)} A${r1(w / 2 - 6)},${r1(ry - 6)} 0 0 1 ${r1(x + w - 6)},${r1(gy - base)}" fill="none" stroke="var(--sk-line)" stroke-width="2.2" opacity=".9"/>`;
    const lines = [[0.3, 0.2, 0.42, 0.62], [0.55, 0.12, 0.6, 0.55], [0.72, 0.3, 0.8, 0.7]];
    for (const [a, b, c, d] of lines) {
      const y0 = gy - base - ry * b, y1 = gy - base - ry * d;
      s += `<polyline points="${r1(x + w * a)},${r1(y0)} ${r1(x + w * (a + c) / 2)},${r1((y0 + y1) / 2)} ${r1(x + w * c)},${r1(y1)}" fill="none" stroke="var(--sk-line)" stroke-width="1.4" opacity=".85"/>`;
    }
    return s;
  },

  /* tilted drum: a cylinder sliced at an angle (the reference's cut-cylinder tower) */
  drum(p, gy, R, { x, w, h }) {
    const rx = w / 2, cx = x + rx, top = gy - h, ery = w * 0.36;
    let s = `<path d="M${r1(x)},${r1(top + ery)} L${r1(x)},${r1(gy)} L${r1(x + w)},${r1(gy)} L${r1(x + w)},${r1(top - ery * 0.2)} Z" fill="${G(p, "drum")}"/>`;
    s += `<ellipse cx="${r1(cx)}" cy="${r1(top + ery * 0.4)}" rx="${r1(rx * 1.06)}" ry="${r1(ery * 0.62)}" transform="rotate(-24 ${r1(cx)} ${r1(top + ery * 0.4)})" fill="var(--sk-white-a)"/>`;
    s += `<ellipse cx="${r1(cx + 2)}" cy="${r1(top + ery * 0.43)}" rx="${r1(rx * 0.86)}" ry="${r1(ery * 0.46)}" transform="rotate(-24 ${r1(cx)} ${r1(top + ery * 0.4)})" fill="${G(p, "lilac")}"/>`;
    return s;
  },

  /* glass prism: tinted glass with diagonal mint light lines */
  prism(p, gy, R, { x, w, h, side = "l" }) {
    const sw = Math.round(w * 0.24), fw = w - sw, fx = side === "l" ? x + sw : x, sx = side === "l" ? x : x + fw, top = gy - h;
    let s = rect(sx, top + 8, sw, h - 8, G(p, "side")) + rect(fx, top, fw, h, G(p, "glass"));
    s += `<clipPath id="${p}-pc${Math.round(x)}"><rect x="${fx}" y="${top}" width="${fw}" height="${h}"/></clipPath><g clip-path="url(#${p}-pc${Math.round(x)})">`;
    for (const k of [0.22, 0.48, 0.74]) s += `<line class="sk-glow" x1="${r1(fx - 10)}" y1="${r1(top + h * k + fw * 0.5)}" x2="${r1(fx + fw + 10)}" y2="${r1(top + h * k - fw * 0.35)}" stroke="var(--sk-glow)" stroke-width="2.4" stroke-linecap="round"/>`;
    s += `</g>` + rect(fx, top, fw, 5, "var(--sk-cap)");
    s += trace(fx + fw * 0.82, gy, top + h * 0.3, -fw * 0.14, 1);
    return s;
  },

  /* a small, flat CN Tower for the back row (the 3D model stays the hero) */
  cn(p, gy, R, { x, h }) {
    const cx = x, top = gy - h, podY = gy - h * 0.64, skyY = gy - h * 0.8, base = h * 0.06, neck = h * 0.016;
    let s = poly([[cx - base, gy], [cx - neck, podY], [cx + neck, podY], [cx + base, gy]], G(p, "white"));
    s += poly([[cx + neck * 0.2, podY], [cx + neck, podY], [cx + base, gy], [cx + base * 0.25, gy]], "var(--sk-side-a)");   // shaded half
    s += `<rect x="${r1(cx - 1.8)}" y="${r1(top)}" width="3.6" height="${r1(skyY - top)}" rx="1.8" fill="var(--sk-white-a)"/>`;
    s += `<rect x="${r1(cx - neck * 0.9)}" y="${r1(skyY)}" width="${r1(neck * 1.8)}" height="${r1(podY - skyY)}" fill="var(--sk-white-b)"/>`;
    s += `<rect x="${r1(cx - h * 0.028)}" y="${r1(skyY - 5)}" width="${r1(h * 0.056)}" height="10" rx="5" fill="${G(p, "lilac")}"/>`;
    const pw = h * 0.2;
    s += `<rect x="${r1(cx - pw * 0.42)}" y="${r1(podY - 22)}" width="${r1(pw * 0.84)}" height="9" rx="4.5" fill="var(--sk-white-a)"/>`;
    s += `<rect x="${r1(cx - pw / 2)}" y="${r1(podY - 14)}" width="${r1(pw)}" height="18" rx="9" fill="${G(p, "lilac")}"/>`;
    s += `<rect class="sk-glow" x="${r1(cx - pw / 2 + 3)}" y="${r1(podY - 6)}" width="${r1(pw - 6)}" height="3" rx="1.5" fill="var(--sk-glow)"/>`;
    s += `<rect x="${r1(cx - pw * 0.36)}" y="${r1(podY + 4)}" width="${r1(pw * 0.72)}" height="11" rx="5.5" fill="var(--sk-white-a)"/>`;
    return s;
  },

  /* puffy cloud (sits behind the back row) */
  cloud(p, gy, R, { x, w, y }) {
    const h = w * 0.42, b = y + h;
    const bumps = [[0.18, 0.62, 0.2], [0.38, 0.38, 0.26], [0.62, 0.45, 0.22], [0.82, 0.68, 0.16]];
    let s = `<g fill="${G(p, "cloud")}">`;
    for (const [cx, cy, r] of bumps) s += `<circle cx="${r1(x + w * cx)}" cy="${r1(y + h * cy)}" r="${r1(w * r)}"/>`;
    s += `<rect x="${r1(x + w * 0.04)}" y="${r1(y + h * 0.62)}" width="${r1(w * 0.92)}" height="${r1(h * 0.38)}" rx="${r1(h * 0.19)}"/></g>`;
    return s;
  },
};

/* ------------------------------------------------------------------ presets
 * [type, opts]; layer "back" is paler and sits behind "front". Coordinates are in the
 * preset's viewBox; the ground line is the bottom edge. */
export const PRESETS = {
  /* the site's one placement: standing on the sponsor wall, card-wide, ends complete */
  card: { w: 1320, h: 300, seed: 13, items: [
    ["cloud", { x: 70, y: 40, w: 230 }], ["cloud", { x: 960, y: 36, w: 270 }], ["cloud", { x: 360, y: 84, w: 170 }],
    ["grid", { layer: "back", x: 150, w: 100, h: 200, tone: "peri" }], ["cn", { layer: "back", x: 640, h: 296 }],
    ["bands", { layer: "back", x: 760, w: 120, h: 170 }], ["spire", { layer: "back", x: 1150, w: 72, h: 230, tone: "peri" }],
    ["gable", { x: 0, w: 120, h: 130, tone: "peri" }], ["grid", { x: 110, w: 120, h: 220, tone: "lilac", side: "r" }],
    ["bands", { x: 240, w: 150, h: 160, side: "r" }], ["spire", { x: 390, w: 84, h: 250, tone: "lilac", side: "r" }],
    ["dome", { x: 500, w: 210, h: 110 }], ["drum", { x: 720, w: 76, h: 160 }],
    ["grid", { x: 810, w: 120, h: 230, tone: "white", side: "l" }], ["prism", { x: 940, w: 110, h: 190 }],
    ["gable", { x: 1060, w: 120, h: 140 }], ["spire", { x: 1180, w: 80, h: 220, tone: "lilac", side: "l" }],
    ["grid", { x: 1250, w: 70, h: 150, tone: "peri", side: "l" }],
  ] },
  /* the far end of the TTC street (finale): a long low city, no CN Tower (the 3D one is there) */
  horizon: { w: 1600, h: 220, seed: 29, items: [
    ["grid", { layer: "back", x: 80, w: 90, h: 150, tone: "peri" }], ["bands", { layer: "back", x: 420, w: 110, h: 130 }],
    ["spire", { layer: "back", x: 700, w: 64, h: 190, tone: "peri" }], ["grid", { layer: "back", x: 1000, w: 100, h: 160, tone: "white" }],
    ["spire", { layer: "back", x: 1380, w: 60, h: 170, tone: "lilac" }],
    ["gable", { x: 0, w: 110, h: 100, tone: "peri" }], ["grid", { x: 100, w: 110, h: 170, tone: "lilac", side: "r" }],
    ["bands", { x: 220, w: 140, h: 120, side: "r" }], ["prism", { x: 370, w: 100, h: 150 }],
    ["drum", { x: 480, w: 70, h: 130 }], ["grid", { x: 560, w: 110, h: 190, tone: "white", side: "l" }],
    ["dome", { x: 680, w: 190, h: 96 }], ["spire", { x: 880, w: 76, h: 200, tone: "lilac", side: "r" }],
    ["gable", { x: 960, w: 120, h: 120 }], ["bands", { x: 1090, w: 140, h: 140, side: "l" }],
    ["grid", { x: 1240, w: 110, h: 180, tone: "lilac", side: "l" }], ["prism", { x: 1360, w: 96, h: 130, side: "r" }],
    ["gable", { x: 1470, w: 120, h: 110, tone: "peri", side: "l" }],
  ] },
};
/* drifting cloud layers for the finale's horizon (a separate, horizontally repeating texture) */
export const CLOUDS = { w: 1600, h: 200, items: [
  { x: 40, y: 50, w: 260 }, { x: 420, y: 90, w: 180 }, { x: 760, y: 40, w: 300 }, { x: 1180, y: 80, w: 220 },
] };

let uid = 0;
/* clouds drift left → right forever: two copies one width apart, moved by CSS (.sk-drift),
   faded in and out at the edges by a mask so none of them is ever cut off hard */
function cloudLayer(p, P, R) {
  const clouds = P.items.filter(([t]) => t === "cloud");
  if (!clouds.length) return "";
  const one = (dx) => clouds.map(([, o]) => B.cloud(p, P.h, R, { ...o, x: o.x + dx })).join("");
  return `<mask id="${p}-edge" maskUnits="userSpaceOnUse" x="0" y="0" width="${P.w}" height="${P.h}">` +
    `<linearGradient id="${p}-edge-g" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset=".1" stop-color="#fff"/><stop offset=".9" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>` +
    `<rect width="${P.w}" height="${P.h}" fill="url(#${p}-edge-g)"/></mask>` +
    `<g class="sk-clouds" mask="url(#${p}-edge)"><g class="sk-drift" style="--drift:${P.w}px">${one(0)}${one(-P.w)}</g></g>`;
}

/** Render one preset to an SVG string. */
export function skylineSVG(name, { idPrefix } = {}) {
  const P = PRESETS[name];
  if (!P) return "";
  const p = idPrefix || `sk${++uid}`;
  const R = rng(P.seed);
  const draw = (layer) => P.items.filter(([t, o]) => t !== "cloud" && (o.layer || "front") === layer)
    .map(([t, o], i) => `<g class="sk-b" style="--i:${i}">${B[t](p, P.h, R, o)}</g>`).join("");
  return `<svg viewBox="0 0 ${P.w} ${P.h}" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">${defs(p)}` +
    cloudLayer(p, P, R) + `<g class="sk-back">${draw("back")}</g><g class="sk-front">${draw("front")}</g></svg>`;
}

/** Bake the CSS colours into a standalone SVG (for canvas textures and file exports).
 *  resolve(name) returns the value of a --sk-* custom property. */
export function bakeSVG(svg, resolve) {
  return svg.replace(/var\((--sk-[\w-]+)\)/g, (_, k) => resolve(k))
    .replace(/style="stop-color:([^"]+)"/g, 'stop-color="$1"')
    .replace(/<g class="sk-back">/, '<g opacity="0.55">')
    .replace(/ class="[^"]*"/g, "").replace(/ style="--[^"]*"/g, "")
    .replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ');
}

/** The horizon city and its cloud strip as baked SVG strings (the finale draws them into textures). */
export function horizonSVGs(resolve) {
  const city = bakeSVG(skylineSVG("horizon", { idPrefix: "hz" }), resolve);
  const C = CLOUDS, R = rng(3);
  const clouds = bakeSVG(`<svg viewBox="0 0 ${C.w} ${C.h}">${defs("hc")}${C.items.map((o) => B.cloud("hc", C.h, R, o)).join("")}</svg>`, resolve);
  return { city, clouds, cityAspect: PRESETS.horizon.w / PRESETS.horizon.h, cloudAspect: C.w / C.h };
}

/** Render a single building on its own (used by the Figma export). */
export function buildingSVG(type, opts, { pad = 10, seed = 11 } = {}) {
  const isCloud = type === "cloud";
  const w = opts.w + pad * 2, h = (isCloud ? opts.w * 0.42 + opts.w * 0.12 : opts.h) + pad;
  const x = type === "cn" ? w / 2 : pad;
  return `<svg viewBox="0 0 ${r1(w)} ${r1(h)}" width="${r1(w)}" height="${r1(h)}">${defs("b")}${B[type]("b", h, rng(seed), { ...opts, x, y: isCloud ? opts.w * 0.06 : undefined })}</svg>`;
}

/** Fill every [data-skyline] element once; reveal the buildings when they scroll into view. */
export function mountSkylines({ reduced = false } = {}) {
  const els = [...document.querySelectorAll("[data-skyline]")];
  if (!els.length) return;
  for (const el of els) el.innerHTML = skylineSVG(el.dataset.skyline);
  if (reduced || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      en.target.classList.toggle("in", en.isIntersecting || en.boundingClientRect.top < 0);
      en.target.classList.toggle("live", en.isIntersecting);   // window twinkle only while on screen
    }
  }, { threshold: 0.12 });
  els.forEach((el) => io.observe(el));
}
