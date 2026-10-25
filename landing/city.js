/**
 * Toronto diorama for the landing-page story.
 *
 * A round island of downtown Toronto — the CN Tower model, the Rogers Centre
 * dome, City Hall's two curved towers and a financial-district skyline — on
 * the shore of a pastel Lake Ontario. Everything is flat-shaded in the hero
 * palette (lit face / shadow face / pale top), with no lights in the scene.
 *
 * The whole diorama sits inside a glass snow globe on a pedestal. In the hero the
 * camera is inside the glass, so the dome is invisible; as it pulls back the dome
 * fades in by distance and the snow swirls with scroll.
 *
 * Scroll drives: buildings rising out of the ground, the whole city turning
 * on its axis (the hape.io-style centred rotation), and the camera moving
 * between chapter poses. Hovering a building lifts it.
 *
 * In the stats chapter the numbers orbit the globe as a curved band of type
 * (Universal-logo style) that turns with scroll: each stat swings in from
 * behind the glass, crosses the front and exits round the other side.
 *
 * After the Toronto chapter the snow globe shrinks while the Earth (globe.js) grows
 * inside it, then the Earth settles as a big horizon along the bottom of the screen,
 * turning to each country as the TTC line on the map advances.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import signFont from "./sign-font.js";
import { createGlobe } from "./globe.js";

const RING_FONT = `"Google Sans Flex", "Google Sans", system-ui, sans-serif`;

/* ------------------------------------------------------------- palette */
export const PASTEL = {
  tower_teal:     ["#2EF2DC", "#24B3AC"],   // the hero's "next." gradient: bright cyan lit side, deep teal shadow
  tower_teal_low: ["#2EF2DC", "#24B3AC"],
  band_purple:    ["#F3DAFF", "#E09DFF"],
  band_top:       ["#F3DAFF", "#F3DAFF"],
  band_rim:       ["#F3DAFF", "#F3DAFF"],
  tier_purple:    ["#F3DAFF", "#E09DFF"],
  deck_dark:      ["#E09DFF", "#E09DFF"],
  deck_bright:    ["#F7E6FF", "#F3DAFF"],
  deck_lilac:     ["#FFFFFF", "#FFFFFF"],
  pod_mint:       ["#E4FEFF", "#BCFEFF"],
  pod_rim:        ["#FFFFFF", "#F4FFFF"],
  pod_hole:       ["#00FFDD", "#00FFDD"],
  antenna_glow:   ["#FFFFFF", "#FFFFFF"],
};
const BUILDING_TONES = ["#FFFFFF", "#F6F1FF", "#F3DAFF", "#E4FEFF", "#BCFEFF", "#E7E0FF", "#FFFFFF", "#F3DAFF"];

// World light: from camera-right and slightly toward the viewer in the hero.
const LIGHT_W = new THREE.Vector3(1, 0, 0.45).normalize();
const towerLight = { value: new THREE.Vector2(1, 0) };   // view-space xz, updated per frame
const worldLight = { value: new THREE.Vector2(LIGHT_W.x, LIGHT_W.z) };
const cityNight = { value: 0 };   // dark mode: softens the pastel city

/* ------------------------------------------------------------ materials */
function towerMaterial(lit, shadow, name) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(lit) });
  m.name = name;
  const shadowColor = new THREE.Color(shadow);
  m.onBeforeCompile = (s) => {
    s.uniforms.uShadowColor = { value: shadowColor };
    s.uniforms.uLightDir = towerLight;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vSide;\nuniform vec2 uLightDir;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 radialV = modelViewMatrix * vec4(transformed.x, 0.0, transformed.z, 0.0);
        vSide = dot(radialV.xz, uLightDir);`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vSide;\nuniform vec3 uShadowColor;")
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", `float w = max(fwidth(vSide), 1e-6);
        vec4 diffuseColor = vec4( mix(uShadowColor, diffuse, clamp(vSide / w + 0.5, 0.0, 1.0)), opacity );`);
  };
  m.customProgramCacheKey = () => "city-tower";
  return m;
}

/* ------------------------------------------------------------ dust
   Snow globe → Earth: the moment the Earth starts to form, the whole snow globe (glass, snow,
   city, tower, pedestal) crumbles to dust from the top down. One uniform drives every material;
   the crumble key is computed in the city's own space so it lines up across meshes. */
const dustU = { value: 0 };                       // 0 → 1.5 (runs past 1 so the last specks finish)
const dustInv = { value: new THREE.Matrix4() };   // world → city space
const DUST_TOP = 10.5, DUST_BOT = -2.05;          // dome top (GY + GR) → pedestal foot, city space
const DUST_GLSL = `
  uniform float uDust; uniform mat4 uDustInv;
  float dustH(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float dustN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(dustH(i), dustH(i + vec3(1,0,0)), f.x), mix(dustH(i + vec3(0,1,0)), dustH(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(dustH(i + vec3(0,0,1)), dustH(i + vec3(1,0,1)), f.x), mix(dustH(i + vec3(0,1,1)), dustH(i + vec3(1,1,1)), f.x), f.y), f.z); }
  // < 0: still solid; 0..1: the glowing crumble edge; the caller discards past it
  float dustEdge(vec3 w){
    if (uDust <= 0.0) return -1.0;
    vec3 p = (uDustInv * vec4(w, 1.0)).xyz;
    float t = clamp((${DUST_TOP.toFixed(2)} - p.y) / ${(DUST_TOP - DUST_BOT).toFixed(2)}, 0.0, 1.0);
    float key = mix(t, dustN(p * 2.2) * 0.6 + dustH(floor(p * 9.0)) * 0.4, 0.55);
    float th = uDust * 1.15;
    if (key < th) return 2.0;
    return 1.0 - smoothstep(th, th + 0.07, key);
  }`;
const DUST_COL = "mix(vec3(1.0), vec3(0.7, 1.0, 0.96), uDustNight)";
/** Patch a built-in material (MeshBasic / Points, with or without its own onBeforeCompile). */
function dustMaterial(m) {
  if (m.userData.dust || m.isShaderMaterial) return;
  m.userData.dust = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (s, r) => {
    prev?.call(m, s, r);
    s.uniforms.uDust = dustU; s.uniforms.uDustInv = dustInv; s.uniforms.uDustNight = cityNight;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vDustW;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        #ifdef USE_INSTANCING
          vDustW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vDustW = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vDustW; uniform float uDustNight;${DUST_GLSL}`)
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  float dE = dustEdge(vDustW); if (dE > 1.5) discard;")
      .replace("#include <opaque_fragment>", `#include <opaque_fragment>\n  if (dE > 0.0) gl_FragColor.rgb = mix(gl_FragColor.rgb, ${DUST_COL}, dE);`);
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey.call(m) : "") + "-dust";
  m.needsUpdate = true;
}
function dustify(root) {
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) dustMaterial(m);
  });
}

