"""
CN Tower — stylised 3D model generator for the GenAI Genesis landing page.

Rebuilds `cn-tower.blend` and `cn-tower.glb` from scratch. Every proportion is
a number in PROFILE below, so tweaks are made here, not by hand in Blender.

Run from anywhere with either:
    blender --background --python source/cn-tower/build_cn_tower.py
    python source/cn-tower/build_cn_tower.py    # with `pip install bpy` (Python 3.11)
Writes cn-tower.blend next to this script and cn-tower.glb to assets/cn-tower/.
Pass `-- <dir>` to write both files to <dir> instead.

Reference: the judge sign-up page screenshot (project file 366FB23E…png).
All radii / heights are measured in *screenshot pixels* (tower axis at x=72)
and converted to scene units at the end. Anything the screenshot does not show
is marked "CHOICE" — see README.md for the full faithful-vs-choice list.

Conventions
  * +Y up, origin at the centre of the base, total height = 10 units.
  * The whole tower is ONE lathed surface (a surface of revolution), so there
    are no overlapping or intersecting parts, no z-fighting, and it is closed.
  * Materials carry two colours as custom properties (-> glTF material
    `extras`): `lit` (right-hand half in the art) and `shadow` (left half).
    `two-tone-material.js` uses them to reproduce the illustration's hard
    centre split in three.js. Base colour = `lit` for generic viewers.
"""
import math
import os
import sys

import bpy
import bmesh

# --------------------------------------------------------------------------
# Output location
# --------------------------------------------------------------------------
argv = sys.argv
if "--" in argv:
    argv = argv[argv.index("--") + 1:]
else:
    argv = argv[1:]
HERE = os.path.dirname(os.path.abspath(__file__))
if argv:
    BLEND_DIR = GLB_DIR = os.path.abspath(argv[0])
else:
    BLEND_DIR = HERE
    GLB_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "assets", "cn-tower"))

# --------------------------------------------------------------------------
# Palette — pick one of PALETTES below
# --------------------------------------------------------------------------
# name:            (lit,       shadow,    emissive)
PALETTES = {
    # Original colours sampled from the judge-page screenshot.
    "judge_page": {
        "tower_teal":      ("#97E0DD", "#30AEB5", None),  # mast, shafts, collars
        "tower_teal_low":  ("#97E0DD", "#1CA2A1", None),  # lower shaft (darker shadow in art)
        "band_purple":     ("#3E188C", "#3E188C", None),  # pill bands, flat in art
        "band_top":        ("#6F28B4", "#6F28B4", None),  # top face of the SkyPod band
        "band_rim":        ("#8C32CD", "#8C32CD", None),  # rounded top edge of SkyPod band
        "tier_purple":     ("#8C32CD", "#3E188C", None),  # upper deck tier (two-tone in art)
        "deck_dark":       ("#3E188C", "#3E188C", None),  # deck disc top face + underside
        "deck_bright":     ("#9130D5", "#9130D5", None),  # deck disc wall
        "deck_lilac":      ("#CD93F5", "#CD93F5", None),  # lilac stripe on deck disc
        "pod_mint":        ("#91D0CC", "#80CEC8", None),  # main pod
        "pod_rim":         ("#86D9D5", "#86D9D5", None),  # pod underside ring
        "pod_hole":        ("#22898F", "#22898F", None),  # dark opening under pod
        "antenna_glow":    ("#C3FDFF", "#C3FDFF", "#8EFBFF"),  # CHOICE: tip borrowed from cn-tower.svg
    },
    # Zain's pastel palette: #FFFFFF #F3DAFF #E09DFF #00FFDD #BCFEFF #E4FEFF
    "pastel": {
        "tower_teal":      ("#BCFEFF", "#00FFDD", None),
        "tower_teal_low":  ("#BCFEFF", "#00FFDD", None),
        "band_purple":     ("#E09DFF", "#E09DFF", None),
        "band_top":        ("#F3DAFF", "#F3DAFF", None),
        "band_rim":        ("#F3DAFF", "#F3DAFF", None),
        "tier_purple":     ("#F3DAFF", "#E09DFF", None),
        "deck_dark":       ("#E09DFF", "#E09DFF", None),
        "deck_bright":     ("#F3DAFF", "#F3DAFF", None),
        "deck_lilac":      ("#FFFFFF", "#FFFFFF", None),
        "pod_mint":        ("#E4FEFF", "#BCFEFF", None),
        "pod_rim":         ("#FFFFFF", "#FFFFFF", None),
        "pod_hole":        ("#00FFDD", "#00FFDD", None),
        "antenna_glow":    ("#FFFFFF", "#FFFFFF", "#E4FEFF"),
    },
    # Light grey tower, greenish-turquoise accents, one very light pink stripe.
    "grey_turquoise": {
        "tower_teal":      ("#F1F3F5", "#CDD3D9", None),   # mast, shafts, collars
        "tower_teal_low":  ("#F1F3F5", "#CDD3D9", None),
        "band_purple":     ("#00FFDD", "#00D6BA", None),   # pill bands
        "band_top":        ("#7DFFEB", "#7DFFEB", None),
        "band_rim":        ("#7DFFEB", "#7DFFEB", None),
        "tier_purple":     ("#00FFDD", "#00D6BA", None),   # upper deck tier
        "deck_dark":       ("#00D6BA", "#00D6BA", None),   # deck top face + base ring
        "deck_bright":     ("#F1F3F5", "#CDD3D9", None),   # deck wall
        "deck_lilac":      ("#FFF0F6", "#F9DDEA", None),   # the one very light pink stripe
        "pod_mint":        ("#F8F9FA", "#D9DEE3", None),   # main pod
        "pod_rim":         ("#FFFFFF", "#E8ECEF", None),
        "pod_hole":        ("#00D6BA", "#00D6BA", None),
        "antenna_glow":    ("#FFFFFF", "#E8ECEF", None),
    },
}
PALETTE = "grey_turquoise"   # others: "pastel", "judge_page"
MATERIALS = PALETTES[PALETTE]

