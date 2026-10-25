'use strict';
/* Procedural low-poly models: characters, weapons, bus, glider, buggy, chest, build textures */
(function () {
const G = window.G, T = THREE;
const matCache = {};
G.mat = function (hex, o) { const k = hex + (o ? JSON.stringify(o) : ''); if (!matCache[k]) matCache[k] = new T.MeshLambertMaterial(Object.assign({ color: hex }, o || {})); return matCache[k]; };
const geoCache = {};
function boxGeo(w, h, d) { const k = w + '_' + h + '_' + d; return geoCache[k] || (geoCache[k] = new T.BoxGeometry(w, h, d)); }
function bx(parent, w, h, d, col, x, y, z, o) { const m = new T.Mesh(boxGeo(w, h, d), G.mat(col, o)); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; parent.add(m); return m; }
G.bx = bx;

/* ---------- weapons ---------- */
G.weaponModel = function (id, rarHex) {
  const g = new T.Group(); const dark = 0x2b2f38, mid = 0x454b57, acc = rarHex || 0xffffff; const emi = { emissive: acc, emissiveIntensity: 0.55 };
  if (id === 'pistol') { bx(g, 0.07, 0.1, 0.32, mid, 0, 0, -0.14); bx(g, 0.072, 0.025, 0.28, acc, 0, 0.06, -0.14, emi); bx(g, 0.065, 0.17, 0.085, dark, 0, -0.12, 0.0); }
  else if (id === 'shotgun') { bx(g, 0.06, 0.06, 0.78, mid, 0, 0.02, -0.4); bx(g, 0.095, 0.08, 0.22, 0x8a5a33, 0, -0.04, -0.34); bx(g, 0.09, 0.12, 0.34, 0x8a5a33, 0, -0.04, 0.2); bx(g, 0.08, 0.1, 0.2, dark, 0, -0.01, -0.02); bx(g, 0.065, 0.02, 0.5, acc, 0, 0.06, -0.4, emi); }
  else if (id === 'ar') { bx(g, 0.09, 0.12, 0.55, mid, 0, 0, -0.2); bx(g, 0.04, 0.04, 0.38, dark, 0, 0.02, -0.64); bx(g, 0.07, 0.22, 0.1, dark, 0, -0.16, -0.16); bx(g, 0.08, 0.12, 0.28, dark, 0, -0.02, 0.28); bx(g, 0.05, 0.05, 0.14, dark, 0, 0.1, -0.2); bx(g, 0.092, 0.025, 0.5, acc, 0, 0.065, -0.2, emi); bx(g, 0.07, 0.14, 0.07, dark, 0, -0.12, 0.02); }
  else if (id === 'smg') { bx(g, 0.09, 0.12, 0.38, mid, 0, 0, -0.14); bx(g, 0.04, 0.04, 0.22, dark, 0, 0.01, -0.42); bx(g, 0.06, 0.3, 0.07, dark, 0, -0.2, -0.1); bx(g, 0.07, 0.13, 0.07, dark, 0, -0.1, 0.06); bx(g, 0.092, 0.025, 0.34, acc, 0, 0.065, -0.14, emi); bx(g, 0.04, 0.06, 0.1, dark, 0, 0.09, -0.1); }
  else if (id === 'sniper') { bx(g, 0.075, 0.1, 0.85, mid, 0, 0, -0.28); bx(g, 0.04, 0.04, 0.55, dark, 0, 0.01, -0.95); const sc = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.34, 8), G.mat(dark)); sc.rotation.x = Math.PI / 2; sc.position.set(0, 0.12, -0.25); g.add(sc); bx(g, 0.05, 0.05, 0.04, 0x6ad0ff, 0, 0.12, -0.44, { emissive: 0x6ad0ff }); bx(g, 0.09, 0.14, 0.32, 0x39414d, 0, -0.02, 0.4); bx(g, 0.078, 0.025, 0.7, acc, 0, 0.06, -0.3, emi); bx(g, 0.06, 0.12, 0.07, dark, 0, -0.1, 0.02); }
  else if (id === 'rocket') { const tb = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 1.0, 10), G.mat(0x4d5a45)); tb.rotation.x = Math.PI / 2; tb.position.set(0, 0.05, -0.3); tb.castShadow = true; g.add(tb); const fl = new T.Mesh(new T.CylinderGeometry(0.15, 0.11, 0.16, 10), G.mat(dark)); fl.rotation.x = Math.PI / 2; fl.position.set(0, 0.05, 0.28); g.add(fl);
    const band = new T.Mesh(new T.CylinderGeometry(0.118, 0.118, 0.08, 10), G.mat(acc, emi)); band.rotation.x = Math.PI / 2; band.position.set(0, 0.05, -0.3); g.add(band); const band2 = band.clone(); band2.position.z = -0.6; g.add(band2);
    const tip = new T.Mesh(new T.ConeGeometry(0.1, 0.25, 10), G.mat(0xff4d4d)); tip.rotation.x = -Math.PI / 2; tip.position.set(0, 0.05, -0.92); g.add(tip); bx(g, 0.06, 0.14, 0.07, dark, 0, -0.1, 0.0); }
  g.scale.setScalar(1.15); return g;
};
G.pickaxeModel = function () {
  const g = new T.Group(); bx(g, 0.05, 0.05, 0.9, 0x8a5a33, 0, 0, -0.35); bx(g, 0.5, 0.07, 0.08, 0x9aa5b4, 0, 0, -0.78); bx(g, 0.07, 0.09, 0.14, 0xff6b3a, 0.26, 0, -0.78); bx(g, 0.07, 0.09, 0.14, 0xff6b3a, -0.26, 0, -0.78); return g;
};

