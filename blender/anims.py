"""Animation library for the human rig (pure python, no bpy needed to evaluate).

Every clip is a function t -> pose, authored in the GAME's joint convention (three.js euler rotations, radians):
    torso  : whole upper body lean   (x<0 leans forward, x>0 back, y twist, z roll)
    head   : relative to torso        (x>0 looks up)
    arm_*  : relative to torso        (x>0 swings forward, z: arm_L +z / arm_R -z swing across the chest)
    forearm_*, shin_* : relative to their parent (x>0 bends forward for elbows, x<0 bends back for knees)
    leg_*  : relative to ROOT         (x>0 forward)
    root   : rotation of the whole body about the feet (spin, falling over)
    T      : translation of the hips (x,y,z) in metres (z<0 is forward)
The same data is (a) keyed on the Blender armature (rig_anim.py) and exported as glTF actions, and (b) written to js/animdata.js, which the
game uses as the keyframe fallback when the .glb clips are unavailable.   Run  `python3 blender/anims.py`  to (re)generate js/animdata.js.
"""
import math, json, os
S, Cs, PI = math.sin, math.cos, math.pi
JOINTS = ['torso', 'head', 'arm_L', 'arm_R', 'forearm_L', 'forearm_R', 'leg_L', 'leg_R', 'shin_L', 'shin_R', 'root', 'T']
ZERO = (0.0, 0.0, 0.0)

def mx(a): return a if a > 0 else 0.0
def sm(a, b, t):
    if b == a: return 1.0 if t >= b else 0.0
    k = min(1.0, max(0.0, (t - a) / (b - a))); return k * k * (3 - 2 * k)
def trap(t, a, b, c, d):   # 0 -> 1 on [a,b], 1 on [b,c], 1 -> 0 on [c,d]
    return sm(a, b, t) * (1 - sm(c, d, t))
def lerp(a, b, k): return a + (b - a) * k

class Pose(dict):
    """dict joint -> (x,y,z); missing joints are zero"""
    def __call__(self, **kw):
        for k, v in kw.items(): self[k] = tuple(list(v) + [0.0] * (3 - len(v)))
        return self
def P(**kw):
    p = Pose()
    for k, v in kw.items(): p[k] = tuple(list(v) + [0.0] * (3 - len(v)))
    return p
def add(*ps):
    o = Pose()
    for p in ps:
        for k, v in p.items():
            a = o.get(k, ZERO); o[k] = (a[0] + v[0], a[1] + v[1], a[2] + v[2])
    return o
def mix(a, b, k):
    o = Pose()
    for j in set(a) | set(b):
        va, vb = a.get(j, ZERO), b.get(j, ZERO); o[j] = tuple(va[i] + (vb[i] - va[i]) * k for i in range(3))
    return o
def scale(p, k): return Pose({j: tuple(x * k for x in v) for j, v in p.items()})
# side helpers: outward abduction value -> euler z (arm_L / leg_L: -z, arm_R / leg_R: +z)
def AL(x=0.0, out=0.0, tw=0.0): return (x, tw, -out)
def AR(x=0.0, out=0.0, tw=0.0): return (x, tw, out)

def reach(leg, shin):   # vertical reach of a leg for the hip-to-ground solve
    return Cs(leg[2]) * (0.42 * Cs(leg[0]) + 0.42 * Cs(leg[0] + shin[0]))
def ground(p, extra=0.0):
    """lower the hips so the lowest foot stays on the floor (cheap 'IK-lite')"""
    r = max(reach(p.get('leg_L', ZERO), p.get('shin_L', ZERO)), reach(p.get('leg_R', ZERO), p.get('shin_R', ZERO)))
    t = p.get('T', ZERO); p['T'] = (t[0], t[1] + min(0.0, r - 0.84) + extra, t[2]); return p

CLIPS = {}
def clip(name, dur, loop=True, hz=15, g=True, lin=False, fam=None):
    def deco(fn):
        CLIPS[name] = dict(dur=dur, loop=loop, hz=hz, fn=fn, g=g, lin=lin, fam=fam or name); return fn
    return deco

# ============================================================ locomotion
@clip('idle', 4.8, hz=15)
def _(t):
    w = 2 * PI * t / 4.8; br = S(w * 2); sh = S(w); look = S(w + 0.6)
    p = P(torso=(0.025 * br, 0.05 * sh, 0.035 * sh), head=(-0.02 * br + 0.04 * S(w * 2 + 1), 0.28 * look, -0.04 * sh),
          arm_L=AL(0.04 + 0.03 * br, 0.09 + 0.02 * br), arm_R=AR(0.04 - 0.02 * br, 0.09 + 0.02 * sh), forearm_L=(0.28 + 0.06 * br, 0, 0), forearm_R=(0.24 + 0.05 * S(w * 2 + 1), 0, 0),
          leg_L=(0.02, 0, -0.03 + 0.03 * sh), leg_R=(-0.02, 0, 0.03 + 0.03 * sh), shin_L=(-0.03 - 0.07 * mx(-sh), 0, 0), shin_R=(-0.03 - 0.07 * mx(sh), 0, 0),
          T=(0.03 * sh, 0.012 * br, 0))
    return ground(p)

