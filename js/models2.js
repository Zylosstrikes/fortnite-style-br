'use strict';
/* Extra procedural models: bush, victory crown, supply llama, armored truck, rift, campfire + Ember mascot, traps, icon renderer.
   Everything here is original, generated from primitives / canvas textures at runtime (no external art). */
(function () {
const G = window.G, T = THREE, bx = G.bx, cyl = G.cyl;

/* ---------- icon renderer (offscreen 2nd renderer -> dataURL) ---------- */
let ir = null, iscene = null, icam = null;
G.renderIcon = function (obj, size, rotY, rotX) {
  try {
    size = size || 96;
    if (!ir) {
      ir = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); ir.setClearColor(0x000000, 0); iscene = new T.Scene();
      iscene.add(new T.HemisphereLight(0xffffff, 0x8899aa, 0.95)); const dl = new T.DirectionalLight(0xffffff, 0.9); dl.position.set(2, 3, 4); iscene.add(dl);
      icam = new T.PerspectiveCamera(30, 1, 0.05, 50);
    }
    ir.setSize(size, size, false);
    const holder = new T.Group(); const o = obj.clone(); holder.add(o); holder.rotation.set(rotX === undefined ? 0.25 : rotX, rotY === undefined ? -0.6 : rotY, 0); iscene.add(holder); holder.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(holder), c = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3()); const r = Math.max(sz.x, sz.y, sz.z) * 0.62 + 0.001;
    icam.position.set(c.x, c.y + r * 0.1, c.z + r / Math.tan(15 * Math.PI / 180)); icam.lookAt(c); icam.updateProjectionMatrix();
    ir.render(iscene, icam); const url = ir.domElement.toDataURL('image/png'); iscene.remove(holder); return url;
  } catch (e) { return null; }
};
const iconURLs = {};
G.itemIconURL = function (s) { // s: inventory slot or item
  if (!s) return null; let key, build;
  if (s.type === 'weapon' || s.kind === 'weapon') { key = 'w' + s.w + s.rarity; build = () => G.weaponModel(s.w, G.RARITY[s.rarity].hex); }
  else if (s.type === 'heal' || s.kind === 'heal') { key = 'h' + s.id; build = () => G.makeHealModel(s.id); }
  else if (s.type === 'gadget' || s.kind === 'gadget') { key = 'g' + s.id; build = () => G.gadgetModel(s.id); }
  else if (s.type === 'pickaxe') { key = 'p' + (s.pick || 'pick'); build = () => G.pickaxeModel(s.pick); }
  else return null;
  if (!(key in iconURLs)) { const m = build(); iconURLs[key] = G.renderIcon(m, 96, (s.type === 'pickaxe' ? 1.1 : (s.w ? 1.2 : -0.5)), (s.type === 'pickaxe' ? 0.5 : 0.3)); }
  return iconURLs[key];
};

/* ---------- bush ---------- */
const bushGeos = [];
function bushGeo(seed) {
  const rng = G.seeded(seed); const pos = [], col = []; const c = new T.Color(); const m4 = new T.Matrix4(), v = new T.Vector3();
  const n = 11;
  for (let k = 0; k < n; k++) {
    let g = new T.IcosahedronGeometry(1, 1); const a = rng() * 6.283, r = k === 0 ? 0 : 0.35 + rng() * 0.75, s = 0.55 + rng() * 0.45 - r * 0.12;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 0.45 + (1 - r) * 0.35 + rng() * 0.15;
    const p = g.attributes.position; const base = 0x3f9a34 + Math.floor(rng() * 3) * 0x0a0f05;
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)); const j = 0.82 + rng() * 0.0; // facet jitter per vertex hash
      const h = Math.sin(v.x * 12.9 + v.y * 78.2 + v.z * 37.7 + k) * 0.5 + 0.5; v.multiplyScalar(0.86 + h * 0.3);
      v.x = v.x * s * 1.15 + cx; v.y = Math.max(0.02, v.y * s * 0.82 + cy); v.z = v.z * s * 1.15 + cz;
      pos.push(v.x, v.y, v.z); const t = G.clamp(v.y / 1.3, 0, 1); c.setHex(base); const lite = new T.Color(0x9bf05a); c.lerp(lite, t * 0.75 * (0.6 + h * 0.5)); col.push(c.r, c.g, c.b);
    }
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(col, 3)); geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo;
}
G.makeBush = function (variant) {
  if (!bushGeos.length) for (let i = 0; i < 3; i++) bushGeos.push(bushGeo(900 + i * 37));
  const mat = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide, transparent: false, opacity: 1 });
  const m = new T.Mesh(bushGeos[(variant || 0) % 3], mat); m.castShadow = true; m.receiveShadow = false; return m;
};

