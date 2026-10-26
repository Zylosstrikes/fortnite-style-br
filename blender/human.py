"""Stylised human characters (realistic-ish proportions, smooth sculpted shapes, layered clothing) built in Blender.
Original generic designs - no real people, no logos or text.  Authoring space = game space (x right, y up, -z forward, feet at y=0).
Segment nodes follow the game's rig contract (pivots are baked in js/models3.js): torso, head, arm_L/R -> forearm_L/R, leg_L/R -> shin_L/R."""
import bpy, bmesh, math, json, os
from mathutils import Vector, Matrix
import common as C
from common import Builder, node, piece, material, C4, finalize_and_export

HERE = os.path.dirname(os.path.abspath(__file__))
SH_X, HIP_X = 0.29, 0.12            # shoulder / hip pivot half-widths (game reads the same numbers from the glb loader)
SH_Y, EL_Y, HIP_Y, KN_Y, HEAD_Y = 1.4, 1.0, 0.84, 0.42, 1.76

def sgn(v): return 1.0 if v >= 0 else -1.0

def loft(name, mat, secs, parent, shift, N=18, sub=1, cap=True, n=2.0, glow=False):
    """secs: [(y, rx, rz, cx, cz)] game-space elliptical rings (superellipse exponent n) -> smooth closed mesh under `parent`."""
    bm = bmesh.new(); rings = []
    sx, sy, sz = shift
    for (y, rx, rz, cx, cz) in secs:
        r = []
        for i in range(N):
            a = 2 * math.pi * i / N; c, s = math.cos(a), math.sin(a)
            x = cx + rx * sgn(c) * abs(c) ** (2 / n); z = cz + rz * sgn(s) * abs(s) ** (2 / n)
            r.append(bm.verts.new(C4 @ Vector((x - sx, y - sy, z - sz))))
        rings.append(r)
    for k in range(len(rings) - 1):
        for i in range(N):
            bm.faces.new((rings[k][i], rings[k][(i + 1) % N], rings[k + 1][(i + 1) % N], rings[k + 1][i]))
    if cap:
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    me.materials.append(material(mat, glow))
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.parent = parent
    if sub:
        m = ob.modifiers.new('sub', 'SUBSURF'); m.levels = sub; m.render_levels = sub
    return ob

def tube(name, mat, y0, y1, r0, r1, parent, shift, cx=0, cz=0, rz_k=1.0, sub=1, mid=None, N=14):
    secs = [(y0, r0, r0 * rz_k, cx, cz)]
    if mid: secs.append((mid[0], mid[1], mid[1] * rz_k, cx, cz))
    secs.append((y1, r1, r1 * rz_k, cx, cz)); return loft(name, mat, secs, parent, shift, N=N, sub=sub)

class Out:
    """per-segment node + shift + a Builder for primitive details."""
    def __init__(s, name, parent, pos, shift):
        s.n = node(name, parent, pos); s.shift = shift; s.b = Builder(); s.name = name
    def loft(s, name, mat, secs, **k): return loft(s.name + '_' + name, mat, secs, s.n, s.shift, **k)
    def tube(s, name, mat, y0, y1, r0, r1, **k): return tube(s.name + '_' + name, mat, y0, y1, r0, r1, s.n, s.shift, **k)
    def done(s):
        if s.b.parts: s.b.bake(s.name + '_d', s.n, shift=s.shift)

def mirror_x(secs_fn, side): return secs_fn(side)

