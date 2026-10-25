/**
 * GenAI Genesis landing page — scroll orchestration.
 *
 *  Lenis smooth scroll ─► update() per frame while scrolling
 *     ├─ story chapters  → Toronto city: camera pose, city turning, buildings rising
 *     ├─ borders section → metro map: scroll moves along the line, stations swell; backdrop turns white;
 *     │                    the snow globe becomes the Earth along the bottom, turning with the line
 *     └─ finale          → subway train: windows reveal the team, then the CTA
 *  The city renders on demand (scroll / hover). The train runs a frame loop only
 *  while the finale is on screen, so its wind keeps blowing when you stop scrolling.
 *
 *  Fallbacks: prefers-reduced-motion → native scroll, no reveals, still frames.
 *             No WebGL → canvas hidden, page fully readable.
 *             Low-end hint (≤4 cores or ≤4 GB) → pixel ratio 1, no antialias.
 */
import * as THREE from "three";
import Lenis from "lenis";
import { createCity, PASTEL } from "./city.js";
import { createStreetcar } from "./streetcar.js";
import { createBackdrop } from "./backdrop.js";
import { createFerry } from "./ferry.js";

const reduced = document.documentElement.classList.contains("reduced-motion");
const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;   // low-end hint
const coarse = matchMedia("(pointer: coarse)").matches;                                          // touch screen
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/* ------------------------------------------------------------------ content */
// Placeholder stations — replace with the confirmed attendee country list.
const COUNTRIES = [
  ["CAN", "Canada"], ["USA", "United States"], ["MEX", "Mexico"], ["BRA", "Brazil"], ["COL", "Colombia"],
  ["PER", "Peru"], ["ARG", "Argentina"], ["GBR", "United Kingdom"], ["IRL", "Ireland"], ["FRA", "France"],
  ["DEU", "Germany"], ["NLD", "Netherlands"], ["CHE", "Switzerland"], ["ITA", "Italy"], ["ESP", "Spain"],
  ["POL", "Poland"], ["UKR", "Ukraine"], ["TUR", "Türkiye"], ["EGY", "Egypt"], ["NGA", "Nigeria"],
  ["GHA", "Ghana"], ["KEN", "Kenya"], ["ZAF", "South Africa"], ["ARE", "UAE"], ["SAU", "Saudi Arabia"],
  ["IRN", "Iran"], ["PAK", "Pakistan"], ["IND", "India"], ["BGD", "Bangladesh"], ["LKA", "Sri Lanka"],
  ["SGP", "Singapore"], ["VNM", "Vietnam"], ["PHL", "Philippines"], ["CHN", "China"], ["KOR", "South Korea"],
  ["JPN", "Japan"], ["AUS", "Australia"],
];
const line = $("#line");
const stopCode = (i) => `${String(i + 1).padStart(2, "0")} · ${COUNTRIES[i][0]}`;
line.innerHTML = COUNTRIES.map(([code, name], i) => {
  const terminal = i === 0 || i === COUNTRIES.length - 1;
  return `<li class="stop${terminal ? " terminal" : ""}"><span class="code">${stopCode(i)}</span><span class="dot"></span>`
    + `<span class="tag" aria-hidden="true"><b>${code}</b><i>${String(i + 1).padStart(2, "0")}</i></span><span class="name">${name}</span></li>`;
}).join("");

/* Metro map: one winding line that fits the screen. Desktop follows the sketch
   (in from the left, up under the heading, across, down, across, then up the
   right side); phones snake back and forth in rows under the heading. Stations
   are spaced evenly along the path. */
