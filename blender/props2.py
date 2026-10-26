"""Scenery props (original designs): sculpted faceted rocks with moss caps, bushes, a timber-frame cottage, stone wall + wooden fence modules.
Authoring space = game space (x right, y up, -z forward). Exported as assets/models/scenery.glb; the game instances rocks / bushes / walls."""
import bpy, bmesh, math, random, os
from mathutils import Vector
import common as C
from common import Builder, node, piece, material, C4, finalize_and_export

def _mesh_obj(name, bm, mats, parent, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.parent = parent; return ob

def rock(root, name, seed, sx=1.0, sy=0.85, sz=1.0, moss=True, tint=0):
    """faceted boulder: displaced icosphere, flat bottom, face colours by slope + noise (moss on top, dark crevices)."""
    rnd = random.Random(seed); bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=2, radius=1.0)
    ph = [rnd.uniform(0, 6.28) for _ in range(6)]
    for v in bm.verts:
        p = v.co; n = 1.0 + 0.20 * math.sin(p.x * 3.1 + ph[0]) * math.cos(p.z * 2.7 + ph[1]) + 0.12 * math.sin(p.y * 5 + p.x * 4 + ph[2]) + rnd.uniform(-0.05, 0.05)
        v.co = Vector((p.x * n * sx, p.y * n * sy, p.z * n * sz))
        if v.co.y < -0.35 * sy: v.co.y = -0.35 * sy                       # flat base
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    base = [0x9a9ca6, 0x868995, 0xaaaeb8, 0x777b88]; base = [((c >> 16) + tint) << 16 | (((c >> 8) & 255) + tint) << 8 | ((c & 255) + tint) for c in base] if tint else base
    mats = [material(c) for c in base] + [material(0x6fae4a), material(0x4f8a3a), material(0x5a5c68)]
    for f in bm.faces:
        n = f.normal; h = f.calc_center_median()
        r = (math.sin(h.x * 7 + h.z * 5) + 1) / 2
        if moss and n.y > 0.62 and h.y > 0.15: f.material_index = 4 if r > 0.35 else 5
        elif h.y < -0.15 * sy and n.y < 0.2: f.material_index = 6
        else: f.material_index = int(r * 3.99)
    # mesh was authored in Blender-space y-up; convert to game->blender (x,-z,y)
    for v in bm.verts: v.co = C4 @ v.co
    for f in bm.faces: f.smooth = False
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    n = node(name, root); return _mesh_obj(name, bm, mats, n)

def bush(root, name, seed, berries=False, flowers=False):
    rnd = random.Random(seed); b = Builder(); greens = [0x3d8f3a, 0x4aa347, 0x2f7a35, 0x58b04c]
    for i in range(7):
        a = rnd.uniform(0, 6.28); r = rnd.uniform(0.0, 0.55) if i else 0.0; rad = rnd.uniform(0.42, 0.62) * (1.15 if i == 0 else 1)
        b.ico(rad, greens[i % 4], math.cos(a) * r, rad * 0.75 + rnd.uniform(0, 0.25), math.sin(a) * r, 1.0, 0.85, 1.0, 1)
    if berries:
        for i in range(9): a = rnd.uniform(0, 6.28); r = rnd.uniform(0.3, 0.85); b.sph(0.045, 0xd8344a, math.cos(a) * r, rnd.uniform(0.25, 0.8), math.sin(a) * r, seg=6)
    if flowers:
        for i in range(8): a = rnd.uniform(0, 6.28); r = rnd.uniform(0.3, 0.8); b.sph(0.05, 0xffe55a if i % 2 else 0xffffff, math.cos(a) * r, rnd.uniform(0.35, 0.85), math.sin(a) * r, 1, 0.5, 1, 6)
    piece(name, b, root, (0, 0, 0), (0, 0, 0))

