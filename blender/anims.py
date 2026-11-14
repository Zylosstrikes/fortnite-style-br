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

# ============================================================ easing helpers (anticipation / overshoot)  [v2 animation pass]
def eob(u, s=1.70158):   # ease-out-back: overshoots past 1 then settles
    u = min(1.0, max(0.0, u)) - 1.0; return 1.0 + u * u * ((s + 1) * u + s)
def spring(t, w=18.0, z=7.0):   # 0 -> 1 with a damped overshoot
    return 1.0 - math.exp(-z * t) * Cs(w * t) if t > 0 else 0.0
def kick(t, a=90.0, d=12.0):     # fast attack, exponential decay (recoil impulses)
    return max(0.0, (1 - math.exp(-t * a))) * math.exp(-t * d) if t > 0 else 0.0
def rec(t, w=40.0, d=13.0):      # recoil impulse that overshoots back past rest once (damped sine, peak ~1)
    if t <= 0: return 0.0
    tp = math.atan(w / d) / w; pk = math.exp(-d * tp) * S(w * tp)
    return math.exp(-d * t) * S(w * t) / pk
def bump(t, a, b):               # 0 -> 1 -> 0 sine bump on [a,b]
    return S(PI * (t - a) / (b - a)) if a < t < b else 0.0
EASE = {'io': lambda u: u * u * (3 - 2 * u), 'o': lambda u: 1 - (1 - u) ** 3, 'i': lambda u: u ** 3, 'b': lambda u: eob(u, 2.2), 'bb': lambda u: eob(u, 3.2), 'l': lambda u: u}
def kfe(keys, t):
    """keyframes [(time, pose, ease)] ease in {'io' smoothstep, 'o' ease-out, 'i' ease-in, 'b'/'bb' ease-out-back (overshoot), 'l' linear}"""
    if t <= keys[0][0]: return keys[0][1]
    if t >= keys[-1][0]: return keys[-1][1]
    for i in range(len(keys) - 1):
        if keys[i][0] <= t <= keys[i + 1][0]: break
    t0, p0 = keys[i][0], keys[i][1]; t1, p1 = keys[i + 1][0], keys[i + 1][1]; e = keys[i + 1][2] if len(keys[i + 1]) > 2 else 'io'
    return mix(p0, p1, EASE[e]((t - t0) / (t1 - t0)))

# ============================================================ locomotion (v2: exaggerated, stylised)
@clip('idle', 8.0, hz=15)
def _(t):
    w = 2 * PI * t / 8.0; br = S(2 * PI * t / 2.0); sh = S(w * 2)                     # 4 breaths + 2 weight shifts per loop
    lookL = trap(t, 0.9, 1.4, 2.4, 2.9); lookR = trap(t, 3.2, 3.7, 4.5, 5.0)            # glance left, then right
    st = trap(t, 5.4, 6.1, 6.7, 7.5)                                                    # big overhead stretch
    yawn = trap(t, 5.6, 6.2, 6.6, 7.3)
    p = P(torso=(0.03 * br + 0.2 * st, 0.06 * sh + 0.12 * lookL - 0.12 * lookR, 0.06 * sh - 0.05 * st),
          head=(-0.03 * br + 0.06 * S(w * 3) + 0.35 * yawn - 0.06 * lookL, 0.55 * lookL - 0.6 * lookR, -0.07 * sh + 0.12 * lookL - 0.1 * lookR),
          arm_L=AL(0.05 + 0.04 * br + 2.75 * st, 0.12 + 0.03 * br + 0.25 * st), arm_R=AR(0.05 - 0.03 * br + 2.75 * st, 0.12 + 0.03 * sh + 0.25 * st),
          forearm_L=(0.32 + 0.08 * br + 0.5 * st, 0, 0), forearm_R=(0.28 + 0.06 * S(w * 2 + 1) + 0.5 * st, 0, 0),
          leg_L=(0.03 - 0.06 * mx(-sh), 0, -0.05 + 0.04 * sh), leg_R=(-0.03 + 0.06 * mx(sh), 0, 0.05 + 0.04 * sh),
          shin_L=(-0.04 - 0.22 * mx(-sh), 0, 0), shin_R=(-0.04 - 0.22 * mx(sh), 0, 0),
          root=(0, 0, 0.03 * sh), T=(0.06 * sh, 0.015 * br + 0.035 * st, 0))
    return ground(p, 0.035 * st)

def gait(t, dur, A, K, K0, AS, EL0, EL, LEAN, TW, rev=1, ARMOUT=0.06, hip=0.0):
    ph = 2 * PI * t / dur; s = S(ph) * rev; c = Cs(ph) * rev
    return ground(P(leg_L=(A * S(ph) * rev + hip, 0, 0), leg_R=(-A * S(ph) * rev + hip, 0, 0), shin_L=(-(K0 + K * mx(c)), 0, 0), shin_R=(-(K0 + K * mx(-c)), 0, 0),
        arm_L=AL(-AS * s, ARMOUT), arm_R=AR(AS * s, ARMOUT), forearm_L=(EL0 + EL * mx(-s), 0, 0), forearm_R=(EL0 + EL * mx(s), 0, 0),
        torso=(LEAN, TW * s, 0.03 * S(ph)), head=(-LEAN * 0.8, -TW * 0.9 * s, -0.02 * S(ph)), T=(0.02 * S(ph), 0, 0)))

def gait2(t, dur, A, KL, K, K0, AS, AF, EL0, EL, LEAN, TW, HIP, BOB, HB, ARMOUT=0.1, sweep=0.0, SWAY=0.04):
    """legs: sinusoid stride + knee lift on the swing phase (stance phase untouched -> feet stay planted);
       arms: pump opposite the legs (or, with sweep>0, held swept back behind the body); torso/hip counter-twist, hip sway, flight-phase bounce."""
    ph = 2 * PI * t / dur; s = S(ph); c = Cs(ph)
    p = P(leg_L=(A * s + KL * mx(c) ** 1.3, 0, -0.02), leg_R=(-A * s + KL * mx(-c) ** 1.3, 0, 0.02),
          shin_L=(-(K0 + K * mx(c)), 0, 0), shin_R=(-(K0 + K * mx(-c)), 0, 0),
          torso=(LEAN + 0.05 * Cs(2 * ph) * BOB / 0.07, (TW + HIP) * s, 0.07 * s), head=(-LEAN * 0.8 + HB * Cs(2 * ph), -TW * 0.85 * s, -0.06 * s),
          root=(0, -HIP * s, 0), T=(SWAY * s, 0, 0))
    if sweep:
        p['arm_L'] = AL(-sweep - 0.18 * s, ARMOUT, 0.25); p['arm_R'] = AR(-sweep + 0.18 * s, ARMOUT, -0.25)
        p['forearm_L'] = (EL0 + 0.1 * mx(-s), 0, 0); p['forearm_R'] = (EL0 + 0.1 * mx(s), 0, 0)
    else:
        p['arm_L'] = AL(-AS * s + AF, ARMOUT); p['arm_R'] = AR(AS * s + AF, ARMOUT)
        p['forearm_L'] = (EL0 + EL * mx(-s), 0, 0); p['forearm_R'] = (EL0 + EL * mx(s), 0, 0)
    return ground(p, BOB * s * s)

