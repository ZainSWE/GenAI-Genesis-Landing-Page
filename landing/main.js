/**
 * GenAI Genesis landing page — scroll orchestration.
 *
 *  Lenis smooth scroll ─► update() per frame while scrolling
 *     ├─ story chapters  → Toronto city: camera pose, city turning, buildings rising
 *     ├─ borders section → metro map: scroll moves along the line, stations swell; backdrop turns white
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
import { LOGOS } from "./logos.js";

const reduced = document.documentElement.classList.contains("reduced-motion");
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
let metroPts = [], metroLen = 0, metroHover = -1, metroShown = -1, metroHeadBottom = 0;
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
  metroHeadBottom = hb;
  const gx = Math.max(24, Math.min(W * 0.06, (W - 1180) / 2 + 40));
  let pts;
  if (W > 760) {
    const yB = hb + Math.max(84, H * 0.1), yA = Math.min(H - 150, yB + H * 0.15), yC = H - 110;
    const x1 = gx, x2 = W * 0.56, x3 = W - Math.max(80, gx + 40);
    pts = [[-30, yA], [x1, yA], [x1, yB], [x2, yB], [x2, yC], [x3, yC], [x3, Math.max(96, H * 0.12)]];
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
  metroPts = stopEls.map((el, i) => {
    const at = along(i);
    const p = metroTrack.getPointAtLength(at), q = metroTrack.getPointAtLength(Math.min(metroLen, at + 4));
    el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    const vertical = Math.abs(q.y - p.y) > Math.abs(q.x - p.x);
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
    el.style.setProperty("--e", (e * e * (3 - 2 * e)).toFixed(3));
    el.classList.toggle("passed", i < cur);
    el.classList.toggle("is-active", i === cur);
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
$("#crew-total").textContent = TEAM.length;
$("#crew-list").innerHTML = TEAM.map((m) => `<li>${m.name}, ${m.role}</li>`).join("");
const labelEls = TEAM.map((m) => {
  const el = document.createElement("div");
  el.className = "crew-label";
  el.innerHTML = `<b>${m.name}</b><span>${m.role}</span>`;
  $("#crew-labels").appendChild(el);
  return el;
});

// Sponsor marquee (white logos). Wordmarks in type are stand-ins until official SVGs are added.
const SPONSORS = [
  { id: "google", svg: LOGOS.google, name: "Google" },
  { id: "intuit", svg: LOGOS.intuit, name: "Intuit" },
  { id: "amd", svg: LOGOS.amd, name: "AMD" },
  { id: "pwc", text: "pwc", name: "PwC" },
  { id: "un", svg: LOGOS.un, text: "United Nations", name: "United Nations" },
  { id: "cohere", svg: LOGOS.cohere, name: "Cohere" },
  { id: "rbc", text: "RBC", name: "RBC" },
  { id: "td", text: "TD Bank", name: "TD Bank" },
  { id: "sunlife", text: "Sun Life", name: "Sun Life" },
  { id: "shopify", svg: LOGOS.shopify, text: "Shopify", name: "Shopify" },
  { id: "ibm", svg: LOGOS.ibm, name: "IBM" },
  { id: "georgia", text: "Georgia", name: "Georgia" },
  { id: "vector", text: "Vector Institute", name: "Vector Institute" },
];
const logoHTML = (s, hidden) => `<li class="logo l-${s.id}"${hidden ? ' aria-hidden="true"' : ` aria-label="${s.name}"`}>${s.svg || ""}${s.text ? `<span class="wordmark${s.svg ? " light" : ""}">${s.text}</span>` : ""}</li>`;
$("#marquee").innerHTML = SPONSORS.map((s) => logoHTML(s, false)).join("") + SPONSORS.map((s) => logoHTML(s, true)).join("");

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
  d._anim.onfinish = () => { d._anim = null; lenis?.resize?.(); };
}
function faqClose(d) {
  const body = d.querySelector(".faq-a");
  if (d._anim) { d._anim.cancel(); d._anim = null; }
  d.classList.remove("is-open");
  const h = body.offsetHeight;
  d._anim = body.animate([{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: faqDur, easing: faqEase });
  d._anim.onfinish = () => { d.open = false; d._anim = null; lenis?.resize?.(); };
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
  lenis = new Lenis({ lerp: 0.085, smoothWheel: true, autoRaf: true, anchors: false });
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
    if (lenis) lenis.scrollTo(id === "#top" ? 0 : el, { offset: 0, duration: 1.6 });
    else el.scrollIntoView();
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
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
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
const rootStyle = document.documentElement.style;
let hx = 50, hy = 50;
addEventListener("pointermove", (e) => {
  hx = 50 + ((e.clientX / innerWidth) - 0.5) * 22;
  hy = 50 + ((e.clientY / innerHeight) - 0.5) * 22;
  rootStyle.setProperty("--hx", hx.toFixed(1) + "%");
  rootStyle.setProperty("--hy", hy.toFixed(1) + "%");
}, { passive: true });
function setHalo(s) {          // s: how much 3D sits behind the text (0..1)
  rootStyle.setProperty("--halo-blur", (4 + s * 12).toFixed(1) + "px");
  rootStyle.setProperty("--halo-tint", (0.12 + s * 0.26).toFixed(3));
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
  $$("[data-reveal]").forEach((el) => rv.observe(el));
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

/* ------------------------------------------------------------------ WebGL */
const canvas = $("#stage");
let renderer = null;
try {
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !weak, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, weak ? 1 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
} catch (err) {
  document.documentElement.classList.add("no-webgl");
}