/* ---------- Victory Crown (original: spiked gold ring + stylised llama-head crest) ---------- */
const goldMat = () => new T.MeshPhongMaterial({ color: 0xffc83a, emissive: 0x5a3c00, shininess: 90, specular: 0xfff2b0 });
G.makeCrown = function () {
  const g = new T.Group(); const gm = goldMat();
  const ring = new T.Mesh(new T.CylinderGeometry(0.5, 0.46, 0.14, 24, 1, true), gm); ring.material.side = T.DoubleSide; g.add(ring);
  const rim = new T.Mesh(new T.TorusGeometry(0.48, 0.03, 6, 24), gm); rim.rotation.x = Math.PI / 2; rim.position.y = -0.07; g.add(rim); const rim2 = rim.clone(); rim2.position.y = 0.07; g.add(rim2);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const h = i % 3 === 0 ? 0.42 : 0.3; const sp = new T.Mesh(new T.ConeGeometry(0.075, h, 5), gm); sp.position.set(Math.cos(a) * 0.5, 0.07 + h / 2, Math.sin(a) * 0.5); sp.rotation.z = -Math.cos(a) * 0.18; sp.rotation.x = Math.sin(a) * 0.18; g.add(sp); }
  // llama head crest at the front (-z)
  const head = new T.Group(); head.position.set(0, 0.07, -0.42); g.add(head); const B = (w, h, d, x, y, z, m) => { const q = new T.Mesh(new T.BoxGeometry(w, h, d), m || gm); q.position.set(x, y, z); head.add(q); return q; };
  const neck = B(0.12, 0.34, 0.12, 0, 0.17, 0.0); neck.rotation.x = 0.25; B(0.15, 0.13, 0.2, 0, 0.38, -0.08); B(0.09, 0.085, 0.1, 0, 0.35, -0.2); B(0.11, 0.04, 0.05, 0, 0.4, -0.26, new T.MeshPhongMaterial({ color: 0xffe27a, shininess: 80 }));
  for (const s of [-1, 1]) { const e = new T.Mesh(new T.ConeGeometry(0.035, 0.16, 4), gm); e.position.set(s * 0.055, 0.5, -0.04); e.rotation.z = -s * 0.15; head.add(e); B(0.02, 0.025, 0.02, s * 0.078, 0.41, -0.15, new T.MeshBasicMaterial({ color: 0x3a2400 })); }
  B(0.1, 0.1, 0.1, 0, 0.1, 0.08);
  g.traverse(o => { if (o.isMesh) o.castShadow = false; }); return g;
};