GAIT = {   # dur, A stride, KL knee lift, K knee bend, K0, AS arm swing, AF arm fwd, EL0, EL, LEAN, TW twist, HIP sway, BOB, HB head bob
    'walk':   (1.0, 0.55, 0.22, 0.75, 0.1, 0.62, 0.08, 0.3, 0.45, -0.08, 0.16, 0.08, 0.025, 0.05),
    'run':    (0.66, 0.92, 0.5, 1.35, 0.3, 1.25, 0.22, 1.25, 0.45, -0.36, 0.3, 0.17, 0.085, 0.12),
    'sprint': (0.52, 1.08, 0.6, 1.7, 0.35, 0.0, 0.0, 0.25, 0.0, -0.62, 0.14, 0.12, 0.1, 0.08),
}
clip('walk', 1.0, hz=30)(lambda t: gait2(t, *GAIT['walk']))
clip('run', 0.66, hz=30)(lambda t: gait2(t, *GAIT['run'], ARMOUT=0.14, SWAY=0.05))
clip('sprint', 0.52, hz=30)(lambda t: add(gait2(t, *GAIT['sprint'], ARMOUT=0.32, sweep=1.1, SWAY=0.03), P(head=(0.12, 0, 0))))
clip('back', 0.9, hz=30)(lambda t: gait(t, 0.9, 0.5, 0.8, 0.12, 0.35, 0.3, 0.25, 0.06, 0.1, rev=-1))

def stride(name):
    """distance the hips travel per cycle while a foot is planted (stance = thigh swinging back).  The game divides speed by this to set
       playback rate, so the planted foot moves backwards exactly as fast as the ground -> no foot sliding ('IK-lite' foot planting)."""
    c = CLIPS[name]; n = 120; zs = []; ls = []
    for i in range(n + 1):
        p = c['fn'](c['dur'] * i / n); l, k = p.get('leg_L', ZERO), p.get('shin_L', ZERO)
        zs.append(0.42 * S(l[0]) + 0.42 * S(l[0] + k[0])); ls.append(l[0])
    back = sum(abs(zs[i + 1] - zs[i]) for i in range(n) if ls[i + 1] * (1 if name != 'back' else -1) < ls[i] * (1 if name != 'back' else -1))
    return round(2 * back, 3)


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

# ---- jump: anticipation squat -> stretch (overshoot) -> tuck -> open up for the fall
def _jp(leg=(0, 0), shin=(0, 0), arm=(0, 0), out=(0.2, 0.2), fore=(0.3, 0.3), torso=0.0, head=0.0, Ty=0.0, tw=0.0):
    return P(leg_L=(leg[0], 0, -0.06), leg_R=(leg[1], 0, 0.06), shin_L=(shin[0], 0, 0), shin_R=(shin[1], 0, 0), arm_L=AL(arm[0], out[0]), arm_R=AR(arm[1], out[1]),
             forearm_L=(fore[0], 0, 0), forearm_R=(fore[1], 0, 0), torso=(torso, tw, 0), head=(head, -tw * 0.5, 0), T=(0, Ty, 0))
JUMP_K = [(0.00, _jp(leg=(0.7, 0.55), shin=(-1.35, -1.2), arm=(-0.9, -0.9), out=(0.25, 0.25), fore=(0.4, 0.4), torso=-0.5, head=0.35, Ty=-0.32)),     # squat (anticipation)
          (0.13, _jp(leg=(-0.12, -0.32), shin=(-0.08, -0.25), arm=(2.85, 2.6), out=(0.35, 0.4), fore=(0.15, 0.2), torso=0.16, head=0.3, Ty=0.1), 'b'),  # stretch, overshoot
          (0.40, _jp(leg=(1.15, 0.9), shin=(-1.95, -1.75), arm=(1.5, 1.3), out=(0.75, 0.8), fore=(1.15, 1.0), torso=-0.3, head=0.15, Ty=0.05, tw=0.12), 'o'),  # tuck
          (0.78, _jp(leg=(0.5, 0.12), shin=(-0.7, -0.3), arm=(1.1, 1.0), out=(1.25, 1.2), fore=(0.5, 0.45), torso=-0.06, head=0.05, tw=-0.05)),   # open / balance
          (1.10, _jp(leg=(0.38, 0.1), shin=(-0.45, -0.22), arm=(0.95, 0.9), out=(1.3, 1.3), fore=(0.4, 0.4), torso=-0.03))]
clip('jump', 1.1, loop=False, hz=30, g=False)(lambda t: kfe(JUMP_K, t))

@clip('fall', 1.0, hz=30, g=False)
def _(t):   # cartoon flail: arms windmill, legs bicycle
    w = 2 * PI * t / 1.0
    return P(leg_L=(0.45 + 0.35 * S(w), 0, -0.14), leg_R=(0.45 - 0.35 * S(w), 0, 0.14), shin_L=(-0.75 - 0.45 * Cs(w), 0, 0), shin_R=(-0.75 + 0.45 * Cs(w), 0, 0),
             arm_L=AL(1.0 + 0.7 * S(w), 1.2 + 0.35 * Cs(w)), arm_R=AR(1.0 - 0.7 * S(w), 1.2 - 0.35 * Cs(w)), forearm_L=(0.5 + 0.3 * S(w + 1), 0, 0), forearm_R=(0.5 - 0.3 * S(w + 1), 0, 0),
             torso=(-0.08, 0.06 * S(w), 0.07 * S(w)), head=(0.18, 0.1 * S(w + 0.5), 0), T=(0, 0, 0))

@clip('land', 0.6, loop=False, hz=30)
def _(t):   # squash on impact, spring back up with a little stretch overshoot
    d = (1 - math.exp(-t * 70)) * math.exp(-t * 6.0) * Cs(t * 8.2) if t > 0 else 0.0
    st = mx(-d)
    p = P(leg_L=(1.0 * mx(d), 0, -0.1 - 0.08 * mx(d)), leg_R=(0.85 * mx(d), 0, 0.1 + 0.08 * mx(d)), shin_L=(-1.85 * mx(d), 0, 0), shin_R=(-1.7 * mx(d), 0, 0),
          torso=(-0.5 * mx(d) + 0.25 * st, 0, 0), head=(0.42 * mx(d) + 0.2 * st, 0, 0),
          arm_L=AL(0.95 * mx(d) + 1.2 * st, 0.75 * mx(d) + 0.5 * st), arm_R=AR(0.95 * mx(d) + 1.2 * st, 0.75 * mx(d) + 0.5 * st), forearm_L=(0.6 * mx(d), 0, 0), forearm_R=(0.6 * mx(d), 0, 0))
    return ground(p, 0.25 * st)

def _bodypitch(a):   # whole-body pitch about the feet, with the hips moved back over the origin
    return dict(root=(a, 0, 0), T=(0, 0.84 - 0.84 * Cs(a), -0.84 * S(a)))