def gait(t, dur, A, K, K0, AS, EL0, EL, LEAN, TW, rev=1, ARMOUT=0.06, hip=0.0):
    ph = 2 * PI * t / dur; s = S(ph) * rev; c = Cs(ph) * rev
    return ground(P(leg_L=(A * S(ph) * rev + hip, 0, 0), leg_R=(-A * S(ph) * rev + hip, 0, 0), shin_L=(-(K0 + K * mx(c)), 0, 0), shin_R=(-(K0 + K * mx(-c)), 0, 0),
        arm_L=AL(-AS * s, ARMOUT), arm_R=AR(AS * s, ARMOUT), forearm_L=(EL0 + EL * mx(-s), 0, 0), forearm_R=(EL0 + EL * mx(s), 0, 0),
        torso=(LEAN, TW * s, 0.03 * S(ph)), head=(-LEAN * 0.8, -TW * 0.9 * s, -0.02 * S(ph)), T=(0.02 * S(ph), 0, 0)))

clip('walk', 1.0, hz=30)(lambda t: gait(t, 1.0, 0.5, 0.65, 0.1, 0.5, 0.25, 0.35, -0.05, 0.14))
clip('run', 0.72, hz=30)(lambda t: gait(t, 0.72, 0.85, 1.0, 0.25, 0.95, 1.25, 0.35, -0.17, 0.2))
clip('sprint', 0.56, hz=30)(lambda t: gait(t, 0.56, 1.0, 1.35, 0.3, 1.15, 1.45, 0.25, -0.34, 0.26))
clip('back', 0.9, hz=30)(lambda t: gait(t, 0.9, 0.5, 0.8, 0.12, 0.35, 0.3, 0.25, 0.06, 0.1, rev=-1))

def strafe(t, side):
    ph = 2 * PI * t / 0.8; s = S(ph) * side; c = Cs(ph) * side
    oL = 0.2 + 0.2 * s * (1 if side > 0 else 1); oR = 0.2 - 0.2 * s
    # right strafe: right leg steps out (abducts) while the left follows; mirrored for side<0
    if side > 0: ou_R, ou_L = 0.26 + 0.26 * S(ph), 0.26 - 0.26 * S(ph)
    else: ou_L, ou_R = 0.26 + 0.26 * S(ph), 0.26 - 0.26 * S(ph)
    return ground(P(leg_L=(0.12 * S(ph), 0, -ou_L), leg_R=(-0.12 * S(ph), 0, ou_R), shin_L=(-0.12 - 0.45 * mx(S(ph + 1.57 * side)), 0, 0), shin_R=(-0.12 - 0.45 * mx(-S(ph + 1.57 * side)), 0, 0),
        arm_L=AL(-0.3 * S(ph), 0.08), arm_R=AR(0.3 * S(ph), 0.08), forearm_L=(0.5, 0, 0), forearm_R=(0.5, 0, 0), torso=(-0.08, 0.1 * S(ph), -0.07 * side), head=(0.04, -0.1 * S(ph), 0.05 * side),
        T=(0.03 * side * S(ph), 0, 0)))
clip('strafe_R', 0.8, hz=30)(lambda t: strafe(t, 1))
clip('strafe_L', 0.8, hz=30)(lambda t: strafe(t, -1))

@clip('jump', 1.1, loop=False, hz=30, g=False)
def _(t):
    k = [(0.0, P(leg_L=(0.15, 0, -0.03), leg_R=(-0.35, 0, 0.03), shin_L=(-0.15, 0, 0), shin_R=(-0.35, 0, 0), arm_L=AL(-0.4, 0.2), arm_R=AR(-0.4, 0.2), forearm_L=(0.3, 0, 0), forearm_R=(0.3, 0, 0), torso=(-0.1, 0, 0), T=(0, 0.0, 0))),
         (0.18, P(leg_L=(0.5, 0, -0.05), leg_R=(0.1, 0, 0.05), shin_L=(-1.0, 0, 0), shin_R=(-0.5, 0, 0), arm_L=AL(2.4, 0.5), arm_R=AR(2.4, 0.5), forearm_L=(0.4, 0, 0), forearm_R=(0.4, 0, 0), torso=(-0.12, 0, 0), head=(0.2, 0, 0), T=(0, 0.0, 0))),
         (0.42, P(leg_L=(0.8, 0, -0.1), leg_R=(0.6, 0, 0.1), shin_L=(-1.35, 0, 0), shin_R=(-1.2, 0, 0), arm_L=AL(1.9, 0.9), arm_R=AR(1.9, 0.9), forearm_L=(0.6, 0, 0), forearm_R=(0.6, 0, 0), torso=(-0.18, 0, 0), head=(0.15, 0, 0), T=(0, 0.0, 0))),
         (0.75, P(leg_L=(0.45, 0, -0.14), leg_R=(0.25, 0, 0.14), shin_L=(-0.55, 0, 0), shin_R=(-0.3, 0, 0), arm_L=AL(1.2, 1.2), arm_R=AR(1.2, 1.2), forearm_L=(0.5, 0, 0), forearm_R=(0.5, 0, 0), torso=(-0.06, 0, 0), head=(0.0, 0, 0))),
         (1.1, P(leg_L=(0.3, 0, -0.16), leg_R=(0.15, 0, 0.16), shin_L=(-0.35, 0, 0), shin_R=(-0.2, 0, 0), arm_L=AL(0.9, 1.3), arm_R=AR(0.9, 1.3), forearm_L=(0.4, 0, 0), forearm_R=(0.4, 0, 0), torso=(-0.03, 0, 0)))]
    return kf(k, t, False)

@clip('fall', 1.2, hz=15, g=False)
def _(t):
    w = 2 * PI * t / 1.2
    return P(leg_L=(0.35 + 0.1 * S(w), 0, -0.14), leg_R=(0.2 - 0.1 * S(w), 0, 0.14), shin_L=(-0.55 - 0.15 * S(w), 0, 0), shin_R=(-0.4 + 0.15 * S(w), 0, 0), arm_L=AL(0.9 + 0.35 * S(w), 1.25 + 0.15 * S(w + 1)), arm_R=AR(0.9 - 0.35 * S(w), 1.25 + 0.15 * S(w + 2)),
             forearm_L=(0.4, 0, 0), forearm_R=(0.4, 0, 0), torso=(-0.04, 0, 0.05 * S(w)), head=(0.1, 0, 0), T=(0, 0, 0))

