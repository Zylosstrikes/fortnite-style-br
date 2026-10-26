"""Builds the weapon / pickaxe / character / glider / bus models from the JSON specs recorded by tools/dump_specs.py."""
import bpy, bmesh, json, math, os
from mathutils import Vector, Matrix
import common as C
from common import Builder, node, piece, material, hexrgb, C4, finalize_and_export

HERE = os.path.dirname(os.path.abspath(__file__))
SPECS = os.path.join(HERE, 'specs')
def load(name): return json.load(open(os.path.join(SPECS, name + '.json')))
SENT = load('sentinels')

def role_for(col, roles):
    return roles.get(col, col)

def fill(b, parts, roles):
    for p in parts:
        col = role_for(p['col'], roles); g = p['glow'] or col == 'rarity'
        k = p['k']; x, y, z = p['x'], p['y'], p['z']
        if k == 'box': b.box(p['sx'], p['sy'], p['sz'], col, x, y, z, p['rx'], p['ry'], p['rz'], g)
        elif k == 'cyl':
            # axis encoded in rotation: JS cylinders are y-aligned geometry with rx/rz set for z/x axes
            b._add('cyl', col, g, C.trs(x, y, z, p['sx'], p['sy'], p['sz'], p['rx'], p['ry'], p['rz']), False, p['seg'] or 8, p['a'])
        elif k == 'sph': b._add('sph', col, g, C.trs(x, y, z, p['sx'], p['sy'], p['sz'], p['rx'], p['ry'], p['rz']), True, p['seg'] or 10)
        elif k == 'cone': b._add('cone', col, g, C.trs(x, y, z, p['sx'], p['sy'], p['sz'], p['rx'], p['ry'], p['rz']), False, p['seg'] or 8)
        elif k == 'ico': b._add('ico', col, g, C.trs(x, y, z, p['sx'], p['sy'], p['sz'], p['rx'], p['ry'], p['rz']), False, p['a'])
        elif k == 'torus': b.add_torus(p['a'], p['b'], col, x, y, z, p['sx'], p['sy'], p['sz'], p['rx'], p['ry'], p['rz'], p['c'], g)
    return b

def export(root, outdir, name):
    finalize_and_export(root, os.path.join(outdir, name + '.glb'))

# ------------------------------------------------------------------ weapons + pickaxes in ONE file
def build_weapons(outdir):
    C.reset(); C.BEVEL = 0.012; C.ROLE_DEFAULT['rarity'] = 0xc0c0c0
    root = node('weapons')
    roles = {SENT['rarity']: 'rarity'}
    for n in ['w_pistol', 'w_dual', 'w_shotgun', 'w_ar', 'w_smg', 'w_sniper', 'w_rocket', 'p_pick', 'p_axe', 'p_shovel', 'p_sickle', 'p_hammer']:
        spec = load(n)[0]
        b = fill(Builder(), spec, roles)
        piece(n, b, root, (0, 0, 0), (0, 0, 0))
    export(root, outdir, 'weapons')

# ------------------------------------------------------------------ characters (one glb per outfit)
def build_character(outdir, cid, S):
    C.reset(); C.BEVEL = 0   # characters are drawn many times per frame: no bevel, smooth spheres/limbs only
    d = S['defaults']; roles = {SENT['sent']['tone']: 'skin', SENT['sent']['shirt']: 'top', SENT['sent']['acc']: 'top2', SENT['sent']['pants']: 'pants', SENT['sent']['hairC']: 'hair'}
    C.ROLE_DEFAULT.update({'skin': d['skin'], 'top': d['top'], 'top2': d['top2'], 'pants': d['pants'], 'hair': d['hair']})
    root = node('char_' + cid)
    piece('torso', fill(Builder(), S['torso'], roles), root, (0, 0, 0), (0, 0, 0))
    piece('head', fill(Builder(), S['head'], roles), root, (0, 1.76, 0), (0, 0, 0))
    for i, side in enumerate(('L', 'R')):
        s = -1 if i == 0 else 1
        arm = piece('arm_' + side, fill(Builder(), S['uarm'][i], roles), root, (s * 0.46, 1.4, 0), (s * 0.46, 1.4, 0))
        piece('forearm_' + side, fill(Builder(), S['farm'][i], roles), arm, (0, -0.4, 0), (s * 0.46, 1.0, 0))
        leg = piece('leg_' + side, fill(Builder(), S['thigh'][i], roles), root, (s * 0.17, 0.84, 0), (s * 0.17, 0.84, 0))
        piece('shin_' + side, fill(Builder(), S['shin'][i], roles), leg, (0, -0.42, 0), (s * 0.17, 0.42, 0))
    export(root, outdir, 'char_' + cid)

def build_characters(outdir):
    for cid, S in load('chars').items():
        build_character(outdir, cid, S)