@clip('freefall', 1.6, hz=30, g=False)
def _(t):   # skydive spread-eagle: belly down, arms + legs wide, flapping
    w = 2 * PI * t / 1.6; f = 2 * w; a = -1.18 + 0.05 * S(w)
    p = P(torso=(-0.18, 0.04 * S(w), 0.06 * S(w + 1)), head=(1.05, 0.12 * S(w + 0.4), 0),
          arm_L=AL(0.35 + 0.12 * S(f + 0.5), 1.35 + 0.32 * S(f)), arm_R=AR(0.35 + 0.12 * S(f + 0.5), 1.35 + 0.32 * S(f)),
          forearm_L=(0.45 + 0.35 * S(f - 0.7), 0, 0), forearm_R=(0.45 + 0.35 * S(f - 0.7), 0, 0),
          leg_L=(0.05 + 0.08 * S(f + 1.2), 0, -(0.5 + 0.14 * S(f + 0.9))), leg_R=(0.05 + 0.08 * S(f + 1.2), 0, 0.5 + 0.14 * S(f + 0.9)),
          shin_L=(-0.6 - 0.3 * S(f + 1.6), 0, 0), shin_R=(-0.6 - 0.3 * S(f + 1.6), 0, 0))
    p(**_bodypitch(a)); r = p['root']; p['root'] = (r[0], 0, 0.1 * S(w)); return p

@clip('dive', 1.2, hz=30, g=False)
def _(t):   # head-first streamline, arms swept back, legs together with a flutter
    w = 2 * PI * t / 1.2; a = -1.42 + 0.03 * S(w)
    p = P(torso=(-0.06, 0, 0.04 * S(w)), head=(0.95, 0, 0), arm_L=AL(-0.35 + 0.06 * S(2 * w), 0.22 + 0.06 * S(2 * w)), arm_R=AR(-0.35 + 0.06 * S(2 * w + 1), 0.22 + 0.06 * S(2 * w + 1)),
          forearm_L=(0.1, 0, 0), forearm_R=(0.1, 0, 0), leg_L=(-0.06 + 0.1 * S(3 * w), 0, -0.04), leg_R=(-0.06 - 0.1 * S(3 * w), 0, 0.04), shin_L=(-0.2 - 0.15 * mx(S(3 * w)), 0, 0), shin_R=(-0.2 - 0.15 * mx(-S(3 * w)), 0, 0))
    p(**_bodypitch(a)); r = p['root']; p['root'] = (r[0], 0, 0.06 * S(w)); return p

@clip('glide', 3.0, hz=15, g=False)
def _(t):   # both hands on the glider bar, body swaying under it, legs kicking lazily
    w = 2 * PI * t / 3.0; k = 2 * w
    return P(torso=(-0.12 + 0.04 * S(k), 0.08 * S(w), 0.14 * S(w)), head=(0.2, 0.18 * S(w + 0.6), -0.08 * S(w)),
             arm_L=AL(2.95 - 0.06 * S(w), -0.12 + 0.1 * S(w)), arm_R=AR(2.95 + 0.06 * S(w), -0.12 - 0.1 * S(w)), forearm_L=(0.25 + 0.1 * S(w), 0, 0), forearm_R=(0.25 - 0.1 * S(w), 0, 0),
             leg_L=(0.45 + 0.25 * S(k), 0, -0.1 - 0.05 * S(w)), leg_R=(0.05 - 0.25 * S(k), 0, 0.1 - 0.05 * S(w)), shin_L=(-0.85 - 0.2 * S(k + 1), 0, 0), shin_R=(-0.35 + 0.2 * S(k + 1), 0, 0),
             root=(0, 0, 0.1 * S(w)), T=(0.06 * S(w), 0.04 * S(k), 0))


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

# ---- shots: recoil kick + shoulder shove per weapon class, overshooting back past the aim pose before settling
RECOIL = {   # back lean, shoulder twist, roll, right-arm kick, left-arm kick, wrist flick, head, w, d
    'pistol':  dict(back=0.08, tw=0.06, roll=0.03, ar=-0.42, al=-0.1, fr=0.7, hd=-0.12, w=38, d=14),
    'rifle':   dict(back=0.1, tw=0.13, roll=0.05, ar=-0.2, al=-0.16, fr=0.32, hd=-0.1, w=55, d=20),
    'shotgun': dict(back=0.3, tw=0.28, roll=0.1, ar=-0.6, al=-0.45, fr=0.85, hd=-0.28, w=26, d=9),
    'sniper':  dict(back=0.34, tw=0.24, roll=0.12, ar=-0.55, al=-0.42, fr=0.75, hd=-0.3, w=22, d=7.5),
    'rocket':  dict(back=0.42, tw=0.32, roll=0.14, ar=-0.35, al=-0.3, fr=0.4, hd=-0.32, w=16, d=6),
}
def shot(kind, extra=None):
    R = RECOIL[kind]
    def f(t):
        e = rec(t, R['w'], R['d'])
        d = P(torso=(R['back'] * e, R['tw'] * e, -R['roll'] * e), head=(R['hd'] * e, -R['tw'] * 0.6 * e, R['roll'] * 0.5 * e),
              arm_R=(R['ar'] * e, 0, 0.05 * e), arm_L=(R['al'] * e, 0, 0), forearm_R=(R['fr'] * e, 0, 0), forearm_L=(0.25 * R['al'] * e, 0, 0))
        p = add(aimpose(kind), d)
        return extra(t, p) if extra else p
    return f
clip('shoot_pistol', 0.32, loop=False, hz=30, g=False)(shot('pistol'))
clip('shoot_rifle', 0.22, loop=False, hz=30, g=False)(shot('rifle'))
def pump(t, p):   # left hand racks the pump with a body jolt
    k = trap(t, 0.28, 0.38, 0.44, 0.6); return add(p, P(arm_L=(-0.32 * k, 0, 0), forearm_L=(0.6 * k, 0, 0), torso=(0.04 * k, 0.1 * k, 0), head=(0.06 * k, 0, 0)))
clip('shoot_shotgun', 0.8, loop=False, hz=30, g=False)(shot('shotgun', pump))
def bolt(t, p):   # sniper: right hand works the bolt
    k = trap(t, 0.4, 0.52, 0.72, 0.95); k2 = trap(t, 0.52, 0.6, 0.66, 0.8)
    return add(p, P(arm_R=(0.14 * k, 0, 0.2 * k), forearm_R=(0.32 * k - 0.28 * k2, 0, 0), head=(-0.08 * k, 0.1 * k, 0)))
clip('shoot_sniper', 1.1, loop=False, hz=30, g=False)(shot('sniper', bolt))
clip('shoot_rocket', 0.8, loop=False, hz=30, g=False)(shot('rocket'))

