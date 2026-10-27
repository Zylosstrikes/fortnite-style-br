'use strict';
/* Extra gameplay features: hiding bushes, supply llama drops, armored trucks, rifts, campfires (+Ember), TNT & traps, Victory Crown, XP.
   All original procedural content. */
(function () {
const G = window.G, T = THREE, W = () => G.World;
const E = G.Extras = { bushes: [], camps: [], rifts: [], trucks: [], truckSites: [], llamaT: 45, llamaN: 0, rects: [] };
G.traps = []; G.bombs = [];

/* ================= world placement ================= */
E.sites = function (pads, roads, P, H0, rects, R) {
  E.truckSites = [];
  // armored trucks parked beside the roads (axis aligned so the colliders fit)
  [[1, 0.5, 1], [0, 0.46, -1], [6, 0.5, 1], [3, 0.42, -1]].forEach(([ri, t, side]) => {
    const r = roads[ri]; const dx = r[2] - r[0], dz = r[3] - r[1], L = Math.hypot(dx, dz); const x = r[0] + dx * t + (-dz / L) * 10 * side, z = r[1] + dz * t + (dx / L) * 10 * side;
    const h = H0(x, z); if (h < 1.6) return; const yaw = Math.abs(dx) > Math.abs(dz) ? Math.PI / 2 : 0; const y = Math.max(2.8, h);
    pads.push({ x, z, r: 9, h: y }); const hw = yaw ? 10 : 3.5, hd = yaw ? 3.5 : 10; rects.push({ x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd }); E.truckSites.push({ x, z, yaw, y });
  });
  E.rects = rects;
};
function findSpot(rects, o) {
  o = o || {}; for (let i = 0; i < 80; i++) {
    const ang = Math.random() * 6.283, rad = Math.sqrt(Math.random()) * (o.maxR || 400); let x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    if (o.poi) { const p = G.pick(G.POIS); const a = Math.random() * 6.283, r = G.rand(o.poi[0], p.r * o.poi[1]); x = p.x + Math.cos(a) * r; z = p.z + Math.sin(a) * r; }
    const h = W().heightAt(x, z); if (h < (o.minH || 2.2) || h > (o.maxH || 30)) continue; if (W().slopeAt(x, z) > (o.slope || 0.45)) continue; if (W().roadDist(x, z) < (o.road || 4)) continue;
    const pad = o.pad === undefined ? 3 : o.pad; if (rects.some(q => x > q.x0 - pad && x < q.x1 + pad && z > q.z0 - pad && z < q.z1 + pad)) continue;
    if (o.far && o.far.some(f => Math.hypot(x - f.x, z - f.z) < (o.farD || 40))) continue; return { x, z, h };
  } return null;
}
E.populate = function (scene, rects) {
  const Wd = W();
  // --- bushes
  for (let i = 0; i < 100; i++) {
    const s = findSpot(rects, i < 36 ? { poi: [6, 0.9], pad: 1.8, minH: 1.8, maxH: 40, slope: 0.7 } : { pad: 1.8, minH: 1.8, maxH: 40, slope: 0.7, maxR: 430 }); if (!s) continue;
    if (i >= 36 && !(G.fbm(s.x * 0.008 + 100, s.z * 0.008, 3) > 0.48 || Math.random() < 0.3)) continue;
    const m = G.makeBush(i); const sc = G.rand(1.0, 1.5); m.scale.set(sc, sc * G.rand(0.9, 1.15), sc); m.rotation.y = Math.random() * 6.28; m.position.set(s.x, s.h - 0.05, s.z); scene.add(m);
    E.bushes.push({ x: s.x, y: s.h, z: s.z, r: 1.3 * sc, mesh: m, mat: m.material, trans: false });
  }
  // --- armored supply trucks (loot containers + solid props)
  for (const s of E.truckSites) {
    const g = G.makeTruck(); g.position.set(s.x, s.y, s.z); g.rotation.y = s.yaw; scene.add(g); const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    const wx = (lx, lz) => s.x + lx * c + lz * sn, wz = (lx, lz) => s.z - lx * sn + lz * c;
    const box = (lx0, lx1, lz0, lz1, y1) => { const xs = [wx(lx0, lz0), wx(lx1, lz1)], zs = [wz(lx0, lz0), wz(lx1, lz1)]; Wd.addBox({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: s.y - 0.5, y1: s.y + y1, kind: 'prop', mat: 'metal', hp: 1e9, col: 0x3a404b }); };
    box(-1.75, 1.75, -2.1, 7.7, 4.85); box(-1.6, 1.6, -7.7, -4.3, 3.8); box(-1.5, 1.5, -4.3, -2.1, 1.5);
    const dummy = new T.Object3D(); const ch = { kind: 'truck', style: 'truck', rar: 3, x: wx(0, 9.6), y: s.y, z: wz(0, 9.6), yaw: s.yaw, opened: false, mesh: dummy, lid: dummy, beam: g.userData.beam, grp: g, bld: null };
    ch.onOpen = () => { for (const d of g.userData.doors) d.pv.rotation.y = d.s * 1.9; G.FX.burst(ch.x, s.y + 2.5, ch.z, 0xc08aff, 14, 6, 0.3, 0.8, 2); };
    G.chests.push(ch); E.trucks.push(ch);
  }
  // --- campfires + Ember mascot (heal area)
  const used = [];
  for (let i = 0; i < 9; i++) {
    const s = findSpot(rects, i < 5 ? { poi: [12, 1.0], pad: 4, far: used, farD: 60 } : { pad: 4, far: used, farD: 80, maxR: 380 }); if (!s) continue; used.push(s);
    const g = G.makeCampfire(); g.position.set(s.x, s.h, s.z); scene.add(g); const em = G.makeEmber(); em.position.set(s.x + 2.0, s.h, s.z + 0.6); scene.add(em);
    E.camps.push({ x: s.x, y: s.h, z: s.z, grp: g, ember: em, ph: Math.random() * 6 });
  }
  // --- rifts
  for (let i = 0; i < 5; i++) {
    const s = findSpot(rects, { pad: 6, far: used, farD: 70, maxR: 400, minH: 3, maxH: 26 }); if (!s) continue; used.push(s);
    const g = G.makeRift(); g.position.set(s.x, s.h + 2.3, s.z); scene.add(g); E.rifts.push({ x: s.x, y: s.h, z: s.z, grp: g });
  }
  // --- blue metallic chests in the open (rare+)
  for (let i = 0; i < 10; i++) { const s = findSpot(rects, i < 6 ? { poi: [10, 0.95], pad: 3 } : { pad: 3, maxR: 380 }); if (!s) continue; Wd.addChest(s.x, s.h + 0.05, s.z, Math.random() * 6.28, null, 'metal'); }
};

/* ================= TNT / traps ================= */
G.makeBombMesh = function () { return G.gadgetModel('tnt'); };
G.useGadget = function (a, tx, ty, tz) {
  const it = a.inv[a.sel]; if (!it || it.type !== 'gadget' || a.fireCD > 0 || a.state !== 'ground' || a.vehicle || a.action) return false; const gd = G.GADGETS[it.id];
  const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
  if (it.id === 'tnt') {
    const ox = a.x + fx * 0.6, oy = a.y + 1.55, oz = a.z + fz * 0.6; let dx = tx - ox, dy = ty - oy, dz = tz - oz; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl; const sp = G.clamp(dl * 0.9 + 6, 10, 21);
    const mesh = G.makeBombMesh(); mesh.scale.setScalar(2.2); G.scene.add(mesh); G.bombs.push({ x: ox, y: oy, z: oz, vx: dx * sp + a.vx * 0.4, vy: dy * sp + 4.5, vz: dz * sp + a.vz * 0.4, t: 0, fuse: gd.fuse, owner: a, mesh, rest: false });
    a.fireCD = 0.7; G.Audio.at('jump', a.x, a.y, a.z, 0.5); a.lastShotT = G.time; if (G.Anim) G.Anim.trigger(a, 'throw');
  } else {
    const px = a.x + fx * 2.4, pz = a.z + fz * 2.4; const gy = W().groundY(px, pz, a.y + 1.0, 1.0); if (Math.abs(gy - a.y) > 1.3) { if (a.isPlayer) G.hook('msg', 'Can\'t place a trap here'); return false; }
    if (G.traps.some(t => Math.hypot(t.x - px, t.z - pz) < 2.4)) { if (a.isPlayer) G.hook('msg', 'Trap too close to another'); return false; }
    const mesh = G.makeTrapMesh(it.id); mesh.position.set(px, gy, pz); mesh.rotation.y = a.yaw; G.scene.add(mesh); G.traps.push({ id: it.id, x: px, y: gy, z: pz, yaw: a.yaw, mesh, owner: a, t0: G.time, life: 240 });
    a.fireCD = 0.5; G.Audio.at('build', px, gy, pz, 0.8); G.FX.burst(px, gy + 0.3, pz, it.id === 'launchpad' ? 0xffd23a : 0xdfe3ea, 8, 4, 0.18, 0.5, 6);
  }
  it.n--; if (it.n <= 0) { a.inv[a.sel] = null; a.sel = 0; G.updateHeld(a); }
  return true;
};
function updateBombs(dt) {
  const Wd = W();
  for (let i = G.bombs.length - 1; i >= 0; i--) {
    const b = G.bombs[i]; b.t += dt;
    if (!b.rest) {
      b.vy -= 22 * dt; const sp = Math.hypot(b.vx, b.vy, b.vz) || 1, step = sp * dt; const r = Wd.raycast(b.x, b.y, b.z, b.vx / sp, b.vy / sp, b.vz / sp, step + 0.12);
      if (r.hit && r.t <= step + 0.1 && !(r.terrain && !r.box)) { if (Math.abs(b.vy / sp) > Math.abs(b.vx / sp) && Math.abs(b.vy / sp) > Math.abs(b.vz / sp)) b.vy *= -0.3; else { b.vx *= -0.35; b.vz *= -0.35; } b.vx *= 0.7; b.vz *= 0.7; }
      else { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; }
      const g = Wd.groundY(b.x, b.z, b.y + 0.2, 0.5) + 0.14; if (b.y <= g) { b.y = g; if (b.vy < -2.5) { b.vy *= -0.35; b.vx *= 0.7; b.vz *= 0.7; G.Audio.at('step', b.x, b.y, b.z, 0.4); } else { b.vy = 0; b.vx *= 0.85; b.vz *= 0.85; if (Math.hypot(b.vx, b.vz) < 0.4) b.rest = true; } }
      b.mesh.rotation.x += dt * 8; b.mesh.rotation.z += dt * 5;
    }
    b.mesh.position.set(b.x, b.y, b.z); const left = b.fuse - b.t; const sp2 = b.mesh.userData.spark; if (sp2) { sp2.visible = Math.floor(left * 10) % 2 === 0; } if (Math.random() < dt * 20) G.FX.spawn(b.x, b.y + 0.4, b.z, (Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2, 0xffb030, 0.12, 0.4, -1);
    if (b.t >= b.fuse) { G.scene.remove(b.mesh); G.bombs.splice(i, 1); G.explode(b.x, b.y + 0.3, b.z, G.GADGETS.tnt.radius, G.GADGETS.tnt.dmg, b.owner, 'TNT'); }
  }
}
G.launch = function (a, vy, fwd, kind) {
  if (a.state !== 'ground' && a.state !== 'glide') return; a.state = 'ground'; a.vy = vy; a.onGround = false; a.y += 0.2; a.autoGlide = true; a.launchedAt = G.time; a.glideOpen = false; a.rig.glider.visible = false;
  if (fwd) { a.vx += -Math.sin(a.yaw) * fwd; a.vz += -Math.cos(a.yaw) * fwd; } G.Audio.at('jump', a.x, a.y, a.z, 1.0);
  G.FX.burst(a.x, a.y + 0.2, a.z, kind === 'rift' ? 0xb8a8ff : 0xffd23a, 16, 8, 0.28, 0.7, 2);
};
function updateTraps(dt) {
  for (let i = G.traps.length - 1; i >= 0; i--) {
    const t = G.traps[i]; if (G.time - t.t0 > t.life) { G.scene.remove(t.mesh); G.traps.splice(i, 1); continue; }
    if (t.mesh.userData.glow) t.mesh.userData.glow.material.opacity = 0.14 + 0.1 * Math.sin(G.time * 5);
    for (const a of G.actors) {
      if (!a.alive || a.state !== 'ground' || a.vehicle) continue; if (Math.abs(a.x - t.x) > 1.2 || Math.abs(a.z - t.z) > 1.2 || Math.abs(a.y - t.y) > 1.1) continue;
      if (t.id === 'launchpad') { if (G.time < (a.padCD || 0)) continue; a.padCD = G.time + 1.0; G.launch(a, 27, 9); G.Audio.at('glide', t.x, t.y, t.z, 0.6); if (a.isPlayer) G.hook('msg', 'LAUNCH PAD!'); t.mesh.scale.y = 0.5; setTimeout(() => { t.mesh.scale.y = 1; }, 150); }
      else if (a !== t.owner || G.time - t.t0 > 3) { G.damageActor(a, G.GADGETS.spike.dmg, t.owner, false, 'Spike Trap'); G.FX.burst(t.x, t.y + 0.5, t.z, 0xff4d4d, 10, 6, 0.2, 0.6, 8); G.Audio.at('hurt', t.x, t.y, t.z, 0.8); G.scene.remove(t.mesh); G.traps.splice(i, 1); break; }
    }
  }
}

/* ================= bushes / hiding ================= */
E.enterBush = function (a, b) { a.hideLock = b; a.x = b.x; a.z = b.z; a.vx = a.vz = 0; };
E.nearestBush = function (a, r) { let best = null, bd = r * r; for (const b of E.bushes) { const d = (b.x - a.x) ** 2 + (b.z - a.z) ** 2; if (d < bd && Math.abs(b.y - a.y) < 2.5) { bd = d; best = b; } } return best; };
function updateHide(dt) {
  const bs = E.bushes;
  for (const a of G.actors) {
    if (!a.alive || a.state !== 'ground' || a.vehicle) { a.hidden = false; a.bush = null; continue; }
    let inb = null; if (a.hideLock) { if (Math.hypot(a.x - a.hideLock.x, a.z - a.hideLock.z) > 2.6) a.hideLock = null; else inb = a.hideLock; }
    if (!inb) for (let i = 0; i < bs.length; i++) { const b = bs[i], dx = a.x - b.x, dz = a.z - b.z; if (dx * dx + dz * dz < b.r * b.r && Math.abs(a.y - b.y) < 2.2) { inb = b; break; } }
    a.bush = inb; a.hidden = !!inb && G.time - (a.lastShotT || -99) > 2.5;
  }
  const v = G.view || G.player;
  for (const b of bs) { const t = !!(v && v.hidden && v.bush === b); if (t !== b.trans) { b.trans = t; b.mat.transparent = t; b.mat.opacity = t ? 0.32 : 1; b.mat.depthWrite = !t; b.mat.needsUpdate = true; } }
}

/* ================= campfire / rifts / crown / llama ================= */
function updateCamps(dt) {
  const t = G.time, v = G.view || G.player;
  for (const c of E.camps) {
    const d = v ? Math.hypot(c.x - v.x, c.z - v.z) : 999; if (d < 140) {
      const fl = c.grp.userData.flames; for (let i = 0; i < fl.length; i++) { const s = 1 + Math.sin(t * (9 + i * 3) + c.ph + i) * 0.14; fl[i].scale.set(s, 1 + Math.sin(t * (7 + i * 2.2) + c.ph) * 0.16, s); fl[i].rotation.y = t * 2 + i; }
      c.grp.userData.glow.material.opacity = 0.75 + Math.sin(t * 11 + c.ph) * 0.15; if (Math.random() < dt * 8) G.FX.spawn(c.x + (Math.random() - 0.5) * 0.5, c.y + 1.0, c.z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 1.2, 2.5 + Math.random() * 1.5, (Math.random() - 0.5) * 1.2, Math.random() < 0.5 ? 0xffa628 : 0xff6a1a, 0.14, 1.0, -0.5);
      const em = c.ember; em.userData.body.position.y = Math.abs(Math.sin(t * 3 + c.ph)) * 0.12; em.userData.body.rotation.z = Math.sin(t * 2 + c.ph) * 0.08; for (let i = 0; i < 3; i++) { const s = 1 + Math.sin(t * 12 + i * 2 + c.ph) * 0.18; em.userData.fl[i].scale.set(s, 1 + Math.sin(t * 9 + i) * 0.2, s); } em.rotation.y = Math.atan2(v.x - em.position.x, v.z - em.position.z);
    }
  }
  for (const a of G.actors) { if (!a.alive || a.state !== 'ground' || a.vehicle) { a.camp = null; continue; } let hit = null; for (const c of E.camps) { if (Math.abs(c.x - a.x) < 4.2 && Math.abs(c.z - a.z) < 4.2 && Math.hypot(c.x - a.x, c.z - a.z) < 4.2 && Math.abs(c.y - a.y) < 3) { hit = c; break; } }
    if (hit) { if (a.hp < 100) a.hp = Math.min(100, a.hp + 6 * dt); if (!a.camp && a.isPlayer) G.hook('msg', 'Campfire — warm & healing'); } a.camp = hit; }
}
function updateRifts(dt) {
  const t = G.time; const v = G.view || G.player;
  for (const r of E.rifts) {
    const u = r.grp.userData; const d = v ? Math.hypot(r.x - v.x, r.z - v.z) : 999;
    if (d < 260) { u.sh.rotation.y = t * 0.8; u.sh.rotation.x = Math.sin(t * 1.3) * 0.25; r.grp.position.y = r.y + 2.3 + Math.sin(t * 1.7 + r.x) * 0.25; const s = 6 + Math.sin(t * 4) * 0.8; u.spr.scale.set(s, s, 1); u.ring.rotation.z = t; }
    for (const a of G.actors) { if (!a.alive || a.state !== 'ground' || a.vehicle) continue; if (Math.abs(a.x - r.x) > 2.2 || Math.abs(a.z - r.z) > 2.2) continue; if (Math.hypot(a.x - r.x, a.z - r.z) > 2.2 || Math.abs(a.y - r.y) > 4 || G.time < (a.riftCD || 0)) continue; a.riftCD = G.time + 8; G.launch(a, 40, 6, 'rift'); if (a.isPlayer) G.hook('msg', 'RIFT! Gliding up…'); }
  }
}
function updateCrown(dt) {
  const alive = G.aliveCount(); const winner = alive === 1 && G.time > 12 ? G.actors.find(a => a.alive) : null;
  for (const a of G.actors) { const r = a.rig; if (!r) continue; const show = a === winner && a.state !== 'bus';
    if (show && !r.crown) { r.crown = G.makeCrown(); r.crown.scale.setScalar(0.6); r.root.add(r.crown); }
    if (r.crown) { r.crown.visible = show; if (show) { r.crown.position.y = 2.55 + Math.sin(G.time * 3) * 0.06; r.crown.rotation.y += dt * 2.2; if (a.state === 'glide' || a.state === 'freefall') r.crown.position.y = 2.2; } } }
  E.winner = winner;
}
function updateLlama(dt) {
  const S = G.storm; E.llamaT -= dt;
  if (E.llamaT <= 0 && S && E.llamaN < 4 && S.stage !== 'done' && G.player && G.player.state !== 'bus') {
    E.llamaT = G.rand(45, 75); const useNext = S.stage === 'shrink' || S.left < 25; const cx = useNext ? S.nx : S.cx, cz = useNext ? S.nz : S.cz, rr = useNext ? S.nr : S.r;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * Math.max(10, rr * 0.7); const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; const h = W().heightAt(x, z); if (h < 2.5 || h > 35 || W().slopeAt(x, z) > 0.4 || Math.hypot(x, z) > 400) continue;
      if (E.rects.some(q => x > q.x0 - 4 && x < q.x1 + 4 && z > q.z0 - 4 && z < q.z1 + 4)) continue;
      const g = G.makeLlama(); g.position.set(x, 230, z); g.rotation.y = Math.random() * 6.28; G.scene.add(g); const dummy = new T.Object3D();
      const c = { kind: 'llama', style: 'llama', rar: 4, x, y: h, z, yaw: 0, opened: false, falling: true, fallY: 230, mesh: dummy, lid: dummy, beam: g.userData.beam, grp: g, bld: null, born: G.time };
      c.onOpen = () => { c.gone = true; g.visible = false; for (let k = 0; k < 4; k++) G.FX.burst(c.x, c.y + 1.6, c.z, [0xff5fb0, 0xffe03a, 0x3fd0ff, 0x7dff5a][k], 18, 14, 0.3, 1.2, 8); G.Audio.at('explosion', c.x, c.y, c.z, 0.35); };
      G.chests.push(c); E.llamaN++; G.UI.toast('SUPPLY LLAMA INCOMING', 2600); if (G.player.alive) G.hook('msg', 'Supply llama dropping — see the pink marker on the map'); break;
    }
  }
  for (const c of G.chests) { if (c.kind !== 'llama') continue; const u = c.grp.userData;
    if (c.falling) { c.fallY -= 22 * dt; c.grp.position.y = Math.max(c.y, c.fallY); u.body.rotation.z = Math.sin(G.time * 1.5) * 0.08; u.balloon.visible = true; if (c.fallY <= c.y) { c.falling = false; u.balloon.visible = false; c.grp.position.y = c.y; G.FX.burst(c.x, c.y + 0.3, c.z, 0xd9c58e, 22, 10, 0.5, 1.0, 6); G.Audio.at('crash', c.x, c.y, c.z, 1.0); } }
    else if (!c.opened) { u.body.rotation.z = Math.sin(G.time * 2.5) * 0.04; u.body.position.y = Math.abs(Math.sin(G.time * 2.5)) * 0.04; } }
}

/* ================= XP ================= */
G.awardXp = function (pl, win) {
  const st = pl.stats; const place = win ? 1 : st.placement; const before = G.loadXp();
  const parts = [['Placement', Math.max(0, 36 - place) * 3], ['Eliminations', pl.kills * 25], ['Survival', Math.min(120, Math.floor((st.timeAlive || (G.time - st.born)) / 5))], ['Damage', Math.min(80, Math.round(st.dealt / 12))]]; if (win) parts.push(['Victory Royale', 150]);
  const gain = parts.reduce((s, p) => s + p[1], 0); const after = before + gain; G.saveXp(after); const lb = G.levelFromXp(before), la = G.levelFromXp(after);
  return { gain, parts, before, after, lb, la, levelUp: la.level > lb.level };
};

/* ================= per-frame ================= */
G.updateExtras = function (dt) {
  updateHide(dt); updateBombs(dt); updateTraps(dt); updateCamps(dt); updateRifts(dt); updateCrown(dt); updateLlama(dt);
};
})();
