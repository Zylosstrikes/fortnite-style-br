'use strict';
/* Shared rendering helpers: soft toon shading + rim light, geometry merging (Builder), outline hull, quality manager.
   Everything is original and procedural. */
(function () {
const G = window.G, T = THREE;

/* ---------- soft toon ramp + rim light, applied to every Lambert material the game creates ---------- */
(function () {
  const c = document.createElement('canvas'); c.width = 64; c.height = 1; const x = c.getContext('2d'); const im = x.createImageData(64, 1);
  const ss = (a, b, v) => { v = Math.min(1, Math.max(0, (v - a) / (b - a))); return v * v * (3 - 2 * v); };
  for (let i = 0; i < 64; i++) { const t = i / 63; const v = 0.50 + 0.20 * ss(0.18, 0.30, t) + 0.17 * ss(0.50, 0.62, t) + 0.13 * ss(0.78, 0.92, t); const b = Math.round(Math.min(1, v) * 255); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = b; im.data[i * 4 + 3] = 255; }
  x.putImageData(im, 0, 0); const ramp = new T.CanvasTexture(c); ramp.minFilter = ramp.magFilter = T.LinearFilter; ramp.generateMipmaps = false; G.toonRamp = ramp;
  const rimPatch = function (sh) {
    sh.fragmentShader = sh.fragmentShader.replace('#include <output_fragment>', 'float rimv = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.4); outgoingLight += rimv * vec3(0.62, 0.80, 1.0) * 0.30;\n#include <output_fragment>');
  };
  class ToonLambert extends T.MeshToonMaterial {
    constructor(p) { super(); this.gradientMap = ramp; this.setValues(p); this.onBeforeCompile = rimPatch; this.customProgramCacheKey = () => 'toonrim'; }
  }
  T.MeshLambertMaterial = ToonLambert;
})();

/* ---------- geometry merging ---------- */
const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(), _n3 = new T.Matrix3(), _c = new T.Color();
const gcache = {};
function prim(kind, a, b, seg) {
  const k = kind + '|' + a + '|' + b + '|' + seg; if (gcache[k]) return gcache[k]; let g;
  if (kind === 'box') g = new T.BoxGeometry(1, 1, 1);
  else if (kind === 'cyl') g = new T.CylinderGeometry(a, 1, 1, seg || 8, 1); // a = top radius ratio
  else if (kind === 'sph') g = new T.SphereGeometry(1, seg || 10, Math.max(4, Math.round((seg || 10) * 0.75)));
  else if (kind === 'cone') g = new T.ConeGeometry(1, 1, seg || 8, 1);
  else if (kind === 'ico') g = new T.IcosahedronGeometry(1, a || 0);
  else if (kind === 'oct') g = new T.OctahedronGeometry(1, 0);
  gcache[k] = g; return g;
}
G.prim = prim;
/* Builder: collects primitives (with colour, transform, optional emissive flag) and bakes them into one or two meshes. */
class Builder {
  constructor() { this.lit = []; this.glow = []; }
  _add(list, geo, col, x, y, z, sx, sy, sz, rx, ry, rz) { list.push({ geo, col, x: x || 0, y: y || 0, z: z || 0, sx, sy, sz, rx: rx || 0, ry: ry || 0, rz: rz || 0 }); return this; }
  box(w, h, d, col, x, y, z, rx, ry, rz, glow) { return this._add(glow ? this.glow : this.lit, prim('box'), col, x, y, z, w, h, d, rx, ry, rz); }
  bx(w, h, d, col, x, y, z, o) { return this.box(w, h, d, col, x, y, z, 0, 0, 0, !!(o && o.emissive)); }
  cyl(r, len, col, x, y, z, axis, r2, seg, glow) { // axis 'y' (default) | 'z' | 'x'
    const k = r2 === undefined ? 1 : r2 / r; let rx = 0, rz = 0; if (axis === 'z') rx = Math.PI / 2; else if (axis === 'x') rz = Math.PI / 2;
    return this._add(glow ? this.glow : this.lit, prim('cyl', k, 0, seg), col, x, y, z, r, len, r, rx, 0, rz);
  }
  sph(r, col, x, y, z, sx, sy, sz, seg, glow) { return this._add(glow ? this.glow : this.lit, prim('sph', 0, 0, seg), col, x, y, z, r * (sx || 1), r * (sy || 1), r * (sz || 1), 0, 0, 0); }
  cone(r, h, col, x, y, z, rx, ry, rz, seg, glow) { return this._add(glow ? this.glow : this.lit, prim('cone', 0, 0, seg), col, x, y, z, r, h, r, rx, ry, rz); }
  ico(r, col, x, y, z, sx, sy, sz, detail) { return this._add(this.lit, prim('ico', detail || 0), col, x, y, z, r * (sx || 1), r * (sy || 1), r * (sz || 1), 0, 0, 0); }
  add(geo, col, x, y, z, sx, sy, sz, rx, ry, rz, glow) { return this._add(glow ? this.glow : this.lit, geo, col, x, y, z, sx || 1, sy || 1, sz || 1, rx, ry, rz); }
  geometry(list, smoothOutline) { return mergeParts(list || this.lit, smoothOutline); }
}
function mergeParts(list, smoothOutline) {
  let nv = 0, ni = 0; for (const p of list) { nv += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni); let vo = 0, io = 0;
  for (const p of list) {
    _e.set(p.rx, p.ry, p.rz); _q.setFromEuler(_e); _p.set(p.x, p.y, p.z); _s.set(p.sx, p.sy, p.sz); _m.compose(_p, _q, _s); _n3.getNormalMatrix(_m); _c.set(p.col);
    const g = p.geo, ps = g.attributes.position, ns = g.attributes.normal, n = ps.count;
    for (let i = 0; i < n; i++) { _p.set(ps.getX(i), ps.getY(i), ps.getZ(i)).applyMatrix4(_m); pos[(vo + i) * 3] = _p.x; pos[(vo + i) * 3 + 1] = _p.y; pos[(vo + i) * 3 + 2] = _p.z;
      _p.set(ns.getX(i), ns.getY(i), ns.getZ(i)).applyMatrix3(_n3).normalize(); nor[(vo + i) * 3] = _p.x; nor[(vo + i) * 3 + 1] = _p.y; nor[(vo + i) * 3 + 2] = _p.z; col[(vo + i) * 3] = _c.r; col[(vo + i) * 3 + 1] = _c.g; col[(vo + i) * 3 + 2] = _c.b; }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; else for (let i = 0; i < n; i++) idx[io++] = vo + i;
    vo += n;
  }
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setIndex(new T.BufferAttribute(idx, 1));
  if (smoothOutline) { // averaged normals per welded position -> outline hull without cracks at box corners
    const acc = new Map(), key = i => Math.round(pos[i * 3] * 400) + ',' + Math.round(pos[i * 3 + 1] * 400) + ',' + Math.round(pos[i * 3 + 2] * 400);
    for (let i = 0; i < nv; i++) { const k = key(i); let a = acc.get(k); if (!a) acc.set(k, a = [0, 0, 0]); a[0] += nor[i * 3]; a[1] += nor[i * 3 + 1]; a[2] += nor[i * 3 + 2]; }
    const on = new Float32Array(nv * 3); for (let i = 0; i < nv; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; on[i * 3] = a[0] / l; on[i * 3 + 1] = a[1] / l; on[i * 3 + 2] = a[2] / l; }
    geo.setAttribute('onrm', new T.BufferAttribute(on, 3));
  }
  geo.computeBoundingSphere(); geo.computeBoundingBox(); return geo;
}
G.Builder = Builder; G.mergeParts = mergeParts;
G.vcMat = new T.MeshLambertMaterial({ vertexColors: true });
G.vcMatDS = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
G.glowMat = new T.MeshBasicMaterial({ vertexColors: true });
/* inverted-hull outline: pushes vertices along averaged normals, draws back faces in a dark ink colour */
G.outlineMat = new T.ShaderMaterial({ side: T.BackSide, fog: false, uniforms: { w: { value: 0.022 } },
  vertexShader: 'uniform float w; attribute vec3 onrm; void main(){ vec3 p = position + onrm * w; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.045, 0.05, 0.13, 1.0); }' });
/* build a Group from a Builder: lit mesh (+ optional glow mesh, + optional outline mesh) */
G.bakeBuilder = function (b, o) {
  o = o || {}; const g = new T.Group(); const geo = b.geometry(b.lit, !!o.outline);
  const m = new T.Mesh(geo, o.doubleSide ? G.vcMatDS : G.vcMat); m.castShadow = o.cast !== false; g.add(m); g.userData.lit = m;
  if (b.glow.length) { const gm = new T.Mesh(b.geometry(b.glow), G.glowMat); g.add(gm); g.userData.glow = gm; }
  if (o.outline) { const om = new T.Mesh(geo, G.outlineMat); om.userData.outline = true; om.renderOrder = -1; g.add(om); g.userData.outline = om; }
  return g;
};

/* ---------- quality manager (adaptive for phones) ---------- */
const Q = G.Q = { level: 2, max: 2, auto: true, ema: 16, t: 0, lowT: 0, hiT: 0, applied: -1 };
Q.apply = function (lv) {
  Q.level = Math.max(0, Math.min(2, lv)); if (Q.applied === Q.level) return; Q.applied = Q.level; const r = G.renderer; if (!r) return;
  const dpr = window.devicePixelRatio || 1; r.setPixelRatio(Math.min(dpr, [0.85, 1.15, 1.6][Q.level])); r.setSize(innerWidth, innerHeight);
  r.shadowMap.enabled = Q.level > 0 && G.shadowsOn !== false; if (G.sun) { G.sun.castShadow = r.shadowMap.enabled; const sz = Q.level === 2 ? 2048 : 1024; if (G.sun.shadow.mapSize.x !== sz) { G.sun.shadow.mapSize.set(sz, sz); if (G.sun.shadow.map) { G.sun.shadow.map.dispose(); G.sun.shadow.map = null; } } const R = Q.level === 2 ? 75 : 55, sc = G.sun.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.updateProjectionMatrix(); }
  if (G.scene && G.scene.fog) { G.scene.fog.far = [800, 1000, 1150][Q.level]; G.scene.fog.near = [180, 230, 260][Q.level]; }
  G.cullFar = [320, 480, 700][Q.level]; G.outlineDist = [0, 22, 32][Q.level]; G.fxScale = [0.45, 0.75, 1][Q.level];
  if (G.scene) G.scene.traverse(o => { if (o.material && o.material.needsUpdate !== undefined && o.isMesh) o.material.needsUpdate = true; });
};
/* call every frame with the real (uncapped) frame time in seconds */
Q.tick = function (dt) {
  if (!Q.auto) return; Q.t += dt; if (Q.t < 2) return; Q.ema += (dt * 1000 - Q.ema) * 0.05;
  if (Q.ema > 34) { Q.lowT += dt; Q.hiT = 0; } else if (Q.ema < 19) { Q.hiT += dt; Q.lowT = 0; } else { Q.lowT = Q.hiT = 0; }
  if (Q.lowT > 2.5 && Q.level > 0) { Q.apply(Q.level - 1); Q.lowT = 0; Q.ema = 22; Q.t = 0.5; }
  else if (Q.hiT > 12 && Q.level < Q.max) { Q.apply(Q.level + 1); Q.hiT = 0; Q.ema = 22; }
};
})();
