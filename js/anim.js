'use strict';
/* Character animation system.
   Clips: 51 clips authored in Blender on the shared human armature (blender/anims.py -> blender/rig_anim.py -> assets/models/rigged/anims.glb).
   They are sampled once through THREE.AnimationMixer on the exported armature, converted to the game's segment-rig joint rotations and
   re-built as AnimationClips for the game rig ('<clip>.lo' = legs + hip translation, '<clip>.up' = torso, head, arms).  Every character gets its own
   AnimationMixer; two independent layers (lower / upper body) are cross-faded (mixer action weights) so e.g. run legs + rifle arms + a shot overlay work together.
   Fallbacks: (1) the same clips as keyframe data (js/animdata.js, generated from the same python source) evaluated in plain JS, then (2) the
   original procedural pose code in actors.js.  URL switches: ?noclips (skip the .glb -> keyframe fallback), ?legacyanim (procedural only), ?anim=NAME (loop one clip). */
(function () {
const G = window.G, T = THREE, Q = new URLSearchParams(location.search);
const C = G.Clips = { ready: false, error: null, ac: {}, n: 0 };
const A = G.Anim = { force: Q.get('anim') || null, legacy: Q.has('legacyanim'), backend: 'none', fam: {} };
const D = () => (G.AnimData && G.AnimData.clips) || {};
const FPS = 30;
A.emotes = (G.AnimData && G.AnimData.emotes) || ['dance', 'wave', 'flex', 'spin'];
A.labels = { dance: 'DANCE', wave: 'WAVE', flex: 'FLEX', spin: 'SPIN', clap: 'CLAP', cheer: 'CHEER', salute: 'SALUTE', bow: 'BOW', shrug: 'SHRUG', robot: 'ROBOT', jacks: 'JACKS', boxing: 'BOXING' };
A.names = () => Object.keys(D()).length ? Object.keys(D()) : Object.keys(C.durs || {});
const info = n => { const d = D()[n]; if (d) return { dur: d.d, loop: !!d.l, lin: !!d.lin }; const x = C.durs && C.durs[n]; return x || null; };
A.info = info;
const FAM = n => (n === 'idle' || n === 'walk' || n === 'run' || n === 'sprint' || n === 'back' || n === 'strafe_L' || n === 'strafe_R') ? 'loco' : n;
const JN = { torso: 'J_lean', head: 'J_head', arm_L: 'J_armL', arm_R: 'J_armR', forearm_L: 'J_elbL', forearm_R: 'J_elbR', leg_L: 'J_legL', leg_R: 'J_legR', shin_L: 'J_kneeL', shin_R: 'J_kneeR' };
const UPJ = ['torso', 'head', 'arm_L', 'arm_R', 'forearm_L', 'forearm_R'], LOJ = ['leg_L', 'leg_R', 'shin_L', 'shin_R'], ALLJ = UPJ.concat(LOJ);
const PARENT = { head: 'torso', arm_L: 'torso', arm_R: 'torso', forearm_L: 'arm_L', forearm_R: 'arm_R', shin_L: 'leg_L', shin_R: 'leg_R' };

/* ---------------------------------------------------------------- load + bake the Blender clips */
C.load = function (url, timeoutMs) {
  return new Promise(res => {
    if (!T.GLTFLoader || /[?&](noassets|noclips|legacyanim)/.test(location.search)) { C.error = 'disabled'; return res(false); }
    let done = false; const fin = v => { if (!done) { done = true; res(v); } }; const tm = setTimeout(() => { C.error = 'timeout'; fin(false); }, timeoutMs || 9000);
    new T.GLTFLoader().load(url, gltf => {
      try { bake(gltf); C.ready = true; } catch (e) { C.error = String(e); console.warn('clips', e); }
      clearTimeout(tm); fin(C.ready);
    }, undefined, e => { C.error = String(e && e.message || e); clearTimeout(tm); fin(false); });
  });
};
function bake(gltf) {
  const scene = gltf.scene, B = {}; scene.traverse(n => { if (n.name) B[n.name] = n; });
  const need = ['root', 'torso', 'head', 'arm_L', 'arm_R', 'forearm_L', 'forearm_R', 'leg_L', 'leg_R', 'shin_L', 'shin_R']; for (const j of need) if (!B[j]) throw new Error('missing bone ' + j);
  scene.updateMatrixWorld(true);
  const rqi = {}, rp = B.root.getWorldPosition(new T.Vector3()); for (const j of need) rqi[j] = B[j].getWorldQuaternion(new T.Quaternion()).invert();
  const mixer = new T.AnimationMixer(scene), Y = new T.Vector3(0, 1, 0); C.durs = {}; const out = {};
  for (const clip of gltf.animations) {
    const n = Math.max(2, Math.round(clip.duration * FPS) + 1), act = mixer.clipAction(clip); act.play(); act.setLoop(T.LoopRepeat, Infinity);
    const arr = {}; for (const j of ALLJ) arr[j] = new Float32Array(n * 4); const pos = new Float32Array(n * 3), times = new Float32Array(n);
    const dW = {}, v = new T.Vector3(), l = new T.Vector3(), prev = {};
    for (let i = 0; i < n; i++) {
      times[i] = i / FPS; act.time = Math.min(clip.duration, i / FPS); mixer.update(0); scene.updateMatrixWorld(true);
      for (const j of need) dW[j] = B[j].getWorldQuaternion(new T.Quaternion()).multiply(rqi[j]);     // world rotation relative to the bind pose
      const t = B.root.getWorldPosition(v).sub(rp);
      l.set(0, 0.84, 0).applyQuaternion(dW.root); const d2 = new T.Vector3(0, 0.16, 0).applyQuaternion(dW.torso); pos[i * 3] = t.x + l.x + d2.x; pos[i * 3 + 1] = t.y + l.y + d2.y; pos[i * 3 + 2] = t.z + l.z + d2.z;
      const q = {}; const inv = k => dW[k].clone().invert();
      q.torso = dW.torso; q.head = inv('torso').multiply(dW.head); q.arm_L = inv('torso').multiply(dW.arm_L); q.arm_R = inv('torso').multiply(dW.arm_R);
      q.forearm_L = inv('arm_L').multiply(dW.forearm_L); q.forearm_R = inv('arm_R').multiply(dW.forearm_R); q.leg_L = dW.leg_L; q.leg_R = dW.leg_R; q.shin_L = inv('leg_L').multiply(dW.shin_L); q.shin_R = inv('leg_R').multiply(dW.shin_R);
      for (const j of ALLJ) { const Qj = q[j]; if (prev[j] && Qj.dot(prev[j]) < 0) { Qj.set(-Qj.x, -Qj.y, -Qj.z, -Qj.w); } prev[j] = Qj; arr[j][i * 4] = Qj.x; arr[j][i * 4 + 1] = Qj.y; arr[j][i * 4 + 2] = Qj.z; arr[j][i * 4 + 3] = Qj.w; }
    }
    act.stop(); mixer.uncacheClip(clip);
    const mk = (nm, joints, withPos) => { const tr = []; for (const j of joints) tr.push(new T.QuaternionKeyframeTrack(JN[j] + '.quaternion', times, arr[j])); if (withPos) tr.push(new T.VectorKeyframeTrack('J_lean.position', times, pos)); return new T.AnimationClip(nm, clip.duration, tr.filter(Boolean)); };
    C.ac[clip.name + '.lo'] = mk(clip.name + '.lo', LOJ, true); C.ac[clip.name + '.up'] = mk(clip.name + '.up', UPJ, false);
    const dd = D()[clip.name]; C.durs[clip.name] = { dur: clip.duration, loop: dd ? !!dd.l : true, lin: false }; C.n++;
  }
  if (!C.n) throw new Error('no clips');
}

/* ---------------------------------------------------------------- keyframe-data fallback sampler */
const DP = {}; function prepData() { if (DP.done) return; for (const k in D()) { const c = D()[k]; c.F = {}; for (const j in c.j) c.F[j] = Float32Array.from(c.j[j]); } DP.done = true; }
const E = new T.Euler(), QA = new T.Quaternion(), QB = new T.Quaternion(), QC = new T.Quaternion(), V3 = new T.Vector3(), V4 = new T.Vector3();
function cr(p0, p1, p2, p3, u) { return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u); }
function sampleData(name, t, out) {
  const c = D()[name]; if (!c) return false; const n = c.n, loop = !!c.l; let f = t * c.hz; if (loop) { f = ((f % n) + n) % n; } else f = Math.max(0, Math.min(n - 1, f));
  const i1 = Math.floor(f), u = f - i1; const g = i => loop ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i));
  const a = g(i1 - 1), b = g(i1), cc = g(i1 + 1), d = g(i1 + 2);
  for (const j of ['torso', 'head', 'arm_L', 'arm_R', 'forearm_L', 'forearm_R', 'leg_L', 'leg_R', 'shin_L', 'shin_R', 'root', 'T']) {
    const o = out[j] || (out[j] = [0, 0, 0]); const F = c.F[j]; if (!F) { o[0] = o[1] = o[2] = 0; continue; }
    for (let q = 0; q < 3; q++) o[q] = c.lin ? F[b * 3 + q] + (F[cc * 3 + q] - F[b * 3 + q]) * u : cr(F[a * 3 + q], F[b * 3 + q], F[cc * 3 + q], F[d * 3 + q], u);
  }
  return true;
}
const PA = {}, PB = {}, PL = {}, PU = {};
function blendPose(g, out) {   // out = blended pose of the group's current (+ fading previous) clip
  const c = g.cur; sampleData(c.name, c.time, PA);
  if (g.prev && g.fade < 1) { sampleData(g.prev.name, g.prev.time, PB); const k = g.fade; for (const j in PA) { const a = PA[j], b = PB[j], o = out[j] || (out[j] = [0, 0, 0]); for (let q = 0; q < 3; q++) o[q] = b[q] + (a[q] - b[q]) * k; } }
  else for (const j in PA) { const o = out[j] || (out[j] = [0, 0, 0]); o[0] = PA[j][0]; o[1] = PA[j][1]; o[2] = PA[j][2]; }
  return out;
}
const qE = (a, q) => q.setFromEuler(E.set(a[0], a[1], a[2], 'XYZ'));