# ----------------------------------------------------------------------------------------------------------- head
def build_head(S, cfg, O):
    h = Out('head', S['root'], (0, HEAD_Y, 0), (0, 0, 0)); b = h.b   # head parts are authored head-local
    robot = cfg.get('robot')
    skin = 'skin' if not robot else 0xdfe6f2
    # skull + jaw (superellipse rings: slightly squared, stylised)
    h.loft('skull', skin, [(-0.150, 0.040, 0.050, 0, -0.045), (-0.125, 0.075, 0.075, 0, -0.04), (-0.075, 0.102, 0.098, 0, -0.012), (0.0, 0.118, 0.118, 0, 0.0),
                           (0.085, 0.120, 0.122, 0, 0.004), (0.135, 0.100, 0.104, 0, 0.004), (0.165, 0.052, 0.058, 0, 0.004)], sub=2, N=20, n=2.3)
    h.tube('neck', skin, -0.30, -0.10, 0.058, 0.056, cz=0.012, sub=0)
    if not robot:
        for s in (-1, 1):
            b.sph(0.034, 'skin', s * 0.122, -0.01, 0.01, 0.55, 1.05, 0.8, 8)                     # ears
            b.sph(0.021, 0xffffff, s * 0.047, 0.018, -0.111, 1.0, 0.7, 0.5, 8)                  # eye whites
            b.sph(0.0125, 0x2f3a4a if cfg.get('eye') is None else cfg['eye'], s * 0.047, 0.016, -0.1285, 1, 1, 0.5, 8)
            b.sph(0.0055, 0x0b0b10, s * 0.047, 0.016, -0.1335, 1, 1, 0.4, 6)
            b.box(0.052, 0.011, 0.014, 'hair', s * 0.047, 0.060, -0.112, 0, 0, s * -0.1)         # brows
        b.sph(0.021, 'skin', 0, -0.025, -0.122, 0.9, 1.15, 1.0, 8); b.box(0.014, 0.05, 0.02, 'skin', 0, -0.005, -0.118)   # nose
        b.box(0.056, 0.010, 0.012, 0xb4605a, 0, -0.077, -0.111); b.box(0.04, 0.008, 0.01, 0xa04c48, 0, -0.092, -0.108)     # lips
        b.sph(0.026, 'skin', 0, -0.130, -0.075, 1.5, 0.6, 1.0, 8)                                                          # chin
    else:
        b.box(0.20, 0.07, 0.03, 0x1d2530, 0, 0.02, -0.118); b.box(0.045, 0.045, 0.012, 0x3fd0ff, -0.045, 0.02, -0.137, glow=True); b.box(0.045, 0.045, 0.012, 0x3fd0ff, 0.045, 0.02, -0.137, glow=True)
        b.box(0.07, 0.012, 0.012, 0x3fd0ff, 0, -0.06, -0.12, glow=True); b.cyl(0.006, 0.08, 0x8a929e, 0, 0.21, 0.0); b.sph(0.018, 0xff4f4f, 0, 0.255, 0, glow=True)
    hs, hc = cfg.get('hair', 'short'), 'hair'
    hk = cfg.get('head'); HC = cfg.get('headC', 0x888888)
    if hs == 'short' and hk not in ('helmet', 'hood', 'knight', 'dino', 'cowboy'):
        h.loft('hair', hc, [(0.0, 0.123, 0.124, 0, 0.004), (0.06, 0.128, 0.130, 0, 0.006), (0.115, 0.116, 0.120, 0, 0.004), (0.158, 0.080, 0.088, 0, 0.0), (0.178, 0.030, 0.035, 0, -0.004)], sub=1, N=20, n=2.3)
        for i in range(5): b.cone(0.022, 0.05, hc, -0.06 + i * 0.03, 0.135, -0.105, -1.0, 0, 0, 5)           # fringe tufts
        for i in range(7): a = i / 7 * math.pi * 2; b.cone(0.016, 0.035, hc, math.cos(a) * 0.07, 0.172, math.sin(a) * 0.07, math.sin(a) * 0.5, 0, -math.cos(a) * 0.5, 5)
    elif hs == 'spiky':
        h.loft('hair', hc, [(0.0, 0.123, 0.124, 0, 0.004), (0.07, 0.128, 0.130, 0, 0.006), (0.13, 0.105, 0.11, 0, 0.0), (0.175, 0.04, 0.045, 0, 0.0)], sub=1, N=18)
        for i in range(8): a = i / 8 * math.pi * 2; b.cone(0.03, 0.14, hc, math.cos(a) * 0.075, 0.2, math.sin(a) * 0.075, math.sin(a) * 0.7, 0, -math.cos(a) * 0.7, 5)
        b.cone(0.035, 0.17, hc, 0, 0.23, 0, 0, 0, 0, 5)
    elif hs == 'mohawk':
        for i in range(7): b.box(0.03, 0.09 + 0.07 * math.sin(i / 6 * math.pi), 0.06, hc, 0, 0.16 + 0.03 * math.sin(i / 6 * math.pi), -0.1 + i * 0.045)
    # headgear
    z0 = 0.004
    if hk == 'cap':
        h.loft('cap', HC, [(0.045, 0.128, 0.130, 0, z0), (0.10, 0.130, 0.132, 0, z0), (0.15, 0.10, 0.104, 0, z0), (0.19, 0.04, 0.045, 0, z0)], sub=1, N=20)
        b.box(0.17, 0.014, 0.14, HC, 0, 0.055, -0.19, 0.12, 0, 0)
    elif hk == 'beanie':
        h.loft('beanie', HC, [(0.05, 0.128, 0.13, 0, z0), (0.11, 0.126, 0.128, 0, z0), (0.17, 0.095, 0.10, 0, z0), (0.215, 0.04, 0.045, 0, z0)], sub=1, N=18)
        b.cyl(0.133, 0.045, 'top2', 0, 0.06, z0, 'y', 0.133, 18); b.sph(0.04, 0xffffff, 0, 0.235, 0, seg=8)
    elif hk == 'helmet':
        h.loft('helmet', HC, [(0.0, 0.14, 0.145, 0, z0), (0.07, 0.148, 0.152, 0, z0), (0.14, 0.125, 0.13, 0, z0), (0.2, 0.06, 0.065, 0, z0)], sub=1, N=20)
        b.box(0.05, 0.03, 0.30, 'top2', 0, 0.2, 0.0); b.box(0.2, 0.025, 0.04, 0x23262c, 0, 0.075, -0.15)
    elif hk == 'hood':
        h.loft('hood', HC, [(-0.10, 0.13, 0.15, 0, 0.03), (0.0, 0.15, 0.17, 0, 0.035), (0.09, 0.145, 0.16, 0, 0.03), (0.17, 0.09, 0.11, 0, 0.02), (0.205, 0.035, 0.05, 0, 0.0)], sub=1, N=20)
        b.cone(0.05, 0.14, HC, 0, 0.12, 0.17, 0.9, 0, 0, 6)
    elif hk == 'sunhat':
        b.cyl(0.24, 0.016, HC, 0, 0.085, 0, 'y', 0.24, 20); h.loft('crown', HC, [(0.085, 0.13, 0.13, 0, 0), (0.12, 0.125, 0.125, 0, 0), (0.17, 0.09, 0.09, 0, 0)], sub=1, N=18); b.cyl(0.133, 0.03, 0xff4f4f, 0, 0.1, 0, 'y', 0.133, 18)
    elif hk == 'cowboy':
        b.cyl(0.22, 0.014, HC, 0, 0.09, 0, 'y', 0.22, 20); b.box(0.28, 0.014, 0.08, HC, 0, 0.115, -0.2, -0.25, 0, 0); h.loft('crown', HC, [(0.09, 0.115, 0.125, 0, 0), (0.17, 0.11, 0.12, 0, 0), (0.235, 0.085, 0.10, 0, 0)], sub=1, N=18); b.cyl(0.12, 0.03, 0x4a2a14, 0, 0.11, 0, 'y', 0.12, 18)
    elif hk == 'knight':
        h.loft('helm', HC, [(-0.1, 0.12, 0.125, 0, 0), (0.0, 0.14, 0.145, 0, 0), (0.09, 0.142, 0.148, 0, 0), (0.16, 0.10, 0.105, 0, 0), (0.2, 0.04, 0.045, 0, 0)], sub=1, N=20)
        b.box(0.20, 0.025, 0.03, 0x23262c, 0, 0.02, -0.14); b.box(0.025, 0.1, 0.03, 0x23262c, 0, -0.03, -0.14)
        for i in range(5): b.cone(0.022, 0.1 - abs(i - 2) * 0.012, 0xe03a3a, 0, 0.22, -0.07 + i * 0.035, -0.2 + i * 0.1, 0, 0, 5)
    elif hk == 'dino':
        h.loft('dino', HC, [(-0.1, 0.13, 0.14, 0, 0.02), (0.0, 0.15, 0.16, 0, 0.02), (0.1, 0.14, 0.15, 0, 0.02), (0.17, 0.08, 0.09, 0, 0.0)], sub=1, N=18)
        for i in range(5): b.cone(0.03, 0.09 - i * 0.008, 'top2', 0, 0.17 - i * 0.025, -0.04 + i * 0.05, 0, 0, 0, 5)
        for s in (-1, 1): b.sph(0.03, 0xffffff, s * 0.07, 0.15, -0.1, seg=8); b.sph(0.014, 0x1a1a22, s * 0.07, 0.15, -0.126, seg=6)
    elif hk == 'goggles':
        b.box(0.28, 0.025, 0.25, 0x23262c, 0, 0.09, 0.0)
        for s in (-1, 1): b.cyl(0.04, 0.025, 0x23262c, s * 0.058, 0.09, -0.125, 'z'); b.cyl(0.03, 0.01, 0xff9a1a, s * 0.058, 0.09, -0.14, 'z', 0.03, 10, glow=True)
    if cfg.get('mask'):
        mc = cfg['mask']; b.box(0.19, 0.075, 0.05, mc, 0, -0.07, -0.105); b.box(0.2, 0.02, 0.2, mc, 0, -0.03, -0.0)
    gl = cfg.get('glasses')
    if gl == 'shades': b.box(0.17, 0.032, 0.02, 0x14161b, 0, 0.02, -0.125); b.box(0.24, 0.012, 0.02, 0x14161b, 0, 0.03, 0.0)
    elif gl == 'visor': b.box(0.19, 0.04, 0.025, 0x1d2530, 0, 0.02, -0.122); b.box(0.17, 0.022, 0.012, 0x35e0ff, 0, 0.02, -0.14, glow=True)
    elif gl == 'round':
        for s in (-1, 1): b.cyl(0.04, 0.01, 0x14161b, s * 0.052, 0.018, -0.128, 'z'); b.cyl(0.032, 0.006, 0x9fe0ff, s * 0.052, 0.018, -0.136, 'z')
    h.done()