const metro = $("#metro");
const metroSvg = metro.querySelector("svg");
const [metroTrack, metroDone] = metro.querySelectorAll("path");
const metroLabel = metro.querySelector(".metro-label");
const stopEls = [...line.children];
let metroPts = [], metroLen = 0, metroHover = -1, metroShown = -1, metroHeadBottom = 0, metroKey = "";
function roundedPath(pts, r) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], [cx, cy] = pts[i + 1];
    const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by), k = Math.min(r, l1 / 2, l2 / 2);
    d += ` L${bx - ((bx - ax) / l1) * k},${by - ((by - ay) / l1) * k} Q${bx},${by} ${bx + ((cx - bx) / l2) * k},${by + ((cy - by) / l2) * k}`;
  }
  const e = pts[pts.length - 1];
  return d + ` L${e[0]},${e[1]}`;
}
function layoutMetro() {
  const W = metro.clientWidth, H = metro.clientHeight;
  if (!W || !H) return;
  const head = $(".borders-head").getBoundingClientRect(), box = metro.getBoundingClientRect();
  const hb = head.bottom - box.top;                       // heading bottom inside the map
  // the path sampling below is heavy (thousands of getPointAtLength calls): only redo it when the
  // map's size or heading actually moved, not on every page-height change (logos loading, FAQ rows…)
  const key = `${W}x${H}x${Math.round(hb)}`;
  if (key === metroKey) return;
  metroKey = key;
  metroHeadBottom = hb;
  const gx = Math.max(24, Math.min(W * 0.06, (W - 1180) / 2 + 40));
  let pts, fixed = null;
  if (W > 760) {
    // Desktop: every straight stretch is a whole number of station gaps, and each bend
    // takes exactly one empty slot, so stations keep one rhythm all the way along the
    // line and every corner has the same gap. Solve for the largest gap that fits.
    const n = stopEls.length, yB = hb + Math.max(84, H * 0.1), yMax = H - 110, yTop = 96;
    const xMax = W - Math.max(80, gx + 40);
    let g = 0, m = null;
    for (let s = 96; s >= 30; s -= 0.5) {
      const m1 = Math.max(2, Math.round((H * 0.15) / s));                 // left riser
      const m3 = Math.floor((yMax - yB) / s);                            // middle riser
      const m5 = Math.floor((yB + m3 * s - yTop) / s);                   // right riser (to the end)
      const rest = n + 4 - 1 - m1 - m3 - m5;                             // slots left for the two rows
      if (m3 < 2 || m5 < 2 || rest < 4) continue;
      const x1 = Math.max(gx, s + 24);
      if (x1 + rest * s > xMax) continue;
      const m2 = Math.round(rest * 0.56), m4 = rest - m2;
      g = s; m = { m1, m2, m3, m4, m5, x1 }; break;
    }
    if (m) {
      const { m1, m2, m3, m4, m5, x1 } = m;
      const yA = yB + m1 * g, x2 = x1 + m2 * g, yC = yB + m3 * g, x3 = x2 + m4 * g, yEnd = yC - m5 * g;
      pts = [[Math.min(-30, x1 - 2 * g), yA], [x1, yA], [x1, yB], [x2, yB], [x2, yC], [x3, yC], [x3, yEnd]];
      fixed = [[x1 - g, yA, false]];
      for (let k = 1; k < m1; k++) fixed.push([x1, yA - k * g, true]);
      for (let k = 1; k < m2; k++) fixed.push([x1 + k * g, yB, false]);
      for (let k = 1; k < m3; k++) fixed.push([x2, yB + k * g, true]);
      for (let k = 1; k < m4; k++) fixed.push([x2 + k * g, yC, false]);
      for (let k = 1; k <= m5; k++) fixed.push([x3, yC - k * g, true]);
    } else {                                                              // very small screens: old even spread
      const yA = Math.min(H - 150, yB + H * 0.15);
      pts = [[-30, yA], [gx, yA], [gx, yB], [W * 0.56, yB], [W * 0.56, yMax], [xMax, yMax], [xMax, Math.max(96, H * 0.12)]];
    }
  } else {
    const top = hb + 40, bottom = H - 108, rows = 4, gap = (bottom - top) / (rows - 1);
    const xl = 26, xr = W - 26;
    pts = [[-30, top]];
    for (let r = 0; r < rows; r++) {
      const y = top + r * gap, toRight = r % 2 === 0;
      pts.push([toRight ? xr : xl, y]);
      if (r < rows - 1) pts.push([toRight ? xr : xl, y + gap]);
    }
  }
  const d = roundedPath(pts, 26);
  metroSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  metroTrack.setAttribute("d", d); metroDone.setAttribute("d", d);
  metroLen = metroTrack.getTotalLength();
  metroDone.style.strokeDasharray = `${metroLen} ${metroLen}`;
  const n = stopEls.length, start = metroLen * 0.03, end = metroLen * 0.97;
  let along = (i) => start + ((end - start) * i) / (n - 1);
  {
    // Stations go on the straight stretches only, kept clear of every corner so the
    // stops either side of a bend (and their tags) get room. Phones use the
    // horizontal rows only; the tight U-turns stay bare.
    const phone = W <= 760, clear = phone ? 10 : 36;
    const straight = [];                                 // [from, to] path lengths of straight stretches
    let from = -1, prev = metroTrack.getPointAtLength(0);
    for (let s = 2; s <= metroLen; s += 2) {
      const pt = metroTrack.getPointAtLength(s);
      const horiz = Math.abs(pt.y - prev.y) < 0.01, vert = Math.abs(pt.x - prev.x) < 0.01;
      const flat = phone ? horiz : horiz || vert;
      if (flat && from < 0) from = s - 2;
      if ((!flat || s + 2 > metroLen) && from >= 0) { straight.push([from, s]); from = -1; }
      prev = pt;
    }
    // trim each stretch: the line's start comes on screen first, its end stops short of
    // the top, and every bend gets `clear` px of bare track on both sides (less on short stretches)
    const runs = [];
    straight.forEach(([a, b], k) => {
      const len = b - a, cap = Math.max(0, (len - 12) / 2);
      const t0 = k === 0 ? 60 : Math.min(clear, cap), t1 = k === straight.length - 1 ? 30 : Math.min(clear, cap);
      if (b - t1 > a + t0) runs.push([a + t0, b - t1]);
    });
    const total = runs.reduce((t, [a, b]) => t + (b - a), 0);
    if (runs.length && total > 0) along = (i) => {
      let d = (total * i) / (n - 1);
      for (const [a, b] of runs) { if (d <= b - a) return a + d; d -= b - a; }
      return runs[runs.length - 1][1];
    };
  }
  // desktop grid: path length of each fixed station, for the travelled-line highlight
  let fixedAt = null;
  if (fixed) {
    const samples = [];
    for (let s = 0; s <= metroLen; s += 2) { const pt = metroTrack.getPointAtLength(s); samples.push([s, pt.x, pt.y]); }
    fixedAt = fixed.map(([x, y]) => samples.reduce((b, c) => (Math.hypot(c[1] - x, c[2] - y) < Math.hypot(b[1] - x, b[2] - y) ? c : b))[0]);
  }
  metroPts = stopEls.map((el, i) => {
    let at, p, vertical;
    if (fixed) { at = fixedAt[i]; p = { x: fixed[i][0], y: fixed[i][1] }; vertical = fixed[i][2]; }
    else {
      at = along(i);
      p = metroTrack.getPointAtLength(at);
      const q = metroTrack.getPointAtLength(Math.min(metroLen, at + 4));
      vertical = Math.abs(q.y - p.y) > Math.abs(q.x - p.x);
    }
    el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    // beside vertical runs: on the right (left only if the run hugs the right screen edge)
    const side = vertical ? (p.x > W - 70 ? "left" : "right") : "below";
    el.dataset.side = side;
    return { x: p.x, y: p.y, at, vertical, side };
  });
  metroShown = -1;
}
function placeMetroLabel(i) {
  if (i === metroShown || !metroPts[i]) return;
  metroShown = i;
  const p = metroPts[i];
  metroLabel.querySelector(".name").textContent = COUNTRIES[i][1];
  const lw = metroLabel.offsetWidth, lh = metroLabel.offsetHeight, W = metro.clientWidth;
  let x, y;
  // the name box sits opposite the station's tag: above horizontal runs, across from it on vertical ones
  if (p.vertical) {
    x = p.side === "left" ? p.x + 28 : p.x - 28 - lw; y = p.y - lh / 2;
    if (x < 12 || x + lw > W - 12) { x = Math.min(W - lw - 12, Math.max(12, p.x - lw / 2)); y = p.y - lh - 30; }
  } else {
    x = Math.min(W - lw - 12, Math.max(12, p.x - lw / 2)); y = p.y - lh - 26;
    if (y < metroHeadBottom + 6) y = p.y + 70;           // no room above (under the heading): below, past the tags
  }
  metroLabel.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  metroLabel.classList.add("swap");
  requestAnimationFrame(() => metroLabel.classList.remove("swap"));
}
// f: continuous position along the stations (0 … n-1)
function setMetroProgress(f) {
  const n = stopEls.length, cur = Math.round(f);
  stopEls.forEach((el, i) => {
    const e = Math.max(0, 1 - Math.abs(i - f) / 1.6);
    const v = (e * e * (3 - 2 * e)).toFixed(2);
    if (el._e !== v) { el._e = v; el.style.setProperty("--e", v); }
    const st = (i < cur ? 1 : 0) + (i === cur ? 2 : 0);
    if (el._st !== st) { el._st = st; el.classList.toggle("passed", i < cur); el.classList.toggle("is-active", i === cur); }
  });
  if (metroLen) {
    const at = metroPts[Math.min(n - 1, Math.floor(f))]?.at ?? 0, nx = metroPts[Math.min(n - 1, Math.ceil(f))]?.at ?? at;
    metroDone.style.strokeDashoffset = (metroLen - (at + (nx - at) * (f - Math.floor(f)))).toFixed(1);
  }
  placeMetroLabel(metroHover >= 0 ? metroHover : cur);
}
stopEls.forEach((el, i) => {
  const dot = el.querySelector(".dot");
  dot.addEventListener("pointerenter", () => { metroHover = i; placeMetroLabel(i); });
  dot.addEventListener("pointerleave", () => { metroHover = -1; requestUpdate(); });
});