def prism(root, name, hw, hh, length, col_main, col_cap=None, y0=0.0, x0=0.0, z0=0.0, mats=None):
    """triangular gable prism running along x: half-width hw (z), height hh, given length; apex at y0+hh."""
    bm = bmesh.new(); L = length / 2
    v = [bm.verts.new(C4 @ Vector(p)) for p in [(x0 - L, y0, z0 - hw), (x0 - L, y0, z0 + hw), (x0 - L, y0 + hh, z0), (x0 + L, y0, z0 - hw), (x0 + L, y0, z0 + hw), (x0 + L, y0 + hh, z0)]]
    for f in ([0, 1, 2], [3, 5, 4], [0, 2, 5, 3], [1, 4, 5, 2], [0, 3, 4, 1]): bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    n = node(name, root); return _mesh_obj(name, bm, [material(col_main)], n)

def cottage(root):
    C.BEVEL = 0.025; r = node('cottage', root); b = Builder(); W, D, H = 6.0, 5.0, 2.7
    plaster, timber, stone, roof, dark = 0xeadfc6, 0x5b3e2b, 0x8e8a84, 0xb4513a, 0x3a2a20
    b.box(W + 0.4, 0.45, D + 0.4, stone, 0, 0.225, 0)
    b.box(W, H, D, plaster, 0, 0.45 + H / 2, 0)
    y0, y1 = 0.45, 0.45 + H
    for sx in (-1, 1):
        for sz in (-1, 1): b.box(0.22, H + 0.05, 0.22, timber, sx * (W / 2), y0 + H / 2, sz * (D / 2))
    for yy in (y0 + 0.1, y0 + H * 0.5, y1 - 0.1):
        for sz in (-1, 1): b.box(W + 0.05, 0.16, 0.1, timber, 0, yy, sz * (D / 2 + 0.02))
        for sx in (-1, 1): b.box(0.1, 0.16, D + 0.05, timber, sx * (W / 2 + 0.02), yy, 0)
    for sx in (-1.9, 0.1, 1.9): b.box(0.14, H * 0.5, 0.1, timber, sx, y0 + H * 0.75, -D / 2 - 0.02)            # upper studs
    for sz in (-1, 1): b.box(0.12, 1.1, 0.1, timber, 1.2, y0 + H * 0.5 + 0.05, sz * (D / 2 + 0.02), 0, 0, 0.7)  # braces
    # door + steps + awning
    b.box(1.1, 2.0, 0.12, 0x6b4630, -1.3, y0 + 1.0, -D / 2 - 0.05); b.box(1.3, 0.14, 0.18, timber, -1.3, y0 + 2.07, -D / 2 - 0.06); b.sph(0.06, 0xd9b44a, -0.95, y0 + 1.0, -D / 2 - 0.13, seg=6)
    b.box(1.6, 0.18, 0.7, stone, -1.3, 0.09, -D / 2 - 0.55); b.box(1.9, 0.12, 0.9, stone, -1.3, 0.06, -D / 2 - 0.45)
    # windows (warm lit glass) with frames + shutters
    for (wx, wz, side) in ((1.5, -D / 2 - 0.03, 0), (-3.03 + 0.0, 0.0, 1), (W / 2 + 0.03, 0.0, 2)):
        if side == 0:
            b.box(1.2, 0.95, 0.1, timber, wx, y0 + 1.5, wz); b.box(1.0, 0.75, 0.12, 0xffd27a, wx, y0 + 1.5, wz - 0.02, glow=True); b.box(0.06, 0.8, 0.14, timber, wx, y0 + 1.5, wz - 0.03); b.box(1.05, 0.06, 0.14, timber, wx, y0 + 1.5, wz - 0.03)
            for s in (-1, 1): b.box(0.38, 0.95, 0.06, 0x4a7a56, wx + s * 0.8, y0 + 1.5, wz - 0.02)
            b.box(1.4, 0.18, 0.35, 0x6b4630, wx, y0 + 0.95, wz - 0.18)
            for i in range(5): b.sph(0.07, (0xff6f91, 0xffd23f, 0xffffff, 0xff6f91, 0xffd23f)[i], wx - 0.5 + i * 0.25, y0 + 1.1, wz - 0.22, seg=6)
        else:
            sg = -1 if side == 1 else 1; b.box(0.1, 0.95, 1.2, timber, sg * (W / 2 + 0.03), y0 + 1.5, 0.3); b.box(0.12, 0.75, 1.0, 0xffd27a, sg * (W / 2 + 0.05), y0 + 1.5, 0.3, glow=True); b.box(0.14, 0.06, 1.05, timber, sg * (W / 2 + 0.06), y0 + 1.5, 0.3)
    # chimney
    b.box(0.8, 3.4, 0.8, stone, 2.2, y1 + 0.9, 1.0); b.box(1.0, 0.18, 1.0, 0x6d6a65, 2.2, y1 + 2.65, 1.0); b.box(0.5, 0.1, 0.5, dark, 2.2, y1 + 2.76, 1.0)
    piece('walls', b, r, (0, 0, 0), (0, 0, 0))
    prism(r, 'gable', D / 2 - 0.0, 1.75, W - 0.02, plaster, y0=y1, x0=0, z0=0)
    prism(r, 'roof', D / 2 + 0.55, 2.25, W + 0.9, roof, y0=y1 - 0.12, x0=0, z0=0)
    rb = Builder()
    rb.box(W + 1.0, 0.16, 0.2, 0x8a3a2a, 0, y1 + 2.15, 0)                                  # ridge cap
    for i in range(7):                                                                        # roof tile rows
        t = (i + 0.6) / 7.6; yy = y1 - 0.12 + 2.25 * t; zz = (D / 2 + 0.55) * (1 - t)
        for s in (-1, 1): rb.box(W + 0.95, 0.06, 0.07, 0x93412e, 0, yy + 0.07, s * zz, s * -0.0 + 0, 0, 0)
    rb.box(W + 1.0, 0.14, 0.14, timber, 0, y1 - 0.1, -(D / 2 + 0.55)); rb.box(W + 1.0, 0.14, 0.14, timber, 0, y1 - 0.1, (D / 2 + 0.55))
    piece('trim', rb, r, (0, 0, 0), (0, 0, 0))
    # garden: planter box, barrel, lantern
    g = Builder(); g.box(1.4, 0.45, 0.5, 0x6b4630, 2.3, 0.22, -D / 2 - 0.8)
    for i in range(6): g.sph(0.14, (0x4aa347, 0xff6f91, 0x4aa347, 0xffd23f, 0x4aa347, 0xffffff)[i], 1.8 + i * 0.2, 0.55, -D / 2 - 0.8, 1, 0.9, 1, 6)
    g.cyl(0.38, 0.8, 0x7a5236, -3.9, 0.4, -D / 2 - 0.1, 'y', 0.34, 10); g.box(0.8, 0.05, 0.05, 0x3a3a40, -3.9, 0.25, -D / 2 - 0.1); g.box(0.8, 0.05, 0.05, 0x3a3a40, -3.9, 0.55, -D / 2 - 0.1)
    g.cyl(0.04, 1.6, dark, -2.7, 0.8, -D / 2 - 0.9, 'y'); g.box(0.2, 0.26, 0.2, 0xffd27a, -2.7, 1.7, -D / 2 - 0.9, glow=True)
    piece('garden', g, r, (0, 0, 0), (0, 0, 0))

