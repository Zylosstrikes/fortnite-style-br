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
G.gadgetModel = function (id) {
  const g = new T.Group();
  if (id === 'tnt') { for (const [x, z] of [[-0.06, 0], [0.06, 0], [0, 0.09]]) { const c = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.34, 10), G.mat(0xe8302a, { emissive: 0x5a0a08, emissiveIntensity: 0.5 })); c.position.set(x, 0, z - 0.03); c.castShadow = true; g.add(c); bx(g, 0.002, 0.002, 0.002, 0xffffff, x, 0.17, z); }
    for (const y of [-0.09, 0.09]) { const b = new T.Mesh(new T.CylinderGeometry(0.115, 0.115, 0.045, 10), G.mat(0x3a3f4a)); b.position.set(0, y, 0.0); g.add(b); }
    const f = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.18, 4), G.mat(0x222222)); f.position.set(0, 0.26, 0); f.rotation.z = 0.5; g.add(f); const sp = new T.Mesh(new T.SphereGeometry(0.03, 6, 5), new T.MeshBasicMaterial({ color: 0xffb030 })); sp.position.set(0.045, 0.34, 0); g.add(sp); g.userData.spark = sp; }
  else if (id === 'launchpad') { g.add(G.makeTrapMesh('launchpad')); g.children[0].scale.setScalar(0.22); }
  else { g.add(G.makeTrapMesh('spike')); g.children[0].scale.setScalar(0.22); }
  return g;
};

G.makeNameplate = function (name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d'); x.font = 'bold 30px Trebuchet MS, Arial'; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.75)'; x.strokeText(name, 128, 34); x.fillStyle = '#fff'; x.fillText(name, 128, 34);
  const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthTest: false })); s.scale.set(2.4, 0.45, 1); s.position.y = 2.5; s.renderOrder = 10; return s;
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
  function tex(draw) { const c = document.createElement('canvas'); c.width = c.height = 256; draw(c.getContext('2d')); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t; }
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  // wood: warm saturated planks with grain, knots and nails
  const wood = tex(x => { const pw = 256 / 5; for (let i = 0; i < 5; i++) { const g = x.createLinearGradient(0, 0, 0, 256); const b = i % 2 ? [201, 134, 66] : [222, 156, 88]; g.addColorStop(0, 'rgb(' + b.join(',') + ')'); g.addColorStop(1, 'rgb(' + b.map(v => v - 22).join(',') + ')'); x.fillStyle = g; x.fillRect(i * pw, 0, pw, 256);
      for (let k = 0; k < 14; k++) { x.strokeStyle = 'rgba(110,60,20,' + (0.12 + rnd() * 0.2) + ')'; x.lineWidth = 1 + rnd(); const gx = i * pw + 4 + rnd() * (pw - 8); x.beginPath(); x.moveTo(gx, 0); x.bezierCurveTo(gx + 4, 80, gx - 4, 170, gx + 2, 256); x.stroke(); }
      x.fillStyle = 'rgba(90,45,15,.7)'; x.beginPath(); x.ellipse(i * pw + pw * (0.3 + rnd() * 0.4), 40 + rnd() * 180, 5, 8, 0, 0, 6.3); x.fill(); x.fillStyle = '#6a3a14'; x.fillRect(i * pw, 0, 3, 256);
      for (const yy of [14, 242]) { x.fillStyle = '#4a3320'; x.beginPath(); x.arc(i * pw + pw / 2, yy, 3, 0, 6.3); x.fill(); x.fillStyle = '#c9c9c9'; x.fillRect(i * pw + pw / 2 - 1, yy - 1, 1.5, 1.5); } } });
  // brick (stone tier): saturated red bricks with pale mortar
  const stone = tex(x => { x.fillStyle = '#d9d2c4'; x.fillRect(0, 0, 256, 256); const bh = 256 / 8, bw = 256 / 4; for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { const off = r % 2 ? bw / 2 : 0; const px = c * bw + off + 3, py = r * bh + 3; const v = rnd() * 28; x.fillStyle = 'rgb(' + (196 - v | 0) + ',' + (88 - v * 0.5 | 0) + ',' + (66 - v * 0.4 | 0) + ')'; x.fillRect(px, py, bw - 6, bh - 6); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(px, py, bw - 6, 4); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(px, py + bh - 10, bw - 6, 4); for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(60,20,10,.15)'; x.fillRect(px + rnd() * (bw - 10), py + rnd() * (bh - 10), 3, 2); } } });
  // metal: blue corrugated plates with rivets and a bevelled frame
  const metal = tex(x => { x.fillStyle = '#7fb6e0'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 16; i++) { const g = x.createLinearGradient(i * 16, 0, i * 16 + 16, 0); g.addColorStop(0, '#a6d4f2'); g.addColorStop(0.5, '#7fb6e0'); g.addColorStop(1, '#5f98c4'); x.fillStyle = g; x.fillRect(i * 16, 0, 16, 256); }
    x.strokeStyle = '#3f6f98'; x.lineWidth = 8; x.strokeRect(4, 4, 248, 248); x.strokeStyle = '#d6efff'; x.lineWidth = 2; x.strokeRect(10, 10, 236, 236); x.strokeStyle = 'rgba(40,80,120,.5)'; x.lineWidth = 5; x.beginPath(); x.moveTo(10, 10); x.lineTo(246, 246); x.moveTo(246, 10); x.lineTo(10, 246); x.stroke();
    for (const [a, b] of [[22, 22], [234, 22], [22, 234], [234, 234], [128, 22], [128, 234], [22, 128], [234, 128]]) { x.fillStyle = '#2f5a80'; x.beginPath(); x.arc(a, b, 6, 0, 6.3); x.fill(); x.fillStyle = '#cfe9ff'; x.beginPath(); x.arc(a - 1.5, b - 1.5, 2.5, 0, 6.3); x.fill(); } });
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
