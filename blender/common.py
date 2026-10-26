"""Shared helpers for the Stormfall Royale Blender model scripts (Blender 4.x / 5.x, run headless).

Model authoring uses the SAME coordinate convention as the three.js game (x right, y up, -z forward) so that the numbers
read like the game's procedural builders; helpers convert to Blender's Z-up space and the glTF exporter converts back
(game -Z forward == Blender +Y forward).  Everything is original and generated from primitives.

    python  blender -b --python build_all.py -- <output_dir>
"""
import bpy, bmesh, math, os, sys
from mathutils import Matrix, Vector, Euler

C4 = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # three(x,y,z) -> blender(x,-z,y)
C4I = C4.inverted()

def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hexrgb(h):
    return (srgb_to_lin(((h >> 16) & 255) / 255), srgb_to_lin(((h >> 8) & 255) / 255), srgb_to_lin((h & 255) / 255))

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()

MATS = {}
BEVEL_MIN = 0.05   # boxes thinner than this stay sharp (keeps triangle counts phone-friendly)
BEVEL = 0.012   # metres: soft chunky edge on every box primitive
# role materials: the game recolours these by name (outfit colours, rarity glow, glider tint ...)
ROLE_DEFAULT = {'skin': 0xf2c9a0, 'top': 0x3f9a4a, 'top2': 0xf0e2a6, 'pants': 0x8a6a3a, 'boots': 0x5a3a22, 'glove': 0x5a3a22, 'hair': 0x6a4026,
                'hat': 0x3f9a4a, 'pack': 0x7a6a30, 'rarity': 0xc0c0c0, 'tint': 0xff5a5a}

def material(col, glow=False):
    """col: int hex colour, or a role name (str).  glow -> emissive."""
    key = (col, glow)
    if key in MATS:
        return MATS[key]
    if isinstance(col, str):
        name, hx = 'R_' + col, ROLE_DEFAULT[col]
    else:
        name, hx = ('G_' if glow else 'C_') + '%06x' % col, col
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexrgb(hx) + (1,)
    b.inputs['Roughness'].default_value = 0.9
    if 'Metallic' in b.inputs:
        b.inputs['Metallic'].default_value = 0.0
    if glow or col == 'rarity':
        for k in ('Emission Color', 'Emission'):
            if k in b.inputs:
                b.inputs[k].default_value = hexrgb(hx) + (1,)
        if 'Emission Strength' in b.inputs:
            b.inputs['Emission Strength'].default_value = 1.0
    MATS[key] = m
    return m

class Part:
    __slots__ = ('kind', 'col', 'glow', 'm', 'smooth', 'a', 'b', 'c')
    def __init__(s, kind, col, glow, m, smooth, a=0, b=0, c=0):
        s.kind, s.col, s.glow, s.m, s.smooth, s.a, s.b, s.c = kind, col, glow, m, smooth, a, b, c

def trs(x, y, z, sx, sy, sz, rx, ry, rz):
    """three.js style TRS (Euler XYZ order) in game space -> Blender-space 4x4."""
    t = Matrix.Translation((x, y, z))
    r = Euler((rx, ry, rz), 'XYZ').to_matrix().to_4x4()
    s = Matrix.Diagonal((sx, sy, sz, 1))
    return C4 @ t @ r @ s @ C4I

