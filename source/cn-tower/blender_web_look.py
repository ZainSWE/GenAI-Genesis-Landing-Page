"""
Make cn-tower.blend render like the website (two-tone flat shading).

HOW TO USE
  1. Open cn-tower.blend in Blender (4.2 or newer).
  2. Go to the Scripting tab, click Open, choose this file, then Run Script.
  3. Press F12 to render (or use the rendered viewport shading to preview).

WHAT IT DOES
  The website doesn't use lights. Every part is a flat colour, and each part
  uses its lighter colour on the right half of the tower and its darker colour
  on the left half, as seen from the camera. This script rebuilds every
  material with the same rule:
     object-space position (x, y, 0)  ->  camera space  ->  X > 0 ? lit : shadow
  It then sets the colour settings so the hex colours come out exactly, and
  aims the camera at the same "hero" view as the web preview.

It's safe to run more than once. Re-running build_cn_tower.py rebuilds the
.blend with plain materials, so run this script again after that.
"""
import math
import bpy
from mathutils import Vector

# ---------------------------------------------------------------- settings
CAMERA_VIEW = "hero"        # "hero", "deck", "under", "skypod", "screenshot" or None (leave camera alone)
TRANSPARENT_BACKGROUND = True   # True = PNG with alpha; False = solid teal background
BACKGROUND_HEX = "#0A6672"
RESOLUTION = (1080, 1920)   # width, height in pixels

# Same camera stops as preview.html, converted from web (Y up) to Blender (Z up):
#   web (x, y, z)  ->  Blender (x, -z, y)
VIEWS = {
    "hero":       ((0, -19.0, 3.2), (0, 0, 5.0)),
    "deck":       ((0, -5.2,  6.5), (0, 0, 6.0)),
    "under":      ((0, -4.6,  5.2), (0, 0, 6.2)),
    "skypod":     ((0, -4.2,  8.9), (0, 0, 8.2)),
    "screenshot": ((0, -11.5, 5.6), (0, 0, 6.3)),
}
FOV_DEGREES = 35            # vertical, like the three.js camera


def hex_to_linear(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c] + [1.0]


def build_two_tone(mat):
    lit = mat.get("lit")
    shadow = mat.get("shadow", lit)
    if not lit:
        print(f"skipped {mat.name}: no 'lit' custom property")
        return
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    N, L = nt.nodes, nt.links

    tex = N.new("ShaderNodeTexCoord");          tex.location = (-1000, 0)
    sep = N.new("ShaderNodeSeparateXYZ");       sep.location = (-800, 0)
    comb = N.new("ShaderNodeCombineXYZ");       comb.location = (-600, 0)
    comb.label = "Radial direction (x, y, 0)"
    vt = N.new("ShaderNodeVectorTransform");    vt.location = (-400, 0)
    vt.vector_type = "VECTOR"; vt.convert_from = "OBJECT"; vt.convert_to = "CAMERA"
    sep2 = N.new("ShaderNodeSeparateXYZ");      sep2.location = (-200, 0)
    gt = N.new("ShaderNodeMath");               gt.location = (0, 0)
    gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = 0.0
    gt.label = "Right half?"

    mix = N.new("ShaderNodeMix");               mix.location = (200, 0)
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = hex_to_linear(shadow)   # left half
    mix.inputs["B"].default_value = hex_to_linear(lit)      # right half
    mix.label = f"shadow {shadow} / lit {lit}"

    emit = N.new("ShaderNodeEmission");         emit.location = (400, 0)
    emit.inputs["Strength"].default_value = 1.0
    out = N.new("ShaderNodeOutputMaterial");    out.location = (600, 0)

    L.new(tex.outputs["Object"], sep.inputs[0])
    L.new(sep.outputs["X"], comb.inputs["X"])
    L.new(sep.outputs["Y"], comb.inputs["Y"])          # Z stays 0 (tower axis is Z)
    L.new(comb.outputs[0], vt.inputs[0])
    L.new(vt.outputs[0], sep2.inputs[0])
    L.new(sep2.outputs["X"], gt.inputs[0])
    L.new(gt.outputs[0], mix.inputs["Factor"])
    L.new(mix.outputs["Result"], emit.inputs["Color"])
    L.new(emit.outputs[0], out.inputs["Surface"])

    mat.diffuse_color = hex_to_linear(lit)


def setup_scene():
    scene = bpy.context.scene

    # Eevee is fast and gives the same result as Cycles for pure emission.
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            pass

    # Exact hex colours: no Filmic/AgX tone mapping, no bloom or exposure.
    vs = scene.view_settings
    vs.view_transform = "Standard"
    vs.look = "None"
    vs.exposure = 0.0
    vs.gamma = 1.0
    scene.display_settings.display_device = "sRGB"
    scene.sequencer_colorspace_settings.name = "sRGB"

    scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = TRANSPARENT_BACKGROUND
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if TRANSPARENT_BACKGROUND else "RGB"

    # No lights needed; the preview sun would not change anything.
    sun = bpy.data.objects.get("PreviewSun")
    if sun:
        sun.hide_render = True
        sun.hide_viewport = True

    if scene.world is None:
        scene.world = bpy.data.worlds.new("World")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = hex_to_linear(BACKGROUND_HEX)
        bg.inputs[1].default_value = 1.0


def setup_camera():
    if not CAMERA_VIEW:
        return
    scene = bpy.context.scene
    cam = scene.camera or bpy.data.objects.get("PreviewCamera")
    if cam is None:
        cam = bpy.data.objects.new("PreviewCamera", bpy.data.cameras.new("PreviewCamera"))
        scene.collection.objects.link(cam)
    scene.camera = cam
    pos, target = VIEWS[CAMERA_VIEW]
    cam.location = Vector(pos)
    cam.rotation_mode = "XYZ"
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens_unit = "FOV"
    cam.data.sensor_fit = "VERTICAL"
    cam.data.angle = math.radians(FOV_DEGREES)
    cam.data.clip_start, cam.data.clip_end = 0.1, 100


tower = bpy.data.objects.get("CNTower")
materials = {s.material for s in tower.material_slots if s.material} if tower else set(bpy.data.materials)
for m in materials:
    build_two_tone(m)
setup_scene()
setup_camera()
print(f"CN Tower web look applied to {len(materials)} materials, camera view: {CAMERA_VIEW}")