# ---- reloads.  The weapon flip itself (a full spin of the gun around the grip) is applied by js/anim.js on the hand holder during the
#      'flip' window listed in FLIPS (seconds into the clip); the arms throw it up and catch it here.
FLIPS = {'reload': (1.22, 1.68), 'reload_shotgun': (1.36, 1.78)}
@clip('reload', 2.0, loop=False, hz=30, g=False)
def _(t):
    base = aimpose('rifle'); dn = trap(t, 0.0, 0.2, 1.75, 1.97)                                  # weapon tipped down + in, out of aim
    grab = trap(t, 0.18, 0.32, 0.4, 0.5)                                                         # left hand to the mag
    toss = bump(t, 0.42, 0.72)                                                                    # rip it out and fling it away
    fetch = trap(t, 0.66, 0.8, 0.86, 0.95)                                                        # new mag from the belt
    slap = bump(t, 0.95, 1.12); seat = trap(t, 0.92, 1.0, 1.08, 1.2)                              # slam it home (with a jolt)
    th = bump(t, FLIPS['reload'][0] - 0.06, FLIPS['reload'][1] + 0.04)                            # throw the gun up / catch
    d = P(arm_R=AR(-0.5 * dn + 0.55 * th, 0.0, 0), forearm_R=(0.35 * dn + 0.35 * th, 0, 0),
          arm_L=AL(-0.5 * grab - 0.9 * toss - 0.55 * fetch + 0.25 * seat, 0.12 * grab + 0.9 * toss + 0.25 * fetch), forearm_L=(0.95 * grab + 0.2 * toss + 0.6 * fetch + 0.9 * seat, 0, 0),
          head=(-0.38 * dn + 0.12 * slap + 0.35 * th, -0.25 * toss, 0.06 * slap), torso=(-0.1 * dn + 0.1 * slap, 0.18 * dn - 0.12 * toss, -0.06 * slap))
    return add(base, d)

@clip('reload_shotgun', 2.0, loop=False, hz=30, g=False)
def _(t):
    base = aimpose('shotgun'); a = trap(t, 0.0, 0.18, 1.8, 2.0)
    ins = [bump(t, 0.24 + 0.34 * i, 0.5 + 0.34 * i) for i in range(3)]; k = max(ins)
    th = bump(t, FLIPS['reload_shotgun'][0] - 0.06, FLIPS['reload_shotgun'][1] + 0.04)
    d = P(arm_R=(-0.35 * a + 0.5 * th, 0, 0), forearm_R=(0.3 * a + 0.3 * th, 0, 0), arm_L=AL(-0.7 * a + 0.35 * k, -0.2 * a), forearm_L=(1.0 * a + 0.55 * k, 0, 0),
          head=(-0.3 * a + 0.08 * k + 0.3 * th, 0, 0), torso=(-0.1 * a + 0.06 * k, 0.1 * a, 0.04 * k))
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

# ---- pickaxe: big wind-up over the shoulder (anticipation), whip down through the hit at ~0.2 s, follow-through low, recover with overshoot
def pk(a, e, tt, tw=0.0, la=0.3, hd=0.1, out=0.1, lean=0.0):
    return P(torso=(tt, tw, lean), head=(hd, -tw * 0.5, 0), arm_R=AR(a, out), forearm_R=(e, 0, 0), arm_L=AL(la, 0.15), forearm_L=(0.45, 0, 0))
PICK_K = [(0.0, pk(0.4, 0.5, 0.02)),
          (0.12, pk(3.05, 1.45, 0.24, 0.42, la=0.9, hd=0.25, out=0.25, lean=0.06), 'o'),     # cocked back, chest open, weight back
          (0.16, pk(3.15, 1.5, 0.26, 0.45, la=1.0, hd=0.25, out=0.25, lean=0.06)),           # hang
          (0.23, pk(0.75, 0.1, -0.42, -0.3, la=-0.2, hd=-0.05, out=0.0, lean=-0.04), 'i'),   # whip through (hit at 0.2)
          (0.33, pk(0.25, 0.25, -0.38, -0.36, la=-0.35, hd=-0.08, out=0.0), 'o'),              # follow-through
          (0.5, pk(0.4, 0.5, 0.02), 'b')]
clip('pickaxe_swing', 0.5, loop=False, hz=30, g=False)(lambda t: kfe(PICK_K, t))

# ---- building: hands up, ready; each placement is a quick slap (alternating hands)
@clip('build_idle', 2.4, hz=15, g=False)
def _(t):
    w = 2 * PI * t / 2.4
    return P(torso=(-0.05, 0.04 * S(w), 0), head=(0.06, 0.12 * S(w), 0), arm_L=AL(1.2 + 0.06 * S(w * 2), -0.12), arm_R=AR(1.2 - 0.06 * S(w * 2), -0.12), forearm_L=(1.0 + 0.08 * S(w * 2), 0, 0), forearm_R=(1.0 - 0.08 * S(w * 2), 0, 0))
def slap(side):
    def f(t):
        b = P(torso=(-0.05, 0, 0), arm_L=AL(1.2, -0.12), arm_R=AR(1.2, -0.12), forearm_L=(1.0, 0, 0), forearm_R=(1.0, 0, 0))
        k = rec(t, 30, 11)                       # snap out, overshoot back
        cock = bump(t, 0.0, 0.06)                # tiny wind-up
        o = P(torso=(-0.12 * k, 0.28 * k * side, 0), head=(-0.05 * k, -0.12 * k * side, 0))
        hand, other = ('arm_R', 'arm_L') if side > 0 else ('arm_L', 'arm_R'); fh, fo = ('forearm_R', 'forearm_L') if side > 0 else ('forearm_L', 'forearm_R')
        o[hand] = (0.45 * k - 0.25 * cock, 0, 0); o[fh] = (-0.95 * k + 0.4 * cock, 0, 0); o[other] = (-0.25 * k, 0, 0); o[fo] = (0.3 * k, 0, 0)
        return add(b, o)
    return f
clip('build_place', 0.35, loop=False, hz=30, g=False)(slap(1))
clip('build_place_L', 0.35, loop=False, hz=30, g=False)(slap(-1))


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

# ---- elimination: knocked back with a twist, knees buckle, slam down on the back, bounce, settle
def _dp(root=(0, 0, 0), T=(0, 0, 0), torso=(0, 0, 0), head=(0, 0, 0), al=(0, 0.05), ar=(0, 0.05), fl=0.2, fr=0.2, ll=(0, -0.04), lr=(0, 0.04), sl=0.0, sr=0.0):
    return P(root=root, T=T, torso=torso, head=head, arm_L=AL(*al), arm_R=AR(*ar), forearm_L=(fl, 0, 0), forearm_R=(fr, 0, 0), leg_L=(ll[0], 0, ll[1]), leg_R=(lr[0], 0, lr[1]), shin_L=(sl, 0, 0), shin_R=(sr, 0, 0))