/* ---------- character ---------- */
G.makeCharacter = function (skin) {
  const root = new T.Group(), lean = new T.Group(), m = new T.Group(); lean.position.y = 1; m.position.y = -1; root.add(lean); lean.add(m);
  const tone = skin.tone || 0xf2c9a0, shirt = skin.shirt, pants = skin.pants, acc = skin.acc;
  const mk = (par, w, h, d, col, x, y, z) => bx(par, w, h, d, col, x, y, z);
  const legs = [];
  for (const s of [-1, 1]) { const p = new T.Group(); p.position.set(s * 0.15, 0.8, 0); mk(p, 0.23, 0.8, 0.25, pants, 0, -0.4, 0); mk(p, 0.25, 0.14, 0.38, 0x2b2b33, 0, -0.74, -0.05); m.add(p); legs.push(p); }
  mk(m, 0.62, 0.68, 0.36, shirt, 0, 1.14, 0); mk(m, 0.64, 0.1, 0.38, acc, 0, 0.84, 0); mk(m, 0.2, 0.2, 0.02, acc, 0, 1.2, -0.19);
  const head = new T.Group(); head.position.set(0, 1.68, 0); m.add(head);
  const hm = new T.Mesh(new T.SphereGeometry(0.27, 10, 8), G.mat(tone)); hm.castShadow = true; head.add(hm);
  mk(head, 0.07, 0.1, 0.03, 0x1a1a22, -0.1, 0.03, -0.25); mk(head, 0.07, 0.1, 0.03, 0x1a1a22, 0.1, 0.03, -0.25); mk(head, 0.12, 0.03, 0.03, 0x8a3a3a, 0, -0.1, -0.25);
  const ht = skin.hat;
  if (ht === 'cap') { const d = new T.Mesh(new T.SphereGeometry(0.3, 10, 6, 0, 6.3, 0, 1.5), G.mat(acc)); d.position.y = 0.04; head.add(d); mk(head, 0.32, 0.04, 0.22, acc, 0, 0.08, -0.34); }
  else if (ht === 'helmet') { const d = new T.Mesh(new T.SphereGeometry(0.32, 10, 7, 0, 6.3, 0, 1.75), G.mat(acc)); d.position.y = 0.02; head.add(d); mk(head, 0.1, 0.08, 0.5, 0xffffff, 0, 0.33, 0); }
  else if (ht === 'mohawk') { mk(head, 0.07, 0.24, 0.46, acc, 0, 0.3, 0); }
  else if (ht === 'horns') { for (const s of [-1, 1]) { const c = new T.Mesh(new T.ConeGeometry(0.07, 0.3, 6), G.mat(0xf4f0e0)); c.position.set(s * 0.2, 0.32, 0); c.rotation.z = -s * 0.5; head.add(c); } mk(head, 0.56, 0.08, 0.5, acc, 0, 0.2, 0); }
  else if (ht === 'beanie') { const c = new T.Mesh(new T.CylinderGeometry(0.27, 0.3, 0.2, 10), G.mat(acc)); c.position.y = 0.18; head.add(c); const p = new T.Mesh(new T.SphereGeometry(0.08, 6, 5), G.mat(0xffffff)); p.position.y = 0.34; head.add(p); }
  else { mk(head, 0.58, 0.08, 0.1, acc, 0, 0.12, -0.2); mk(head, 0.54, 0.1, 0.5, 0x2b2b33, 0, 0.26, 0.04); }
  const arms = [];
  for (const s of [-1, 1]) { const p = new T.Group(); p.position.set(s * 0.4, 1.4, 0); mk(p, 0.18, 0.64, 0.18, shirt, 0, -0.3, 0); const h = new T.Mesh(new T.SphereGeometry(0.1, 6, 5), G.mat(tone)); h.position.y = -0.66; p.add(h); m.add(p); arms.push(p); }
  mk(m, 0.44, 0.52, 0.2, acc, 0, 1.16, 0.28);
  const gun = new T.Group(); gun.position.set(0.14, 1.33, -0.12); m.add(gun);
  const pick = G.pickaxeModel(); pick.position.set(0, -0.66, 0); pick.rotation.x = Math.PI / 2; arms[1].add(pick); pick.visible = false;
  const flash = new T.Mesh(new T.SphereGeometry(0.12, 6, 5), new T.MeshBasicMaterial({ color: 0xffe9a0 })); flash.visible = false; gun.add(flash);
  const glider = G.makeGlider(skin.acc); glider.visible = false; root.add(glider);
  const o = { root, lean, m, legs, arms, head, gun, pick, flash, glider, held: null, heldKey: '' };
  o.setHeld = function (kind, w, rar) {
    const key = kind + (w || '') + (rar === undefined ? '' : rar); if (key === o.heldKey) return; o.heldKey = key;
    if (o.held) { gun.remove(o.held); o.held = null; } pick.visible = kind === 'pickaxe';
    if (kind === 'weapon') { const wm = G.weaponModel(w, G.RARITY[rar].hex); wm.position.set(0, -0.02, -0.08); gun.add(wm); o.held = wm; }
    o.hasGun = kind === 'weapon';
  };
  return o;
};
G.makeGlider = function (col) {
  const g = new T.Group(); const geo = new T.SphereGeometry(2.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); const cols = []; const p = geo.attributes.position;
  const c1 = new T.Color(col || 0xff5a5a), c2 = new T.Color(0xffffff);
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = Math.floor((a + Math.PI) / (Math.PI * 2) * 10) % 2; const c = k ? c1 : c2; cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  const cm = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })); cm.scale.set(1.15, 0.7, 1.0); cm.position.y = 3.6; cm.castShadow = true; g.add(cm);
  for (const [x, z] of [[-1.7, 0], [1.7, 0], [0, -1.5], [0, 1.5]]) { const l = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 2.6, 3), G.mat(0xeeeeee)); const mx = x * 0.5, mz = z * 0.5; l.position.set(mx, 2.35, mz); l.lookAt(x, 3.6, z); l.rotateX(Math.PI / 2); l.scale.y = 1; g.add(l); }
  return g;
};
G.makeNameplate = function (name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d'); x.font = 'bold 30px Trebuchet MS, Arial'; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.75)'; x.strokeText(name, 128, 34); x.fillStyle = '#fff'; x.fillText(name, 128, 34);
  const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthTest: false })); s.scale.set(2.4, 0.45, 1); s.position.y = 2.5; s.renderOrder = 10; return s;
};