/* ---------------------------------------------------------------- per-character controller */
const NAMED = new WeakSet();
function nameRig(r) {
  if (NAMED.has(r)) return; NAMED.add(r); r.lean.name = 'J_lean'; r.head.name = 'J_head'; r.arms[0].name = 'J_armL'; r.arms[1].name = 'J_armR'; r.elbows[0].name = 'J_elbL'; r.elbows[1].name = 'J_elbR';
  r.legs[0].name = 'J_legL'; r.legs[1].name = 'J_legR'; r.knees[0].name = 'J_kneeL'; r.knees[1].name = 'J_kneeR';
}
const mkG = () => ({ cur: null, prev: null, fade: 1, fadeDur: 0.2, acts: new Set() });
class Ctl {
  constructor(rig) {
    this.rig = rig; nameRig(rig); this.useMixer = C.ready && !A.legacy && !Q.has('animdata'); this.ok = this.useMixer || (!!G.AnimData && !A.legacy);
    if (this.ok && !this.useMixer) prepData();
    if (this.useMixer) {   // the mixer drives a proxy skeleton (it skips writes for unchanged tracks, so it must never share nodes with the procedural code)
      const P = this.proxy = { root: new T.Group(), n: {} }; for (const j in JN) { const o = new T.Object3D(); o.name = JN[j]; P.root.add(o); P.n[JN[j]] = o; } P.n.J_lean.position.set(0, 1, 0);
      this.mixer = new T.AnimationMixer(P.root);
    } else this.mixer = null; this.g = { lo: mkG(), up: mkG() }; this.acts = {};
    this.loco = 'idle'; this.locoT = 0; this.air = null; this.airT = 0; this.wasAir = false; this.landT = 0; this.st = ''; this.osId = 0; this.hideT = 0;
  }
  /* request a clip for a layer.  o: {fade, time, ts, scrub, restart, sync} */
  set(layer, name, o) {
    o = o || {}; const g = this.g[layer], inf = info(name); if (!inf) return false; let cur = g.cur;
    if (!cur || cur.name !== name || o.restart) {
      let t0 = o.time || 0; if (cur && o.sync && FAM(cur.name) === FAM(name) && FAM(name) === 'loco' && !o.restart) t0 = (cur.time / info(cur.name).dur) * inf.dur;
      if (cur && !(cur.name === name && o.restart)) { g.prev = cur; g.fade = 0; g.fadeDur = Math.max(0.001, o.fade === undefined ? 0.2 : o.fade); if (g.fadeDur <= 0.001) { g.prev = null; g.fade = 1; } }
      else { g.prev = null; g.fade = 1; }
      g.cur = cur = { name, time: t0, ts: 1, loop: inf.loop, dur: inf.dur };
    }
    if (o.scrub !== undefined) { cur.ts = 0; cur.time = Math.max(0, Math.min(inf.dur, o.scrub)); } else cur.ts = o.ts === undefined ? 1 : o.ts;
    return true;
  }
  step(dt) {
    for (const L of ['lo', 'up']) {
      const g = this.g[L]; if (!g.cur) continue;
      const adv = c => { if (!c) return; c.time += dt * c.ts; if (c.loop) { if (c.time >= c.dur) c.time %= c.dur; else if (c.time < 0) c.time += c.dur; } else if (c.time > c.dur) c.time = c.dur; };
      adv(g.cur); adv(g.prev); if (g.prev) { g.fade += dt / g.fadeDur; if (g.fade >= 1) { g.prev = null; g.fade = 1; } }
    }
    if (this.useMixer) this.evalMixer(); else this.evalData();
    this.finish();
  }
  act(name, L) { const k = name + '.' + L; let a = this.acts[k]; if (!a) { const cl = C.ac[k]; if (!cl) return null; a = this.acts[k] = this.mixer.clipAction(cl); a.setLoop(T.LoopRepeat, Infinity); } return a; }
  evalMixer() {
    for (const L of ['lo', 'up']) {
      const g = this.g[L], want = new Set();
      const put = (c, w) => { if (!c) return; const a = this.act(c.name, L); if (!a) return; a.setEffectiveWeight(w); a.timeScale = 0; a.time = Math.min(c.time, c.dur - 1e-4); if (!g.acts.has(a)) { a.play(); a.setEffectiveWeight(w); a.time = Math.min(c.time, c.dur - 1e-4); } want.add(a); };
      put(g.cur, g.prev ? Math.max(0.0001, g.fade) : 1); if (g.prev) put(g.prev, Math.max(0.0001, 1 - g.fade));
      for (const a of g.acts) if (!want.has(a)) a.stop(); g.acts = want;
    }
    this.mixer.update(0);
    const r = this.rig, n = this.proxy.n; r.lean.position.copy(n.J_lean.position); r.lean.quaternion.copy(n.J_lean.quaternion); r.head.quaternion.copy(n.J_head.quaternion);
    r.arms[0].quaternion.copy(n.J_armL.quaternion); r.arms[1].quaternion.copy(n.J_armR.quaternion); r.elbows[0].quaternion.copy(n.J_elbL.quaternion); r.elbows[1].quaternion.copy(n.J_elbR.quaternion);
    r.legs[0].quaternion.copy(n.J_legL.quaternion); r.legs[1].quaternion.copy(n.J_legR.quaternion); r.knees[0].quaternion.copy(n.J_kneeL.quaternion); r.knees[1].quaternion.copy(n.J_kneeR.quaternion);
  }
  evalData() {
    const r = this.rig, lo = this.g.lo, up = this.g.up; if (!lo.cur || !up.cur) return;
    blendPose(lo, PL); blendPose(up, PU);
    // upper body
    qE(PU.root, QA); qE(PU.torso, QB); r.lean.quaternion.copy(QA).multiply(QB);
    qE(PU.head, QC); r.head.quaternion.copy(QC); qE(PU.arm_L, QC); r.arms[0].quaternion.copy(QC); qE(PU.arm_R, QC); r.arms[1].quaternion.copy(QC);
    qE(PU.forearm_L, QC); r.elbows[0].quaternion.copy(QC); qE(PU.forearm_R, QC); r.elbows[1].quaternion.copy(QC);
    // lower body (world rotation, compensated for the lean in finish())
    qE(PL.root, QA); qE(PL.torso, QB); const Rr = QA.clone(), dWt = QA.clone().multiply(QB);
    qE(PL.leg_L, QC); r.legs[0].quaternion.copy(Rr).multiply(QC); qE(PL.leg_R, QC); r.legs[1].quaternion.copy(Rr).multiply(QC);
    qE(PL.shin_L, QC); r.knees[0].quaternion.copy(QC); qE(PL.shin_R, QC); r.knees[1].quaternion.copy(QC);
    V3.set(0, 0.84, 0).applyQuaternion(Rr); V4.set(0, 0.16, 0).applyQuaternion(dWt); const t = PL.T; r.lean.position.set(t[0] + V3.x + V4.x, t[1] + V3.y + V4.y, t[2] + V3.z + V4.z);
  }
  finish() {
    const r = this.rig; QA.copy(r.lean.quaternion).invert(); r.legs[0].quaternion.premultiply(QA); r.legs[1].quaternion.premultiply(QA); r.m.position.y = -1;
  }
}
A.Ctl = Ctl;
const AX = new T.Vector3(1, 0, 0), QP = new T.Quaternion();
const addX = (node, ang) => { node.quaternion.premultiply(QP.setFromAxisAngle(AX, ang)); };