DEATH_K = [(0.0, _dp()),
           (0.1, _dp(root=(0.05, 0.25, 0), torso=(0.38, 0.25, 0.18), head=(0.55, 0, -0.3), al=(-0.5, 1.1), ar=(-0.3, 0.95), fl=0.6, fr=0.5, ll=(0.25, -0.06), sl=-0.35), 'o'),
           (0.4, _dp(root=(0.3, 0.6, 0.05), T=(0, -0.42, 0.12), torso=(0.3, 0.2, 0.05), head=(0.35, 0, -0.1), al=(-0.3, 1.0), ar=(-0.2, 0.9), fl=0.5, fr=0.5, ll=(0.65, -0.1), lr=(0.4, 0.1), sl=-1.5, sr=-1.0)),
           (0.7, _dp(root=(1.62, 0.85, 0.1), T=(0, 0.15, 0.1), torso=(0.05, 0.1, 0), head=(0.3, 0.2, 0.15), al=(-0.2, 1.35), ar=(0.1, 1.2), fl=0.3, fr=0.25, ll=(0.45, -0.2), lr=(0.15, 0.22), sl=-0.9, sr=-0.4), 'i'),
           (0.86, _dp(root=(1.36, 0.88, 0.08), T=(0, 0.24, 0.1), torso=(0.12, 0.1, 0), head=(0.12, 0.25, 0.1), al=(-0.05, 1.05), ar=(0.25, 1.0), fl=0.55, fr=0.45, ll=(0.62, -0.18), lr=(0.32, 0.22), sl=-1.1, sr=-0.7), 'o'),
           (1.02, _dp(root=(1.56, 0.9, 0.1), T=(0, 0.18, 0.1), torso=(0.0, 0.05, 0), head=(0.22, 0.35, 0.12), al=(-0.1, 1.25), ar=(0.05, 1.05), fl=0.25, fr=0.2, ll=(0.2, -0.22), lr=(0.05, 0.24), sl=-0.35, sr=-0.12), 'i'),
           (1.2, _dp(root=(1.5, 0.9, 0.1), T=(0, 0.2, 0.1), torso=(0.0, 0.0, 0), head=(0.2, 0.32, 0.1), al=(-0.1, 1.2), ar=(0.0, 1.0), fl=0.2, fr=0.2, ll=(0.12, -0.22), lr=(0.02, 0.24), sl=-0.25, sr=-0.1), 'o'),
           (1.6, _dp(root=(1.52, 0.9, 0.1), T=(0, 0.19, 0.1), head=(0.18, 0.3, 0.1), al=(-0.1, 1.22), ar=(0.0, 1.02), fl=0.2, fr=0.2, ll=(0.1, -0.22), lr=(0.0, 0.24), sl=-0.2, sr=-0.08))]
clip('death', 1.6, loop=False, hz=30, g=False)(lambda t: kfe(DEATH_K, t))

@clip('victory', 2.0, hz=30, g=False)
def _(t):   # alternates a jumping V (both fists up) with a hip-shaking double fist pump
    c = 0.5 - 0.5 * Cs(PI * t)                  # 0 -> 1 -> 0 over the loop
    hop = mx(S(2 * PI * t / 0.5)) ** 0.8 * (1 - c); pump = S(2 * PI * t / 0.5); shake = S(2 * PI * t / 0.25) * c
    p = P(torso=(0.18 * (1 - c) + 0.05 * c, 0.15 * shake, 0.08 * shake), head=(0.45 * (1 - c) + 0.15 * c, -0.1 * shake, 0.1 * shake),
          arm_L=AL(lerp(2.75, 3.0 - 1.6 * mx(-pump), c), lerp(0.55 + 0.2 * hop, 0.15, c)), arm_R=AR(lerp(2.75, 3.0 - 1.6 * mx(pump), c), lerp(0.55 + 0.2 * hop, 0.15, c)),
          forearm_L=(lerp(0.3 + 0.4 * hop, 0.3 + 1.6 * mx(-pump), c), 0, 0), forearm_R=(lerp(0.3 + 0.4 * hop, 0.3 + 1.6 * mx(pump), c), 0, 0),
          leg_L=(0.3 * hop, 0, -0.12 - 0.05 * c), leg_R=(-0.15 * hop, 0, 0.12 + 0.05 * c), shin_L=(-0.75 * hop - 0.15 * c, 0, 0), shin_R=(-0.6 * hop - 0.15 * c, 0, 0),
          root=(0, 0, 0), T=(0.05 * shake, 0.32 * hop, 0))
    return p

# ============================================================ emotes (all original choreography)
def E(name, dur, loop=True, lin=False):
    return clip(name, dur, loop=loop, hz=30, g=False, lin=lin, fam='emote')

@E('dance', 1.6)
def _(t):   # bouncy groove: hips pop on every beat, arms swing overhead
    b = 2 * PI * t / 0.8; w = 2 * PI * t / 1.6; s = S(b); c = Cs(b)
    p = P(torso=(0.1 * Cs(2 * b), 0.7 * S(w), 0.16 * s), head=(0.2 * Cs(2 * b), -0.4 * S(w), -0.18 * s),
          arm_L=AL(2.4 + 0.9 * s, 0.45 + 0.25 * c), arm_R=AR(2.4 - 0.9 * s, 0.45 - 0.25 * c), forearm_L=(0.9 + 0.7 * s, 0, 0), forearm_R=(0.9 - 0.7 * s, 0, 0),
          leg_L=(0.55 * mx(s), 0, -0.12 - 0.25 * mx(s)), leg_R=(0.55 * mx(-s), 0, 0.12 + 0.25 * mx(-s)), shin_L=(-0.4 - 0.6 * mx(c * s + 0.3), 0, 0), shin_R=(-0.4 - 0.6 * mx(-c * s + 0.3), 0, 0),
          root=(0, 0, 0.06 * s), T=(0.09 * S(w), 0.0, 0))
    return ground(p, 0.09 * abs(S(b)))
@E('wave', 1.2)
def _(t):   # big overhead wave with the whole body swaying into it, other hand on the hip
    w = 2 * PI * t / 0.4; v = 2 * PI * t / 1.2
    return ground(P(torso=(0.06, 0.15 + 0.08 * S(v), 0.12 + 0.12 * S(v)), head=(0.12, 0.2, 0.18 * S(v)), arm_R=AR(0.3, 2.75 + 0.15 * S(w)), forearm_R=(0.35, 0.0, 0.8 * S(w)),
                    arm_L=AL(-0.25, 0.6), forearm_L=(1.7, 0, 0), leg_L=(0.0, 0, -0.04 + 0.06 * S(v)), leg_R=(0.0, 0, 0.08), shin_L=(-0.06 - 0.2 * mx(S(v)), 0, 0), shin_R=(-0.04 - 0.2 * mx(-S(v)), 0, 0),
                    T=(0.06 * S(v), 0, 0)), 0.04 * abs(S(w / 2)))
@E('flex', 1.6)
def _(t):   # front double-biceps, hop, then a hunched "crab" squeeze
    c = 0.5 - 0.5 * Cs(2 * PI * t / 1.6); w = 2 * PI * t / 0.4; pu = 0.5 + 0.5 * S(w); hop = bump((t % 0.8), 0.32, 0.48) * 1.0
    a = P(torso=(0.14 + 0.04 * pu, 0, 0.06 * S(w / 2)), head=(0.14, 0.0, 0.2 * S(w / 4)), arm_L=AL(1.5, 1.65 + 0.08 * pu), arm_R=AR(1.5, 1.65 + 0.08 * pu), forearm_L=(2.2 + 0.35 * pu, 0, 0), forearm_R=(2.2 + 0.35 * pu, 0, 0),
          leg_L=(0, 0, -0.24), leg_R=(0, 0, 0.24), shin_L=(-0.15 - 0.15 * pu, 0, 0), shin_R=(-0.15 - 0.15 * pu, 0, 0))
    b = P(torso=(-0.32 - 0.04 * pu, 0, 0), head=(0.3, 0, 0), arm_L=AL(0.55, 0.35), arm_R=AR(0.55, 0.35), forearm_L=(1.85 + 0.2 * pu, 0, 0), forearm_R=(1.85 + 0.2 * pu, 0, 0),
          leg_L=(0.3, 0, -0.3), leg_R=(0.3, 0, 0.3), shin_L=(-0.75, 0, 0), shin_R=(-0.75, 0, 0))
    return ground(mix(a, b, c), 0.12 * hop)