# --------------------------------------------------------------------------
# Profile (r, y) in screenshot px; y grows DOWNWARD as in the image.
# Each entry: (r, y, material_of_segment_to_next, corner)
#   corner = None     -> smooth vertex (normals shared)
#   corner = "hard"   -> crease (normals split)
#   corner = ("fillet", radius_px[, arc_material]) -> rounded corner
# --------------------------------------------------------------------------
Y_TOP = -95.0      # CHOICE: antenna tip (cropped out of the screenshot)
Y_GROUND = 1464.0  # CHOICE: base (hidden in the art); from real-tower ratios

def lower_shaft():
    """Lower shaft: r 16 at the pod, gentle taper then an outward flare near
    the base, following the curve of the lower shaft in cn-tower.svg."""
    pts = []
    y0, y1 = 552.0, Y_GROUND
    n = 10
    for i in range(n + 1):
        t = i / n
        r = 16.0 + 8.0 * t + 30.0 * t ** 4
        pts.append((r, y0 + (y1 - y0) * t, "tower_teal_low", "hard" if i == n else None))
    return pts

PROFILE = [
    # --- antenna tip (CHOICE: from cn-tower.svg, cropped in screenshot) ---
    (0.0,  Y_TOP,  "antenna_glow", "hard"),
    (2.5,  Y_TOP + 5, "antenna_glow", "hard"),
    (2.5,  -20.0,  "tower_teal", "hard"),           # small ledge out to mast
    # --- upper mast r6, band 1 ---
    (6.2,  -20.0,  "tower_teal", "hard"),
    (6.2,   31.0,  "band_purple", "hard"),
    (12.0,  31.0,  "band_purple", ("fillet", 3.0)),
    (12.0,  41.0,  "band_purple", ("fillet", 1.5)),
    (10.5,  41.0,  "tower_teal", "hard"),
    # --- lower mast r10.5, band 2 ---
    (10.5,  82.0,  "band_purple", "hard"),
    (23.5,  82.0,  "band_purple", ("fillet", 4.0)),
    (23.5,  93.0,  "band_purple", ("fillet", 4.0)),
    (13.5,  93.0,  "tower_teal", "hard"),
    # --- shaft r13.5, light collar ---
    (13.5, 214.0,  "tower_teal", "hard"),
    (23.0, 214.0,  "tower_teal", ("fillet", 3.0)),
    (23.0, 223.0,  "band_top", "hard"),
    # --- SkyPod band (band 3) ---
    (31.5, 223.0,  "band_purple", ("fillet", 4.0, "band_rim")),
    (31.5, 240.0,  "band_purple", ("fillet", 4.0)),
    (17.0, 240.0,  "tower_teal", "hard"),
    # --- upper shaft r17, teal step ---
    (17.0, 424.0,  "tower_teal", "hard"),
    (36.0, 424.0,  "tower_teal", ("fillet", 4.0)),
    (36.0, 447.0,  "tier_purple", "hard"),
    # --- purple tier ---
    (52.0, 447.0,  "tier_purple", ("fillet", 5.0)),
    (52.0, 472.0,  "deck_dark", "hard"),
    # --- deck disc: dark top face, bright wall, lilac stripe, dark base ---
    (74.0, 472.0,  "deck_bright", ("fillet", 5.0, "deck_bright")),
    (74.0, 488.0,  "deck_lilac", "hard"),
    (74.0, 497.0,  "deck_bright", "hard"),
    (74.0, 504.0,  "deck_dark", "hard"),
    (74.0, 515.0,  "deck_dark", ("fillet", 3.0)),
    (66.0, 515.0,  "pod_mint", "hard"),
    # --- main pod (smooth drum, max r71) ---
    (69.0, 519.0,  "pod_mint", None),
    (70.5, 525.0,  "pod_mint", None),
    (71.0, 532.0,  "pod_mint", None),
    (71.0, 540.0,  "pod_mint", None),
    (70.0, 544.5,  "pod_mint", None),
    (68.0, 548.5,  "pod_mint", None),
    (65.0, 552.5,  "pod_mint", None),
    (62.0, 555.2,  "pod_mint", None),
    (60.0, 556.0,  "pod_rim", "hard"),
    # --- underside: rim ring, recessed dark opening ---
    (38.0, 556.0,  "pod_hole", "hard"),
    (38.0, 552.0,  "pod_hole", "hard"),
    (16.0, 552.0,  "tower_teal_low", "hard"),
] + lower_shaft()[1:] + [
    (0.0, Y_GROUND, None, "hard"),                   # closed base cap
]

