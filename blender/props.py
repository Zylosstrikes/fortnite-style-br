"""Hand-written Blender models for pickups, chests, the llama and trees (original designs, built from primitives)."""
import math
import common as C
from common import Builder, node, piece, finalize_and_export
import os

def exp(root, outdir, name): finalize_and_export(root, os.path.join(outdir, name + '.glb'))

def grey(v):
    g = int(round(v * 255)); return (g << 16) | (g << 8) | g

# ------------------------------------------------------------------ chests: nodes `body` + `lid` (lid hinge at 0,0.55,-0.35)
def chest(outdir, style):
    C.reset(); C.BEVEL = 0.014; root = node('chest_' + style)
    body, lid = Builder(), Builder()
    if style == 'wood':
        wood, woodL, gold, dark = 0x7a4a2a, 0x8a5430, 0xffc83a, 0x4a2c16
        body.box(1.1, 0.55, 0.7, wood, 0, 0.275, 0)
        for y in (0.1, 0.22, 0.34): body.box(1.12, 0.012, 0.72, dark, 0, y, 0)      # plank seams
        for sx in (-0.5, 0.5): body.box(0.1, 0.57, 0.72, gold, sx, 0.28, 0); body.box(0.14, 0.06, 0.74, gold, sx, 0.05, 0)
        body.box(0.18, 0.2, 0.04, gold, 0, 0.45, 0.36); body.box(0.07, 0.07, 0.05, 'rarity', 0, 0.45, 0.39, glow=True)
        for sx in (-0.5, 0.5):
            for sz in (-0.3, 0.3): body.box(0.12, 0.08, 0.12, 0x2a1a0e, sx, -0.02, sz)
        lid.box(1.1, 0.2, 0.7, woodL, 0, 0.1, 0.35); lid.cyl(0.35, 1.1, woodL, 0, 0.2, 0.35, 'x', seg=12)
        for sx in (-0.5, 0.5): lid.box(0.1, 0.22, 0.72, gold, sx, 0.11, 0.35); lid.cyl(0.37, 0.1, gold, sx, 0.2, 0.35, 'x', seg=12)
    else:
        frame, frameD, blue = 0x5a4a3c, 0x3e342b, 0x3d8cff
        body.box(1.1, 0.5, 0.7, frameD, 0, 0.25, 0)
        for sx in (-0.3, 0.3): body.box(0.34, 0.4, 0.72, blue, sx, 0.27, 0, glow=True)
        for sx in (-0.52, 0, 0.52): body.box(0.1, 0.56, 0.76, frame, sx, 0.28, 0)
        body.box(1.14, 0.08, 0.76, frame, 0, 0.04, 0); body.box(0.2, 0.2, 0.06, 0xb08a52, 0, 0.34, 0.37); body.box(0.08, 0.08, 0.08, 'rarity', 0, 0.34, 0.4, glow=True)
        for sx in (-0.52, 0.52):
            for sz in (-0.3, 0.3): body.box(0.12, 0.1, 0.12, 0x2a241e, sx, -0.02, sz)
        lid.box(1.1, 0.14, 0.7, frameD, 0, 0.07, 0.35)
        for sx in (-0.3, 0.3): lid.box(0.34, 0.26, 0.64, blue, sx, 0.15, 0.35, glow=True)
        for sx in (-0.52, 0, 0.52): lid.box(0.1, 0.3, 0.74, frame, sx, 0.14, 0.35)
        lid.box(1.12, 0.05, 0.72, frame, 0, 0.29, 0.35)
    piece('body', body, root, (0, 0, 0), (0, 0, 0))
    piece('lid', lid, root, (0, 0.55, -0.35), (0, 0.55, -0.35))
    exp(root, outdir, 'chest_' + style)

# ------------------------------------------------------------------ healing pickups (single glb, nodes heal_*)
def flask(b, s, liquid, glass):
    b.sph(0.2 * s, liquid, 0, 0, 0, 1, 0.92, 1, 14, glow=True)
    b.sph(0.21 * s, glass, 0, 0.03 * s, 0, 1, 0.9, 1, 10)       # glassy cap over the top of the liquid
    b.cyl(0.07 * s, 0.17 * s, glass, 0, 0.24 * s, 0, 'y', 0.06 * s, 8); b.cyl(0.085 * s, 0.03 * s, 0xdff4ff, 0, 0.33 * s, 0, 'y', 0.085 * s, 8)
    b.cyl(0.055 * s, 0.1 * s, 0xb07a42, 0, 0.39 * s, 0, 'y', 0.045 * s, 8)
    for x, y, z, r in ((-0.05, -0.02, 0.15, 0.025), (0.06, 0.05, 0.14, 0.02), (0.0, 0.1, 0.12, 0.016)): b.sph(r * s, 0xffffff, x * s, y * s, z * s, seg=6, glow=True)

