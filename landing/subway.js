/**
 * Finale: a Toronto Rocket–style subway train in the landing-page palette,
 * framed like a photo taken from the platform (front three-quarter view).
 *
 * - Wind: speed streaks, scrolling platform tiles and a light body sway run
 *   continuously while the section is on screen, even without scrolling.
 * - Scroll: the camera tracks along the train and each window pops a floating
 *   circular profile picture of a team member; the last stretch frames the
 *   train again for the sign-up CTA.
 *
 * Built procedurally (no model file). Flat two-tone shading, no lights.
 */
import * as THREE from "three";

const COL = {
  body: "#F1EFF8", bodyShade: "#B9B1D9",
  skirt: "#4A4466", glass: "#231B3D", door: "#E6E1F4", frame: "#E09DFF",
  mint: "#00FFDD", roof: "#FFFFFF", bogie: "#2E2843",
  platform: "#F6F2FD", edge: "#F7D14A", bed: "#CFC3EE", rail: "#9A90BF",
};

const lightW = { value: new THREE.Vector2(-0.8, 0.6).normalize() };  // lights the platform-side face

function flat(color, shade = COL.bodyShade, topMix = 0.45) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
  m.onBeforeCompile = (s) => {
    s.uniforms.uLight = lightW;
    s.uniforms.uShade = { value: new THREE.Color(shade) };
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vN;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvN = normalize(mat3(modelMatrix) * normal);");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vN;\nuniform vec2 uLight;\nuniform vec3 uShade;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 n = normalize(vN);
        vec3 b = diffuseColor.rgb;
        float lit = smoothstep(-0.05, 0.05, dot(n.xz, uLight));
        vec3 c = mix(mix(b, uShade, 0.45), b, lit);
        if (n.y > 0.6) c = mix(b, vec3(1.0), ${topMix.toFixed(2)});
        if (n.y < -0.6) c = mix(b, uShade, 0.6);
        diffuseColor.rgb = c;`);
  };
  m.customProgramCacheKey = () => "subway-flat-" + topMix;
  return m;
}

function clipY(poly, ymin, ymax) {
  const clip = (pts, keep, ey) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ia = keep(a[1]), ib = keep(b[1]);
      if (ia) out.push(a);
      if (ia !== ib) { const t = (ey - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, ey]); }
    }
    return out;
  };
  return clip(clip(poly, (y) => y >= ymin, ymin), (y) => y <= ymax, ymax);
}

const W = 3.1;            // car width
// (u, v) = (distance back from the front, height)
const toWorld = new THREE.Matrix4().set(0, 0, 1, -W / 2, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1);

function slab(poly, width, mat, bevel, u0 = 0, grow = bevel) {
  const shape = new THREE.Shape(poly.map(([u, v]) => new THREE.Vector2(u, v)));
  // bevel = how far past the side walls; grow = how much the outline expands (kept tiny for stripes)
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: grow, bevelSegments: 3, curveSegments: 1 });
  g.translate(u0, 0, -(width - W) / 2);
  g.applyMatrix4(toWorld);
  return new THREE.Mesh(g, mat);
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return new THREE.ShapeGeometry(s, 4);
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
    g.fillStyle = "rgba(255,255,255,0.95)";                     // placeholder silhouette
    g.beginPath(); g.arc(128, 104, 42, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(128, 236, 84, 72, 0, Math.PI, 0); g.fill();
    g.restore();
    g.lineWidth = 12; g.strokeStyle = "#FFFFFF"; g.beginPath(); g.arc(128, 128, 116, 0, Math.PI * 2); g.stroke();
  });
  if (member.photo) {                                           // real photo, when provided
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

export function createSubway(team) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);

  const train = new THREE.Group();
  scene.add(train);
  const bodyMat = flat(COL.body);
  const skirtMat = flat(COL.skirt, "#2A2540", 0.2);
  const mintMat = new THREE.MeshBasicMaterial({ color: COL.mint });
  const roofMat = flat(COL.roof, "#D9D3EE", 0.6);
  const glassMat = new THREE.MeshBasicMaterial({ color: COL.glass });
  const doorMat = flat(COL.door, "#C9C0E6");
  const frameMat = new THREE.MeshBasicMaterial({ color: COL.frame });
  const bogieMat = new THREE.MeshBasicMaterial({ color: COL.bogie });

  const FLOOR = 0.55, ROOF = 3.65, BEV = 0.22;
  const sideX = -W / 2 - BEV - 0.012;            // platform-side face
  const windows = [];                             // world centres for avatars

  function car(u0, L, cab) {
    const poly = cab
      ? [[0.12, FLOOR], [L, FLOOR], [L, ROOF], [1.35, ROOF], [0.48, 2.05], [0.1, 1.55], [0, 1.0]]
      : [[0, FLOOR], [L, FLOOR], [L, ROOF], [0, ROOF]];
    train.add(slab(poly, W, bodyMat, BEV, u0));
    train.add(slab(clipY(poly, FLOOR - 0.2, 0.98), W + 0.02, skirtMat, BEV + 0.01, u0, 0.012));
    train.add(slab(clipY(poly, 1.2, 1.32), W + 0.02, mintMat, BEV + 0.012, u0, 0.012));
    train.add(slab(clipY(poly, 3.42, ROOF + 0.2), W + 0.03, roofMat, BEV + 0.012, u0, 0.012));
    // bogies
    for (const f of [0.18, 0.78]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.42, 2.6), bogieMat);
      b.position.set(0, 0.3, -(u0 + L * f)); train.add(b);
    }
    // platform-side doors + windows
    const seq = cab ? "DWWDWWDWWD" : "WDWWDWWDWWDW";
    let u = u0 + (cab ? 2.25 : 0.55);
    for (const k of seq) {
      if (k === "D") {
        const w = 1.35;
        const door = new THREE.Mesh(roundedRect(w, 2.55, 0.08), doorMat);
        door.position.set(sideX, 2.03, -(u + w / 2)); door.rotation.y = -Math.PI / 2; train.add(door);
        const fr = new THREE.Mesh(roundedRect(w + 0.12, 2.67, 0.1), frameMat);
        fr.position.set(sideX + 0.006, 2.03, -(u + w / 2)); fr.rotation.y = -Math.PI / 2; train.add(fr);
        const split = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 2.5), frameMat);
        split.position.set(sideX - 0.006, 2.03, -(u + w / 2)); split.rotation.y = -Math.PI / 2; train.add(split);
        for (const s of [-1, 1]) {
          const dw = new THREE.Mesh(roundedRect(0.38, 1.05, 0.08), glassMat);
          dw.position.set(sideX - 0.005, 2.55, -(u + w / 2 + s * 0.3)); dw.rotation.y = -Math.PI / 2; train.add(dw);
        }
        u += w + 0.16;
      } else {
        const w = 1.3;
        const win = new THREE.Mesh(roundedRect(w, 1.12, 0.14), glassMat);
        win.position.set(sideX, 2.62, -(u + w / 2)); win.rotation.y = -Math.PI / 2; train.add(win);
        windows.push(new THREE.Vector3(sideX - 0.03, 2.62, -(u + w / 2)));
        u += w + 0.16;
      }
    }
  }
  const L1 = 17.6, L2 = 17.4, GAP = 0.45;
  car(0, L1, true);
  car(L1 + GAP, L2, false);
  car(L1 + GAP + L2 + GAP, L2, false);
  for (const k of [1, 2]) {
    const bel = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 2.7, GAP + 0.3), skirtMat);
    bel.position.set(0, 2.1, -(k * L1 + (k - 0.5) * GAP + (k - 1) * (L2 - L1))); train.add(bel);
  }

  // Front: windshield, sign, lights
  const slantA = new THREE.Vector2(0.48, 2.05), slantB = new THREE.Vector2(1.35, ROOF);
  const dir = slantB.clone().sub(slantA).normalize();
  const nrm = new THREE.Vector2(-dir.y, dir.x);                 // outward (forward-up) in (u,v)
  const onSlant = (t, out, x) => {
    const p = slantA.clone().lerp(slantB, t).add(nrm.clone().multiplyScalar(out));
    return new THREE.Vector3(x, p.y, -p.x);
  };
  function quad(t0, t1, x0, x1, out, mat) {
    const g = new THREE.BufferGeometry();
    const a = onSlant(t0, out, x0), b = onSlant(t0, out, x1), c = onSlant(t1, out, x1), d = onSlant(t1, out, x0);
    g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); train.add(m); return m;
  }
  quad(0.08, 0.92, -W / 2 + 0.1, W / 2 - 0.1, BEV + 0.02, glassMat);
  const signTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = "#120E22"; g.fillRect(0, 0, w, h);
    g.fillStyle = COL.mint; g.font = `700 74px ${FONT}`; g.textBaseline = "middle";
    g.fillText("2027", 24, h / 2 + 4);
    g.font = `600 44px ${FONT}`; g.fillStyle = "#BCFEFF"; g.fillText("GENAI GENESIS", 210, h / 2 + 4);
  });
  quad(0.7, 0.86, 0.05, W / 2 - 0.3, BEV + 0.03, new THREE.MeshBasicMaterial({ map: signTex }));
  // marker lights (mint) + headlights
  for (const s of [-1, 1]) {
    const mk = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), mintMat);
    const p = onSlant(0.97, BEV + 0.035, s * 1.1); mk.position.copy(p); mk.lookAt(p.x, p.y + nrm.y, p.z + nrm.x); train.add(mk);
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshBasicMaterial({ color: "#FFFBE6" }));
    hl.position.set(s * 1.05, 1.3, 0.26); train.add(hl);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 24), new THREE.MeshBasicMaterial({ color: COL.skirt }));
    ring.position.copy(hl.position); ring.position.z -= 0.002; train.add(ring);
  }

  // front bumper + mint band across the nose
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(W + 0.32, 0.5, 0.34), skirtMat);
  bumper.position.set(0, 0.8, 0.08); train.add(bumper);
  const noseBand = new THREE.Mesh(new THREE.BoxGeometry(W + 0.34, 0.1, 0.1), mintMat);
  noseBand.position.set(0, 1.08, 0.2); train.add(noseBand);

  // Track + platform
  const world = new THREE.Group(); scene.add(world);
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(9, 400), flat(COL.bed, "#B3A5E3", 0.0));
  bed.rotation.x = -Math.PI / 2; bed.position.set(0.8, -0.01, -150); world.add(bed);
  for (const x of [-0.72, 0.72]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 400), new THREE.MeshBasicMaterial({ color: COL.rail }));
    r.position.set(x, 0.07, -150); world.add(r);
  }
  const PLAT_Y = 1.12, PLAT_X = -W / 2 - 0.42;
  const tileTex = canvasTex(256, 256, (g) => {
    g.fillStyle = COL.platform; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(150,130,210,0.35)"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 2); g.lineTo(256, 2); g.moveTo(2, 0); g.lineTo(2, 256); g.stroke();
  });
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(6, 200);
  const plat = new THREE.Mesh(new THREE.PlaneGeometry(14, 400), new THREE.MeshBasicMaterial({ map: tileTex }));
  plat.rotation.x = -Math.PI / 2; plat.position.set(PLAT_X - 7 - 0.6, PLAT_Y, -150); world.add(plat);
  const edgeTex = canvasTex(64, 64, (g) => {
    g.fillStyle = COL.edge; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "rgba(255,255,255,0.45)"; for (let y = 8; y < 64; y += 16) for (let x = 8; x < 64; x += 16) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  });
  edgeTex.wrapS = edgeTex.wrapT = THREE.RepeatWrapping; edgeTex.repeat.set(1, 600);
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 400), new THREE.MeshBasicMaterial({ map: edgeTex }));
  edge.rotation.x = -Math.PI / 2; edge.position.set(PLAT_X - 0.3, PLAT_Y + 0.002, -150); world.add(edge);
  const lip = new THREE.Mesh(new THREE.PlaneGeometry(400, PLAT_Y), flat("#D8CEF5", "#B8AAE6"));
  lip.rotation.y = Math.PI / 2; lip.position.set(PLAT_X, PLAT_Y / 2, -150); world.add(lip);

  // Wind streaks
  const STREAKS = 90;
  const streakGeo = new THREE.BoxGeometry(0.035, 0.035, 1);
  const streakMats = [
    new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.85, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: COL.mint, transparent: true, opacity: 0.7, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: "#E09DFF", transparent: true, opacity: 0.6, depthWrite: false }),
  ];
  const streakSets = streakMats.map((m) => new THREE.InstancedMesh(streakGeo, m, STREAKS / 3));
  streakSets.forEach((s) => scene.add(s));
  const streaks = [];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < STREAKS; i++) {
    let x, y;
    do { x = -6 + rnd() * 11; y = 0.5 + rnd() * 5.5; } while (Math.abs(x) < W / 2 + 0.5 && y < ROOF + 0.4);
    streaks.push({ x, y, z: 12 - rnd() * 90, len: 1.5 + rnd() * 5, speed: 55 + rnd() * 40 });
  }
  const m4 = new THREE.Matrix4(), sq = new THREE.Quaternion(), sp = new THREE.Vector3(), ss = new THREE.Vector3();

  // Team avatars in windows
  const avatars = team.map((member, i) => {
    const w = windows[i];
    if (!w) return null;
    const mat = new THREE.SpriteMaterial({ map: avatarTexture(i, member), transparent: true, depthTest: false });
    const s = new THREE.Sprite(mat);
    s.position.copy(w); s.scale.setScalar(0.001); s.renderOrder = 10;
    train.add(s);
    return { sprite: s, base: w.clone(), shown: 0, target: 0, phase: i * 1.37 };
  }).filter(Boolean);

  /* ------------------------------------------------------------ camera */
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const look = new THREE.Vector3();
  const V = (a) => new THREE.Vector3(...a);
  const REF = { cam: V([-4.3, 2.35, 7.4]), look: V([0.4, 3.35, -8.0]) };       // photo-like 3/4 view
  const END = { cam: V([-4.3, 2.35, 7.4]), look: V([0.4, 3.35, -8.0]) };
  let q = 0, time = 0, revealCount = 0;

  function winZ(f) {
    const i = Math.max(0, Math.min(avatars.length - 1, f));
    const a = Math.floor(i), b = Math.min(avatars.length - 1, a + 1);
    return lerp(avatars[a].base.z, avatars[b].base.z, i - a);
  }
  function placeCamera() {
    const tall = camera.aspect < 0.85;
    const N = avatars.length;
    const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
    if (q < 0.12) {
      pos.copy(REF.cam); tgt.copy(REF.look);
    } else if (q < 0.78) {
      const k = smooth(Math.min(1, (q - 0.12) / 0.08));        // ease out of the reference view
      const f = Math.max(0, (q - 0.16) / 0.56) * (N - 1);
      const z = winZ(f);
      const track = { cam: V([-9.6, 3.1, z + 5.2]), look: V([0.2, 2.9, z - 2.6]) };
      pos.lerpVectors(REF.cam, track.cam, k); tgt.lerpVectors(REF.look, track.look, k);
    } else {
      const f = (N - 1);
      const z = winZ(f);
      const k = smooth(Math.min(1, (q - 0.78) / 0.14));
      pos.lerpVectors(V([-9.6, 3.1, z + 5.2]), END.cam, k); tgt.lerpVectors(V([0.2, 2.9, z - 2.6]), END.look, k);
    }
    if (tall) { pos.x -= 5.5; pos.y += 0.6; pos.z += 6; }
    // gentle sway: the camera rides with the train
    pos.y += Math.sin(time * 9.0) * 0.012; pos.x += Math.sin(time * 5.3) * 0.01;
    camera.position.copy(pos); camera.lookAt(tgt);
  }

  /** Scroll progress through the pinned finale (0..1). */
  function setProgress(v) {
    q = v;
    const f = Math.max(0, (q - 0.14) / 0.56) * (avatars.length - 1);
    revealCount = q < 0.13 ? 0 : Math.min(avatars.length, Math.floor(f + 1.05));
    avatars.forEach((a, i) => { a.target = i < revealCount ? 1 : 0; });
  }

  /** Advance animation by dt seconds (wind runs regardless of scroll). */
  function tick(dt, still) {
    if (!still) time += dt;
    // streaks
    const per = STREAKS / 3;
    streaks.forEach((s, i) => {
      if (!still) { s.z -= s.speed * dt; if (s.z < -90) s.z += 102; }
      sp.set(s.x, s.y, s.z); ss.set(1, 1, s.len);
      streakSets[i % 3].setMatrixAt(Math.floor(i / 3) % per, m4.compose(sp, sq, ss));
    });
    streakSets.forEach((s) => { s.instanceMatrix.needsUpdate = true; });
    if (!still) { tileTex.offset.y += dt * 9.0; edgeTex.offset.y += dt * 26.0; }
    // body sway
    train.position.y = Math.sin(time * 14) * 0.008;
    train.rotation.z = Math.sin(time * 3.1) * 0.0025;
    // avatars float in their windows
    avatars.forEach((a) => {
      a.shown += (a.target - a.shown) * Math.min(1, dt * 7);
      const pop = a.shown < 0.001 ? 0.001 : a.shown * (1 + 0.12 * Math.sin(Math.min(1, a.shown) * Math.PI));
      a.sprite.scale.setScalar(0.86 * pop);
      a.sprite.position.set(a.base.x, a.base.y + Math.sin(time * 1.8 + a.phase) * 0.07, a.base.z + Math.cos(time * 1.3 + a.phase) * 0.05);
      a.sprite.material.rotation = Math.sin(time * 1.1 + a.phase) * 0.08;
    });
    placeCamera();
  }

  const tmp = new THREE.Vector3();
  /** Screen positions for HTML name labels (below each window). */
  function labels(width, height) {
    return avatars.map((a) => {
      tmp.set(a.base.x, a.base.y - 0.86, a.base.z).applyMatrix4(train.matrixWorld).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * width, y: (-tmp.y * 0.5 + 0.5) * height, visible: a.shown > 0.5 && tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05 };
    });
  }

  return { scene, camera, setProgress, tick, labels, get revealed() { return revealCount; } };
}
