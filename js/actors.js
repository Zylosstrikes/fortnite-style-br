'use strict';
/* Actors (player + bots): physics, inventory, combat, building, harvesting, vehicles, FX */
(function () {
const G = window.G, T = THREE, W = () => G.World;
const FH = G.FH, S = G.BS;
G.actors = []; G.pieces = new Map(); G.pieceList = []; G.projectiles = []; G.vehicles = []; G.time = 0; G.hooks = {};
G.hook = function (n, a, b, c) { const f = G.hooks[n]; if (f) f(a, b, c); };
const Y = new T.Vector3(0, 1, 0);

/* ================= FX ================= */
const FX = G.FX = {
  P: [], tr: [], ex: [], shake: 0,
  init(scene) {
    this.scene = scene; this.N = 700;
    this.mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xffffff }), this.N); this.mesh.frustumCulled = false; this.mesh.count = 0; scene.add(this.mesh);
    for (let i = 0; i < 40; i++) { const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })); m.visible = false; scene.add(m); this.tr.push({ m, life: 0 }); }
    for (let i = 0; i < 6; i++) { const m = new T.Mesh(new T.SphereGeometry(1, 12, 8), new T.MeshBasicMaterial({ color: 0xffa83a, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, fog: false })); m.visible = false; scene.add(m); const ring = new T.Mesh(new T.RingGeometry(0.72, 1, 28), new T.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring); this.ex.push({ m, ring, life: 0, r: 1 }); }
    this.dummy = new T.Object3D(); this.col = new T.Color();
  },
  spawn(x, y, z, vx, vy, vz, color, size, life, grav) { if (this.P.length >= this.N) this.P.shift(); this.P.push({ x, y, z, vx, vy, vz, color, size, life, max: life, grav: grav === undefined ? 14 : grav }); },
  burst(x, y, z, color, n, speed, size, life, grav) { for (let i = 0; i < n; i++) this.spawn(x, y, z, (Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed, color, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav); },
  debris(x, y, z, color, n) { this.burst(x, y, z, color, n || 8, 7, 0.22, 0.9, 16); },
  tracer(ox, oy, oz, px, py, pz, color) {
    const t = this.tr.find(q => q.life <= 0); if (!t) return; const dx = px - ox, dy = py - oy, dz = pz - oz, len = Math.hypot(dx, dy, dz); if (len < 1) return;
    t.m.position.set((ox + px) / 2, (oy + py) / 2, (oz + pz) / 2); t.m.lookAt(px, py, pz); t.m.scale.set(0.05, 0.05, Math.min(len, 60)); if (len > 60) t.m.position.set(ox + dx / len * 30, oy + dy / len * 30, oz + dz / len * 30); t.m.material.color.setHex(color || 0xfff2a8); t.m.visible = true; t.life = 0.1;
  },
  explosion(x, y, z, r) { const e = this.ex.find(q => q.life <= 0) || this.ex[0]; e.m.position.set(x, y, z); e.ring.position.set(x, y + 0.15, z); e.life = 0.6; e.r = r; e.m.visible = true; e.ring.visible = true; const fs = G.fxScale || 1; this.burst(x, y, z, 0xff8a2a, Math.round(30 * fs), 18, 0.55, 0.8, 4); this.burst(x, y, z, 0xffe07a, Math.round(18 * fs), 12, 0.38, 0.6, 2); this.burst(x, y + 0.5, z, 0x4a4a52, Math.round(22 * fs), 8, 1.1, 1.8, -1.5); this.burst(x, y + 0.3, z, 0xffcf5a, Math.round(24 * fs), 30, 0.14, 1.1, 14); },
  hit(x, y, z, color, n) { const fs = G.fxScale || 1; this.burst(x, y, z, color, Math.max(2, Math.round((n || 5) * fs)), 7, 0.1, 0.35, 14); this.spawn(x, y, z, 0, 0, 0, 0xffffff, 0.45, 0.07, 0); this.spawn(x, y, z, 0, 0.4, 0, color, 0.28, 0.2, -2); },
  update(dt) {
    const d = this.dummy, m = this.mesh; let n = 0;
    for (let i = this.P.length - 1; i >= 0; i--) {
      const p = this.P[i]; p.life -= dt; if (p.life <= 0) { this.P.splice(i, 1); continue; }
      p.vy -= p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 0.99;
    }
    for (const p of this.P) { const s = p.size * Math.min(1, p.life / p.max * 2); d.position.set(p.x, p.y, p.z); d.scale.set(s, s, s); d.rotation.set(p.x, p.y, 0); d.updateMatrix(); m.setMatrixAt(n, d.matrix); this.col.setHex(p.color); m.setColorAt(n, this.col); n++; }
    m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    for (const t of this.tr) if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.m.visible = false; }
    for (const e of this.ex) if (e.life > 0) { e.life -= dt; const k = 1 - e.life / 0.6; e.m.scale.setScalar(Math.max(0.1, e.r * (0.2 + k * 0.9))); e.m.material.opacity = Math.max(0, 0.8 * (1 - k * k)); e.ring.scale.setScalar(Math.max(0.1, e.r * (0.3 + k * 2.1))); e.ring.material.opacity = Math.max(0, 0.75 * (1 - k)); if (e.life <= 0) { e.m.visible = false; e.ring.visible = false; } }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }
};

