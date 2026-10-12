/**
 * Two-tone material for the stylised CN Tower (cn-tower.glb).
 *
 * The judge-page artwork shades the tower as flat colour split exactly down
 * the middle: the right half uses the lighter tone, the left half the darker
 * one. This helper recreates that look in three.js without lights:
 *
 *   - Each glTF material carries `extras` → `material.userData`
 *     `{ lit: "#97E0DD", shadow: "#30AEB5" }` (written by build_cn_tower.py).
 *   - A fragment is "lit" when it is on the camera-right side of the tower's
 *     vertical axis. The split is computed from the radial direction in view
 *     space, so it always sits on the centre line of the silhouette, whatever
 *     the camera angle or the model's Y rotation.
 *
 * It uses MeshBasicMaterial under the hood (unlit, cheap, respects fog and
 * colour management) — no lights are needed in the scene.
 *
 * Usage:
 *   import { applyTwoTone } from "./two-tone-material.js";
 *   const gltf = await new GLTFLoader().loadAsync("assets/models/cn-tower.glb");
 *   applyTwoTone(gltf.scene, THREE);
 */

export function createTwoToneMaterial(THREE, { lit, shadow, name = "" } = {}) {
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(lit) });
  material.name = name;
  const shadowColor = new THREE.Color(shadow ?? lit);
  material.userData.shadowColor = shadowColor;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uShadowColor = { value: shadowColor };

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vSide;"
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        // Radial direction from the tower axis (object space, Y up) projected
        // into view space; its x sign tells left/right of the silhouette centre.
        #ifdef USE_INSTANCING
          vec4 radialV = modelViewMatrix * instanceMatrix * vec4(transformed.x, 0.0, transformed.z, 0.0);
        #else
          vec4 radialV = modelViewMatrix * vec4(transformed.x, 0.0, transformed.z, 0.0);
        #endif
        vSide = radialV.x;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vSide;\nuniform vec3 uShadowColor;"
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `// Anti-aliased hard split (about one pixel wide).
        float w = max(fwidth(vSide), 1e-6);
        float litMix = clamp(vSide / w + 0.5, 0.0, 1.0);
        vec4 diffuseColor = vec4( mix(uShadowColor, diffuse, litMix), opacity );`
      );
  };
  // Make sure three.js does not reuse a program compiled without the patch.
  material.customProgramCacheKey = () => "cn-tower-two-tone";
  return material;
}

/**
 * Replace every material in a loaded glTF scene with its two-tone version.
 * Materials without `lit` in userData keep a flat version of their base colour.
 * Returns the created materials (handy for fading opacity during scroll).
 */
export function applyTwoTone(root, THREE) {
  const cache = new Map();
  root.traverse((node) => {
    if (!node.isMesh) return;
    const swap = (src) => {
      if (cache.has(src)) return cache.get(src);
      const lit = src.userData?.lit ?? `#${src.color.getHexString()}`;
      const shadow = src.userData?.shadow ?? lit;
      const mat = createTwoToneMaterial(THREE, { lit, shadow, name: src.name });
      cache.set(src, mat);
      src.dispose();
      return mat;
    };
    node.material = Array.isArray(node.material)
      ? node.material.map(swap)
      : swap(node.material);
  });
  return [...cache.values()];
}