/* ---------- bus ---------- */
G.makeBus = function () {
  const g = new T.Group(); const body = 0x2bbfb0, gold = 0xffc83a, dark = 0x1d3b57;
  bx(g, 3.4, 2.2, 9.4, body, 0, 0, 0); bx(g, 3.5, 0.5, 9.5, gold, 0, -0.35, 0); bx(g, 3.3, 0.18, 9.3, 0xffffff, 0, 1.18, 0); bx(g, 3.0, 1.0, 2.0, body, 0, 0.1, -5.5); bx(g, 3.1, 0.5, 0.3, gold, 0, -0.4, -6.55);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) bx(g, 0.05, 0.7, 1.4, dark, s * 1.72, 0.4, -2.4 + i * 2.1, { emissive: 0x16304a });
  bx(g, 2.6, 0.8, 0.05, dark, 0, 0.45, -6.52, { emissive: 0x16304a });
  for (const s of [-1, 1]) for (const z of [-3, 3]) { const w = new T.Mesh(new T.CylinderGeometry(0.75, 0.75, 0.5, 12), G.mat(0x22252c)); w.rotation.z = Math.PI / 2; w.position.set(s * 1.7, -1.2, z); g.add(w); const hub = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 0.52, 8), G.mat(gold)); hub.rotation.z = Math.PI / 2; hub.position.copy(w.position); g.add(hub); }
  bx(g, 0.2, 2.2, 1.8, gold, 0, 1.3, 4.9); bx(g, 3.2, 0.2, 1.4, gold, 0, 2.4, 4.9);
  const prop = new G.Obj3(); bx(prop, 0.15, 2.2, 0.2, 0x333844, 0, 0, 0); bx(prop, 2.2, 0.15, 0.2, 0x333844, 0, 0, 0); prop.position.set(0, 0.2, 5.4); g.add(prop); g.userData.prop = prop;
  // balloon
  const geo = new T.SphereGeometry(7, 18, 14); const p = geo.attributes.position, cols = []; const cA = new T.Color(0xff5a5a), cB = new T.Color(0xffd83a), cC = new T.Color(0x3fa0ff);
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = Math.floor((a + Math.PI) / (Math.PI * 2) * 12) % 3; const c = k === 0 ? cA : k === 1 ? cB : cC; cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); const bl = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true })); bl.scale.set(1, 1.15, 1); bl.position.y = 14; bl.castShadow = true; g.add(bl);
  for (const [x, z] of [[-1.5, -3.5], [1.5, -3.5], [-1.5, 3.5], [1.5, 3.5]]) { const l = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 9, 4), G.mat(0xeeeeee)); l.position.set(x * 0.6, 6.4, z * 0.6); l.rotation.z = -x * 0.03; g.add(l); }
  g.scale.setScalar(1.25); return g;
};
G.Obj3 = T.Group;