/* ================= Actors ================= */
let nid = 1;
G.createActor = function (name, isPlayer, skin) {
  const a = {
    id: nid++, name, isPlayer, isBot: !isPlayer, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 6.28, pitch: 0, hp: 100, shield: 0, alive: true, state: 'bus', onGround: false,
    inv: [{ type: 'pickaxe' }, null, null, null, null, null], sel: 0, ammo: { light: 0, medium: 0, shells: 0, heavy: 0, rockets: 0 }, mats: { wood: 0, stone: 0, metal: 0 }, buildMat: 'wood', buildMode: false, buildType: 'wall',
    fireCD: 0, reloading: 0, action: null, input: { f: 0, s: 0, jump: false, sprint: false, ads: false }, glideOpen: false, emote: null, swing: 0, swingHit: false, bloom: 0, walkPhase: 0, stepT: 0,
    skin, kills: 0, dmgScale: 1, deadT: 0, vehicle: null, inWater: false, lastHitT: -99, placeCD: 0, speedNow: 0,
    stats: { dealt: 0, taken: 0, shots: 0, hits: 0, dist: 0, harvested: 0, built: 0, born: 0, placement: 0 },
  };
  a.rig = G.makeCharacter(skin); a.rig.setHeld('pickaxe'); G.scene.add(a.rig.root);
  if (!isPlayer) { a.plate = G.makeNameplate(name); a.rig.root.add(a.plate); a.plate.visible = false; }
  G.actors.push(a); return a;
};
G.curItem = a => a.inv[a.sel];
G.aliveCount = () => G.actors.reduce((n, a) => n + (a.alive ? 1 : 0), 0);
G.updateHeld = function (a) {
  const it = a.inv[a.sel]; const r = a.rig;
  if (a.buildMode || !it || it.type === 'heal') r.setHeld('none'); else if (it.type === 'pickaxe') r.setHeld('pickaxe'); else if (it.type === 'gadget') r.setHeld('gadget', it.id); else r.setHeld('weapon', it.w, it.rarity);
};
G.selectSlot = function (a, i) {
  if (!a.alive || i < 0 || i > 5) return; if (a.inv[i] === null && i !== a.sel) return;
  if (a.action) a.action = null; a.reloading = 0; a.sel = i; a.buildMode = false; G.updateHeld(a); if (a.isPlayer) G.Audio.play('click', 0.6);
};
function itemOf(s) { return !s ? null : s.type === 'weapon' ? { kind: 'weapon', w: s.w, rarity: s.rarity } : s.type === 'heal' ? { kind: 'heal', id: s.id, n: s.n } : s.type === 'gadget' ? { kind: 'gadget', id: s.id, n: s.n } : null; }
G.dropAt = function (item, x, y, z, spread) { const ang = Math.random() * 6.28, r = spread === undefined ? G.rand(0.8, 1.6) : spread; const lx = x + Math.cos(ang) * r, lz = z + Math.sin(ang) * r; return G.addLoot(item, lx, Math.max(y, G.World.heightAt(lx, lz) + 0.1), lz); };
G.giveItem = function (a, item) {
  if (item.kind === 'ammo') { const m = G.AMMO[item.t].max, take = Math.min(item.n, m - a.ammo[item.t]); if (take <= 0) return { ok: false, rem: item.n }; a.ammo[item.t] += take; return { ok: true, rem: item.n - take }; }
  if (item.kind === 'weapon') {
    let idx = -1; for (let i = 1; i < 6; i++) if (!a.inv[i]) { idx = i; break; }
    if (idx < 0) { if (a.sel >= 1 && a.inv[a.sel]) { const old = itemOf(a.inv[a.sel]); G.dropAt(old, a.x, a.y, a.z); idx = a.sel; } else return { ok: false, rem: 1 }; }
    a.inv[idx] = { type: 'weapon', w: item.w, rarity: item.rarity, mag: G.WEAPONS[item.w].mag };
    if (a.isPlayer && (a.sel === 0 || !a.inv[a.sel])) G.selectSlot(a, idx); else if (idx === a.sel) G.updateHeld(a);
    if (a.isBot) { const W_ = G.WEAPONS[item.w]; a.ammo[W_.ammo] = Math.min(G.AMMO[W_.ammo].max, a.ammo[W_.ammo] + Math.ceil(G.AMMO[W_.ammo].pick * 0.7)); }
    return { ok: true, rem: 0 };
  }
  if (item.kind === 'heal' || item.kind === 'gadget') {
    const ty = item.kind, st = (ty === 'heal' ? G.HEALS : G.GADGETS)[item.id].stack; let n = item.n;
    for (let i = 1; i < 6 && n > 0; i++) { const s = a.inv[i]; if (s && s.type === ty && s.id === item.id && s.n < st) { const t = Math.min(n, st - s.n); s.n += t; n -= t; } }
    for (let i = 1; i < 6 && n > 0; i++) if (!a.inv[i]) { const t = Math.min(n, st); a.inv[i] = { type: ty, id: item.id, n: t }; n -= t; }
    return { ok: n < item.n, rem: n };
  }
  return { ok: false, rem: 1 };
};
G.pickupLoot = function (a, l) {
  if (l.taken) return false; const it = l.item; const r = G.giveItem(a, it);
  if (!r.ok) { if (a.isPlayer) G.hook('msg', it.kind === 'ammo' ? 'Ammo full' : 'Inventory full'); return false; }
  if (r.rem > 0) it.n = r.rem; else l.taken = true;
  if (a.isPlayer) { G.Audio.play('pickup'); G.hook('pickup', it); } else G.Audio.at('step', l.x, l.y, l.z, 0.5);
  return true;
};
G.itemName = function (it) { return it.kind === 'weapon' ? G.RARITY[it.rarity].name + ' ' + G.WEAPONS[it.w].name : it.kind === 'ammo' ? G.AMMO[it.t].name + ' x' + it.n : it.kind === 'gadget' ? G.GADGETS[it.id].name + (it.n > 1 ? ' x' + it.n : '') : G.HEALS[it.id].name + (it.n > 1 ? ' x' + it.n : ''); };
G.itemColor = function (it) { return it.kind === 'weapon' ? G.RARITY[it.rarity].hex : it.kind === 'ammo' ? G.AMMO[it.t].hex : it.kind === 'gadget' ? G.GADGETS[it.id].hex : G.HEALS[it.id].hex; };
const _lootAmmoT = [0];
G.autoAmmo = function (a) {
  const L = G.loot; for (let i = 0; i < L.length; i++) { const l = L[i]; if (l.taken || l.item.kind !== 'ammo') continue; const dx = l.x - a.x, dz = l.z - a.z; if (dx * dx + dz * dz < 2.2 && Math.abs(l.y - a.y) < 2.5) G.pickupLoot(a, l); }
};

/* ---------- reload / heal ---------- */
G.startReload = function (a) {
  const it = a.inv[a.sel]; if (!it || it.type !== 'weapon' || a.reloading > 0 || a.action) return; const W_ = G.WEAPONS[it.w];
  if (it.mag >= W_.mag || a.ammo[W_.ammo] <= 0) return; a.reloading = W_.reload * (1 - 0.04 * it.rarity); a.reloadDur = a.reloading; G.Audio.at('reload', a.x, a.y, a.z);
};
G.startHeal = function (a) {
  const it = a.inv[a.sel]; if (!it || it.type !== 'heal' || a.action) return false; const h = G.HEALS[it.id];
  const needHp = h.hp > 0 && a.hp < (h.cap || 100), needSh = h.sh > 0 && a.shield < (h.shcap || 100); if (!needHp && !needSh) { if (a.isPlayer) G.hook('msg', 'Already at max'); return false; }
  a.action = { type: 'heal', id: it.id, t: 0, dur: h.time, slot: a.sel, hp0: a.hp, sh0: a.shield }; a.reloading = 0; G.Audio.at(it.id === 'slurp' ? 'drink' : 'heal', a.x, a.y, a.z, 0.8); return true;
};

/* ---------- damage / death ---------- */
G.damageActor = function (t, dmg, att, head, wname) {
  if (!t.alive || t.state === 'bus') return; if (att && att.isBot) dmg *= att.dmgScale;
  dmg = Math.round(dmg); if (dmg <= 0) return; let rem = dmg;
  if (t.shield > 0) { const s = Math.min(t.shield, rem); t.shield -= s; rem -= s; } t.hp -= rem; t.stats.taken += dmg; t.lastHitT = G.time; t.lastAttacker = att;
  if (att && att !== t) { att.stats.dealt += dmg; att.stats.hits++; if (att.isPlayer) { G.hook('hitmarker', head, t.hp <= 0, dmg); G.Audio.play(head ? 'headshot' : 'hit', 0.8); G.hook('dmgnum', t, dmg, head); } }
  if (t.isPlayer) { G.Audio.play('hurt'); if (att) G.hook('damaged', att, dmg); }
  else if (G.AI) G.AI.onHit(t, att);
  if (t.hp <= 0) G.killActor(t, att, wname || 'weapon');
};
G.killActor = function (a, killer, wname) {
  if (!a.alive) return; a.alive = false; a.hp = 0; a.shield = 0; a.action = null; a.state = 'dead'; a.deadT = 0; if (a.vehicle) G.exitVehicle(a, true);
  a.stats.placement = G.aliveCount() + 1; a.stats.timeAlive = G.time - a.stats.born;
  // drop loot
  for (let i = 1; i < 6; i++) { const s = a.inv[i]; if (s) G.dropAt(itemOf(s), a.x, a.y + 0.2, a.z); }
  for (const t in a.ammo) if (a.ammo[t] > 0) G.dropAt({ kind: 'ammo', t, n: a.ammo[t] }, a.x, a.y + 0.2, a.z);
  if (killer && killer !== a) { killer.kills++; if (killer.isPlayer) { G.Audio.play('kill'); } if (killer.isBot) { killer.stats.kills = killer.kills; if (G.AI) G.AI.onKill(killer); } }
  const entry = { killer: killer && killer !== a ? killer.name : null, victim: a.name, weapon: wname, you: killer && killer.isPlayer, died: a.isPlayer };
  G.hook('killfeed', entry); G.Audio.at('hurt', a.x, a.y, a.z, 0.8);
  G.hook('death', a, killer, wname);
  if (a.rig) a.rig.flash.visible = false;
};