@E('spin', 0.8)
def _(t):   # hop-pirouette: arms fling out, tuck in mid-spin
    u = t / 0.8; ang = 2 * PI * (u * u * (3 - 2 * u)); hop = S(PI * u); tuck = S(PI * u) ** 2
    return P(root=(0, ang, 0), torso=(0.06, 0, 0), head=(0.15, 0, 0), arm_L=AL(0.4 + 1.6 * tuck, 1.6 - 1.2 * tuck), arm_R=AR(0.4 + 1.6 * tuck, 1.6 - 1.2 * tuck), forearm_L=(0.3 + 1.4 * tuck, 0, 0), forearm_R=(0.3 + 1.4 * tuck, 0, 0),
             leg_L=(0.55 * hop, 0, -0.1), leg_R=(-0.05 * hop, 0, 0.08), shin_L=(-1.3 * hop, 0, 0), shin_R=(-0.3 * hop, 0, 0), T=(0, 0.42 * hop, 0))
@E('clap', 1.2)
def _(t):   # claps that climb from chest to overhead and back, knees bouncing on each clap
    w = 2 * PI * t / 0.3; c = 0.5 + 0.5 * S(w); h = 0.5 - 0.5 * Cs(2 * PI * t / 1.2)
    p = P(torso=(-0.06 + 0.12 * h, 0, 0), head=(0.08 + 0.3 * h + 0.08 * S(w), 0, 0), arm_L=AL(1.2 + 1.5 * h, -0.08 - 0.32 * c), arm_R=AR(1.2 + 1.5 * h, -0.08 - 0.32 * c), forearm_L=(1.25 - 0.6 * h, 0, 0), forearm_R=(1.25 - 0.6 * h, 0, 0),
          leg_L=(0, 0, -0.08), leg_R=(0, 0, 0.08), shin_L=(-0.12 - 0.3 * (1 - c), 0, 0), shin_R=(-0.12 - 0.3 * (1 - c), 0, 0))
    return ground(p, 0.03 * S(w))
@E('cheer', 1.6)
def _(t):   # jumping V with fist pumps
    w = 2 * PI * t / 0.8; hop = mx(S(w)) ** 0.8; s = S(w)
    return P(torso=(0.16, 0, 0.06 * S(w / 2)), head=(0.5, 0, 0.12 * s), arm_L=AL(0.5, 2.6 + 0.25 * hop), arm_R=AR(0.5, 2.6 + 0.25 * hop), forearm_L=(0.25 + 0.7 * hop, 0, 0), forearm_R=(0.25 + 0.7 * hop, 0, 0),
             leg_L=(0.35 * hop, 0, -0.12), leg_R=(-0.15 * hop, 0, 0.12), shin_L=(-0.9 * hop, 0, 0), shin_R=(-0.6 * hop, 0, 0), T=(0, 0.34 * hop, 0))
@E('salute', 2.4, loop=False)
def _(t):   # heel-click hop, then the hand snaps up with an overshoot
    u = eob(sm(0.15, 0.4, t) * 1.0, 2.6) * (1 - sm(1.9, 2.3, t)); hop = bump(t, 0.0, 0.25)
    return P(torso=(0.06 * u, -0.12 * u, 0), head=(0.14 * u, -0.18 * u, 0), arm_R=(1.63 * u, 0.93 * u, 0.61 * u), forearm_R=(1.49 * u, 0.33 * u, 0.13 * u), arm_L=AL(0.0, 0.04), forearm_L=(0.1, 0, 0),
             leg_L=(0.1 * hop, 0, -0.02 - 0.12 * hop), leg_R=(0.1 * hop, 0, 0.02 + 0.12 * hop), shin_L=(-0.35 * hop, 0, 0), shin_R=(-0.35 * hop, 0, 0), T=(0, 0.2 * hop, 0))
@E('bow', 2.6, loop=False)
def _(t):   # theatrical bow: arm sweeps out wide, then across the waist as the body folds (overshoot) and rises
    sweep = trap(t, 0.05, 0.4, 0.5, 0.8); u = eob(sm(0.45, 0.95, t), 2.0) * (1 - sm(1.7, 2.4, t)); step = trap(t, 0.3, 0.6, 1.8, 2.3)
    return ground(P(torso=(-1.15 * u, 0, 0), head=(0.3 * u, 0, 0), arm_R=AR(0.9 * u + 0.6 * sweep, -0.8 * u + 1.4 * sweep), forearm_R=(1.4 * u + 0.2 * sweep, 0, 0),
                    arm_L=AL(-0.7 * u, 0.5 * u), forearm_L=(0.5 * u, 0, 0), leg_L=(0.1 * step, 0, -0.03), leg_R=(-0.35 * step, 0, 0.04), shin_L=(-0.1 * step, 0, 0), shin_R=(-0.1 * step, 0, 0)))
@E('shrug', 1.6, loop=False)
def _(t):   # palms up, shoulders to the ears, head tilt, little bounce
    u = eob(sm(0.08, 0.3, t), 2.4) * (1 - sm(1.15, 1.5, t)); p2 = bump(t, 0.25, 0.65) + bump(t, 0.65, 1.05)
    return ground(P(torso=(0.08 * u, 0.0, 0.08 * u), head=(0.15 * u, 0.25 * S(2 * PI * t / 0.8) * u, 0.32 * u), arm_L=AL(0.4 * u, 0.7 * u + 0.15 * p2 * u), arm_R=AR(0.4 * u, 0.7 * u + 0.15 * p2 * u),
                    forearm_L=(1.55 * u, 0, -0.3 * u), forearm_R=(1.55 * u, 0, 0.3 * u), leg_L=(0, 0, -0.06), leg_R=(0, 0, 0.06), shin_L=(-0.15 * p2, 0, 0), shin_R=(-0.15 * p2, 0, 0)), 0.04 * p2 * u)
def robot_pose(i):
    seq = [P(arm_L=AL(1.57, 0), arm_R=AR(0.0, 1.57), forearm_L=(1.57, 0, 0), forearm_R=(1.57, 0, 0), head=(0, 0.7, 0), torso=(0, 0.35, 0)),
           P(arm_L=AL(0.0, 1.57), arm_R=AR(1.57, 0), forearm_L=(1.57, 0, 0), forearm_R=(1.57, 0, 0), head=(0, -0.7, 0), torso=(0, -0.35, 0)),
           P(arm_L=AL(1.57, -0.6), arm_R=AR(1.57, -0.6), forearm_L=(0.0, 0, 0), forearm_R=(1.57, 0, 0), head=(0.35, 0, 0), torso=(0, 0, 0)),
           P(arm_L=AL(0.0, 1.57), arm_R=AR(0.0, 1.57), forearm_L=(1.57, 0, 0), forearm_R=(1.57, 0, 0), head=(0, 0, 0.4), torso=(0, 0, 0.0))]
    return seq[i % 4]