/* ---------- buggy ---------- */
G.makeCar = function (col) {
  const g = new T.Group(); col = col || 0xff5a3a; const wheels = [];
  bx(g, 2.0, 0.5, 3.8, col, 0, 0.75, 0); bx(g, 1.6, 0.4, 1.2, col, 0, 1.0, -1.5); bx(g, 1.8, 0.1, 3.9, 0x2b2f38, 0, 0.45, 0);
  bx(g, 0.7, 0.5, 0.5, 0x2b2f38, -0.45, 1.2, 0.3); bx(g, 0.7, 0.5, 0.5, 0x2b2f38, 0.45, 1.2, 0.3); bx(g, 1.6, 0.7, 0.2, 0x2b2f38, 0, 1.4, 0.7);
  for (const s of [-1, 1]) { bx(g, 0.1, 1.2, 0.1, 0xdddddd, s * 0.9, 1.6, -0.2); bx(g, 0.1, 1.2, 0.1, 0xdddddd, s * 0.9, 1.6, 1.1); } bx(g, 1.9, 0.1, 0.1, 0xdddddd, 0, 2.2, -0.2); bx(g, 1.9, 0.1, 0.1, 0xdddddd, 0, 2.2, 1.1);
  bx(g, 0.35, 0.25, 0.1, 0xfff3a0, -0.65, 0.95, -2.0, { emissive: 0xfff3a0 }); bx(g, 0.35, 0.25, 0.1, 0xfff3a0, 0.65, 0.95, -2.0, { emissive: 0xfff3a0 });
  for (const [x, z] of [[-1.15, -1.3], [1.15, -1.3], [-1.15, 1.3], [1.15, 1.3]]) { const w = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 0.45, 12), G.mat(0x22252c)); w.rotation.z = Math.PI / 2; const pv = new T.Group(); pv.position.set(x, 0.55, z); pv.add(w); const hub = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.47, 6), G.mat(0xffc83a)); hub.rotation.z = Math.PI / 2; pv.add(hub); g.add(pv); wheels.push(pv); w.castShadow = true; }
  g.userData.wheels = wheels; return g;
};