/* ---------- shooting ---------- */
const HIT = { t: 0, actor: null, head: false, box: null, terrain: false, x: 0, y: 0, z: 0 };
function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const ex = cx - ox, ey = cy - oy, ez = cz - oz; const tca = ex * dx + ey * dy + ez * dz; if (tca < 0) return -1; const d2 = ex * ex + ey * ey + ez * ez - tca * tca; if (d2 > r * r) return -1; return tca - Math.sqrt(r * r - d2);
}
G.traceShot = function (shooter, ox, oy, oz, dx, dy, dz, range) {
  const r = W().raycast(ox, oy, oz, dx, dy, dz, range); let tb = r.t, box = r.box, terr = r.terrain; const hx = r.x, hy = r.y, hz = r.z;
  let bestT = tb, bestA = null, head = false;
  for (const a of G.actors) {
    if (a === shooter || !a.alive || a.state === 'bus') continue; const ddx = a.x - ox, ddz = a.z - oz; if (ddx * dx + ddz * dz < -2 || ddx * ddx + ddz * ddz > (range + 3) * (range + 3)) continue;
    const base = a.vehicle ? a.y + 0.4 : a.y; const th = raySphere(ox, oy, oz, dx, dy, dz, a.x, base + 1.7, a.z, 0.3);
    let tb2 = raySphere(ox, oy, oz, dx, dy, dz, a.x, base + 1.15, a.z, 0.5), tl = raySphere(ox, oy, oz, dx, dy, dz, a.x, base + 0.55, a.z, 0.45);
    let t = -1, hd = false; if (th >= 0) { t = th; hd = true; } if (tb2 >= 0 && (t < 0 || tb2 < t - 0.05)) { t = tb2; hd = false; } if (tl >= 0 && (t < 0 || tl < t - 0.05)) { t = tl; hd = false; }
    if (t >= 0 && t < bestT) { bestT = t; bestA = a; head = hd; }
  }
  HIT.t = bestT; HIT.actor = bestA; HIT.head = head; HIT.box = bestA ? null : box; HIT.terrain = bestA ? false : terr; HIT.x = ox + dx * bestT; HIT.y = oy + dy * bestT; HIT.z = oz + dz * bestT; HIT.any = !!(bestA || box || terr);
  return HIT;
};
G.muzzle = function (a, out) {
  const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
  out.x = a.x + fx * 0.6 + rx * 0.22; out.y = a.y + (a.vehicle ? 1.55 : 1.38); out.z = a.z + fz * 0.6 + rz * 0.22; return out;
};
const _mz = { x: 0, y: 0, z: 0 };
G.tryFire = function (a, tx, ty, tz) {
  const it = a.inv[a.sel]; if (!it || it.type !== 'weapon') return false; if (a.fireCD > 0 || a.reloading > 0 || a.action || a.state !== 'ground' || a.vehicle) return false;
  const Wp = G.WEAPONS[it.w], R = G.RARITY[it.rarity];
  if (it.mag <= 0) { a.fireCD = 0.3; if (a.ammo[Wp.ammo] > 0) G.startReload(a); else if (a.isPlayer) { G.Audio.play('empty'); G.hook('msg', 'Out of ' + G.AMMO[Wp.ammo].name.toLowerCase()); } return false; }
  it.mag--; a.fireCD = 1 / (Wp.rate * (1 + 0.025 * it.rarity)); a.stats.shots++; a.lastShotT = G.time;
  const m = G.muzzle(a, _mz); let dx = tx - m.x, dy = ty - m.y, dz = tz - m.z; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
  const mv = Math.min(1, a.speedNow / 7), spread = Wp.spread * (1 + a.bloom * 1.2) * (1 + mv * 0.9) * (a.input.ads ? 0.55 : 1) * (a.isBot ? (a.ai ? a.ai.spreadMul : 1) : 1);
  a.bloom = Math.min(1, a.bloom + 0.12); a.rig.flash.visible = true; a.flashT = 0.05; a.recoil = (a.recoil || 0) + (Wp.rocket ? 0.1 : it.w === 'sniper' ? 0.09 : it.w === 'shotgun' ? 0.07 : 0.018);
  G.Audio.at(Wp.rocket ? 'rocket' : it.w, a.x, a.y, a.z, a.isPlayer ? 0.9 : 1);
  // basis
  let ux = -dz, uy = 0, uz = dx; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul; const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
  if (Wp.rocket) { const s = G.rand(-1, 1) * spread, s2 = G.rand(-1, 1) * spread; dx += ux * s + vx * s2; dy += vy * s2; dz += uz * s + vz * s2; const l = Math.hypot(dx, dy, dz); G.projectiles.push({ x: m.x, y: m.y, z: m.z, vx: dx / l * 62, vy: dy / l * 62, vz: dz / l * 62, owner: a, dmg: Wp.dmg * R.mult, life: 6, mesh: G.makeRocketMesh() }); G.scene.add(G.projectiles[G.projectiles.length - 1].mesh); return true; }
  let hitAny = false;
  for (let p = 0; p < Wp.pellets; p++) {
    const ang = Math.random() * 6.283, rad = Math.sqrt(Math.random()) * spread; const s = Math.cos(ang) * rad, s2 = Math.sin(ang) * rad;
    let ex = dx + ux * s + vx * s2, ey = dy + vy * s2, ez = dz + uz * s + vz * s2; const l = Math.hypot(ex, ey, ez); ex /= l; ey /= l; ez /= l;
    const h = G.traceShot(a, m.x, m.y, m.z, ex, ey, ez, Wp.range);
    const px = h.x, py = h.y, pz = h.z; FXtrace(a, m, px, py, pz, it);
    if (h.actor) {
      let dmg = Wp.dmg * R.mult * (h.head ? Wp.hs : 1); const fall = Wp.pellets > 1 ? G.clamp(1.1 - (h.t - 5) / (Wp.range * 0.8), 0.15, 1) : G.clamp(1 - h.t / Wp.range * 0.3, 0.6, 1); dmg *= fall;
      FX.hit(px, py, pz, 0xff4d4d, 6); G.damageActor(h.actor, dmg, a, h.head, Wp.short); hitAny = true;
    } else if (h.box) { const b = h.box; FX.hit(px, py, pz, b.col || 0xdddddd, 4); if (b.destructible && b.kind !== 'tree' && b.kind !== 'rock') G.damageBox(b, Wp.dmg * R.mult * (Wp.pellets > 1 ? 1 : 1.2), a); }
    else if (h.terrain) FX.hit(px, py, pz, 0xb7a06a, 4);
  }
  return true;
};
function FXtrace(a, m, px, py, pz, it) { FX.tracer(m.x, m.y - 0.05, m.z, px, py, pz, it.w === 'sniper' ? 0x9ad8ff : 0xfff2a8); }
G.makeRocketMesh = function () { const g = new T.Group(); const c = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.7, 8), G.mat(0xff8a2a)); c.rotation.x = Math.PI / 2; g.add(c); const t = new T.Mesh(new T.ConeGeometry(0.1, 0.25, 8), G.mat(0xff4d4d)); t.rotation.x = -Math.PI / 2; t.position.z = -0.47; g.add(t); const f = new T.Mesh(new T.SphereGeometry(0.16, 6, 5), new T.MeshBasicMaterial({ color: 0xffa83a })); f.position.z = 0.45; g.add(f); return g; };
G.damageBox = function (b, dmg, att) {
  if (b.dead) return; if (b.piece) { G.damagePiece(b.piece, dmg); return; } if (!b.destructible) return; b.hp -= dmg;
  if (b.hp <= 0) { G.Audio.at('break', (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); FX.debris((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2, b.col || 0xcccccc, 12); G.World.destroyBox(b); }
};
G.explode = function (x, y, z, R, dmg, owner, wname) {
  FX.explosion(x, y, z, R); G.Audio.at('explosion', x, y, z); const dx = G.cam ? G.cam.position.x - x : 99, dz = G.cam ? G.cam.position.z - z : 99; if (dx * dx + dz * dz < 2500) FX.shake = Math.max(FX.shake, 0.8);
  for (const a of G.actors) { if (!a.alive || a.state === 'bus') continue; const d = Math.hypot(a.x - x, a.y + 1 - y, a.z - z); if (d < R + 0.6) { let k = 1 - d / (R * 1.15); let dd = dmg * k * (a === owner ? 0.5 : 1); if (dd > 1) G.damageActor(a, dd, owner, false, wname || 'Rocket'); a.vy += 6 * k; a.vx += (a.x - x) / (d + 0.5) * 6 * k; a.vz += (a.z - z) / (d + 0.5) * 6 * k; } }
  const list = []; G.World.forBoxes(x - R, z - R, x + R, z + R, b => { if (b.destructible || b.piece) list.push(b); });
  for (const b of list) { const px = G.clamp(x, b.x0, b.x1), py = G.clamp(y, b.y0, b.y1), pz = G.clamp(z, b.z0, b.z1); const d = Math.hypot(px - x, py - y, pz - z); if (d < R) G.damageBox(b, 420 * (1 - d / R * 0.6), owner); }
};
G.updateProjectiles = function (dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i]; p.life -= dt; p.vy -= 3 * dt; const sp = Math.hypot(p.vx, p.vy, p.vz), step = sp * dt; const dx = p.vx / sp, dy = p.vy / sp, dz = p.vz / sp; let boom = p.life <= 0;
    const r = G.World.raycast(p.x, p.y, p.z, dx, dy, dz, step + 0.3); let hx = p.x + p.vx * dt, hy = p.y + p.vy * dt, hz = p.z + p.vz * dt;
    if (r.hit && r.t <= step + 0.3) { hx = r.x; hy = r.y; hz = r.z; boom = true; }
    else for (const a of G.actors) { if (a === p.owner || !a.alive || a.state === 'bus') continue; if (Math.hypot(a.x - hx, a.y + 1 - hy, a.z - hz) < 1.0) { boom = true; break; } }
    p.x = hx; p.y = hy; p.z = hz; p.mesh.position.set(hx, hy, hz); p.mesh.lookAt(hx + dx, hy + dy, hz + dz); FX.spawn(hx, hy, hz, 0, 0.5, 0, Math.random() < 0.5 ? 0xffa83a : 0xcccccc, 0.3, 0.5, -1);
    if (boom) { G.explode(hx - dx * 0.3, hy - dy * 0.3, hz - dz * 0.3, 6.5, p.dmg, p.owner); G.scene.remove(p.mesh); G.projectiles.splice(i, 1); } else { p.vx = dx * sp; p.vy = p.vy; p.vz = dz * sp; }
  }
};

