'use strict';
/* Blender animation clips (idle / run / jump / glide / shoot / pickaxe) from assets/models/rigged/rigged_default.glb.
   The clips are evaluated with THREE.AnimationMixer on the exported armature, converted to the game's joint rotations (relative to bind pose)
   and cached as sample tables; G.Clips.apply(actor, dt) then drives the segment rig from them.  If anything fails to load the procedural animation
   in actors.js keeps working untouched. */
(function () {
const G = window.G, T = THREE; const C = G.Clips = { ready: false, clips: {}, error: null };
const FPS = 30, JOINTS = ['torso', 'head', 'arm_L', 'arm_R', 'forearm_L', 'forearm_R', 'leg_L', 'leg_R', 'shin_L', 'shin_R'];
const PARENT = { torso: null, head: 'torso', arm_L: 'torso', arm_R: 'torso', forearm_L: 'arm_L', forearm_R: 'arm_R', leg_L: null, leg_R: null, shin_L: 'leg_L', shin_R: 'leg_R' };

C.load = function (url, timeoutMs) {
  return new Promise(res => {
    if (!T.GLTFLoader || location.search.indexOf('noassets') >= 0 || location.search.indexOf('noclips') >= 0) { C.error = 'disabled'; return res(false); }
    let done = false; const fin = v => { if (!done) { done = true; res(v); } }; const tm = setTimeout(() => { C.error = 'timeout'; fin(false); }, timeoutMs || 8000);
    new T.GLTFLoader().load(url, gltf => {
      try { bake(gltf); C.ready = true; } catch (e) { C.error = String(e); console.warn('clips', e); }
      clearTimeout(tm); fin(C.ready);
    }, undefined, e => { C.error = String(e && e.message || e); clearTimeout(tm); fin(false); });
  });
};

function bake(gltf) {
  const scene = gltf.scene, B = {}; scene.traverse(n => { if (n.isBone || n.name) B[n.name] = n; });
  for (const j of JOINTS.concat('root')) if (!B[j]) throw new Error('missing bone ' + j);
  scene.updateMatrixWorld(true);
  const rest = {}, restPosY = B.root.position.y, q = new T.Quaternion(); for (const j of JOINTS) rest[j] = B[j].getWorldQuaternion(new T.Quaternion()).invert();
  const mixer = new T.AnimationMixer(scene), e = new T.Euler(), dW = {}, loc = new T.Quaternion();
  for (const clip of gltf.animations) {
    const n = Math.max(2, Math.round(clip.duration * FPS) + 1), data = new Float32Array(n * (JOINTS.length * 3 + 1)); const act = mixer.clipAction(clip); act.play();
    for (let i = 0; i < n; i++) {
      act.time = Math.min(clip.duration, i / FPS); mixer.update(0); scene.updateMatrixWorld(true);
      for (const j of JOINTS) dW[j] = B[j].getWorldQuaternion(new T.Quaternion()).multiply(rest[j]);          // world rotation relative to bind pose
      let o = i * (JOINTS.length * 3 + 1);
      for (const j of JOINTS) { const p = PARENT[j]; loc.copy(dW[j]); if (p) loc.premultiply(dW[p].clone().invert()); e.setFromQuaternion(loc, 'XYZ'); data[o++] = e.x; data[o++] = e.y; data[o++] = e.z; }
      data[o] = B.root.position.y - restPosY;
    }
    act.stop(); C.clips[clip.name] = { n, dur: clip.duration, data, stride: JOINTS.length * 3 + 1 };
  }
}

const tmp = {};
/* sample clip at time t (seconds, wraps when loop) into out = {joint:[x,y,z], bob} */
C.sample = function (name, t, loop, out) {
  const c = C.clips[name]; if (!c) return null; let f = t * FPS; const last = c.n - 1;
  if (loop) { f = ((f % last) + last) % last; } else f = Math.max(0, Math.min(last, f));
  const i0 = Math.floor(f), i1 = Math.min(last, i0 + 1), k = f - i0, d = c.data, s = c.stride; out = out || {};
  for (let j = 0; j < JOINTS.length; j++) { const a = out[JOINTS[j]] || (out[JOINTS[j]] = [0, 0, 0]); for (let q = 0; q < 3; q++) a[q] = d[i0 * s + j * 3 + q] * (1 - k) + d[i1 * s + j * 3 + q] * k; }
  out.bob = d[i0 * s + JOINTS.length * 3] * (1 - k) + d[i1 * s + JOINTS.length * 3] * k; return out;
};
const P1 = {}, P2 = {};
function lerpPose(a, b, k, out) { for (const j of JOINTS) { const o = out[j] || (out[j] = [0, 0, 0]); for (let q = 0; q < 3; q++) o[q] = a[j][q] + (b[j][q] - a[j][q]) * k; } out.bob = a.bob + (b.bob - a.bob) * k; return out; }
const PO = {};
const set = (r, x, y, z) => r.rotation.set(x, y, z);

/* drive an actor's rig from the clips (called from actors.js after the procedural pose) */
C.apply = function (a, dt) {
  if (!C.ready) return; const r = a.rig; if (!r || !r.knees || !a.alive) return; if (r.lod > 1) return;
  const st = a.state; if ((st !== 'ground' && st !== 'glide') || a.vehicle || a.emote || a.buildMode || a.action) return;
  const it = a.inv && a.inv[a.sel]; a.clipT = (a.clipT || 0) + dt; const sp = a.speedNow || 0, amp = Math.min(1, sp / 4);
  let pose; const idle = C.sample('idle', a.clipT, true, P1);
  if (st === 'glide') pose = C.sample('glide', a.clipT, true, P2);
  else if (!a.onGround) { a.airT = (a.airT || 0) + dt; pose = C.sample('jump', Math.min(a.airT + 0.15, 0.95), false, P2); }
  else {
    a.airT = 0;
    if (amp > 0.02) { const run = C.sample('run', (a.walkPhase / (Math.PI * 2)) * C.clips.run.dur, true, P2); pose = lerpPose(idle, run, amp, PO); } else pose = idle;
  }
  const L = r.legs, A = r.arms, K = r.knees, E = r.elbows, lean = r.lean;
  lean.rotation.x = pose.torso[0]; lean.rotation.z = pose.torso[2]; r.m.position.y = -1 + pose.bob; r.head.rotation.set(pose.head[0] + G.clamp((a.pitch || 0) * 0.5, -0.5, 0.5), pose.head[1], pose.head[2]);
  set(L[0], ...pose.leg_L); set(L[1], ...pose.leg_R); set(K[0], ...pose.shin_L); set(K[1], ...pose.shin_R); if (a.crouch) { K[0].rotation.x -= 0.5; K[1].rotation.x -= 0.5; }
  set(A[0], ...pose.arm_L); set(A[1], ...pose.arm_R); set(E[0], ...pose.forearm_L); set(E[1], ...pose.forearm_R);
  if (st === 'glide') return;
  if (it && (it.type === 'weapon' || it.type === 'gadget')) {
    const rc = a.recoil || 0, s = C.sample('shoot', Math.min(0.083, rc * 0.6), false, P1); const up = (a.pitch || 0) * 0.8;
    set(A[1], s.arm_R[0] + up, s.arm_R[1], s.arm_R[2]); set(A[0], s.arm_L[0] + up, s.arm_L[1], s.arm_L[2]); set(E[1], s.forearm_R[0] - rc * 3, 0, 0); set(E[0], s.forearm_L[0], 0, 0);
  } else if (it && it.type === 'pickaxe') {
    r.pick.visible = true;
    if (a.swing > 0) { const k = Math.min(1, a.swing / 0.35), s = C.sample('pickaxe', (5 + k * 11) / 24, false, P1); set(A[1], s.arm_R[0], s.arm_R[1], s.arm_R[2]); set(E[1], s.forearm_R[0], 0, 0); }
    else if (amp < 0.1) { const s = C.sample('pickaxe', 0, false, P1); set(A[1], s.arm_R[0], s.arm_R[1], s.arm_R[2]); set(E[1], s.forearm_R[0], 0, 0); }
  }
};
})();
