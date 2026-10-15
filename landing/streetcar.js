/**
 * Finale: a TTC Flexity-style streetcar in the GenAI Genesis palette.
 *
 * Shape follows the Flexity Outlook: five modules (two long cabs with a
 * rounded nose and big wraparound windscreen, three middle modules), dark
 * accordion connectors between them, a rounded roof cap, a white band above
 * and below the windows, and the lower body in lilac instead of TTC red.
 *
 * Construction avoids overlapping surfaces: every module is a stack of
 * horizontal slices (plan-shape extrusions) that only touch at their edges,
 * so nothing z-fights. The window band is real transparent glass, so you can
 * see seats, poles and the far side through the car.
 *
 * Motion: speed streaks, streaming platform tiles and a light sway run all
 * the time (wind). Scroll moves the camera along the car; each window pops a
 * floating circular team photo; the last stretch frames the front for the CTA.
 */
import * as THREE from "three";
import { snowflakeTexture } from "./city.js";

const COL = {
  body: "#18D9D2", bodyShade: "#0E9F9A",          // cyan (primary)
  white: "#FFFFFF", whiteShade: "#D3E9EC",
  mint: "#3EE07E",                                 // green pinstripe / accents
  glass: "#14313A",
  frame: "#13232B",
  joint: "#1B2A33", jointRib: "#2C4048",
  seat: "#BCFEFF", seatBack: "#FFFFFF", pole: "#3EE07E", floor: "#EDF8F8",
  platform: "#F6F2FD", edge: "#F7D14A", road: "#CFC3EE", rail: "#9A90BF",
};
const lightW = { value: new THREE.Vector2(-0.8, 0.6).normalize() };   // lights the platform side
const nightU = { value: 0 };                                          // dark mode: dims and cools the scene
const NIGHT = new THREE.Color(0.48, 0.44, 0.7), DAY = new THREE.Color(1, 1, 1);
const nightBasics = [];                                               // plain materials dimmed by colour
function nightBasic(m, k = 1) { nightBasics.push([m, m.color.clone(), k]); return m; }