// Team — placeholder names until the 2027 roster is final. Add `photo: "url"` to show a real picture.
const TEAM = [
  { name: "Name TBD", role: "Co-Chair" }, { name: "Name TBD", role: "Co-Chair" },
  { name: "Name TBD", role: "VC Design" }, { name: "Name TBD", role: "VC Partnerships" },
  { name: "Name TBD", role: "VC Logistics" }, { name: "Name TBD", role: "VC Marketing" },
  { name: "Name TBD", role: "VC Technology" }, { name: "Name TBD", role: "VC Finance" },
];
$("#crew-list").innerHTML = TEAM.map((m) => `<li>${m.name}, ${m.role}</li>`).join("");
const labelEls = TEAM.map((m) => {
  const el = document.createElement("div");
  el.className = "crew-label";
  el.innerHTML = `<b>${m.name}</b><span>${m.role}</span>`;
  $("#crew-labels").appendChild(el);
  return el;
});

// Past sponsors & partners, by tier (same list, links and order as genaigenesis.ca).
// Logos are the white SVGs in assets/sponsors/; if one is missing, its name shows in type instead.
const SPONSOR_TIERS = [
  ["gold", "Gold sponsors", "2026", [["td", "TD", "https://www.td.com/"]]],
  ["silver", "Silver sponsors", "2026", [["sunlife", "Sunlife", "https://www.sunlife.ca/"], ["bitdeer", "Bitdeer AI", "https://www.bitdeer.ai/"]]],
  ["bronze", "Bronze sponsors", "2026", [["amd", "AMD", "https://www.amd.com/"], ["intuit", "Intuit", "https://www.intuit.com/ca/"]]],
  ["partners", "Partners", "2026", [["google", "Google", "https://about.google/"], ["shopify", "Shopify", "https://www.shopify.com/"],
    ["vector", "Vector Institute", "https://vectorinstitute.ai/"], ["ibm", "IBM", "https://www.ibm.com/"], ["georgian", "Georgian", "https://georgian.io/"]]],
  ["startups", "Startup sponsors", "2026", [["borderpass", "BorderPass", "https://www.borderpass.ai/"], ["yellowcake", "Yellowcake", "https://yellowcake.dev/"],
    ["elevenlabs", "ElevenLabs", "https://elevenlabs.io/"], ["moorcheh", "Moorcheh.ai", "https://moorcheh.ai/"], ["jobster", "Jobster.io", "https://jobster.io/"],
    ["railtown", "Railtown", "https://railtown.ai/"], ["trendmicro", "Trend Micro", "https://www.trendmicro.com/"], ["blueoceangames", "Blue Ocean Games", "https://blueoceangames.com/"]]],
  ["earlier", "Earlier editions", "2025", [["rbc", "RBC", "https://www.rbc.com/"], ["pwc", "PwC", "https://www.pwc.com/ca/en.html"],
    ["cohere", "Cohere", "https://cohere.com/"], ["unac", "United Nations Association in Canada", "https://www.unac.org/"]]],
];
$("#sponsor-tiers").innerHTML = SPONSOR_TIERS.map(([key, title, year, list]) =>
  `<section class="sponsor-tier sponsor-tier-${key}" aria-labelledby="sponsor-tier-${key}" data-logos><h3 id="sponsor-tier-${key}">${title} <span>${year}</span></h3>` +
  `<ul class="sponsor-logos">${list.map(([id, name, href], k) =>
    `<li data-sponsor="${id}" style="--k:${k + 1}"><a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${name} (opens in a new tab)">` +
    `<img alt="${name}" loading="lazy" decoding="async" width="240" height="96" src="assets/sponsors/${id}.svg"></a></li>`).join("")}</ul></section>`).join("");
// candid photos: if one isn't in assets/side-quests/ yet, the card keeps its pastel placeholder
$$(".polaroid .photo img").forEach((img) => {
  const drop = () => img.remove();
  if (img.complete && !img.naturalWidth) drop(); else img.addEventListener("error", drop, { once: true });
});
// Optical sizing: the logos come in every shape (a square crest, a long thin wordmark, artwork
// with padding baked in), so one fixed height makes some look huge and others tiny. Each logo is
// sized by the area of its visible ink instead (measured from the image), so every logo in a tier
// carries about the same visual weight. LOGO_TUNE nudges unusually light or heavy marks by eye.
const LOGO_TUNE = { vector: 1.4, ibm: 0.86, borderpass: 0.84, rbc: 0.88, td: 0.92 };
function inkBox(img) {
  if (img._ink) return img._ink;
  const W = 240, H = Math.max(1, Math.round(W * img.naturalHeight / img.naturalWidth));
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  try {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  } catch (e) { /* unreadable: treat the whole image as ink */ }
  if (x1 < 0) return (img._ink = { fx: 1, fy: 1, cx: 0.5, cy: 0.5, r: W / H });
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  return (img._ink = { fx: bw / W, fy: bh / H, cx: (x0 + bw / 2) / W, cy: (y0 + bh / 2) / H, r: bw / bh });
}
function sizeLogo(img) {
  if (!img.isConnected || !img.naturalWidth) return;
  const li = img.closest("li"), a = img.parentElement;
  const H = parseFloat(getComputedStyle(li).getPropertyValue("--logo-h")) || 76;
  const ink = inkBox(img), m = LOGO_TUNE[li.dataset.sponsor] || 1;
  let ch = H * Math.sqrt(0.9 / ink.r) * m, cw = ch * ink.r;          // equal ink area across shapes
  const maxW = a.clientWidth - 24;                                    // the link's 12px padding each side
  if (cw > maxW) { ch *= maxW / cw; cw = maxW; }
  if (ch > H) { cw *= H / ch; ch = H; }
  // the image box includes any baked-in padding; negative margins keep its footprint to the ink,
  // and a translate centres the ink itself
  const bw = cw / ink.fx, bh = ch / ink.fy;
  Object.assign(img.style, {
    width: `${bw.toFixed(1)}px`, height: `${bh.toFixed(1)}px`, maxWidth: "none",
    margin: `${(-(bh - ch) / 2).toFixed(1)}px ${(-(bw - cw) / 2).toFixed(1)}px`,
    translate: `${((0.5 - ink.cx) * bw).toFixed(1)}px ${((0.5 - ink.cy) * bh).toFixed(1)}px`,
  });
}
$$(".sponsor-logos img").forEach((img) => {
  const fallback = () => { const w = document.createElement("span"); w.className = "wordmark"; w.textContent = img.alt; img.replaceWith(w); };
  if (img.complete && !img.naturalWidth) fallback(); else img.addEventListener("error", fallback, { once: true });
  // measured in idle time, never mid-scroll
  if (img.complete && img.naturalWidth) whenIdle(() => sizeLogo(img)); else img.addEventListener("load", () => whenIdle(() => sizeLogo(img)), { once: true });
});
// fetch the logos once the page has settled, so they're loaded and sized long before you scroll to them
addEventListener("load", () => whenIdle(() => $$(".sponsor-logos img").forEach((img) => { img.loading = "eager"; })), { once: true });
let logoResize = 0;
addEventListener("resize", () => { clearTimeout(logoResize); logoResize = setTimeout(() => $$(".sponsor-logos img").forEach(sizeLogo), 150); });

/* -------------------------------------------------------------------- forms */
// Where the waitlist and partnership forms POST (JSON). Left empty, they open a pre-filled email
// to contact@genaigenesis.ca instead, so nothing is lost before an endpoint exists.
// TODO: paste your form endpoints here (e.g. Formspree, a Google Apps Script web app, your API).
const FORM_ENDPOINTS = { waitlist: "", partner: "" };
const CONTACT = "contact@genaigenesis.ca";
function wireForm(form, key, subject, ok) {
  if (!form) return;
  const status = form.querySelector("[data-status]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = Object.fromEntries(new FormData(form));
    if (!FORM_ENDPOINTS[key]) {
      const body = Object.entries(data).map(([k, v]) => `${k}: ${v}`).join("\n");
      location.href = `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.textContent = `Your email app should open. If it doesn't, write to ${CONTACT}.`;
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; status.textContent = "Sending…";
    try {
      const res = await fetch(FORM_ENDPOINTS[key], { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(String(res.status));
      form.reset(); status.textContent = ok;
    } catch (err) {
      status.textContent = `Something went wrong. Please email ${CONTACT}.`;
    } finally { btn.disabled = false; }
  });
}
wireForm($("#waitlist"), "waitlist", "Notify me when hacker applications open", "You're on the list. We'll email you when hacker applications open.");
wireForm($("#enquiry-form"), "partner", "Partnership enquiry", "Thanks! Our partnerships team will be in touch.");