/**
 * Flat "illustration" shading from the world normal: pale top, lit side,
 * shadow side. `windows` adds a faint floor/mullion grid on the walls.
 */
function flatMaterial({ color = "#ffffff", windows = false, instanced = false, shade = "#B49CF0", topMix = 0.5 } = {}) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
  m.onBeforeCompile = (s) => {
    s.uniforms.uLight = worldLight;
    s.uniforms.uShade = { value: new THREE.Color(shade) };
    s.uniforms.uWin = { value: new THREE.Color("#8F7FE0") };
    s.uniforms.uNight = cityNight;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vN;\nvarying vec3 vW;\nvarying vec3 vL;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        #ifdef USE_INSTANCING
          mat4 mm = modelMatrix * instanceMatrix;
        #else
          mat4 mm = modelMatrix;
        #endif
        vN = normalize(mat3(mm) * normal);
        vW = (mm * vec4(transformed, 1.0)).xyz;
        vL = transformed;`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vN; varying vec3 vW; varying vec3 vL;
        uniform vec2 uLight; uniform vec3 uShade; uniform vec3 uWin; uniform float uNight;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 n = normalize(vN);
        vec3 base = diffuseColor.rgb;
        float side = step(0.0, dot(n.xz, uLight));
        vec3 col = mix(mix(base, uShade, 0.42), base, side);
        if (n.y > 0.55) col = mix(base, vec3(1.0), ${topMix.toFixed(2)});
        ${windows ? `
        if (n.y < 0.55 && n.y > -0.55 && vL.y > 0.06 && vL.y < 0.94) {
          float along = abs(n.x) > 0.5 ? vW.z : vW.x;
          float floorBand = step(0.55, fract(vW.y * 2.6));
          float mull = step(0.86, fract(along * 2.2));
          col = mix(col, uWin, 0.16 * max(floorBand, mull));
        }` : ""}
        col = mix(col, col * vec3(0.66, 0.62, 0.84) + vec3(0.02, 0.01, 0.05), uNight);
        diffuseColor.rgb = col;`);
  };
  m.customProgramCacheKey = () => `city-flat-${windows}-${instanced}-${topMix}`;
  return m;
}

/* ------------------------------------------------------------- helpers */
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