@clip('land', 0.55, loop=False, hz=30)
def _(t):
    d = trap(t, 0.0, 0.14, 0.2, 0.55) ** 1.0; d = S(PI * min(1.0, t / 0.55)) ** 0.7 if t < 0.55 else 0
    p = P(leg_L=(0.95 * d, 0, -0.1 * d), leg_R=(0.8 * d, 0, 0.1 * d), shin_L=(-1.7 * d, 0, 0), shin_R=(-1.55 * d, 0, 0), torso=(-0.4 * d, 0, 0), head=(0.35 * d, 0, 0),
          arm_L=AL(0.9 * d, 0.6 * d), arm_R=AR(0.9 * d, 0.6 * d), forearm_L=(0.5 * d, 0, 0), forearm_R=(0.5 * d, 0, 0))
    return ground(p)

@clip('freefall', 1.6, hz=15, g=False)
def _(t):
    w = 2 * PI * t / 1.6
    return P(torso=(-1.3 + 0.04 * S(w), 0, 0.07 * S(w + 1)), head=(0.8, 0, 0.05 * S(w)), arm_L=AL(0.55 + 0.12 * S(w * 2), 1.3 + 0.1 * S(w)), arm_R=AR(0.55 + 0.12 * S(w * 2 + 1), 1.3 + 0.1 * S(w + 2)),
             forearm_L=(0.5 + 0.2 * S(w * 2), 0, 0), forearm_R=(0.5 + 0.2 * S(w * 2 + 1), 0, 0), leg_L=(-0.45 + 0.1 * S(w), 0, -0.3), leg_R=(-0.3 - 0.1 * S(w), 0, 0.3), shin_L=(-0.5 - 0.2 * S(w * 2), 0, 0), shin_R=(-0.35 - 0.2 * S(w * 2 + 1), 0, 0), T=(0, 0.1, 0))

@clip('dive', 1.2, hz=15, g=False)
def _(t):
    w = 2 * PI * t / 1.2
    return P(torso=(-1.5 + 0.02 * S(w), 0, 0.03 * S(w)), head=(0.6, 0, 0), arm_L=AL(-0.15 + 0.05 * S(w), 0.12), arm_R=AR(-0.15 - 0.05 * S(w), 0.12), forearm_L=(0.1, 0, 0), forearm_R=(0.1, 0, 0),
             leg_L=(-0.15, 0, -0.04), leg_R=(-0.1 + 0.05 * S(w), 0, 0.04), shin_L=(-0.2, 0, 0), shin_R=(-0.25 - 0.1 * S(w), 0, 0), T=(0, 0.1, 0))

@clip('glide', 3.0, hz=15, g=False)
def _(t):
    w = 2 * PI * t / 3.0
    return P(torso=(-0.1 + 0.02 * S(w * 2), 0.05 * S(w), 0.07 * S(w)), head=(0.15, 0.1 * S(w), -0.05 * S(w)), arm_L=AL(2.9, -0.08 + 0.06 * S(w)), arm_R=AR(2.9, -0.08 - 0.06 * S(w)), forearm_L=(0.15, 0, 0), forearm_R=(0.15, 0, 0),
             leg_L=(0.4 + 0.1 * S(w * 2), 0, -0.08), leg_R=(-0.05 - 0.1 * S(w * 2), 0, 0.08), shin_L=(-0.75 - 0.1 * S(w * 2 + 1), 0, 0), shin_R=(-0.25 + 0.1 * S(w * 2 + 1), 0, 0), T=(0.02 * S(w), 0.03 * S(w * 2), 0))

# ============================================================ weapons (upper-body holds / overlays)
def aimpose(kind, t=0.0):
    w = 2 * PI * t / 3.0; br = S(w * 1.0) * 0.012
    if kind == 'pistol':
        return P(torso=(0, 0, 0), head=(0.02, 0.05, 0), arm_R=AR(1.35 + br, -0.04), arm_L=AL(0.12 + br, 0.12), forearm_R=(0.47, 0, 0), forearm_L=(0.3, 0, 0))
    if kind == 'shotgun':
        return P(torso=(-0.03, 0, 0), head=(0.04, 0.05, 0), arm_R=AR(0.85 + br, -0.04), arm_L=AL(1.5 + br, -0.5), forearm_R=(1.23, 0, 0), forearm_L=(0.15, 0, 0))
    if kind == 'sniper':
        return P(torso=(-0.08, 0, 0), head=(0.0, 0.1, 0.12), arm_R=AR(0.9 + br, -0.04), arm_L=AL(1.55 + br, -0.6), forearm_R=(1.55, 0, 0), forearm_L=(0.12, 0, 0))
    if kind == 'rocket':
        return P(torso=(0.0, 0, 0), head=(0.0, 0.08, 0.05), arm_R=AR(1.0 + br, 0.35), arm_L=AL(1.45 + br, -0.5), forearm_R=(1.5, 0, 0), forearm_L=(0.3, 0, 0))
    return P(torso=(0, 0, 0), head=(0.02, 0.05, 0), arm_R=AR(0.85 + br, -0.04), arm_L=AL(1.53 + br, -0.45), forearm_R=(1.4, 0, 0), forearm_L=(0.12, 0, 0))   # rifle