/* ---------- supply llama (pinata) ---------- */
function stripeTex() { const c = document.createElement('canvas'); c.width = 64; c.height = 16; const x = c.getContext('2d'); const cols = ['#ff5fb0', '#3fd0ff', '#ffe03a', '#7dff5a']; for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % 4]; x.fillRect(i * 8, 0, 8, 16); } const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; }
G.makeLlama = function () {
  const g = new T.Group(); const body = new T.Group(); g.add(body);
  const gold = 0xffc83a, gold2 = 0xffa81f, pink = 0xff5fb0, cyan = 0x3fd0ff; const em = { emissive: 0x6a4300, emissiveIntensity: 0.4 };
  bx(body, 0.95, 0.85, 1.5, gold, 0, 1.15, 0, em); bx(body, 0.97, 0.18, 1.52, pink, 0, 1.0, 0); bx(body, 0.97, 0.12, 1.52, cyan, 0, 0.75, 0);
  for (const [x, z] of [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.55], [0.3, 0.55]]) { bx(body, 0.2, 0.8, 0.22, gold2, x, 0.4, z, em); bx(body, 0.22, 0.12, 0.26, 0xff5fb0, x, 0.06, z); }
  const neck = bx(body, 0.34, 0.85, 0.34, gold, 0, 1.85, -0.72, em); neck.rotation.x = -0.18; bx(body, 0.4, 0.38, 0.5, gold, 0, 2.38, -0.9, em); bx(body, 0.28, 0.24, 0.26, gold2, 0, 2.28, -1.22, em); bx(body, 0.08, 0.06, 0.04, 0x2a1500, -0.08, 2.3, -1.36); bx(body, 0.08, 0.06, 0.04, 0x2a1500, 0.08, 2.3, -1.36);
  for (const s of [-1, 1]) { const e = bx(body, 0.1, 0.34, 0.1, gold2, s * 0.15, 2.7, -0.8, em); e.rotation.z = -s * 0.2; bx(body, 0.07, 0.07, 0.04, 0x2a1500, s * 0.2, 2.48, -1.12); bx(body, 0.12, 0.04, 0.04, pink, s * 0.1, 2.52, -1.12); }
  bx(body, 0.18, 0.4, 0.16, pink, 0, 2.7, -0.84); bx(body, 0.3, 0.06, 0.04, 0x2a1500, 0, 2.2, -1.36);
  bx(body, 0.1, 0.1, 0.5, pink, 0, 1.2, 0.95).rotation.x = 0.5; bx(body, 0.1, 0.1, 0.36, cyan, 0.12, 1.25, 0.9).rotation.x = 0.35;
  // blanket w/ stripes
  const bl = new T.Mesh(new T.BoxGeometry(1.0, 0.1, 1.0), new T.MeshLambertMaterial({ map: stripeTex() })); bl.position.set(0, 1.62, 0.05); body.add(bl);
  for (const s of [-1, 1]) { const f = new T.Mesh(new T.BoxGeometry(0.06, 0.56, 1.0), new T.MeshLambertMaterial({ map: stripeTex() })); f.position.set(s * 0.5, 1.36, 0.05); body.add(f); }
  // balloon + strings
  const balloon = new T.Group(); const geo = new T.SphereGeometry(2.1, 16, 12); const p = geo.attributes.position, cols = []; const cc = [new T.Color(0xff5fb0), new T.Color(0xffe03a), new T.Color(0x3fd0ff), new T.Color(0xffffff)];
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const k = Math.floor((a + Math.PI) / (Math.PI * 2) * 12) % 4; const c = cc[k]; cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); const bm = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true })); bm.scale.y = 1.2; bm.position.y = 8.2; balloon.add(bm);
  for (const [x, z] of [[-0.4, -0.5], [0.4, -0.5], [-0.4, 0.5], [0.4, 0.5]]) { const l = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 6.6, 3), G.mat(0xeeeeee)); l.position.set(x * 1.6, 4.9, z * 1.6); l.rotation.z = -x * 0.22; l.rotation.x = z * 0.22; balloon.add(l); }
  g.add(balloon);
  const beam = new T.Mesh(new T.CylinderGeometry(0.5, 1.0, 90, 8, 1, true), new T.MeshBasicMaterial({ color: 0xff7ad0, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); beam.position.y = 45; g.add(beam);
  g.userData = { body, balloon, beam }; g.scale.setScalar(1.25); return g;
};

/* ---------- armored supply truck ---------- */
G.makeTruck = function () {
  const g = new T.Group(); const dark = 0x2a2e36, panel = 0x3a404b, gold = 0xffc83a, ge = { emissive: 0x7a5600, emissiveIntensity: 0.7 };
  bx(g, 3.0, 0.6, 15.5, 0x1b1e24, 0, 0.9, 0); // chassis
  // cab (front = -z)
  bx(g, 3.2, 2.5, 3.4, panel, 0, 2.5, -6.0); bx(g, 3.0, 0.9, 1.6, dark, 0, 1.6, -7.6); bx(g, 2.6, 0.9, 0.12, 0x6ad0ff, 0, 3.2, -7.72, { emissive: 0x1a5a8a, emissiveIntensity: 0.6 }); for (const s of [-1, 1]) bx(g, 0.1, 0.8, 1.2, 0x6ad0ff, s * 1.63, 3.2, -5.9, { emissive: 0x1a5a8a, emissiveIntensity: 0.6 });
  bx(g, 3.3, 0.2, 3.5, dark, 0, 3.8, -6.0); bx(g, 3.34, 0.18, 3.5, gold, 0, 2.0, -6.0, ge); bx(g, 0.5, 0.3, 0.1, 0xfff3a0, -1.0, 1.7, -7.76, { emissive: 0xfff3a0 }); bx(g, 0.5, 0.3, 0.1, 0xfff3a0, 1.0, 1.7, -7.76, { emissive: 0xfff3a0 });
  for (const s of [-1, 1]) bx(g, 0.1, 1.6, 0.1, 0x9aa1ad, s * 1.8, 4.2, -7.0);
  // trailer
  bx(g, 3.5, 3.7, 9.8, panel, 0, 3.0, 2.8); bx(g, 3.62, 0.3, 9.9, dark, 0, 1.4, 2.8); bx(g, 3.62, 0.25, 9.9, dark, 0, 4.9, 2.8); bx(g, 3.64, 0.22, 9.9, gold, 0, 3.05, 2.8, ge);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) bx(g, 0.1, 3.1, 0.22, dark, s * 1.78, 3.1, -1.4 + i * 2.1);
  for (const s of [-1, 1]) { const d = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 0.12, 20), G.mat(gold, ge)); d.rotation.z = Math.PI / 2; d.position.set(s * 1.82, 3.2, 1.0); g.add(d); bx(g, 0.14, 0.34, 0.34, dark, s * 1.84, 3.2, 1.0).rotation.x = 0.8; }
  // rear doors (pivot at hinges)
  const doors = []; for (const s of [-1, 1]) { const pv = new T.Group(); pv.position.set(s * 1.72, 3.0, 7.72); g.add(pv); bx(pv, 1.64, 3.6, 0.14, 0x4a515e, -s * 0.84, 0, 0); bx(pv, 1.4, 0.12, 0.18, gold, -s * 0.84, 0.3, 0.02, ge); bx(pv, 0.18, 0.5, 0.2, dark, -s * 1.5, 0, 0.06); doors.push({ pv, s }); }
  bx(g, 3.4, 3.4, 0.1, 0x1a1c21, 0, 3.0, 7.6, { emissive: 0x0a1020 });
  for (const z of [-6.0, -3.2, 3.8, 6.2]) for (const s of [-1, 1]) { const w = new T.Mesh(new T.CylinderGeometry(0.85, 0.85, 0.6, 14), G.mat(0x1a1c21)); w.rotation.z = Math.PI / 2; w.position.set(s * 1.6, 0.85, z); w.castShadow = true; g.add(w); const h = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.64, 8), G.mat(gold)); h.rotation.z = Math.PI / 2; h.position.copy(w.position); g.add(h); }
  const beam = new T.Mesh(new T.CylinderGeometry(0.6, 1.0, 14, 8, 1, true), new T.MeshBasicMaterial({ color: 0xc08aff, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); beam.position.set(0, 7, 9.2); g.add(beam);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.userData = { doors, beam }; return g;
};

/* ---------- rift (original glowing crystal shard cluster) ---------- */
G.makeRift = function () {
  const g = new T.Group(); const sh = new T.Group(); g.add(sh); const mat = new T.MeshPhongMaterial({ color: 0xcfd8ff, emissive: 0x6a7cff, emissiveIntensity: 0.85, shininess: 100, transparent: true, opacity: 0.82, flatShading: true });
  const rng = G.seeded(77);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + rng() * 0.4, len = 1.3 + rng() * 1.6; const s = new T.Mesh(new T.OctahedronGeometry(0.5, 0), mat); s.scale.set(0.35 + rng() * 0.2, len, 0.1 + rng() * 0.08); s.position.set(Math.cos(a) * len * 0.5, 0, Math.sin(a) * len * 0.5); s.rotation.set(0, -a, 0); s.rotation.z = Math.PI / 2 + (rng() - 0.5) * 0.5; s.rotateX((rng() - 0.5) * 1.0); sh.add(s); }
  for (let i = 0; i < 4; i++) { const a = rng() * 6.28; const s = new T.Mesh(new T.OctahedronGeometry(0.5, 0), mat); s.scale.set(0.3, 1.0 + rng(), 0.2); s.position.set(Math.cos(a) * 0.5, (rng() - 0.5) * 1.5, Math.sin(a) * 0.5); s.rotation.set(rng() * 3, rng() * 3, rng() * 3); sh.add(s); }
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(180,170,255,.7)'); gr.addColorStop(1, 'rgba(120,80,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const spr = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(cv), blending: T.AdditiveBlending, depthWrite: false, transparent: true })); spr.scale.set(6, 6, 1); g.add(spr);
  const beam = new T.Mesh(new T.CylinderGeometry(0.4, 1.2, 60, 8, 1, true), new T.MeshBasicMaterial({ color: 0x9a8cff, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); beam.position.y = 30; g.add(beam);
  const ring = new T.Mesh(new T.RingGeometry(1.6, 2.1, 28), new T.MeshBasicMaterial({ color: 0xbfb2ff, transparent: true, opacity: 0.6, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = -1.3; g.add(ring);
  g.userData = { sh, spr, ring, beam }; return g;
};

/* ---------- campfire + Ember mascot (original) ---------- */
G.makeCampfire = function () {
  const g = new T.Group();
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const l = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 1.1, 6), G.mat(0x6b4426)); l.position.set(Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3); l.rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0); l.castShadow = true; g.add(l); }
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; bx(g, 0.34, 0.22, 0.3, i % 2 ? 0x8f949e : 0x777c86, Math.cos(a) * 1.05, 0.1, Math.sin(a) * 1.05).rotation.y = a; }
  const flames = [], fm = [0xff6a1a, 0xffa628, 0xffe14a]; for (let i = 0; i < 3; i++) { const f = new T.Mesh(new T.ConeGeometry(0.42 - i * 0.1, 1.5 - i * 0.3, 7), new T.MeshBasicMaterial({ color: fm[i], transparent: true, opacity: 0.92 - i * 0.05 })); f.position.y = 0.75 - i * 0.05; g.add(f); flames.push(f); }
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,200,90,.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const glow = new T.Mesh(new T.CircleGeometry(3.2, 20), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, blending: T.AdditiveBlending, depthWrite: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; g.add(glow);
  g.userData = { flames, glow }; return g;
};
G.makeEmber = function () {
  const g = new T.Group(); const body = new T.Group(); g.add(body); const orange = 0xff8a2a, em = { emissive: 0xff5a00, emissiveIntensity: 0.75 };
  bx(body, 0.7, 0.8, 0.5, orange, 0, 0.6, 0, em); bx(body, 0.6, 0.12, 0.44, 0xffb040, 0, 1.02, 0, em); bx(body, 0.22, 0.3, 0.26, orange, -0.2, 0.15, 0, em); bx(body, 0.22, 0.3, 0.26, orange, 0.2, 0.15, 0, em);
  for (const s of [-1, 1]) { bx(body, 0.16, 0.34, 0.2, orange, s * 0.44, 0.62, 0, em).rotation.z = -s * 0.25; bx(body, 0.12, 0.05, 0.04, 0x3a1500, s * 0.17, 0.78, -0.26).rotation.z = s * 0.35; bx(body, 0.07, 0.1, 0.04, 0x1a0a00, s * 0.17, 0.68, -0.26); }
  bx(body, 0.18, 0.04, 0.04, 0x3a1500, 0, 0.5, -0.26); const em2 = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, 12), new T.MeshBasicMaterial({ color: 0xffe14a })); em2.rotation.x = Math.PI / 2; em2.position.set(0, 0.3, -0.26); body.add(em2);
  const fl = []; for (let i = 0; i < 3; i++) { const f = new T.Mesh(new T.ConeGeometry(0.16 - i * 0.03, 0.6 - i * 0.12, 6), new T.MeshBasicMaterial({ color: [0xff6a1a, 0xffa628, 0xffe14a][i], transparent: true, opacity: 0.9 })); f.position.set((i - 1) * 0.09, 1.28 + i * 0.03, 0); body.add(f); fl.push(f); }
  g.userData = { body, fl }; g.scale.setScalar(1.05); return g;
};