/* ---------------------------------------------------------------- game state -> clips */
const WK = { pistol: 'pistol', dual: 'pistol', smg: 'rifle', ar: 'rifle', shotgun: 'shotgun', sniper: 'sniper', rocket: 'rocket' };
const CYC = { walk: 2.4, run: 3.4, sprint: 4.4, back: 2.4, strafe_R: 2.2, strafe_L: 2.2 };
const PRIO = { hit: 3, throw: 2, shoot_pistol: 2, shoot_rifle: 2, shoot_shotgun: 2, shoot_sniper: 2, shoot_rocket: 2, chest_open: 1, equip: 1, build_place: 1 };
const DRINK = { chug: 1, slurp: 1, shield: 1, minishield: 1 };
A.weaponKind = it => it ? (it.type === 'gadget' ? 'pistol' : WK[it.w] || 'rifle') : 'rifle';
A.trigger = function (a, name, o) {
  if (!a || !a.alive || !info(name)) return; const prio = PRIO[name] || 1, os = a.os; if (os && os.t < os.dur && os.prio > prio) return;
  a.os = { name, t: 0, dur: (o && o.dur) || info(name).dur, prio, id: (os ? os.id : 0) + 1 };
};
A.shoot = function (a) { const it = a.inv && a.inv[a.sel]; A.trigger(a, 'shoot_' + A.weaponKind(it)); };
const trig = A.trigger;
A.emoteDur = function (name) { const i = info(name); return !i ? 3.6 : i.loop ? (name === 'wave' ? 2.4 : name === 'spin' ? 3.0 : 3.6) : i.dur + 0.3; };

