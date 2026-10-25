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
function cyl(parent, r, len, col, x, y, z, o, r2, seg) { const m = new T.Mesh(new T.CylinderGeometry(r, r2 === undefined ? r : r2, len, seg || 8), G.mat(col, o)); m.rotation.x = Math.PI / 2; m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; parent.add(m); return m; }
G.cyl = cyl;
const GOLD = 0xffc83a, GOLDE = { emissive: 0x7a5600, emissiveIntensity: 0.7 };
function pistolBody(g, ox, acc, emi) {
  const slide = 0xc7ccd4, frame = 0x8a909b, dark = 0x2b2f38;
  bx(g, 0.062, 0.078, 0.3, slide, ox, 0.02, -0.14); bx(g, 0.056, 0.05, 0.27, frame, ox, -0.035, -0.13); cyl(g, 0.016, 0.06, dark, ox, 0.02, -0.31);
  bx(g, 0.05, 0.026, 0.05, dark, ox, 0.07, 0.0); bx(g, 0.012, 0.02, 0.02, dark, ox, 0.075, -0.28); bx(g, 0.064, 0.02, 0.24, acc, ox, 0.063, -0.14, emi);
  const gr = bx(g, 0.058, 0.17, 0.085, dark, ox, -0.12, 0.03); gr.rotation.x = 0.2;
  for (const s of [-1, 1]) { const p = bx(g, 0.012, 0.145, 0.07, GOLD, ox + s * 0.034, -0.12, 0.03, GOLDE); p.rotation.x = 0.2; bx(g, 0.014, 0.05, 0.03, 0xfff0a0, ox + s * 0.036, -0.1, 0.03, { emissive: 0xffd23a, emissiveIntensity: 0.6 }).rotation.x = 0.2; }
  bx(g, 0.012, 0.05, 0.1, dark, ox, -0.075, -0.03);
}
G.weaponModel = function (id, rarHex) {
  const g = new T.Group(); const dark = 0x2b2f38, mid = 0x454b57, acc = rarHex || 0xffffff; const emi = { emissive: acc, emissiveIntensity: 0.55 };
  if (id === 'pistol') pistolBody(g, 0, acc, emi);
  else if (id === 'dual') { pistolBody(g, -0.085, acc, emi); pistolBody(g, 0.085, acc, emi); }
  else if (id === 'shotgun') { // double barrel: twin steel barrels, wood forend + stock, gold bands
    const steel = 0x6a7280, wood = 0x9a6234, woodD = 0x7a4a26;
    for (const s of [-1, 1]) { cyl(g, 0.03, 0.76, steel, s * 0.032, 0.02, -0.42, null, 0.03, 10); cyl(g, 0.034, 0.03, dark, s * 0.032, 0.02, -0.8, null, 0.034, 10); }
    bx(g, 0.02, 0.014, 0.74, 0xaab2c0, 0, 0.056, -0.42); bx(g, 0.016, 0.014, 0.7, acc, 0, 0.068, -0.42, emi); bx(g, 0.13, 0.025, 0.012, GOLD, 0, 0.02, -0.66, GOLDE);
    bx(g, 0.115, 0.1, 0.17, dark, 0, 0, -0.02); bx(g, 0.1, 0.07, 0.26, wood, 0, -0.045, -0.36);
    const st = bx(g, 0.09, 0.13, 0.36, wood, 0, -0.045, 0.24); st.rotation.x = -0.12; bx(g, 0.095, 0.15, 0.04, woodD, 0, -0.07, 0.42);
    bx(g, 0.02, 0.07, 0.02, dark, 0, -0.08, -0.03); bx(g, 0.03, 0.03, 0.12, GOLD, 0, -0.01, 0.1, GOLDE); }
  else if (id === 'ar') { // tan SCAR-style rifle
    const tan = 0xc9a46a, tanD = 0xa98450, blk = 0x23262c;
    bx(g, 0.092, 0.13, 0.46, tan, 0, 0, -0.14); bx(g, 0.072, 0.04, 0.6, tanD, 0, 0.085, -0.22); bx(g, 0.088, 0.1, 0.3, tan, 0, -0.005, -0.58); bx(g, 0.07, 0.025, 0.28, blk, 0, 0.06, -0.58);
    cyl(g, 0.018, 0.3, blk, 0, 0.02, -0.88); cyl(g, 0.03, 0.07, blk, 0, 0.02, -1.03, null, 0.03, 6);
    const stk = bx(g, 0.08, 0.14, 0.32, tan, 0, -0.02, 0.32); stk.rotation.x = 0.04; bx(g, 0.085, 0.16, 0.04, blk, 0, -0.02, 0.5);
    const m1 = bx(g, 0.06, 0.2, 0.09, blk, 0, -0.17, -0.12); m1.rotation.x = 0.25; const gr = bx(g, 0.065, 0.16, 0.08, blk, 0, -0.14, 0.1); gr.rotation.x = 0.35;
    bx(g, 0.05, 0.05, 0.12, blk, 0, 0.13, -0.3); bx(g, 0.04, 0.03, 0.05, 0xff3a3a, 0, 0.165, -0.3, { emissive: 0xff2020, emissiveIntensity: 0.8 }); bx(g, 0.03, 0.05, 0.03, blk, 0, 0.12, 0.05);
    bx(g, 0.094, 0.022, 0.42, acc, 0, 0.1, -0.1, emi); }
  else if (id === 'smg') { // micro-SMG: boxy receiver, stick mag, wire stock
    const blk = 0x1d2026, gm = 0x363b46;
    bx(g, 0.082, 0.115, 0.3, blk, 0, 0, -0.1); bx(g, 0.07, 0.03, 0.3, gm, 0, 0.072, -0.1); cyl(g, 0.02, 0.26, gm, 0, 0.015, -0.36); cyl(g, 0.026, 0.06, blk, 0, 0.015, -0.5, null, 0.026, 6);
    bx(g, 0.052, 0.32, 0.06, blk, 0, -0.2, -0.05); bx(g, 0.054, 0.02, 0.07, acc, 0, -0.36, -0.05, emi);
    const gr = bx(g, 0.06, 0.14, 0.075, blk, 0, -0.105, 0.08); gr.rotation.x = 0.25;
    for (const s of [-1, 1]) { bx(g, 0.012, 0.012, 0.22, 0x9aa1ad, s * 0.03, 0.02, 0.22); } bx(g, 0.07, 0.06, 0.012, 0x9aa1ad, 0, 0.02, 0.33);
    bx(g, 0.03, 0.045, 0.04, blk, 0, 0.1, -0.2); bx(g, 0.03, 0.04, 0.03, blk, 0, 0.1, 0.02); bx(g, 0.084, 0.02, 0.28, acc, 0, 0.088, -0.1, emi); }
  else if (id === 'sniper') { bx(g, 0.075, 0.1, 0.85, mid, 0, 0, -0.28); bx(g, 0.04, 0.04, 0.55, dark, 0, 0.01, -0.95); const sc = new T.Mesh(new T.CylinderGeometry(0.045, 0.045, 0.34, 8), G.mat(dark)); sc.rotation.x = Math.PI / 2; sc.position.set(0, 0.12, -0.25); g.add(sc); bx(g, 0.05, 0.05, 0.04, 0x6ad0ff, 0, 0.12, -0.44, { emissive: 0x6ad0ff }); bx(g, 0.09, 0.14, 0.32, 0x39414d, 0, -0.02, 0.4); bx(g, 0.078, 0.025, 0.7, acc, 0, 0.06, -0.3, emi); bx(g, 0.06, 0.12, 0.07, dark, 0, -0.1, 0.02); }
  else if (id === 'rocket') { // orange cannon launcher
    const og = 0xff7a1a, ogD = 0xd85a08, steel = 0x59606c;
    cyl(g, 0.15, 0.82, og, 0, 0.04, -0.28, null, 0.15, 12); cyl(g, 0.19, 0.16, ogD, 0, 0.04, -0.72, null, 0.19, 12); cyl(g, 0.15, 0.04, 0x15181d, 0, 0.04, -0.8, null, 0.15, 12);
    for (const z of [-0.5, -0.1]) cyl(g, 0.156, 0.07, steel, 0, 0.04, z, null, 0.156, 12); cyl(g, 0.193, 0.04, acc, 0, 0.04, -0.62, emi, 0.193, 12);
    cyl(g, 0.16, 0.2, steel, 0, 0.04, 0.22, null, 0.1, 12); cyl(g, 0.1, 0.08, 0x15181d, 0, 0.04, 0.34, null, 0.1, 10);
    bx(g, 0.05, 0.1, 0.4, 0xffb040, 0, 0.22, -0.3); bx(g, 0.07, 0.14, 0.08, 0x23262c, 0, -0.14, 0.02); bx(g, 0.06, 0.1, 0.07, 0x23262c, 0, -0.1, -0.4);
    bx(g, 0.012, 0.1, 0.5, 0xffd24a, 0.152, 0.04, -0.28, { emissive: 0xffa010, emissiveIntensity: 0.5 }); }
  g.scale.setScalar(1.15); return g;
};
G.pickaxeModel = function (kind) {
  const g = new T.Group(); const wood = 0x8a5a33, steel = 0x9aa5b4, steelD = 0x6a7482; kind = kind || 'pick';
  if (kind === 'axe') { bx(g, 0.05, 0.05, 1.0, wood, 0, 0, -0.32); bx(g, 0.05, 0.05, 0.1, 0xffc83a, 0, 0, 0.18, GOLDE);
    bx(g, 0.07, 0.16, 0.2, steelD, 0, 0, -0.78); const bl = bx(g, 0.035, 0.34, 0.26, steel, 0, -0.17, -0.8); bl.rotation.x = 0; bx(g, 0.04, 0.3, 0.04, 0xe6f0ff, 0, -0.17, -0.93, { emissive: 0x6aa0ff, emissiveIntensity: 0.5 }); bx(g, 0.06, 0.08, 0.12, steelD, 0, 0.08, -0.74); }
  else if (kind === 'shovel') { bx(g, 0.045, 0.045, 1.0, wood, 0, 0, -0.32); bx(g, 0.2, 0.04, 0.04, wood, 0, 0, 0.2); bx(g, 0.1, 0.04, 0.14, steelD, 0, 0, -0.82); const bl = bx(g, 0.24, 0.025, 0.34, steel, 0, 0, -1.0); bx(g, 0.04, 0.03, 0.3, 0xffc83a, 0, 0.02, -1.0, GOLDE); bl.rotation.z = 0; }
  else if (kind === 'sickle') { bx(g, 0.045, 0.045, 1.0, 0x3a3340, 0, 0, -0.32); bx(g, 0.07, 0.07, 0.1, 0xb45cff, 0, 0, 0.18, { emissive: 0x7a2cc0, emissiveIntensity: 0.6 });
    const tor = new T.Mesh(new T.TorusGeometry(0.3, 0.028, 5, 16, Math.PI * 1.15), G.mat(0xcfd6e2, { emissive: 0x4a5a80, emissiveIntensity: 0.4 })); tor.rotation.y = Math.PI / 2; tor.rotation.z = 0; tor.position.set(0, -0.28, -0.78); tor.castShadow = true; g.add(tor); bx(g, 0.06, 0.06, 0.1, steelD, 0, 0, -0.74); }
  else if (kind === 'hammer') { bx(g, 0.055, 0.055, 0.98, wood, 0, 0, -0.3); bx(g, 0.05, 0.05, 0.1, 0xffc83a, 0, 0, 0.2, GOLDE); bx(g, 0.3, 0.17, 0.17, steel, 0, 0, -0.82); for (const s of [-1, 1]) { bx(g, 0.05, 0.2, 0.2, 0xffc83a, s * 0.17, 0, -0.82, GOLDE); } bx(g, 0.08, 0.1, 0.1, steelD, 0, 0, -0.72); }
  else { bx(g, 0.05, 0.05, 0.9, wood, 0, 0, -0.35); bx(g, 0.5, 0.07, 0.08, steel, 0, 0, -0.78); bx(g, 0.07, 0.09, 0.14, 0xff6b3a, 0.26, 0, -0.78); bx(g, 0.07, 0.09, 0.14, 0xff6b3a, -0.26, 0, -0.78); }
  return g;
};
G.gadgetModel = function (id) {
  const g = new T.Group();
  if (id === 'tnt') { for (const [x, z] of [[-0.06, 0], [0.06, 0], [0, 0.09]]) { const c = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.34, 10), G.mat(0xe8302a, { emissive: 0x5a0a08, emissiveIntensity: 0.5 })); c.position.set(x, 0, z - 0.03); c.castShadow = true; g.add(c); bx(g, 0.002, 0.002, 0.002, 0xffffff, x, 0.17, z); }
    for (const y of [-0.09, 0.09]) { const b = new T.Mesh(new T.CylinderGeometry(0.115, 0.115, 0.045, 10), G.mat(0x3a3f4a)); b.position.set(0, y, 0.0); g.add(b); }
    const f = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.18, 4), G.mat(0x222222)); f.position.set(0, 0.26, 0); f.rotation.z = 0.5; g.add(f); const sp = new T.Mesh(new T.SphereGeometry(0.03, 6, 5), new T.MeshBasicMaterial({ color: 0xffb030 })); sp.position.set(0.045, 0.34, 0); g.add(sp); g.userData.spark = sp; }
  else if (id === 'launchpad') { g.add(G.makeTrapMesh('launchpad')); g.children[0].scale.setScalar(0.22); }
  else { g.add(G.makeTrapMesh('spike')); g.children[0].scale.setScalar(0.22); }
  return g;
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
  const pick = G.pickaxeModel(skin.pick); pick.position.set(0, -0.66, 0); pick.rotation.x = Math.PI / 2; arms[1].add(pick); pick.visible = false;
  const flash = new T.Mesh(new T.SphereGeometry(0.12, 6, 5), new T.MeshBasicMaterial({ color: 0xffe9a0 })); flash.visible = false; gun.add(flash);
  const glider = G.makeGlider(skin.acc); glider.visible = false; root.add(glider);
  const o = { root, lean, m, legs, arms, head, gun, pick, flash, glider, held: null, heldKey: '' };
  o.setHeld = function (kind, w, rar) {
    const key = kind + (w || '') + (rar === undefined ? '' : rar); if (key === o.heldKey) return; o.heldKey = key;
    if (o.held) { gun.remove(o.held); o.held = null; } pick.visible = kind === 'pickaxe';
    if (kind === 'weapon') { const wm = G.weaponModel(w, G.RARITY[rar].hex); wm.position.set(0, -0.02, -0.08); wm.scale.multiplyScalar(w === 'dual' ? 1.45 : 1.15); gun.add(wm); o.held = wm; }
    else if (kind === 'gadget') { const wm = G.gadgetModel(w); wm.position.set(0, -0.1, -0.25); wm.scale.setScalar(1.4); gun.add(wm); o.held = wm; }
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

/* ---------- chest (two styles: 'wood' gold-trim, 'metal' blue metallic) ---------- */
G.makeChest = function (style, rar) {
  style = style || 'wood'; rar = rar === undefined ? 1 : rar; const rc = G.RARITY[rar].hex;
  const g = new T.Group(); const body = new T.Group(); g.add(body); const lid = new T.Group(); lid.position.set(0, 0.55, -0.35); g.add(lid);
  if (style === 'metal') {
    const frame = 0x5a4a3c, frameD = 0x3e342b, blue = { emissive: 0x1a5cd0, emissiveIntensity: 0.75 };
    bx(body, 1.1, 0.5, 0.7, frameD, 0, 0.25, 0); for (const sx of [-0.3, 0.3]) bx(body, 0.34, 0.4, 0.72, 0x3d8cff, sx, 0.27, 0, blue);
    for (const sx of [-0.52, 0, 0.52]) bx(body, 0.1, 0.56, 0.76, frame, sx, 0.28, 0); bx(body, 1.14, 0.08, 0.76, frame, 0, 0.04, 0); bx(body, 0.2, 0.2, 0.06, 0xb08a52, 0, 0.34, 0.37); bx(body, 0.08, 0.08, 0.08, rc, 0, 0.34, 0.4, { emissive: rc, emissiveIntensity: 0.9 });
    for (const sx of [-0.52, 0.52]) for (const sz of [-0.3, 0.3]) bx(body, 0.12, 0.1, 0.12, 0x2a241e, sx, -0.02, sz);
    bx(lid, 1.1, 0.14, 0.7, frameD, 0, 0.07, 0.35); for (const sx of [-0.3, 0.3]) bx(lid, 0.34, 0.26, 0.64, 0x3d8cff, sx, 0.15, 0.35, blue);
    for (const sx of [-0.52, 0, 0.52]) bx(lid, 0.1, 0.3, 0.74, frame, sx, 0.14, 0.35); bx(lid, 1.12, 0.05, 0.72, frame, 0, 0.29, 0.35);
  } else {
    const wood = 0x7a4a2a, gold = 0xffc83a, ge = { emissive: 0xaa7a10, emissiveIntensity: 0.6 };
    bx(body, 1.1, 0.55, 0.7, wood, 0, 0.275, 0); for (const sx of [-0.5, 0.5]) bx(body, 0.1, 0.57, 0.72, gold, sx, 0.28, 0, ge); bx(body, 0.18, 0.18, 0.04, gold, 0, 0.45, 0.36, ge); bx(body, 0.06, 0.06, 0.05, rc, 0, 0.45, 0.39, { emissive: rc, emissiveIntensity: 0.9 });
    bx(lid, 1.1, 0.3, 0.7, 0x8a5430, 0, 0.12, 0.35); for (const sx of [-0.5, 0.5]) bx(lid, 0.1, 0.32, 0.72, gold, sx, 0.13, 0.35, ge);
  }
  const beam = new T.Mesh(new T.CylinderGeometry(0.28, 0.5, 9, 8, 1, true), new T.MeshBasicMaterial({ color: rc, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); beam.position.y = 4.6; g.add(beam);
  const light = new T.Mesh(new T.CircleGeometry(1.0, 16), new T.MeshBasicMaterial({ color: rc, transparent: true, opacity: 0.38, blending: T.AdditiveBlending, depthWrite: false })); light.rotation.x = -Math.PI / 2; light.position.y = 0.05; g.add(light); beam.add(light); light.position.y = -4.5;
  g.userData = { body, lid, beam }; return g;
};

/* ---------- pickups visuals ---------- */
const iconCache = {};
function flask(g, s, liquid, glass, o) { // round potion flask with cork and bubbles
  const gl = new T.Mesh(new T.SphereGeometry(0.2 * s, 14, 10), new T.MeshLambertMaterial({ color: glass, emissive: glass, emissiveIntensity: 0.18, transparent: true, opacity: 0.45 })); gl.scale.y = 0.92; g.add(gl);
  const lq = new T.Mesh(new T.SphereGeometry(0.17 * s, 14, 10, 0, 6.3, 0.6, 2.5), new T.MeshLambertMaterial({ color: liquid, emissive: liquid, emissiveIntensity: 0.55 })); g.add(lq);
  const sf = new T.Mesh(new T.CircleGeometry(0.1 * s, 12), new T.MeshLambertMaterial({ color: 0xcdf3ff, emissive: 0x9fe0ff, emissiveIntensity: 0.5 })); sf.rotation.x = -Math.PI / 2; sf.position.y = 0.09 * s; g.add(sf);
  const nk = new T.Mesh(new T.CylinderGeometry(0.06 * s, 0.075 * s, 0.17 * s, 8), new T.MeshLambertMaterial({ color: glass, transparent: true, opacity: 0.55 })); nk.position.y = 0.23 * s; g.add(nk);
  const rim = new T.Mesh(new T.CylinderGeometry(0.075 * s, 0.075 * s, 0.025 * s, 8), G.mat(0xdff4ff)); rim.position.y = 0.32 * s; g.add(rim);
  const ck = new T.Mesh(new T.CylinderGeometry(0.055 * s, 0.045 * s, 0.1 * s, 8), G.mat(0xb07a42)); ck.position.y = 0.38 * s; g.add(ck);
  for (const [x, y, z, r] of [[-0.05, -0.02, 0.15, 0.02], [0.06, 0.05, 0.14, 0.015], [0.0, 0.1, 0.12, 0.012], [-0.07, 0.07, 0.12, 0.012]]) { const b = new T.Mesh(new T.SphereGeometry(r * s, 5, 4), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); b.position.set(x * s, y * s, z * s); g.add(b); }
  g.position.y = 0.1;
}
G.makeHealModel = function (id) {
  const g = new T.Group();
  if (id === 'bandage') { const r = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.18, 12), G.mat(0xf4f4f4)); g.add(r); bx(g, 0.1, 0.19, 0.28, 0xff4d4d, 0, 0, 0.05); }
  else if (id === 'medkit') { // white/grey box, red lid with white cross plate, black strap + latch
    bx(g, 0.56, 0.2, 0.36, 0xc9ced6, 0, -0.07, 0); bx(g, 0.58, 0.15, 0.38, 0xe6322a, 0, 0.08, 0); bx(g, 0.2, 0.03, 0.08, 0xffffff, 0, 0.165, 0); bx(g, 0.08, 0.03, 0.2, 0xffffff, 0, 0.165, 0);
    bx(g, 0.6, 0.035, 0.4, 0x23262c, 0, 0.0, 0); bx(g, 0.1, 0.12, 0.04, 0xaab2bd, -0.2, -0.02, 0.2); bx(g, 0.24, 0.07, 0.03, 0xffffff, 0, -0.07, 0.185); g.position.y = 0.1; }
  else if (id === 'chug') { // big canister: metal body, blue caps, glowing green-cyan windows
    const body = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.44, 12), G.mat(0xaab2bd)); body.castShadow = true; g.add(body);
    for (const y of [-0.235, 0.235]) { const c = new T.Mesh(new T.CylinderGeometry(0.215, 0.215, 0.07, 12), G.mat(0x2f86e8, { emissive: 0x0a3a80, emissiveIntensity: 0.6 })); c.position.y = y; g.add(c); }
    const lid = new T.Mesh(new T.CylinderGeometry(0.15, 0.17, 0.05, 12), G.mat(0x3a9aff, { emissive: 0x1a5ac0, emissiveIntensity: 0.6 })); lid.position.y = 0.29; g.add(lid); bx(g, 0.06, 0.04, 0.06, 0xdfe6ee, 0, 0.33, 0);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 0.3; const w = bx(g, 0.15, 0.3, 0.035, 0x3dffc8, Math.sin(a) * 0.205, 0.0, Math.cos(a) * 0.205, { emissive: 0x2dffd0, emissiveIntensity: 1.1 }); w.rotation.y = a; const f = bx(g, 0.17, 0.02, 0.045, 0x6a727e, Math.sin(a) * 0.205, 0.0, Math.cos(a) * 0.205); f.rotation.y = a; }
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 0.3 + Math.PI / 3; const st = bx(g, 0.08, 0.34, 0.03, 0x8a929e, Math.sin(a) * 0.205, 0, Math.cos(a) * 0.205); st.rotation.y = a; }
    const glow = new T.Mesh(new T.SphereGeometry(0.34, 10, 8), new T.MeshBasicMaterial({ color: 0x3dffc8, transparent: true, opacity: 0.14, blending: T.AdditiveBlending, depthWrite: false })); g.add(glow); g.position.y = 0.2; }
  else if (id === 'shield') flask(g, 1.25, 0x2f7bff, 0x9fd0ff);
  else if (id === 'minishield') flask(g, 0.78, 0x4ab0ff, 0xb5e2ff);
  else if (id === 'slurp') { // slim cyan-green bottle with white label band and straw cap
    const bd = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.3, 10), new T.MeshLambertMaterial({ color: 0x9ffcf0, transparent: true, opacity: 0.5, emissive: 0x38e8ff, emissiveIntensity: 0.2 })); g.add(bd);
    const lq = new T.Mesh(new T.CylinderGeometry(0.085, 0.105, 0.26, 10), new T.MeshLambertMaterial({ color: 0x38e8ff, emissive: 0x20d8ff, emissiveIntensity: 0.8 })); lq.position.y = -0.01; g.add(lq);
    const lb = new T.Mesh(new T.CylinderGeometry(0.125, 0.125, 0.09, 10), G.mat(0xffffff, { emissive: 0xaaffee, emissiveIntensity: 0.2 })); lb.position.y = 0.0; g.add(lb);
    const sh = new T.Mesh(new T.ConeGeometry(0.1, 0.1, 10), new T.MeshLambertMaterial({ color: 0x9ffcf0, transparent: true, opacity: 0.55 })); sh.position.y = 0.2; g.add(sh);
    const nk = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.1, 8), G.mat(0xdff4ff)); nk.position.y = 0.3; g.add(nk); bx(g, 0.07, 0.05, 0.07, 0xff6bd0, 0, 0.37, 0); const st = bx(g, 0.016, 0.2, 0.016, 0xff6bd0, 0.02, 0.46, 0); st.rotation.z = -0.3; g.position.y = 0.18; }
  return g;
};
G.pickupIcon = function (item) {
  const key = item.kind === 'weapon' ? 'w' + item.w + item.rarity : item.kind === 'ammo' ? 'a' + item.t : item.kind === 'gadget' ? 'g' + item.id : 'h' + item.id; if (iconCache[key]) return iconCache[key].clone();
  const g = new T.Group();
  if (item.kind === 'weapon') { const w = G.weaponModel(item.w, G.RARITY[item.rarity].hex); w.scale.setScalar(item.w === 'dual' ? 1.5 : 1.7); w.rotation.y = Math.PI / 2; w.position.y = 0.0; g.add(w); }
  else if (item.kind === 'ammo') { const a = G.AMMO[item.t]; bx(g, 0.4, 0.26, 0.28, a.hex, 0, 0, 0, { emissive: a.hex, emissiveIntensity: 0.25 }); bx(g, 0.42, 0.06, 0.3, 0x333333, 0, 0.05, 0); for (let i = 0; i < 3; i++) bx(g, 0.06, 0.2, 0.06, 0xffe39a, -0.1 + i * 0.1, 0.22, 0); }
  else if (item.kind === 'gadget') { const m = G.gadgetModel(item.id); if (item.id !== 'tnt') { m.children[0].scale.setScalar(0.34); } m.position.y = 0.2; g.add(m); }
  else g.add(G.makeHealModel(item.id));
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