# ----------------------------------------------------------------------------------------------------------- torso
def build_torso(S, cfg, O):
    t = Out('torso', S['root'], (0, 0, 0), (0, 0, 0)); b = t.b; st = cfg['top']
    robot = cfg.get('robot'); sk = 'skin' if not robot else 0xdfe6f2
    tee = cfg.get('tee', 'top')
    # body (skin) from hips to neck; covered by clothes but keeps the silhouette smooth where it shows (neck, collar)
    t.loft('body', sk, [(0.86, 0.185, 0.115, 0, 0), (1.05, 0.172, 0.108, 0, 0), (1.22, 0.215, 0.12, 0, 0), (1.38, 0.268, 0.13, 0, 0.0), (1.47, 0.225, 0.115, 0, 0.0), (1.52, 0.13, 0.09, 0, 0.01), (1.58, 0.07, 0.065, 0, 0.012)], sub=1)
    if st in ('hoodie', 'jacket', 'parka'):
        k = {'hoodie': 0.02, 'jacket': 0.016, 'parka': 0.034}[st]
        t.loft('jacket', 'top', [(0.86, 0.185 + k, 0.115 + k, 0, 0), (1.05, 0.172 + k, 0.108 + k, 0, 0), (1.22, 0.215 + k, 0.12 + k, 0, 0), (1.38, 0.269 + k, 0.133 + k, 0, 0), (1.47, 0.226 + k, 0.117 + k, 0, 0.0), (1.53, 0.125, 0.095, 0, 0.01)], sub=1)
        hem = cfg.get('hem', 'top2'); t.loft('hem', hem, [(0.84, 0.19 + k, 0.12 + k, 0, 0), (0.93, 0.19 + k, 0.12 + k, 0, 0)], sub=0, N=20)
        zk = 0.115 + k + 0.002
        if st == 'hoodie':   # open zip: plain tee panel between two zip tapes + dark inner shadow
            b.box(0.14, 0.58, 0.012, tee if tee != 'top' else 0xf4f4f4, 0, 1.20, -zk, 0, 0, 0)
            for s in (-1, 1): b.box(0.018, 0.60, 0.016, 'top2', s * 0.078, 1.20, -zk - 0.004)
            b.box(0.02, 0.07, 0.02, 0xb8bec8, -0.078, 0.96, -zk - 0.008)   # zip pull
            t.loft('collar', 'top', [(1.46, 0.135, 0.11, 0, 0.0), (1.56, 0.12, 0.105, 0, 0.012)], sub=1)
            t.loft('hoodback', 'top', [(1.40, 0.19, 0.06, 0, 0.12), (1.52, 0.17, 0.09, 0, 0.1), (1.62, 0.12, 0.11, 0, 0.09)], sub=1)
        else:
            b.box(0.02, 0.62, 0.016, 'top2', 0, 1.17, -zk - 0.004)
            t.loft('collar', 'top2', [(1.50, 0.12, 0.10, 0, 0.0), (1.585, 0.098, 0.088, 0, 0.012)], sub=1)
        # side stripes
        for s in (-1, 1):
            if cfg.get('stripes'): b.box(0.012, 0.5, 0.03, 'top2', s * (0.19 + k), 1.12, 0.0, 0, 0, 0)
        # pockets
        if st == 'hoodie': 
            for s in (-1, 1): b.box(0.10, 0.012, 0.05, 'top', s * 0.12, 0.97, -zk + 0.005, 0.0, 0, s * 0.45)
    else:  # tee / vest
        k = 0.012
        t.loft('tee', 'top' if tee == 'top' else tee, [(0.88, 0.19 + k, 0.12 + k, 0, 0), (1.05, 0.176 + k, 0.112 + k, 0, 0), (1.22, 0.218 + k, 0.124 + k, 0, 0), (1.38, 0.27 + k, 0.134 + k, 0, 0), (1.47, 0.226 + k, 0.117 + k, 0, 0), (1.52, 0.125, 0.10, 0, 0.01)], sub=1)
        t.loft('neckline', 'top2' if cfg.get('trim') else 'top', [(1.50, 0.105, 0.088, 0, 0.0), (1.555, 0.09, 0.08, 0, 0.012)], sub=0)
    if cfg.get('plates'):
        for s in (-1, 1): b.sph(0.11, 'top', s * 0.27, 1.44, 0, 1, 0.7, 1.1, 10); b.box(0.12, 0.025, 0.12, 'top2', s * 0.27, 1.5, 0)
        b.box(0.30, 0.34, 0.04, 0xdfe6ee, 0, 1.25, -0.145)
    # belt + pants hips
    pk = cfg.get('pants', 'cargo'); pcol = 'pants'
    t.loft('hips', pcol, [(0.80, 0.19, 0.125, 0, 0), (0.92, 0.195, 0.125, 0, 0), (1.04, 0.178, 0.112, 0, 0)], sub=1)
    b.box(0.36, 0.035, 0.24, 0x1c1e25, 0, 1.03, 0.0)
    if pk == 'jeans': b.box(0.05, 0.03, 0.01, 0xd8b45a, 0, 1.03, -0.122)
    if cfg.get('chain'):
        pts = []
        for i in range(15):
            u = i / 14; x = -0.075 + 0.15 * u; yy = 1.545 - 0.28 * math.sin(math.pi * u) ** 0.8 * 1.0; zz = -0.115 - 0.05 * math.sin(math.pi * u)
            b.sph(0.0085, 0xc9ced8, x, yy, zz, seg=5)
        b.box(0.036, 0.062, 0.008, 0xa7adb8, 0, 1.285, -0.168, 0.1, 0, 0); b.cyl(0.012, 0.008, 0xa7adb8, 0, 1.325, -0.162, 'z')
    # backpack
    pt, pc = cfg.get('packT'), cfg.get('pack', 0x7a6a30)
    if pt == 'round': b.sph(0.17, pc, 0, 1.27, 0.2, 1, 1.15, 0.8, 12); b.box(0.22, 0.09, 0.07, 0x23262c, 0, 1.12, 0.31)
    elif pt == 'box': b.box(0.32, 0.4, 0.15, pc, 0, 1.27, 0.2); b.box(0.26, 0.15, 0.04, 0x23262c, 0, 1.15, 0.285); b.box(0.06, 0.38, 0.17, 'top2', 0.09, 1.27, 0.2)
    elif pt == 'cape': b.box(0.5, 0.74, 0.03, pc, 0, 1.06, 0.15, 0.08, 0, 0); b.box(0.54, 0.06, 0.05, 0xffc83a, 0, 1.44, 0.14, glow=True)
    elif pt == 'roll': b.box(0.34, 0.32, 0.12, pc, 0, 1.25, 0.18); b.cyl(0.085, 0.36, 0xd9c9a0, 0, 1.43, 0.18, 'x')
    if cfg.get('robot'): b.box(0.22, 0.12, 0.02, 0x3fd0ff, 0, 1.28, -0.152, glow=True)
    t.done()