function crescent(rOuter, thick, span, height) {
  const s = new THREE.Shape();
  const a0 = -span / 2, a1 = span / 2;
  s.absarc(0, 0, rOuter, a0, a1, false);
  s.absarc(0, 0, rOuter - thick, a1, a0, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  return g;
}

/* ---------------------------------------------------------------- build */
export async function createCity(model, { stats = [] } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);

  const pivot = new THREE.Group();      // tilt pivot at deck height
  const city = new THREE.Group();       // turns around the tower axis
  pivot.position.y = 6.1;
  city.position.y = -6.1;
  pivot.add(city);
  scene.add(pivot);

  // Island + lake
  const R = 7.2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.25, 0.7, 96), flatMaterial({ color: "#EFE8FF", shade: "#C8B6F5", topMix: 0.55 }));
  base.position.y = -0.35;
  city.add(base);

  // Snow globe: snowy ground ring, pedestal, glass dome, snow
  const GR = 9.0, GY = 1.5;                       // globe radius / centre height
  const groundR = Math.sqrt(GR * GR - GY * GY);    // where the glass meets the ground
  const snowRing = new THREE.Mesh(new THREE.RingGeometry(R, groundR + 0.05, 96, 1), flatMaterial({ color: "#FFFFFF", topMix: 0.2 }));
  snowRing.rotation.x = -Math.PI / 2; snowRing.position.y = -0.002;
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(groundR + 0.35, groundR + 0.9, 1.5, 96), flatMaterial({ color: "#F3DAFF", shade: "#C9A6F5", topMix: 0.6 }));
  plinth.position.y = -0.75 - 0.03;
  const band = new THREE.Mesh(new THREE.TorusGeometry(groundR + 0.36, 0.13, 10, 120), flatMaterial({ color: "#00FFDD", shade: "#22CBBD", topMix: 0.3 }));
  band.rotation.x = Math.PI / 2; band.position.y = -0.12;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(groundR + 0.9, groundR + 1.2, 0.45, 96), flatMaterial({ color: "#FFFFFF", shade: "#D9CCF7", topMix: 0.5 }));
  foot.position.y = -1.5 - 0.225;
  city.add(snowRing, plinth, band, foot);

  // Dust specks: off the pedestal, the glass and the city, each leaving when the crumble line
  // reaches it (same top-down key as the surfaces)
  const SP_BASE = 700, SP_GLASS = 1100, SP_CITY = 500, SPECKS = SP_BASE + SP_GLASS + SP_CITY;
  const spP = new Float32Array(SPECKS * 3), spD = new Float32Array(SPECKS * 3), spK = new Float32Array(SPECKS);
  {
    const r2 = rng(777);
    const keyAt = (y) => Math.min(1, Math.max(0, (DUST_TOP - y) / (DUST_TOP - DUST_BOT))) * 0.45 + r2() * 0.55;
    for (let i = 0; i < SPECKS; i++) {
      let x, y, z, dx, dy, dz;
      if (i < SP_BASE) {                       // pedestal rim
        const a = r2() * Math.PI * 2; y = -0.05 - r2() * 1.9;
        const rr = (y > -1.5 ? groundR + 0.35 + (-y / 1.5) * 0.55 : groundR + 1.0) + 0.02;
        x = Math.cos(a) * rr; z = Math.sin(a) * rr;
        dx = Math.cos(a) * (0.6 + r2()); dy = 0.5 + r2() * 1.2; dz = Math.sin(a) * (0.6 + r2());
      } else if (i < SP_BASE + SP_GLASS) {     // the glass: points on the dome, blown outward
        let nx, ny, nz;
        do { nx = r2() * 2 - 1; ny = r2() * 2 - 1; nz = r2() * 2 - 1; } while (nx * nx + ny * ny + nz * nz > 1 || nx * nx + ny * ny + nz * nz < 0.05);
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        if (GY + ny * GR < 0) ny = -ny;        // keep to the part above the ground
        x = nx * GR; y = GY + ny * GR; z = nz * GR;
        const sp = 0.5 + r2() * 1.1;
        dx = nx * sp; dy = ny * sp + 0.4; dz = nz * sp;
      } else {                                 // the city: low points among the buildings
        const a = r2() * Math.PI * 2, rr = Math.sqrt(r2()) * (R - 0.3);
        x = Math.cos(a) * rr; z = Math.sin(a) * rr; y = 0.1 + Math.pow(r2(), 2) * 4.5;
        dx = Math.cos(a) * (0.4 + r2()); dy = 0.6 + r2() * 1.2; dz = Math.sin(a) * (0.4 + r2());
      }
      spP.set([x, y, z], i * 3); spD.set([dx, dy, dz], i * 3); spK[i] = keyAt(y);
    }
  }
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute("position", new THREE.BufferAttribute(spP, 3));
  spGeo.setAttribute("aDir", new THREE.BufferAttribute(spD, 3));
  spGeo.setAttribute("aKey", new THREE.BufferAttribute(spK, 1));
  const specks = new THREE.Points(spGeo, new THREE.ShaderMaterial({
    uniforms: { uDis: dustU, uNight: cityNight, uScale: { value: 300 } }, transparent: true, depthWrite: false,
    vertexShader: `attribute vec3 aDir; attribute float aKey; uniform float uDis; uniform float uScale; varying float vA;
      void main(){
        float age = clamp((uDis * 1.15 - aKey) / 0.35, 0.0, 1.0);
        vA = age > 0.0 ? (1.0 - age) : 0.0;
        vec3 p = position + aDir * age * 2.2 + vec3(0.0, -1.0, 0.0) * age * age * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uScale * 0.09 * (1.0 - age * 0.6) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uNight; varying float vA;
      void main(){ if (vA <= 0.0) discard; vec2 q = gl_PointCoord - 0.5; if (dot(q, q) > 0.25) discard;
        gl_FragColor = vec4(mix(vec3(0.95, 0.92, 1.0), vec3(0.6, 1.0, 0.95), uNight), vA); }`,
  }));
  specks.frustumCulled = false; specks.visible = false; specks.renderOrder = 12;
  city.add(specks);

  const domeU = { uOpacity: { value: 0 }, uDust: dustU, uDustInv: dustInv, uDustNight: cityNight };
  const domeMat = (side, k) => new THREE.ShaderMaterial({
    uniforms: domeU, transparent: true, depthWrite: false, side,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vDustW;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        vDustW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uOpacity; uniform float uDustNight; varying vec3 vN; varying vec3 vV; varying vec3 vDustW;${DUST_GLSL}
      void main(){
        float dE = dustEdge(vDustW); if (dE > 1.5) discard;
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        if (!gl_FrontFacing) n = -n;
        float f = 1.0 - abs(dot(n, v));
        float rim = pow(f, 2.6);
        vec3 L = normalize(vec3(-0.45, 0.65, 0.6));
        float spec = pow(max(dot(reflect(-v, n), L), 0.0), 60.0);
        float streak = smoothstep(0.92, 1.0, 1.0 - abs(n.x * 0.8 - n.y * 0.6 + 0.35)) * smoothstep(0.2, 0.6, f);
        vec3 col = mix(vec3(0.97, 0.98, 1.0), vec3(0.78, 1.0, 0.97), rim * 0.6);
        float a = (0.012 + rim * 0.38 + spec * 0.75 + streak * 0.12) * ${k.toFixed(2)};
        gl_FragColor = vec4(col + spec * 0.6, a * uOpacity);
        if (dE > 0.0) gl_FragColor = vec4(mix(gl_FragColor.rgb, ${DUST_COL}, dE), max(gl_FragColor.a, dE * 0.85 * uOpacity));
      }`,
  });
  const domeGeo = new THREE.SphereGeometry(GR, 96, 64, 0, Math.PI * 2, 0, Math.acos(-GY / GR));
  const domeBack = new THREE.Mesh(domeGeo, domeMat(THREE.BackSide, 0.35));
  const domeFront = new THREE.Mesh(domeGeo, domeMat(THREE.FrontSide, 1.0));
  for (const d of [domeBack, domeFront]) { d.position.y = GY; d.renderOrder = 10 + (d === domeFront ? 1 : 0); city.add(d); }

  // Snow: scroll-swirled white flakes, dense, with a slow idle drift
  const SNOW = 2600;
  const snowPos = new Float32Array(SNOW * 3), snowSeed = [];
  const sr = rng(4242);
  for (let i = 0; i < SNOW; i++) {
    let x, y, z;
    do { x = (sr() * 2 - 1) * (GR - 0.6); y = 0.3 + sr() * (GR + GY - 1.2); z = (sr() * 2 - 1) * (GR - 0.6); }
    while (Math.hypot(x, y - GY, z) > GR - 0.5);
    snowSeed.push({ y, a: Math.atan2(z, x), r: Math.hypot(x, z), ph: sr() * 6.28 });
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  const snowMat = new THREE.PointsMaterial({ color: "#FFFFFF", size: 0.3, map: snowflakeTexture(), alphaTest: 0.02, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false });
  const snow = new THREE.Points(snowGeo, snowMat);
  snow.renderOrder = 9; snow.frustumCulled = false;
  city.add(snow);
  const H = GR + GY - 0.6;
  let snowTime = 0;
  function updateSnow(c) {
    const tt = snowTime;
    for (let i = 0; i < SNOW; i++) {
      const s = snowSeed[i];
      const k = 1.2 - s.r / GR;
      const a = s.a + c * 0.9 * k + tt * 0.06 * k;                                   // swirl (scroll + idle)
      let y = s.y - c * 1.6 - tt * 0.14 + Math.sin(c * 3 + tt * 0.5 + s.ph) * 0.25;   // drift down
      y = 0.3 + ((((y - 0.3) % H) + H) % H);
      const lim = Math.sqrt(Math.max(0, (GR - 0.5) ** 2 - (y - GY) ** 2));
      const r = Math.min(s.r, lim);
      snowPos[i * 3] = Math.cos(a) * r; snowPos[i * 3 + 1] = y; snowPos[i * 3 + 2] = Math.sin(a) * r;
    }
    snowGeo.attributes.position.needsUpdate = true;
  }
  const globeCentre = new THREE.Vector3();
  const zEdge = 2.1, ang = Math.acos(zEdge / R);
  // Build the lake as an explicit polygon (circular segment south of zEdge).
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const a = -ang + (2 * ang) * (i / 48);
    pts.push(new THREE.Vector2(Math.sin(a) * (R - 0.04), Math.cos(a) * (R - 0.04)));
  }
  const lake = new THREE.Mesh(
    new THREE.ShapeGeometry(new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.y)))),
    waterMaterial()
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.y = 0.012;
  city.add(lake);
  // Shoreline walkway
  const shore = new THREE.Mesh(new THREE.BoxGeometry(2 * Math.sin(ang) * R - 0.2, 0.06, 0.18), flatMaterial({ color: "#FFFFFF" }));
  shore.position.set(0, 0.03, zEdge - 0.05);
  city.add(shore);

  // CN Tower
  const loader = new GLTFLoader();
  const gltf = model instanceof ArrayBuffer ? await loader.parseAsync(model, "") : await loader.loadAsync(model);
  const cache = new Map();
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    const swap = (src) => {
      if (!cache.has(src)) {
        const [lit, shadow] = PASTEL[src.name] ?? ["#ffffff", "#dddddd"];
        cache.set(src, towerMaterial(lit, shadow, src.name));
        src.dispose();
      }
      return cache.get(src);
    };
    node.material = Array.isArray(node.material) ? node.material.map(swap) : swap(node.material);
  });
  city.add(gltf.scene);

  // Rogers Centre (south-west of the tower, by the water)
  const rogers = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.3, 0.42, 48), flatMaterial({ color: "#F3DAFF", windows: false }));
  ring.position.y = 0.21;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.25, 48, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), flatMaterial({ color: "#FFFFFF", shade: "#CBB8F7", topMix: 0.25 }));
  dome.scale.y = 0.42;
  dome.position.y = 0.42;
  const ribs = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.025, 6, 64), flatMaterial({ color: "#E09DFF" }));
  ribs.rotation.x = Math.PI / 2; ribs.position.y = 0.43;
  rogers.add(ring, dome, ribs);
  rogers.position.set(-2.35, 0, 0.75);
  city.add(rogers);

  // City Hall (north): two curved towers facing each other + podium
  const hall = new THREE.Group();
  const hallMat = flatMaterial({ color: "#F6F1FF", windows: true });
  const east = new THREE.Mesh(crescent(1.05, 0.32, 1.9, 2.5), hallMat);
  east.rotation.y = Math.PI; east.position.x = 1.0;
  const west = new THREE.Mesh(crescent(1.05, 0.32, 1.9, 1.95), hallMat);
  west.position.x = -1.0;
  const podium = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.22, 1.6), flatMaterial({ color: "#E7E0FF" }));
  podium.position.y = 0.11;
  hall.add(podium, east, west);
  hall.position.set(2.45, 0, -0.35);
  hall.scale.setScalar(0.85);
  city.add(hall);

  // Nathan Phillips Square: plaza, reflecting pool and the TORONTO sign
  const square = new THREE.Group();
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.04, 1.3), flatMaterial({ color: "#F6F1FF", topMix: 0.3 }));
  plaza.position.y = 0.02;
  const pool = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.03, 0.45), waterMaterial());
  pool.position.set(0, 0.045, 0.32);
  const letters = new TextGeometry("TORONTO", { font: new FontLoader().parse(signFont), size: 0.46, depth: 0.12, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.01, bevelSegments: 2 });
  letters.computeBoundingBox();
  const bb = letters.boundingBox;
  letters.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y, 0);
  const sign = new THREE.Mesh(letters, flatMaterial({ color: "#FFFFFF", shade: "#C9A6F5", topMix: 0.2 }));
  sign.position.set(0, 0.04, -0.05);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(bb.max.x - bb.min.x + 0.2, 0.025, 0.14), new THREE.MeshBasicMaterial({ color: "#00FFDD" }));
  glow.position.set(0, 0.045, 0.0);
  square.add(plaza, pool, glow, sign);
  square.position.set(2.45, 0, 1.05);
  city.add(square);

  // Skyline: instanced boxes, denser and taller in the financial district (NE of the tower)
  const rand = rng(20270);
  const spots = [];
  const reserved = [
    { x: 0, z: 0, r: 1.1 },          // tower base
    { x: -2.35, z: 0.75, r: 1.55 },  // Rogers Centre
    { x: 2.45, z: -0.35, r: 1.5 },   // City Hall
    { x: 2.45, z: 1.0, r: 1.75 },   // Nathan Phillips Square + sign
  ];
  const step = 0.92;
  for (let gx = -6.5; gx <= 6.5; gx += step) {
    for (let gz = -6.5; gz <= 1.7; gz += step) {
      const x = gx + (rand() - 0.5) * 0.25, z = gz + (rand() - 0.5) * 0.25;
      const d = Math.hypot(x, z);
      if (d > R - 0.75) continue;
      if (reserved.some((r) => Math.hypot(x - r.x, z - r.z) < r.r)) continue;
      if (rand() < 0.12) continue;     // a few gaps for streets / plazas
      const fd = Math.hypot(x - 1.8, z + 1.6);   // financial district centre
      const tall = rand() < 0.12 ? 1.45 : 1;
      const h = (0.4 + (0.5 + 5.2 * Math.exp(-(fd * fd) / 6)) * (0.45 + rand() * 0.7)) * tall;
      const w = 0.5 + rand() * 0.32, dpt = 0.5 + rand() * 0.32;
      spots.push({ x, z, h, w, d: dpt, dist: d, tone: BUILDING_TONES[Math.floor(rand() * BUILDING_TONES.length)], cap: h > 2.2 && rand() < 0.65, mint: rand() < 0.22 });
    }
  }
  const unit = new THREE.BoxGeometry(1, 1, 1);
  unit.translate(0, 0.5, 0);
  const sky = new THREE.InstancedMesh(unit, flatMaterial({ windows: true, instanced: true }), spots.length);
  const caps = spots.filter((s) => s.cap);
  const capMesh = new THREE.InstancedMesh(unit, flatMaterial({ windows: true, instanced: true, topMix: 0.4 }), Math.max(1, caps.length));
  const col = new THREE.Color();
  spots.forEach((s, i) => { sky.setColorAt(i, col.set(s.tone)); });
  caps.forEach((s, i) => { capMesh.setColorAt(i, col.set(s.mint ? "#00FFDD" : s.tone)); });
  sky.instanceColor.needsUpdate = true;
  if (capMesh.instanceColor) capMesh.instanceColor.needsUpdate = true;
  city.add(sky, capMesh);

  const lift = new Float32Array(spots.length);       // hover lift (0..1)
  const liftTarget = new Float32Array(spots.length);
  let rise = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  function layout() {
    let ci = 0;
    spots.forEach((s, i) => {
      const delay = (s.dist / R) * 0.55;
      const t = Math.min(1, Math.max(0, (rise - delay) / 0.45));
      const k = t * t * (3 - 2 * t);
      const hh = Math.max(0.001, s.h * k);
      const up = lift[i] * 0.35;
      p.set(s.x, up, s.z); sc.set(s.w, hh, s.d);
      sky.setMatrixAt(i, m4.compose(p, q, sc));
      if (s.cap) {
        p.set(s.x, up + hh, s.z); sc.set(s.w * 0.64, Math.max(0.001, (s.mint ? 0.3 : s.h * 0.28) * k), s.d * 0.64);
        capMesh.setMatrixAt(ci++, m4.compose(p, q, sc));
      }
    });
    sky.instanceMatrix.needsUpdate = true;
    capMesh.instanceMatrix.needsUpdate = true;
    const k = Math.min(1, Math.max(0, (rise - 0.1) / 0.5));
    const kk = k * k * (3 - 2 * k);
    for (const g of [rogers, hall, square]) g.scale.y = Math.max(0.001, kk) * (g === hall ? 0.85 : 1);
  }
  layout();

  /* ------------------------------------------------------------- globe */
  // drawn in a second pass with an orthographic camera, in screen units (y: −1…1, x: ±aspect)
  const globe = createGlobe({ night: cityNight });
  const globeScene = new THREE.Scene(), globeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  globeCam.position.z = 50;
  globeScene.add(globe.group);
  const worldState = { p: 0 };          // station progress along the map (0 … n-1), set by the page

  /* -------------------------------------------------------- stats ring */
  // Curved type band all the way round the dome. Lives in the scene (not the
  // turning city) so it orbits on its own: a slow idle drift, sped up by scroll.
  // The near side reads crisp; as text wraps to the far side it fades, blurs and
  // wobbles as if seen back through the glass.
  const statRing = new THREE.Group();
  statRing.position.y = GY + 3.4;
  scene.add(statRing);
  const RING_R = 10.0, STEP = (Math.PI * 2) / Math.max(1, stats.length);
  const ringU = { uOpacity: { value: 0 } };
  await Promise.race([
    Promise.all([document.fonts?.load(`700 200px ${RING_FONT}`), document.fonts?.load(`500 60px ${RING_FONT}`)]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});
  const ringPainters = [];
  stats.forEach((st, i) => {
    const PX = 120;                                  // canvas px per world unit
    const numPx = 1.95 * PX, labPx = 0.5 * PX;
    const meas = document.createElement("canvas").getContext("2d");
    meas.font = `700 ${numPx}px ${RING_FONT}`; const wn = meas.measureText(st.value).width;
    meas.font = `500 ${labPx}px ${RING_FONT}`; const wl = meas.measureText(st.label).width;
    const wPx = Math.ceil(Math.max(wn, wl) + PX * 0.6), hPx = Math.ceil(3.0 * PX);
    const cv = document.createElement("canvas"); cv.width = wPx; cv.height = hPx;
    const g = cv.getContext("2d");
    const paint = (dark) => {                         // redrawn when the page theme changes
      g.clearRect(0, 0, wPx, hPx);
      g.textAlign = "center"; g.textBaseline = "alphabetic";
      g.font = `700 ${numPx}px ${RING_FONT}`;
      if (st.accent) { const gr = g.createLinearGradient(wPx / 2 - wn / 2, 0, wPx / 2 + wn / 2, 0); gr.addColorStop(0, "#0FC2D4"); gr.addColorStop(1, "#18D9D2"); g.fillStyle = gr; }
      else g.fillStyle = dark ? "#F1EDFF" : "#120F1F";
      try { g.letterSpacing = `${-0.04 * numPx}px`; } catch (e) {}
      g.fillText(st.value, wPx / 2, numPx * 0.86);
      try { g.letterSpacing = "0px"; } catch (e) {}
      g.font = `500 ${labPx}px ${RING_FONT}`; g.fillStyle = dark ? "#C2BADE" : "#3B3552";
      g.fillText(st.label, wPx / 2, hPx - labPx * 0.45);
    };
    paint(document.documentElement.dataset.theme === "dark");
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    ringPainters.push((dark) => { paint(dark); tex.needsUpdate = true; });
    const arc = wPx / PX / RING_R;                   // angular width of this stat
    const geo = new THREE.CylinderGeometry(RING_R, RING_R, hPx / PX, 48, 1, true, i * STEP - arc / 2, arc);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uOpacity = ringU.uOpacity;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vRN; varying vec3 vRP;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRN = normalize(mat3(modelMatrix) * normal); vRP = (modelMatrix * vec4(position, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uOpacity; varying vec3 vRN; varying vec3 vRP;")
        .replace("#include <map_fragment>", `
          float facing = dot(normalize(vRN), normalize(cameraPosition - vRP));   // 1 = facing us, <0 = far side
          float back = 1.0 - smoothstep(-0.3, 0.3, facing);
          vec2 uvg = vMapUv + back * vec2(sin(vMapUv.y * 21.0 + vMapUv.x * 9.0) * 0.006, sin(vMapUv.x * 47.0) * 0.035);
          vec2 bl = back * vec2(0.006, 0.05);
          vec4 tx = texture2D(map, uvg) * 0.4 + (texture2D(map, uvg + bl) + texture2D(map, uvg - bl)
                  + texture2D(map, uvg + vec2(bl.x, -bl.y)) + texture2D(map, uvg + vec2(-bl.x, bl.y))) * 0.15;
          tx.rgb = mix(tx.rgb, vec3(0.62, 0.52, 0.9), back * 0.55);
          diffuseColor *= tx;`)
        .replace("#include <dithering_fragment>", "#include <dithering_fragment>\ngl_FragColor.a *= uOpacity * mix(0.2, 1.0, smoothstep(-0.2, 0.45, facing));");
    };
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 20;
    statRing.add(m);
  });
  statRing.visible = false;
  // stat i sits at angle i*STEP. Across the pinned chapter, scroll turns the band
  // just far enough for every stat to cross the front in order (1,000+ first,
  // 30+ last); a slow idle drift keeps it turning on top. The drift resets while
  // the band is hidden, so each visit starts with the first stat coming round.
  const SWEEP_START = THREE.MathUtils.degToRad(40);
  const SWEEP = (stats.length - 1) * STEP + SWEEP_START + THREE.MathUtils.degToRad(8);
  let ringIdle = 0;
  // p: progress through the stats chapter (0..1), o: its visibility; set by the page each frame
  const ringState = { p: 0, o: 0 };
  function poseRing() {
    const o = Math.min(1, Math.max(0, ringState.o));
    ringU.uOpacity.value = o * o * (3 - 2 * o);
    statRing.visible = stats.length > 0 && ringU.uOpacity.value > 0.002;
    if (!statRing.visible) ringIdle = 0;
    const p = Math.min(1, Math.max(0, ringState.p));
    statRing.rotation.y = SWEEP_START - p * SWEEP - ringIdle;
  }

  /* ------------------------------------------------------------- poses */
  // sx: horizontal placement as a fraction of the half-viewport at target depth.
  const POSES = {
    // sx > 0 puts the globe in the right half (white panel on the left), sx < 0 the reverse
    wide: [
      { cam: [0, 5.0, 6.4],   look: [0, 7.05, 0], sx: 0.36, tilt: 0.075, rot: 0.0 },          // hero: tower close-up (matches design)
      { cam: [0, 13, 40],     look: [0, 3.8, 0],  sx: 0.5,  tilt: 0.0,   rot: 0.8 },          // about: globe in the right half
      { cam: [0, 12, 53],     look: [0, 3.8, 0],  sx: 0.5,  tilt: 0.0,   rot: 2.5 },          // stats: lower view so the number band reads as an orbit
      { cam: [0, 3.6, 32],    look: [0, 4.8, 0],  sx: 0.5,  tilt: 0.0,   rot: Math.PI * 2 },  // toronto: from the lake, right half
      { cam: [0, 6, 40],      look: [0, 2.5, 0],  sx: 0.0,  tilt: 0.0,   rot: Math.PI * 3.0 },  // world: Earth along the bottom (placed in pose())
      { cam: [0, 6, 40],      look: [0, 2.5, 0],  sx: 0.0,  tilt: 0.0,   rot: Math.PI * 3.0 },  // world exit
    ],
    // phones: text sits on a white block at the top, so the globe drops into the lower part
    tall: [
      { cam: [0, 4.6, 14.5],  look: [0, 6.6, 0],  sx: 0.78, tilt: 0.07,  rot: 0.0 },
      { cam: [0, 18, 60],     look: [0, 13, 0],   sx: 0.0,  tilt: 0.0,   rot: 0.8 },
      { cam: [0, 14, 70],     look: [0, 9, 0],    sx: 0.0,  tilt: 0.0,   rot: 2.5 },
      { cam: [0, 4, 46],      look: [0, 14, 0],   sx: 0.0,  tilt: 0.0,   rot: Math.PI * 2 },
      { cam: [0, 8, 60],      look: [0, 9, 0],    sx: 0.0,  tilt: 0.0,   rot: Math.PI * 3.0 },
      { cam: [0, 8, 60],      look: [0, 9, 0],    sx: 0.0,  tilt: 0.0,   rot: Math.PI * 3.0 },
    ],
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const look = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), off = new THREE.Vector3();
  const lv = new THREE.Vector3();
  const GLOBE_C = new THREE.Vector3(), gP = new THREE.Vector3();
  const pointer = { x: 0, y: 0 };

  let idleRot = 0;
  function pose(c) {
    const set = camera.aspect < 0.85 ? POSES.tall : POSES.wide;
    const i = Math.max(0, Math.min(set.length - 2, Math.floor(c)));
    const t = smooth(Math.max(0, Math.min(1, c - i)));
    const A = set[i], B = set[i + 1];
    const P = (k) => A[k].map((x, j) => lerp(x, B[k][j], t));
    camera.position.set(...P("cam"));
    look.set(...P("look"));
    camera.lookAt(look);
    const sx = lerp(A.sx, B.sx, t);
    const dist = camera.position.distanceTo(look);
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist * camera.aspect;
    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, camera.up).normalize();
    off.copy(right).multiplyScalar(-sx * halfW + pointer.x * 0.35);
    off.y += pointer.y * 0.25;
    camera.position.add(off); look.add(off);
    camera.lookAt(look);
    camera.updateMatrixWorld();

    pivot.rotation.z = lerp(A.tilt, B.tilt, t);
    city.rotation.y = lerp(A.rot, B.rot, t) + idleRot;

    // snow globe → Earth → horizon, as one object:
    //   3.28–3.62  the glass frosts over into the planet from the top down (the Earth sits exactly on the glass);
    //              as the frost line reaches the pedestal, the pedestal crumbles away into specks
    //   3.60–3.66  behind the finished Earth, the city shrinks away
    //   3.64–4.00  the same sphere glides down and swells into a horizon just below the middle
    const reveal = smooth(Math.min(1, Math.max(0, (c - 3.28) / 0.34)));
    const absorb = smooth(Math.min(1, Math.max(0, (c - 3.6) / 0.06)));
    // the instant the Earth starts to form, the whole snow globe crumbles to dust (gone by ~1/3 of the reveal)
    dustU.value = Math.min(1.5, Math.max(0, reveal / 0.55) * 1.5);
    specks.visible = dustU.value > 0 && dustU.value < 1.45;
    const settle = smooth(Math.min(1, Math.max(0, (c - 3.64) / 0.36)));
    const sGlobe = 1 - absorb;
    city.scale.setScalar(Math.max(0.0001, sGlobe));
    city.position.y = GY - 6.1 - sGlobe * GY;      // keeps the globe centre fixed while scaling
    city.visible = sGlobe > 0.002 && dustU.value < 1.45;
    if (dustU.value > 0) { city.updateWorldMatrix(true, false); dustInv.value.copy(city.matrixWorld).invert(); }
    globe.group.visible = reveal > 0.001;
    if (globe.group.visible) {
      const asp = camera.aspect, tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      globeCam.left = -asp; globeCam.right = asp; globeCam.updateProjectionMatrix();
      // start: exactly over the snow globe's glass (screen units)
      GLOBE_C.set(0, GY, 0);
      const d = camera.position.distanceTo(GLOBE_C);
      gP.copy(GLOBE_C).project(camera);
      const r0 = Math.tan(Math.asin(Math.min(0.99, GR / d))) / tanH;
      // end: a horizon whose crest sits just below the middle and drops ~27% of the height by the
      // screen edges (phones: lower, flatter crest under the map's rows)
      const phone = asp < 0.85;
      const crest = phone ? -0.46 : -0.2, drop = 0.54;
      const r1 = Math.max(phone ? 1.2 : 1.6, (asp * asp + drop * drop) / (2 * drop));
      const x = lerp(gP.x * asp, 0, settle), y = lerp(gP.y, crest - r1, settle), r = lerp(r0, r1, settle);
      globe.group.position.set(x, y, 0);
      globe.group.scale.setScalar(r);
      globe.setReveal(reveal);
      globe.setScroll(c);                     // turns from the first frost on
      // faces the viewer inside the snow globe, then tips up so the band under the crest faces us
      const focus = Math.min(0.97, Math.max(0, (r1 - (phone ? 0.2 : 0.24)) / r1));
      globe.setTilt(settle * Math.asin(focus));
    }


    rise = Math.min(1.2, Math.max(0, c - 0.12) * 1.25);
    layout();

    // tower split follows the same world light as the buildings
    lv.copy(LIGHT_W).transformDirection(camera.matrixWorldInverse);
    towerLight.value.set(lv.x, lv.z).normalize();

    // Dome appears by distance: invisible while the camera is inside the glass (hero)
    domeFront.getWorldPosition(globeCentre);
    const gDist = camera.position.distanceTo(globeCentre);
    const k = Math.min(1, Math.max(0, (gDist - (GR + 1.0)) / 6.0));
    const enter = Math.min(1, Math.max(0, (c - 0.12) / 0.38));   // only once you scroll out of the hero
    domeU.uOpacity.value = k * k * (3 - 2 * k) * enter * enter * (3 - 2 * enter);
    snowMat.opacity = domeU.uOpacity.value;
    snow.visible = domeFront.visible = domeBack.visible = domeU.uOpacity.value > 0.002;
    if (snow.visible) updateSnow(c);
    poseRing();
  }

  /* -------------------------------------------------------- hover lift */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = -1;
  function hover(nx, ny) {
    pointer.x = nx; pointer.y = ny;
    ndc.set(nx, ny);
    ray.setFromCamera(ndc, camera);
    const hit = rise > 0.6 ? ray.intersectObject(sky, false)[0] : null;
    const id = hit ? hit.instanceId : -1;
    if (id !== hovered) {
      if (hovered >= 0) liftTarget[hovered] = 0;
      if (id >= 0) liftTarget[id] = 1;
      hovered = id;
    }
    return id >= 0;
  }
  /** Canvas height in device pixels (for the specks' point size). */
  function setPixelHeight(px) { specks.material.uniforms.uScale.value = (px * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)); }

  /** Per-frame: idle spin, snow, hover lifts. Returns true to keep the loop running. */
  function tick(dt) {
    let moving = false;
    if (dt > 0) {
      idleRot += dt * 0.07;                              // slow idle turn
      ringIdle += dt * 0.09;                             // stats band drifts on its own
      snowTime += dt;
      moving = true;
    }
    for (let i = 0; i < lift.length; i++) {
      const d = liftTarget[i] - lift[i];
      if (Math.abs(d) > 0.002) { lift[i] += d * Math.min(1, dt * 10); moving = true; }
      else lift[i] = liftTarget[i];
    }
    if (globe.group.visible) { globe.setProgress(worldState.p); globe.tick(dt); moving = true; }
    if (moving) layout();
    return moving;
  }

  const setTheme = (dark) => { ringPainters.forEach((p) => p(dark)); cityNight.value = dark ? 1 : 0; globe.setTheme(dark); };
  /** Draw the city, then the Earth on top (its own pass, so it never clips into the glass). */
  function render(renderer) {
    renderer.render(scene, camera);
    if (!globe.group.visible) return;
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(globeScene, globeCam);
    renderer.autoClear = ac;
  }
  dustify(city);   // every city material crumbles with the snow globe (glass + specks have it built in)
  return { scene, camera, globeScene, globeCam, pose, hover, tick, setTheme, render, setPixelHeight, ring: ringState, world: worldState, towerModel: gltf.scene };
}

/** Original globe flake: soft white with a faint lilac rim so it reads on the pale city. */
function globeFlakeTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.55, "rgba(255,255,255,0.95)");
  grd.addColorStop(0.78, "rgba(170,150,225,0.55)"); grd.addColorStop(1, "rgba(170,150,225,0)");
  g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soft, pure-white round flake. */
export function snowflakeTexture() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 64;
  const g = cv.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.6, "rgba(255,255,255,1)");
  grd.addColorStop(0.85, "rgba(255,255,255,0.45)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function waterMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color("#C9F6FF") });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vW;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vW;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        float band = step(0.82, fract(vW.z * 1.6 + sin(vW.x * 1.3) * 0.25));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), band * 0.55);`);
  };
  m.customProgramCacheKey = () => "city-water";
  return m;
}