# ------------------------------------------------------------------ helpers for lathed / gored surfaces
def gored_mesh(name, parent, rows, cols, pos_fn, gore_fn, mats, smooth=True, double=False, center=(0, 0, 0)):
    """rows x cols parametric grid (cols wrap) -> mesh object; pos_fn(i,j)->(x,y,z) game space; gore_fn(i,j)->material slot index."""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    V = [[bm.verts.new(C4 @ Vector(pos_fn(i, j))) for j in range(cols)] for i in range(rows + 1)]
    for m in mats: me.materials.append(m)
    for i in range(rows):
        for j in range(cols):
            vs = [V[i][j], V[i + 1][j], V[i + 1][(j + 1) % cols], V[i][(j + 1) % cols]]
            try:
                f = bm.faces.new(vs)
            except ValueError:
                continue
            f.material_index = gore_fn(i, j); f.smooth = smooth
    bm.normal_update()
    # orient faces outward (away from the object's centroid)
    cen = C4 @ Vector(center)
    for f in bm.faces:
        if (f.calc_center_median() - cen).dot(f.normal) < 0: f.normal_flip()
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.parent = parent
    if double:
        for m in mats: m.use_backface_culling = False
    return ob

# ------------------------------------------------------------------ umbrella glider
def build_glider(outdir):
    C.reset(); C.BEVEL = 0.012; C.ROLE_DEFAULT['tint'] = 0xff5a5a
    root = node('glider')
    spec = load('glider')[0]
    b = fill(Builder(), spec, {SENT['glider']: 'tint'})
    piece('glider_frame', b, root, (0, 0, 0), (0, 0, 0))
    N, R = 8, 2.5; ROWS, COLS = 9, 32; TH = math.pi * 0.46
    def pos(i, j):
        th = TH * i / ROWS; ph = 2 * math.pi * j / COLS
        x = -R * math.cos(ph) * math.sin(th); y = R * math.cos(th); z = R * math.sin(ph) * math.sin(th)
        a = math.atan2(z, x); phs = (a + math.pi) / (2 * math.pi) * N; fr = phs - math.floor(phs); rim = 1 - y / R
        scal = abs(fr - 0.5) * 2; scal = scal ** 2.2; k = 1 - 0.07 * scal * min(1, rim * 3)
        return (x * k, y * 0.5 - 0.14 * scal * min(1, rim * 2) + 3.15, z * k)
    def gore(i, j):
        x, y, z = pos(i, j); a = math.atan2(z, x); return int(math.floor((a + math.pi) / (2 * math.pi) * N)) % 2
    n = node('glider_canopy', root)
    gored_mesh('glider_canopy_mesh', n, ROWS, COLS, pos, gore, [material('tint'), material(0xffffff)], True, True, (0, 1.2, 0))
    export(root, outdir, 'glider')

# ------------------------------------------------------------------ battle bus + hot-air balloon
def build_bus(outdir):
    C.reset(); C.BEVEL = 0.03
    root = node('bus')
    sp = load('bus')
    piece('bus_body', fill(Builder(), sp[0], {}), root, (0, 0, 0), (0, 0, 0))
    piece('bus_prop', fill(Builder(), sp[1], {}), root, (0, 0.2, 5.6), (0, 0, 0))   # spinner: pivot at the nose
    piece('balloon_rig', fill(Builder(), sp[2], {}), root, (0, 0, 0), (0, 0, 0))
    N, R = 12, 7.4; ROWS, COLS = 20, 36
    pal = [material(0xff5a5a), material(0xffd83a), material(0x3fa0ff), material(0xffffff)]
    def pos(i, j):
        th = math.pi * i / ROWS; ph = 2 * math.pi * j / COLS
        x = -R * math.cos(ph) * math.sin(th); y = R * math.cos(th); z = R * math.sin(ph) * math.sin(th)
        a = math.atan2(z, x); phs = (a + math.pi) / (2 * math.pi) * N; fr = phs - math.floor(phs); v = y / R
        sc = 1 - 0.035 * (abs(fr - 0.5) * 2) ** 2 * (1 if v < 0.4 else 0.4); x *= sc; z *= sc
        if v < -0.55:
            k = max(0.3, 1 - (-0.55 - v) * 0.9); x *= k; z *= k
        return (x, y * 1.18 + 14.4, z + 0.6)
    def gore(i, j):
        x, y, z = pos(i, j); yy = (y - 14.4) / 1.18; v = yy / R; a = math.atan2(z - 0.6, x)
        g = int(math.floor((a + math.pi) / (2 * math.pi) * N)); c = g % 3
        if v > 0.82 or abs(v - 0.05) < 0.05: c = 3
        return c
    n = node('balloon', root)
    gored_mesh('balloon_mesh', n, ROWS, COLS, pos, gore, pal, True, False, (0, 14.4, 0.6))
    export(root, outdir, 'bus')
