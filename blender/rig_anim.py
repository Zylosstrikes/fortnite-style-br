"""Armature + animation clips (idle, run, jump, glide, shoot, pickaxe) for the human characters.
Bones sit on the same pivots as the game's segment nodes; every segment mesh is bone-parented (rigid skinning), so the rigged file
and the game's segmented file are the same model.  Pose values match the game's procedural animator (js/actors.js)."""
import bpy, math, os
from mathutils import Vector, Matrix
import common as C
from common import C4, finalize_and_export
import human as H

BONES = [  # name, parent, head(game xyz), tail(game xyz)
    ('root', None, (0, 0.0, 0), (0, 0.3, 0)),
    ('torso', 'root', (0, 0.84, 0), (0, 1.4, 0)),
    ('head', 'torso', (0, 1.76, 0), (0, 2.0, 0)),
] + [b for s, sd in ((-1, 'L'), (1, 'R')) for b in (
    ('arm_' + sd, 'torso', (s * H.SH_X, 1.4, 0), (s * H.SH_X, 1.0, 0)),
    ('forearm_' + sd, 'arm_' + sd, (s * H.SH_X, 1.0, 0), (s * H.SH_X, 0.66, 0)),
    ('leg_' + sd, 'root', (s * H.HIP_X, 0.84, 0), (s * H.HIP_X, 0.42, 0)),
    ('shin_' + sd, 'leg_' + sd, (s * H.HIP_X, 0.42, 0), (s * H.HIP_X, 0.05, 0)))]