const modelUrl = new URL("../assets/cn-tower/cn-tower.glb", import.meta.url).href;
let city = null;
const subway = renderer ? createStreetcar(TEAM) : null;
if (renderer) {
  // the stats list doubles as the source for the 3D number band around the globe
  const stats = $$(".stat-col .stat").map((li, i, all) => ({
    value: li.querySelector("b").textContent.trim(), label: li.querySelector("span").textContent.trim(), accent: i === all.length - 1,
  }));
  createCity(modelUrl, { stats }).then((c) => {
    city = c; subway?.addTower(c.towerModel, PASTEL);
    if (!reduced) document.documentElement.classList.add("stats-ring");   // the band replaces the flat list
    resize(); requestUpdate();
  })
    .catch((e) => { console.warn("City failed to load", e); });
}

function resize() {
  if (!renderer) return;
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  for (const s of [city, subway]) if (s) { s.camera.aspect = w / h; s.camera.updateProjectionMatrix(); }
  measure();
  requestUpdate();
}

/* --------------------------------------------------------------- scrolling */
const chapters = $$("[data-chapter]");
const borders = $("#borders");
const finale = $("#apply");
const statsEl = $("#stats");
let anchors = [];

function docTop(el) { return el.getBoundingClientRect().top + scrollY; }
function measure() {
  const vh = innerHeight;
  anchors = chapters.map((el) => Math.max(0, docTop(el) + (el.offsetHeight - vh) / 2));
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

let queued = false, looping = false;
function requestUpdate() {
  if (queued || looping) return;   // the frame loop already renders every frame
  queued = true;
  requestAnimationFrame(() => { queued = false; update(); });
}

// Pointer → city hover (lift a building) + slight camera parallax
let pointerNdc = null, cityOnStage = false;
addEventListener("pointermove", (e) => {
  pointerNdc = [(e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1];
  if (cityOnStage && city && !reduced) {
    document.body.style.cursor = city.hover(...pointerNdc) ? "pointer" : "";
    startLoop();
  }
}, { passive: true });

// Frame loop (train wind, hover easing). Stops itself when nothing animates.
let last = 0;
function startLoop() {
  if (looping || !renderer) return;
  looping = true; last = performance.now();
  requestAnimationFrame(frame);
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const keep = update(dt);
  if (keep) requestAnimationFrame(frame); else looping = false;
}

let finaleState = null, fadedAt = null;
// Story chapters (desktop): the copy is pinned in the white strip and crossfades.
// The chapter under the middle of the screen is current; none while the strip
// itself is entering from below or leaving at the end.
const storyTexts = $$(".split-text[data-story]");
const storyChs = storyTexts.map((t) => t.closest(".split-ch"));
let storyCur = -1;
function updateStory(vh) {
  const first = storyChs[0].getBoundingClientRect(), last = storyChs[storyChs.length - 1].getBoundingClientRect();
  let cur = -1;
  if (first.top < vh * 0.35 && last.bottom > vh * 0.65) {
    storyChs.forEach((ch, i) => { const r = ch.getBoundingClientRect(); if (r.top <= vh / 2 && r.bottom > vh / 2) cur = i; });
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
  {
    const r = borders.getBoundingClientRect();
    const p = reduced ? 1 : clamp(-r.top / Math.max(1, r.height - vh));
    setMetroProgress(p * (stopEls.length - 1));
    backdrop?.setWhite(clamp((vh * 1.7 - r.top) / (vh * 0.8)) * clamp((r.bottom - vh * 0.15) / (vh * 0.6)));
  }

  // Finale copy state (also without WebGL)
  const fr = finale.getBoundingClientRect();
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
    canvas.style.opacity = String(op);
    setHalo(op * (0.75 + 0.25 * Math.sin(performance.now() / 900)));   // breathes slightly with the wind
    renderer.render(subway.scene, subway.camera);
    $("#crew-n").textContent = subway.revealed;
    const L = subway.labels(innerWidth, innerHeight);
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
  const fade = clamp((c - 3.15) / 0.5);
  canvas.style.opacity = String(1 - fade);
  setHalo((1 - fade) * clamp(c - 0.6));
  cityOnStage = fade < 1;
  // keep the globe turning until the canvas's CSS opacity transition has finished,
  // so it never freezes while still visible
  if (fade >= 1) { fadedAt ??= performance.now(); if (performance.now() - fadedAt > 500) return false; }
  else fadedAt = null;
  city.tick(dt);
  // number band: fades in as the stats chapter arrives, sweeps while its heading is pinned, fades as it leaves
  const sr = statsEl.getBoundingClientRect();
  // sweep runs while the stats chapter holds the middle of the screen, finishing just before it hands over
  city.ring.p = clamp((vh * 0.5 - sr.top) / Math.max(1, sr.height - vh * 0.3));
  city.ring.o = reduced ? 0 : clamp((vh * 0.75 - sr.top) / (vh * 0.5)) * clamp((sr.bottom - vh * 0.3) / (vh * 0.35));
  city.pose(c);
  renderer.render(city.scene, city.camera);
  if (!reduced) { startLoop(); return true; }   // idle spin + snow keep running while the globe is on screen
  return false;
}

addEventListener("resize", resize);
addEventListener("load", () => { measure(); requestUpdate(); });
document.fonts?.ready.then(() => { measure(); requestUpdate(); });
resize();
window.__landing = { update, measure };
