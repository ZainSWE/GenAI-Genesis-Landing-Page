/**
 * FAQ ferry: a small, cute Toronto Island ferry bobbing on soft waves, drawn in
 * the site palette only (white, lilac pale, lilac, mint, aqua pale) with the
 * same flat shading as the other 3D pieces. Smoke puffs rise from its funnel and
 * drift up behind the FAQ title (the canvas sits under the heading text and its
 * edges fade out). Click the boat for a toot: a burst of smoke and a quick spin.
 *
 * Every part is either embedded in the one below it or sits clear of it, so no
 * two visible faces share a plane (no z-fighting).
 *
 * Own small renderer; it only draws while the FAQ is on screen. Reduced motion:
 * one still frame. setTheme(dark) dims the boat and moves the water to the
 * night palette.
 */
import * as THREE from "three";

const LIGHT = new THREE.Vector2(-0.75, 0.66).normalize();
const nightU = { value: 0 };
// primary cyan + secondary purple: reads clearly on both the light and the dark page
const PAL = { white: "#FFFFFF", cyan: "#18D9D2", cyanDeep: "#0E9F9A", purple: "#8B6CF0", purpleDeep: "#6447D2", aquaPale: "#DFFFFC" };

function flat(color, shade, topMix = 0.45) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
  m.onBeforeCompile = (s) => {
    s.uniforms.uLight = { value: LIGHT };
    s.uniforms.uShade = { value: new THREE.Color(shade) };
    s.uniforms.uNight = nightU;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vN;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvN = normalize(mat3(modelMatrix) * normal);");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vN;\nuniform vec2 uLight; uniform vec3 uShade; uniform float uNight;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 n = normalize(vN);
        vec3 b = diffuseColor.rgb;
        float lit = smoothstep(-0.2, 0.2, dot(n.xz, uLight));
        vec3 c = mix(mix(b, uShade, 0.6), b, lit);
        if (n.y > 0.6) c = mix(b, vec3(1.0), ${topMix.toFixed(2)});
        if (n.y < -0.6) c = uShade;
        c = mix(c, c * vec3(0.58, 0.54, 0.78) + vec3(0.02, 0.01, 0.05), uNight * 0.3);   // keep the boat bright at night
        c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.07;   // film grain
        diffuseColor.rgb = c;`);
  };
  m.customProgramCacheKey = () => "ferry-flat-" + topMix;
  return m;
}

/** Rounded-rectangle outline in the xz plane (shape (x, y) → world (x, -z)). */
function pill(len, wid, r = wid / 2) {
  const s = new THREE.Shape(), hl = len / 2, hw = wid / 2;
  r = Math.min(r, hw, hl);
  s.moveTo(-hl + r, -hw); s.lineTo(hl - r, -hw); s.quadraticCurveTo(hl, -hw, hl, -hw + r);
  s.lineTo(hl, hw - r); s.quadraticCurveTo(hl, hw, hl - r, hw);
  s.lineTo(-hl + r, hw); s.quadraticCurveTo(-hl, hw, -hl, hw - r);
  s.lineTo(-hl, -hw + r); s.quadraticCurveTo(-hl, -hw, -hl + r, -hw);
  return s;
}
function block(shape, h, mat, bevel = 0.06) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 24 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);                     // base of the bevel at y = 0
  return new THREE.Mesh(g, mat);
}

function puffTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.5, "rgba(243,218,255,0.8)"); grd.addColorStop(0.8, "rgba(224,157,255,0.3)"); grd.addColorStop(1, "rgba(224,157,255,0)");
  g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* Waves: the lava-lamp palette, swelling gently and fading out into the page at the edges. */
const WAVE_GLSL = `
  float wave(vec2 p, float t) {
    return 0.16 * sin(p.x * 0.9 + t * 1.1) + 0.11 * sin(p.y * 1.3 - t * 0.9 + p.x * 0.4)
         + 0.06 * sin((p.x + p.y) * 2.1 + t * 1.7);
  }`;
function waveHeight(x, z, t) {
  return 0.16 * Math.sin(x * 0.9 + t * 1.1) + 0.11 * Math.sin(z * 1.3 - t * 0.9 + x * 0.4) + 0.06 * Math.sin((x + z) * 2.1 + t * 1.7);
}
function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true,
    uniforms: { uT: { value: 0 }, uNight: nightU },
    vertexShader: `${WAVE_GLSL}
      uniform float uT; varying vec3 vP; varying vec3 vNrm; varying float vH;
      void main() {
        vec3 p = position;
        float h = wave(p.xz, uT);
        float e = 0.05;
        float hx = wave(p.xz + vec2(e, 0.0), uT), hz = wave(p.xz + vec2(0.0, e), uT);
        vNrm = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
        p.y += h; vP = p; vH = h;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uNight; uniform float uT; varying vec3 vP; varying vec3 vNrm; varying float vH;
      void main() {
        // lava-lamp colours by day: pink, violet, lilac, mint mist; deep purple / teal at night
        vec3 pink = mix(vec3(0.965, 0.77, 0.925), vec3(0.36, 0.12, 0.42), uNight);
        vec3 violet = mix(vec3(0.725, 0.59, 0.96), vec3(0.22, 0.13, 0.52), uNight);
        vec3 lilac = mix(vec3(0.906, 0.776, 0.969), vec3(0.30, 0.15, 0.46), uNight);
        vec3 mint = mix(vec3(0.80, 0.98, 0.95), vec3(0.05, 0.33, 0.36), uNight);
        float band = 0.5 + 0.5 * sin(vP.x * 0.55 + vP.z * 0.8);
        vec3 col = mix(mix(violet, pink, band), mix(mint, lilac, band), smoothstep(-2.0, 2.5, vP.z));
        float lit = clamp(dot(vNrm, normalize(vec3(-0.5, 0.9, 0.4))), 0.0, 1.0);
        col = mix(col * mix(0.72, 0.62, uNight), col * 1.04, lit);              // troughs a shade deeper
        // drifting wave lines, like a toy-boat illustration
        float wl = fract(vP.z * 0.75 + 0.32 * sin(vP.x * 0.7 + uT * 0.8) - uT * 0.12);
        float line = 1.0 - smoothstep(0.02, 0.07, abs(wl - 0.5));
        col = mix(col, vec3(1.0), line * (0.5 - 0.25 * uNight));
        col = mix(col, vec3(1.0), smoothstep(0.17, 0.3, vH) * (0.55 - 0.35 * uNight));   // soft crests
        // fade into the page: an oval that melts away at the sides and the back
        float r = length(vP.xz * vec2(0.2, 0.36));
        float a = 1.0 - smoothstep(0.5, 1.0, r);
        col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.06;   // film grain
        gl_FragColor = vec4(col, a * 0.92);   // colours are already display values (like the lava lamp)
      }`,
  });
}

export function createFerry(canvas, { reduced = false, weak = false, coarse = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !weak, alpha: true, powerPreference: "low-power" });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, weak ? 1 : 1.5));   // 1.5x + antialiasing reads as sharp as 2x, ~half the pixels
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200);

  /* ------------------------------------------------------------ the boat */
  const boat = new THREE.Group();
  const M = {
    hull: flat(PAL.cyan, PAL.cyanDeep, 0.35),
    stripe: flat(PAL.white, "#CFEFEF", 0.4),
    keel: flat(PAL.purpleDeep, "#4A31A8", 0.25),
    cabin: flat(PAL.purple, PAL.purpleDeep, 0.4),
    roof: flat(PAL.purpleDeep, "#4A31A8", 0.35),
    house: flat(PAL.white, "#D6CCF6", 0.5),
    port: flat(PAL.aquaPale, "#9FE9E4", 0.5),
    portRim: flat(PAL.white, "#D6CCF6", 0.5),
    funnel: flat(PAL.cyan, PAL.cyanDeep, 0.3),
    band: flat(PAL.white, "#CFEFEF", 0.4),
    top: flat(PAL.purpleDeep, "#4A31A8", 0.35),
    flag: flat(PAL.purple, PAL.purpleDeep, 0.3),
  };
  const L = 4.4, B = 1.9;
  // chunky rounded hull: lilac keel band, white body, mint stripe set into the top
  const keel = block(pill(L * 0.9, B * 0.82), 0.28, M.keel, 0.1); keel.position.y = -0.36; boat.add(keel);
  const hull = block(pill(L, B), 0.5, M.hull, 0.12); hull.position.y = -0.2; boat.add(hull);        // overlaps the keel
  const stripe = block(pill(L + 0.14, B + 0.14), 0.07, M.stripe, 0.04); stripe.position.y = 0.28; boat.add(stripe);
  // cabin: lilac-pale, sunk into the deck, with round portholes standing just proud of its walls
  const CL = L - 1.2, CW = B - 0.5, CH = 0.62, cbev = 0.08;
  const cabin = block(pill(CL, CW, 0.32), CH, M.cabin, cbev); cabin.position.y = 0.36; boat.add(cabin);
  const portGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 20); portGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(0.125, 0.025, 8, 24);
  const wallZ = CW / 2 + cbev;                                   // outer face of the cabin wall
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const x = -CL / 2 + 0.55 + i * ((CL - 1.1) / 3);
    const port = new THREE.Mesh(portGeo, M.port); port.position.set(x, 0.36 + cbev + CH * 0.55, side * (wallZ + 0.012)); boat.add(port);
    const rim = new THREE.Mesh(rimGeo, M.portRim); rim.position.set(x, port.position.y, side * (wallZ + 0.03)); boat.add(rim);
  }
  // cabin roof (lilac) overhangs a little and sits clear of the cabin top
  const roof = block(pill(CL + 0.3, CW + 0.3, 0.42), 0.07, M.roof, 0.04); roof.position.y = 0.36 + CH + 2 * cbev + 0.005; boat.add(roof);
  const roofTop = roof.position.y + 0.07 + 0.08;
  // pilot house (white) with a mint-tinted window band, its own lilac cap
  const ph = block(pill(1.0, 0.9, 0.3), 0.42, M.house, 0.06); ph.position.set(0.75, roofTop - 0.04, 0); boat.add(ph);
  const phWin = block(pill(1.04, 0.94, 0.32), 0.14, M.port, 0.05); phWin.position.set(0.75, roofTop + 0.16, 0); boat.add(phWin);
  const phCap = block(pill(1.2, 1.08, 0.38), 0.06, M.roof, 0.03); phCap.position.set(0.75, roofTop + 0.5, 0); boat.add(phCap);
  // funnel: fat mint stack with a white band and lilac lip, leaning back a touch
  const funnel = new THREE.Group(); funnel.position.set(-0.55, roofTop - 0.04, 0); funnel.rotation.z = 0.1; boat.add(funnel);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.8, 28), M.funnel); stack.position.y = 0.4; funnel.add(stack);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.277, 0.291, 0.13, 28), M.band); band.position.y = 0.5; funnel.add(band);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.05, 10, 28), M.top); lip.rotation.x = Math.PI / 2; lip.position.y = 0.8; funnel.add(lip);
  const mouth = new THREE.Object3D(); mouth.position.y = 0.86; funnel.add(mouth);
  // little mast + pennant on the pilot house
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8), M.house); mast.position.set(0.95, roofTop + 0.78, 0); boat.add(mast);
  const fshape = new THREE.Shape(); fshape.moveTo(0, 0); fshape.lineTo(-0.32, -0.07); fshape.lineTo(0, -0.15);
  const flag = new THREE.Mesh(new THREE.ShapeGeometry(fshape), M.flag); flag.material.side = THREE.DoubleSide;
  flag.position.set(0.95, roofTop + 1.02, 0); boat.add(flag);
  scene.add(boat);

  /* ------------------------------------------------------------ the waves */
  const waterMat = waterMaterial();
  const waveGeo = new THREE.PlaneGeometry(16, 10, weak ? 80 : 140, weak ? 50 : 90); waveGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waveGeo, waterMat); water.renderOrder = 2; scene.add(water);

  /* ------------------------------------------------------------ smoke */
  const puffTex = puffTexture();
  const puffs = [];
  for (let i = 0; i < 64; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: "#FFFFFF", transparent: true, opacity: 0, depthWrite: false }));
    sp.visible = false; sp.renderOrder = 5; scene.add(sp);
    puffs.push({ sp, age: 0, life: 1, v: new THREE.Vector3(), s0: 0.3, s1: 1.5 });
  }
  let nextPuff = 0, smokeTint = new THREE.Color("#FFFFFF"), smokeK = 0.6;
  const mouthPos = new THREE.Vector3();
  function emit(strength = 1) {
    const p = puffs.find((q) => !q.sp.visible); if (!p) return;
    mouth.getWorldPosition(mouthPos);
    p.sp.position.copy(mouthPos);
    p.age = 0; p.life = 7 + Math.random() * 2.5;
    p.v.set(-0.28 - Math.random() * 0.22, 0.95 + Math.random() * 0.5 * strength, (Math.random() - 0.5) * 0.25);   // up and left, toward the title
    p.s0 = 0.34 + Math.random() * 0.12; p.s1 = (1.9 + Math.random() * 0.9) * (0.8 + 0.3 * strength);
    p.sp.visible = true; p.sp.material.color.copy(smokeTint);
  }

  /* ------------------------------------------------------------ layout */
  let W = 1, H = 1, boatCenterY = 1;
  function resize() {
    W = Math.max(1, canvas.clientWidth); H = Math.max(1, canvas.clientHeight);
    renderer.setSize(W, H, false);
    const colW = canvas.parentElement?.clientWidth || W;    // the canvas overhangs the column for smoke room
    boatCenterY = H - Math.min(150, H * 0.28);
    const ppu = Math.min((colW * 0.95) / 6.0, 330 / 3.4);
    const F = 2 * Math.max(boatCenterY, H - boatCenterY);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const d = F / (2 * Math.tan(fov / 2) * ppu);
    const el = THREE.MathUtils.degToRad(27);
    camera.position.set(0, 0.7 + Math.sin(el) * d, Math.cos(el) * d);
    camera.lookAt(0, 0.7, 0);
    camera.aspect = W / F;
    camera.setViewOffset(W, F, 0, F / 2 - boatCenterY, W, H);
    camera.updateProjectionMatrix();
    draw(0);
  }

  /* ------------------------------------------------------------ animation */
  let t = 0, spinBoost = 0, running = false, visible = false, last = 0, raf = 0;
  boat.rotation.y = -0.5;
  function draw(dt, paint = true) {
    t += dt;
    waterMat.uniforms.uT.value = t;
    // ride the waves: height from the swell under the boat, pitch and roll from its slope
    const h0 = waveHeight(0, 0, t), hx = waveHeight(0.6, 0, t), hz = waveHeight(0, 0.6, t);
    boat.position.y = h0 - 0.16;                 // sits in the water, not on it
    boat.rotation.y += dt * (0.2 + spinBoost);
    spinBoost *= Math.pow(0.35, dt);
    boat.rotation.z = Math.atan2(hx - h0, 0.6) * 0.8;
    boat.rotation.x = -Math.atan2(hz - h0, 0.6) * 0.8;
    flag.rotation.y = Math.sin(t * 3) * 0.25;
    nextPuff -= dt;
    if (nextPuff <= 0 && dt > 0) { emit(); nextPuff = 0.36 + Math.random() * 0.12; }
    for (const p of puffs) {
      if (!p.sp.visible) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) { p.sp.visible = false; continue; }
      p.sp.position.addScaledVector(p.v, dt);
      p.v.x -= dt * 0.04; p.v.y *= Math.pow(0.9, dt);
      const s = p.s0 + (p.s1 - p.s0) * Math.sqrt(k);
      p.sp.scale.set(s, s, 1);
      p.sp.material.opacity = smokeK * Math.min(1, k * 6) * (1 - k) ** 1.2;
    }
    if (paint) renderer.render(scene, camera);
  }
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    draw(dt);
    raf = requestAnimationFrame(loop);
  }
  function setRunning(on) {
    if (reduced) { draw(0); return; }
    if (on === running) return;
    running = on;
    if (on) { last = performance.now(); raf = requestAnimationFrame(loop); } else cancelAnimationFrame(raf);
  }
  // compile the smoke sprites' shader in idle time: they stay hidden until the first puff, which
  // otherwise compiled it right as the FAQ scrolled into view
  (window.requestIdleCallback || ((f) => setTimeout(f, 400)))(() => {
    puffs[0].sp.visible = true;
    try { renderer.compile(scene, camera); renderer.render(scene, camera); } catch (e) {}
    puffs[0].sp.visible = false;
    draw(0);
  }, { timeout: 3000 });
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; setRunning(visible && !document.hidden); }, { rootMargin: "120px 0px" });
  io.observe(canvas);
  document.addEventListener("visibilitychange", () => setRunning(visible && !document.hidden));
  addEventListener("resize", resize);
  new ResizeObserver(resize).observe(canvas);

  // toot: click the boat for a burst of smoke and a quick spin
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hitBoat(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(boat, true).length > 0;
  }
  canvas.addEventListener("pointermove", (e) => { canvas.style.cursor = hitBoat(e) ? "pointer" : ""; });
  canvas.addEventListener("click", (e) => {
    if (!hitBoat(e)) return;
    spinBoost = 2.2;
    for (let i = 0; i < 7; i++) setTimeout(() => emit(1.6), i * 70);
    if (reduced) setTimeout(() => draw(0.4), 520);
  });

  resize();
  for (let i = 0; i < 40; i++) draw(0.16, false);   // start with a plume already rising
  draw(0);

  function setTheme(dark) {
    nightU.value = dark ? 1 : 0;
    smokeTint.set(dark ? "#CFC4EE" : "#FFFFFF"); smokeK = dark ? 0.46 : 0.6;
    puffs.forEach((p) => p.sp.material.color.copy(smokeTint));
    draw(0);
  }
  return { setTheme };
}