/* ---------- harvesting ---------- */
G.startSwing = function (a) { if (a.swing > 0 || a.action) return false; a.swing = 0.01; a.swingHit = false; return true; };
G.harvest = function (a, ox, oy, oz, dx, dy, dz) {
  // melee actors first
  for (const t of G.actors) { if (t === a || !t.alive || t.state === 'bus') continue; const ex = t.x - ox, ez = t.z - oz, ey = t.y + 1 - oy; const d = Math.hypot(ex, ey, ez); if (d < 3.2 && (ex * dx + ey * dy + ez * dz) / d > 0.6) { G.damageActor(t, 20, a, false, 'Pickaxe'); G.Audio.at('hit', a.x, a.y, a.z); return; } }
  const r = G.World.raycast(ox, oy, oz, dx, dy, dz, 4.6);
  if (!r.hit) return; if (r.terrain && !r.box) { FX.burst(r.x, r.y, r.z, 0x9a8a5a, 4, 3, 0.12, 0.4, 10); G.Audio.at('harvest', r.x, r.y, r.z, 0.4); return; }
  const b = r.box; let mat = b.mat, amt = 0;
  if (b.kind === 'tree') { b.hp -= 1; amt = 17; mat = 'wood'; FX.burst(r.x, r.y, r.z, 0x6fd24a, 5, 4, 0.2, 0.6, 8); FX.burst(r.x, r.y, r.z, 0x8a5a33, 3, 3, 0.15, 0.5, 10); if (b.hp <= 0) { FX.burst(b.tree.x, b.tree.y + 4, b.tree.z, 0x58c43f, 14, 8, 0.3, 0.9, 6); G.World.destroyBox(b); } }
  else if (b.kind === 'rock') { b.hp -= 1; amt = 15; mat = 'stone'; FX.burst(r.x, r.y, r.z, 0xaaaaaa, 6, 5, 0.18, 0.5, 10); if (b.hp <= 0) { FX.debris(r.x, r.y, r.z, 0x9ea2ad, 14); G.World.destroyBox(b); } }
  else if (b.destructible || b.piece) { amt = 10; FX.burst(r.x, r.y, r.z, b.col || 0xd9a05b, 5, 4, 0.18, 0.5, 10); G.damageBox(b, 22, a); }
  else { FX.burst(r.x, r.y, r.z, 0xcccccc, 3, 3, 0.1, 0.3, 10); G.Audio.at('harvest', r.x, r.y, r.z, 0.4); return; }
  if (amt && mat) { a.mats[mat] = Math.min(999, a.mats[mat] + amt); a.stats.harvested += amt; if (a.isPlayer) G.hook('harvest', mat, amt); }
  G.Audio.at('harvest', r.x, r.y, r.z);
};