// Partnership enquiry: the "Partner with us" button opens the form in place; other "Partner with us"
// buttons on the page scroll here and open it.
const enquiry = $("#partnership-enquiry");
const enquiryTrigger = enquiry.querySelector(".enquiry-trigger"), enquiryPanel = $("#partnership-form-panel");
function setEnquiry(open, focus = true) {
  enquiry.dataset.open = String(open);
  enquiryTrigger.setAttribute("aria-expanded", String(open));
  enquiryPanel.inert = !open;
  if (open && focus) setTimeout(() => $("#enquiry-name").focus({ preventScroll: true }), 320);
  else if (!open && focus) enquiryTrigger.focus({ preventScroll: true });
}
enquiryTrigger.addEventListener("click", () => setEnquiry(true));
enquiry.querySelector(".enquiry-close").addEventListener("click", () => setEnquiry(false));
enquiry.addEventListener("keydown", (e) => { if (e.key === "Escape" && enquiry.dataset.open === "true") setEnquiry(false); });

/* -------------------------------------------------------------- hero ticker */
// Repeat the stat strip until one copy is wider than the screen, then double it,
// so the -50% loop never shows a gap at the end.
const tickerTrack = $(".ticker-track");
const tickerItems = [...tickerTrack.children].filter((el) => !el.hasAttribute("aria-hidden")).map((el) => el.outerHTML);
function buildTicker() {
  tickerTrack.innerHTML = tickerItems.join("");
  const setW = tickerTrack.scrollWidth || 1;
  const reps = Math.max(1, Math.ceil((innerWidth + 40) / setW));
  const hidden = tickerItems.map((h) => h.replace("<span", '<span aria-hidden="true"')).join("");
  const half = tickerItems.join("") + hidden.repeat(reps - 1);
  tickerTrack.innerHTML = half + hidden.repeat(reps);
  tickerTrack.style.animationDuration = `${(38 * reps).toFixed(0)}s`;   // same speed however many copies
}
buildTicker();
document.fonts?.ready.then(buildTicker);
let tickerW = innerWidth;
addEventListener("resize", () => { if (Math.abs(innerWidth - tickerW) > 40) { tickerW = innerWidth; buildTicker(); } });