# ----------------------------------------------------------------------------------------------------------- arms
def build_arms(S, cfg, O):
    st = cfg['top']; robot = cfg.get('robot'); sk = 'skin' if not robot else 0xdfe6f2
    long_sleeve = st in ('hoodie', 'jacket', 'parka')
    for i, side in enumerate(('L', 'R')):
        s = -1 if i == 0 else 1; X = s * SH_X
        a = Out('arm_' + side, S['root'], (X, SH_Y, 0), (X, SH_Y, 0)); b = a.b
        f = Out('forearm_' + side, a.n, (0, EL_Y - SH_Y, 0), (X, EL_Y, 0)); fb = f.b
        a.tube('skin', sk, 1.33, 0.92, 0.058, 0.05, cx=X, mid=(1.2, 0.062), sub=1)
        a.b.sph(0.078, 'top' if (long_sleeve or st != 'vest') else sk, X - s * 0.015, 1.405, 0, 1.0, 1.0, 1.0, 10)           # shoulder cap
        if long_sleeve:
            kk = 0.016 if st != 'parka' else 0.03
            a.tube('sleeve', 'top', 1.40, 0.91, 0.078 + kk, 0.068 + kk, cx=X, mid=(1.22, 0.082 + kk), sub=1)
            f.tube('sleeve', 'top', 1.09, 0.76, 0.068 + kk, 0.056 + kk, cx=X, sub=1)
            f.loft('cuff', 'top2', [(0.775, 0.058 + kk, 0.058 + kk, X, 0), (0.725, 0.056 + kk, 0.056 + kk, X, 0)], sub=0, N=14)
            if cfg.get('stripes'):
                ox = X + s * (0.078 + kk - 0.006); a.b.box(0.012, 0.40, 0.03, 'top2', ox, 1.2, 0.0); f.b.box(0.012, 0.24, 0.026, 'top2', X + s * (0.066 + kk - 0.006), 0.9, 0.0)
        else:
            a.tube('sleeve', 'top', 1.405, 1.12, 0.084, 0.078, cx=X, sub=1)
            if cfg.get('trim'): a.loft('cuff', 'top2', [(1.19, 0.08, 0.08, X, 0), (1.17, 0.08, 0.08, X, 0)], sub=0)
        f.tube('skin', sk, 1.08, 0.70, 0.048, 0.04, cx=X, sub=1)
        f.b.sph((0.066 + (0.016 if st != 'parka' else 0.03)) if long_sleeve else 0.046, 'top' if long_sleeve else sk, X, 1.0, 0, 1, 1, 1, 8)
        gc = O.get('glove')
        if gc is not None and gc != 0 and not cfg.get('bare_hands', True): pass
        hand = 'skin'
        if O.get('glove') not in (None, 0) and cfg.get('gloves'): hand = O['glove']
        # hand: palm + fingers + thumb
        f.b.box(0.065, 0.085, 0.034, hand, X, 0.66, 0.0); f.b.sph(0.034, hand, X, 0.60, 0.0, 1.0, 1.1, 0.75, 8)
        f.b.sph(0.015, hand, X + s * -0.036, 0.66, -0.02, 0.9, 2.0, 1.0, 6)
        if cfg.get('bracelet'): f.b.cyl(0.046, 0.025, 0x9aa1ad, X, 0.74, 0, 'y', 0.046, 12)
        a.done(); f.done()