/* ================= Build system ================= */
const wallParts = (edit) => { // local (u0,u1,v0,v1) along wall -2..2, v relative to lv
  const F = FH, Lo = -0.5;
  if (edit === 1) return [[-2, -0.85, Lo, F], [0.85, 2, Lo, F], [-0.85, 0.85, 2.45, F]];
  if (edit === 2) return [[-2, -0.8, Lo, F], [0.8, 2, Lo, F], [-0.8, 0.8, Lo, 1.0], [-0.8, 0.8, 2.2, F]];
  return [[-2, 2, Lo, F]];
};
const Build = G.Build = {
  dirs: [[1, 0], [0, 1], [-1, 0], [0, -1]],
  baseLevel(a) {
    let best = null, bd = 0.75; const cy = a.y - (a.onGround && G.World.support ? 0.12 : 0);
    for (const p of G.pieceList) { if (Math.abs(p.cx - a.x) > 10 || Math.abs(p.cz - a.z) > 10) continue; for (const lv of [p.lv, p.lv + FH]) { const d = Math.abs(lv - cy); if (d < bd) { bd = d; best = lv; } } }
    return best !== null ? best : Math.round(a.y * 5) / 5;
  },
  spec(a, type) {
    const f0 = -Math.sin(a.yaw), f1 = -Math.cos(a.yaw); const ang = Math.atan2(f1, f0); const d = ((Math.round(ang / (Math.PI / 2)) % 4) + 4) % 4; const dd = Build.dirs[d];
    const pcx = Math.floor(a.x / S), pcz = Math.floor(a.z / S); let lv = Build.baseLevel(a); const sp = { type, d, lv };
    if (type === 'wall') { sp.o = d % 2 === 1 ? 0 : 1; sp.gx = pcx + (d === 0 ? 1 : 0); sp.gz = pcz + (d === 1 ? 1 : 0); }
    else if (type === 'floor') { const down = a.pitch < -0.55; sp.gx = pcx + (down ? 0 : dd[0]); sp.gz = pcz + (down ? 0 : dd[1]); }
    else if (type === 'ramp') { sp.gx = pcx + dd[0]; sp.gz = pcz + dd[1]; }
    else if (type === 'roof') { sp.type = 'floor'; sp.gx = pcx; sp.gz = pcz; sp.lv = lv + FH; sp.isRoof = true; }
    sp.key = sp.type === 'wall' ? 'w' + sp.o + ':' + sp.gx + ':' + sp.gz + ':' + Math.round(sp.lv * 5) : (sp.type === 'ramp' ? 'r' : 'f') + ':' + sp.gx + ':' + sp.gz + ':' + Math.round(sp.lv * 5);
    sp.cx = sp.type === 'wall' ? (sp.o === 0 ? (sp.gx + 0.5) * S : sp.gx * S) : (sp.gx + 0.5) * S; sp.cz = sp.type === 'wall' ? (sp.o === 0 ? sp.gz * S : (sp.gz + 0.5) * S) : (sp.gz + 0.5) * S;
    return sp;
  },
  canPlace(a, sp) { if (G.pieces.has(sp.key)) return false; if (a.mats[a.buildMat] < G.MATS[a.buildMat].cost) return false; if (G.World.heightAt(sp.cx, sp.cz) < -3 && sp.lv < 0) return false; return true; },
  place(a, sp) {
    if (!Build.canPlace(a, sp)) return null; const mat = a.buildMat; a.mats[mat] -= G.MATS[mat].cost; a.stats.built++;
    const p = { key: sp.key, type: sp.type, o: sp.o, gx: sp.gx, gz: sp.gz, lv: sp.lv, d: sp.d, mat, hp: G.MATS[mat].hp, max: G.MATS[mat].hp, cx: sp.cx, cz: sp.cz, edit: 0, boxes: [], meshes: [], owner: a, dead: false };
    G.pieces.set(p.key, p); G.pieceList.push(p); Build.build(p); G.Audio.at('build', p.cx, p.lv, p.cz); FX.burst(p.cx, p.lv + 1.5, p.cz, G.MATS[mat].color, 8, 5, 0.2, 0.5, 6); return p;
  },
  clear(p) { for (const b of p.boxes) if (!b.dead) G.World.removeBox(b); p.boxes.length = 0; for (const m of p.meshes) { G.scene.remove(m); } p.meshes.length = 0; },
  build(p) {
    const M = G.MATS[p.mat], mt = G.buildMats[p.mat], hp = p.hp; Build.clear(p);
    const mk = (x0, y0, z0, x1, y1, z1, kind, extra) => { const b = G.World.addBox(Object.assign({ x0, x1, y0, y1, z0, z1, kind, mat: p.mat, hp: 1e9, destructible: true, piece: p, col: M.color }, extra || {})); p.boxes.push(b); return b; };
    if (p.type === 'wall') {
      for (const pt of wallParts(p.edit)) {
        const w = pt[1] - pt[0], h = pt[3] - pt[2]; const g = new T.BoxGeometry(w, h, 0.3); const m = new T.Mesh(g, mt); m.castShadow = true; m.receiveShadow = true;
        const uc = (pt[0] + pt[1]) / 2, vc = p.lv + (pt[2] + pt[3]) / 2; if (p.o === 0) { m.position.set(p.cx + uc, vc, p.cz); } else { m.position.set(p.cx, vc, p.cz + uc); m.rotation.y = Math.PI / 2; }
        G.scene.add(m); p.meshes.push(m);
        if (p.o === 0) mk(p.cx + pt[0], p.lv + pt[2], p.cz - 0.15, p.cx + pt[1], p.lv + pt[3], p.cz + 0.15, 'wall'); else mk(p.cx - 0.15, p.lv + pt[2], p.cz + pt[0], p.cx + 0.15, p.lv + pt[3], p.cz + pt[1], 'wall');
      }
    } else if (p.type === 'floor') {
      const m = new T.Mesh(G.geo.floor, mt); m.position.set(p.cx, p.lv, p.cz); m.castShadow = m.receiveShadow = true; G.scene.add(m); p.meshes.push(m);
      mk(p.cx - S / 2, p.lv - 0.33, p.cz - S / 2, p.cx + S / 2, p.lv + 0.12, p.cz + S / 2, 'floor');
    } else {
      const m = new T.Mesh(G.geo.ramp[p.d], mt); m.position.set(p.cx, p.lv, p.cz); m.castShadow = m.receiveShadow = true; G.scene.add(m); p.meshes.push(m);
      mk(p.cx - S / 2, p.lv + 0.12, p.cz - S / 2, p.cx + S / 2, p.lv + FH + 0.12, p.cz + S / 2, 'ramp', { ramp: p.d });
    }
  },
  destroy(p) {
    if (p.dead) return; p.dead = true; G.pieces.delete(p.key); const i = G.pieceList.indexOf(p); if (i >= 0) G.pieceList.splice(i, 1);
    FX.debris(p.cx, p.lv + 1.5, p.cz, G.MATS[p.mat].color, 14); G.Audio.at('break', p.cx, p.lv, p.cz); Build.clear(p);
  },
  edit(a, ox, oy, oz, dx, dy, dz) {
    const r = G.World.raycast(ox, oy, oz, dx, dy, dz, 9); if (!r.box || !r.box.piece) return false; const p = r.box.piece; if (p.type !== 'wall') { G.hook('msg', 'Only walls can be edited'); return false; }
    p.edit = (p.edit + 1) % 3; Build.build(p); G.Audio.at('build', p.cx, p.lv, p.cz); G.hook('msg', ['Solid wall', 'Doorway', 'Window'][p.edit]); return true;
  }
};
G.damagePiece = function (p, dmg) { if (p.dead) return; p.hp -= dmg; FX.burst(p.cx, p.lv + 1.5, p.cz, G.MATS[p.mat].color, 2, 3, 0.15, 0.4, 10); if (p.hp <= 0) Build.destroy(p); };