function resolve(a, c, dt) {
  const st = a.state, inp = a.input || {}; let lo = 'idle', up = null, lo_o = {}, up_o = {}; c.air = c.air || null;
  const it = a.inv && a.inv[a.sel]; let aim = false, full = false;
  if (A.force) { lo = up = A.force; full = true; const inf = info(lo); if (inf && !inf.loop) { c.fcT = (c.fcT || 0) + dt; if (c.fcT > inf.dur + 0.6) { c.fcT = 0; lo_o.restart = up_o.restart = true; } } }
  else if (!a.alive) { lo = up = 'death'; full = true; lo_o.fade = up_o.fade = 0.1; }
  else if (a.victory) { lo = up = 'victory'; full = true; }
  else if (st === 'freefall') { lo = up = (inp.f > 0.3 ? 'dive' : 'freefall'); full = true; lo_o.fade = up_o.fade = 0.3; }
  else if (st === 'glide') { lo = up = 'glide'; full = true; lo_o.fade = up_o.fade = 0.3; }
  else if (a.vehicle) { lo = up = 'drive'; full = true; lo_o.fade = up_o.fade = 0.25; }
  else if (a.emote && info(a.emote.name)) { lo = up = a.emote.name; full = true; lo_o.fade = up_o.fade = 0.25; }
  else if ((a.hidden || a.hideLock) && (a.speedNow || 0) < 1.5) { lo = up = 'bush_hide'; full = true; lo_o.fade = up_o.fade = 0.3; }
  if (!full) {
    const sp = a.speedNow || 0, sy = Math.sin(a.yaw), cy = Math.cos(a.yaw), fwd = a.vx * -sy + a.vz * -cy, lat = a.vx * cy - a.vz * sy;
    if (c.st === 'freefall' || c.st === 'glide') c.landT = 0.5;
    if (!a.onGround) {
      if (!c.wasAir) { c.wasAir = true; c.airT = 0; c.air = a.vy > 2 ? 'jump' : 'fall'; }
      c.airT += dt; if (c.air === 'jump' && c.airT > 0.7 && a.vy < -3) c.air = 'fall';
      lo = c.air; up = lo; lo_o.fade = up_o.fade = 0.12;
    } else {
      if (c.wasAir) { c.wasAir = false; if (c.airT > 0.25) c.landT = 0.5; }
      if (c.landT > 0) { c.landT -= dt; lo = 'land'; lo_o.fade = 0.06; }
      else {
        let want; const wM = c.loco === 'run' ? 4.2 : 4.9, rM = c.loco === 'sprint' ? 6.6 : 7.3;
        if (sp < 0.35) want = 'idle'; else if (Math.abs(lat) > Math.abs(fwd) * 1.15 && Math.abs(lat) > 1.2) want = lat > 0 ? 'strafe_R' : 'strafe_L'; else if (fwd < -0.35 * sp && fwd < -1) want = 'back'; else want = sp < wM ? 'walk' : sp < rM ? 'run' : 'sprint';
        c.locoT += dt; if (want !== c.loco && (c.locoT > 0.14 || want === 'idle' && sp < 0.2)) { c.loco = want; c.locoT = 0; }
        lo = c.loco; lo_o.sync = up_o.sync = true; lo_o.fade = 0.18;
        if (lo !== 'idle') lo_o.ts = up_o.ts = Math.min(3.2, (sp / CYC[lo]) * info(lo).dur);
      }
      up = lo; if (lo === 'land') up = (it && (it.type === 'weapon' || it.type === 'gadget')) ? 'aim_' + A.weaponKind(it) : 'land';
    }
    c.st = st;
    const moving = sp > 0.8;
    if (a.buildMode) up = 'build_idle';
    else if (a.action && a.action.type === 'heal') up = DRINK[a.action.id] ? 'heal_drink' : 'heal_apply';
    else if (it) {
      if (it.type === 'weapon' || it.type === 'gadget') {
        const k = A.weaponKind(it); up = 'aim_' + k; aim = true;
        if (it.type === 'weapon' && a.reloading > 0 && a.reloadDur) { up = k === 'shotgun' ? 'reload_shotgun' : 'reload'; up_o.scrub = (1 - a.reloading / a.reloadDur) * info(up).dur; aim = true; }
      } else if (it.type === 'pickaxe') { if (!moving && up === lo) up = 'pickaxe_idle'; if (a.swing > 0) { up = 'pickaxe_swing'; up_o.scrub = Math.min(a.swing, info(up).dur); } }
    }
    if (a.os) { a.os.t += dt; if (a.os.t >= a.os.dur) a.os = null; else if (a.os.t < a.os.dur - 0.07) { up = a.os.name; up_o.fade = 0.05; if (a.os.id !== c.osId) { c.osId = a.os.id; up_o.restart = true; } if (a.os.name.slice(0, 5) === 'shoot') aim = true; } }
    if (up.slice(0, 3) === 'aim' || up.slice(0, 5) === 'shoot') aim = true;
    if (!up_o.fade) up_o.fade = up === 'pickaxe_swing' ? 0.04 : 0.15;
  } else if (a.os) a.os = null;
  c.aim = aim && !full; c.full = full;
  c.set('lo', lo, lo_o); c.set('up', up || lo, up_o);
}