// night: how strongly dark mode dims this material (street and buildings fully, the car a little)
function flat(color, shade, topMix = 0.45, night = 0.35) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
  m.onBeforeCompile = (s) => {
    s.uniforms.uLight = lightW;
    s.uniforms.uShade = { value: new THREE.Color(shade || color) };
    s.uniforms.uNight = nightU;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vN;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvN = normalize(mat3(modelMatrix) * normal);");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vN;\nuniform vec2 uLight;\nuniform vec3 uShade;\nuniform float uNight;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 n = normalize(vN);
        vec3 b = diffuseColor.rgb;
        float lit = smoothstep(-0.12, 0.12, dot(n.xz, uLight));
        vec3 c = mix(uShade, b, lit);
        if (n.y > 0.6) c = mix(b, vec3(1.0), ${topMix.toFixed(2)});
        if (n.y < -0.6) c = mix(uShade, vec3(0.0), 0.08);
        c = mix(c, c * vec3(0.44, 0.4, 0.66) + vec3(0.025, 0.015, 0.06), uNight * ${night.toFixed(2)});
        diffuseColor.rgb = c;`);
  };
  m.customProgramCacheKey = () => "sc-flat-" + topMix + "-" + night;
  return m;
}

/* ---------------------------------------------------------------- shapes */
const W = 2.6, HW = W / 2;
// Plan shape in (x, u) where u = distance back from the car's front (world z = -u).
// nose: "front" | "back" | null — which end gets the rounded Flexity nose.
function planShape(u0, L, nose, setback = 0, inset = 0, RC = 0.92, BULGE = 0.34) {
  // setback: how far the nose end is pulled back; inset: shrinks the sides and the non-nose ends
  const hw = HW - inset, rc = Math.min(RC, hw - 0.05), bulge = BULGE, r2 = 0.06;
  const s = new THREE.Shape();
  const f = u0 + (nose === "front" ? setback : inset), b = u0 + L - (nose === "back" ? setback : inset);
  const front = nose === "front", back = nose === "back";
  // start at back-left, go counter-clockwise in (x, u)
  if (back) {
    s.moveTo(-hw, b - rc);
    s.absarc(-hw + rc, b - rc, rc, Math.PI, Math.PI / 2, true);
    s.quadraticCurveTo(0, b + bulge, hw - rc, b);
    s.absarc(hw - rc, b - rc, rc, Math.PI / 2, 0, true);
  } else {
    s.moveTo(-hw, b - r2); s.quadraticCurveTo(-hw, b, -hw + r2, b);
    s.lineTo(hw - r2, b); s.quadraticCurveTo(hw, b, hw, b - r2);
  }
  if (front) {
    s.lineTo(hw, f + rc);
    s.absarc(hw - rc, f + rc, rc, 0, -Math.PI / 2, true);
    s.quadraticCurveTo(0, f - bulge, -hw + rc, f);
    s.absarc(-hw + rc, f + rc, rc, -Math.PI / 2, -Math.PI, true);
  } else {
    s.lineTo(hw, f + r2); s.quadraticCurveTo(hw, f, hw - r2, f);
    s.lineTo(-hw + r2, f); s.quadraticCurveTo(-hw, f, -hw, f + r2);
  }
  s.closePath();
  return s;
}
// (x, u, extrude e) → world (x, v0 + e, -u)
function slice(shape, v0, h, mat, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, h - (bevel ? bevel : 0)), curveSegments: 14,
    bevelEnabled: !!bevel, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4,
  });
  g.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, v0, 0, -1, 0, 0, 0, 0, 0, 1));
  return new THREE.Mesh(g, mat);
}

/**
 * Loft between two plan outlines at heights vA → vB (side walls only). Both
 * shapes come from planShape() with the same topology, so getPoints() gives
 * matching vertices; changing the nose setback between them rakes the wall.
 * opts.filter(x, u) keeps only part of the perimeter (decals); opts.offset
 * pushes the surface outward so a decal sits just proud of the body.
 */
function loft(shapeA, vA, shapeB, vB, mat, opts = {}) {
  const a = shapeA.getPoints(14), b = shapeB.getPoints(14);
  if (a.length > 1 && a[0].equals(a[a.length - 1])) { a.pop(); b.pop(); }
  const n = Math.min(a.length, b.length);
  const off = opts.offset || 0;
  const cx = a.reduce((s, p) => s + p.x, 0) / n, cu = a.reduce((s, p) => s + p.y, 0) / n;
  const push = (pts, i) => {
    const p = pts[i];
    if (!off) return p;
    const p0 = pts[(i - 1 + n) % n], p1 = pts[(i + 1) % n];
    let nx = p1.y - p0.y, nu = -(p1.x - p0.x);
    const l = Math.hypot(nx, nu) || 1; nx /= l; nu /= l;
    if (nx * (p.x - cx) + nu * (p.y - cu) < 0) { nx = -nx; nu = -nu; }
    return new THREE.Vector2(p.x + nx * off, p.y + nu * off);
  };
  const pos = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (opts.filter && !(opts.filter(a[i].x, a[i].y) && opts.filter(a[j].x, a[j].y))) continue;
    const A0 = push(a, i), A1 = push(a, j), B1 = push(b, j), B0 = push(b, i);
    const q = [[A0.x, vA, -A0.y], [A1.x, vA, -A1.y], [B1.x, vB, -B1.y], [B0.x, vB, -B0.y]];
    pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // make sure faces point outward
  const p = g.attributes.position, nrm = g.attributes.normal;
  if (p.count) {
    const ox = p.getX(0) - cx, oz = p.getZ(0) + cu;
    if (nrm.getX(0) * ox + nrm.getZ(0) * oz < 0) {
      for (let i = 0; i < p.count; i += 3) {
        for (const attr of [p]) { const t = [attr.getX(i + 1), attr.getY(i + 1), attr.getZ(i + 1)]; attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2)); attr.setXYZ(i + 2, ...t); }
      }
      g.computeVertexNormals();
    }
  }
  return new THREE.Mesh(g, mat);
}
/**
 * Smooth shell through a stack of rings. rows = [[height, setback, inset], ...];
 * vertices are shared between neighbouring rings so normals average (smooth
 * shading), and each ring is sampled finely so the rounded nose stays round.
 */
function ringStack(S, rows, mat, div = 36) {
  const rings = rows.map(([v, sb, ins]) => {
    const pts = S(sb, ins).getPoints(div);
    if (pts.length > 1 && pts[0].equals(pts[pts.length - 1])) pts.pop();
    return { v, pts };
  });
  const n = Math.min(...rings.map((r) => r.pts.length));
  const pos = new Float32Array(rings.length * n * 3);
  rings.forEach((r, i) => r.pts.slice(0, n).forEach((p, j) => { const k = (i * n + j) * 3; pos[k] = p.x; pos[k + 1] = r.v; pos[k + 2] = -p.y; }));
  const idx = [];
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) {
    const a = i * n + j, b = i * n + (j + 1) % n, c = (i + 1) * n + (j + 1) % n, d = (i + 1) * n + j;
    idx.push(a, b, c, a, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function capTop(shape, v, mat) {
  const g = new THREE.ShapeGeometry(shape, 36);
  g.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, v, 0, -1, 0, 0, 0, 0, 0, 1));
  return new THREE.Mesh(g, mat);
}

/** Amber LED destination blind: fine dot grid, thin strokes, bright lit pixels with a soft bloom. */
function dotMatrixTexture(text, cols = 220, rows = 20) {
  const src = document.createElement("canvas"); src.width = cols; src.height = rows;
  const sg = src.getContext("2d");
  sg.fillStyle = "#000"; sg.fillRect(0, 0, cols, rows);
  sg.fillStyle = "#fff"; sg.font = `500 ${rows - 6}px ${FONT}`; sg.textBaseline = "middle"; sg.textAlign = "center";
  sg.fillText(text, cols / 2, rows / 2 + 1, cols - 6);
  const data = sg.getImageData(0, 0, cols, rows).data;
  const cell = 6;
  return canvasTex(cols * cell, rows * cell, (g, w, h) => {
    g.fillStyle = "#070504"; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const on = data[(y * cols + x) * 4] > 150;
      const cx = x * cell + cell / 2, cy = y * cell + cell / 2;
      if (on) {
        const gl = g.createRadialGradient(cx, cy, 0, cx, cy, cell * 1.6);
        gl.addColorStop(0, "rgba(255, 200, 90, 0.55)"); gl.addColorStop(1, "rgba(255, 140, 30, 0)");
        g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, cell * 1.6, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#FFE0A0"; g.beginPath(); g.arc(cx, cy, 1.9, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = "#1A1008"; g.beginPath(); g.arc(cx, cy, 1.3, 0, Math.PI * 2); g.fill();
      }
    }
  });
}

/** Blurred copy of a canvas texture, used as an additive bloom layer. */
function blurredTex(tex, px) {
  const src = tex.image, c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const g = c.getContext("2d"); g.filter = `blur(${px}px)`; g.drawImage(src, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const FONT = "'Google Sans Flex', 'Google Sans', system-ui, sans-serif";
const AVATAR_FILLS = [["#BCFEFF", "#00FFDD"], ["#F3DAFF", "#E09DFF"], ["#E4FEFF", "#9DEFE6"], ["#FBEAFF", "#D7A6FF"]];
function avatarTexture(i, member) {
  const t = canvasTex(256, 256, (g) => {
    const [a, b] = AVATAR_FILLS[i % AVATAR_FILLS.length];
    const grd = g.createLinearGradient(0, 0, 256, 256); grd.addColorStop(0, a); grd.addColorStop(1, b);
    g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.fillStyle = grd; g.fill();
    g.save(); g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.clip();
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.beginPath(); g.arc(128, 104, 42, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(128, 236, 84, 72, 0, Math.PI, 0); g.fill();
    g.restore();
    g.lineWidth = 12; g.strokeStyle = "#FFFFFF"; g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.stroke();
  });
  if (member.photo) {
    const img = new Image();
    img.onload = () => {
      const g = t.image.getContext("2d");
      g.save(); g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.clip();
      const s = Math.max(220 / img.width, 220 / img.height);
      g.drawImage(img, 128 - img.width * s / 2, 128 - img.height * s / 2, img.width * s, img.height * s);
      g.restore(); t.needsUpdate = true;
    };
    img.src = member.photo;
  }
  return t;
}

/* ----------------------------------------------------------------- build */
export function createStreetcar(team) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1600);
  const car = new THREE.Group();
  scene.add(car);

  const M = {
    body: flat(COL.body, COL.bodyShade),
    white: flat(COL.white, COL.whiteShade, 0.6),
    mint: new THREE.MeshBasicMaterial({ color: COL.mint }),
    frame: flat(COL.frame, "#0A151A", 0.2),
    joint: flat(COL.joint, "#0F1A20", 0.15),
    rib: flat(COL.jointRib, "#1A2A31", 0.15),
    seat: flat(COL.seat, "#7FE3DA", 0.5),
    seatBack: flat(COL.seatBack, "#CFE7EA", 0.5),
    floor: flat(COL.floor, "#D3C8F2", 0.2),
    lamp: new THREE.MeshBasicMaterial({ color: "#FFFBE6" }),
    bumper: flat("#17C9B6", "#0E8F84", 0.4),
  };
  M.whiteDS = new THREE.MeshBasicMaterial({ color: "#FFFFFF", side: THREE.DoubleSide });
  // Glass: transparent tube walls only (caps hidden), seen from both sides.
  const glass = new THREE.MeshBasicMaterial({ color: COL.glass, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });

  // ---------------------------------------------------------------------------
  // Flexity Outlook, rebuilt from the reference photos.
  // Each module is ONE closed shell lofted through horizontal rings of the plan
  // outline. The nose profile (how far the front is set back at each height)
  // gives the white apron, the jutting bumper, the light band, a slightly raked
  // windscreen and the rounded roof cap. Livery is painted in the shader from
  // the surface position, so bands and the side swoosh are crisp and nothing
  // overlaps: cyan body, white bands + swoosh, dark glass/frames/connectors.
  // ---------------------------------------------------------------------------
  const RC = 0.78, BULGE = 0.2;                          // nose corner radius / forward bulge
  const V = { base: 0.28, glass: 1.2, header: 2.42, roof: 2.8, top: 3.26 };
  const windows = [];
  const glassMeshes = [];
  const C3 = (h) => new THREE.Color(h);
  const liveryU = { cCyan: { value: C3(COL.body) }, cCyanS: { value: C3(COL.bodyShade) }, cWhite: { value: C3("#FFFFFF") }, cWhiteS: { value: C3("#D3E6EA") }, uLight: lightW };
  function liveryMat(u0, L, nose) {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, liveryU, { uU0: { value: u0 }, uL: { value: L }, uNose: { value: nose === "front" ? 1 : nose === "back" ? -1 : 0 } });
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vP; varying vec3 vNw;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvP = position; vNw = normalize(mat3(modelMatrix) * normal);");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
          varying vec3 vP; varying vec3 vNw;
          uniform float uU0, uL, uNose; uniform vec3 cCyan, cCyanS, cWhite, cWhiteS; uniform vec2 uLight;`)
        .replace("#include <color_fragment>", `#include <color_fragment>
          float u = -vP.z, v = vP.y;
          float du = uNose > 0.5 ? u - uU0 : (uNose < -0.5 ? uU0 + uL - u : 99.0);
          float white = 0.0;
          float t = clamp((du - 0.55) / 2.1, 0.0, 1.0);
          float swooshLow = 0.34 + 0.61 * pow(t, 0.75);          // white swoosh rises from the apron into the lower band
          if (du < 0.55) {
            white = v < 0.62 ? 1.0 : 0.0;                         // white apron under the bumper
          } else if (v < 1.2) {
            white = (v >= 0.95 || (du < 2.65 && v > swooshLow)) ? 1.0 : 0.0;
          } else if (v >= 2.42 && v < 2.8) {
            white = du > 1.2 ? 1.0 : 0.0;                         // white band above the windows; cap colour over the windscreen
          }
          vec3 n = normalize(vNw); if (!gl_FrontFacing) n = -n;
          float lit = smoothstep(-0.55, 0.45, dot(n.xz, uLight));
          vec3 base = mix(cCyan, cWhite, white), shade = mix(cCyanS, cWhiteS, white);
          vec3 col = mix(shade, base, lit);
          col = mix(col, mix(base, vec3(1.0), 0.35), smoothstep(0.35, 0.9, n.y));   // tops brighten smoothly
          col = mix(col, shade * 0.92, smoothstep(0.35, 0.9, -n.y));
          diffuseColor.rgb = col;`);
    };
    m.customProgramCacheKey = () => "flexity-livery";
    return m;
  }
  M.floor = flat("#EEF6F7", "#CFE1E4", 0.1);
  M.ceil = new THREE.MeshBasicMaterial({ color: "#F4FAFB", side: THREE.DoubleSide });
  M.frameDS = new THREE.MeshBasicMaterial({ color: COL.frame, side: THREE.DoubleSide });

  // nose profile sections: rows of [height, nose setback, side inset]; each section is one smooth surface
  const range = (n, f) => Array.from({ length: n }, (_, i) => f(i / (n - 1)));
  const SECTIONS = [
    range(8, (t) => [V.base + 0.34 * t, 0.15 * (1 - t) ** 2 - 0.02 * t, 0.07 * (1 - t) ** 2]),            // rounded white apron
    [[0.62, -0.02, 0], [0.62, -0.1, 0], [0.625, -0.14, 0]],                                              // bumper underside
    range(7, (t) => [0.625 + 0.25 * t, -0.14 - 0.025 * Math.sin(Math.PI * t), 0]),                       // bulging bumper face
    [[0.875, -0.14, 0], [0.88, -0.1, 0], [0.88, -0.04, 0]],                                              // bumper top
    range(4, (t) => [0.88 + 0.32 * t, -0.04 + 0.04 * t, 0]),                                            // light band
    [[V.header, 0.24, 0], [V.roof, 0.28, 0], ...range(12, (t) => {                                       // header + rounded roof cap
      const a = (t * Math.PI) / 2;
      return [V.roof + 0.46 * Math.sin(a), 0.28 + 0.67 * (1 - Math.cos(a)), 0.32 * (1 - Math.cos(a))];
    }).slice(1)],
  ];

  function module(u0, L, nose, slots) {
    const g = new THREE.Group();
    const S = (sb, ins = 0) => planShape(u0, L, nose, sb, ins, RC, BULGE);
    const skin = liveryMat(u0, L, nose);
    for (const rows of SECTIONS) g.add(ringStack(S, rows, skin));
    g.add(capTop(S(0.95, 0.32), V.top, skin));                              // roof
    g.add(capTop(S(0.0, 0.03), V.glass - 0.002, M.floor));                 // interior floor
    g.add(capTop(S(0.24, 0.03), V.header + 0.002, M.ceil));                // interior ceiling
    const gl = ringStack(S, [[V.glass, 0.02, 0.012], [V.header, 0.26, 0.012]], glass); // windscreen + side glass
    gl.renderOrder = 5; glassMeshes.push(gl); g.add(gl);
    // white pillar behind the windscreen (the top of the swoosh "C")
    if (nose) {
      const pts = [[0.86, V.glass], [1.24, V.glass], [1.36, 1.8], [1.56, V.header], [1.1, V.header], [0.98, 1.8]];
      const sh = new THREE.Shape(pts.map(([d, v]) => new THREE.Vector2(d, v)));
      const front = nose === "front";
      for (const sx of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 8), M.whiteDS);
        m.geometry.applyMatrix4(new THREE.Matrix4().set(0, 0, 0, sx * (HW + 0.004), 0, 1, 0, 0, front ? -1 : 1, 0, 0, front ? -u0 : -(u0 + L), 0, 0, 0, 1));
        g.add(m);
      }
    }
    // pillars + seats + windows along both sides
    let u = u0 + slots.start;
    const pillar = (uc, w = 0.14) => {
      for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, V.header - V.glass, w), M.frame);
        p.position.set(sx * (HW - 0.012 + 0.03), (V.glass + V.header) / 2, -uc); g.add(p);
      }
    };
    pillar(u - 0.08);
    for (const k of slots.seq) {
      const w = k === "D" ? 1.32 : 1.22;
      if (k === "D") {
        // double door on the platform side (x < 0): frame, two leaves with windows
        const dx = -HW - 0.03;
        for (const s of [-1, 1]) {
          const zc = -(u + w / 2 + s * (w / 4)), lw = w / 2 - 0.03;
          const lower = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.95 - V.base - 0.06, lw), M.body);
          lower.position.set(dx, (V.base + 0.06 + 0.95) / 2, zc); g.add(lower);
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, V.glass - 0.95, lw), M.white);
          band.position.set(dx, (0.95 + V.glass) / 2, zc); g.add(band);
          const pane = new THREE.Mesh(new THREE.BoxGeometry(0.02, V.header - V.glass - 0.04, lw), new THREE.MeshBasicMaterial({ color: COL.glass, transparent: true, opacity: 0.6 }));
          pane.position.set(dx, (V.glass + V.header) / 2, zc); pane.renderOrder = 6; g.add(pane);
        }
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.05, V.header - V.base - 0.06, 0.035), M.frame);
        seam.position.set(dx - 0.004, (V.base + V.header) / 2, -(u + w / 2)); g.add(seam);
        // poles inside by the door
        for (const s of [-1, 1]) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, V.header - V.glass, 8), M.mint);
          pole.position.set(-0.45, (V.glass + V.header) / 2, -(u + w / 2 + s * 0.5)); g.add(pole);
        }
      } else {
        windows.push(new THREE.Vector3(-HW + 0.42, 1.86, -(u + w / 2)));
        // seats on both sides facing forward
        for (const sx of [-1, 1]) {
          const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.45), M.seat);
          cushion.position.set(sx * (HW - 0.55), V.glass + 0.32, -(u + w / 2 - 0.1)); g.add(cushion);
          const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.1), M.seatBack);
          back.position.set(sx * (HW - 0.55), V.glass + 0.66, -(u + w / 2 + 0.16)); g.add(back);
        }
      }
      u += w;
      pillar(u + 0.08);
      u += 0.16;
    }
    // ceiling light strip + horizontal grab rail
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, L - 0.6), M.lamp);
    strip.position.set(0, V.header - 0.02, -(u0 + L / 2)); g.add(strip);
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, L - 0.8, 6), M.mint);
      rail.rotation.x = Math.PI / 2; rail.position.set(sx * 0.62, V.header - 0.28, -(u0 + L / 2)); g.add(rail);
    }
    // roof equipment pod
    const pod = slice(planShape(u0 + L * 0.25, L * 0.5, null, 0, 0.55), V.top, 0.22, M.white);
    g.add(pod);
    car.add(g);
  }

  function joint(u0, len) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, V.top - V.base - 0.12, len), M.joint);
    core.position.set(0, (V.base + V.top - 0.12) / 2 + 0.02, -(u0 + len / 2)); g.add(core);
    for (let i = 1; i < 6; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, V.top - V.base - 0.2, 0.035), M.rib);
      rib.position.set(0, (V.base + V.top - 0.2) / 2 + 0.02, -(u0 + (len * i) / 6)); g.add(rib);
    }
    car.add(g);
  }

  const parts = [
    ["mod", 7.6, "front", { start: 1.75, seq: "WDWW" }],
    ["joint", 0.62],
    ["mod", 5.4, null, { start: 0.62, seq: "WDW" }],
    ["joint", 0.62],
    ["mod", 5.9, null, { start: 0.85, seq: "WWW" }],
    ["joint", 0.62],
    ["mod", 5.4, null, { start: 0.62, seq: "WDW" }],
    ["joint", 0.62],
    ["mod", 7.6, "back", { start: 0.3, seq: "WWDW" }],
  ];
  let u = 0, midU = 0;
  parts.forEach((p, i) => {
    if (p[0] === "mod") { module(u, p[1], p[2], p[3]); if (i === 4) midU = u + p[1] / 2; }
    else joint(u, p[1]);
    u += p[1];
  });
  const total = u;

  // Front details: amber LED destination blind, fleet number on the cap, light band
  const signTex = dotMatrixTexture("2027   GENAI GENESIS");
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.17), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, 2.22, -0.62); car.add(sign);
  const signGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.17), new THREE.MeshBasicMaterial({ map: blurredTex(signTex, 5), color: "#FFB04A", transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  signGlow.position.set(0, 2.22, -0.615); signGlow.renderOrder = 7; car.add(signGlow);
  const plateTex = canvasTex(256, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#FFFFFF"; g.font = `700 72px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("2027", w / 2, h / 2 + 4);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.17), new THREE.MeshBasicMaterial({ map: plateTex, transparent: true }));
  plate.position.set(0, 2.6, -(0.26 - BULGE / 2) + 0.016); car.add(plate);
  const cx = HW - RC;
  function onNose(x, y, mesh, lift = 0.01, setback = -0.02) {
    const ax = Math.abs(x);
    let uu, ang;
    if (ax <= cx) { const t = (1 - x / cx) / 2; uu = -BULGE * 2 * t * (1 - t); ang = Math.atan2(x, cx) * 0.35; }
    else { const d = ax - cx; uu = RC - Math.sqrt(RC * RC - d * d); ang = Math.asin(Math.min(1, d / RC)) * Math.sign(x); }
    uu += setback;
    const h = new THREE.Group();
    h.position.set(x + Math.sin(ang) * lift, y, -uu + Math.cos(ang) * lift); h.rotation.y = ang;
    h.add(mesh); car.add(h); return h;
  }
  const ringMat = new THREE.MeshBasicMaterial({ color: COL.frame });
  const ledMat = new THREE.MeshBasicMaterial({ color: "#FFFFFF" });
  for (const s of [-1, 1]) {
    // two round headlamps, an LED bar and a small marker, like the photos
    for (const [x, r] of [[0.8, 0.065], [0.97, 0.05]]) {
      onNose(s * x, 1.04, new THREE.Mesh(new THREE.CircleGeometry(r + 0.022, 24), ringMat), 0.012);
      onNose(s * x, 1.04, new THREE.Mesh(new THREE.CircleGeometry(r, 24), M.lamp), 0.016);
    }
    onNose(s * 0.36, 1.04, new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.045), ledMat), 0.014);
    onNose(s * 0.36, 1.04, new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.075), ringMat), 0.011);
    // beacon lights on the roof cap
    onNose(s * 0.84, 2.72, new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), M.mint), 0.012, 0.29);
  }

  // Pantograph on the middle module
  const panto = new THREE.Group();
  const bar = (len, rz, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.04), M.frame); m.rotation.z = rz; m.position.set(x, y, 0); return m; };
  panto.add(bar(1.1, 0.8, -0.2, 0.38), bar(1.1, -0.8, 0.2, 0.38));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 1.3), M.frame); head.position.y = 0.78; panto.add(head);
  panto.rotation.y = Math.PI / 2; panto.position.set(0, V.top + 0.22, -midU);
  // pantograph left off: it crossed the heading in the tracking shots

  // Street: asphalt, white lane lines, the streetcar rails, sidewalks under the buildings
  const world = new THREE.Group(); scene.add(world);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(30, 400), flat("#D5CDEB", "#B3A5E3", 0.0, 1));
  road.rotation.x = -Math.PI / 2; road.position.set(-2.5, -0.01, -150); world.add(road);
  const trackLane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 400), flat("#CBC2E6", "#B3A5E3", 0.0, 1));
  trackLane.rotation.x = -Math.PI / 2; trackLane.position.set(0, -0.006, -150); world.add(trackLane);
  for (const x of [-0.72, 0.72]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 400), nightBasic(new THREE.MeshBasicMaterial({ color: COL.rail })));
    r.position.set(x, 0.0, -150); world.add(r);
  }
  const dashTex = canvasTex(16, 128, (g) => { g.clearRect(0, 0, 16, 128); g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 16, 64); });
  dashTex.wrapS = dashTex.wrapT = THREE.RepeatWrapping; dashTex.repeat.set(1, 66);
  const lineMat = nightBasic(new THREE.MeshBasicMaterial({ color: "#FFFFFF" }), 0.8);
  const lane = (x, dashed, w = 0.14) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 400), dashed ? nightBasic(new THREE.MeshBasicMaterial({ map: dashTex, transparent: true }), 0.8) : lineMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.002, -150); world.add(m);
  };
  lane(-1.75, false, 0.1); lane(1.75, false, 0.1);       // track lane edges
  lane(-5.2, true); lane(5.2, true);                      // lane dividers
  lane(-10.4, false); lane(9.6, false);                   // road edge lines
  const tileTex = canvasTex(256, 256, (g) => {
    g.fillStyle = "#F4F0FB"; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(150,130,210,0.35)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 2); g.lineTo(256, 2); g.moveTo(2, 0); g.lineTo(2, 256); g.stroke();
  });
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(4, 160);
  const CURB = 0.16;
  for (const [x0, x1] of [[-30, -11.2], [10.4, 30]]) {
    const wdt = x1 - x0;
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(wdt, 400), nightBasic(new THREE.MeshBasicMaterial({ map: tileTex })));
    walk.rotation.x = -Math.PI / 2; walk.position.set((x0 + x1) / 2, CURB, -150); world.add(walk);
    const curb = new THREE.Mesh(new THREE.PlaneGeometry(400, CURB), flat("#E3DCF5", "#C2B6EA", 0.45, 1));
    curb.rotation.y = x0 < 0 ? Math.PI / 2 : -Math.PI / 2; curb.position.set(x0 < 0 ? x1 : x0, CURB / 2, -150); world.add(curb);
  }
  const edgeTex = dashTex;   // scrolled with the lane dashes

  // Wind streaks
  const STREAKS = 58;                                // white only, ~35% fewer than before
  const streakGeo = new THREE.BoxGeometry(0.03, 0.03, 1);
  const streakSets = [0.9, 0.7].map((op) => {
    const m = new THREE.InstancedMesh(streakGeo, new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: op, depthWrite: false }), STREAKS / 2);
    m.renderOrder = 7; scene.add(m); return m;
  });
  const streaks = [];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < STREAKS; i++) {
    let x, y;
    do { x = -6 + rnd() * 11; y = 0.4 + rnd() * 5; } while (Math.abs(x) < HW + 0.45 && y < V.top + 0.6);
    streaks.push({ x, y, z: 12 - rnd() * 90, len: 1.5 + rnd() * 5, speed: 55 + rnd() * 40 });
  }
  const m4 = new THREE.Matrix4(), sq = new THREE.Quaternion(), sp = new THREE.Vector3(), ss = new THREE.Vector3();

  // Passing city: two rows of buildings either side of the line
  const SPAN = 260;
  const sides = [];
  for (const side of [-1, 1]) {
    let z = 40;
    while (z > 40 - SPAN) {
      const w = 3 + rnd() * 5, d = 3 + rnd() * 6;
      const x = side < 0 ? -(14 + rnd() * 7) - w / 2 : 13 + rnd() * 7 + w / 2;
      sides.push({ x, z: z - d / 2, w, d, h: side < 0 ? 4 + rnd() * 9 : 5 + rnd() * 13 });
      z -= d + 1.5 + rnd() * 4;
    }
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1); unitBox.translate(0, 0.5, 0);
  const rowMat = flat("#FFFFFF", "#BFE8EA", 0.3, 1);
  rowMat.transparent = true;
  const baseCompile = rowMat.onBeforeCompile;
  rowMat.onBeforeCompile = (sh) => {      // fade with distance so buildings melt into the horizon
    baseCompile(sh);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vDepth;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvDepth = -mvPosition.z;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vDepth;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(70.0, 175.0, vDepth);");
  };
  rowMat.customProgramCacheKey = () => "sc-row-fade";
  const cityRow = new THREE.InstancedMesh(unitBox, rowMat, sides.length);
  const TONES = ["#FFFFFF", "#E4FEFF", "#BCFEFF", "#F3DAFF", "#F6F1FF", "#D9FFF4"];
  const tcol = new THREE.Color();
  sides.forEach((b, i) => cityRow.setColorAt(i, tcol.set(TONES[Math.floor(rnd() * TONES.length)])));
  cityRow.instanceColor.needsUpdate = true;
  scene.add(cityRow);

  // Snow falling past the car (streams backwards with the wind)
  const FLAKES = 900;
  const flakePos = new Float32Array(FLAKES * 3), flakes = [];
  for (let i = 0; i < FLAKES; i++) {
    flakes.push({ x: -16 + rnd() * 30, y: rnd() * 14, z: 18 - rnd() * 140, vy: 1.2 + rnd() * 1.6, ph: rnd() * 6.28 });
  }
  const flakeGeo = new THREE.BufferGeometry();
  flakeGeo.setAttribute("position", new THREE.BufferAttribute(flakePos, 3));
  const flakeMat = new THREE.PointsMaterial({ color: "#FFFFFF", size: 0.14, map: snowflakeTexture(), alphaTest: 0.02, sizeAttenuation: true, transparent: true, depthWrite: false });
  const snowPts = new THREE.Points(flakeGeo, flakeMat);
  snowPts.renderOrder = 8; snowPts.frustumCulled = false;
  scene.add(snowPts);

  // The CN Tower on the skyline, seen straight away in the opening shot
  function addTower(model, palette) {
    const t = model.clone(true);
    t.traverse((n) => {
      if (!n.isMesh) return;
      const [lit, shade] = palette[n.material.name] || ["#FFFFFF", "#DDDDDD"];
      n.material = flat(lit, shade, 0.2, 0.8);
    });
    t.scale.setScalar(30);
    t.position.set(270, 0, -600);
    scene.add(t);
  }

  // Team avatars floating inside the windows
  const avatars = team.map((member, i) => {
    const w = windows[i];
    if (!w) return null;
    // depthTest off: the photo floats in the window and never cuts into the seats behind it
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: avatarTexture(i, member), transparent: true, depthTest: false, depthWrite: false }));
    s.position.copy(w); s.scale.setScalar(0.001); s.renderOrder = 9;
    car.add(s);
    return { sprite: s, base: w.clone(), shown: 0, target: 0, phase: i * 1.37 };
  }).filter(Boolean);

  /* ------------------------------------------------------------ camera */
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const Vv = (a) => new THREE.Vector3(...a);
  const REF = { cam: Vv([-3.7, 1.75, 6.6]), look: Vv([0.3, 2.2, -8.0]) };     // platform view of the nose
  const PREF = { cam: Vv([-3.0, 2.1, 12.5]), look: Vv([0.1, 3.6, -1.0]) };    // same view, framed for portrait screens
  let q = 0, time = 0, revealCount = 0;
  const winZ = (f) => {
    const i = Math.max(0, Math.min(avatars.length - 1, f));
    const a = Math.floor(i), b = Math.min(avatars.length - 1, a + 1);
    return lerp(avatars[a].base.z, avatars[b].base.z, i - a);
  };
  const trackAt = (z) => ({ cam: Vv([-7.6, 2.15, z + 4.6]), look: Vv([0.4, 1.75, z - 2.4]) });
  function placeCamera() {
    const N = avatars.length;
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    if (q < 0.12) { pos.copy(REF.cam); tgt.copy(REF.look); }
    else if (q < 0.78) {
      const k = smooth(Math.min(1, (q - 0.12) / 0.08));
      const T = trackAt(winZ(Math.max(0, (q - 0.16) / 0.56) * (N - 1)));
      pos.lerpVectors(REF.cam, T.cam, k); tgt.lerpVectors(REF.look, T.look, k);
    } else {
      const T = trackAt(winZ(N - 1));
      const k = smooth(Math.min(1, (q - 0.78) / 0.14));
      pos.lerpVectors(T.cam, REF.cam, k); tgt.lerpVectors(T.look, REF.look, k);
    }
    if (camera.aspect < 0.85) {
      // phones: tracking shots pull back; the opening / closing front view is re-framed so the
      // nose sits centred in the lower half, under the copy
      const w = q < 0.12 ? 1 : q < 0.78 ? 1 - smooth(Math.min(1, (q - 0.12) / 0.08)) : smooth(Math.min(1, (q - 0.78) / 0.14));
      pos.x -= 4.5 * (1 - w); pos.y += 0.5 * (1 - w); pos.z += 5.5 * (1 - w);
      pos.lerp(PREF.cam, w); tgt.lerp(PREF.look, w);
    }
    pos.y += Math.sin(time * 9.0) * 0.01; pos.x += Math.sin(time * 5.3) * 0.008;
    camera.position.copy(pos); camera.lookAt(tgt);
  }

  function setProgress(v) {
    q = v;
    const f = Math.max(0, (q - 0.14) / 0.56) * (avatars.length - 1);
    revealCount = q < 0.13 ? 0 : Math.min(avatars.length, Math.floor(f + 1.05));
    avatars.forEach((a, i) => { a.target = i < revealCount ? 1 : 0; });
  }

  function tick(dt, still) {
    if (!still) time += dt;
    const per = STREAKS / 2;
    streaks.forEach((s, i) => {
      if (!still) { s.z -= s.speed * dt; if (s.z < -90) s.z += 102; }
      sp.set(s.x, s.y, s.z); ss.set(1, 1, s.len);
      streakSets[i % 2].setMatrixAt(Math.floor(i / 2) % per, m4.compose(sp, sq, ss));
    });
    // passing buildings stream backwards on both sides
    sides.forEach((b, i) => {
      if (!still) { b.z -= 34 * dt; if (b.z < 40 - SPAN) b.z += SPAN; }   // recede: the car is coming toward us
      sp.set(b.x, CURB, b.z); ss.set(b.w, b.h, b.d);
      cityRow.setMatrixAt(i, m4.compose(sp, sq, ss));
    });
    cityRow.instanceMatrix.needsUpdate = true;
    flakes.forEach((f, i) => {
      if (!still) {
        f.y -= f.vy * dt; f.z -= 22 * dt;
        if (f.y < 0) f.y += 14;
        if (f.z < -122) f.z += 140;
      }
      flakePos[i * 3] = f.x + Math.sin(time * 1.3 + f.ph) * 0.25; flakePos[i * 3 + 1] = f.y; flakePos[i * 3 + 2] = f.z;
    });
    flakeGeo.attributes.position.needsUpdate = true;
    streakSets.forEach((s) => { s.instanceMatrix.needsUpdate = true; });
    if (!still) { tileTex.offset.y -= dt * 34 / 2.5; dashTex.offset.y -= dt * 34 / 6.06; }
    car.position.y = Math.sin(time * 14) * 0.006;
    car.rotation.z = Math.sin(time * 3.1) * 0.002;
    avatars.forEach((a) => {
      a.shown += (a.target - a.shown) * Math.min(1, dt * 7);
      const pop = a.shown < 0.001 ? 0.001 : a.shown * (1 + 0.12 * Math.sin(Math.min(1, a.shown) * Math.PI));
      a.sprite.scale.setScalar(0.74 * pop);
      a.sprite.position.set(a.base.x, a.base.y + Math.sin(time * 1.8 + a.phase) * 0.06, a.base.z + Math.cos(time * 1.3 + a.phase) * 0.05);
      a.sprite.material.rotation = Math.sin(time * 1.1 + a.phase) * 0.08;
    });
    placeCamera();
  }

  const tmp = new THREE.Vector3();
  function labels(width, height) {
    return avatars.map((a) => {
      tmp.set(-HW - 0.05, 0.86, a.base.z).applyMatrix4(car.matrixWorld).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height, visible: a.shown > 0.5 && tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 };
    });
  }

  function setTheme(dark) {
    nightU.value = dark ? 1 : 0;
    for (const [m, c, k] of nightBasics) m.color.copy(c).multiply(dark ? DAY.clone().lerp(NIGHT, k) : DAY);
  }
  return { scene, camera, setProgress, tick, labels, total, addTower, setTheme, get revealed() { return revealCount; } };
}