/* ================= Vehicles ================= */
G.spawnVehicles = function () {
  const cols = [0xff5a3a, 0x3fa0ff, 0xffd83a, 0x5ad65a, 0xb45cff, 0x2ec4b6];
  G.World.vehicleSpawns.slice(0, 12).forEach((s, i) => { const m = G.makeCar(cols[i % cols.length]); const v = { x: s.x, z: s.z, y: G.World.heightAt(s.x, s.z), yaw: s.yaw, speed: 0, vy: 0, mesh: m, driver: null, pitch: 0, roll: 0 }; m.position.set(v.x, v.y, v.z); m.rotation.y = v.yaw; G.scene.add(m); G.vehicles.push(v); });
};
G.enterVehicle = function (a, v) { if (v.driver || !a.alive) return; v.driver = a; a.vehicle = v; a.state = 'ground'; a.action = null; a.buildMode = false; a.sel = 0; G.updateHeld(a); if (a.isPlayer) { G.Audio.engineStart(); G.hook('msg', 'Driving — WASD, SHIFT boost, E to exit'); } };
G.exitVehicle = function (a, silent) {
  const v = a.vehicle; if (!v) return; v.driver = null; a.vehicle = null; const sx = Math.cos(v.yaw), sz = -Math.sin(v.yaw);
  a.x = v.x + sx * 2.2; a.z = v.z + sz * 2.2; a.y = G.World.groundY(a.x, a.z, v.y + 1, 1.5); a.vx = a.vy = a.vz = 0; if (a.isPlayer) G.Audio.engineStop();
};
const VT = { x: 0, z: 0 };
function updateVehicle(v, dt) {
  const d = v.driver; let thr = 0, steer = 0, boost = false;
  if (d && d.isPlayer) { thr = d.input.f; steer = -d.input.s; boost = d.input.sprint; }
  const maxS = (boost ? 36 : 26) * (v.water ? 0.35 : 1);
  if (thr > 0) v.speed += (maxS - v.speed) * Math.min(1, dt * 0.9); else if (thr < 0) v.speed += (-10 - v.speed) * Math.min(1, dt * 1.5); else v.speed *= (1 - Math.min(1, dt * 0.6));
  if (!d) v.speed *= (1 - Math.min(1, dt * 2));
  v.yaw += steer * dt * 1.7 * G.clamp(Math.abs(v.speed) / 8, 0, 1) * (v.speed >= 0 ? 1 : -1);
  const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
  let nx = v.x + fx * v.speed * dt, nz = v.z + fz * v.speed * dt;
  const o = G.World.resolveXZ(nx, nz, v.y, 1.5, 1.4);
  if (o.hit) { if (Math.abs(v.speed) > 9) { G.Audio.at('crash', v.x, v.y, v.z); FX.burst(v.x + fx * 2, v.y + 1, v.z + fz * 2, 0xffd83a, 8, 6, 0.2, 0.5, 10); if (v.driver && v.driver.isPlayer) FX.shake = 0.5; } v.speed *= -0.25; nx = o.x; nz = o.z; }
  // slope block: terrain too steep
  const g1 = G.World.groundY(nx, nz, v.y, 1.0);
  if (g1 - v.y > 0.9 + Math.abs(v.speed) * dt * 0.8) { v.speed *= -0.2; nx = v.x; nz = v.z; }
  v.x = nx; v.z = nz;
  const gy = G.World.groundY(v.x, v.z, v.y, 1.0); v.vy -= 28 * dt; v.y += v.vy * dt; if (v.y <= gy) { v.y = gy; v.vy = 0; }
  v.water = gy < G.WATER_Y - 0.2;
  const hf = G.World.heightAt(v.x + fx * 1.8, v.z + fz * 1.8), hb = G.World.heightAt(v.x - fx * 1.8, v.z - fz * 1.8); v.pitch += ((Math.atan2(hf - hb, 3.6)) - v.pitch) * Math.min(1, dt * 8);
  v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.set(0, v.yaw, 0); v.mesh.rotateX(v.pitch); for (const w of v.mesh.userData.wheels) w.children[0].rotation.x -= v.speed * dt / 0.55;
  // run over
  if (Math.abs(v.speed) > 8) for (const a of G.actors) { if (a === v.driver || !a.alive || a.state !== 'ground' || a.vehicle) continue; if (Math.hypot(a.x - v.x, a.z - v.z) < 2.0 && Math.abs(a.y - v.y) < 2) { G.damageActor(a, Math.min(90, Math.abs(v.speed) * 3.2), v.driver, false, 'Buggy'); a.vx += fx * 8; a.vz += fz * 8; a.vy = 5; } }
  if (d) { d.x = v.x - fx * 0.2 + Math.cos(v.yaw) * -0.45 * 0; d.z = v.z - fz * 0.2; d.y = v.y + 0.55; d.yaw = v.yaw; d.vx = fx * v.speed; d.vz = fz * v.speed; d.speedNow = Math.abs(v.speed); if (d.isPlayer) G.Audio.engineSet(Math.abs(v.speed)); }
}