/* --------------------------------------------------------- easter-egg hunt */
// Three Toronto-themed eggs are hidden around the page; each one unlocks its
// candid card. Progress is kept per visitor in localStorage.
const EGG_KEY = "gag-eggs-v1";
const EGGS = {
  dog: { what: "the pup", card: "Therapy dogs" },
  chip: { what: "the lucky chip", card: "Networking" },
  ramen: { what: "the ramen bowl", card: "Spicy ramen battles" },
};
const eggTotal = Object.keys(EGGS).length;
let eggsFound = new Set();
try { eggsFound = new Set(JSON.parse(localStorage.getItem(EGG_KEY) || "[]").filter((k) => k in EGGS)); } catch (e) { /* storage off: progress lasts this visit */ }
const eggToast = document.createElement("div");
eggToast.className = "egg-toast"; eggToast.setAttribute("role", "status"); eggToast.setAttribute("aria-live", "polite");
document.body.append(eggToast);
let eggToastTimer = 0;
function showEggToast(html) {
  eggToast.innerHTML = html; eggToast.classList.add("show");
  clearTimeout(eggToastTimer); eggToastTimer = setTimeout(() => eggToast.classList.remove("show"), 3200);
}
// Locked candids lie face-down as playing cards. Each back shows the egg that unlocks it
// (the same illustration you hunt for on the page), and the card flips over once it's found.
$$(".polaroid[data-egg]").forEach((card) => {
  const k = card.dataset.egg;
  const flip = document.createElement("div"); flip.className = "flip";
  const front = document.createElement("div"); front.className = "face front";
  front.append(...card.childNodes);
  const back = document.createElement("div"); back.className = "face back"; back.setAttribute("aria-hidden", "true");
  back.innerHTML = `<span class="pip">?</span><span class="seal"></span><span class="find">Find ${EGGS[k].what}</span><span class="pip pip-b">?</span>`;
  const art = document.querySelector(`.egg[data-egg="${k}"] svg`);
  if (art) back.querySelector(".seal").append(art.cloneNode(true));
  flip.append(front, back);
  card.append(flip);
  card.classList.add("has-flip");
});
// animate flips only after the first render, so cards already unlocked on a return visit don't spin
requestAnimationFrame(() => requestAnimationFrame(() => $(".polaroids")?.classList.add("flip-ready")));
function renderEggs(just) {
  $$(".polaroid[data-egg]").forEach((card) => {
    const open = eggsFound.has(card.dataset.egg);
    card.classList.toggle("locked", !open);
    if (open && card.dataset.egg === just) { card.classList.add("just-unlocked"); setTimeout(() => card.classList.remove("just-unlocked"), 1000); }
  });
  $("#egg-count").textContent = eggsFound.size;
  if (eggsFound.size === eggTotal) $("#egg-hint > span").textContent = "You found every easter egg. Enjoy the candids!";
}
$$(".egg").forEach((btn) => {
  if (eggsFound.has(btn.dataset.egg)) btn.hidden = true;
  btn.addEventListener("click", () => {
    const k = btn.dataset.egg;
    if (eggsFound.has(k)) return;
    eggsFound.add(k);
    try { localStorage.setItem(EGG_KEY, JSON.stringify([...eggsFound])); } catch (e) {}
    btn.classList.add("found");
    setTimeout(() => { btn.hidden = true; }, reduced ? 0 : 520);
    renderEggs(k);
    showEggToast(eggsFound.size === eggTotal
      ? `All ${eggTotal} found! <b>Every candid is unlocked.</b>`
      : `You found ${EGGS[k].what}! <b>${EGGS[k].card}</b> unlocked · ${eggsFound.size}/${eggTotal}`);
  });
});
renderEggs();

/* --------------------------------------------------------------- nav + UI */
const nav = $(".nav");
const navWrap = $(".nav-wrap");
function setMenu(open) {
  nav.classList.toggle("open", open);
  $("#nav-toggle").setAttribute("aria-expanded", String(open));
}
$("#nav-toggle").addEventListener("click", () => setMenu(!nav.classList.contains("open")));
// tapping outside the open menu closes it
addEventListener("pointerdown", (e) => { if (nav.classList.contains("open") && !nav.contains(e.target)) setMenu(false); });

// Phones: collapse the bar once past the hero, hide it while scrolling down,
// peek it back on any upward scroll. Desktop keeps the full bar.
const phoneQ = matchMedia("(max-width: 760px)");
let navLastY = scrollY, navAcc = 0;
function navOnScroll(y) {
  const d = y - navLastY; navLastY = y;
  if (!phoneQ.matches) { navWrap.classList.remove("is-hidden", "is-compact"); return; }
  if (nav.classList.contains("open")) {
    if (Math.abs(d) > 24) setMenu(false);          // scrolling away closes the menu
    else { navWrap.classList.remove("is-hidden"); return; }
  }
  const pastHero = y > 90;
  navWrap.classList.toggle("is-compact", pastHero);
  if (!pastHero || navWrap.contains(document.activeElement)) { navWrap.classList.remove("is-hidden"); navAcc = 0; return; }
  if (d === 0) return;
  navAcc = Math.sign(d) === Math.sign(navAcc) ? navAcc + d : d;   // distance travelled in the current direction
  if (navAcc > 14) navWrap.classList.add("is-hidden");
  else if (navAcc < -8) navWrap.classList.remove("is-hidden");
}
navWrap.addEventListener("focusin", () => navWrap.classList.remove("is-hidden"));

// Tabs (roving tabindex)
const tabs = $$(".tab");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => select(tab));
  tab.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = tabs[(tabs.indexOf(tab) + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    select(next); next.focus();
  });
});
const pill = $(".tab-pill");
function movePill(tab) {
  pill.style.setProperty("--pill-x", tab.offsetLeft + "px");
  pill.style.setProperty("--pill-w", tab.offsetWidth + "px");
}
// Panel swap: the old cards fade out, then the new ones fade up one after another.
let swapping = null;
function select(tab) {
  const next = $("#" + tab.getAttribute("aria-controls"));
  const prev = tabs.map((t) => $("#" + t.getAttribute("aria-controls"))).find((p) => !p.hidden && p !== next);
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
  });
  movePill(tab);
  if (!prev) return;
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";
  const show = () => {
    prev.hidden = true; next.hidden = false;
    if (reduced) return;
    [...next.children].forEach((card, i) => card.animate(
      [{ opacity: 0, transform: "translateY(26px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 620, delay: i * 80, easing: ease, fill: "backwards" }
    ));
  };
  if (swapping) swapping.cancel();
  if (reduced) { show(); return; }
  swapping = prev.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-out", fill: "forwards" });
  swapping.onfinish = () => { swapping.cancel(); swapping = null; show(); };
}
movePill(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
addEventListener("resize", () => movePill(tabs.find((t) => t.getAttribute("aria-selected") === "true")));
document.fonts?.ready.then(() => movePill(tabs.find((t) => t.getAttribute("aria-selected") === "true")));

// "Opens soon" buttons swap their label briefly instead of going nowhere.
$$("[data-soon]").forEach((btn) => {
  const label = btn.innerHTML;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    btn.textContent = btn.dataset.soon;
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { btn.innerHTML = label; }, 2200);
  });
});