/* ---------- chest ---------- */
G.makeChest = function () {
  const g = new T.Group(); const wood = 0x7a4a2a, gold = 0xffc83a, ge = { emissive: 0xaa7a10, emissiveIntensity: 0.6 };
  const body = new T.Group(); g.add(body); bx(body, 1.1, 0.55, 0.7, wood, 0, 0.275, 0); for (const sx of [-0.5, 0.5]) bx(body, 0.1, 0.57, 0.72, gold, sx, 0.28, 0, ge); bx(body, 0.18, 0.18, 0.04, gold, 0, 0.45, 0.36, ge);
  const lid = new T.Group(); lid.position.set(0, 0.55, -0.35); g.add(lid); bx(lid, 1.1, 0.3, 0.7, 0x8a5430, 0, 0.12, 0.35); for (const sx of [-0.5, 0.5]) bx(lid, 0.1, 0.32, 0.72, gold, sx, 0.13, 0.35, ge);
  const beam = new T.Mesh(new T.CylinderGeometry(0.28, 0.5, 9, 8, 1, true), new T.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); beam.position.y = 4.6; g.add(beam);
  const light = new T.Mesh(new T.CircleGeometry(1.0, 16), new T.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false })); light.rotation.x = -Math.PI / 2; light.position.y = 0.05; g.add(light); beam.add(light); light.position.y = -4.5;
  g.userData = { body, lid, beam }; return g;
};

/* ---------- pickups visuals ---------- */
const iconCache = {};
G.pickupIcon = function (item) {
  const key = item.kind === 'weapon' ? 'w' + item.w + item.rarity : item.kind === 'ammo' ? 'a' + item.t : 'h' + item.id; if (iconCache[key]) return iconCache[key].clone();
  const g = new T.Group();
  if (item.kind === 'weapon') { const w = G.weaponModel(item.w, G.RARITY[item.rarity].hex); w.scale.setScalar(1.7); w.rotation.y = Math.PI / 2; w.position.y = 0.0; g.add(w); }
  else if (item.kind === 'ammo') { const a = G.AMMO[item.t]; bx(g, 0.4, 0.26, 0.28, a.hex, 0, 0, 0, { emissive: a.hex, emissiveIntensity: 0.25 }); bx(g, 0.42, 0.06, 0.3, 0x333333, 0, 0.05, 0); for (let i = 0; i < 3; i++) bx(g, 0.06, 0.2, 0.06, 0xffe39a, -0.1 + i * 0.1, 0.22, 0); }
  else { const h = G.HEALS[item.id];
    if (item.id === 'bandage') { const r = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.18, 12), G.mat(0xf4f4f4)); g.add(r); bx(g, 0.1, 0.19, 0.28, 0xff4d4d, 0, 0, 0.05); }
    else if (item.id === 'medkit') { bx(g, 0.5, 0.34, 0.3, 0xf4f4f4, 0, 0, 0); bx(g, 0.28, 0.1, 0.31, 0xff3a3a, 0, 0, 0); bx(g, 0.1, 0.28, 0.31, 0xff3a3a, 0, 0, 0); }
    else { const s = item.id === 'minishield' ? 0.8 : item.id === 'shield' ? 1.1 : 1.0; const b = new T.Mesh(new T.CylinderGeometry(0.16 * s, 0.2 * s, 0.34 * s, 10), new T.MeshLambertMaterial({ color: h.hex, emissive: h.hex, emissiveIntensity: 0.45, transparent: true, opacity: 0.9 })); g.add(b); const n = new T.Mesh(new T.CylinderGeometry(0.07 * s, 0.1 * s, 0.14 * s, 8), G.mat(0xeeeeee)); n.position.y = 0.24 * s; g.add(n); bx(g, 0.08 * s, 0.05 * s, 0.08 * s, 0x8a5a33, 0, 0.34 * s, 0); } }
  iconCache[key] = g; return g.clone();
};