/* ================= Per-frame actor update ================= */
const WALK = 5.6, SPRINT = 8.2;
function groundMove(a, dt) {
  const inp = a.input; let spd = inp.sprint ? SPRINT : WALK; if (a.inWater) spd *= 0.55; if (inp.ads) spd *= 0.65; if (a.action && a.action.type === 'heal') spd *= 0.8; if (a.emote) spd = 0;
  let f = a.emote ? 0 : inp.f, s = a.emote ? 0 : inp.s; const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; }
  const sy = Math.sin(a.yaw), cy = Math.cos(a.yaw); const wx = (-sy * f + cy * s) * spd, wz = (-cy * f - sy * s) * spd;
  const k = Math.min(1, dt * (a.onGround ? 14 : 3)); a.vx += (wx - a.vx) * k; a.vz += (wz - a.vz) * k;
  const Wd = G.World;
  // slope-limited axis moves
  for (let ax = 0; ax < 2; ax++) {
    const d = (ax === 0 ? a.vx : a.vz) * dt; if (d === 0) continue; const nx = a.x + (ax === 0 ? d : 0), nz = a.z + (ax === 1 ? d : 0);
    if (a.onGround) { const g = Wd.groundY(nx, nz, a.y, 0.6); if (!Wd.support && g - a.y > 1.25 * Math.abs(d) + 0.06) continue; }
    a.x = nx; a.z = nz;
  }
  const o = Wd.resolveXZ(a.x, a.z, a.y, 0.38, 1.8); a.x = o.x; a.z = o.z;
  const r2 = Math.hypot(a.x, a.z); if (r2 > 470) { a.x *= 470 / r2; a.z *= 470 / r2; }
  if (inp.jump && a.onGround && !a.emote) { a.vy = 8.4; a.onGround = false; inp.jump = false; G.Audio.at('jump', a.x, a.y, a.z, 0.4); } inp.jump = false;
  a.vy -= 24 * dt; const ny = a.y + a.vy * dt;
  if (a.vy > 0) { const c = Wd.ceilingAt(a.x, a.z, a.y + 1.8); if (c < ny + 1.8) { a.vy = 0; } else a.y = ny; if (a.vy !== 0) a.onGround = false; }
  else {
    const g = Wd.groundY(a.x, a.z, a.y, 0.6);
    if (ny <= g || (a.onGround && a.y - g < 0.5 && ny - g < 0.5)) {
      if (!a.onGround && a.vy < -22) { const dmg = Math.round((-a.vy - 22) * 3.2); if (dmg > 0) G.damageActor(a, dmg, null, false, 'Fall'); }
      if (!a.onGround && a.vy < -6) { if (g < G.WATER_Y) { G.Audio.at('splash', a.x, a.y, a.z); FX.burst(a.x, g, a.z, 0x9fe0ff, 8, 5, 0.2, 0.5, 8); } }
      a.y = g; a.vy = 0; a.onGround = true;
    } else { a.y = ny; a.onGround = false; }
  }
  a.inWater = a.onGround && !Wd.support && Wd.heightAt(a.x, a.z) < G.WATER_Y - 0.1;
  a.speedNow = Math.hypot(a.vx, a.vz);
  // footsteps
  if (a.onGround && a.speedNow > 2.5) { a.stepT -= dt * (a.speedNow / 5.6); if (a.stepT <= 0) { a.stepT = 0.42; if (a.inWater) G.Audio.at('splash', a.x, a.y, a.z, 0.4); else G.Audio.at(Wd.support ? 'stepb' : a.y < 3.2 ? 'steps' : 'step', a.x, a.y, a.z, a.isPlayer ? 0.8 : 0.6); } }
  if (a.y < -30) G.killActor(a, null, 'Fall');
}
G.updateActor = function (a, dt) {
  const r = a.rig;
  if (!a.alive) { a.deadT += dt; animate(a, dt); if (a.deadT > 8) r.root.visible = false; return; }
  a.fireCD -= dt; a.bloom = Math.max(0, a.bloom - dt * 1.4); if (a.flashT > 0) { a.flashT -= dt; if (a.flashT <= 0) r.flash.visible = false; } a.recoil = (a.recoil || 0) * Math.max(0, 1 - dt * 12);
  if (a.emote) { a.emote.t += dt; if (a.emote.t > a.emote.dur) a.emote = null; }
  const px = a.x, pz = a.z;
  if (a.state === 'bus') { r.root.visible = false; return; }
  if (a.state === 'freefall' || a.state === 'glide') {
    const inp = a.input; const gl = a.state === 'glide'; const fwd = Math.max(0, inp.f); const maxH = gl ? 17 : 22, minH = gl ? 6 : 8;
    const hs = minH + (maxH - minH) * fwd; const tvx = -Math.sin(a.yaw) * hs + Math.cos(a.yaw) * inp.s * 5 * (gl ? 1 : 0.6), tvz = -Math.cos(a.yaw) * hs - Math.sin(a.yaw) * inp.s * 5 * (gl ? 1 : 0.6);
    a.vx += (tvx - a.vx) * Math.min(1, dt * 2.5); a.vz += (tvz - a.vz) * Math.min(1, dt * 2.5);
    const tvy = gl ? -9 : (inp.f > 0 ? -58 : -48) + (inp.f < 0 ? 12 : 0); a.vy += (tvy - a.vy) * Math.min(1, dt * (gl ? 2.5 : 1.2));
    a.x += a.vx * dt; a.z += a.vz * dt; a.y += a.vy * dt; const r2 = Math.hypot(a.x, a.z); if (r2 > 520) { a.x *= 520 / r2; a.z *= 520 / r2; }
    const g = G.World.groundY(a.x, a.z, a.y, 0.6); a.onGround = false; a.speedNow = Math.hypot(a.vx, a.vz);
    if (a.y <= g + 0.05) { a.y = g; a.state = 'ground'; a.vy = 0; a.glideOpen = false; a.autoGlide = false; r.glider.visible = false; r.lean.rotation.x = 0; a.vx *= 0.3; a.vz *= 0.3; G.Audio.at('step', a.x, a.y, a.z, 1); a.onGround = true; G.hook('landed', a); }
    else if (a.state === 'freefall' && (a.openNow || (a.isBot && a.y - g < a.openAlt)) && a.y - g > 6) { openGlider(a); }
    else if (a.state === 'freefall' && a.y - g < 70 && a.isPlayer) openGlider(a);
    a.stats.dist += Math.hypot(a.x - px, a.z - pz); animate(a, dt); return;
  }
  if (a.vehicle) { animate(a, dt); return; }
  // ground
  if (a.autoGlide && !a.onGround && a.vy < -2) { const gg = G.World.groundY(a.x, a.z, a.y, 0.6); if (a.y - gg > 4) { a.autoGlide = false; openGlider(a); animate(a, dt); return; } }
  if (a.autoGlide && a.onGround && a.vy <= 0 && G.time - (a.launchedAt || 0) > 0.3) a.autoGlide = false;
  if (a.reloading > 0) { a.reloading -= dt; if (a.reloading <= 0) { const it = a.inv[a.sel]; if (it && it.type === 'weapon') { const Wp = G.WEAPONS[it.w]; const need = Wp.mag - it.mag, take = Math.min(need, a.ammo[Wp.ammo]); it.mag += take; a.ammo[Wp.ammo] -= take; } } }
  if (a.action) {
    const ac = a.action; const h = G.HEALS[ac.id]; ac.t += dt; const k = Math.min(1, ac.t / ac.dur);
    if (h.hp) a.hp = Math.min(Math.max(a.hp, (h.cap || 100) <= a.hp ? a.hp : 0), a.hp); // no-op guard
    if (h.hp) { const tgt = Math.min(h.cap || 100, ac.hp0 + h.hp); if (tgt > a.hp) a.hp = Math.min(tgt, Math.max(a.hp, ac.hp0 + (tgt - ac.hp0) * k)); }
    if (h.sh) { const tgt = Math.min(h.shcap || 100, ac.sh0 + h.sh); if (tgt > a.shield) a.shield = Math.min(tgt, Math.max(a.shield, ac.sh0 + (tgt - ac.sh0) * k)); }
    if (ac.t >= ac.dur) { const s = a.inv[ac.slot]; if (s && s.type === 'heal') { s.n--; if (s.n <= 0) { a.inv[ac.slot] = null; if (a.sel === ac.slot) { a.sel = 0; G.updateHeld(a); } } } a.action = null; if (a.isPlayer) G.hook('msg', h.name + ' used'); }
  }
  if (a.swing > 0) { a.swing += dt; if (!a.swingHit && a.swing > 0.2) { a.swingHit = true; const fx = -Math.sin(a.yaw) * Math.cos(a.pitch), fy = Math.sin(a.pitch), fz = -Math.cos(a.yaw) * Math.cos(a.pitch); G.harvest(a, a.x, a.y + 1.4, a.z, fx, fy, fz); } if (a.swing > 0.5) a.swing = 0; }
  a.placeCD -= dt; if (a.hp < 0) a.hp = 0;
  groundMove(a, dt); a.stats.dist += Math.hypot(a.x - px, a.z - pz); animate(a, dt);
};
function openGlider(a) { a.state = 'glide'; a.glideOpen = true; a.rig.glider.visible = true; a.rig.lean.rotation.x = -0.05; if (a.isPlayer) G.Audio.play('glide'); else G.Audio.at('glide', a.x, a.y, a.z, 0.5); }
G.openGlider = openGlider;
G.jumpFromBus = function (a, bus) {
  a.state = "freefall"; a.jumpedAt = G.time; a.x = bus.x; a.y = bus.y - 3; a.z = bus.z; a.vx = bus.vx * 0.7; a.vz = bus.vz * 0.7; a.vy = -2; a.yaw = a.isPlayer ? a.yaw : a.yaw; a.rig.root.visible = true; a.rig.setLOD(2); G.Audio.at('jump', a.x, a.y, a.z, 0.6);
};
G.startEmote = function (a, name) { if (!a.alive || a.state !== 'ground' || a.vehicle) return; a.emote = { name, t: 0, dur: name === 'wave' ? 2.4 : 3.6 }; a.reloading = 0; G.Audio.at('emote', a.x, a.y, a.z, 0.8); };