for k_ in ('pistol', 'rifle', 'shotgun', 'sniper', 'rocket'):
    clip('aim_' + k_, 3.0, hz=15, g=False)((lambda kk: (lambda t: aimpose(kk, t)))(k_))

def shot(kind, kick, dur, extra=None):
    def f(t):
        base = aimpose(kind); e = math.exp(-t * (26 if dur < 0.4 else 12)) * min(1.0, t / 0.015 + 0.0) if t > 0 else 0
        e = max(0.0, (1 - math.exp(-t * 90))) * math.exp(-t * (24 if dur < 0.4 else 11))
        d = P(torso=(kick * 0.35 * e, 0, 0), head=(-kick * 0.25 * e, 0, 0), arm_R=(-kick * e, 0, 0), arm_L=(-kick * 0.8 * e, 0, 0), forearm_R=(kick * 1.8 * e, 0, 0))
        p = add(base, d)
        if extra: p = extra(t, p)
        return p
    return f
clip('shoot_pistol', 0.3, loop=False, hz=30, g=False)(shot('pistol', 0.22, 0.3))
clip('shoot_rifle', 0.22, loop=False, hz=30, g=False)(shot('rifle', 0.12, 0.22))
def pump(t, p):   # left hand pumps the shotgun after the kick
    k = trap(t, 0.28, 0.4, 0.46, 0.62); return add(p, P(arm_L=(-0.28 * k, 0, 0), forearm_L=(0.55 * k, 0, 0), torso=(0, 0.06 * k, 0)))
clip('shoot_shotgun', 0.8, loop=False, hz=30, g=False)(shot('shotgun', 0.5, 0.8, pump))
def bolt(t, p):   # sniper: right hand works the bolt
    k = trap(t, 0.35, 0.5, 0.7, 0.95); k2 = trap(t, 0.5, 0.6, 0.66, 0.8)
    return add(p, P(arm_R=(0.12 * k, 0, 0.18 * k), forearm_R=(0.3 * k - 0.25 * k2, 0, 0), head=(-0.06 * k, 0, 0)))
clip('shoot_sniper', 1.1, loop=False, hz=30, g=False)(shot('sniper', 0.55, 1.1, bolt))
clip('shoot_rocket', 0.7, loop=False, hz=30, g=False)(shot('rocket', 0.7, 0.7))

@clip('reload', 2.0, loop=False, hz=30, g=False)
def _(t):
    base = aimpose('rifle'); a = trap(t, 0.0, 0.25, 1.65, 1.95)      # hold the pose out of aim
    mag = trap(t, 0.2, 0.45, 0.6, 0.78) * (1 - trap(t, 0.78, 0.9, 1.1, 1.2)) + trap(t, 0.78, 0.9, 1.35, 1.5) * 0   # hand to magazine
    pull = sm(0.55, 0.75, t) * (1 - sm(0.78, 0.9, t))                                                              # mag out
    ins = trap(t, 0.9, 1.1, 1.2, 1.45)                                                                              # new mag in
    lo = trap(t, 0.2, 0.45, 1.45, 1.7)
    d = P(arm_R=AR(-0.45 * a, -0.0, 0), forearm_R=(0.35 * a, 0, 0), arm_L=AL(-0.55 * lo + 0.15 * pull - 0.1 * ins, 0.1 * lo), forearm_L=(0.9 * lo + 0.3 * pull - 0.2 * ins, 0, 0),
          head=(-0.35 * a + 0.1 * S(t * 9) * ins, 0, 0), torso=(-0.08 * a, 0.15 * a, 0))
    d['arm_L'] = (d['arm_L'][0], d['arm_L'][1], d['arm_L'][2] + 0.25 * lo)
    return add(base, d, P(torso=(0, 0.0, 0)))

@clip('reload_shotgun', 1.8, loop=False, hz=30, g=False)
def _(t):
    base = aimpose('shotgun'); a = trap(t, 0.0, 0.2, 1.55, 1.8)
    ins = [trap(t, 0.25 + 0.38 * i, 0.38 + 0.38 * i, 0.46 + 0.38 * i, 0.58 + 0.38 * i) for i in range(3)]; k = max(ins)
    d = P(arm_R=(-0.35 * a, 0, 0), forearm_R=(0.3 * a, 0, 0), arm_L=AL(-0.7 * a + 0.2 * k, -0.2 * a), forearm_L=(1.0 * a + 0.4 * k, 0, 0), head=(-0.3 * a, 0, 0), torso=(-0.1 * a, 0.1 * a, 0))
    return add(base, d)

@clip('equip', 0.5, loop=False, hz=30, g=False)
def _(t):
    k = sm(0.0, 0.42, t)
    low = P(arm_L=AL(0.15, 0.1), arm_R=AR(0.15, 0.1), forearm_L=(0.25, 0, 0), forearm_R=(0.25, 0, 0), torso=(0.04, 0, 0), head=(-0.1, 0, 0))
    return mix(low, aimpose('rifle'), k * k * (3 - 2 * k) if False else k)

# ============================================================ tools / actions
@clip('pickaxe_idle', 3.0, hz=15, g=False)
def _(t):
    w = 2 * PI * t / 3.0; br = S(w * 2)
    return P(torso=(0.02 * br, 0.05 * S(w), 0.02), head=(0.06 + 0.02 * br, 0.2 * S(w + 0.5), 0), arm_L=AL(0.05 + 0.02 * br, 0.1), arm_R=AR(0.4 + 0.03 * br, 0.1), forearm_R=(0.5 + 0.05 * br, 0, 0), forearm_L=(0.28, 0, 0))