def heals(outdir):
    C.reset(); C.BEVEL = 0.01; root = node('heals')
    b = Builder(); b.cyl(0.2, 0.18, 0xf4f4f4, 0, 0, 0, 'y', seg=14); b.box(0.1, 0.19, 0.28, 0xff4d4d, 0, 0, 0.05); b.cyl(0.205, 0.05, 0xdfe6ee, 0, 0.0, 0, 'y', seg=14)
    piece('heal_bandage', b, root, (0, 0, 0), (0, 0, 0))
    b = Builder(); b.box(0.56, 0.2, 0.36, 0xc9ced6, 0, -0.07, 0); b.box(0.58, 0.15, 0.38, 0xe6322a, 0, 0.08, 0); b.box(0.2, 0.03, 0.08, 0xffffff, 0, 0.165, 0); b.box(0.08, 0.03, 0.2, 0xffffff, 0, 0.165, 0)
    b.box(0.6, 0.035, 0.4, 0x23262c, 0, 0.0, 0); b.box(0.1, 0.12, 0.04, 0xaab2bd, -0.2, -0.02, 0.2); b.box(0.24, 0.07, 0.03, 0xffffff, 0, -0.07, 0.185); b.box(0.2, 0.05, 0.1, 0x23262c, 0, 0.19, 0)
    piece('heal_medkit', b, root, (0, 0, 0), (0, 0, 0))
    b = Builder(); b.cyl(0.2, 0.44, 0xaab2bd, 0, 0, 0, 'y', seg=14)
    for y in (-0.235, 0.235): b.cyl(0.215, 0.07, 0x2f86e8, 0, y, 0, 'y', seg=14, glow=True)
    b.cyl(0.15, 0.05, 0x3a9aff, 0, 0.29, 0, 'y', 0.17, 14, glow=True); b.box(0.06, 0.04, 0.06, 0xdfe6ee, 0, 0.33, 0)
    for i in range(3):
        a = i * math.pi * 2 / 3 + 0.3
        b.box(0.15, 0.3, 0.035, 0x3dffc8, math.sin(a) * 0.205, 0.0, math.cos(a) * 0.205, 0, a, 0, glow=True)
        a2 = a + math.pi / 3; b.box(0.08, 0.34, 0.03, 0x8a929e, math.sin(a2) * 0.205, 0, math.cos(a2) * 0.205, 0, a2, 0)
    piece('heal_chug', b, root, (0, 0, 0), (0, 0, 0))
    b = Builder(); flask(b, 1.25, 0x2f7bff, 0x9fd0ff); piece('heal_shield', b, root, (0, 0, 0), (0, 0, 0))
    b = Builder(); flask(b, 0.78, 0x4ab0ff, 0xb5e2ff); piece('heal_minishield', b, root, (0, 0, 0), (0, 0, 0))
    b = Builder(); b.cyl(0.1, 0.3, 0x38e8ff, 0, 0, 0, 'y', 0.12 / 0.1 * 0.1 + 0.0, 10, glow=True); b.cyl(0.125, 0.09, 0xffffff, 0, 0, 0, 'y', seg=10)
    b.cone(0.1, 0.1, 0x9ffcf0, 0, 0.2, 0, seg=10); b.cyl(0.04, 0.1, 0xdff4ff, 0, 0.3, 0); b.box(0.07, 0.05, 0.07, 0xff6bd0, 0, 0.37, 0); b.box(0.016, 0.2, 0.016, 0xff6bd0, 0.02, 0.46, 0, 0, 0, -0.3)
    piece('heal_slurp', b, root, (0, 0, 0), (0, 0, 0))
    exp(root, outdir, 'heals')