def stone_wall(root, name='wall_stone', L=4.0, seed=5):
    C.BEVEL = 0.03; rnd = random.Random(seed); b = Builder(); cols = [0x9a9792, 0x85827d, 0xaaa7a2, 0x7a7873]; x = -L / 2
    for row in range(3):
        x = -L / 2 + (0.0 if row % 2 == 0 else 0.25)
        while x < L / 2 - 0.2:
            w = rnd.uniform(0.45, 0.8); w = min(w, L / 2 - x); h = 0.27 + rnd.uniform(-0.03, 0.04)
            b.box(w - 0.03, h, 0.5 - row * 0.04, cols[rnd.randrange(4)], x + w / 2, 0.15 + row * 0.28 + h / 2 - 0.15, rnd.uniform(-0.02, 0.02), 0, rnd.uniform(-0.05, 0.05), 0); x += w
    for i in range(int(L / 0.7)): b.box(0.62, 0.12, 0.62, 0x6d6b66, -L / 2 + 0.35 + i * 0.7, 0.9, 0, 0, rnd.uniform(-0.1, 0.1), 0)    # cap stones
    b.box(0.4, 1.0, 0.55, 0x8a8782, -L / 2 + 0.2, 0.5, 0); b.box(0.4, 1.0, 0.55, 0x8a8782, L / 2 - 0.2, 0.5, 0)
    for i in range(5): b.sph(0.12, 0x5fa34a, -L / 2 + 0.5 + rnd.uniform(0, L - 1), 0.93, rnd.uniform(-0.15, 0.15), 1.4, 0.4, 1, 6)           # moss tufts
    piece(name, b, root, (0, 0, 0), (0, 0, 0))