def pk(a, e, tt, tw=0.0): return P(torso=(tt, tw, 0), head=(0.1, 0, 0), arm_R=AR(a, 0.1), forearm_R=(e, 0, 0), arm_L=AL(0.3, 0.1), forearm_L=(0.3, 0, 0))
@clip('pickaxe_swing', 0.5, loop=False, hz=30, g=False)
def _(t):
    k = [(0.0, pk(0.4, 0.5, 0.02)), (0.1, pk(2.75, 1.2, 0.14, 0.1)), (0.17, pk(2.95, 1.1, 0.16, 0.12)), (0.24, pk(0.9, 0.2, -0.28, -0.12)), (0.31, pk(0.55, 0.25, -0.22, -0.1)), (0.5, pk(0.4, 0.5, 0.02))]
    return kf(k, t, False)

@clip('build_idle', 2.4, hz=15, g=False)
def _(t):
    w = 2 * PI * t / 2.4
    return P(torso=(-0.03, 0, 0), head=(0.05, 0.1 * S(w), 0), arm_L=AL(1.15 + 0.03 * S(w * 2), -0.1), arm_R=AR(1.15 - 0.03 * S(w * 2), -0.1), forearm_L=(0.9, 0, 0), forearm_R=(0.9, 0, 0))
@clip('build_place', 0.35, loop=False, hz=30, g=False)
def _(t):
    k = S(PI * min(1.0, t / 0.35)); b = P(torso=(-0.03, 0, 0), arm_L=AL(1.15, -0.1), arm_R=AR(1.15, -0.1), forearm_L=(0.9, 0, 0), forearm_R=(0.9, 0, 0))
    return add(b, P(arm_L=(0.45 * k, 0, 0), arm_R=(0.45 * k, 0, 0), forearm_L=(-0.6 * k, 0, 0), forearm_R=(-0.6 * k, 0, 0), torso=(-0.14 * k, 0, 0)))

@clip('heal_apply', 1.6, hz=15, g=False)
def _(t):
    w = 2 * PI * t / 1.6
    return P(torso=(-0.12, 0, 0), head=(-0.4, 0, 0), arm_L=AL(0.9 + 0.1 * S(w), -0.55), arm_R=AR(0.9 - 0.1 * S(w), -0.55), forearm_L=(1.45 + 0.1 * S(w * 2), 0, 0), forearm_R=(1.45 - 0.1 * S(w * 2), 0, 0))
@clip('heal_drink', 2.4, hz=15, g=False)
def _(t):
    u = trap(t, 0.0, 0.55, 1.65, 2.2); sip = 0.5 + 0.5 * S(2 * PI * (t - 0.6) / 0.6) if 0.55 < t < 1.65 else 0.0
    return P(torso=(0.04 * u, 0, 0), head=(0.55 * u + 0.12 * sip, 0, 0), arm_R=AR(1.95 * u + 0.0 * sip, -0.3 * u), forearm_R=(2.1 * u + 0.15 * sip, 0, 0), arm_L=AL(0.5 * u, -0.1), forearm_L=(0.5 * u, 0, 0))

@clip('chest_open', 1.0, loop=False, hz=30, g=False)
def _(t):
    k = trap(t, 0.05, 0.3, 0.45, 0.62); l = trap(t, 0.4, 0.55, 0.62, 0.95)
    return P(torso=(-0.4 * k + 0.12 * l, 0, 0), head=(0.3 * k, 0, 0), arm_L=AL(1.1 * k + 0.9 * l, -0.1 * k), arm_R=AR(1.1 * k + 0.9 * l, -0.1 * k), forearm_L=(0.45 * k - 0.1 * l, 0, 0), forearm_R=(0.45 * k - 0.1 * l, 0, 0))

@clip('drive', 2.0, hz=15, g=False)
def _(t):
    w = 2 * PI * t / 2.0
    return P(torso=(0.06, 0.04 * S(w), 0.02 * S(w * 2)), head=(0.05, 0.12 * S(w + 1), 0), leg_L=(1.4, 0, -0.1), leg_R=(1.4, 0, 0.1), shin_L=(-1.4, 0, 0), shin_R=(-1.4, 0, 0),
             arm_L=AL(1.2 + 0.08 * S(w), -0.18), arm_R=AR(1.2 - 0.08 * S(w), -0.18), forearm_L=(0.3 + 0.1 * S(w), 0, 0), forearm_R=(0.3 - 0.1 * S(w), 0, 0), T=(0, -0.2, 0.0))

@clip('bush_hide', 2.4, hz=15, g=False)
def _(t):
    w = 2 * PI * t / 2.4
    return P(torso=(-0.55 + 0.02 * S(w * 2), 0, 0.03 * S(w)), head=(0.45, 0.55 * S(w), 0.05 * S(w)), leg_L=(1.25, 0, -0.18), leg_R=(1.15, 0, 0.18), shin_L=(-2.1, 0, 0), shin_R=(-2.0, 0, 0),
             arm_L=AL(0.85, -0.3), arm_R=AR(0.85, -0.3), forearm_L=(1.1, 0, 0), forearm_R=(1.1, 0, 0), T=(0, -0.43 + 0.012 * S(w * 2), 0.05))

@clip('throw', 0.8, loop=False, hz=30, g=False)
def _(t):
    wind = trap(t, 0.0, 0.25, 0.3, 0.38); th = trap(t, 0.3, 0.4, 0.46, 0.8)
    return P(torso=(0.08 * wind - 0.22 * th, 0.55 * wind - 0.7 * th, 0), head=(0.1 * wind, -0.2 * wind, 0), arm_R=AR(-0.9 * wind + 2.1 * th, 0.35 * wind - 0.1 * th), forearm_R=(1.35 * wind - 1.2 * th, 0, 0),
             arm_L=AL(1.1 * wind + 0.6 * th, -0.1 * wind), forearm_L=(0.5 * wind, 0, 0))