@E('robot', 2.0, lin=True)
def _(t):   # snappy pops between poses, each one overshooting and locking
    i = int(t / 0.5) % 4; k = eob(sm(0.36, 0.48, t % 0.5), 3.0); a = robot_pose(i); b = robot_pose(i + 1); p = mix(a, b, k)
    bob = bump(t % 0.5, 0.36, 0.5)
    p['leg_L'] = (0.3 * (i % 2 == 0), 0, -0.1); p['leg_R'] = (0.3 * (i % 2 == 1), 0, 0.1); p['shin_L'] = (-0.2 * bob, 0, 0); p['shin_R'] = (-0.2 * bob, 0, 0)
    return ground(p)
@E('jacks', 1.0)
def _(t):
    u = 0.5 - 0.5 * Cs(2 * PI * t / 0.5); hop = 4 * u * (1 - u)
    return P(torso=(0.04 * hop, 0, 0), head=(0.15, 0, 0), arm_L=AL(0.1, 0.1 + 2.85 * u), arm_R=AR(0.1, 0.1 + 2.85 * u), forearm_L=(0.2, 0, 0), forearm_R=(0.2, 0, 0), leg_L=(0, 0, -0.03 - 0.48 * u), leg_R=(0, 0, 0.03 + 0.48 * u),
             shin_L=(-0.1 - 0.25 * (1 - u), 0, 0), shin_R=(-0.1 - 0.25 * (1 - u), 0, 0), T=(0, 0.24 * hop - 0.06 * (1 - u), 0))
@E('boxing', 1.2)
def _(t):   # bob and weave, jab-cross
    r = eob(trap(t, 0.08, 0.18, 0.26, 0.4), 1.5); l = eob(trap(t, 0.6, 0.7, 0.78, 0.92), 1.5); w = 2 * PI * t / 0.6; wv = S(2 * PI * t / 1.2)
    p = P(torso=(-0.12, -0.55 * r + 0.55 * l + 0.15 * wv, 0.2 * wv), head=(0.08, 0.5 * r - 0.5 * l, 0.06 * S(w) - 0.1 * wv),
          arm_L=AL(1.0 + 0.6 * l, -0.28 + 0.2 * l), arm_R=AR(1.0 + 0.6 * r, -0.28 + 0.2 * r), forearm_L=(2.05 - 2.0 * l, 0, 0), forearm_R=(2.05 - 2.0 * r, 0, 0),
          leg_L=(-0.25, 0, -0.16), leg_R=(0.3, 0, 0.16), shin_L=(-0.4 - 0.3 * S(w), 0, 0), shin_R=(-0.4 + 0.3 * S(w), 0, 0), T=(0.07 * wv, 0, 0))
    return ground(p, 0.03 * S(w))

# ---- 8 new emotes
@E('pendulum', 1.2)
def _(t):   # both arms swing together side to side like a pendulum, hips counter-swing, knees bounce on the beat
    s = S(2 * PI * t / 1.2); b = abs(S(2 * PI * t / 1.2))
    p = P(torso=(-0.05, 0.32 * s, -0.1 * s), head=(0.08 + 0.12 * b, -0.2 * s, 0.12 * s), arm_L=AL(0.75 + 0.25 * b, 1.0 * s), arm_R=AR(0.75 + 0.25 * b, -1.0 * s), forearm_L=(0.25, 0, 0), forearm_R=(0.25, 0, 0),
          leg_L=(0.1, 0, -0.14), leg_R=(0.1, 0, 0.14), shin_L=(-0.25 - 0.45 * (1 - b), 0, 0), shin_R=(-0.25 - 0.45 * (1 - b), 0, 0), root=(0, -0.2 * s, 0), T=(-0.1 * s, 0, 0))
    return ground(p)
@E('firedup', 1.0)
def _(t):   # FIRED UP: hops with alternating fist pumps and head-bangs
    hop = mx(S(2 * PI * t / 0.5)) ** 0.7; side = S(2 * PI * t / 1.0); bang = Cs(2 * PI * t / 0.25)
    return P(torso=(-0.1 + 0.12 * hop, 0.2 * side, 0.08 * side), head=(-0.15 + 0.3 * bang, -0.1 * side, 0), arm_L=AL(1.6 + 1.35 * mx(-side), 0.35), arm_R=AR(1.6 + 1.35 * mx(side), 0.35),
             forearm_L=(1.7 - 1.3 * mx(-side), 0, 0), forearm_R=(1.7 - 1.3 * mx(side), 0, 0), leg_L=(0.4 * hop, 0, -0.14), leg_R=(0.25 * hop, 0, 0.14), shin_L=(-0.95 * hop - 0.1, 0, 0), shin_R=(-0.7 * hop - 0.1, 0, 0),
             T=(0, 0.3 * hop - 0.05, 0))
@E('shuffle', 0.8)
def _(t):   # HEEL SHUFFLE: quick alternating heel taps out front with a side slide, arms pumping low
    s = S(2 * PI * t / 0.8); c = Cs(2 * PI * t / 0.8); tapL = mx(s) ** 0.6; tapR = mx(-s) ** 0.6
    p = P(torso=(-0.05, 0.15 * s, 0.06 * s), head=(0.05, -0.12 * s, -0.06 * s), arm_L=AL(0.4 - 0.6 * s, 0.25), arm_R=AR(0.4 + 0.6 * s, 0.25), forearm_L=(1.5, 0, 0), forearm_R=(1.5, 0, 0),
          leg_L=(0.6 * tapL - 0.05, 0, -0.12 - 0.15 * tapL), leg_R=(0.6 * tapR - 0.05, 0, 0.12 + 0.15 * tapR), shin_L=(-0.1 - 0.7 * tapR, 0, 0), shin_R=(-0.1 - 0.7 * tapL, 0, 0),
          root=(0, 0.15 * c, 0), T=(0.12 * c, 0, 0))
    return ground(p, 0.04 * abs(s))
@E('callout', 2.4, loop=False)
def _(t):   # CALL OUT: lean in and jab a finger forward three times (overshoot each), then thumb to the chest and nod
    pt = eob(sm(0.05, 0.25, t), 2.5) * (1 - sm(1.35, 1.55, t)); jab = sum(bump(t, 0.3 + 0.32 * i, 0.5 + 0.32 * i) for i in range(3))
    me = eob(sm(1.45, 1.65, t), 2.5) * (1 - sm(2.1, 2.35, t)); nod = bump(t, 1.7, 2.0)
    return ground(P(torso=(-0.22 * pt - 0.08 * jab + 0.1 * me, -0.3 * pt, 0.06 * pt), head=(0.12 * pt + 0.25 * nod, 0.2 * pt, 0.1 * pt),
                    arm_R=AR(1.45 * pt + 0.15 * jab + 0.5 * me, -0.15 * pt - 0.5 * me), forearm_R=(0.15 * pt + 2.1 * me, 0, 0), arm_L=AL(-0.2 * pt, 0.45 * pt), forearm_L=(1.6 * pt, 0, 0),
                    leg_L=(0.25 * pt, 0, -0.08), leg_R=(-0.25 * pt, 0, 0.1), shin_L=(-0.25 * pt, 0, 0), shin_R=(-0.05, 0, 0)))