// FAQ: animated open/close (height + fade) instead of the native jump
// FAQ: animated, and only one answer open at a time
const faqItems = $$(".faq details");
const faqEase = "cubic-bezier(0.22, 1, 0.36, 1)", faqDur = reduced ? 0 : 460;
function faqOpen(d) {
  const body = d.querySelector(".faq-a");
  if (d._anim) { d._anim.cancel(); d._anim = null; }
  d.open = true; d.classList.add("is-open");
  const h = body.scrollHeight;
  d._anim = body.animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: faqDur, easing: faqEase });
  d._anim.onfinish = () => { d._anim = null; lenis?.resize?.(); measure(); requestUpdate(); };
}
function faqClose(d) {
  const body = d.querySelector(".faq-a");
  if (d._anim) { d._anim.cancel(); d._anim = null; }
  d.classList.remove("is-open");
  const h = body.offsetHeight;
  d._anim = body.animate([{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: faqDur, easing: faqEase });
  d._anim.onfinish = () => { d.open = false; d._anim = null; lenis?.resize?.(); measure(); requestUpdate(); };
}
faqItems.forEach((d) => {
  if (d.open) d.classList.add("is-open");
  d.querySelector("summary").addEventListener("click", (e) => {
    e.preventDefault();
    if (d.classList.contains("is-open")) { faqClose(d); return; }
    faqItems.forEach((o) => { if (o !== d && o.classList.contains("is-open")) faqClose(o); });
    faqOpen(d);
  });
});

/* ------------------------------------------------------------ smooth scroll */
let lenis = null;
if (!reduced) {
  // driven by the page's own frame clock (below), so scroll and the 3D always move in the same frame
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, autoRaf: false, anchors: false });
  lenis.on("scroll", () => requestUpdate());
} else {
  addEventListener("scroll", () => requestUpdate(), { passive: true });
}
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (a.hasAttribute("data-soon")) return;
    const el = id === "#top" ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    setMenu(false);
    const toEnquiry = a.hasAttribute("data-partnership-trigger");
    if (lenis) lenis.scrollTo(id === "#top" ? 0 : el, { offset: toEnquiry ? -140 : 0, duration: 1.6, onComplete: toEnquiry ? () => setEnquiry(true) : undefined });
    else { el.scrollIntoView(); if (toEnquiry) setEnquiry(true); }
    history.replaceState(null, "", id);
  });
});

// Active nav link: every section maps to a nav item (data-nav); the weight/colour change fades in CSS.
const navMap = new Map($$(".nav-links a").map((a) => [a.getAttribute("href").slice(1), a]));
const navCta = $(".nav-cta");
function setActive(key) {
  navMap.forEach((l, k) => l.classList.toggle("is-active", k === key));
  navCta.classList.toggle("is-active", key === "apply");
}
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.dataset.nav); });
}, { rootMargin: "-48% 0px -48% 0px" });
$$("[data-nav]").forEach((s) => io.observe(s));

// Tilt on every card: follows the cursor, lifts toward it. Wide elements (FAQ rows,
// the tab bar) tilt less so their far edges don't swing too far.
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
if (!reduced && finePointer) {
  $$(".panel, .story-card, .story-quote, .project, .polaroid, .faq details, .tabs").forEach((el) => {
    el.setAttribute("data-tilt", "");
    // measured once on enter (and corrected for scroll since), not on every move: a live
    // getBoundingClientRect per pointermove forced a layout each time
    let r = null, ry0 = 0;
    el.addEventListener("pointerenter", () => { r = el.getBoundingClientRect(); ry0 = scrollY; });
    el.addEventListener("pointermove", (e) => {
      if (!r) { r = el.getBoundingClientRect(); ry0 = scrollY; }
      const top = r.top - (scrollY - ry0);
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - top) / r.height - 0.5;
      const k = Math.min(1, Math.max(0.3, 460 / r.width));
      el.style.setProperty("--rx", (-py * 12 * k).toFixed(2) + "deg");
      el.style.setProperty("--ry", (px * 14 * k).toFixed(2) + "deg");
      el.classList.add("tilting");
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg");
      el.classList.remove("tilting");
    });
  });
}

// Halo centre leans gently toward the cursor
const halos = $$(".halo");
let hx = 50, hy = 50;
if (!coarse) addEventListener("pointermove", (e) => {
  hx = 50 + ((e.clientX / innerWidth) - 0.5) * 22;
  hy = 50 + ((e.clientY / innerHeight) - 0.5) * 22;
  for (const h of halos) { h.style.setProperty("--hx", hx.toFixed(1) + "%"); h.style.setProperty("--hy", hy.toFixed(1) + "%"); }
}, { passive: true });
let haloTint = "";
function setHalo(s) {          // s: how much 3D sits behind the text (0..1)
  const t = (0.12 + Math.round(s * 50) / 50 * 0.26).toFixed(3);
  if (t === haloTint) return;
  haloTint = t;
  for (const h of halos) h.style.setProperty("--halo-tint", t);
}