/* ---------- build textures & geometry ---------- */
G.makeBuildMaterials = function () {
  function tex(draw) { const c = document.createElement('canvas'); c.width = c.height = 128; draw(c.getContext('2d')); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; }
  const wood = tex(x => { x.fillStyle = '#c98b4c'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#b97a3e' : '#d79a5a'; x.fillRect(i * 21.3, 0, 21.3, 128); x.fillStyle = 'rgba(70,40,10,.55)'; x.fillRect(i * 21.3, 0, 2, 128); } for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(90,50,15,.18)'; x.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 8); } });
  const stone = tex(x => { x.fillStyle = '#9aa3ae'; x.fillRect(0, 0, 128, 128); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const off = r % 2 ? 21 : 0; x.fillStyle = (r + c) % 2 ? '#a9b2bd' : '#8e97a3'; x.fillRect(c * 42.6 - off + 2, r * 32 + 2, 38, 28); } x.strokeStyle = '#6a727c'; x.lineWidth = 2; for (let r = 0; r <= 4; r++) { x.beginPath(); x.moveTo(0, r * 32); x.lineTo(128, r * 32); x.stroke(); } });
  const metal = tex(x => { x.fillStyle = '#7fb6e0'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#9ccaec'; x.fillRect(6, 6, 116, 116); x.strokeStyle = '#5b8fb8'; x.lineWidth = 3; x.strokeRect(6, 6, 116, 116); x.beginPath(); x.moveTo(6, 6); x.lineTo(122, 122); x.moveTo(122, 6); x.lineTo(6, 122); x.stroke(); x.fillStyle = '#4b7ba0'; for (const [a, b] of [[14, 14], [114, 14], [14, 114], [114, 114]]) { x.beginPath(); x.arc(a, b, 4, 0, 6.3); x.fill(); } });
  const M = {}; for (const [k, t] of [['wood', wood], ['stone', stone], ['metal', metal]]) { t.repeat.set(1, 1); M[k] = new T.MeshLambertMaterial({ map: t }); }
  G.buildMats = M;
  const mkPrev = (c) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45, depthWrite: false });
  G.previewOK = mkPrev(0x4de3ff); G.previewBad = mkPrev(0xff4d4d);
  // geometries
  const S = G.BS, F = G.FH;
  function uvBox(w, h, d) { return new T.BoxGeometry(w, h, d); }
  G.geo = { wall: uvBox(S, F + 0.5, 0.3), floor: uvBox(S, 0.45, S), ramp: [] };
  G.geo.wall.translate(0, (F - 0.5) / 2 + 0, 0); G.geo.wall.translate(0, 0, 0);
  G.geo.floor.translate(0, -0.45 / 2 + 0.12, 0);
  for (let d = 0; d < 4; d++) {
    const b = new G.Batch(); b.wedge(-S / 2, -S / 2, S / 2, S / 2, 0.12, F + 0.12, 0.45, d, 0xffffff);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(b.pos), 3)); g.setAttribute('normal', new T.BufferAttribute(new Float32Array(b.nor), 3));
    const uv = []; for (let i = 0; i < b.pos.length / 3; i++) { const x = b.pos[i * 3], y = b.pos[i * 3 + 1], z = b.pos[i * 3 + 2], nx = Math.abs(b.nor[i * 3]), ny = Math.abs(b.nor[i * 3 + 1]); if (ny > 0.5) uv.push(x / S + 0.5, z / S + 0.5); else if (nx > 0.5) uv.push(z / S + 0.5, y / S); else uv.push(x / S + 0.5, y / S); }
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); G.geo.ramp.push(g);
  }
};
})();