# ----------------------------------------------------------------------------------------------------------- legs
def build_legs(S, cfg, O):
    pk = cfg.get('pants', 'cargo'); shorts = O.get('shorts'); robot = cfg.get('robot')
    boots = O.get('boots', 0xf2f2f2); sole = cfg.get('sole', 0xf4f4f4)
    k = {'cargo': 0.028, 'jeans': 0.0, 'jogger': 0.008}.get(pk, 0.01)
    for i, side in enumerate(('L', 'R')):
        s = -1 if i == 0 else 1; X = s * HIP_X
        l = Out('leg_' + side, S['root'], (X, HIP_Y, 0), (X, HIP_Y, 0)); lb = l.b
        sh = Out('shin_' + side, l.n, (0, KN_Y - HIP_Y, 0), (X, KN_Y, 0)); sb = sh.b
        skin = 'skin' if not robot else 0xdfe6f2
        l.tube('skin', skin, 0.98, 0.36, 0.088, 0.062, cx=X, mid=(0.8, 0.095), sub=1)
        if not shorts: sb.sph(0.09 + k, 'pants', X, 0.46, 0, 1.0, 1.0, 1.05, 10)
        if shorts:
            l.tube('shorts', 'pants', 1.0, 0.54, 0.108, 0.12, cx=X, sub=1)
            sh.tube('skin', skin, 0.5, 0.12, 0.062, 0.045, cx=X, sub=1)
            sh.loft('sock', 0xffffff, [(0.2, 0.05, 0.05, X, 0), (0.1, 0.05, 0.05, X, 0)], sub=0)
        else:
            l.tube('pant', 'pants', 1.0, 0.36, 0.108 + k, 0.092 + k, cx=X, mid=(0.74, 0.118 + k), sub=1)
            sh.tube('pant', 'pants', 0.52, 0.08, 0.092 + k, 0.085 + k * 1.4, cx=X, mid=(0.3, 0.089 + k), sub=1)
            if pk == 'cargo':
                lb.box(0.045, 0.15, 0.085, 'pants', X + s * (0.118 + k), 0.72, -0.01); lb.box(0.05, 0.035, 0.09, 'pants', X + s * (0.121 + k), 0.8, -0.01)
                if cfg.get('stripes'): lb.box(0.012, 0.62, 0.03, 'top2', X + s * (0.112 + k), 0.7, 0.0); sb.box(0.012, 0.34, 0.03, 'top2', X + s * (0.08 + k), 0.26, 0.0)
            if pk == 'jeans': lb.box(0.007, 0.5, 0.012, 0xe0c27a, X + s * 0.1, 0.65, 0.0)
        # chunky sneaker
        sb.box(0.125, 0.05, 0.27, sole, X, 0.028, -0.055); sb.box(0.128, 0.012, 0.31, 0x8a909b, X, 0.056, -0.045)
        sb.sph(0.075, boots, X, 0.082, -0.01, 0.95, 0.75, 1.55, 12); sb.sph(0.062, boots, X, 0.075, -0.115, 1.0, 0.7, 1.1, 10)
        sb.box(0.07, 0.03, 0.09, boots, X, 0.125, -0.07, 0.4, 0, 0); sb.box(0.03, 0.012, 0.1, sole, X, 0.122, -0.06, 0.4, 0, 0)
        sb.box(0.13, 0.014, 0.1, 0x14161b if sole != 0x14161b else 0x444, X, 0.03, 0.06)
        l.done(); sh.done()

