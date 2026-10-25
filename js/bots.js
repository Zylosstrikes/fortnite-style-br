'use strict';
/* Bot AI: drop, loot, harvest, build, fight, heal, flee storm */
(function () {
const G = window.G;
const AI = G.AI = {};
const WS = { ar: 10, smg: 8, shotgun: 8, sniper: 6, rocket: 5, pistol: 4 };
const EFF = { ar: 75, smg: 42, pistol: 42, shotgun: 22, sniper: 130, rocket: 60 };
const PREF = { ar: 28, smg: 18, pistol: 22, shotgun: 9, sniper: 60, rocket: 34 };
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
function turn(a, y, dt, rate) { const d = G.angDiff(a.yaw, y); a.yaw += G.clamp(d, -rate * dt, rate * dt); }
function weaponsOf(a) { const o = []; for (let i = 1; i < 6; i++) { const s = a.inv[i]; if (s && s.type === 'weapon') o.push(i); } return o; }
function hasAmmoWeapon(a) { return weaponsOf(a).some(i => { const s = a.inv[i], W = G.WEAPONS[s.w]; return s.mag > 0 || a.ammo[W.ammo] > 0; }); }
function healSlot(a, wantHp) { let best = -1; for (let i = 1; i < 6; i++) { const s = a.inv[i]; if (!s || s.type !== 'heal') continue; const h = G.HEALS[s.id]; if (wantHp && h.hp > 0 || !wantHp && h.sh > 0) { if (best < 0) best = i; else if (wantHp && s.id === 'bandage') best = i; } } return best; }
function ws(s) { return (WS[s.w] || 5) * (1 + s.rarity * 0.12); }
function lootValue(a, l) {
  const it = l.item; if (l.taken) return 0; if (l.claim && l.claim !== a.id && G.time - l.claimT < 10) return 0; const nw = weaponsOf(a).length;
  if (it.kind === 'weapon') { if (nw === 0) return 90; if (nw < 3) return 50 + it.rarity * 8; const worst = Math.min(...weaponsOf(a).map(i => ws(a.inv[i]))); return (WS[it.w] || 5) * (1 + it.rarity * 0.12) > worst * 1.3 ? 35 : 0; }
  if (it.kind === 'ammo') { const W = Object.values(G.WEAPONS); const need = weaponsOf(a).some(i => G.WEAPONS[a.inv[i].w].ammo === it.t) && a.ammo[it.t] < G.AMMO[it.t].max * 0.6; return need ? 28 : 3; }
  let free = 0; for (let i = 1; i < 6; i++) if (!a.inv[i]) free++; return free > 1 ? 24 : 0;
}
AI.init = function (a, bus, pois) {
  const skill = G.rand(0.35, 1); const tgtPoi = Math.random() < 0.85 ? G.pick(pois) : null;
  let tx, tz; if (tgtPoi) { const ang = Math.random() * 6.28, r = Math.random() * tgtPoi.r * 0.6; tx = tgtPoi.x + Math.cos(ang) * r; tz = tgtPoi.z + Math.sin(ang) * r; } else { const ang = Math.random() * 6.28, r = Math.random() * 380; tx = Math.cos(ang) * r; tz = Math.sin(ang) * r; }
  a.ai = { mode: 'bus', skill, spreadMul: 2.0 - skill * 1.3, tx, tz, jumpDist: G.rand(120, 240), path: [], pi: 0, enemy: null, lastSeen: 0, react: 0, strafe: 1, strafeT: 0, stuckT: 0, stuckN: 0, lx: 0, lz: 0, avoidUntil: 0, avoidOff: 0, steerYaw: 0, steerT: 0, buildCD: 0, senseT: Math.random() * 0.3, target: null, tgtT: 0, wander: null, harvest: null, healing: false, emoteT: 0, ex: 0, ez: 0, ewY: 0, los: false, wpnT: 0, idle: 0 };
  a.dmgScale = 0.7 + skill * 0.2; a.openAlt = G.rand(70, 140);
};
AI.onHit = function (t, att) { if (!t.ai || !att || att === t) return; t.ai.lastHitBy = att; t.ai.lastHitT = G.time; if (!t.ai.enemy || t.ai.enemy === att) { t.ai.enemy = att; t.ai.react = Math.min(t.ai.react, 0.4); } t.ai.healing = false; };
AI.onKill = function (k) { if (Math.random() < 0.25) k.ai.emoteT = G.time + G.rand(0.6, 1.5); };

function steer(a, dx, dz, dt) {
  const ai = a.ai; const want = yawTo(dx, dz); ai.steerT -= dt;
  if (ai.steerT <= 0) {
    ai.steerT = 0.12; let best = want, found = false; const offs = [0, 0.45, -0.45, 0.9, -0.9, 1.5, -1.5, 2.3];
    const pref = ai.avoidSide || 1;
    for (const o0 of offs) { const o = o0 * pref; const y = want + o; const px = a.x - Math.sin(y) * 1.5, pz = a.z - Math.cos(y) * 1.5; if (!G.World.blocked(px, pz, a.y, 0.45) && !G.World.blocked(a.x - Math.sin(y) * 0.8, a.z - Math.cos(y) * 0.8, a.y, 0.4)) { best = y; found = true; if (o0 !== 0) ai.avoidSide = o0 > 0 ? pref : pref; break; } }
    if (!found) { best = want + 1.2; a.input.jump = true; }
    if (G.time < ai.avoidUntil) best = want + ai.avoidOff; ai.steerYaw = best;
  }
  return ai.steerYaw;
}
function walkTo(a, tx, tz, dt, sprint) {
  const ai = a.ai, dx = tx - a.x, dz = tz - a.z; const y = steer(a, dx, dz, dt); turn(a, y, dt, 9); a.input.f = 1; a.input.s = 0; a.input.sprint = !!sprint;
  // stuck detect
  ai.stuckT += dt; if (ai.stuckT > 0.7) { const m = Math.hypot(a.x - ai.lx, a.z - ai.lz); ai.lx = a.x; ai.lz = a.z; ai.stuckT = 0; if (m < 0.8) { ai.stuckN++; a.input.jump = true; ai.avoidUntil = G.time + 1.0; ai.avoidOff = (Math.random() < 0.5 ? 1 : -1) * G.rand(0.9, 1.9); if (ai.stuckN > 3) { ai.target = null; ai.path = []; ai.wander = null; ai.stuckN = 0; if (a.mats.wood >= 10 && Math.random() < 0.5) { /* build out */ } } } else ai.stuckN = Math.max(0, ai.stuckN - 1); }
  return Math.hypot(dx, dz);
}
function inBld(a, b) { return a.x > b.x - b.w / 2 && a.x < b.x + b.w / 2 && a.z > b.z - b.d / 2 && a.z < b.z + b.d / 2; }
function pickTarget(a) {
  const ai = a.ai; let best = null, bv = 0;
  for (const c of G.chests) { if (c.opened) continue; const d = Math.hypot(c.x - a.x, c.z - a.z); if (d > 150) continue; if (c.bld && c.y - c.bld.base > 1) continue; if (c.claim && c.claim !== a.id && G.time - c.claimT < 10) continue; const v = 60 / (20 + d); if (v > bv) { bv = v; best = { kind: 'chest', o: c }; } }
  for (const l of G.loot) { if (l.taken) continue; const d = Math.hypot(l.x - a.x, l.z - a.z); if (d > 130) continue; if (l.bld && l.y - l.bld.base > 1) continue; const val = lootValue(a, l); if (val <= 0) continue; const v = val / (20 + d); if (v > bv) { bv = v; best = { kind: 'loot', o: l }; } }
  if (!best) return false; best.o.claim = a.id; best.o.claimT = G.time; ai.target = best; ai.path = []; const o = best.o;
  if (o.bld && !inBld(a, o.bld) && o.bld.doorOut) ai.path = [o.bld.doorOut, o.bld.doorIn];
  ai.path.push({ x: o.x, z: o.z }); ai.pi = 0; ai.tgtT = G.time; return true;
}
function equipBest(a, dist) {
  let best = -1, bs = -99; for (const i of weaponsOf(a)) { const s = a.inv[i], W = G.WEAPONS[s.w]; if (s.mag <= 0 && a.ammo[W.ammo] <= 0) continue; let sc;
    if (dist < 12) sc = { shotgun: 10, smg: 8, ar: 6, pistol: 5, rocket: 2, sniper: 1 }[s.w]; else if (dist < 40) sc = { ar: 10, smg: 8, pistol: 5, shotgun: 4, rocket: dist > 18 ? 6 : 2, sniper: 5 }[s.w]; else sc = { sniper: 10, ar: 9, smg: 4, pistol: 3, rocket: 5, shotgun: 1 }[s.w];
    sc *= 1 + s.rarity * 0.1; if (s.mag === 0) sc -= 2; if (sc > bs) { bs = sc; best = i; } }
  if (best >= 0 && best !== a.sel && !a.action) { a.sel = best; a.reloading = 0; G.updateHeld(a); }
  return best;
}
function senseEnemy(a) {
  const ai = a.ai; let best = null, bd = 1e9; const cur = a.inv[a.sel]; const range = cur && cur.type === 'weapon' && cur.w === 'sniper' ? 130 : 80;
  for (const t of G.actors) { if (t === a || !t.alive || t.state === 'bus') continue; const d = Math.hypot(t.x - a.x, t.z - a.z); if (d > range || d > bd) continue; if (Math.abs(t.y - a.y) > 60) continue;
    if (!G.World.los(a.x, a.y + 1.5, a.z, t.x, t.y + 1.3, t.z)) continue; bd = d; best = t; }
  if (best) { if (ai.enemy !== best) { ai.react = G.rand(0.35, 1.1) * (1.3 - ai.skill); ai.enemy = best; } ai.lastSeen = G.time; ai.los = true; ai.ex = best.x; ai.ez = best.z; }
  else { ai.los = false; if (ai.enemy && (!ai.enemy.alive || G.time - ai.lastSeen > 4)) ai.enemy = null; }
}
function stormInfo(a) {
  const S = G.storm; if (!S) return null; const useNext = S.stage === 'shrink' || (S.stage === 'wait' && S.left < 18); const cx = useNext ? S.nx : S.cx, cz = useNext ? S.nz : S.cz, r = useNext ? S.nr : S.r;
  const d = Math.hypot(a.x - cx, a.z - cz); return { cx, cz, r, d, out: d > r * 0.85 - 6 || Math.hypot(a.x - S.cx, a.z - S.cz) > S.r - 4 };
}
AI.update = function (a, dt) {
  const ai = a.ai; if (!ai || !a.alive) return; const inp = a.input; inp.f = 0; inp.s = 0; inp.sprint = false; inp.ads = false;
  if (a.state === 'bus') {
    const b = G.bus; if (!b || !b.active) return; const d = Math.hypot(b.x - ai.tx, b.z - ai.tz); const past = (ai.tx - b.x) * b.dx + (ai.tz - b.z) * b.dz < -60;
    if ((d < ai.jumpDist && Math.hypot(b.x, b.z) < 470) || past && Math.hypot(b.x, b.z) < 480 || Math.hypot(b.x, b.z) > 470 && b.t > 8 && ((b.x * b.dx + b.z * b.dz) > 0)) { a.yaw = yawTo(ai.tx - b.x, ai.tz - b.z); G.jumpFromBus(a, b); ai.mode = 'air'; }
    return;
  }
  if (a.state === 'freefall' || a.state === 'glide') {
    const dx = ai.tx - a.x, dz = ai.tz - a.z, d = Math.hypot(dx, dz); turn(a, yawTo(dx, dz), dt, 3); inp.f = d > 14 || a.state === 'freefall' ? 1 : 0.2; return;
  }
  if (a.vehicle) return;
  if (ai.mode === 'air') { ai.mode = 'ground'; if (a.mats.wood < 50) { a.mats.wood = Math.floor(G.rand(30, 140)); a.mats.stone = Math.floor(G.rand(0, 60)); a.mats.metal = Math.floor(G.rand(0, 40)); } }
  ai.buildCD -= dt; ai.senseT -= dt;
  if (G.time < ai.emoteT && !a.emote && !ai.enemy) { ai.emoteT = 0; G.startEmote(a, G.pick(['dance', 'wave', 'flex', 'spin'])); }
  if (a.emote) return;
  if (ai.senseT <= 0) { ai.senseT = 0.22 + Math.random() * 0.1; senseEnemy(a); if (G.time % 3 < 0.3) G.autoAmmo(a); }
  if (a.id % 4 === Math.floor(G.time * 4) % 4) G.autoAmmo(a);
  const st = stormInfo(a);
  // heal in peace
  if (a.action) { return; }
  const e = ai.enemy;
  if (st && st.out && !(e && ai.los && Math.hypot(e.x - a.x, e.z - a.z) < 25)) { // run to safety
    const tx = st.cx + Math.sin(a.id) * st.r * 0.3, tz = st.cz + Math.cos(a.id * 1.7) * st.r * 0.3; if (a.inv[a.sel] && a.inv[a.sel].type === 'heal') { a.sel = 0; G.updateHeld(a); }
    walkTo(a, tx, tz, dt, true); ai.mode = 'storm'; if (a.inWater) inp.sprint = true; return;
  }
  if (e && e.alive && (ai.los || G.time - ai.lastSeen < 3) && (hasAmmoWeapon(a) || Math.hypot(e.x - a.x, e.z - a.z) < 9)) { fight(a, dt, e); return; }
  // not fighting
  ai.mode = 'idle'; const hurtHp = a.hp < 65, hurtSh = a.shield < 40 && a.hp > 50;
  if ((hurtHp || hurtSh) && G.time - a.lastHitT > 3) { const slot = healSlot(a, hurtHp); if (slot > 0) { a.sel = slot; G.updateHeld(a); if (G.startHeal(a)) return; } }
  const cur = a.inv[a.sel]; if (cur && cur.type === 'weapon' && cur.mag < G.WEAPONS[cur.w].mag * 0.5 && a.ammo[G.WEAPONS[cur.w].ammo] > 0 && !a.reloading) G.startReload(a);
  if (!cur || cur.type !== 'weapon') { const i = weaponsOf(a)[0]; if (i && !ai.harvest) equipBest(a, 30); }
  // loot
  if (!ai.target || ai.target.o.taken || (ai.target.kind === 'chest' && ai.target.o.opened) || G.time - ai.tgtT > 25) { ai.target = null; ai.tgtT = G.time; if (G.time >= (ai.lootNext || 0)) { if (!pickTarget(a)) ai.lootNext = G.time + 2; } }
  if (ai.target) {
    const p = ai.path[ai.pi]; if (!p) { ai.target = null; return; } const d = walkTo(a, p.x, p.z, dt, !hasAmmoWeapon(a) || ai.skill > 0.6); ai.mode = 'loot'; if (!ai.target) return;
    if (ai.pi < ai.path.length - 1) { if (d < 1.4) ai.pi++; }
    else { const o = ai.target.o; const dd = Math.hypot(o.x - a.x, o.z - a.z); if (dd < (ai.target.kind === 'chest' ? 2.2 : 1.8)) {
      if (ai.target.kind === 'chest') { G.World.openChest(o); G.Audio.at('chest', o.x, o.y, o.z); } else { const it = o.item; if (it.kind === 'weapon' && weaponsOf(a).length >= 3) { let wi = weaponsOf(a).sort((x, y) => ws(a.inv[x]) - ws(a.inv[y]))[0]; a.sel = wi; } G.pickupLoot(a, o); if (!a.inv[a.sel]) a.sel = 0; G.updateHeld(a); if (!hasAmmoWeapon(a) === false) equipBest(a, 30); }
      ai.target = null; } }
    return;
  }
  // harvest trees when low on mats
  if (!ai.harvest && a.mats.wood < 60 && Math.random() < dt * 0.3) { let bt = null, bd = 45 * 45; for (const t of G.World.trees) { if (t.dead) continue; const d = (t.x - a.x) ** 2 + (t.z - a.z) ** 2; if (d < bd) { bd = d; bt = t; } } if (bt) ai.harvest = { t: bt, until: G.time + 14 }; }
  if (ai.harvest) { const h = ai.harvest; if (h.t.dead || G.time > h.until || a.mats.wood > 140) { ai.harvest = null; equipBest(a, 30); }
    else { if (a.sel !== 0) { a.sel = 0; G.updateHeld(a); } const dx = h.t.x - a.x, dz = h.t.z - a.z, d = Math.hypot(dx, dz); if (d > 1.9) walkTo(a, h.t.x, h.t.z, dt, false); else { turn(a, yawTo(dx, dz), dt, 10); a.pitch = 0.2; G.startSwing(a); } ai.mode = 'harvest'; return; } }
  // roam toward safe zone / POI
  const S = G.storm; if (!ai.wander || Math.hypot(ai.wander.x - a.x, ai.wander.z - a.z) < 5 || G.time > ai.wander.until) {
    let cx = S ? S.cx : 0, cz = S ? S.cz : 0, r = S ? S.r : 400; if (S && (S.stage === 'shrink' || S.left < 25)) { cx = S.nx; cz = S.nz; r = S.nr; }
    const pois = G.POIS.filter(p => Math.hypot(p.x - cx, p.z - cz) < r); let p = pois.length && Math.random() < 0.6 ? G.pick(pois) : null; let x, z; if (p) { x = p.x + G.rand(-p.r, p.r) * 0.5; z = p.z + G.rand(-p.r, p.r) * 0.5; } else { const ang = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * r * 0.8; x = cx + Math.cos(ang) * rr; z = cz + Math.sin(ang) * rr; }
    ai.wander = { x, z, until: G.time + 25 };
  }
  walkTo(a, ai.wander.x, ai.wander.z, dt, false); ai.mode = 'roam';
};
function fight(a, dt, e) {
  const ai = a.ai, inp = a.input; ai.mode = 'fight';
  const tx = ai.los ? e.x : ai.ex, tz = ai.los ? e.z : ai.ez; const dx = tx - a.x, dz = tz - a.z, dist = Math.hypot(dx, dz); const ty = (e.y || a.y) + 1.2;
  turn(a, yawTo(dx, dz), dt, 7); a.pitch += (Math.atan2(ty - (a.y + 1.4), dist) - a.pitch) * Math.min(1, dt * 8); ai.react -= dt; ai.wpnT -= dt;
  if (ai.wpnT <= 0) { ai.wpnT = 1.0; equipBest(a, dist); }
  const cur = a.inv[a.sel]; const armed = cur && cur.type === 'weapon' && (cur.mag > 0 || a.ammo[G.WEAPONS[cur.w].ammo] > 0);
  const w = cur && cur.type === 'weapon' ? cur.w : null;
  if (!armed) { // flee / melee
    if (dist < 3 && a.inv[0]) { if (a.sel !== 0) { a.sel = 0; G.updateHeld(a); } G.startSwing(a); }
    else { const fx = a.x - dx, fz = a.z - dz; walkTo(a, fx, fz, dt, true); if (Math.random() < 0.01) ai.enemy = null; }
    if (!hasAmmoWeapon(a) && ai.los && dist < 12) { /* panic-build */ if (ai.buildCD <= 0 && a.mats.wood >= 10) tryBuild(a, 'wall'); }
    return;
  }
  const pref = PREF[w] || 25, eff = EFF[w] || 50;
  // movement: approach / retreat + strafe
  ai.strafeT -= dt; if (ai.strafeT <= 0) { ai.strafeT = G.rand(0.7, 1.8); ai.strafe = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.15) inp.jump = true; }
  const fwd = dist > pref + 8 ? 1 : dist < pref - 6 ? -1 : 0; inp.f = fwd; inp.s = ai.strafe * (dist < eff ? 0.8 : 0.2); inp.sprint = dist > eff * 1.2;
  if (G.World.blocked(a.x - Math.sin(a.yaw) * inp.f * 1.2 + Math.cos(a.yaw) * inp.s * 1.2, a.z - Math.cos(a.yaw) * inp.f * 1.2 - Math.sin(a.yaw) * inp.s * 1.2, a.y, 0.4)) { inp.s = -inp.s; ai.strafe = -ai.strafe; if (Math.random() < 0.3) inp.jump = true; }
  if (!ai.los) { inp.f = 1; inp.s = 0; }
  // build cover
  if (ai.buildCD <= 0 && ai.los && a.mats.wood >= 10 && G.time - a.lastHitT < 2.2 && dist > 5 && !a.vehicle) { if (e.y - a.y > 2.6 && a.mats.wood >= 30) { a.mats.wood -= 0; tryBuild(a, 'ramp'); ai.buildCD = 1.0; inp.f = 1; } else { tryBuild(a, 'wall'); ai.buildCD = G.rand(2.5, 5); } }
  // shoot
  if (ai.los && ai.react <= 0 && dist < eff * 1.05) {
    if (cur.mag <= 0) { G.startReload(a); } else {
      const err = (1.25 - ai.skill) * 0.03 * dist + 0.1; const ay = e.y + (ai.skill > 0.7 && Math.random() < 0.18 ? 1.62 : 1.15);
      const ax = e.x + G.rand(-err, err) + (e.vx || 0) * 0.05 * (dist / 30), az = e.z + G.rand(-err, err) + (e.vz || 0) * 0.05 * (dist / 30);
      const dyaw = Math.abs(G.angDiff(a.yaw, yawTo(e.x - a.x, e.z - a.z)));
      if (dyaw < 0.25) { if (w === 'rocket' && dist < 10) {} else G.tryFire(a, ax, ay + G.rand(-err, err) * 0.3, az); }
    }
  }
}
function tryBuild(a, type) { if (a.placeCD > 0) return false; const sp = G.Build.spec(a, type); const p = G.Build.place(a, sp); if (p) { a.placeCD = 0.2; return true; } return false; }

/* ---------- spawn bots ---------- */
G.spawnBots = function (n) {
  const names = G.BOT_NAMES.slice().sort(() => Math.random() - 0.5); const hats = ['cap', 'helmet', 'mohawk', 'horns', 'beanie', 'band'];
  for (let i = 0; i < n; i++) {
    const cols = G.SKIN_COLORS; const skin = { shirt: G.pick(cols), pants: G.pick([0x2b3a55, 0x3a2b55, 0x2b5540, 0x554a2b, 0x40414a]), acc: G.pick(cols), hat: G.pick(hats), tone: G.pick([0xf2c9a0, 0xd9a577, 0xa87650, 0x7b5236, 0xffe0c4]) };
    const a = G.createActor(names[i % names.length], false, skin); a.stats.born = 0; G.AI.init(a, G.bus, G.POIS); a.rig.root.visible = false;
  }
};
})();