# ------------------------------------------------------------------ llama pinata: nodes body + balloon
def llama(outdir):
    C.reset(); C.BEVEL = 0.02; root = node('llama')
    gold, gold2, pink, cyan, ink = 0xffc83a, 0xffa81f, 0xff5fb0, 0x3fd0ff, 0x2a1500
    b = Builder()
    b.box(0.95, 0.85, 1.5, gold, 0, 1.15, 0); b.box(0.97, 0.18, 1.52, pink, 0, 1.0, 0); b.box(0.97, 0.12, 1.52, cyan, 0, 0.75, 0)
    b.box(1.0, 0.1, 1.0, pink, 0, 1.62, 0.05); b.box(1.02, 0.05, 1.02, cyan, 0, 1.69, 0.05)
    for x, z in ((-0.3, -0.55), (0.3, -0.55), (-0.3, 0.55), (0.3, 0.55)):
        b.box(0.2, 0.8, 0.22, gold2, x, 0.4, z); b.box(0.22, 0.12, 0.26, pink, x, 0.06, z)
    b.box(0.34, 0.85, 0.34, gold, 0, 1.85, -0.72, -0.18, 0, 0); b.box(0.4, 0.38, 0.5, gold, 0, 2.38, -0.9); b.box(0.28, 0.24, 0.26, gold2, 0, 2.28, -1.22)
    b.box(0.08, 0.06, 0.04, ink, -0.08, 2.3, -1.36); b.box(0.08, 0.06, 0.04, ink, 0.08, 2.3, -1.36); b.box(0.3, 0.06, 0.04, ink, 0, 2.2, -1.36)
    for s in (-1, 1):
        b.box(0.1, 0.34, 0.1, gold2, s * 0.15, 2.7, -0.8, 0, 0, -s * 0.2); b.sph(0.045, ink, s * 0.2, 2.48, -1.12); b.box(0.12, 0.04, 0.04, pink, s * 0.1, 2.52, -1.12)
    b.box(0.18, 0.4, 0.16, pink, 0, 2.7, -0.84); b.box(0.1, 0.1, 0.5, pink, 0, 1.2, 0.95, 0.5, 0, 0); b.box(0.1, 0.1, 0.36, cyan, 0.12, 1.25, 0.9, 0.35, 0, 0)
    piece('body', b, root, (0, 0, 0), (0, 0, 0))
    # balloon: gored sphere (12 gores in 4 colours) + knot + strings
    import spec_models as SM
    nb = node('balloon', root); cols = [C.material(pink), C.material(0xffe03a), C.material(cyan), C.material(0xffffff)]
    R, ROWS, COLS = 2.1, 12, 24
    def pos(i, j):
        th = math.pi * i / ROWS; ph = 2 * math.pi * j / COLS
        return (-R * math.cos(ph) * math.sin(th), R * 1.2 * math.cos(th) + 8.2, R * math.sin(ph) * math.sin(th))
    def gore(i, j):
        a = math.atan2(pos(i, j)[2], pos(i, j)[0]); return int(math.floor((a + math.pi) / (2 * math.pi) * 12)) % 4
    SM.gored_mesh('llama_balloon', nb, ROWS, COLS, pos, gore, cols, True, False, (0, 8.2, 0))
    bl = Builder(); bl.cone(0.3, 0.5, 0xffc83a, 0, 6.2, 0, rx=math.pi, seg=8)
    for x, z in ((-0.4, -0.5), (0.4, -0.5), (-0.4, 0.5), (0.4, 0.5)): bl.box(0.04, 6.6, 0.04, 0xeeeeee, x * 1.6, 4.9, z * 1.6, z * 0.22, 0, -x * 0.22)
    bl.bake('llama_strings', nb, shift=(0, 0, 0))
    exp(root, outdir, 'llama')
# ------------------------------------------------------------------ trees (greyscale foliage: the game tints each instance)
def trees(outdir):
    C.reset(); C.BEVEL = 0; root = node('trees')   # instanced thousands of times: keep it light
    t = Builder(); t.cyl(0.22, 1, 0xffffff, 0, 0.5, 0, 'y', 0.34, 7); t.cyl(0.5, 0.35, 0xdfdfdf, 0, 0.1, 0, 'y', 0.5, 7)
    for k in range(3): a = k * 2.1; t.box(0.1, 0.3, 0.4, 0xd0d0d0, math.cos(a) * 0.32, 0.12, math.sin(a) * 0.32, 0.3, -a, 0)
    piece('tree_trunk', t, root, (0, 0, 0), (0, 0, 0))
    p = Builder()
    for i, (r, h, y, v) in enumerate([[2.15, 2.3, 0.0, 0.74], [1.75, 2.3, 1.15, 0.86], [1.3, 2.2, 2.3, 0.96], [0.85, 1.8, 3.35, 1.0]]):
        p.cone(r, h, grey(v), 0, y + h / 2, 0, 0, i * 0.4, 0, 8); p.cone(r * 0.93, 0.28, grey(v * 0.8), 0, y + 0.05, 0, math.pi, i * 0.4, 0, 8) if False else None
    piece('tree_pine', p, root, (0, 0, 0), (0, 0, 0))
    o = Builder()
    o.ico(1.7, grey(0.9), 0, 0.2, 0, 1.05, 0.85, 1.05, 1); o.ico(1.2, grey(1.0), 0.9, 0.95, 0.2, 1, 0.9, 1, 1); o.ico(1.1, grey(0.98), -0.8, 0.8, -0.5, 1, 0.9, 1, 1)
    o.ico(0.95, grey(1.0), 0.1, 1.5, 0.5, 1, 0.9, 1, 1); o.ico(0.7, grey(0.82), -0.2, 1.7, -0.2, 1, 0.9, 1, 1)
    piece('tree_oak', o, root, (0, 0, 0), (0, 0, 0))
    exp(root, outdir, 'trees')
