"""blender -b --python props_preview.py -- <out_dir>   -> fortnite-props-preview.png (Cycles)  props sheet of the scenery pack + trees"""
import bpy, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C, props2 as P2, props
out = C.out_dir(); os.makedirs(out, exist_ok=True)
C.reset(); root = C.node('sheet')
sc = bpy.context.scene
def place(fn, pos, rot=0, scale=1.0):
    n0 = set(bpy.data.objects); fn(); new = [o for o in bpy.data.objects if o not in n0 and o.parent is not None and o.parent.name == 'sheet' and o.type == 'EMPTY']
    return new
P2.C.BEVEL = 0.02
# build each prop under its own parent at a layout position (game space x right, z toward camera is -z)
def at(name, x, z, ry=0, s=1.0):
    o = bpy.data.objects[name]; o.parent = None
    o.location = (x, -z, 0); o.rotation_euler = (0, 0, ry); o.scale = (s, s, s)
P2.rock(root, 'rock_a', 11, 1.0, 0.85, 1.05); P2.rock(root, 'rock_b', 23, 1.25, 0.7, 0.95, tint=-6); P2.rock(root, 'rock_c', 37, 0.8, 1.15, 0.85, moss=False, tint=8)
P2.bush(root, 'bush_a', 3); P2.bush(root, 'bush_b', 8, berries=True); P2.bush(root, 'bush_c', 15, flowers=True)
P2.cottage(root); P2.stone_wall(root); P2.fence(root)
# layout (Blender space: x right, y depth(+ away from camera), z up)
lay = {'cottage': (0.5, 4.0, math.radians(12), 1.0), 'rock_a': (-7.0, -0.2, 0.5, 1.0), 'rock_b': (-9.3, 1.8, 2.0, 1.0), 'rock_c': (-5.2, 2.2, 1.0, 1.0),
       'bush_a': (5.5, -0.5, 0.3, 1.2), 'bush_b': (7.2, 0.9, 1.0, 1.2), 'bush_c': (9.0, -0.4, 2.0, 1.2), 'wall_stone': (-2.4, -2.6, 0.0, 1.0), 'fence_wood': (3.2, -2.6, 0.0, 1.0)}
for n, (x, y, r, s) in lay.items():
    o = bpy.data.objects[n]; o.parent = None; o.location = (x, y, 0.0); o.rotation_euler = (0, 0, r + math.pi); o.scale = (s, s, s)
# flatten the node transforms: nodes carry the C4 rotation already via parenting; reapply by keeping children
for o in list(bpy.data.objects):
    if o.type == 'EMPTY' and o.name == 'sheet': pass
sc.render.engine = 'CYCLES'; sc.cycles.samples = 40; sc.cycles.device = 'CPU'
try: sc.cycles.use_denoising = True
except Exception: pass
sc.render.resolution_x, sc.render.resolution_y = 1500, 800; sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
tc = nt.nodes.new('ShaderNodeTexCoord'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); cr = nt.nodes.new('ShaderNodeValToRGB'); bg = nt.nodes.new('ShaderNodeBackground'); oo = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(tc.outputs['Window'], sp.inputs[0]); nt.links.new(sp.outputs['Y'], cr.inputs[0]); nt.links.new(cr.outputs[0], bg.inputs[0]); nt.links.new(bg.outputs[0], oo.inputs[0])
cr.color_ramp.elements[0].color = (0.45, 0.75, 1.0, 1); cr.color_ramp.elements[1].color = (0.05, 0.35, 0.9, 1); bg.inputs[1].default_value = 1.0
cam = bpy.data.cameras.new('cam'); cam.lens = 38; co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
co.location = (0, -21, 6.5); co.rotation_euler = (math.radians(77), 0, 0)
def light(kind, loc, energy, rot=None, color=(1, 1, 1), size=1.0):
    l = bpy.data.lights.new(kind, kind); l.energy = energy; l.color = color
    if kind == 'AREA': l.size = size
    ob = bpy.data.objects.new(kind, l); sc.collection.objects.link(ob); ob.location = loc
    if rot: ob.rotation_euler = [math.radians(a) for a in rot]
light('SUN', (4, -6, 9), 3.5, (50, 0, 20), (1, 0.96, 0.9)); light('AREA', (-8, -8, 6), 600, (60, 0, -45), (0.6, 0.8, 1.0), 6)
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, -0.02)); fl = bpy.context.active_object
fm = bpy.data.materials.new('grass'); fm.use_nodes = True; b = fm.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0.12, 0.45, 0.1, 1); b.inputs['Roughness'].default_value = 0.9; fl.data.materials.append(fm)
sc.render.filepath = os.path.join(out, 'fortnite-props-preview.png'); sc.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True); print('RENDERED', sc.render.filepath)
