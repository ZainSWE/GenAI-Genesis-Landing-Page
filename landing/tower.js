/**
 * CN Tower scene for the landing-page story.
 *
 * - Loads assets/cn-tower/cn-tower.glb and recolours it to the pastel palette
 *   used in the hero design (mint mast, lilac bands, white deck).
 * - Uses a variant of two-tone-material.js whose light/shadow split follows a
 *   "light angle" instead of always sitting on the centre line. Sweeping that
 *   angle with scroll makes the split slide across the silhouette, so the
 *   (rotationally symmetric) tower visibly turns, like the hape.io model.
 * - A thin orbit of mint/lilac beads circles the deck and spins with scroll,
 *   giving the rotation a second, clearer cue.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Material name -> [lit (right), shadow (left)] — Zain's pastel palette.
const PASTEL = {
  tower_teal:     ["#BCFEFF", "#00FFDD"],
  tower_teal_low: ["#BCFEFF", "#00FFDD"],
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

const lightDir = { value: new THREE.Vector2(1, 0) }; // shared uniform (view-space xz)

function sweepMaterial(lit, shadow, name) {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(lit), transparent: false });
  m.name = name;
  const shadowColor = new THREE.Color(shadow);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uShadowColor = { value: shadowColor };
    shader.uniforms.uLightDir = lightDir;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vSide;\nuniform vec2 uLightDir;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 radialV = modelViewMatrix * vec4(transformed.x, 0.0, transformed.z, 0.0);
        vSide = dot(radialV.xz, uLightDir);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vSide;\nuniform vec3 uShadowColor;")
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `float w = max(fwidth(vSide), 1e-6);
        float litMix = clamp(vSide / w + 0.5, 0.0, 1.0);
        vec4 diffuseColor = vec4( mix(uShadowColor, diffuse, litMix), opacity );`
      );
  };
  m.customProgramCacheKey = () => "cn-tower-sweep";
  return m;
}

function buildOrbit() {
  const g = new THREE.Group();
  const count = 28;
  const geo = new THREE.SphereGeometry(0.045, 12, 8);
  const mint = new THREE.MeshBasicMaterial({ color: "#00FFDD" });
  const lilac = new THREE.MeshBasicMaterial({ color: "#E09DFF" });
  const a = new THREE.InstancedMesh(geo, mint, count / 2);
  const b = new THREE.InstancedMesh(geo, lilac, count / 2);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const r = 1.55;
    const s = i % 7 === 0 ? 1.8 : 1;
    m4.makeScale(s, s, s).setPosition(Math.cos(t) * r, 0, Math.sin(t) * r);
    (i % 2 ? b : a).setMatrixAt(Math.floor(i / 2), m4);
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.55, 0.006, 6, 160),
    new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = Math.PI / 2;
  g.add(a, b, ring);
  return g;
}

export async function createTower(url) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);

  const loader = new GLTFLoader();
  const gltf = url instanceof ArrayBuffer ? await loader.parseAsync(url, "") : await loader.loadAsync(url);
  const cache = new Map();
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    const swap = (src) => {
      if (!cache.has(src)) {
        const [lit, shadow] = PASTEL[src.name] ?? [src.userData?.lit ?? "#ffffff", src.userData?.shadow ?? "#dddddd"];
        cache.set(src, sweepMaterial(lit, shadow, src.name));
        src.dispose();
      }
      return cache.get(src);
    };
    node.material = Array.isArray(node.material) ? node.material.map(swap) : swap(node.material);
  });

  const pivot = new THREE.Group();   // tilt happens around the deck, not the base
  const tower = gltf.scene;
  tower.position.y = -6.1;
  pivot.position.y = 6.1;
  pivot.add(tower);

  const orbit = buildOrbit();
  orbit.position.y = 0.05;           // deck height (inside pivot space)
  pivot.add(orbit);
  scene.add(pivot);

  // Story poses. sx = horizontal placement as a fraction of the half-viewport
  // at the tower's depth (−1 left edge, +1 right edge).
  // Desktop / portrait variants keep the tower clear of the text panels.
  const POSES = {
    wide: [
      { cam: [0, 5.0, 6.4],   look: [0, 7.05, 0], sx: 0.36, tilt: 0.075, orbit: 0 },   // hero (matches design)
      { cam: [0, 3.9, 22.5],  look: [0, 5.0, 0],  sx: 0.0,  tilt: 0.0,   orbit: 1 },   // about: whole tower
      { cam: [0, 6.75, 8.4],  look: [0, 6.15, 0], sx: 0.0,  tilt: 0.0,   orbit: 1 },   // stats: deck close-up
      { cam: [0, 5.2, 10.5],  look: [0, 7.6, 0],  sx: -0.4, tilt: -0.05, orbit: 1 },   // toronto: look up, left
      { cam: [0, 12.5, 14],   look: [0, 9.5, 0],  sx: -0.4, tilt: -0.05, orbit: 0 },   // exit: tower sinks away
    ],
    tall: [
      { cam: [0, 4.6, 14.5],  look: [0, 6.6, 0],  sx: 0.78, tilt: 0.07,  orbit: 0 },
      { cam: [0, 4.2, 30],    look: [0, 5.2, 0],  sx: 0.0,  tilt: 0.0,   orbit: 1 },
      { cam: [0, 6.0, 15],    look: [0, 6.4, 0],  sx: 0.62, tilt: 0.0,   orbit: 1 },
      { cam: [0, 5.0, 15],    look: [0, 7.4, 0],  sx: 0.0,  tilt: -0.04, orbit: 1 },
      { cam: [0, 13, 18],     look: [0, 10, 0],   sx: 0.0,  tilt: -0.04, orbit: 0 },
    ],
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const v = new THREE.Vector3();
  const look = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();

  /** c: continuous chapter index (0 hero … 4 exit). */
  function pose(c) {
    const set = camera.aspect < 0.85 ? POSES.tall : POSES.wide;
    const i = Math.max(0, Math.min(set.length - 2, Math.floor(c)));
    const t = smooth(Math.max(0, Math.min(1, c - i)));
    const A = set[i], B = set[i + 1];
    const P = (k) => A[k].map((x, j) => lerp(x, B[k][j], t));

    camera.position.set(...P("cam"));
    look.set(...P("look"));
    camera.lookAt(look);
    camera.updateMatrixWorld();

    // Shift the tower sideways in the camera's right direction.
    const sx = lerp(A.sx, B.sx, t);
    const dist = camera.position.distanceTo(look);
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist * camera.aspect;
    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, camera.up).normalize();
    v.copy(right).multiplyScalar(-sx * halfW);           // move camera opposite = tower moves
    camera.position.add(v);
    look.add(v);
    camera.lookAt(look);

    pivot.rotation.z = lerp(A.tilt, B.tilt, t);

    // "Rotation": the lit side sweeps across, and the orbit spins.
    const ang = 0.95 * Math.sin(c * 1.9);
    lightDir.value.set(Math.cos(ang), Math.sin(ang));
    orbit.rotation.y = c * Math.PI * 0.9;
    orbit.rotation.x = 0.12 + 0.08 * Math.sin(c * 2.0);
    const o = lerp(A.orbit, B.orbit, t);
    orbit.scale.setScalar(Math.max(0.001, o));
    orbit.visible = o > 0.01;
  }

  return { scene, camera, pose };
}