RADIAL_SEGMENTS = 40       # round silhouette; set to 6 for a faceted (hexagonal) variant
FILLET_STEPS = 3
TARGET_HEIGHT = 10.0

# --------------------------------------------------------------------------
# Profile expansion (fillets -> arcs)
# --------------------------------------------------------------------------
def expand(profile):
    """Return list of (r, y, mat_to_next, hard) with fillets replaced by arcs."""
    out = []
    n = len(profile)
    for i, (r, y, mat, corner) in enumerate(profile):
        if isinstance(corner, tuple) and corner[0] == "fillet":
            rad = corner[1]
            arc_mat = corner[2] if len(corner) > 2 else mat
            pr, py = profile[i - 1][0], profile[i - 1][1]
            nr, ny = profile[i + 1][0], profile[i + 1][1]
            # unit vectors from corner toward prev and next
            ax, ay = pr - r, py - y
            bx, by = nr - r, ny - y
            la, lb = math.hypot(ax, ay), math.hypot(bx, by)
            ax, ay, bx, by = ax / la, ay / la, bx / lb, by / lb
            # corners here are always 90 degrees
            p0 = (r + ax * rad, y + ay * rad)      # tangent point on incoming edge
            p1 = (r + bx * rad, y + by * rad)      # tangent point on outgoing edge
            cx, cy = r + (ax + bx) * rad, y + (ay + by) * rad  # arc centre
            a0 = math.atan2(p0[1] - cy, p0[0] - cx)
            a1 = math.atan2(p1[1] - cy, p1[0] - cx)
            da = a1 - a0
            while da > math.pi:
                da -= 2 * math.pi
            while da < -math.pi:
                da += 2 * math.pi
            # incoming segment keeps the previous material; the arc gets arc_mat
            for k in range(FILLET_STEPS + 1):
                a = a0 + da * k / FILLET_STEPS
                pt = (cx + rad * math.cos(a), cy + rad * math.sin(a))
                m = arc_mat if k < FILLET_STEPS else mat
                out.append((pt[0], pt[1], m, False))
        else:
            out.append((r, y, mat, corner == "hard"))
    return out

def to_scene(pts):
    s = TARGET_HEIGHT / (Y_GROUND - Y_TOP)
    return [(r * s, (Y_GROUND - y) * s, m, h) for (r, y, m, h) in pts], s

# --------------------------------------------------------------------------
# Scene
# --------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def hex_to_linear(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c] + [1.0]

USED = []
for p in PROFILE:
    if p[2] and p[2] not in USED:
        USED.append(p[2])
    c = p[3]
    if isinstance(c, tuple) and len(c) > 2 and c[2] not in USED:
        USED.append(c[2])

mat_index = {}
mats = []
for name in USED:
    lit, shadow, emis = MATERIALS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hex_to_linear(lit)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.0
    if emis:
        bsdf.inputs["Emission Color"].default_value = hex_to_linear(emis)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    m.diffuse_color = hex_to_linear(lit)     # solid-view colour in Blender
    m["lit"] = lit
    m["shadow"] = shadow
    m["style"] = "two-tone"
    mat_index[name] = len(mats)
    mats.append(m)

pts, SCALE = to_scene(expand(PROFILE))

# Build vertex rings; hard points get a duplicated ring so normals split.
ring_ids = []          # per profile point: (ring_for_incoming, ring_for_outgoing)
verts = []
N = RADIAL_SEGMENTS