class Builder:
    """Collects primitives (game-space numbers, same signatures as the JS Builder) and bakes them to ONE mesh object per
    material under `parent`, with the object origin placed at `pivot` (game space)."""
    def __init__(self):
        self.parts = []
    def _add(self, kind, col, glow, m, smooth=False, a=0, b=0, c=0):
        self.parts.append(Part(kind, col, glow, m, smooth, a, b, c)); return self
    def box(self, w, h, d, col, x=0, y=0, z=0, rx=0, ry=0, rz=0, glow=False):
        return self._add('box', col, glow, trs(x, y, z, w, h, d, rx, ry, rz), False, 0, 0, min(w, h, d))
    def cyl(self, r, length, col, x=0, y=0, z=0, axis='y', r2=None, seg=8, glow=False):
        rx = rz = 0
        if axis == 'z': rx = math.pi / 2
        elif axis == 'x': rz = math.pi / 2
        return self._add('cyl', col, glow, trs(x, y, z, r, length, r, rx, 0, rz), False, seg, 1.0 if r2 is None else r2 / r)
    def sph(self, r, col, x=0, y=0, z=0, sx=1, sy=1, sz=1, seg=10, glow=False):
        return self._add('sph', col, glow, trs(x, y, z, r * sx, r * sy, r * sz, 0, 0, 0), True, seg)
    def cone(self, r, h, col, x=0, y=0, z=0, rx=0, ry=0, rz=0, seg=8, glow=False):
        return self._add('cone', col, glow, trs(x, y, z, r, h, r, rx, ry, rz), False, seg)
    def ico(self, r, col, x=0, y=0, z=0, sx=1, sy=1, sz=1, detail=0):
        return self._add('ico', col, False, trs(x, y, z, r * sx, r * sy, r * sz, 0, 0, 0), False, detail)
    def add_torus(self, r, tube, col, x, y, z, sx=1, sy=1, sz=1, rx=0, ry=0, rz=0, arc=math.pi * 2, glow=False):
        return self._add('torus', col, glow, trs(x, y, z, sx, sy, sz, rx, ry, rz), False, r, tube, arc)

    def bake(self, name, parent=None, shift=(0, 0, 0)):
        """returns list of created objects (one per material). `shift` (game space) is subtracted from every vertex."""
        groups = {}
        for p in self.parts:
            groups.setdefault((p.col, p.glow), []).append(p)
        piv = C4 @ Vector(shift)
        out = []
        for (col, glow), plist in groups.items():
            bm = bmesh.new()
            for p in plist:
                bmp = bmesh.new()
                if p.kind == 'box':
                    bmesh.ops.create_cube(bmp, size=1.0)
                elif p.kind == 'cyl':
                    bmesh.ops.create_cone(bmp, cap_ends=True, cap_tris=False, segments=int(p.a), radius1=1.0, radius2=p.b, depth=1.0)
                elif p.kind == 'sph':
                    seg = int(p.a); bmesh.ops.create_uvsphere(bmp, u_segments=seg, v_segments=max(4, round(seg * 0.75)), radius=1.0)
                elif p.kind == 'cone':
                    bmesh.ops.create_cone(bmp, cap_ends=True, cap_tris=False, segments=int(p.a), radius1=1.0, radius2=0.0, depth=1.0)
                elif p.kind == 'ico':
                    bmesh.ops.create_icosphere(bmp, subdivisions=int(p.a) + 1 if p.a else 1, radius=1.0)
                elif p.kind == 'torus':
                    ring = 6; segs = 16
                    # torus axis = game +Z (== local Blender -Y); arc runs from +X towards game +Y like three's TorusGeometry
                    bmesh.ops.create_circle(bmp, cap_ends=False, radius=p.b, segments=ring)
                    bmesh.ops.translate(bmp, vec=(p.a, 0, 0), verts=bmp.verts)
                    bmesh.ops.spin(bmp, geom=bmp.verts[:] + bmp.edges[:], cent=(0, 0, 0), axis=(0, 1, 0), angle=-p.c, steps=segs)
                bmp.normal_update()
                if p.kind in ('cyl', 'cone'):   # smooth sides, crisp cap edges
                    for f in bmp.faces:
                        if abs(f.normal.z) < 0.7: f.smooth = True
                    for e in bmp.edges:
                        if len(e.link_faces) == 2 and (abs(e.link_faces[0].normal.z) >= 0.7) != (abs(e.link_faces[1].normal.z) >= 0.7): e.smooth = False
                bmesh.ops.transform(bmp, matrix=p.m, verts=bmp.verts)
                if p.kind == 'box' and BEVEL > 0 and p.c > BEVEL_MIN:
                    w = min(BEVEL, p.c * 0.14)
                    bmesh.ops.bevel(bmp, geom=bmp.edges[:], offset=w, segments=1, affect='EDGES', profile=0.5)
                if p.smooth:
                    for f in bmp.faces: f.smooth = True
                mesh_tmp = bpy.data.meshes.new('tmp'); bmp.to_mesh(mesh_tmp); bmp.free(); bm.from_mesh(mesh_tmp); bpy.data.meshes.remove(mesh_tmp)
            bmesh.ops.translate(bm, vec=-piv, verts=bm.verts)
            me = bpy.data.meshes.new(name + '_' + (col if isinstance(col, str) else '%06x' % col))
            bm.to_mesh(me); bm.free()
            me.materials.append(material(col, glow))
            ob = bpy.data.objects.new(me.name, me)
            bpy.context.scene.collection.objects.link(ob)
            if parent is not None:
                ob.parent = parent
            out.append(ob)
        return out

def node(name, parent=None, pos=(0, 0, 0)):
    """empty transform node. pos is in the parent's game-space (three) frame."""
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = C4 @ Vector(pos)
    if parent is not None:
        e.parent = parent
    return e

def piece(name, builder, parent, pos=(0, 0, 0), shift=None):
    """node `name` under `parent` at `pos` (parent-local game space); builder geometry is authored in absolute game
    space and shifted by `shift` (default = the node's own absolute position, pass explicitly for nested nodes)."""
    n = node(name, parent, pos)
    builder.bake(name, n, shift=shift if shift is not None else pos)
    return n

def finalize_and_export(root, path, meshes_only=False):
    bpy.ops.object.select_all(action='DESELECT')
    def sel(o):
        o.select_set(True)
        for c in o.children: sel(c)
    sel(root)
    bpy.context.view_layer.objects.active = root
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False,
              export_animations=False, export_materials='EXPORT')
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError:
        for k in ('export_animations',):
            kw.pop(k, None)
        bpy.ops.export_scene.gltf(**kw)
    print('EXPORTED', path, os.path.getsize(path), 'bytes')

def out_dir():
    argv = sys.argv
    return argv[argv.index('--') + 1] if '--' in argv else os.getcwd()