STYLE = {
    'default': dict(top='tee', pants='jeans', hair='short', sole=0xdcdfe6),
    'hero': dict(top='hoodie', tee=0xf4f4f4, pants='cargo', hair='short', chain=1, bracelet=1, stripes=1, hem='top2'),
    'ranger': dict(top='jacket', pants='cargo', hair='short', head='cap', packT='round', trim=1),
    'neon': dict(top='hoodie', tee=0x35e0ff, pants='jogger', hair='spiky', glasses='visor', packT='box', stripes=1, chain=1),
    'frost': dict(top='parka', pants='jogger', hair='short', head='beanie', packT='box', trim=1),
    'gold': dict(top='jacket', pants='jogger', hair='short', head='helmet', packT='round', stripes=1),
    'shadow': dict(top='hoodie', tee=0x1d1c28, pants='cargo', head='hood', mask=0x1d1c28, glasses='visor', packT='box', stripes=1),
    'beach': dict(top='tee', pants='jogger', head='sunhat', hair='short', glasses='shades', packT='round', trim=1),
    'knight': dict(top='jacket', pants='jogger', head='knight', plates=1, packT='cape', trim=1),
    'circuit': dict(top='jacket', pants='jogger', head=None, hair='none', robot=1, packT='box', trim=1),
    'dino': dict(top='hoodie', tee=0xffe36a, pants='jogger', head='dino', packT='round'),
    'cow': dict(top='jacket', pants='jeans', head='cowboy', hair='short', mask=0xd9433a, packT='roll', trim=1),
    'lab': dict(top='jacket', pants='jogger', head='goggles', hair='spiky', packT='box', trim=1),
    'punk': dict(top='jacket', pants='jogger', hair='mohawk', glasses='round', packT='round', stripes=1),
}