/* ---------- traps ---------- */
function chevronTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#6f6a58'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#857f69'; x.fillRect(6, 6, 116, 116);
  x.strokeStyle = '#ffd23a'; x.lineWidth = 12; x.lineCap = 'round'; x.lineJoin = 'round'; for (let i = 0; i < 3; i++) { const y = 30 + i * 32; x.beginPath(); x.moveTo(26, y + 20); x.lineTo(64, y - 6); x.lineTo(102, y + 20); x.stroke(); }
  x.strokeStyle = '#4a4638'; x.lineWidth = 4; x.strokeRect(3, 3, 122, 122); const t = new T.CanvasTexture(c); return t; }
G.makeTrapMesh = function (id) {
  const g = new T.Group();
  if (id === 'launchpad') { const top = new T.MeshLambertMaterial({ map: chevronTex(), emissive: 0x403000, emissiveIntensity: 0.4 }); const side = G.mat(0x58533f);
    const m = new T.Mesh(new T.BoxGeometry(2.2, 0.16, 2.2), [side, side, top, side, side, side]); m.position.y = 0.08; m.castShadow = true; g.add(m); bx(g, 2.3, 0.06, 2.3, 0x3d3a2c, 0, 0.03, 0);
    const gl = new T.Mesh(new T.PlaneGeometry(2.6, 2.6), new T.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.18, blending: T.AdditiveBlending, depthWrite: false })); gl.rotation.x = -Math.PI / 2; gl.position.y = 0.18; g.add(gl); g.userData.glow = gl; }
  else { bx(g, 2.0, 0.1, 2.0, 0x4a4f5a, 0, 0.05, 0); const sm = G.mat(0xdfe3ea, { emissive: 0x303540, emissiveIntensity: 0.5 }); for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const c = new T.Mesh(new T.ConeGeometry(0.1, 0.55 - ((i + j) % 2) * 0.1, 5), sm); c.position.set(-0.8 + i * 0.4, 0.38, -0.8 + j * 0.4); c.castShadow = true; g.add(c); } bx(g, 2.1, 0.12, 0.12, 0xe6322a, 0, 0.1, 1.0); bx(g, 2.1, 0.12, 0.12, 0xe6322a, 0, 0.1, -1.0); }
  return g;
};
})();