@clip('hit', 0.5, loop=False, hz=30, g=False)
def _(t):
    e = (1 - math.exp(-t * 60)) * math.exp(-t * 7.5); e2 = (1 - math.exp(-t * 40)) * math.exp(-t * 6)
    return P(torso=(0.32 * e, 0.14 * e, 0.12 * e), head=(0.4 * e, -0.2 * e, -0.2 * e), arm_L=AL(-0.5 * e2, 0.55 * e2), arm_R=AR(-0.35 * e2, 0.5 * e2), forearm_L=(0.5 * e2, 0, 0), forearm_R=(0.4 * e2, 0, 0))

@clip('death', 1.5, loop=False, hz=30, g=False)
def _(t):
    k = [(0.0, P(torso=(0.0, 0, 0))),
         (0.12, P(torso=(0.28, 0.1, 0.1), head=(0.4, 0, -0.2), arm_L=AL(-0.6, 0.6), arm_R=AR(-0.5, 0.55), forearm_L=(0.5, 0, 0), forearm_R=(0.4, 0, 0), leg_L=(0.1, 0, 0), shin_L=(-0.2, 0, 0))),
         (0.45, P(torso=(0.35, 0.15, 0.05), head=(0.35, 0, -0.1), arm_L=AL(-0.3, 0.9), arm_R=AR(-0.2, 0.8), forearm_L=(0.5, 0, 0), forearm_R=(0.5, 0, 0), leg_L=(0.55, 0, -0.1), leg_R=(0.35, 0, 0.1), shin_L=(-1.3, 0, 0), shin_R=(-0.9, 0, 0), T=(0, -0.38, 0.12), root=(0.28, 0, 0))),
         (0.85, P(torso=(0.15, 0.1, 0.0), head=(0.25, 0, 0.1), arm_L=AL(-0.2, 1.1), arm_R=AR(0.1, 1.0), forearm_L=(0.4, 0, 0), forearm_R=(0.3, 0, 0), leg_L=(0.35, 0, -0.18), leg_R=(0.1, 0, 0.2), shin_L=(-0.9, 0, 0), shin_R=(-0.4, 0, 0), T=(0, 0.0, 0.15), root=(1.1, 0, 0))),
         (1.2, P(torso=(0.0, 0.0, 0.0), head=(0.2, 0.3, 0.1), arm_L=AL(-0.1, 1.15), arm_R=AR(0.0, 0.95), forearm_L=(0.25, 0, 0), forearm_R=(0.2, 0, 0), leg_L=(0.12, 0, -0.2), leg_R=(0.02, 0, 0.22), shin_L=(-0.3, 0, 0), shin_R=(-0.1, 0, 0), T=(0, 0.17, 0.1), root=(1.5, 0, 0))),
         (1.5, P(torso=(0.0, 0.0, 0.0), head=(0.18, 0.3, 0.1), arm_L=AL(-0.1, 1.2), arm_R=AR(0.0, 1.0), forearm_L=(0.2, 0, 0), forearm_R=(0.2, 0, 0), leg_L=(0.1, 0, -0.22), leg_R=(0.0, 0, 0.24), shin_L=(-0.2, 0, 0), shin_R=(-0.08, 0, 0), T=(0, 0.19, 0.1), root=(1.52, 0, 0)))]
    return kf(k, t, False)

@clip('victory', 2.0, hz=15, g=False)
def _(t):
    w = 2 * PI * t / 1.0; hop = mx(S(w)) 
    return P(torso=(0.1, 0.12 * S(w / 2), 0.05 * S(w / 2)), head=(0.35, 0.2 * S(w / 2), 0), arm_L=AL(2.8 + 0.2 * S(w), 0.4 + 0.3 * hop), arm_R=AR(2.8 - 0.2 * S(w), 0.4 + 0.3 * hop), forearm_L=(0.4 + 0.5 * S(w), 0, 0), forearm_R=(0.4 - 0.5 * S(w), 0, 0),
             leg_L=(0.2 * hop, 0, -0.12), leg_R=(-0.1 * hop, 0, 0.12), shin_L=(-0.6 * hop, 0, 0), shin_R=(-0.5 * hop, 0, 0), T=(0, 0.2 * hop, 0))

# ============================================================ emotes
@clip('dance', 1.6, hz=30, g=False, fam='emote')
def _(t):
    b = 2 * PI * t / 0.8; w = 2 * PI * t / 1.6; s = S(b); c = Cs(b)
    p = P(torso=(0.06 * Cs(2 * b), 0.55 * S(w), 0.1 * s), head=(0.12 * Cs(2 * b), -0.3 * S(w), -0.12 * s),
          arm_L=AL(2.3 + 0.7 * s, 0.35 + 0.15 * c), arm_R=AR(2.3 - 0.7 * s, 0.35 - 0.15 * c), forearm_L=(0.9 + 0.55 * s, 0, 0), forearm_R=(0.9 - 0.55 * s, 0, 0),
          leg_L=(0.4 * mx(s), 0, -0.1 - 0.2 * mx(s)), leg_R=(0.4 * mx(-s), 0, 0.1 + 0.2 * mx(-s)), shin_L=(-0.35 - 0.45 * mx(c * s + 0.3), 0, 0), shin_R=(-0.35 - 0.45 * mx(-c * s + 0.3), 0, 0), T=(0.05 * S(w), 0.0, 0))
    return ground(p, 0.04 * abs(S(b)))