function lowLod(a, dt) {
  const r = a.rig; if (!a.alive || a.state !== 'ground' || a.vehicle) return; const sp = a.speedNow || 0, amp = Math.min(1, sp / 4), p = a.walkPhase || 0;
  r.lean.rotation.z = Math.sin(p) * 0.07 * amp; r.lean.rotation.x = -0.14 * amp; r.m.position.y = -1 + Math.abs(Math.sin(p)) * 0.08 * amp; r.lean.rotation.y = Math.sin(p) * 0.1 * amp;
}

/* 2-bone IK: left hand to the weapon's fore-grip (computed in the torso/"hi" space) */
const IK = { S: new T.Vector3(), P: new T.Vector3(), E: new T.Vector3(), u: new T.Vector3(), pv: new T.Vector3(), d1: new T.Vector3(), d2: new T.Vector3(), q1: new T.Quaternion(), q2: new T.Quaternion(), dn: new T.Vector3(0, -1, 0) };
function leftIK(a, r, w) {
  const os = a.os; r.root.updateMatrixWorld(true);
  IK.P.copy(r.fore); if (os && os.name === 'shoot_shotgun') { const k = Math.max(0, Math.min(1, (os.t - 0.28) / 0.12)) * (1 - Math.max(0, Math.min(1, (os.t - 0.46) / 0.14))); IK.P.z += 0.34 * k; }
  r.hand.localToWorld(IK.P); r.hi.worldToLocal(IK.P);
  const S = IK.S.copy(r.arms[0].position), L1 = 0.4, L2 = 0.34; const dv = IK.u.copy(IK.P).sub(S); let d = dv.length(); if (d < 1e-4) return; dv.multiplyScalar(1 / d); d = Math.min(Math.max(d, 0.14), L1 + L2 - 0.02);
  const aa = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - aa * aa));
  IK.pv.set(-0.9, -0.8, 0.25); IK.pv.addScaledVector(dv, -IK.pv.dot(dv)).normalize();
  IK.E.copy(S).addScaledVector(dv, aa).addScaledVector(IK.pv, h);
  IK.d1.copy(IK.E).sub(S).normalize(); IK.q1.setFromUnitVectors(IK.dn, IK.d1);
  IK.d2.copy(S).addScaledVector(dv, d).sub(IK.E).normalize().applyQuaternion(QP.copy(IK.q1).invert()); IK.q2.setFromUnitVectors(IK.dn, IK.d2);
  r.arms[0].quaternion.slerp(IK.q1, w); r.elbows[0].quaternion.slerp(IK.q2, w);
}
/* called from actors.js after the procedural pose: overrides the joints with the clips */
A.update = function (a, dt) {
  const r = a.rig; if (!r || !r.knees) return; if (r.lod > 1) { lowLod(a, dt); return; }
  if (A.legacy) return;
  let c = a.anim; if (!c) { c = a.anim = new Ctl(r); } if (!c.ok) return;
  resolve(a, c, dt); c.step(dt);
  if (A.backendName !== (c.useMixer ? 'mixer' : 'keyframes')) A.backendName = c.useMixer ? 'mixer' : 'keyframes';
  const pit = a.pitch || 0;
  if (c.aim) { const k = pit * 0.95; addX(r.arms[0], k); addX(r.arms[1], k); addX(r.head, G.clamp(pit * 0.45, -0.5, 0.5)); }
  else if (!c.full) addX(r.head, G.clamp(pit * 0.35, -0.45, 0.45));
  // left hand -> fore-grip of two-handed weapons (2-bone IK), blended in/out by clip
  const upn = c.g.up.cur ? c.g.up.cur.name : '', w1 = c.aim && r.fore && r.held && r.hasGun && r.lod < 2 && upn !== 'reload' && upn !== 'reload_shotgun' && upn !== 'equip' ? 1 : 0;
  c.ikW = (c.ikW || 0) + (w1 - (c.ikW || 0)) * Math.min(1, dt * 12); if (c.ikW > 0.01 && r.fore) leftIK(a, r, c.ikW);
  if (a.emote || a.victory || (a.state === 'glide') || !a.alive || (c.full && !A.force)) { if (r.held) r.held.visible = !(a.emote || a.victory || a.state === 'glide' || !a.alive || c.full); }
  else if (r.held) r.held.visible = true;
  { const itp = a.inv && a.inv[a.sel]; r.pick.visible = !!(itp && itp.type === 'pickaxe' && !a.buildMode && a.alive && !a.emote && !a.victory && !c.full && a.state !== 'glide'); }
};