def add_ring(r, y):
    if r < 1e-9:
        verts.append((0.0, y, 0.0))
        return [len(verts) - 1] * N
    start = len(verts)
    for j in range(N):
        a = 2 * math.pi * j / N
        # Blender is Z-up; build in Y-up and rotate on export (glTF is Y-up).
        verts.append((r * math.cos(a), y, -r * math.sin(a)))
    return list(range(start, start + N))

for (r, y, m, hard) in pts:
    a = add_ring(r, y)
    b = add_ring(r, y) if (hard and r > 1e-9) else a
    ring_ids.append((a, b))

faces, face_mats = [], []
for i in range(len(pts) - 1):
    top = ring_ids[i][1]
    bot = ring_ids[i + 1][0]
    mat = pts[i][2]
    r0, r1 = pts[i][0], pts[i + 1][0]
    y0, y1 = pts[i][1], pts[i + 1][1]
    if abs(r0 - r1) < 1e-9 and abs(y0 - y1) < 1e-9:
        continue
    for j in range(N):
        k = (j + 1) % N
        if r0 < 1e-9:
            f = (top[0], bot[j], bot[k])
        elif r1 < 1e-9:
            f = (top[j], bot[0], top[k])
        else:
            f = (top[j], bot[j], bot[k], top[k])
        faces.append(f)
        face_mats.append(mat_index[mat])

# Y-up -> Blender Z-up: (x, y, z) -> (x, -z, y)
bverts = [(x, -z, y) for (x, y, z) in verts]

mesh = bpy.data.meshes.new("CNTower")
mesh.from_pydata(bverts, [], faces)
mesh.update()
for m in mats:
    mesh.materials.append(m)
for poly, mi in zip(mesh.polygons, face_mats):
    poly.material_index = mi
    poly.use_smooth = True

# Remove unused verts (duplicate apex rings) and make winding outward.
bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v.co.xy.length < 1e-9], dist=1e-9)
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context="VERTS")
bm.normal_update()
# Orientation check on a known outward-facing wall face (widest point).
outward = 0.0
for f in bm.faces:
    c = f.calc_center_median()
    outward += f.normal.dot(c.to_2d().to_3d())
if outward < 0:
    bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
bm.to_mesh(mesh)
bm.free()

obj = bpy.data.objects.new("CNTower", mesh)
scene.collection.objects.link(obj)


# Reference markers useful when animating (exported as glTF nodes/empties).
def marker(name, y_px):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "SPHERE"
    e.empty_display_size = 0.05
    e.location = (0, 0, (Y_GROUND - y_px) * SCALE)
    e.parent = obj
    scene.collection.objects.link(e)
    return e

marker("anchor_tip", Y_TOP)
marker("anchor_skypod", 231.0)
marker("anchor_deck", 510.0)
marker("anchor_base", Y_GROUND)

# Preview camera + light in the .blend only (not exported).
cam_data = bpy.data.cameras.new("PreviewCamera")
cam_data.lens_unit = "FOV"
cam_data.angle = math.radians(35)
cam = bpy.data.objects.new("PreviewCamera", cam_data)
cam.location = (0, -17.5, 4.2)
cam.rotation_euler = (math.radians(90 + 3), 0, 0)
scene.collection.objects.link(cam)
scene.camera = cam
sun = bpy.data.objects.new("PreviewSun", bpy.data.lights.new("PreviewSun", "SUN"))
sun.rotation_euler = (math.radians(90), 0, math.radians(90))  # from camera-right
scene.collection.objects.link(sun)
world = bpy.data.worlds.new("World")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = hex_to_linear("#0A6672")
scene.world = world

os.makedirs(BLEND_DIR, exist_ok=True)
os.makedirs(GLB_DIR, exist_ok=True)
blend_path = os.path.join(BLEND_DIR, "cn-tower.blend")
glb_path = os.path.join(GLB_DIR, "cn-tower.glb")
bpy.context.preferences.filepaths.save_version = 0   # no .blend1 backups
bpy.ops.wm.save_as_mainfile(filepath=blend_path, compress=True)

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
for c in obj.children:
    c.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format="GLB",
    use_selection=True,
    export_extras=True,
    export_yup=True,
    export_apply=True,
    export_normals=True,
    export_texcoords=False,
    export_tangents=False,
    export_cameras=False,
    export_lights=False,
    export_materials="EXPORT",
)

tris = sum(len(p.vertices) - 2 for p in mesh.polygons)
print(f"[cn-tower] verts={len(mesh.vertices)} tris={tris} "
      f"height={TARGET_HEIGHT} units, 1px={SCALE:.5f} units")
print(f"[cn-tower] wrote {blend_path}\n[cn-tower] wrote {glb_path}")
