'use strict';
/* glTF model pipeline.
   Models are authored in Blender (see blender/*.py, built headless with `blender -b --python blender/build_all.py`) and exported to
   assets/models/*.glb. This file loads them with GLTFLoader, bakes them into the same merged vertex-coloured geometry the procedural
   builders produce (few draw calls, outline hulls, role recolouring for outfits/rarity/glider tint), and wraps the procedural model
   factories so that ANY missing / broken .glb silently falls back to the original procedural model.
   Drop your own Blender models in place of the files in assets/models/ — contract: assets/models/README.md. `?noassets` disables loading. */
(function () {
const G = window.G, T = THREE;
const A = G.Assets = { base: 'assets/models/', files: {}, scenes: {}, status: {}, used: {}, enabled: !/[?&]noassets/.test(location.search) && typeof T.GLTFLoader === 'function' };
const DEFAULT_FILES = ['weapons', 'glider', 'bus', 'chest_wood', 'chest_metal', 'heals', 'llama', 'trees', 'char_default', 'char_hero', 'char_ranger', 'char_neon', 'char_frost', 'char_gold', 'char_shadow', 'char_beach', 'char_knight', 'char_circuit', 'char_dino', 'char_cow', 'char_lab', 'char_punk'];
const TIMEOUT = 9000;

/* ---------------- loading ---------------- */
A.load = function () {
  if (A.promise) return A.promise;
  if (!A.enabled) return (A.promise = Promise.resolve());
  const loader = new T.GLTFLoader();
  const one = (name) => new Promise((res) => {
    let done = false; const fin = (ok, why) => { if (done) return; done = true; A.status[name] = ok ? 'ok' : 'fail: ' + why; res(); };
    const to = setTimeout(() => fin(false, 'timeout'), TIMEOUT);
    try { loader.load(A.base + name + '.glb', (gltf) => { clearTimeout(to); try { A.scenes[name] = gltf.scene; gltf.scene.updateMatrixWorld(true); fin(true); } catch (e) { fin(false, e.message); } }, undefined, (e) => { clearTimeout(to); fin(false, (e && e.message) || 'error'); }); }
    catch (e) { clearTimeout(to); fin(false, e.message); }
  });
  const list = fetch(A.base + 'manifest.json').then(r => r.ok ? r.json() : null).then(m => (m && m.files) || DEFAULT_FILES, () => DEFAULT_FILES);
  A.promise = list.then(l => Promise.all(l.map(one))).then(() => { installAll(); }, (e) => { console.warn('assets', e); });
  return A.promise;
};
A.has = (n) => !!A.scenes[n];
const find = (root, name) => { let r = null; root.traverse(o => { if (!r && o.name === name) r = o; }); return r; };

/* ---------------- baking: node meshes -> merged vertex-coloured geometry ---------------- */
const roleOf = (mat) => { const n = (mat && mat.name || '').replace(/\.\d+$/, ''); return n.slice(0, 2) === 'R_' ? n.slice(2) : null; };
const isGlow = (mat) => { const n = (mat && mat.name || ''); return n.slice(0, 2) === 'G_' || /rarity/.test(n) || !!(mat && mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.01); };
const _v = new T.Vector3(), _n = new T.Vector3(), _n3 = new T.Matrix3(), _c = new T.Color();
/* meshes: [{mesh, m: Matrix4 relative to the baking frame}] ; roles: {role: hex}; opts.skipGlow */
function bake(items, roles, opts) {
  opts = opts || {}; const groups = { lit: [], glow: [] };
  for (const it of items) { const mats = Array.isArray(it.mesh.material) ? it.mesh.material : [it.mesh.material]; const g = it.mesh.geometry;
    if (!g.groups || !g.groups.length || mats.length === 1) groups[isGlow(mats[0]) && !opts.glowAsLit ? 'glow' : 'lit'].push({ it, mat: mats[0], geo: g, start: 0, count: g.index ? g.index.count : g.attributes.position.count });
    else for (const gr of g.groups) { const mt = mats[gr.materialIndex]; groups[isGlow(mt) && !opts.glowAsLit ? 'glow' : 'lit'].push({ it, mat: mt, geo: g, start: gr.start, count: gr.count }); } }
  const out = {};
  for (const key of ['lit', 'glow']) { const L = groups[key]; if (!L.length) continue;
    let nv = 0, ni = 0; for (const e of L) { nv += e.geo.attributes.position.count; ni += e.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni); let vo = 0, io = 0;
    for (const e of L) { const g = e.geo, ps = g.attributes.position, ns = g.attributes.normal, n = ps.count, m = e.it.m; _n3.getNormalMatrix(m);
      const role = roleOf(e.mat); if (role && roles && roles[role] !== undefined) _c.set(roles[role]); else _c.copy(e.mat.color || _c.set(0xffffff));
      for (let i = 0; i < n; i++) { _v.fromBufferAttribute(ps, i).applyMatrix4(m); pos[(vo + i) * 3] = _v.x; pos[(vo + i) * 3 + 1] = _v.y; pos[(vo + i) * 3 + 2] = _v.z;
        if (ns) { _n.fromBufferAttribute(ns, i).applyMatrix3(_n3).normalize(); nor[(vo + i) * 3] = _n.x; nor[(vo + i) * 3 + 1] = _n.y; nor[(vo + i) * 3 + 2] = _n.z; }
        col[(vo + i) * 3] = _c.r; col[(vo + i) * 3 + 1] = _c.g; col[(vo + i) * 3 + 2] = _c.b; }
      if (g.index) for (let i = e.start; i < e.start + e.count; i++) idx[io++] = g.index.getX(i) + vo; else for (let i = e.start; i < e.start + e.count; i++) idx[io++] = vo + i;
      vo += n; }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.setIndex(new T.BufferAttribute(idx.subarray(0, io), 1));
    if (opts.outline) { // averaged normals per welded position -> inverted-hull outline without cracks at hard edges
      const acc = new Map(), kf = i => Math.round(pos[i * 3] * 400) + ',' + Math.round(pos[i * 3 + 1] * 400) + ',' + Math.round(pos[i * 3 + 2] * 400);
      for (let i = 0; i < nv; i++) { const k = kf(i); let a = acc.get(k); if (!a) acc.set(k, a = [0, 0, 0]); a[0] += nor[i * 3]; a[1] += nor[i * 3 + 1]; a[2] += nor[i * 3 + 2]; }
      const on = new Float32Array(nv * 3); for (let i = 0; i < nv; i++) { const a = acc.get(kf(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; on[i * 3] = a[0] / l; on[i * 3 + 1] = a[1] / l; on[i * 3 + 2] = a[2] / l; }
      geo.setAttribute('onrm', new T.BufferAttribute(on, 3)); }
    geo.computeBoundingSphere(); geo.computeBoundingBox(); out[key] = geo; }
  return out;
}
const _I = new T.Matrix4();
/* meshes directly under `node` (not descending into child nodes that have their own name entry in `stop`), matrices local to node */
const STOP = { forearm_L: 1, forearm_R: 1, shin_L: 1, shin_R: 1 };
function directMeshes(node) { node.updateWorldMatrix(true, true); const inv = new T.Matrix4().copy(node.matrixWorld).invert(), r = [];
  const walk = (o) => { for (const c of o.children) { if (STOP[c.name]) continue; if (c.isMesh) r.push({ mesh: c, m: new T.Matrix4().multiplyMatrices(inv, c.matrixWorld) }); walk(c); } }; walk(node); return r; }
/* every mesh below `node`, matrices relative to `frame` (default node) in the bind pose */
function allMeshes(node, frame) { frame = frame || node; node.updateWorldMatrix(true, true); const inv = new T.Matrix4().copy(frame.matrixWorld).invert(), r = []; node.traverse(o => { if (o.isMesh) r.push({ mesh: o, m: new T.Matrix4().multiplyMatrices(inv, o.matrixWorld) }); }); return r; }
/* a Group like G.bakeBuilder: lit mesh + optional glow mesh (userData.lit / .glow) */
function groupFrom(geos, o) {
  o = o || {}; const g = new T.Group();
  if (geos.lit) { const m = new T.Mesh(geos.lit, o.doubleSide ? G.vcMatDS : G.vcMat); m.castShadow = o.cast !== false; g.add(m); g.userData.lit = m; }
  if (geos.glow) { const gm = new T.Mesh(geos.glow, G.glowMat); g.add(gm); g.userData.glow = gm; }
  return g;
}
const used = (n) => { A.used[n] = (A.used[n] || 0) + 1; };

/* ---------------- characters ---------------- */
function charGeos(skin, O) {
  const root = A.scenes['char_' + O.id]; if (!root) return null;
  const roles = { skin: skin.tone || 0xf2c9a0, top: skin.shirt !== undefined ? skin.shirt : O.top, top2: skin.acc !== undefined ? skin.acc : O.top2, pants: skin.pants !== undefined ? skin.pants : O.pants, hair: skin.hairC !== undefined ? skin.hairC : (O.hairC || 0x3a2a1a) };
  const seg = (name) => { const n = find(root, name); if (!n) throw new Error('missing node ' + name); return bake(directMeshes(n), roles, { outline: true, glowAsLit: true }).lit || new T.BufferGeometry(); };
  try {
    const GG = { torso: seg('torso'), head: seg('head'), uarm: [seg('arm_L'), seg('arm_R')], farm: [seg('forearm_L'), seg('forearm_R')], thigh: [seg('leg_L'), seg('leg_R')], shin: [seg('shin_L'), seg('shin_R')] };
    const lod = find(root, 'lod_low'); // human models ship a decimated far-LOD mesh and use their own pivot widths
    GG.low = bake(lod ? allMeshes(lod, root) : allMeshes(root), roles, { glowAsLit: true }).lit;
    if (lod) GG.piv = { shx: 0.29, hipx: 0.12, human: true };
    used('char'); return GG;
  } catch (e) { console.warn('char glb ' + O.id + ':', e.message); return null; }
}
A.charGeos = charGeos;

/* ---------------- weapons + pickaxes ---------------- */
function installWeapons() {
  const root = A.scenes.weapons; if (!root) return;
  const origW = G.weaponModel, origP = G.pickaxeModel; const litC = {}, glowC = {}, pickC = {};
  G.weaponModel = function (id, rarHex) {
    try { const n = find(root, 'w_' + id); if (!n) return origW(id, rarHex); const rh = rarHex || 0xffffff;
      if (!litC[id]) litC[id] = bake(directMeshes(n), { rarity: 0xffffff }); const gk = id + '|' + rh;
      if (!glowC[gk]) { glowC[gk] = bake(directMeshes(n), { rarity: rh }).glow || null; }
      const g = groupFrom({ lit: litC[id].lit, glow: glowC[gk] }); g.scale.setScalar(1.15); used('weapon'); return g;
    } catch (e) { console.warn('weapon glb', e.message); return origW(id, rarHex); }
  };
  G.pickaxeModel = function (kind) {
    kind = kind || 'pick';
    try { const n = find(root, 'p_' + kind); if (!n) return origP(kind); if (!pickC[kind]) pickC[kind] = groupFrom(bake(directMeshes(n), {})); used('pick'); return pickC[kind].clone(); }
    catch (e) { console.warn('pick glb', e.message); return origP(kind); }
  };
}

/* ---------------- glider + bus ---------------- */
function installGlider() {
  const root = A.scenes.glider; if (!root) return; const orig = G.makeGlider; const cache = {};
  G.makeGlider = function (col) {
    col = col === undefined ? 0xff5a5a : col;
    try { if (!cache[col]) { const g = new T.Group(); const can = find(root, 'glider_canopy'), fr = find(root, 'glider_frame'); const roles = { tint: col };
      const cb = bake(allMeshes(can, root), roles, { glowAsLit: true }).lit; const cm = new T.Mesh(cb, G.vcMatDS); cm.castShadow = true; g.add(cm);
      const fb = bake(allMeshes(fr, root), roles, { glowAsLit: true }); g.add(groupFrom(fb)); cache[col] = g; } used('glider'); return cache[col].clone(); }
    catch (e) { console.warn('glider glb', e.message); return orig(col); }
  };
}
function installBus() {
  const root = A.scenes.bus; if (!root) return; const orig = G.makeBus; let C = null;
  G.makeBus = function () {
    try { if (!C) { const body = find(root, 'bus_body'), prop = find(root, 'bus_prop'), rig = find(root, 'balloon_rig'), bal = find(root, 'balloon');
        C = { body: bake(allMeshes(body, root), {}), rig: bake(allMeshes(rig, root), {}), bal: bake(allMeshes(bal, root), {}), prop: bake(directMeshes(prop), {}), pp: prop.position.clone() }; }
      const g = new T.Group(); g.add(groupFrom(C.body)); g.add(groupFrom(C.rig, { cast: false })); g.add(groupFrom(C.bal));
      const p = new G.Obj3(); p.position.copy(C.pp); p.add(groupFrom(C.prop)); g.add(p); g.userData.prop = p; g.scale.setScalar(1.25); used('bus'); return g; }
    catch (e) { console.warn('bus glb', e.message); return orig(); }
  };
}

/* ---------------- chests, pickups, llama ---------------- */
function installChest() {
  const orig = G.makeChest; const cache = {};
  G.makeChest = function (style, rar) {
    const g = orig(style, rar); style = style || 'wood'; const root = A.scenes['chest_' + style]; if (!root) return g;
    try { const rr = rar === undefined ? 1 : rar, rc = G.RARITY[rr].hex, key = style + '|' + rc;
      if (!cache[key]) { const b = find(root, 'body'), l = find(root, 'lid'); cache[key] = { body: bake(directMeshes(b), { rarity: rc }), lid: bake(directMeshes(l), { rarity: rc }) }; }
      const C = cache[key], { body, lid } = g.userData; while (body.children.length) body.remove(body.children[0]); while (lid.children.length) lid.remove(lid.children[0]);
      body.add(groupFrom(C.body)); lid.add(groupFrom(C.lid)); used('chest'); } catch (e) { console.warn('chest glb', e.message); }
    return g;
  };
}
const HEAL_Y = { bandage: 0, medkit: 0.1, chug: 0.2, shield: 0.1, minishield: 0.1, slurp: 0.18 };
function installHeals() {
  const root = A.scenes.heals; if (!root) return; const orig = G.makeHealModel; const cache = {};
  G.makeHealModel = function (id) {
    try { const n = find(root, 'heal_' + id); if (!n) return orig(id); if (!cache[id]) cache[id] = bake(directMeshes(n), {});
      const g = groupFrom(cache[id]); g.position.y = HEAL_Y[id] || 0; used('heal');
      if (id === 'chug' || id === 'shield' || id === 'minishield') { const gl = new T.Mesh(G._healGlowGeo || (G._healGlowGeo = new T.SphereGeometry(1, 10, 8)), new T.MeshBasicMaterial({ color: id === 'chug' ? 0x3dffc8 : 0x4a9aff, transparent: true, opacity: 0.14, blending: T.AdditiveBlending, depthWrite: false })); gl.scale.setScalar(id === 'chug' ? 0.34 : id === 'shield' ? 0.4 : 0.26); g.add(gl); }
      return g; }
    catch (e) { console.warn('heal glb', e.message); return orig(id); }
  };
}
function installLlama() {
  const root = A.scenes.llama; if (!root) return; const orig = G.makeLlama; let C = null;
  G.makeLlama = function () {
    const g = orig();
    try { if (!C) C = { body: bake(directMeshes(find(root, 'body')), {}), balloon: bake(directMeshes(find(root, 'balloon')), {}) };
      const { body, balloon } = g.userData; while (body.children.length) body.remove(body.children[0]); while (balloon.children.length) balloon.remove(balloon.children[0]);
      body.add(groupFrom(C.body)); balloon.add(groupFrom(C.balloon)); used('llama'); } catch (e) { console.warn('llama glb', e.message); }
    return g;
  };
}

/* ---------------- trees (world.js asks for these while building the island) ---------------- */
A.treeGeos = function () {
  const root = A.scenes.trees; if (!root) return null;
  try { const mk = (n) => bake(directMeshes(find(root, n)), {}).lit; const r = { trunk: mk('tree_trunk'), pine: mk('tree_pine'), oak: mk('tree_oak') }; used('trees'); return r; } catch (e) { console.warn('trees glb', e.message); return null; }
};

function installAll() {
  for (const f of [installWeapons, installGlider, installBus, installChest, installHeals, installLlama]) { try { f(); } catch (e) { console.warn('assets install', e); } }
  const ok = Object.keys(A.status).filter(k => A.status[k] === 'ok').length, bad = Object.keys(A.status).filter(k => A.status[k] !== 'ok');
  console.log('[assets] loaded ' + ok + '/' + Object.keys(A.status).length + ' glb' + (bad.length ? ', fallback for: ' + bad.join(', ') : ''));
}
})();
