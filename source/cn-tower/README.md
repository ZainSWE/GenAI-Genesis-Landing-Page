# CN Tower — 3D model

A stylised 3D version of the CN Tower from the judge sign-up page artwork (`366FB23E…png` in the Claude project). It is modelled to match that illustration, not the real tower.

| File | Purpose |
|---|---|
| `assets/cn-tower/cn-tower.glb` | Web-ready model (153 KB, 6,560 tris, 13 flat materials, no textures) |
| `assets/cn-tower/two-tone-material.js` | three.js helper that recreates the art's hard left/right colour split |
| `source/cn-tower/build_cn_tower.py` | Generator — **the editable source**; every radius/height is a number here |
| `source/cn-tower/cn-tower.blend` | Blender 4.2 file produced by the generator (for inspection / manual tweaks) |
| `source/cn-tower/preview.html` | Dev preview with scroll-stop scrubber and turn slider |

## Rebuild

```bash
blender --background --python source/cn-tower/build_cn_tower.py
# or, without Blender installed:  pip install bpy==4.2.0  (Python 3.11)
python source/cn-tower/build_cn_tower.py
```
Writes `cn-tower.blend` next to the script and `cn-tower.glb` into `assets/cn-tower/`.
If you edit the `.blend` by hand, re-export with *glTF 2.0 → Include: Custom Properties* ticked, or the `lit`/`shadow` colours are lost. Changes you make to the `.blend` are overwritten the next time the script runs.

## Preview

ES modules and `.glb` files can't load from `file://`, so serve the project root over HTTP:
```bash
python -m http.server 8000
# open http://localhost:8000/source/cn-tower/preview.html
```
The preview loads three.js r169 from jsdelivr through an import map. It is only a dev page and is not part of the landing page.

## Model facts

- **Units / origin:** +Y up, origin at the centre of the base, height exactly **10 units**, max radius 0.475 (deck disc). 1 screenshot px = 0.00641 units.
- **Structure:** one closed surface of revolution (40 radial segments). There are no overlapping or intersecting parts, so it can't z-fight when rotated. Hard edges are split normals; rounded edges are 3-step fillets.
- **Anchor nodes** (empties, children of `CNTower`), useful as camera targets: `anchor_tip` (y 10), `anchor_skypod` (y 7.91), `anchor_deck` (y 6.12), `anchor_base` (y 0).
- **Materials:** each glTF material has `extras: { lit, shadow }` (→ `material.userData` in three.js). The base colour is set to `lit`, so generic glTF viewers show a flat, unsplit version.
- **Rotation:** the tower is rotationally symmetric, as in the art, so turning it around Y changes nothing visible. The two-tone split is computed relative to the camera, so it stays on the centre line at every angle. Motion therefore needs to come from camera moves (height, distance, tilt), not from spinning the model.

## Faithful to the reference vs. modelling choices

**Matched to the screenshot** (radii and heights measured from the pixels, tower axis at x = 72):

- Order and position of the parts:
  - upper mast r6 → purple band 1 → lower mast r10.5 → purple band 2 → shaft r13.5
  - light teal collar → SkyPod purple band r31.5 (lighter top face and rim)
  - upper shaft r17 → teal step r36 → two-tone purple tier r52
  - deck disc r74: dark top face, bright purple wall, lilac stripe, dark base
  - mint pod r71 → pale rim ring → dark underside opening → lower shaft r16
- All colours, as sampled hex values (see `MATERIALS` in the script). They render pixel-exact through the two-tone material.
- The flat, unlit look with a hard centre split: lighter tone on the right, darker on the left. There are no highlights, gradients, metal or glass.
- The stylised, oversized deck-to-shaft proportions.

**Modelling choices** (not shown, or not shown clearly, in the screenshot):

- **Antenna tip above the crop:** a thin glowing rod (`#C3FDFF`) borrowed from `judge-page/assets/cn-tower.svg`. Its length comes from real-tower ratios.
- **Base and lower shaft below the crop:** a gentle taper, then an outward flare, following the curve in the SVG. The base is a flat cap at y = 0. No legs or plinth were invented, because neither source shows any. The SVG fades the shaft out at the bottom; do that on the page with the skyline or a CSS mask instead of in the model.
- **Round cross-sections everywhere.** The art only shows a left/right split, and round sections keep that look at every angle. Set `RADIAL_SEGMENTS = 6` for a faceted variant, but the split will then no longer sit on flat faces.
- **Back and sides:** assumed symmetric.
- **Pod tones:** the art has the pod's *left* half slightly lighter (`#91D0CC` vs `#80CEC8`), the opposite of every other part. The model uses the lighter tone on the right, to match the rest of the tower. The difference is barely visible.
- **Perspective:** the art draws the deck disc from slightly *above* (its top face shows as an ellipse) and the pod opening from *below*. No single 3D camera can show both at once. The geometry has both, and the camera tilt decides which one shows (see the scroll stops below).
- **Band 1:** it is only ~1.5 px wider than the mast below it, so its rounded bottom is a very small fillet.

## Camera & lighting guidance

- **No lights are needed.** `applyTwoTone` swaps in unlit `MeshBasicMaterial`s. Use `renderer.outputColorSpace = SRGBColorSpace` and the default `NoToneMapping`, or the colours drift from the palette.
- **Perspective camera, FOV 35°** (vertical FOV, so it also works on portrait phones). Use a slight low angle for the hero shot and small tilts for detail shots. Avoid top-down or worm's-eye extremes; the art is always near eye level.
- Suggested scroll stops (used in `preview.html`):

| Stop | Camera position | Look at | Shows |
|---|---|---|---|
| Hero | (0, 3.2, 19) | (0, 5.0, 0) | Whole tower, about 80% of the viewport height |
| Deck | (0, 6.5, 5.2) | (0, 6.0, 0) | Slightly above the deck: dark top ellipse, as in the art |
| Under pod | (0, 5.2, 4.6) | (0, 6.2, 0) | Looking up at the pod rim and dark opening |
| SkyPod | (0, 8.9, 4.2) | (0, 8.2, 0) | SkyPod band, collar and antenna bands |
| Screenshot match | (0, 5.6, 11.5) | (0, 6.3, 0) | Close to the judge-page crop |

- Ease between stops (smoothstep) and render on demand (only when scroll changes). The model is static, so there's no need for a continuous render loop.
- **Performance:** cap the pixel ratio at 2 (or 1.5 on low-end devices) and create the renderer with `powerPreference: "low-power"`. 6.5k triangles and 13 draw calls are trivial for any GPU. Put `alpha: true` on the renderer so the page's CSS gradient shows through.
- **Fallbacks:** if `prefers-reduced-motion` is set, WebGL is unavailable, or the device is weak, show the static tower art instead. Note that `cn-tower.svg` uses the older cyan palette, so a PNG render of the hero stop would match better.

## Minimal integration

```js
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { applyTwoTone } from "./assets/cn-tower/two-tone-material.js";

const gltf = await new GLTFLoader().loadAsync("assets/cn-tower/cn-tower.glb");
applyTwoTone(gltf.scene, THREE);
scene.add(gltf.scene);
const deck = gltf.scene.getObjectByName("anchor_deck"); // camera target
```