/* ---------------------------------------------------------------- lobby character */
A.lobby = { name: null, t: 0, next: 7, hold: false, until: 0 };
A.lobbyPlay = function (name, o) { if (!info(name)) return; o = o || {}; const L = A.lobby; L.name = name; L.t = 0; L.hold = !!o.hold; L.until = o.hold ? 1e9 : (o.dur || A.emoteDur(name)); L.restart = true; };
A.lobbyStop = function () { const L = A.lobby; L.name = null; L.hold = false; L.next = 6 + Math.random() * 4; };
const LOBBY_IDLES = ['wave', 'shrug', 'flex', 'clap', 'cheer', 'salute', 'bow', 'jacks', 'dance'];
A.updateLobby = function (rig, dt) {
  if (A.legacy) return false; let c = rig._ctl; if (!c) c = rig._ctl = new Ctl(rig); if (!c.ok) return false;
  const L = A.lobby;
  if (A.preview) { c.set('lo', A.preview.name, { fade: 0, scrub: A.preview.t }); c.set('up', A.preview.name, { fade: 0, scrub: A.preview.t }); rig.pick.visible = /^pickaxe/.test(A.preview.name); c.step(0); if (/^(aim|shoot)_/.test(A.preview.name) && rig.fore && rig.held) leftIK({ os: null }, rig, 1); return true; }
  if (A.force && info(A.force)) { const inf = info(A.force); if (!L.name) { L.name = A.force; L.hold = true; L.until = 1e9; L.restart = true; } }
  L.t += dt; if (!L.name) { L.next -= dt; if (L.next <= 0) { L.next = 8 + Math.random() * 6; A.lobbyPlay(LOBBY_IDLES[Math.floor(Math.random() * LOBBY_IDLES.length)], { dur: 0 }); const i = info(L.name); L.until = i.loop ? i.dur * 2 : i.dur + 0.2; } }
  else if (L.hold && L.name && info(L.name) && !info(L.name).loop && L.t > info(L.name).dur + 1.0) { L.t = 0; L.restart = true; }   // held one-shot emotes replay
  else if (L.t > L.until) { const f = A.force; if (f && info(f)) { L.name = f; L.t = 0; L.restart = true; } else A.lobbyStop(); }
  const o = { fade: 0.25 }; if (L.restart) { o.restart = true; L.restart = false; }
  if (L.name) { c.set('lo', L.name, o); c.set('up', L.name, Object.assign({}, o)); rig.pick.visible = false; if (rig.held) rig.held.visible = false; }
  else { c.set('lo', 'idle', { fade: 0.35 }); c.set('up', 'pickaxe_idle', { fade: 0.35 }); rig.pick.visible = true; }
  c.step(dt); addX(rig.head, 0); return true;
};
/* debug: pose a rig (any rig with .legs etc.) at an exact time of a clip */
A.pose = function (rig, name, time) {
  let c = rig._ctl; if (!c) c = rig._ctl = new Ctl(rig); if (!c.ok || !info(name)) return false;
  c.g.lo.cur = c.g.up.cur = null; c.g.lo.prev = c.g.up.prev = null; c.set('lo', name, { fade: 0, scrub: time }); c.set('up', name, { fade: 0, scrub: time }); c.step(0); return true;
};
G.lobbyAnim = n => A.lobbyPlay(n, { hold: true });
})();