def fence(root, name='fence_wood', L=4.0):
    C.BEVEL = 0.02; b = Builder(); wood, dark = 0xb98b5b, 0x8a6240
    for i in range(int(L / 0.5) + 1):
        x = -L / 2 + i * 0.5; b.box(0.16, 1.0, 0.07, wood, x, 0.5, 0); b.cone(0.1, 0.12, wood, x, 1.06, 0, 0, 0, 0, 4)
    for yy in (0.3, 0.72): b.box(L, 0.1, 0.09, dark, 0, yy, 0.07)
    for x in (-L / 2, 0, L / 2): b.box(0.2, 1.2, 0.2, dark, x, 0.6, 0.0)
    piece(name, b, root, (0, 0, 0), (0, 0, 0))

def build_scenery(outdir):
    C.reset(); root = node('scenery')
    rock(root, 'rock_a', 11, 1.0, 0.85, 1.05); rock(root, 'rock_b', 23, 1.25, 0.7, 0.95, tint=-6); rock(root, 'rock_c', 37, 0.8, 1.15, 0.85, moss=False, tint=8)
    bush(root, 'bush_a', 3); bush(root, 'bush_b', 8, berries=True); bush(root, 'bush_c', 15, flowers=True)
    cottage(root); stone_wall(root); fence(root)
    finalize_and_export(root, os.path.join(outdir, 'scenery.glb'))