@clip('wave', 1.2, hz=30, g=False, fam='emote')
def _(t):
    w = 2 * PI * t / 0.4
    return ground(P(torso=(0.0, 0.1, 0.05), head=(0.05, 0.15, 0.12), arm_R=AR(0.25, 2.55), forearm_R=(0.3, 0.0, 0.55 * S(w)), arm_L=AL(0.04, 0.1), forearm_L=(0.25, 0, 0), leg_L=(0.0, 0, -0.02 + 0.03 * S(2 * PI * t / 1.2)), leg_R=(0.0, 0, 0.05), shin_L=(-0.06, 0, 0), shin_R=(-0.04, 0, 0)))
@clip('flex', 1.6, hz=30, g=False, fam='emote')
def _(t):
    w = 2 * PI * t / 0.8; pu = 0.5 + 0.5 * S(w)
    p = P(torso=(0.1 + 0.03 * pu, 0, 0.05 * S(w / 2)), head=(0.1, 0.0, 0.15 * S(2 * PI * t / 1.6)), arm_L=AL(1.5, 1.6 + 0.05 * pu), arm_R=AR(1.5, 1.6 + 0.05 * pu), forearm_L=(2.1 + 0.3 * pu, 0, 0), forearm_R=(2.1 + 0.3 * pu, 0, 0),
          leg_L=(0, 0, -0.2), leg_R=(0, 0, 0.2), shin_L=(-0.12 - 0.1 * pu, 0, 0), shin_R=(-0.12 - 0.1 * pu, 0, 0))
    return ground(p, 0.02 * pu)
@clip('spin', 0.7, hz=30, g=False, fam='emote')
def _(t):
    u = t / 0.7; ang = 2 * PI * u; hop = S(PI * u)
    return P(root=(0, ang, 0), torso=(0.04, 0, 0), head=(0.1, 0, 0), arm_L=AL(0.4, 1.55), arm_R=AR(0.4, 1.55), forearm_L=(0.4, 0, 0), forearm_R=(0.4, 0, 0), leg_L=(0.3 * hop, 0, -0.15), leg_R=(-0.1 * hop, 0, 0.15), shin_L=(-0.6 * hop, 0, 0), shin_R=(-0.5 * hop, 0, 0), T=(0, 0.28 * hop, 0))
@clip('clap', 1.2, hz=30, g=False, fam='emote')
def _(t):
    w = 2 * PI * t / 0.4; c = 0.5 + 0.5 * S(w)
    p = P(torso=(-0.05, 0, 0), head=(0.05 + 0.1 * S(w * 2), 0, 0), arm_L=AL(1.25, -0.1 - 0.28 * c), arm_R=AR(1.25, -0.1 - 0.28 * c), forearm_L=(1.25, 0, 0), forearm_R=(1.25, 0, 0), leg_L=(0, 0, -0.06), leg_R=(0, 0, 0.06), shin_L=(-0.1 - 0.1 * (1 - c), 0, 0), shin_R=(-0.1 - 0.1 * (1 - c), 0, 0))
    return ground(p, 0.015 * S(w * 2))
@clip('cheer', 1.6, hz=30, g=False, fam='emote')
def _(t):
    w = 2 * PI * t / 0.8; hop = mx(S(w)); s = S(w)
    return P(torso=(0.1, 0, 0.04 * S(w / 2)), head=(0.4, 0, 0.08 * s), arm_L=AL(0.4, 2.55 + 0.2 * hop), arm_R=AR(0.4, 2.55 + 0.2 * hop), forearm_L=(0.3 + 0.4 * hop, 0, 0), forearm_R=(0.3 + 0.4 * hop, 0, 0),
             leg_L=(0.15 * hop, 0, -0.1), leg_R=(-0.1 * hop, 0, 0.1), shin_L=(-0.55 * hop, 0, 0), shin_R=(-0.45 * hop, 0, 0), T=(0, 0.2 * hop, 0))
@clip('salute', 2.4, loop=False, hz=30, g=False, fam='emote')
def _(t):
    u = trap(t, 0.1, 0.45, 1.85, 2.3)
    return ground(P(torso=(0.02 * u, -0.1 * u, 0), head=(0.1 * u, -0.15 * u, 0), arm_R=(1.63 * u, 0.93 * u, 0.61 * u), forearm_R=(1.49 * u, 0.33 * u, 0.13 * u), arm_L=AL(0.0, 0.05), forearm_L=(0.1, 0, 0)))
@clip('bow', 2.4, loop=False, hz=30, g=False, fam='emote')
def _(t):
    u = trap(t, 0.1, 0.8, 1.5, 2.2)
    return ground(P(torso=(-1.0 * u, 0, 0), head=(0.25 * u, 0, 0), arm_R=AR(0.9 * u, -0.75 * u), forearm_R=(1.3 * u, 0, 0), arm_L=AL(-0.55 * u, -0.25 * u), forearm_L=(0.7 * u, 0, 0), leg_L=(0, 0, -0.02), leg_R=(0, 0, 0.02)))
@clip('shrug', 1.6, loop=False, hz=30, g=False, fam='emote')
def _(t):
    u = trap(t, 0.1, 0.35, 1.2, 1.5); p2 = 0.5 + 0.5 * S(2 * PI * (t - 0.2) / 0.5) if 0.2 < t < 1.2 else 0
    return ground(P(torso=(0.0, 0.0, 0.0), head=(0.1 * u, 0.2 * S(2 * PI * t / 0.8) * u, 0.2 * u), arm_L=AL(0.35 * u, 0.55 * u + 0.12 * p2 * u), arm_R=AR(0.35 * u, 0.55 * u + 0.12 * p2 * u), forearm_L=(1.45 * u, 0, 0), forearm_R=(1.45 * u, 0, 0),
                    T=(0, 0.02 * p2 * u, 0)))