/* ----------------------------------------------------------------- reveals */
if (!reduced) {
  document.documentElement.classList.add("reveal-ready");
  const rv = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); countUp(en.target); }
      else if (en.boundingClientRect.top > 0) en.target.classList.remove("in"); // re-arm when scrolled back up past it
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });
  $$("[data-reveal], [data-logos]").forEach((el) => rv.observe(el));   // [data-logos]: sponsor tiers, logos fade in one by one
}
function countUp(el) {
  const b = el.querySelector("[data-count]");
  if (!b || b._done) return;
  b._done = true;
  const end = +b.dataset.count, t0 = performance.now(), dur = 1300;
  const tick = (now) => {
    const t = clamp((now - t0) / dur);
    const v = Math.round(end * (1 - Math.pow(1 - t, 3)));
    b.textContent = v.toLocaleString("en-CA") + "+";
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------------------------------------------------------------- backdrop */
const backdrop = createBackdrop({ reduced });
if (backdrop) $(".bg").after(backdrop.canvas);
if (backdrop) document.documentElement.classList.add("has-haze");

/* ------------------------------------------------------------------ WebGL */
const canvas = $("#stage");
let renderer = null;
// capped at 1.5x everywhere: with antialiasing on it looks as sharp as 2x on a retina screen for
// ~half the pixels (2x + MSAA was the main GPU cost on laptops); the frame loop lowers it further if needed
let pixelRatio = Math.min(devicePixelRatio || 1, weak ? 1 : 1.5);
// iOS resizes the window whenever the address bar slides; the canvas uses the large-viewport height
// (CSS 100lvh) so those resizes can be ignored instead of rebuilding everything mid-scroll
const lvhProbe = Object.assign(document.createElement("div"), { ariaHidden: "true" });
lvhProbe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none";
document.body.append(lvhProbe);
let stageW = 0, stageH = 0;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !weak, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
} catch (err) {
  document.documentElement.classList.add("no-webgl");
}

const modelUrl = new URL("../assets/cn-tower/cn-tower.glb", import.meta.url).href;
let city = null;
const subway = renderer ? createStreetcar(TEAM) : null;
subway?.setTheme(document.documentElement.dataset.theme === "dark");
// FAQ ferry (its own small canvas under the FAQ title)
const ferry = renderer ? createFerry($(".ferry-canvas"), { reduced, weak, coarse }) : null;
ferry?.setTheme(document.documentElement.dataset.theme === "dark");
if (renderer) {
  // the stats list doubles as the source for the 3D number band around the globe
  const stats = $$(".stat-col .stat").map((li, i, all) => ({
    value: li.querySelector("b").textContent.trim(), label: li.querySelector("span").textContent.trim(), accent: i === all.length - 1,
  }));
  createCity(modelUrl, { stats }).then((c) => {
    city = c; subway?.addTower(c.towerModel, PASTEL);
    c.setTheme(document.documentElement.dataset.theme === "dark");
    // compile every shader and upload textures now, while idle, so nothing compiles mid-scroll
    whenIdle(() => { warm(c.scene, c.camera); warm(c.globeScene, c.globeCam); if (subway) whenIdle(() => warm(subway.scene, subway.camera)); });
    if (!reduced) document.documentElement.classList.add("stats-ring");   // the band replaces the flat list
    resize(true); requestUpdate();
  })
    .catch((e) => { console.warn("City failed to load", e); });
}

function whenIdle(fn) { (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(fn, { timeout: 2500 }); }
// Warm a scene in idle time: upload every texture (including ones bound through shader uniforms,
// like the Earth's land map), compile every program, then draw the whole scene once into a single
// scissored pixel of the real canvas (wiped straight after). A program that has only been compiled
// still makes the driver block on its first real draw (measured: 25–180 ms hitches near the top of
// the page and when the Earth first appeared). It has to be the real canvas, not a render target:
// three.js builds a different shader variant for render targets (linear output), which wouldn't help.
const warmScissor = new THREE.Vector4();
function warm(scene, camera) {
  if (!renderer) return;
  scene.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      for (const k of ["map", "alphaMap"]) if (m[k]) renderer.initTexture(m[k]);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) renderer.initTexture(u.value);
    }
  });
  const drawOnce = () => {
    const saved = [];
    scene.traverse((o) => { saved.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false; });
    const auto = renderer.autoClear, scissorOn = renderer.getScissorTest();
    renderer.getScissor(warmScissor);
    try {
      renderer.setRenderTarget(null);
      renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1);
      renderer.autoClear = true;
      renderer.render(scene, camera);
      renderer.clear();                      // wipe that one pixel again
    } catch (e) {}
    renderer.autoClear = auto;
    renderer.setScissor(warmScissor); renderer.setScissorTest(scissorOn);
    saved.forEach(([o, v, f]) => { o.visible = v; o.frustumCulled = f; });
  };
  const saved = [];
  scene.traverse((o) => { if (!o.visible) { saved.push(o); o.visible = true; } });   // compile() skips hidden objects
  const parallel = renderer.compileAsync && renderer.getContext().getExtension("KHR_parallel_shader_compile");
  try {
    if (parallel) renderer.compileAsync(scene, camera).then(() => whenIdle(drawOnce)).catch(() => {});
    else { renderer.compile(scene, camera); whenIdle(drawOnce); }
  } catch (e) {}
  saved.forEach((o) => { o.visible = false; });
}

function resize(force = false) {
  const w = innerWidth, h = lvhProbe.offsetHeight || innerHeight;
  // address-bar slides (same width, small height change) need nothing rebuilt
  const barOnly = w === stageW && (lvhProbe.offsetHeight ? h === stageH : coarse && Math.abs(h - stageH) < 160);
  if (barOnly && force !== true) { requestUpdate(); return; }
  stageW = w; stageH = h;
  if (renderer) {
    renderer.setSize(w, h, false);
    for (const s of [city, subway]) if (s) { s.camera.aspect = w / h; s.camera.updateProjectionMatrix(); }
    city?.setPixelHeight(h * pixelRatio);
  }
  measure();
  requestUpdate();
}

/* -------------------------------------------------------------- dark mode */
const themeBtn = $("#theme-toggle");
function applyTheme(dark, animate) {
  const root = document.documentElement;
  if (animate && !reduced) { root.classList.add("theme-anim"); setTimeout(() => root.classList.remove("theme-anim"), 500); }
  if (dark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
  themeBtn.setAttribute("aria-pressed", String(dark));
  themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  backdrop?.setDark(dark, !animate);
  city?.setTheme(dark);
  subway?.setTheme(dark);
  ferry?.setTheme(dark);
  if (animate) requestUpdate();                 // (initial call runs before the scroll loop exists)
}
applyTheme(document.documentElement.dataset.theme === "dark", false);
themeBtn.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  try { localStorage.setItem("gag-theme", dark ? "dark" : "light"); } catch (e) {}
  applyTheme(dark, true);
});

/* --------------------------------------------------------------- scrolling */
const chapters = $$("[data-chapter]");
const borders = $("#borders");
const finale = $("#apply");
const statsEl = $("#stats");
let anchors = [];

function docTop(el) { return el.getBoundingClientRect().top + scrollY; }
function offTop(el) { let t = 0; for (let e = el; e; e = e.offsetParent) t += e.offsetTop; return t; }   // ignores transforms
const G = new Map();
function cacheGeo() { for (const el of [...storyChs, borders, finale, statsEl]) G.set(el, { t: offTop(el), h: el.offsetHeight }); }
function rectOf(el) { if (!G.has(el)) cacheGeo(); const g = G.get(el), top = g.t - scrollY; return { top, bottom: top + g.h, height: g.h }; }
function measure() {
  const vh = innerHeight;
  cacheGeo();
  // story chapters anchor at their middle; the pinned borders section anchors where its pin starts
  anchors = chapters.map((el) => Math.max(0, el.dataset.chapter === "world" ? docTop(el) : docTop(el) + (el.offsetHeight - vh) / 2));
  const last = chapters[chapters.length - 1];
  anchors.push(docTop(last) + last.offsetHeight);                      // "exit" pose
  layoutMetro();
}

function chapterIndex(y) {
  if (y <= anchors[0]) return 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (y < anchors[i + 1]) return i + (y - anchors[i]) / (anchors[i + 1] - anchors[i]);
  }
  return anchors.length - 1;
}

// One clock for the whole page: each frame Lenis advances the scroll first, then the page and
// the 3D read that same scroll. (Two separate requestAnimationFrame loops could run in either
// order, leaving the canvas a frame behind the text now and then: a visible judder.)
let wantUpdate = false, looping = false;
function requestUpdate() { wantUpdate = true; }