@E('laugh', 1.6)
def _(t):   # BELLY LAUGH: clutching the belly, head thrown back with quick giggle bobs, then doubled over slapping the knee
    c = 0.5 - 0.5 * Cs(2 * PI * t / 1.6); gig = S(2 * PI * t / 0.16); slap = bump(t, 0.7, 0.95)
    p = P(torso=(lerp(0.3, -0.75, c) + 0.05 * gig, 0.1 * S(PI * t / 0.8), 0.05 * gig), head=(lerp(0.55, 0.45, c) + 0.06 * gig, 0, 0.1 * c),
          arm_L=AL(0.55, -0.25), arm_R=AR(lerp(0.55, -0.1 + 0.6 * slap, c), lerp(-0.25, 0.2, c)), forearm_L=(1.75, 0, 0), forearm_R=(lerp(1.75, 0.3, c), 0, 0),
          leg_L=(0.15 * c, 0, -0.1), leg_R=(0.2 * c, 0, 0.12), shin_L=(-0.3 * c, 0, 0), shin_R=(-0.35 * c, 0, 0))
    return ground(p, 0.015 * gig)
@E('champ', 1.2)
def _(t):   # CHAMP STOMP: stomp left, stomp right, fist pump on the stomping side
    s = S(2 * PI * t / 1.2); liftL = mx(S(2 * PI * t / 0.6)) * (1 if s > 0 else 0); liftR = mx(S(2 * PI * t / 0.6)) * (1 if s <= 0 else 0)
    p = P(torso=(-0.06, 0.25 * s, -0.12 * s), head=(0.1 + 0.15 * (liftL + liftR), 0.1 * s, 0.1 * s), arm_L=AL(1.0 + 1.9 * mx(s), 0.35), arm_R=AR(1.0 + 1.9 * mx(-s), 0.35),
          forearm_L=(1.8 - 1.4 * mx(s), 0, 0), forearm_R=(1.8 - 1.4 * mx(-s), 0, 0), leg_L=(0.95 * liftL, 0, -0.16), leg_R=(0.95 * liftR, 0, 0.16), shin_L=(-1.5 * liftL - 0.15, 0, 0), shin_R=(-1.5 * liftR - 0.15, 0, 0),
          T=(0.1 * s, 0, 0))
    return ground(p)
def _sit(br=0.0, sway=0.0):
    return P(T=(0, -0.6, 0.05), leg_L=(1.45, 0.35, -0.6), leg_R=(1.45, -0.35, 0.6), shin_L=(-2.35, 0, 0), shin_R=(-2.35, 0, 0), torso=(-0.12 + 0.03 * br, 0.08 * sway, 0.05 * sway), head=(0.1 - 0.03 * br, 0.3 * sway, 0),
             arm_L=AL(0.75, 0.25), arm_R=AR(0.75, 0.25), forearm_L=(0.55 + 0.05 * br, 0, 0), forearm_R=(0.55 + 0.05 * br, 0, 0))
STAND = P(arm_L=AL(0.04, 0.1), arm_R=AR(0.04, 0.1), forearm_L=(0.2, 0, 0), forearm_R=(0.2, 0, 0))
@E('sit', 4.8, loop=False)
def _(t):   # CHILL SEAT: drop down cross-legged (bounce on landing), chill, pop back up
    br = S(2 * PI * t / 1.6); sway = S(2 * PI * t / 3.2)
    squat = P(T=(0, -0.45, 0), leg_L=(1.0, 0, -0.2), leg_R=(1.0, 0, 0.2), shin_L=(-1.8, 0, 0), shin_R=(-1.8, 0, 0), torso=(-0.4, 0, 0), head=(0.3, 0, 0), arm_L=AL(1.0, 0.3), arm_R=AR(1.0, 0.3), forearm_L=(0.4, 0, 0), forearm_R=(0.4, 0, 0))
    K = [(0.0, STAND), (0.3, squat), (0.62, _sit(), 'bb'), (4.0, _sit(br, sway)), (4.35, squat), (4.8, STAND, 'b')]
    if 0.62 < t < 4.0: return _sit(br, sway)
    return kfe(K, t)
@E('limber', 4.0, loop=False)
def _(t):   # LIMBER UP: arm-across stretch (both sides), side bends, toe touch
    a1 = trap(t, 0.1, 0.35, 0.75, 0.95); a2 = trap(t, 0.95, 1.15, 1.55, 1.75); sb = trap(t, 1.75, 2.0, 2.65, 2.85); tt = trap(t, 2.85, 3.15, 3.55, 3.9)
    side = S(2 * PI * (t - 2.0) / 0.8) * sb; bounce = 0.06 * S(2 * PI * t / 0.25) * tt
    p = P(torso=(-1.25 * tt - bounce, 0.15 * (a1 - a2), 0.4 * side), head=(0.2 * tt, -0.2 * (a1 - a2), -0.15 * side),
          arm_R=AR(1.4 * a1 + 0.2 * a2 + 2.9 * sb + 0.35 * tt, -1.25 * a1 + 0.1 * sb), forearm_R=(0.15 * a1 + 1.5 * a2 + 0.2 * sb, 0, 0),
          arm_L=AL(1.4 * a2 + 0.2 * a1 + 2.9 * sb + 0.35 * tt, -1.25 * a2 + 0.1 * sb), forearm_L=(0.15 * a2 + 1.5 * a1 + 0.2 * sb, 0, 0),
          leg_L=(0, 0, -0.1 - 0.06 * sb), leg_R=(0, 0, 0.1 + 0.06 * sb), T=(-0.05 * side, 0, 0.1 * tt))
    return ground(p)

EMOTES = ['dance', 'wave', 'flex', 'spin', 'clap', 'cheer', 'salute', 'bow', 'shrug', 'robot', 'jacks', 'boxing',
          'pendulum', 'firedup', 'shuffle', 'callout', 'laugh', 'champ', 'sit', 'limber']
LABELS = {'dance': 'DANCE', 'wave': 'WAVE', 'flex': 'FLEX', 'spin': 'SPIN', 'clap': 'CLAP', 'cheer': 'CHEER', 'salute': 'SALUTE', 'bow': 'BOW', 'shrug': 'SHRUG', 'robot': 'ROBOT', 'jacks': 'JACKS', 'boxing': 'BOXING',
          'pendulum': 'PENDULUM', 'firedup': 'FIRED UP', 'shuffle': 'HEEL SHUFFLE', 'callout': 'CALL OUT', 'laugh': 'BELLY LAUGH', 'champ': 'CHAMP STOMP', 'sit': 'CHILL SEAT', 'limber': 'LIMBER UP'}


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
    extra = dict(labels=LABELS, flips=FLIPS, stride={k: stride(k) for k in ('walk', 'run', 'sprint', 'back')})
    s += 'window.G = window.G || {}; G.AnimData = { emotes: %s, meta: %s, clips: %s };\n' % (json.dumps(EMOTES), json.dumps(extra), json.dumps(out, separators=(',', ':')))
    open(path, 'w').write(s); return len(s)

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__)); p = os.path.join(here, '..', 'js', 'animdata.js')
    print('wrote', p, to_js(p), 'bytes;', len(CLIPS), 'clips')