/* ---------- rig animation ---------- */
function animateBase(a, dt) {
  const r = a.rig; r.root.position.set(a.x, a.y, a.z); r.root.rotation.set(0, a.yaw, 0);
  const L = r.legs, A = r.arms; r.lean.rotation.set(0, 0, 0); r.m.position.y = -1; L[0].rotation.set(0, 0, 0); L[1].rotation.set(0, 0, 0); A[0].rotation.set(0, 0, 0); A[1].rotation.set(0, 0, 0); r.head.rotation.set(0, 0, 0);
  if (!a.alive) { const k = Math.min(1, a.deadT / 0.4); r.lean.rotation.x = k * 1.55; r.lean.position.y = 1 - k * 0.5; r.root.rotation.y = a.yaw; return; }
  r.lean.position.y = 1;
  if (a.state === 'freefall') { r.lean.rotation.x = -1.3; A[0].rotation.set(2.6, 0, 0.7); A[1].rotation.set(2.6, 0, -0.7); L[0].rotation.x = -0.4; L[1].rotation.x = -0.2; return; }
  if (a.state === 'glide') { r.lean.rotation.x = -0.08; A[0].rotation.set(2.9, 0, 0.1); A[1].rotation.set(2.9, 0, -0.1); L[0].rotation.x = 0.35; L[1].rotation.x = -0.1; r.glider.rotation.z = -a.input.s * 0.15; return; }
  if (a.vehicle) { L[0].rotation.x = L[1].rotation.x = 1.35; A[0].rotation.x = A[1].rotation.x = 1.2; r.m.position.y = -1.2; return; }
  const sp = a.speedNow; a.walkPhase += dt * sp * 1.9; const sw = Math.sin(a.walkPhase) * Math.min(1, sp / 4) * 0.9;
  L[0].rotation.x = sw; L[1].rotation.x = -sw; r.m.position.y = -1 + Math.abs(Math.cos(a.walkPhase)) * 0.04 * Math.min(1, sp / 4);
  const it = a.inv[a.sel]; r.gun.rotation.x = a.pitch * 0.9 + (a.recoil || 0);
  if (a.emote) {
    const t = a.emote.t, nm = a.emote.name;
    if (nm === 'dance') { r.m.position.y = -1 + Math.abs(Math.sin(t * 9)) * 0.18; A[0].rotation.set(2.8 + Math.sin(t * 9) * 0.7, 0, 0.5); A[1].rotation.set(2.8 - Math.sin(t * 9) * 0.7, 0, -0.5); L[0].rotation.x = Math.sin(t * 9) * 0.7; L[1].rotation.x = -Math.sin(t * 9) * 0.7; r.lean.rotation.y = Math.sin(t * 4.5) * 0.8; }
    else if (nm === 'wave') { A[1].rotation.set(0, 0, -2.7 + Math.sin(t * 12) * 0.35); A[0].rotation.x = 0.1; }
    else if (nm === 'flex') { A[0].rotation.set(0.2, 0, 2.2 + Math.sin(t * 6) * 0.1); A[1].rotation.set(0.2, 0, -2.2 - Math.sin(t * 6) * 0.1); r.m.position.y = -1 + Math.abs(Math.sin(t * 6)) * 0.05; r.head.rotation.z = Math.sin(t * 3) * 0.15; }
    else { r.lean.rotation.y = t * 9; A[0].rotation.set(2.2, 0, 0.9); A[1].rotation.set(2.2, 0, -0.9); r.m.position.y = -1 + Math.max(0, Math.sin(t * 5)) * 0.35; }
    if (r.held) r.held.visible = false; if (r.pick) r.pick.visible = false; return;
  }
  if (r.held) r.held.visible = true;
  if (a.buildMode) { A[0].rotation.set(1.2, 0, 0.1); A[1].rotation.set(1.2, 0, -0.1); return; }
  if (it && (it.type === 'weapon' || it.type === 'gadget')) { const up = 1.45 + a.pitch * 0.8; A[1].rotation.set(up, 0, -0.12); A[0].rotation.set(up + 0.08, 0, 0.45); }
  else if (it && it.type === 'pickaxe') { const k = a.swing > 0 ? Math.min(1, a.swing / 0.35) : 0; A[1].rotation.x = a.swing > 0 ? (k < 0.4 ? 2.9 - k * 1.0 : 2.5 - (k - 0.4) / 0.6 * 1.9) : 0.35 - sw * 0.5; A[0].rotation.x = -sw * 0.8; r.pick.visible = true; }
  else if (a.action) { A[0].rotation.set(2.0, 0, 0.5); A[1].rotation.set(2.0 + Math.sin(a.action.t * 8) * 0.15, 0, -0.5); }
  else { A[0].rotation.x = -sw * 0.8; A[1].rotation.x = sw * 0.8; }
}
/* v2: elbow / knee articulation + head look on top of the base pose */
function animateProc(a, dt) {
  animateBase(a, dt); const r = a.rig; if (!r.knees) return; const K = r.knees, E = r.elbows, A = r.arms;
  K[0].rotation.x = K[1].rotation.x = E[0].rotation.x = E[1].rotation.x = 0;
  if (!a.alive) { E[0].rotation.x = E[1].rotation.x = 0.5; K[0].rotation.x = K[1].rotation.x = -0.4; return; }
  const st = a.state;
  if (st === 'freefall') { K[0].rotation.x = -0.9; K[1].rotation.x = -0.5; E[0].rotation.x = E[1].rotation.x = 0.35; return; }
  if (st === 'glide') { K[0].rotation.x = -0.7; K[1].rotation.x = -0.2; E[0].rotation.x = E[1].rotation.x = 0.15; return; }
  if (a.vehicle) { K[0].rotation.x = K[1].rotation.x = -1.35; E[0].rotation.x = E[1].rotation.x = 0.35; return; }
  const sp = a.speedNow || 0, amp = Math.min(1, sp / 4), p = a.walkPhase;
  if (!a.onGround) { K[0].rotation.x = -0.9; K[1].rotation.x = -0.5; E[0].rotation.x = E[1].rotation.x = 0.5; }
  else { K[0].rotation.x = -0.95 * amp * Math.max(0, Math.cos(p)); K[1].rotation.x = -0.95 * amp * Math.max(0, -Math.cos(p)); if (a.crouch) { K[0].rotation.x -= 0.5; K[1].rotation.x -= 0.5; }
    const sw = Math.sin(p) * amp; E[0].rotation.x = 0.18 + 0.5 * amp * Math.max(0, sw); E[1].rotation.x = 0.18 + 0.5 * amp * Math.max(0, -sw); }
  const it = a.inv && a.inv[a.sel];
  if (a.emote) { const t = a.emote.t, nm = a.emote.name; if (nm === 'wave') E[1].rotation.x = 0.4 + Math.sin(t * 12) * 0.5; else if (nm === 'dance') { E[0].rotation.x = 1.0 + Math.sin(t * 9) * 0.6; E[1].rotation.x = 1.0 - Math.sin(t * 9) * 0.6; K[0].rotation.x = -Math.abs(Math.sin(t * 9)) * 0.7; K[1].rotation.x = -Math.abs(Math.cos(t * 9)) * 0.7; } else if (nm === 'flex') { E[0].rotation.x = E[1].rotation.x = 1.6; } else { E[0].rotation.x = E[1].rotation.x = 0.9; } return; }
  if (a.buildMode) { E[0].rotation.x = E[1].rotation.x = 0.7; r.head.rotation.x = a.pitch * 0.4; return; }
  if (it && (it.type === 'weapon' || it.type === 'gadget')) { E[1].rotation.x = 0.8 - (a.recoil || 0) * 3; E[0].rotation.x = 0.12; }
  else if (it && it.type === 'pickaxe') { const k = a.swing > 0 ? Math.min(1, a.swing / 0.35) : 0; E[1].rotation.x = a.swing > 0 ? (k < 0.4 ? 1.1 : 0.1) : 0.35; }
  else if (a.action) { E[0].rotation.x = 1.3; E[1].rotation.x = 1.3; }
  r.head.rotation.x = G.clamp((a.pitch || 0) * 0.5, -0.5, 0.5);
}
function animate(a, dt) { animateProc(a, dt); if (G.Clips && G.Clips.ready) G.Clips.apply(a, dt); }
G.animateRig = animate;

/* ================= update all ================= */
G.updateVehicles = function (dt) { for (const v of G.vehicles) updateVehicle(v, dt); };
G.nearestVehicle = function (a, r) { let b = null, bd = r * r; for (const v of G.vehicles) { if (v.driver) continue; const d = (v.x - a.x) ** 2 + (v.z - a.z) ** 2; if (d < bd) { bd = d; b = v; } } return b; };
G.nearestLoot = function (a, r) { let b = null, bd = r * r; const L = G.loot; for (let i = 0; i < L.length; i++) { const l = L[i]; if (l.taken || l.item.kind === 'ammo') continue; const dx = l.x - a.x, dz = l.z - a.z, dy = l.y - a.y; if (Math.abs(dy) > 3) continue; const d = dx * dx + dz * dz; if (d < bd) { bd = d; b = l; } } return b; };
G.nearestChest = function (a, r) { let b = null, bd = r * r; for (const c of G.chests) { if (c.opened || c.falling) continue; const dx = c.x - a.x, dz = c.z - a.z; if (Math.abs(c.y - a.y) > 3) continue; const d = dx * dx + dz * dz; if (d < bd) { bd = d; b = c; } } return b; };
})();