def make_armature(name):
    arm = bpy.data.armatures.new(name); ob = bpy.data.objects.new(name + '_armature', arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for n, p, h, t in BONES:
        eb = arm.edit_bones.new(n); eb.head = C4 @ Vector(h); eb.tail = C4 @ Vector(t)
        # local X = world X, local Y = bone direction (down), local Z = world Y(game up..): roll chosen so X stays world X
        eb.roll = 0
        if p: eb.parent = arm.edit_bones[p]
    # force axes: X stays +X for all bones
    for eb in arm.edit_bones:
        y = (eb.tail - eb.head).normalized(); x = Vector((1, 0, 0)); z = x.cross(y).normalized()
        m = Matrix(((x[0], y[0], z[0]), (x[1], y[1], z[1]), (x[2], y[2], z[2]))).to_3x3()
        eb.matrix = Matrix.Translation(eb.head) @ m.to_4x4()
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob

def bind(root, arm):
    """re-parent every mesh under the segment empties to the matching bone, keeping its world transform; drop the empties."""
    bpy.context.view_layer.update()
    jobs = []
    def walk(o, bone):
        for c in list(o.children):
            nb = c.name if (c.type == 'EMPTY' and c.name in arm.pose.bones) else bone
            if c.type == 'MESH': jobs.append((c, nb, c.matrix_world.copy()))
            walk(c, nb)
    walk(root, 'root')
    for ob, bone, wm in jobs:
        ob.parent = arm; ob.parent_type = 'BONE'; ob.parent_bone = bone
        ob.matrix_parent_inverse = Matrix.Identity(4); ob.location = (0, 0, 0); ob.rotation_euler = (0, 0, 0); ob.scale = (1, 1, 1)
        bpy.context.view_layer.update(); P = ob.matrix_world.copy()
        ob.matrix_parent_inverse = P.inverted() @ wm
    for e in [o for o in bpy.data.objects if o.type == 'EMPTY']: bpy.data.objects.remove(e)

# ---- poses: values are the game's rotation.x / rotation.z at each joint
def P(**kw): return kw
def key(arm, act, frame, pose):
    for pb in arm.pose.bones:
        x, y, z = pose.get(pb.name, (0, 0, 0)) if len(pose.get(pb.name, (0,))) == 3 else (pose.get(pb.name, (0, 0))[0], 0, pose.get(pb.name, (0, 0))[1])
        pb.rotation_mode = 'XYZ'; pb.rotation_euler = (x, y, -z)       # game +Z rotation == Blender -Z in bone space
        pb.keyframe_insert('rotation_euler', frame=frame, group=pb.name)
        if pb.name == 'root':
            pb.location = (0, pose.get('bob', (0,))[0] if 'bob' in pose else 0, 0); pb.keyframe_insert('location', frame=frame, group=pb.name)

def clip(arm, name, frames, loop=True):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    arm.animation_data_create(); arm.animation_data.action = act
    last = None
    for f, pose in frames: key(arm, act, f, pose); last = f
    if hasattr(act, 'frame_range'): pass
    return act

def poses():
    R = {}
    # idle
    R['idle'] = [(1, dict(arm_L=(0.02, 0.05), arm_R=(0.02, -0.05), forearm_L=(0.2, 0), forearm_R=(0.2, 0), torso=(0.0, 0), head=(0.02, 0))),
                 (24, dict(arm_L=(0.05, 0.07), arm_R=(0.0, -0.07), forearm_L=(0.25, 0), forearm_R=(0.22, 0), torso=(0.025, 0), head=(-0.02, 0), root=(0, 0, 0))),
                 (48, dict(arm_L=(0.02, 0.05), arm_R=(0.02, -0.05), forearm_L=(0.2, 0), forearm_R=(0.2, 0), torso=(0.0, 0), head=(0.02, 0)))]
    # run (loop, 24 frames): two steps
    run = []
    for i, f in enumerate(range(1, 26, 3)):
        ph = 2 * math.pi * (f - 1) / 24; sw = math.sin(ph) * 0.9
        run.append((f, dict(leg_L=(sw, 0), leg_R=(-sw, 0), shin_L=(-0.95 * max(0, math.cos(ph)), 0), shin_R=(-0.95 * max(0, -math.cos(ph)), 0),
                            arm_L=(-sw * 0.9, 0.04), arm_R=(sw * 0.9, -0.04), forearm_L=(0.5 + 0.6 * max(0, -math.sin(ph)), 0), forearm_R=(0.5 + 0.6 * max(0, math.sin(ph)), 0),
                            torso=(-0.14, 0), head=(0.1, 0), bob=(0.03 * abs(math.cos(ph)),))))
    R['run'] = run
    R['jump'] = [(1, dict(leg_L=(0.5, 0), leg_R=(0.5, 0), shin_L=(-0.9, 0), shin_R=(-0.9, 0), arm_L=(-0.5, 0.1), arm_R=(-0.5, -0.1), forearm_L=(0.3, 0), forearm_R=(0.3, 0), torso=(0.25, 0), bob=(-0.12,))),
                 (8, dict(leg_L=(0.1, 0), leg_R=(0.1, 0), shin_L=(-0.1, 0), shin_R=(-0.1, 0), arm_L=(2.7, 0.3), arm_R=(2.7, -0.3), forearm_L=(0.3, 0), forearm_R=(0.3, 0), torso=(-0.1, 0), bob=(0.05,))),
                 (18, dict(leg_L=(0.5, 0), leg_R=(0.2, 0), shin_L=(-0.9, 0), shin_R=(-0.5, 0), arm_L=(1.6, 0.6), arm_R=(1.6, -0.6), forearm_L=(0.5, 0), forearm_R=(0.5, 0), torso=(0.0, 0), bob=(0.3,))),
                 (30, dict(leg_L=(0.4, 0), leg_R=(0.4, 0), shin_L=(-0.8, 0), shin_R=(-0.8, 0), arm_L=(0.5, 0.4), arm_R=(0.5, -0.4), forearm_L=(0.5, 0), forearm_R=(0.5, 0), torso=(0.2, 0), bob=(-0.1,))),
                 (36, dict(leg_L=(0.02, 0), leg_R=(0.02, 0), arm_L=(0.02, 0.05), arm_R=(0.02, -0.05), forearm_L=(0.2, 0), forearm_R=(0.2, 0)))]
    gl = lambda t: dict(torso=(-0.08, 0), arm_L=(2.9, 0.1 + t), arm_R=(2.9, -0.1 + t), forearm_L=(0.15, 0), forearm_R=(0.15, 0), leg_L=(0.35, 0), leg_R=(-0.1, 0), shin_L=(-0.7, 0), shin_R=(-0.2, 0), head=(0.1, 0))
    R['glide'] = [(1, gl(-0.04)), (12, gl(0.04)), (24, gl(-0.04))]
    aim = lambda k: dict(torso=(0.0, 0), head=(0.0, 0), arm_R=(1.45 + k, 0.12), arm_L=(1.53 + k, -0.45), forearm_R=(0.8 - k * 3, 0), forearm_L=(0.12, 0), leg_L=(0.15, 0), leg_R=(-0.15, 0))
    R['shoot'] = [(1, aim(0)), (3, aim(0.13)), (8, aim(0.03)), (16, aim(0))]
    pk = lambda a, e, t: dict(torso=(0.0, 0, t), arm_R=(a, -0.1), forearm_R=(e, 0), arm_L=(0.2, 0.1), leg_L=(0.2, 0), leg_R=(-0.2, 0), head=(0.15, 0))
    R['pickaxe'] = [(1, pk(0.35, 0.35, 0)), (6, pk(2.9, 1.1, 0.0)), (10, pk(2.5, 1.1, 0)), (14, pk(0.6, 0.1, 0.0)), (18, pk(0.5, 0.2, 0)), (24, pk(0.35, 0.35, 0))]
    return R

def key_dict(f, d):   # normalise tuples (x,z) / (x,y,z)
    return d

def animate(arm):
    for name, frames in poses().items():
        act = bpy.data.actions.new(name); act.use_fake_user = True
        arm.animation_data_create(); arm.animation_data.action = act
        for f, pose in frames: key(arm, act, f, pose)
        for fc in act.fcurves if hasattr(act, 'fcurves') else []:
            for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
    arm.animation_data.action = bpy.data.actions['idle']
    for pb in arm.pose.bones: pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)

def export_rigged(root, arm, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        if o.type in ('MESH', 'ARMATURE'): o.select_set(True)
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_animations=True,
              export_animation_mode='ACTIONS', export_cameras=False, export_lights=False, export_texcoords=False)
    for attempt in range(4):
        try: bpy.ops.export_scene.gltf(**kw); break
        except TypeError as e:
            print('retry export', e); k = str(e).split("'")[1] if "'" in str(e) else None
            if k in kw: kw.pop(k)
            else: kw.pop('export_animation_mode', None)
    print('EXPORTED', path, os.path.getsize(path), 'bytes')

def build_rigged(outdir, cid='hero', O=None, offset=0.0):
    import json
    C.MATS.clear(); chars = json.load(open(os.path.join(H.HERE, 'specs', 'chars.json'))); S = chars[cid]
    d = S['defaults']; C.ROLE_DEFAULT.update({'skin': d['skin'], 'top': d['top'], 'top2': d['top2'], 'pants': d['pants'], 'hair': d['hair']})
    root = H.build_human(cid, S['outfit'])
    arm = make_armature('rig_' + cid); bind(root, arm); return arm

def build_rigged_files(outdir):
    for cid in ('hero', 'default'):
        C.reset(); C.BEVEL = 0.008
        arm = build_rigged(outdir, cid); animate(arm)
        export_rigged(None, arm, os.path.join(outdir, 'rigged_' + cid + '.glb'))