# ---------------------------------------------------------------------------------------------------- lobby manor (spooky, original)
def manor(root):
    C.BEVEL = 0.03; r = node('manor', root); b = Builder()
    wall, wall2, roof, trim, stone = 0x34314f, 0x2b2944, 0x16132a, 0x4a4770, 0x4b4a58
    wood, dark = 0x2a1c18, 0x100e1c; ORG, GRN, PUR = 0xffa63a, 0x9dff7a, 0xb98cff
    b.box(11.4, 0.8, 7.4, stone, 0, 0.4, 0)                                                       # plinth
    b.box(10, 6.4, 6, wall, 0, 4.0, 0); b.box(10.3, 0.35, 6.3, trim, 0, 7.15, 0); b.box(10.3, 0.3, 6.3, trim, 0, 0.95, 0)
    b.box(3.4, 8.6, 3.4, wall2, -6.4, 5.1, 0.6); b.box(3.7, 0.4, 3.7, trim, -6.4, 9.5, 0.6); b.box(3.7, 0.4, 3.7, trim, -6.4, 3.2, 0.6)     # square tower (left)
    b.cyl(1.7, 10.5, wall, 6.2, 6.0, 0.8, 'y', 1.7, 12); b.cyl(1.95, 0.4, trim, 6.2, 10.9, 0.8, 'y', 1.95, 12); b.cyl(1.95, 0.4, trim, 6.2, 3.4, 0.8, 'y', 1.95, 12)  # round tower (right)
    for i in range(5): b.box(0.45, 0.5, 0.45, trim, -7.9 + i * 0.77, 9.95, -1.0)                      # battlement teeth (front of left tower)
    # windows (arched look: box + cap), lit in different colours
    for i, x in enumerate((-3.4, -1.1, 1.1, 3.4)):
        for yy, c in ((2.9, ORG), (5.4, GRN if i % 2 else ORG)):
            b.box(1.0, 1.7, 0.2, dark, x, yy, -3.04); b.box(0.78, 1.45, 0.22, c, x, yy - 0.03, -3.06, glow=True); b.cone(0.5, 0.45, dark, x, yy + 1.0, -3.04, 0, math.pi / 4, 0, 4)
            b.box(0.06, 1.45, 0.25, dark, x, yy - 0.03, -3.08); b.box(0.8, 0.06, 0.25, dark, x, yy + 0.1, -3.08)
    for yy, c in ((7.2, PUR), (5.0, ORG)): b.box(0.9, 1.5, 0.2, dark, -6.4, yy, -1.15); b.box(0.7, 1.25, 0.22, c, -6.4, yy, -1.17, glow=True)
    b.box(0.8, 1.4, 0.2, dark, 6.2, 8.2, -0.9); b.box(0.6, 1.15, 0.22, PUR, 6.2, 8.2, -0.92, glow=True); b.box(0.8, 1.4, 0.2, dark, 6.2, 5.0, -0.9); b.box(0.6, 1.15, 0.22, ORG, 6.2, 5.0, -0.92, glow=True)
    # porch + arched door
    b.box(3.2, 0.3, 1.8, stone, 0, 0.95, -3.9); b.box(0.35, 3.0, 0.35, trim, -1.4, 2.5, -4.6); b.box(0.35, 3.0, 0.35, trim, 1.4, 2.5, -4.6); b.box(3.5, 0.35, 2.0, roof, 0, 4.15, -4.1)
    b.box(1.7, 2.7, 0.2, wood, 0, 2.4, -3.06); b.cone(0.95, 0.9, wood, 0, 4.0, -3.06, 0, math.pi / 4, 0, 4); b.box(0.9, 2.2, 0.22, ORG, 0, 2.15, -3.08, glow=True); b.sph(0.09, 0xd9b44a, 0.55, 2.3, -3.2, seg=6)
    for i in range(3): b.box(2.2 - i * 0.2, 0.22, 0.5, stone, 0, 0.75 - i * 0.2 + 0.0, -4.9 - i * 0.4)
    # chimneys, weather vane
    b.box(0.9, 3.2, 0.9, stone, -2.4, 9.4, 0.5, 0, 0.0, 0.05); b.box(1.1, 0.25, 1.1, trim, -2.4, 11.0, 0.5, 0, 0, 0.05); b.box(0.8, 2.6, 0.8, stone, 3.0, 9.0, 1.0, 0, 0, -0.04); b.box(1.0, 0.2, 1.0, trim, 3.0, 10.3, 1.0)
    b.cyl(0.05, 2.0, 0x33343c, -6.4, 14.6, 0.6); b.box(1.0, 0.14, 0.05, 0x33343c, -6.4, 15.2, 0.6, 0, 0, 0.0); b.cone(0.2, 0.5, 0x33343c, -5.9, 15.2, 0.6, 0, 0, -math.pi / 2, 4)
    # fence (iron spikes) + gate posts with lanterns
    for i in range(22):
        x = -10.5 + i * 0.96
        if abs(x) < 1.3: continue
        b.box(0.07, 1.5, 0.07, dark, x, 0.75, -8.6); b.cone(0.09, 0.28, dark, x, 1.62, -8.6, 0, 0, 0, 4)
    b.box(21, 0.08, 0.08, dark, 0, 1.1, -8.6); b.box(21, 0.08, 0.08, dark, 0, 0.35, -8.6)
    for s in (-1, 1): b.box(0.5, 2.4, 0.5, stone, s * 1.5, 1.2, -8.6); b.box(0.7, 0.2, 0.7, trim, s * 1.5, 2.5, -8.6); b.box(0.28, 0.36, 0.28, ORG, s * 1.5, 2.8, -8.6, glow=True); b.cone(0.26, 0.28, dark, s * 1.5, 3.1, -8.6, 0, math.pi / 4, 0, 4)
    # gravestones + pumpkins
    for i, (gx, gz) in enumerate(((-4.5, -6.2), (-3.0, -5.6), (4.2, -6.0), (5.6, -5.4))):
        b.box(0.7, 1.0, 0.18, 0x6a6b78, gx, 0.5, gz, 0, 0.2 * (i - 1.5), 0.08 * (i - 1.5)); b.cyl(0.35, 0.18, 0x6a6b78, gx, 1.0, gz, 'z', 0.35, 8)
    for px, pz, ps_ in ((-1.9, -5.4, 0.42), (1.8, -5.6, 0.36), (2.6, -5.0, 0.26)):
        b.sph(ps_, 0xf08a1c, px, ps_ * 0.85 + 0.2, pz, 1.2, 0.9, 1.0, 10); b.cyl(0.06, 0.2, 0x3a5a2a, px, ps_ * 1.7 + 0.25, pz)
        b.box(ps_ * 0.28, ps_ * 0.28, 0.06, 0xffe08a, px - ps_ * 0.3, ps_ * 0.95 + 0.2, pz - ps_ * 0.95, 0, 0, 0.0, glow=True); b.box(ps_ * 0.28, ps_ * 0.28, 0.06, 0xffe08a, px + ps_ * 0.3, ps_ * 0.95 + 0.2, pz - ps_ * 0.95, glow=True)
        b.box(ps_ * 0.7, ps_ * 0.14, 0.06, 0xffe08a, px, ps_ * 0.55 + 0.2, pz - ps_ * 1.0, glow=True)
    piece('hall', b, r, (0, 0, 0), (0, 0, 0))
    # roofs (prisms / cones)
    prism(r, 'roof_main', 3.7, 4.2, 10.8, roof, y0=7.2, x0=0, z0=0)
    rb = Builder()
    rb.cone(2.6, 5.0, roof, -6.4, 12.5, 0.6, 0, math.pi / 4, 0, 4); rb.cone(2.35, 4.4, roof, 6.2, 13.2, 0.8, 0, 0, 0, 12)
    for i in range(6): rb.box(10.9, 0.1, 0.14, 0x231e3c, 0, 7.2 + 0.4 + i * 0.62, -3.5 + i * 0.58 + 0.0, 0.0, 0, 0)
    rb.cone(0.45, 1.3, roof, -2.4, 12.1, 0.5, 0, 0, 0, 6)
    piece('roofs', rb, r, (0, 0, 0), (0, 0, 0))
    # dead trees
    d = Builder()
    for tx, tz, s in ((-12.5, -3.0, 1.2), (12.2, -2.0, 1.4), (-9.0, -9.5, 0.9)):
        d.cyl(0.35 * s, 5.0 * s, 0x1b1520, tx, 2.5 * s, tz, 'y', 0.18 * s, 7)
        for k, (a, l) in enumerate(((0.9, 2.6), (-0.8, 2.2), (0.5, 1.8), (-0.4, 1.5))):
            d.cyl(0.12 * s, l * s, 0x1b1520, tx + math.sin(a) * l * 0.45 * s, (3.0 + k * 0.55) * s + l * 0.35 * s, tz, 'y', 0.04 * s, 5)
            d.box(0.001, 0.001, 0.001, 0x1b1520, tx, 0, tz)
    piece('dead', d, r, (0, 0, 0), (0, 0, 0))

def build_manor(outdir):
    C.reset(); root = node('manor_root'); manor(root); finalize_and_export(root, os.path.join(outdir, 'manor.glb'))