// Pointer → city hover (lift a building) + slight camera parallax
let pointerNdc = null, cityOnStage = false;
addEventListener("pointermove", (e) => {
  pointerNdc = [(e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1];
  if (cityOnStage && city && !reduced) {
    document.body.style.cursor = city.hover(...pointerNdc) ? "pointer" : "";
    startLoop();
  }
}, { passive: true });

// Frame loop (train wind, hover easing, idle spin). Runs on the clock while something animates.
let last = 0;
function startLoop() {
  if (looping || !renderer) return;
  looping = true; last = performance.now();
}
// Resolution governor: the display's own frame interval is the fastest frame seen; if frames
// keep running well over it (dropped frames), the 3D steps its resolution down a notch.
let slowSum = 0, slowN = 0, bestRaw = 1;
function frame(now) {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, raw); last = now;
  if (raw > 0.004 && raw < 0.25) {
    slowSum += raw; slowN++; bestRaw = Math.min(bestRaw, raw);
    if (slowN >= 90) {
      if (slowSum / slowN > bestRaw * 1.3 && pixelRatio > 1) {
        pixelRatio = Math.max(1, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio); renderer.setSize(stageW, stageH, false);
        city?.setPixelHeight(stageH * pixelRatio);
      }
      slowSum = 0; slowN = 0; bestRaw = 1;
    }
  }
  if (!update(dt)) looping = false;
}
function clock(now) {
  lenis?.raf(now);
  if (looping) { wantUpdate = false; frame(now); }
  else if (wantUpdate) { wantUpdate = false; update(); }
  requestAnimationFrame(clock);
}
requestAnimationFrame(clock);

let finaleState = null, fadedAt = null;
const crewN = $("#crew-n");
let stageOp = -1;
function setStageOpacity(o) { o = Math.round(o * 100) / 100; if (o !== stageOp) { stageOp = o; canvas.style.opacity = String(o); } }
// Story chapters (desktop): the copy is pinned in the white strip and crossfades.
// The chapter under the middle of the screen is current; none while the strip
// itself is entering from below or leaving at the end.
const storyTexts = $$(".split-text[data-story]");
const storyChs = storyTexts.map((t) => t.closest(".split-ch"));
let storyCur = -1;
function updateStory(vh) {
  const first = rectOf(storyChs[0]), last = rectOf(storyChs[storyChs.length - 1]);
  let cur = -1;
  if (first.top < vh * 0.35 && last.bottom > vh * 0.65) {
    storyChs.forEach((ch, i) => { const r = rectOf(ch); if (r.top <= vh / 2 && r.bottom > vh / 2) cur = i; });
  }
  if (cur === storyCur) return;
  storyCur = cur;
  storyTexts.forEach((t, i) => { t.classList.toggle("is-current", i === cur); t.setAttribute("aria-hidden", String(i !== cur && phoneQ.matches === false)); });
}
function update(dt = 0) {
  const y = scrollY, vh = innerHeight;
  navOnScroll(y);
  updateStory(vh);

  // Metro map: progress along the line while the section is pinned; the backdrop
  // washes to white while the map is on screen.
  const wr = rectOf(borders);
  const metroF = (reduced ? 1 : clamp(-wr.top / Math.max(1, wr.height - vh))) * (stopEls.length - 1);
  if (wr.top < vh * 1.2 && wr.bottom > -vh * 0.2) setMetroProgress(metroF);   // only near the map
  backdrop?.setWhite(clamp((vh * 1.7 - wr.top) / (vh * 0.8)) * clamp((wr.bottom - vh * 0.15) / (vh * 0.6)));

  // Finale copy state (also without WebGL)
  const fr = rectOf(finale);
  const q = reduced ? 1 : clamp(-fr.top / (fr.height - vh));
  const cta = q > 0.8;
  if (cta !== finaleState) { finale.classList.toggle("is-cta", cta); finaleState = cta; }

  if (!renderer) return false;

  // Finale on stage → the train (continuous loop for the wind)
  if (fr.top < vh * 0.9 && fr.bottom > 0 && subway) {
    cityOnStage = false; document.body.style.cursor = "";
    subway.setProgress(q);
    subway.tick(dt || 1 / 60, reduced);
    const op = clamp(1 - fr.top / (vh * 0.9));
    setStageOpacity(op);
    setHalo(op * (0.75 + 0.25 * Math.sin(performance.now() / 900)));   // breathes slightly with the wind
    renderer.render(subway.scene, subway.camera);
    if (crewN && crewN.textContent !== String(subway.revealed)) crewN.textContent = subway.revealed;
    const L = subway.labels(stageW, stageH);
    L.forEach((l, i) => {
      const el = labelEls[i]; if (!el) return;
      el.classList.toggle("on", l.visible && !cta);
      if (l.visible) el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px) translate(-50%, 0)`;
    });
    if (!reduced) { startLoop(); return true; }
    return false;
  }
  labelEls.forEach((el) => el.classList.remove("on"));

  if (!city) return false;
  const c = reduced ? (y < anchors[1] * 0.5 ? 0 : 1) : chapterIndex(y);
  // the Earth stays under the map while it is pinned, then fades as the section leaves
  const fade = reduced ? clamp((c - 3.15) / 0.5) : clamp((vh - wr.bottom) / (vh * 0.55));
  city.world.p = metroF;
  setStageOpacity(1 - fade);
  setHalo((1 - fade) * clamp(c - 0.6));
  cityOnStage = fade < 1;
  // keep the globe turning until the canvas's CSS opacity transition has finished,
  // so it never freezes while still visible
  if (fade >= 1) { fadedAt ??= performance.now(); if (performance.now() - fadedAt > 500) return false; }
  else fadedAt = null;
  city.tick(dt);
  // number band: fades in as the stats chapter arrives, sweeps while its heading is pinned, fades as it leaves
  const sr = rectOf(statsEl);
  // sweep runs while the stats chapter holds the middle of the screen, finishing just before it hands over
  city.ring.p = clamp((vh * 0.5 - sr.top) / Math.max(1, sr.height - vh * 0.3));
  city.ring.o = reduced ? 0 : clamp((vh * 0.75 - sr.top) / (vh * 0.5)) * clamp((sr.bottom - vh * 0.3) / (vh * 0.35));
  city.pose(c);
  city.render(renderer);
  if (!reduced) { startLoop(); return true; }   // idle spin + snow keep running while the globe is on screen
  return false;
}

addEventListener("resize", resize);
addEventListener("load", () => { measure(); requestUpdate(); });
{
  let t = 0, lastH = 0;
  new ResizeObserver(() => {
    const h = document.body.offsetHeight;
    if (h === lastH) return; lastH = h;
    clearTimeout(t); t = setTimeout(() => { measure(); requestUpdate(); }, 160);
  }).observe(document.body);
}
document.fonts?.ready.then(() => { measure(); requestUpdate(); });
resize();
window.__landing = { update, measure };
