'use strict';
/* Performance helpers: static geometry merging + adaptive quality manager (pixel ratio, shadows, fog, cull distances). */
(function () {
const G = window.G, T = THREE;

/* merge [{geo, matrix}] into one BufferGeometry (position + normal only) */
G.mergeGeoms = function (list) {
  let nv = 0, ni = 0; for (const p of list) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni); let vo = 0, io = 0; const v = new T.Vector3(), n3 = new T.Matrix3();
  for (const p of list) { const g = p.geo, ps = g.attributes.position, ns = g.attributes.normal, n = ps.count; n3.getNormalMatrix(p.matrix);
    for (let i = 0; i < n; i++) { v.set(ps.getX(i), ps.getY(i), ps.getZ(i)).applyMatrix4(p.matrix); pos.set([v.x, v.y, v.z], (vo + i) * 3); v.set(ns.getX(i), ns.getY(i), ns.getZ(i)).applyMatrix3(n3).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; else for (let i = 0; i < n; i++) idx[io++] = vo + i; vo += n; }
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setIndex(new T.BufferAttribute(idx, 1)); out.computeBoundingSphere(); out.computeBoundingBox(); return out;
};

/* Merge the plain Mesh children of `group` into ONE vertex-coloured mesh (keeps nested groups / pick / gun untouched).
   Characters are built from ~25 tiny boxes; merging per limb cuts their draw calls (and shadow-pass draw calls) by ~3x. */
G.vcMat = new T.MeshLambertMaterial({ vertexColors: true });
G.mergeStatic = function (group) {
  const list = [], kill = [], cols = [];
  for (const c of group.children) {
    if (!c.isMesh || c.isInstancedMesh || !c.visible || !c.material || !c.material.isMeshLambertMaterial || c.material.transparent || c.material.map || c.material.emissiveIntensity > 0 && c.material.emissive && c.material.emissive.getHex() !== 0) continue;
    c.updateMatrix(); list.push({ geo: c.geometry, matrix: c.matrix.clone() }); cols.push(c.material.color); kill.push(c);
  }
  if (list.length < 2) return;
  const geo = G.mergeGeoms(list); const n = geo.attributes.position.count, col = new Float32Array(n * 3); let o = 0;
  list.forEach((p, i) => { const k = p.geo.attributes.position.count, c = cols[i]; for (let v = 0; v < k; v++) { col[(o + v) * 3] = c.r; col[(o + v) * 3 + 1] = c.g; col[(o + v) * 3 + 2] = c.b; } o += k; });
  geo.setAttribute('color', new T.BufferAttribute(col, 3));
  for (const c of kill) group.remove(c);
  const m = new T.Mesh(geo, G.vcMat); m.castShadow = true; group.add(m);
};
G.mergeRig = function (r) { for (const g of [r.m, r.head, ...r.legs, ...r.arms]) if (g) G.mergeStatic(g); return r; };

/* Quality manager: level 0 (low) .. 2 (high). Starts at 1 on touch / small screens, 2 on desktop; steps down when the frame time stays high, up when it stays low. */
const Q = G.Q = { level: 2, max: 2, auto: true, ema: 16, t: 0, lowT: 0, hiT: 0, applied: -1 };
Q.apply = function (lv) {
  Q.level = Math.max(0, Math.min(2, lv)); if (Q.applied === Q.level) return; Q.applied = Q.level; const r = G.renderer; if (!r) return;
  const dpr = window.devicePixelRatio || 1; r.setPixelRatio(Math.min(dpr, [0.85, 1.15, 1.6][Q.level])); r.setSize(innerWidth, innerHeight);
  const on = Q.level > 0 && G.shadowsOn !== false; const was = r.shadowMap.enabled; r.shadowMap.enabled = on;
  if (G.sun) { G.sun.castShadow = on; const sz = Q.level === 2 ? 2048 : 1024; if (G.sun.shadow.mapSize.x !== sz) { G.sun.shadow.mapSize.set(sz, sz); if (G.sun.shadow.map) { G.sun.shadow.map.dispose(); G.sun.shadow.map = null; } } }
  if (G.scene && G.scene.fog) { G.scene.fog.far = [800, 1000, 1150][Q.level]; G.scene.fog.near = [180, 230, 260][Q.level]; }
  G.cullFar = [320, 480, 700][Q.level]; G.actorFar = [150, 220, 280][Q.level]; G.shadowActorDist = [0, 30, 45][Q.level]; G.fxScale = [0.45, 0.75, 1][Q.level];
  if (was !== on && G.scene) G.scene.traverse(o => { if (o.material && o.isMesh) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach(x => x.needsUpdate = true); } });
};
/* call every frame with the real (uncapped) frame time in seconds */
Q.tick = function (dt) {
  if (!Q.auto) return; Q.t += dt; if (Q.t < 2) return; Q.ema += (dt * 1000 - Q.ema) * 0.05;
  if (Q.ema > 34) { Q.lowT += dt; Q.hiT = 0; } else if (Q.ema < 19) { Q.hiT += dt; Q.lowT = 0; } else { Q.lowT = Q.hiT = 0; }
  if (Q.lowT > 2.5 && Q.level > 0) { Q.apply(Q.level - 1); Q.lowT = 0; Q.ema = 22; Q.t = 0.5; }
  else if (Q.hiT > 12 && Q.level < Q.max) { Q.apply(Q.level + 1); Q.hiT = 0; Q.ema = 22; Q.t = 0.5; }
};
G.cullFar = 700; G.actorFar = 280; G.shadowActorDist = 45; G.fxScale = 1;
})();