def build_human(cid, O, root=None):
    cfg = dict(STYLE.get(cid, STYLE['default'])); cfg['head'] = cfg.get('head'); cfg['hair'] = cfg.get('hair', O.get('hair', 'short'))
    cfg['headC'] = O.get('headC', 0x888888); cfg['pack'] = O.get('pack', 0x7a6a30)
    if O.get('mask') and 'mask' not in cfg: cfg['mask'] = O['mask']
    S = {'root': root or node('char_' + cid)}
    build_torso(S, cfg, O); build_head(S, cfg, O); build_arms(S, cfg, O); build_legs(S, cfg, O)
    return S['root']

def lod_low(root, ratio=0.22):
    """static decimated copy of the whole figure in bind pose -> node `lod_low` (used for far LOD)."""
    bpy.context.view_layer.update()
    meshes = []
    def walk(o):
        if o.type == 'MESH': meshes.append(o)
        for c in o.children: walk(c)
    walk(root)
    bpy.ops.object.select_all(action='DESELECT')
    dups = []
    for m in meshes:
        d = m.copy(); d.data = m.data.copy(); bpy.context.scene.collection.objects.link(d); d.parent = None; d.matrix_world = m.matrix_world.copy(); dups.append(d)
    for d in dups: d.select_set(True)
    bpy.context.view_layer.objects.active = dups[0]
    bpy.ops.object.convert(target='MESH')       # applies subsurf
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active; ob.name = 'lod_low'
    md = ob.modifiers.new('dec', 'DECIMATE'); md.ratio = ratio
    bpy.ops.object.modifier_apply(modifier='dec')
    ob.parent = root; ob.matrix_parent_inverse = root.matrix_world.inverted()
    return ob

def build_characters(outdir, only=None):
    chars = json.load(open(os.path.join(HERE, 'specs', 'chars.json')))
    for cid, S in chars.items():
        if only and cid not in only: continue
        C.reset(); C.BEVEL = 0.008
        d = S['defaults']; C.ROLE_DEFAULT.update({'skin': d['skin'], 'top': d['top'], 'top2': d['top2'], 'pants': d['pants'], 'hair': d['hair']})
        root = build_human(cid, S['outfit'])
        lod_low(root)
        finalize_and_export(root, os.path.join(outdir, 'char_' + cid + '.glb'))
