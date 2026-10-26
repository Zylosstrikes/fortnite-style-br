"""Renders /workspace/fortnite-character-preview.png style image: Default + Street Hoodie characters on a blue gradient (Cycles, CPU).
    blender -b --python preview.py -- <out_dir>"""
import bpy, math, os, sys, json
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C, human as H, rig_anim as R

out = C.out_dir(); os.makedirs(out, exist_ok=True)
C.reset(); C.BEVEL = 0.008
arms = []
for cid, x, yaw in (('default', -0.62, 22), ('hero', 0.62, -22)):
    arm = R.build_rigged(out, cid); arm.location.x = x; arm.rotation_euler.z = math.radians(yaw)
    R.animate(arm); arm.animation_data.action = bpy.data.actions['idle']; arms.append(arm)
    # relaxed pose
    for n, v in (('arm_L', (0.05, 0, -0.08)), ('arm_R', (0.05, 0, 0.08)), ('forearm_L', (0.25, 0, 0)), ('forearm_R', (0.25, 0, 0)), ('head', (0.03, 0.15 * (1 if x < 0 else -1), 0))):
        pb = arm.pose.bones[n]; pb.rotation_mode = 'XYZ'; pb.rotation_euler = v
    arm.animation_data_clear()
sc = bpy.context.scene
FAST = 'fast' in sys.argv
sc.render.engine = 'BLENDER_WORKBENCH' if FAST else 'CYCLES'; sc.cycles.samples = 28; sc.cycles.device = 'CPU'
if FAST:
    sh = sc.display.shading; sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sc.display.render_aa = '8'
try: sc.cycles.use_denoising = True
except Exception: pass
sc.render.resolution_x, sc.render.resolution_y = 900, 1100
sc.view_settings.view_transform = 'Standard'
# world: blue vertical gradient
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
tc = nt.nodes.new('ShaderNodeTexCoord'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); cr = nt.nodes.new('ShaderNodeValToRGB'); bg = nt.nodes.new('ShaderNodeBackground'); o = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(tc.outputs['Window'], sp.inputs[0]); nt.links.new(sp.outputs['Y'], cr.inputs[0]); nt.links.new(cr.outputs[0], bg.inputs[0]); nt.links.new(bg.outputs[0], o.inputs[0])
cr.color_ramp.elements[0].color = (0.0, 0.10, 0.62, 1); cr.color_ramp.elements[1].color = (0.03, 0.42, 1.0, 1); bg.inputs[1].default_value = 1.0
# camera (characters face Blender +Y)
cam = bpy.data.cameras.new('cam'); cam.lens = 70; co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
co.location = (0, 6.4, 1.0); co.rotation_euler = (math.radians(90), 0, math.radians(180))
def light(kind, loc, energy, rot=None, color=(1, 1, 1), size=1.0):
    l = bpy.data.lights.new(kind, kind); l.energy = energy; l.color = color
    if kind == 'AREA': l.size = size
    ob = bpy.data.objects.new(kind, l); sc.collection.objects.link(ob); ob.location = loc
    if rot: ob.rotation_euler = [math.radians(a) for a in rot]
    return ob
light('SUN', (3, 6, 6), 3.2, (50, 0, 150), (1, 0.97, 0.92)); light('AREA', (-4, -3, 3), 450, (70, 0, -140), (0.4, 0.7, 1.0), 4); light('AREA', (0, 6, 2), 220, (80, 0, 180), (0.8, 0.9, 1.0), 5)
# glowing platform discs
for x in (-0.62, 0.62):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.62, depth=0.04, location=(x, 0, -0.02)); d = bpy.context.active_object
    m = bpy.data.materials.new('disc'); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (0.5, 0.85, 1, 1)
    for k in ('Emission Color', 'Emission'):
        if k in b.inputs: b.inputs[k].default_value = (0.4, 0.8, 1, 1)
    b.inputs['Emission Strength'].default_value = 2.2; d.data.materials.append(m)
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -0.045)); fl = bpy.context.active_object
fm = bpy.data.materials.new('floor'); fm.use_nodes = True; fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.2, 0.7, 1); fm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.35; fl.data.materials.append(fm)
if FAST: sc.render.resolution_x, sc.render.resolution_y = 600, 733
sc.render.filepath = os.path.join(out, 'preview_fast.png' if FAST else 'fortnite-character-preview.png'); sc.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print('RENDERED', sc.render.filepath)
