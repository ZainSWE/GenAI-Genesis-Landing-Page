/**
 * FAQ ferry: a Toronto Island ferry turning slowly on the lake, drawn in the
 * same flat pastel style as the snow globe and the streetcar. Double-ended
 * white hull with a teal rub rail, two cabin decks with rows of windows, an
 * open upper deck with benches and stanchion railings, a pilot house, lifebuoys
 * and a banded funnel. Smoke rises from the funnel and drifts up behind the FAQ
 * title (the canvas sits under the heading text and fades out at its edges).
 * Click the boat for a toot: a burst of smoke and a quick extra spin.
 *
 * Own small renderer; it only draws while the FAQ is on screen. Reduced motion:
 * one still frame. setTheme(dark) dims the boat and tints the smoke for night.
 */
import * as THREE from "three";

const LIGHT = new THREE.Vector2(-0.75, 0.66).normalize();
const nightU = { value: 0 };

function flat(color, shade, topMix = 0.45) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
  m.onBeforeCompile = (s) => {
    s.uniforms.uLight = { value: LIGHT };
    s.uniforms.uShade = { value: new THREE.Color(shade) };
    s.uniforms.uNight = nightU;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vN;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        #ifdef USE_INSTANCING
          vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        #else
          vN = normalize(mat3(modelMatrix) * normal);
        #endif`);
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vN;\nuniform vec2 uLight; uniform vec3 uShade; uniform float uNight;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 n = normalize(vN);
        vec3 b = diffuseColor.rgb;
        float lit = smoothstep(-0.18, 0.18, dot(n.xz, uLight));
        vec3 c = mix(mix(b, uShade, 0.6), b, lit);
        if (n.y > 0.6) c = mix(b, vec3(1.0), ${topMix.toFixed(2)});
        if (n.y < -0.6) c = mix(uShade, vec3(0.0), 0.1);
        c = mix(c, c * vec3(0.56, 0.52, 0.76) + vec3(0.02, 0.01, 0.05), uNight);
        diffuseColor.rgb = c;`);
  };
  m.customProgramCacheKey = () => "ferry-flat-" + topMix;
  return m;
}

/** Stadium outline (round both ends: the island ferries are double-ended). Shape (x, y) → world (x, -z). */
function stadium(len, wid) {
  const s = new THREE.Shape(), r = wid / 2, hl = len / 2 - r;
  s.moveTo(-hl, -r); s.lineTo(hl, -r);
  s.absarc(hl, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-hl, r);
  s.absarc(-hl, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return s;
}
function slab(shape, h, mat, bevel = 0.03) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 32 });
  g.rotateX(-Math.PI / 2);
  return new THREE.Mesh(g, mat);
}
/** Points around a stadium outline at a given spacing, with outward normals, as world-space (x, z). */
function around(len, wid, step, straightOnly = false) {
  const out = [], r = wid / 2, hl = len / 2 - r;
  const per = 4 * hl + Math.PI * wid, n = Math.max(4, Math.round(per / step));
  for (let i = 0; i < n; i++) {
    let d = (i / n) * per, x, z, nx, nz;
    if (d < 2 * hl) { x = -hl + d; z = r; nx = 0; nz = 1; }                       // near side
    else if ((d -= 2 * hl) < Math.PI * r) { const a = Math.PI / 2 - d / r; x = hl + Math.cos(a) * r; z = Math.sin(a) * r; nx = Math.cos(a); nz = Math.sin(a); }
    else if ((d -= Math.PI * r) < 2 * hl) { x = hl - d; z = -r; nx = 0; nz = -1; }  // far side
    else { d -= 2 * hl; const a = -Math.PI / 2 - d / r; x = -hl + Math.cos(a) * r; z = Math.sin(a) * r; nx = Math.cos(a); nz = Math.sin(a); }
    if (straightOnly && Math.abs(nx) > 0.05) continue;
    out.push({ x, z, nx, nz });
  }
  return out;
}

function puffTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.5, "rgba(236,230,252,0.8)"); grd.addColorStop(0.8, "rgba(200,188,240,0.35)"); grd.addColorStop(1, "rgba(200,188,240,0)");
  g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createFerry(canvas, { reduced = false, weak = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !weak, alpha: true, powerPreference: "low-power" });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, weak ? 1 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200);

  /* ------------------------------------------------------------ the boat */
  const boat = new THREE.Group();
  const M = {
    hull: flat("#FFFFFF", "#CFC3F3", 0.5),
    boot: flat("#7B6BC9", "#54479E", 0.2),        // waterline band
    teal: flat("#18D9D2", "#0E9F9A", 0.4),
    deck: flat("#F3DAFF", "#C9A6F5", 0.6),
    wall: flat("#FFFFFF", "#DCD2F8", 0.6),
    glass: flat("#4A3E8C", "#30276A", 0.2),
    rail: flat("#3EE07E", "#22CBBD", 0.3),
    post: flat("#FFFFFF", "#CFC3F3", 0.4),
    bench: flat("#BCFEFF", "#7FE3DA", 0.5),
    buoy: flat("#FF7A8A", "#D9536A", 0.4),
    cap: flat("#1B2A33", "#0F1A20", 0.2),
    flag: flat("#E09DFF", "#B56CF0", 0.3),
  };
  const L = 6.4, B = 1.9;                                   // length, beam

  // hull: tapered toward the keel, dark waterline band, teal rub rail at the gunwale
  const hullGeo = new THREE.ExtrudeGeometry(stadium(L, B), { depth: 0.62, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3, curveSegments: 40 });
  hullGeo.rotateX(-Math.PI / 2);
  { const p = hullGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 0.86 + 0.14 * THREE.MathUtils.smoothstep(y, -0.06, 0.4); p.setX(i, p.getX(i) * (0.97 + 0.03 * k)); p.setZ(i, p.getZ(i) * k); }
    hullGeo.computeVertexNormals(); }
  const hull = new THREE.Mesh(hullGeo, M.hull); hull.position.y = -0.1; boat.add(hull);
  const boot = slab(stadium(L * 0.985, B * 0.89), 0.14, M.boot, 0.02); boot.position.y = -0.12; boat.add(boot);
  const rub = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
    around(L + 0.1, B + 0.1, 0.08).map((q) => new THREE.Vector3(q.x, 0, q.z)), true), 220, 0.055, 8, true), M.teal);
  rub.position.y = 0.56; boat.add(rub);
  const main = slab(stadium(L - 0.08, B - 0.08), 0.04, M.deck, 0); main.position.y = 0.58; boat.add(main);

  // cabins: white walls with a row of separate window panes all round
  const paneGeo = new THREE.BoxGeometry(0.2, 1, 0.025);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function cabin(len, wid, y, h, x = 0, paneH = 0.24, step = 0.3) {
    const c = slab(stadium(len, wid), h, M.wall, 0.025); c.position.set(x, y, 0); boat.add(c);
    const pts = around(len + 0.06, wid + 0.06, step);
    const inst = new THREE.InstancedMesh(paneGeo, M.glass, pts.length);
    pts.forEach((q, i) => {
      q4.setFromAxisAngle(up, Math.atan2(q.nx, q.nz));
      p4.set(x + q.x, y + h * 0.56, q.z); s4.set(1, paneH, 1);
      inst.setMatrixAt(i, m4.compose(p4, q4, s4));
    });
    boat.add(inst);
    return c;
  }
  // stanchion railing: posts + top rail tube
  function railing(len, wid, y, x = 0, h = 0.22) {
    const pts = around(len, wid, 0.22);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, h, 5), M.post, pts.length);
    pts.forEach((q, i) => posts.setMatrixAt(i, m4.makeTranslation(x + q.x, y + h / 2, q.z)));
    boat.add(posts);
    const top = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
      around(len, wid, 0.08).map((q) => new THREE.Vector3(q.x, 0, q.z)), true), 200, 0.022, 6, true), M.rail);
    top.position.set(x, y + h, 0); boat.add(top);
  }
  railing(L - 0.22, B - 0.22, 0.62);
  cabin(L - 1.25, B - 0.5, 0.62, 0.62);
  const deck2 = slab(stadium(L - 0.9, B - 0.28), 0.045, M.deck, 0); deck2.position.y = 1.25; boat.add(deck2);
  railing(L - 1.05, B - 0.42, 1.29);
  cabin(L - 3.2, B - 0.82, 1.29, 0.5, 0, 0.18, 0.28);
  const roof2 = slab(stadium(L - 3.0, B - 0.7), 0.04, M.deck, 0); roof2.position.y = 1.8; boat.add(roof2);

  // open upper deck: benches fore and aft of the cabin
  const benchGeo = new THREE.BoxGeometry(0.5, 0.08, 0.16);
  for (const sx of [-1, 1]) for (const z of [-0.42, 0.42]) {
    const bch = new THREE.Mesh(benchGeo, M.bench); bch.position.set(sx * 2.15, 1.36, z); bch.rotation.y = Math.PI / 2; boat.add(bch);
  }
  // pilot house (centred, wraparound windows, overhanging roof)
  const ph = slab(stadium(1.1, 0.78), 0.36, M.wall, 0.02); ph.position.set(0.25, 1.84, 0); boat.add(ph);
  const phWin = slab(stadium(1.14, 0.82), 0.14, M.glass, 0); phWin.position.set(0.25, 1.98, 0); boat.add(phWin);
  const phRoof = slab(stadium(1.3, 0.96), 0.05, M.teal, 0.015); phRoof.position.set(0.25, 2.2, 0); boat.add(phRoof);

  // funnel: tall, teal with a white band and dark cap, just aft of the pilot house
  const funnel = new THREE.Group(); funnel.position.set(-0.7, 1.82, 0); boat.add(funnel);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 1.0, 28), M.teal); stack.position.y = 0.5; funnel.add(stack);
  const fband = new THREE.Mesh(new THREE.CylinderGeometry(0.192, 0.204, 0.16, 28), M.wall); fband.position.y = 0.62; funnel.add(fband);
  const fcap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.1, 28), M.cap); fcap.position.y = 1.03; funnel.add(fcap);
  const mouth = new THREE.Object3D(); mouth.position.y = 1.1; funnel.add(mouth);

  // mast with a pennant on the pilot-house roof
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 6), M.cap); mast.position.set(0.5, 2.53, 0); boat.add(mast);
  const fshape = new THREE.Shape(); fshape.moveTo(0, 0); fshape.lineTo(-0.34, -0.07); fshape.lineTo(0, -0.15);
  const flag = new THREE.Mesh(new THREE.ShapeGeometry(fshape), M.flag); flag.material.side = THREE.DoubleSide;
  flag.position.set(0.5, 2.82, 0); boat.add(flag);

  // lifebuoys on the lower cabin walls
  const buoyGeo = new THREE.TorusGeometry(0.075, 0.026, 8, 20);
  for (const [x, z] of [[-1.6, 1], [1.6, 1], [-1.6, -1], [1.6, -1]]) {
    const bu = new THREE.Mesh(buoyGeo, M.buoy); bu.position.set(x, 0.92, z * ((B - 0.5) / 2 + 0.035)); boat.add(bu);
  }
  scene.add(boat);

  /* ------------------------------------------------------------ the lake */
  const waterMat = flat("#BCFEFF", "#8FE9E2", 0.25); waterMat.transparent = true; waterMat.opacity = 0.7;
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.6, 72), waterMat); water.rotation.x = -Math.PI / 2; water.scale.set(1, 0.62, 1); water.position.y = -0.02; scene.add(water);
  const rippleMat = new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.6, depthWrite: false });
  let rippleK = 1;
  const ripples = [0, 1, 2].map((i) => {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 80), rippleMat.clone());
    r.rotation.x = -Math.PI / 2; r.position.y = 0.0; r.userData.ph = i / 3; scene.add(r); return r;
  });

  /* ------------------------------------------------------------ smoke */
  const puffTex = puffTexture();
  const puffs = [];
  const MAX = 64;
  for (let i = 0; i < MAX; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: "#FFFFFF", transparent: true, opacity: 0, depthWrite: false }));
    sp.visible = false; sp.renderOrder = 5; scene.add(sp);
    puffs.push({ sp, age: 0, life: 1, v: new THREE.Vector3(), s0: 0.3, s1: 1.5 });
  }
  let nextPuff = 0, smokeTint = new THREE.Color("#EEE8FF"), smokeK = 0.62;
  const mouthPos = new THREE.Vector3();
  function emit(strength = 1) {
    const p = puffs.find((q) => !q.sp.visible); if (!p) return;
    mouth.getWorldPosition(mouthPos);
    p.sp.position.copy(mouthPos);
    p.age = 0; p.life = 7 + Math.random() * 2.5;
    // rise, and drift up-left toward the FAQ title
    p.v.set(-0.28 - Math.random() * 0.22, 0.95 + Math.random() * 0.5 * strength, (Math.random() - 0.5) * 0.25);
    p.s0 = 0.32 + Math.random() * 0.12; p.s1 = (1.9 + Math.random() * 0.9) * (0.8 + 0.3 * strength);
    p.sp.visible = true; p.sp.material.color.copy(smokeTint);
  }

  /* ------------------------------------------------------------ layout */
  let W = 1, H = 1, boatCenterY = 1;
  function resize() {
    W = Math.max(1, canvas.clientWidth); H = Math.max(1, canvas.clientHeight);
    renderer.setSize(W, H, false);
    const colW = canvas.parentElement?.clientWidth || W;    // the canvas overhangs the column for smoke room
    boatCenterY = H - Math.min(140, H * 0.26);
    const ppu = Math.min((colW * 1.0) / 7.4, 340 / 3.6);
    const F = 2 * Math.max(boatCenterY, H - boatCenterY);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const d = F / (2 * Math.tan(fov / 2) * ppu);
    const el = THREE.MathUtils.degToRad(21);
    camera.position.set(0, 0.9 + Math.sin(el) * d, Math.cos(el) * d);
    camera.lookAt(0, 0.9, 0);
    camera.aspect = W / F;
    camera.setViewOffset(W, F, 0, F / 2 - boatCenterY, W, H);
    camera.updateProjectionMatrix();
    draw(0);
  }

  /* ------------------------------------------------------------ animation */
  let t = 0, spinBoost = 0, running = false, visible = false, last = 0, raf = 0;
  boat.rotation.y = -0.6;
  function draw(dt) {
    t += dt;
    boat.rotation.y += dt * (0.22 + spinBoost);
    spinBoost *= Math.pow(0.35, dt);
    boat.position.y = Math.sin(t * 1.3) * 0.045;
    boat.rotation.z = Math.sin(t * 0.9) * 0.022;
    boat.rotation.x = Math.sin(t * 1.1 + 1) * 0.018;
    flag.rotation.y = Math.sin(t * 3) * 0.25;
    ripples.forEach((r) => {
      const k = (t * 0.2 + r.userData.ph) % 1;
      r.scale.set(2.4 + k * 2.4, 1.48 + k * 1.5, 1);
      r.material.opacity = 0.5 * rippleK * (1 - k);
    });
    nextPuff -= dt;
    if (nextPuff <= 0 && dt > 0) { emit(); nextPuff = 0.34 + Math.random() * 0.12; }
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
    renderer.render(scene, camera);
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
  for (let i = 0; i < 40; i++) draw(0.16);   // start with a plume already rising

  function setTheme(dark) {
    nightU.value = dark ? 1 : 0;
    smokeTint.set(dark ? "#C9BFEA" : "#EEE8FF"); smokeK = dark ? 0.48 : 0.62;
    puffs.forEach((p) => p.sp.material.color.copy(smokeTint));
    waterMat.opacity = dark ? 0.45 : 0.7;
    rippleK = dark ? 0.55 : 1;
    draw(0);
  }
  return { setTheme };
}