def robot_pose(i):
    seq = [P(arm_L=AL(1.57, 0), arm_R=AR(0.0, 1.57), forearm_L=(1.57, 0, 0), forearm_R=(1.57, 0, 0), head=(0, 0.6, 0), torso=(0, 0.3, 0)),
           P(arm_L=AL(0.0, 1.57), arm_R=AR(1.57, 0), forearm_L=(1.57, 0, 0), forearm_R=(1.57, 0, 0), head=(0, -0.6, 0), torso=(0, -0.3, 0)),
           P(arm_L=AL(1.57, -0.6), arm_R=AR(1.57, -0.6), forearm_L=(0.0, 0, 0), forearm_R=(1.57, 0, 0), head=(0.3, 0, 0), torso=(0, 0, 0)),
           P(arm_L=AL(0.0, 1.57), arm_R=AR(0.0, 1.57), forearm_L=(1.57, 0, 0), forearm_R=(1.57, 0, 0), head=(0, 0, 0.35), torso=(0, 0, 0.0))]
    return seq[i % 4]
@clip('robot', 2.0, hz=30, g=False, lin=True, fam='emote')
def _(t):
    i = int(t / 0.5) % 4; k = sm(0.38, 0.5, t % 0.5); a = robot_pose(i); b = robot_pose(i + 1); p = mix(a, b, k)
    p['leg_L'] = (0.25 * (i % 2 == 0), 0, -0.1); p['leg_R'] = (0.25 * (i % 2 == 1), 0, 0.1)
    return ground(p)
@clip('jacks', 1.0, hz=30, g=False, fam='emote')
def _(t):
    u = 0.5 - 0.5 * Cs(2 * PI * t / 0.5); hop = 4 * u * (1 - u) * 0.5
    return P(torso=(0, 0, 0), head=(0.1, 0, 0), arm_L=AL(0.1, 0.1 + 2.7 * u), arm_R=AR(0.1, 0.1 + 2.7 * u), forearm_L=(0.2, 0, 0), forearm_R=(0.2, 0, 0), leg_L=(0, 0, -0.03 - 0.42 * u), leg_R=(0, 0, 0.03 + 0.42 * u), shin_L=(-0.1 - 0.15 * u, 0, 0), shin_R=(-0.1 - 0.15 * u, 0, 0), T=(0, 0.14 * hop - 0.03 * (1 - u), 0))
@clip('boxing', 1.2, hz=30, g=False, fam='emote')
def _(t):
    r = trap(t, 0.08, 0.2, 0.26, 0.4); l = trap(t, 0.6, 0.72, 0.78, 0.92); w = 2 * PI * t / 0.6
    p = P(torso=(-0.08, -0.5 * r + 0.5 * l + 0.0, 0), head=(0.05, 0.5 * r - 0.5 * l, 0.04 * S(w)),
          arm_L=AL(1.0 + 0.55 * l, -0.28 + 0.2 * l), arm_R=AR(1.0 + 0.55 * r, -0.28 + 0.2 * r), forearm_L=(2.0 - 1.9 * l, 0, 0), forearm_R=(2.0 - 1.9 * r, 0, 0),
          leg_L=(-0.25, 0, -0.14), leg_R=(0.3, 0, 0.14), shin_L=(-0.35 - 0.25 * S(w), 0, 0), shin_R=(-0.35 + 0.25 * S(w), 0, 0), T=(0, 0, 0))
    return ground(p, 0.02 * S(w))

EMOTES = ['dance', 'wave', 'flex', 'spin', 'clap', 'cheer', 'salute', 'bow', 'shrug', 'robot', 'jacks', 'boxing']

# ============================================================ keyframe interpolation helper
def cr(p0, p1, p2, p3, u):
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)
def kf(keys, t, loop):
    """keys [(time, pose)] with smoothstep-flavoured Catmull-Rom between them (clamped at the ends)"""
    if t <= keys[0][0]: return keys[0][1]
    if t >= keys[-1][0]: return keys[-1][1]
    for i in range(len(keys) - 1):
        if keys[i][0] <= t <= keys[i + 1][0]: break
    t0, p0 = keys[i]; t1, p1 = keys[i + 1]; u = (t - t0) / (t1 - t0); u = u * u * (3 - 2 * u)
    return mix(p0, p1, u)

# ============================================================ sampling / export
def sample(name, nkeys=None):
    c = CLIPS[name]; dur, hz = c['dur'], c['hz']
    n = int(round(dur * hz)) + (0 if c['loop'] else 1)
    return n, [c['fn'](i / hz) for i in range(n)]

def to_js(path):
    out = {}
    for name, c in CLIPS.items():
        n, poses = sample(name); joints = {}
        for j in JOINTS:
            flat = []
            for p in poses: flat += [round(v, 2) for v in p.get(j, ZERO)]
            if any(abs(v) > 0.0006 for v in flat): joints[j] = flat
        out[name] = dict(d=c['dur'], l=1 if c['loop'] else 0, hz=c['hz'], n=n, g=1 if c['g'] else 0, lin=1 if c['lin'] else 0, j=joints)
    s = '/* GENERATED by blender/anims.py - do not edit.  Keyframe copy of the Blender animation clips (fallback when the .glb clips are unavailable). */\n'
    s += 'window.G = window.G || {}; G.AnimData = { emotes: %s, clips: %s };\n' % (json.dumps(EMOTES), json.dumps(out, separators=(',', ':')))
    open(path, 'w').write(s); return len(s)

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__)); p = os.path.join(here, '..', 'js', 'animdata.js')
    print('wrote', p, to_js(p), 'bytes;', len(CLIPS), 'clips')
