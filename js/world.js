'use strict';
/* World: terrain, colliders, buildings, trees, props, loot placement, raycasts */
(function () {
const G = window.G, T = THREE;
const FH = G.FH, N = 250, SZ = G.MAPSZ, HALF = G.HALF, CELLV = SZ / N;
const CS = 16, OFF = 520, GW = 70; // collider hash
const STEP = 0.55;

/* ---------------- Batch: merged static geometry with hideable pieces ---------------- */
const _bc = new T.Color();
class Batch {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.ranges = []; this.mesh = null; }
  tri(a, b, c, col, ref) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (ref) { const cx = (a[0] + b[0] + c[0]) / 3 - ref[0], cy = (a[1] + b[1] + c[1]) / 3 - ref[1], cz = (a[2] + b[2] + c[2]) / 3 - ref[2]; if (nx * cx + ny * cy + nz * cz < 0) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; } }
    _bc.setHex(col); const r = _bc.r, g = _bc.g, bl = _bc.b;
    for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(nx, ny, nz); this.col.push(r, g, bl); }
  }
  quad(a, b, c, d, col, ref) { this.tri(a, b, c, col, ref); this.tri(a, c, d, col, ref); }
  start() { return this.pos.length / 3; }
  end(s) { this.ranges.push([s, this.pos.length / 3]); return this.ranges.length - 1; }
  hexa(p, col, ref) {
    ref = ref || [0, 0, 0]; for (const q of p) { ref[0] += q[0] / 8; ref[1] += q[1] / 8; ref[2] += q[2] / 8; }
    this.quad(p[0], p[1], p[2], p[3], col, ref); this.quad(p[4], p[5], p[6], p[7], col, ref);
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; this.quad(p[i], p[j], p[j + 4], p[i + 4], col, ref); }
  }
  box(x0, y0, z0, x1, y1, z1, col) {
    const s = this.start();
    this.hexa([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], col, [0, 0, 0]);
    return this.end(s);
  }
  wedge(x0, z0, x1, z1, ylo, yhi, thick, d, col) {
    const s = this.start(); const lo = ylo, hi = yhi, by = ylo - thick;
    const h = d === 0 ? [lo, hi, hi, lo] : d === 1 ? [lo, lo, hi, hi] : d === 2 ? [hi, lo, lo, hi] : [hi, hi, lo, lo];
    const xs = [x0, x1, x1, x0], zs = [z0, z0, z1, z1]; const p = [];
    for (let i = 0; i < 4; i++) p.push([xs[i], by, zs[i]]); for (let i = 0; i < 4; i++) p.push([xs[i], h[i], zs[i]]);
    this.hexa(p, col, [0, 0, 0]); return this.end(s);
  }
  prism(x0, z0, x1, z1, y0, y1, alongX, col) { // gable roof
    const s = this.start(); let A, B, C, D, E, F;
    if (alongX) { const zm = (z0 + z1) / 2; A = [x0, y0, z0]; B = [x1, y0, z0]; C = [x1, y0, z1]; D = [x0, y0, z1]; E = [x0, y1, zm]; F = [x1, y1, zm]; }
    else { const xm = (x0 + x1) / 2; A = [x0, y0, z0]; B = [x0, y0, z1]; C = [x1, y0, z1]; D = [x1, y0, z0]; E = [xm, y1, z0]; F = [xm, y1, z1]; }
    const ref = [(x0 + x1) / 2, (y0 + y1) / 3, (z0 + z1) / 2];
    this.quad(A, B, F, E, col, ref); this.quad(D, C, F, E, col, ref); this.tri(A, D, E, col, ref); this.tri(B, C, F, col, ref); this.quad(A, B, C, D, col, ref);
    return this.end(s);
  }
  build(mat) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new T.BufferAttribute(new Float32Array(this.col), 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    this.mesh = new T.Mesh(g, mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true; return this.mesh;
  }
  hide(id) {
    if (!this.mesh) return; const r = this.ranges[id]; const a = this.mesh.geometry.attributes.position.array;
    for (let i = r[0] * 3; i < r[1] * 3; i++) a[i] = 0; this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}
G.Batch = Batch;

/* ---------------- colliders ---------------- */
const cells = []; for (let i = 0; i < GW * GW; i++) cells.push([]);
let stampN = 1;
function cellRange(x0, z0, x1, z1) { return [Math.max(0, Math.floor((x0 + OFF) / CS)), Math.max(0, Math.floor((z0 + OFF) / CS)), Math.min(GW - 1, Math.floor((x1 + OFF) / CS)), Math.min(GW - 1, Math.floor((z1 + OFF) / CS))]; }
function addBox(b) {
  b.stamp = 0; b.dead = false; if (b.hp === undefined) b.hp = 1e9; b.maxhp = b.hp; const r = cellRange(b.x0, b.z0, b.x1, b.z1);
  for (let cz = r[1]; cz <= r[3]; cz++) for (let cx = r[0]; cx <= r[2]; cx++) cells[cz * GW + cx].push(b);
  b.cells = r; return b;
}
function removeBox(b) {
  const r = b.cells; for (let cz = r[1]; cz <= r[3]; cz++) for (let cx = r[0]; cx <= r[2]; cx++) { const a = cells[cz * GW + cx]; const i = a.indexOf(b); if (i >= 0) a.splice(i, 1); }
  b.dead = true;
}
function forBoxes(x0, z0, x1, z1, fn) {
  const st = ++stampN, r = cellRange(x0, z0, x1, z1);
  for (let cz = r[1]; cz <= r[3]; cz++) for (let cx = r[0]; cx <= r[2]; cx++) { const a = cells[cz * GW + cx]; for (let i = 0; i < a.length; i++) { const b = a[i]; if (b.stamp === st) continue; b.stamp = st; if (fn(b) === true) return; } }
}
function rampH(b, x, z) {
  let t; const d = b.ramp;
  if (d === 0) t = (x - b.x0) / (b.x1 - b.x0); else if (d === 2) t = (b.x1 - x) / (b.x1 - b.x0); else if (d === 1) t = (z - b.z0) / (b.z1 - b.z0); else t = (b.z1 - z) / (b.z1 - b.z0);
  return b.y0 + (b.y1 - b.y0) * G.clamp(t, 0, 1);
}

/* ---------------- terrain ---------------- */
const heights = new Float32Array((N + 1) * (N + 1));
const pads = []; const roads = [];
function H0(x, z) {
  const r = Math.hypot(x, z);
  let h = 4.2 + (G.fbm(x * 0.006, z * 0.006, 4) - 0.5) * 30 + (G.fbm(x * 0.022 + 50, z * 0.022, 3) - 0.5) * 5;
  const M = G.MT, md = Math.hypot(x - M.x, z - M.z);
  if (md < M.r) { const t = 1 - md / M.r; h += Math.pow(t, 1.45) * M.h * (0.82 + 0.4 * G.fbm(x * 0.014, z * 0.014, 3)) + t * t * (G.fbm(x * 0.05, z * 0.05, 2) - 0.5) * 22; }
  const L = G.LK, ld = Math.hypot(x - L.x, z - L.z);
  if (ld < L.r) { const t = G.smooth(0, 1, (1 - ld / L.r) * 1.7); h = G.lerp(h, -6.5, t); }
  h = G.lerp(h, -16, G.smooth(380, 485, r));
  return h;
}
function Hfull(x, z) {
  let h = H0(x, z);
  for (let i = 0; i < pads.length; i++) { const p = pads[i]; const d = Math.hypot(x - p.x, z - p.z); if (d < p.r * 1.6) { const t = 1 - G.smooth(p.r, p.r * 1.6, d); h = G.lerp(h, p.h, t); } }
  return h;
}
function heightAt(x, z) {
  let fx = (x + HALF) / CELLV, fz = (z + HALF) / CELLV;
  if (fx < 0 || fz < 0 || fx >= N || fz >= N) return -16;
  const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, W = N + 1;
  const ha = heights[iz * W + ix], hb = heights[(iz + 1) * W + ix], hc = heights[(iz + 1) * W + ix + 1], hd = heights[iz * W + ix + 1];
  return tx + tz <= 1 ? ha + tx * (hd - ha) + tz * (hb - ha) : hc + (1 - tx) * (hb - hc) + (1 - tz) * (hd - hc);
}
function roadDist(x, z) {
  let best = 999;
  for (let i = 0; i < roads.length; i++) { const r = roads[i]; const vx = r[2] - r[0], vz = r[3] - r[1]; const t = G.clamp(((x - r[0]) * vx + (z - r[1]) * vz) / (vx * vx + vz * vz), 0, 1); const d = Math.hypot(x - (r[0] + vx * t), z - (r[1] + vz * t)); if (d < best) best = d; }
  return best;
}
const _c = new T.Color(), _c2 = new T.Color();
function surfaceColor(x, z, h, slope, out) {
  const tone = G.noise(x * 0.045, z * 0.045);
  out.setHex(0x86dc5a); _c2.setHex(0x62c64a); out.lerp(_c2, tone);
  const f = G.fbm(x * 0.008 + 100, z * 0.008, 3);
  if (f > 0.54) { _c2.setHex(0x44a83f); out.lerp(_c2, G.smooth(0.54, 0.68, f) * 0.85); }
  // POI ground
  for (let i = 0; i < G.POIS.length; i++) {
    const p = G.POIS[i]; const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r * 1.0) {
      const k = 1 - G.smooth(p.r * 0.7, p.r * 1.0, d);
      if (p.style === 'town') { _c2.setHex(0xb9b4a6); out.lerp(_c2, k * 0.85); }
      else if (p.style === 'industrial') { _c2.setHex(0xb8ab88); out.lerp(_c2, k * 0.9); }
      else if (p.style === 'suburb') { _c2.setHex(0x9ae86a); out.lerp(_c2, k * 0.8); }
      else if (p.snow) { _c2.setHex(0xe9f2f7); out.lerp(_c2, k * 0.8); }
    }
  }
  const rd = roadDist(x, z); if (rd < 4.2 && h > 0.2) { _c2.setHex(0xd9c58e); out.lerp(_c2, 1 - G.smooth(2.6, 4.2, rd)); }
  const sand = 1 - G.smooth(0.2, 1.8, h); if (sand > 0) { _c2.setHex(0xe9d28f); out.lerp(_c2, sand); }
  if (h < -0.3) { _c2.setHex(0x5bb7c4); out.lerp(_c2, G.smooth(-0.3, -2.5, h)); _c2.setHex(0x2f7f9a); out.lerp(_c2, G.smooth(-2.5, -9, h)); }
  if (slope > 0.55 || h > 36) { _c2.setHex(tone > 0.5 ? 0x9a9da8 : 0x8a8d99); out.lerp(_c2, Math.max(G.smooth(0.55, 0.85, slope), G.smooth(36, 48, h + tone * 6))); }
  if (h > 56 + tone * 10) { _c2.setHex(0xf7fbff); out.lerp(_c2, G.smooth(56, 64, h + tone * 10) * (slope > 1.0 ? 0.5 : 1)); }
  if (h < -10) { out.setHex(0x1f6a86); }
  return out;
}
function slopeAt(x, z) { const e = 2; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); }

/* ---------------- loot helpers ---------------- */
G.loot = []; G.chests = []; let lootId = 1;
function wpick(list, wf) { let t = 0; for (const o of list) t += wf(o); let r = Math.random() * t; for (const o of list) { r -= wf(o); if (r <= 0) return o; } return list[0]; }
G.randRarity = function (chest) { const w = chest ? G.CHEST_RARITY_W : G.RARITY.map(r => r.w); let t = 0; for (const v of w) t += v; let r = Math.random() * t; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return 0; };
G.makeWeaponItem = function (id, rar, chest) { const ids = Object.keys(G.WEAPONS); id = id || wpick(ids, k => G.WEAPONS[k].w); return { kind: 'weapon', w: id, rarity: rar === undefined ? G.randRarity(chest) : rar }; };
G.makeHealItem = function (id) { const ids = Object.keys(G.HEALS); id = id || wpick(ids, k => G.HEALS[k].w); const h = G.HEALS[id]; return { kind: 'heal', id, n: h.n[0] + Math.floor(Math.random() * (h.n[1] - h.n[0] + 1)) }; };
G.makeAmmoItem = function (t) { const ids = Object.keys(G.AMMO); t = t || G.pick(ids); const a = G.AMMO[t]; return { kind: 'ammo', t, n: Math.round(a.pick * G.rand(0.7, 1.2)) }; };
G.makeGadgetItem = function (id) { const ids = Object.keys(G.GADGETS); id = id || wpick(ids, k => G.GADGETS[k].w); const g = G.GADGETS[id]; return { kind: 'gadget', id, n: g.n[0] + Math.floor(Math.random() * (g.n[1] - g.n[0] + 1)) }; };
G.randomFloorItem = function () { const r = Math.random(); return r < 0.36 ? G.makeWeaponItem() : r < 0.62 ? G.makeAmmoItem() : r < 0.9 ? G.makeHealItem() : G.makeGadgetItem(); };
G.addLoot = function (item, x, y, z, bld) { const l = { id: lootId++, item, x, y, z, taken: false, bld: bld || null }; G.loot.push(l); return l; };
const _rr = (w) => { let t = 0; for (const v of w) t += v; let r = Math.random() * t; for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; } return 0; };
G.chestRarity = function (style) { return style === 'metal' ? 2 + _rr([45, 38, 17]) : _rr([36, 40, 24]); }; // wooden: common-rare, blue metallic: rare-legendary
G.chestItems = function (c) {
  const kind = (c && c.kind) || 'chest', rar = c && c.rar !== undefined ? c.rar : 1; const metal = c && c.style === 'metal';
  const R = (d) => G.clamp(rar + d, 0, 4); const out = [];
  if (kind === 'llama' || kind === 'truck') {
    const n = kind === 'llama' ? 3 : 2; for (let i = 0; i < n; i++) { const w = G.makeWeaponItem(null, G.clamp(2 + Math.floor(Math.random() * 3), 2, 4), true); out.push(w, G.makeAmmoItem(G.WEAPONS[w.w].ammo)); }
    out.push(G.makeHealItem(kind === 'llama' ? 'chug' : G.pick(['shield', 'slurp', 'medkit'])), G.makeHealItem('shield'), G.makeGadgetItem('tnt'), G.makeGadgetItem(kind === 'llama' ? 'launchpad' : 'spike')); if (kind === 'llama') out.push(G.makeHealItem('slurp'));
    return out;
  }
  const w = G.makeWeaponItem(null, R(Math.floor(Math.random() * 3) - 1), true); out.push(w, G.makeAmmoItem(G.WEAPONS[w.w].ammo), G.makeHealItem());
  if (Math.random() < (metal ? 0.9 : 0.5)) { const w2 = G.makeWeaponItem(null, R(Math.floor(Math.random() * 3) - 1), true); out.push(w2, G.makeAmmoItem(G.WEAPONS[w2.w].ammo)); }
  if (Math.random() < 0.4) out.push(G.makeHealItem());
  if (metal) out.push(G.makeHealItem(Math.random() < 0.35 ? 'chug' : G.pick(['shield', 'slurp', 'minishield'])));
  if (Math.random() < (metal ? 0.5 : 0.2)) out.push(G.makeGadgetItem());
  return out;
};

/* ---------------- building styles ---------------- */
const STYLES = {
  town: { w: [9, 14], d: [9, 13], fl: [1, 3], walls: [0xf6e7c8, 0xbfe6f7, 0xf9c9c9, 0xdaf3c9, 0xe9d3f8, 0xffe08a], roofs: [0xe8604c, 0x3a82e0, 0xf2a93b, 0x8a52d0, 0x2cb3a0], mat: 'stone', roof: 'mix', chest: 0.75, loot: [3, 5] },
  suburb: { w: [8, 11], d: [8, 10], fl: [1, 2], walls: [0xffe9b8, 0xc9efff, 0xffd1dc, 0xd8f5c8], roofs: [0xd9453a, 0x2f6fd0, 0x7a4cc0, 0xee8a2e], mat: 'wood', roof: 'gable', chest: 0.6, loot: [2, 4] },
  industrial: { w: [14, 22], d: [12, 16], fl: [1, 1], walls: [0x9fb7c8, 0xc8d3dc, 0xe0b25a, 0x8fd0c4], roofs: [0x6f8296, 0x57697c], mat: 'metal', roof: 'lowgable', chest: 0.85, loot: [4, 6] },
  houses: { w: [8, 11], d: [8, 10], fl: [1, 2], walls: [0x9fe4e0, 0xffe0a8, 0xf8b6c8, 0xbde0ff], roofs: [0x2b8fb8, 0xe0614f, 0xf2b53d], mat: 'wood', roof: 'gable', chest: 0.6, loot: [2, 4] },
  cabin: { w: [8, 11], d: [8, 10], fl: [1, 1], walls: [0xb5773e, 0xc98b4c, 0x9c6a3a, 0xd4a063], roofs: [0x2f6b3a, 0x7a3b2a, 0x3b4f7a], mat: 'wood', roof: 'gable', chest: 0.7, loot: [2, 4] },
};
const buildings = []; const rects = [];

function wallSegs(len, ops, Ht, v0) {
  ops.sort((a, b) => a.c - b.c); const segs = []; let cur = 0;
  for (const o of ops) { const u0 = o.c - o.w / 2, u1 = o.c + o.w / 2; if (u0 > cur + 0.01) segs.push([cur, u0, v0, Ht]); if (o.y0 > 0.01) segs.push([u0, u1, v0, o.y0]); if (o.y1 < Ht - 0.01) segs.push([u0, u1, o.y1, Ht]); cur = u1; }
  if (cur < len - 0.01) segs.push([cur, len, v0, Ht]); return segs;
}

function makeBuilding(def) {
  const st = STYLES[def.style], batch = new Batch(); const TH = 0.35;
  const b = { x: def.x, z: def.z, w: def.w, d: def.d, floors: def.floors, base: def.base, style: def.style, batch, name: def.poi || '', boxes: [] };
  const x0 = def.x - def.w / 2, x1 = def.x + def.w / 2, z0 = def.z - def.d / 2, z1 = def.z + def.d / 2, base = def.base;
  const wallCol = def.wall, roofCol = def.roof, matName = st.mat, hp = G.MATS[matName].hp * 0.9;
  const trim = 0xffffff;
  function reg(x0, y0, z0, x1, y1, z1, col, kind, destr, extra) {
    const id = batch.box(x0, y0, z0, x1, y1, z1, col);
    const bx = addBox(Object.assign({ x0, x1, y0, y1, z0, z1, kind, mat: matName, hp: destr ? hp : 1e9, batch, bid: id, col: destr ? wallCol : col, destructible: !!destr, bld: b }, extra || {}));
    b.boxes.push(bx); return bx;
  }
  const ix0 = x0 + TH, ix1 = x1 - TH, iz0 = z0 + TH, iz1 = z1 - TH;
  reg(x0 - 0.1, base - 1.2, z0 - 0.1, x1 + 0.1, base + 0.08, z1 + 0.1, def.floorCol, 'floor', false);
  // door side: 0:+z 1:-z 2:-x 3:+x
  const ds = def.floors > 1 && def.door >= 2 ? def.door - 2 : def.door; const doorC = (ds < 2 ? def.w : def.d) / 2 + G.rand(-1, 1);
  b.doorSide = ds;
  for (let k = 0; k < def.floors; k++) {
    const yb = base + k * FH, yt = base + (k + 1) * FH, v0 = k === 0 ? -0.5 : 0;
    for (let s = 0; s < 4; s++) {
      const len = s < 2 ? def.w : def.d; const ops = [];
      if (k === 0 && s === ds) ops.push({ c: doorC, w: 1.9, y0: 0.08, y1: 2.55 });
      const nw = Math.max(1, Math.floor(len / 4.6));
      for (let i = 0; i < nw; i++) { const c = (i + 0.5) * len / nw; if (k === 0 && s === ds && Math.abs(c - doorC) < 2.6) continue; if (Math.random() < 0.85) ops.push({ c, w: 1.5, y0: 1.0, y1: 2.15 }); }
      // corners of walls shouldn't be windowed
      const segs = wallSegs(len, ops.filter(o => o.c - o.w / 2 > 0.6 && o.c + o.w / 2 < len - 0.6), FH, 0);
      for (const sg of segs) {
        const bot = yb + (sg[2] === 0 ? v0 : sg[2]), top = yb + sg[3];
        let ax0, ax1, az0, az1;
        if (s === 0) { ax0 = x0 + sg[0]; ax1 = x0 + sg[1]; az0 = z1 - TH; az1 = z1; }
        else if (s === 1) { ax0 = x0 + sg[0]; ax1 = x0 + sg[1]; az0 = z0; az1 = z0 + TH; }
        else if (s === 2) { ax0 = x0; ax1 = x0 + TH; az0 = z0 + sg[0]; az1 = z0 + sg[1]; }
        else { ax0 = x1 - TH; ax1 = x1; az0 = z0 + sg[0]; az1 = z0 + sg[1]; }
        reg(ax0, bot, az0, ax1, top, az1, wallCol, 'wall', true);
      }
      if (k === 0 && s === ds) { // doorway info
        let cx, cz, ox, oz, ix, iz;
        if (s === 0) { cx = x0 + doorC; cz = z1; ox = 0; oz = 1; } else if (s === 1) { cx = x0 + doorC; cz = z0; ox = 0; oz = -1; }
        else if (s === 2) { cx = x0; cz = z0 + doorC; ox = -1; oz = 0; } else { cx = x1; cz = z0 + doorC; ox = 1; oz = 0; }
        b.doorOut = { x: cx + ox * 2.2, z: cz + oz * 2.2 }; b.doorIn = { x: cx - ox * 2.2, z: cz - oz * 2.2 };
        // little doorstep
        batch.box(Math.min(cx, cx + ox * 1.2) - (ox ? 0 : 1.3), base - 0.5, Math.min(cz, cz + oz * 1.2) - (oz ? 0 : 1.3), Math.max(cx, cx + ox * 1.2) + (ox ? 0 : 1.3), base + 0.1, Math.max(cz, cz + oz * 1.2) + (oz ? 0 : 1.3), 0xcfc7b8);
      }
    }
  }
  // upper floors and stairs
  b.stairs = [];
  for (let k = 1; k < def.floors; k++) {
    const yk = base + k * FH; const sl = 0.35;
    let ra, A, B;
    if (k % 2 === 1) { ra = { x0: ix0, x1: ix0 + 2.2, z0: iz0, z1: iz0 + 4.8, d: 3 }; A = [ix0 + 2.2, iz0, ix1, iz1]; B = [ix0, iz0 + 4.8, ix0 + 2.2, iz1]; }
    else { ra = { x0: ix1 - 2.2, x1: ix1, z0: iz1 - 4.8, z1: iz1, d: 1 }; A = [ix0, iz0, ix1 - 2.2, iz1]; B = [ix1 - 2.2, iz0, ix1, iz1 - 4.8]; }
    reg(A[0], yk - sl, A[1], A[2], yk, A[3], def.floorCol, 'floor', false); reg(B[0], yk - sl, B[1], B[2], yk, B[3], def.floorCol, 'floor', false);
    const id = batch.wedge(ra.x0, ra.z0, ra.x1, ra.z1, yk - FH + 0.08, yk, 0.3, ra.d, 0xc9a36a);
    const rb = addBox({ x0: ra.x0, x1: ra.x1, z0: ra.z0, z1: ra.z1, y0: yk - FH + 0.08, y1: yk, kind: 'ramp', ramp: ra.d, mat: matName, hp: 1e9, batch, bid: id, col: 0xc9a36a, bld: b });
    b.boxes.push(rb); b.stairs.push(ra);
  }
  // roof
  const top = base + def.floors * FH;
  const rb = reg(x0 - 0.5, top - 0.3, z0 - 0.5, x1 + 0.5, top + 0.05, z1 + 0.5, roofCol, 'roof', false);
  const gable = def.roofType === 'gable' || def.roofType === 'lowgable';
  if (gable) { const ah = def.roofType === 'lowgable' ? 1.4 : 2.5; batch.prism(x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5, top + 0.05, top + 0.05 + ah, def.w >= def.d, roofCol);
    if (def.style === 'suburb' || def.style === 'houses') batch.box(x0 + 1.5, top, z0 + 1.2, x0 + 2.4, top + 3.2, z0 + 2.1, 0xb04a3a); }
  else { // flat roof with parapet + AC unit
    const pc = def.roof2; batch.box(x0 - 0.5, top + 0.05, z0 - 0.5, x1 + 0.5, top + 0.75, z0 - 0.2, pc); batch.box(x0 - 0.5, top + 0.05, z1 + 0.2, x1 + 0.5, top + 0.75, z1 + 0.5, pc);
    batch.box(x0 - 0.5, top + 0.05, z0 - 0.5, x0 - 0.2, top + 0.75, z1 + 0.5, pc); batch.box(x1 + 0.2, top + 0.05, z0 - 0.5, x1 + 0.5, top + 0.75, z1 + 0.5, pc);
    batch.box(def.x - 1, top + 0.05, def.z - 1, def.x + 1, top + 1.2, def.z + 1, 0xdfe5ea); }
  if (def.style === 'industrial') { for (let i = 1; i < 6; i++) { const xx = x0 + (def.w * i) / 6; batch.box(xx - 0.08, base + 0.3, z1 - 0.05, xx + 0.08, base + FH - 0.2, z1 + 0.08, 0x7a8fa3); batch.box(xx - 0.08, base + 0.3, z0 - 0.08, xx + 0.08, base + FH - 0.2, z0 + 0.05, 0x7a8fa3); } }
  // crates inside (colliders) in a corner opposite stairs/door
  b.int = { x0: ix0, x1: ix1, z0: iz0, z1: iz1 };
  const crateCorner = [ix1 - 0.8, iz0 + 0.8];
  if (Math.random() < 0.7 && !(ds === 3 && false)) { const cx = crateCorner[0], cz = crateCorner[1]; reg(cx - 0.55, base + 0.08, cz - 0.55, cx + 0.55, base + 1.1, cz + 0.55, 0xb98448, 'crate', true, { mat: 'wood', hp: 80, col: 0xb98448 }); }
  batch.build(G.World.batchMat); b.mesh = batch.mesh; G.World.scene.add(batch.mesh);
  // loot inside
  const nloot = st.loot[0] + Math.floor(Math.random() * (st.loot[1] - st.loot[0] + 1));
  const tries = nloot * 6; let placed = 0;
  for (let i = 0; i < tries && placed < nloot; i++) {
    const k = Math.random() < 0.3 && def.floors > 1 ? 1 : 0; const lx = G.rand(ix0 + 1, ix1 - 1), lz = G.rand(iz0 + 1, iz1 - 1);
    const inS = (r) => lx > r.x0 - 0.8 && lx < r.x1 + 0.8 && lz > r.z0 - 0.8 && lz < r.z1 + 0.8;
    if (b.stairs.some(inS)) continue; if (Math.abs(lx - crateCorner[0]) < 1.5 && Math.abs(lz - crateCorner[1]) < 1.5) continue;
    G.addLoot(G.randomFloorItem(), lx, base + k * FH + 0.1, lz, b); placed++;
  }
  if (Math.random() < st.chest) {
    const k = def.floors > 1 && Math.random() < 0.4 ? def.floors - 1 : 0; const side = Math.floor(Math.random() * 4); let cx, cz, yaw;
    if (side === 0) { cx = G.rand(ix0 + 2, ix1 - 2); cz = iz1 - 0.55; yaw = Math.PI; } else if (side === 1) { cx = G.rand(ix0 + 2, ix1 - 2); cz = iz0 + 0.55; yaw = 0; }
    else if (side === 2) { cx = ix0 + 0.55; cz = G.rand(iz0 + 2, iz1 - 2); yaw = Math.PI / 2; } else { cx = ix1 - 0.55; cz = G.rand(iz0 + 2, iz1 - 2); yaw = -Math.PI / 2; }
    const inS = b.stairs.some(r => cx > r.x0 - 1.2 && cx < r.x1 + 1.2 && cz > r.z0 - 1.2 && cz < r.z1 + 1.2);
    if (!inS && !(Math.abs(cx - crateCorner[0]) < 1.6 && Math.abs(cz - crateCorner[1]) < 1.6)) G.World.addChest(cx, base + k * FH + 0.1, cz, yaw, b);
  }
  buildings.push(b); return b;
}

/* ---------------- main build ---------------- */
const W = G.World = {
  heightAt, rampH, forBoxes, addBox, removeBox, buildings, roadDist, surfaceColor, slopeAt, H0, pads, roads,
  trees: [], rocks: [], vehicleSpawns: [], clouds: [], props: [],
  batchMat: null, scene: null, mapCanvas: null,
};

W.addChest = function (x, y, z, yaw, bld, style, rar) {
  style = style || (Math.random() < 0.3 ? 'metal' : 'wood'); rar = rar === undefined ? G.chestRarity(style) : rar;
  const grp = G.makeChest(style, rar); grp.position.set(x, y, z); grp.rotation.y = yaw; W.scene.add(grp);
  const c = { kind: 'chest', style, rar, x, y, z, yaw, opened: false, mesh: grp.userData.body, lid: grp.userData.lid, beam: grp.userData.beam, grp, bld };
  G.chests.push(c); return c;
};
W.openChest = function (c, by) {
  if (c.opened || c.falling) return; if (by && G.Anim) G.Anim.trigger(by, 'chest_open'); c.opened = true; c.lid.rotation.x = -1.9; c.beam.visible = false; if (c.onOpen) c.onOpen(c);
  for (const it of G.chestItems(c)) { const a = Math.random() * 6.28, r = G.rand(0.9, 1.9); G.addLoot(it, c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r, c.bld); }
};

W.destroyBox = function (b) {
  if (b.dead) return; removeBox(b);
  if (b.batch) b.batch.hide(b.bid);
  if (b.tree) { const t = b.tree; t.dead = true; const z = new T.Matrix4().makeScale(0, 0, 0); for (const im of t.insts) { im.m.setMatrixAt(im.i, z); im.m.instanceMatrix.needsUpdate = true; } }
  if (b.rock) { const z = new T.Matrix4().makeScale(0, 0, 0); b.rock.m.setMatrixAt(b.rock.i, z); b.rock.m.instanceMatrix.needsUpdate = true; }
  if (b.onDestroy) b.onDestroy(b);
};

function terrainMesh() {
  const W1 = N + 1, pos = new Float32Array(W1 * W1 * 3), col = new Float32Array(W1 * W1 * 3), c = new T.Color();
  for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) {
    const i = iz * W1 + ix, x = -HALF + ix * CELLV, z = -HALF + iz * CELLV, h = heights[i];
    pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
    const sl = Math.hypot(heights[iz * W1 + Math.min(N, ix + 1)] - heights[iz * W1 + Math.max(0, ix - 1)], heights[Math.min(N, iz + 1) * W1 + ix] - heights[Math.max(0, iz - 1) * W1 + ix]) / (2 * CELLV);
    surfaceColor(x, z, h, sl, c); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  // smooth normals over the whole grid (so chunk borders have no seams), then slice into frustum-culled chunks
  const nor = new Float32Array(W1 * W1 * 3);
  for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) { const hx = heights[iz * W1 + Math.min(N, ix + 1)] - heights[iz * W1 + Math.max(0, ix - 1)], hz = heights[Math.min(N, iz + 1) * W1 + ix] - heights[Math.max(0, iz - 1) * W1 + ix]; const nx = -hx / (2 * CELLV), nz = -hz / (2 * CELLV), l = Math.hypot(nx, 1, nz); const i = iz * W1 + ix; nor[i * 3] = nx / l; nor[i * 3 + 1] = 1 / l; nor[i * 3 + 2] = nz / l; }
  const grp = new T.Group(), CS = 25, mat = new T.MeshLambertMaterial({ vertexColors: true });
  for (let cz = 0; cz < N / CS; cz++) for (let cx = 0; cx < N / CS; cx++) {
    const w = CS + 1, p2 = new Float32Array(w * w * 3), c2 = new Float32Array(w * w * 3), n2 = new Float32Array(w * w * 3);
    for (let z = 0; z < w; z++) for (let x = 0; x < w; x++) { const si = (cz * CS + z) * W1 + cx * CS + x, di = z * w + x; for (let k = 0; k < 3; k++) { p2[di * 3 + k] = pos[si * 3 + k]; c2[di * 3 + k] = col[si * 3 + k]; n2[di * 3 + k] = nor[si * 3 + k]; } }
    const idx = new Uint16Array(CS * CS * 6); let k = 0;
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) { const a = z * w + x, b = (z + 1) * w + x, cc = (z + 1) * w + x + 1, d = z * w + x + 1; idx[k++] = a; idx[k++] = b; idx[k++] = d; idx[k++] = b; idx[k++] = cc; idx[k++] = d; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p2, 3)); g.setAttribute('color', new T.BufferAttribute(c2, 3)); g.setAttribute('normal', new T.BufferAttribute(n2, 3)); g.setIndex(new T.BufferAttribute(idx, 1)); g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new T.Mesh(g, mat); m.receiveShadow = true; grp.add(m);
  }
  return grp;
}

W.build = function (scene) {
  W.scene = scene; const rng = G.seeded(4242); const R = (a, b) => a + rng() * (b - a);
  W.batchMat = new T.MeshLambertMaterial({ vertexColors: true });
  // pads for POIs
  for (const p of G.POIS) { p.base = p.keep ? H0(p.x, p.z) : Math.max(2.6, H0(p.x, p.z)); pads.push({ x: p.x, z: p.z, r: p.r * 0.75, h: p.base }); }
  // roads
  const P = {}; G.POIS.forEach(p => P[p.id] = p);
  [['tumble', 'maple'], ['tumble', 'depot'], ['tumble', 'lagoon'], ['tumble', 'woods'], ['tumble', 'lodge'], ['maple', 'hollow'], ['depot', 'hollow']].forEach(([a, b]) => roads.push([P[a].x, P[a].z, P[b].x, P[b].z]));
  // lone buildings: choose spots and pads
  const lone = []; let tries = 0;
  while (lone.length < 14 && tries++ < 400) {
    const x = R(-400, 400), z = R(-400, 400); const h = H0(x, z); if (h < 2.5 || h > 24 || Math.hypot(x, z) > 400) continue;
    if (G.POIS.some(p => Math.hypot(x - p.x, z - p.z) < p.r + 35)) continue; if (lone.some(l => Math.hypot(x - l.x, z - l.z) < 70)) continue;
    if (Math.hypot(x - G.LK.x, z - G.LK.z) < G.LK.r + 20) continue;
    lone.push({ x, z, h }); pads.push({ x, z, r: 11, h });
  }
  if (G.Extras) G.Extras.sites(pads, roads, P, H0, rects, R);
  // height grid
  for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) heights[iz * (N + 1) + ix] = Hfull(-HALF + ix * CELLV, -HALF + iz * CELLV);
  scene.add(terrainMesh());
  // water
  { // stylised water: depth-tinted (from a baked terrain height texture), animated ripples + foam at the shore
    const TS = 256, hd = new Uint8Array(TS * TS * 4); for (let zi = 0; zi < TS; zi++) for (let xi = 0; xi < TS; xi++) { const h = heightAt(-HALF + (xi + 0.5) / TS * SZ, -HALF + (zi + 0.5) / TS * SZ); const v = Math.max(0, Math.min(255, Math.round((h + 40) / 120 * 255))); const o = (zi * TS + xi) * 4; hd[o] = hd[o + 1] = hd[o + 2] = v; hd[o + 3] = 255; }
    const ht = new T.DataTexture(hd, TS, TS, T.RGBAFormat); ht.magFilter = ht.minFilter = T.LinearFilter; ht.needsUpdate = true;
    const wu = T.UniformsUtils.merge([T.UniformsLib.fog, { time: { value: 0 }, hmap: { value: ht }, halfS: { value: HALF }, wy: { value: G.WATER_Y }, sunDir: { value: new T.Vector3(0.45, 0.75, 0.3).normalize() } }]); W.waterU = wu;
    const wm = new T.ShaderMaterial({ transparent: true, fog: true, uniforms: wu, depthWrite: false,
      vertexShader: 'varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix*wp; gl_Position = projectionMatrix*mvPosition;\n#include <fog_vertex>\n}',
      fragmentShader: 'uniform float time; uniform sampler2D hmap; uniform float halfS; uniform float wy; uniform vec3 sunDir; varying vec3 vW;\n#include <fog_pars_fragment>\n' +
        'float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); } float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x), mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x), f.y); }\n' +
        'void main(){ vec2 uv = vW.xz/(halfS*2.0)+0.5; float h = texture2D(hmap, uv).r*120.0-40.0; if (abs(uv.x-0.5)>0.5||abs(uv.y-0.5)>0.5) h = -40.0; float dep = clamp(wy - h, 0.0, 30.0);\n' +
        'vec2 p = vW.xz*0.35; float w1 = vn(p + vec2(time*0.6, time*0.35)), w2 = vn(p*2.3 - vec2(time*0.5, -time*0.4)); float rip = w1*0.6+w2*0.4;\n' +
        'vec3 shallow = vec3(0.28,0.86,0.9), deep = vec3(0.08,0.38,0.8); vec3 c = mix(shallow, deep, smoothstep(0.2, 9.0, dep)); c += (rip-0.5)*0.16;\n' +
        'float fo = smoothstep(1.1, 0.0, dep + (w1-0.5)*0.9 + sin(time*1.6 + vW.x*0.2 + vW.z*0.17)*0.18); c = mix(c, vec3(0.95,0.99,1.0), fo*0.85);\n' +
        'float cd = length(vW-cameraPosition); float near = 1.0-smoothstep(60.0,350.0,cd); float spec = pow(max(0.0, 1.0 - abs(rip-0.62)*5.0), 3.0)*0.3*(1.0-fo)*near; c += spec; c = mix(vec3(0.0)+mix(shallow,deep,smoothstep(0.2,9.0,dep)), c, 0.55+0.45*near);\n' +
        'gl_FragColor = vec4(c, mix(0.55, 0.9, smoothstep(0.0, 3.0, dep)) + fo*0.1);\n#include <fog_fragment>\n}' });
    const water = new T.Mesh(new T.PlaneGeometry(6000, 6000), wm); water.rotation.x = -Math.PI / 2; water.position.y = G.WATER_Y; water.renderOrder = 1; scene.add(water);
  }
  // buildings
  const stylePoi = {};
  function placeBuildings(p) {
    const st = STYLES[p.style]; let cnt = 0, att = 0;
    const grid = (p.style === 'town' || p.style === 'suburb' || p.style === 'industrial');
    const cand = [];
    if (grid) { const sx = p.style === 'industrial' ? 30 : p.style === 'town' ? 25 : 24, sz = p.style === 'industrial' ? 26 : 22; for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) { const x = p.x + gx * sx + R(-2.5, 2.5), z = p.z + gz * sz + R(-2.5, 2.5); if (Math.hypot(x - p.x, z - p.z) < p.r * 0.7) cand.push([x, z]); } cand.sort(() => rng() - 0.5); }
    while (cnt < p.n && att++ < 500) {
      let x, z; if (grid) { if (!cand.length) break; [x, z] = cand.pop(); } else { const a = R(0, 6.283), rr = Math.sqrt(rng()) * p.r * 0.62; x = p.x + Math.cos(a) * rr; z = p.z + Math.sin(a) * rr; }
      const w = Math.round(R(st.w[0], st.w[1])), d = Math.round(R(st.d[0], st.d[1])); const fl = Math.floor(R(st.fl[0], st.fl[1] + 0.999));
      if (rects.some(r => x - w / 2 - 4 < r.x1 && x + w / 2 + 4 > r.x0 && z - d / 2 - 4 < r.z1 && z + d / 2 + 4 > r.z0)) continue;
      if (roadDist(x, z) < 8) continue;
      rects.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
      const pal = p.snow ? { wall: 0xe8d9c0, roof: 0xf2f8ff } : null;
      let door = Math.floor(rng() * 4); const dx = p.x - x, dz = p.z - z; if (rng() < 0.6) door = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 3 : 2) : (dz > 0 ? 0 : 1);
      const rt = st.roof === 'mix' ? (rng() < 0.5 ? 'gable' : 'flat') : st.roof;
      makeBuilding({ x, z, w, d, floors: fl, base: p.base, style: p.style, door, poi: p.name, wall: pal ? pal.wall : st.walls[Math.floor(rng() * st.walls.length)], roof: pal ? pal.roof : st.roofs[Math.floor(rng() * st.roofs.length)], roof2: 0xeeeeee, floorCol: 0xd9cfbd, roofType: rt });
      cnt++;
    }
  }
  for (const p of G.POIS) placeBuildings(p);
  lone.forEach((l, i) => { const st = G.pick(['cabin', 'houses', 'suburb']); const S = STYLES[st]; const w = Math.round(R(S.w[0], S.w[1])), d = Math.round(R(S.d[0], S.d[1])); rects.push({ x0: l.x - w / 2, x1: l.x + w / 2, z0: l.z - d / 2, z1: l.z + d / 2 });
    makeBuilding({ x: l.x, z: l.z, w, d, floors: 1, base: l.h, style: st, door: Math.floor(rng() * 4), poi: 'Lone house', wall: S.walls[Math.floor(rng() * S.walls.length)], roof: S.roofs[Math.floor(rng() * S.roofs.length)], roof2: 0xeeeeee, floorCol: 0xd9cfbd, roofType: 'gable' }); });
  // landmark props
  const pb = new Batch();
  function propBox(x0, y0, z0, x1, y1, z1, col, collide, kind) { const id = pb.box(x0, y0, z0, x1, y1, z1, col); if (collide) addBox({ x0, x1, y0, y1, z0, z1, kind: kind || 'prop', mat: 'stone', hp: 1e9, batch: pb, bid: id, col }); }
  for (const p of G.POIS) {
    if (p.tower === 'clock') { const x = p.x + 38, z = p.z - 36, b = p.base; rects.push({ x0: x - 6, x1: x + 6, z0: z - 6, z1: z + 6 });
      propBox(x - 4, b - 1, z - 4, x + 4, b + 24, z + 4, 0xf3d9a4, true, 'tower'); propBox(x - 4.4, b + 10, z - 4.4, x + 4.4, b + 11, z + 4.4, 0xc0504a, false); propBox(x - 4.4, b + 23, z - 4.4, x + 4.4, b + 24.4, z + 4.4, 0xc0504a, false);
      pb.prism(x - 4.6, z - 4.6, x + 4.6, z + 4.6, b + 24.4, b + 31, false, 0x3a82e0);
      propBox(x - 2, b + 14, z + 4, x + 2, b + 18, z + 4.4, 0xffffff, false); propBox(x - 0.15, b + 16, z + 4.4, x + 0.15, b + 17.8, z + 4.6, 0x222222, false); propBox(x - 1.0, b + 16, z + 4.4, x, b + 16.3, z + 4.6, 0x222222, false);
      propBox(x - 2, b + 14, z - 4.4, x + 2, b + 18, z - 4, 0xffffff, false); }
    if (p.tower === 'water') { const x = p.x - 40, z = p.z + 44, b = p.base; rects.push({ x0: x - 6, x1: x + 6, z0: z - 6, z1: z + 6 });
      for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) propBox(x + dx - 0.35, b - 1, z + dz - 0.35, x + dx + 0.35, b + 14, z + dz + 0.35, 0x8c949c, true, 'tower');
      propBox(x - 4.5, b + 14, z - 4.5, x + 4.5, b + 20, z + 4.5, 0xd85a4a, false); pb.prism(x - 4.8, z - 4.8, x + 4.8, z + 4.8, b + 20, b + 24, false, 0x8c949c); propBox(x - 3.3, b + 4, z - 3.3, x + 3.3, b + 4.4, z + 3.3, 0x7a8288, false); }
    if (p.dock) { const x0 = p.x - 36, z = p.z + 6; for (let i = 0; i < 12; i++) propBox(x0 - i * 2.5, 0.0, z - 1.6, x0 - i * 2.5 + 2.4, 0.35, z + 1.6, i % 2 ? 0xa97542 : 0xb98550, true, 'floor'); for (let i = 0; i < 6; i++) { propBox(x0 - i * 5 - 0.2, -3, z - 1.9, x0 - i * 5 + 0.2, 0.9, z - 1.5, 0x6b4a2a, false); propBox(x0 - i * 5 - 0.2, -3, z + 1.5, x0 - i * 5 + 0.2, 0.9, z + 1.9, 0x6b4a2a, false); }
      W.dock = { x: x0 - 26, z: z, y: 0.4 }; }
    if (p.snow) { for (let i = 0; i < 5; i++) { const a = R(0, 6.28), r = R(10, 36), x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (rects.some(q => x > q.x0 - 3 && x < q.x1 + 3 && z > q.z0 - 3 && z < q.z1 + 3)) continue; const b = heightAt(x, z); const s = R(1.2, 2.2); pb.box(x - s, b - 0.5, z - s, x + s, b + s * 1.4, z + s, 0xf4fbff); } }
  }
  const pm = pb.build(W.batchMat); scene.add(pm);
  if (W.dock) G.addLoot(G.makeWeaponItem(null, 3), W.dock.x, W.dock.y, W.dock.z); if (W.dock) W.addChest(W.dock.x - 2, W.dock.y, W.dock.z + 0.9, 0, null);

  // outdoor loot
  for (const p of G.POIS) { for (let i = 0; i < 12; i++) { const a = R(0, 6.28), r = R(8, p.r * 0.95); const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; if (rects.some(q => x > q.x0 - 1 && x < q.x1 + 1 && z > q.z0 - 1 && z < q.z1 + 1)) continue; G.addLoot(G.randomFloorItem(), x, heightAt(x, z) + 0.1, z); } }
  for (let i = 0; i < 90; i++) { const x = R(-420, 420), z = R(-420, 420); const h = heightAt(x, z); if (h < 1 || Math.hypot(x, z) > 430) continue; G.addLoot(G.randomFloorItem(), x, h + 0.1, z); }

  // trees
  const pines = [], oaks = [];
  const forestPOI = G.POIS.filter(p => p.forest);
  let tcount = 0, ttry = 0;
  while (tcount < 2100 && ttry++ < 14000) {
    const x = R(-440, 440), z = R(-440, 440); const h = heightAt(x, z); if (h < 1.4 || h > 58) continue;
    const f = G.fbm(x * 0.008 + 100, z * 0.008, 3); let pr = f > 0.54 ? 0.7 : 0.07; for (const p of forestPOI) if (Math.hypot(x - p.x, z - p.z) < p.r * 1.7) pr = 0.85;
    if (rng() > pr) continue; if (roadDist(x, z) < 6) continue; if (slopeAt(x, z) > 0.75) continue; if (Math.hypot(x, z) > 440) continue;
    let bad = false; for (const q of rects) { if (x > q.x0 - 3.5 && x < q.x1 + 3.5 && z > q.z0 - 3.5 && z < q.z1 + 3.5) { bad = true; break; } } if (bad) continue;
    let nearP = false; for (const p of G.POIS) if (!p.forest && Math.hypot(x - p.x, z - p.z) < p.r * 0.9 && rng() < 0.85) nearP = true; if (nearP) continue;
    const pine = h > 22 || rng() < 0.45; const t = { x, z, y: h, s: R(0.8, 1.45), pine, hp: 6, dead: false, insts: [] };
    (pine ? pines : oaks).push(t); W.trees.push(t); tcount++;
  }
  const BdT = G.Builder, greyc = v => (Math.round(v * 255) << 16) | (Math.round(v * 255) << 8) | Math.round(v * 255);
  const trb = new BdT(); trb.cyl(0.22, 1, 0xffffff, 0, 0.5, 0, 'y', 0.34, 6); trb.cyl(0.5, 0.35, 0xdfdfdf, 0, 0.1, 0, 'y', 0.5, 6);
  const AG = G.Assets && G.Assets.treeGeos && G.Assets.treeGeos();
  const trunkGeo = AG ? AG.trunk : trb.geometry(trb.lit);
  const pnb = new BdT(); [[2.15, 2.3, 0.0, 0.74], [1.75, 2.3, 1.15, 0.86], [1.3, 2.2, 2.3, 0.96], [0.85, 1.8, 3.35, 1.0]].forEach(([r, h, y, v]) => pnb.cone(r, h, greyc(v), 0, y + h / 2, 0, 0, 0, 0, 7));
  const coneGeo = AG ? AG.pine : pnb.geometry(pnb.lit);
  const okb = new BdT(); okb.ico(1.7, greyc(0.9), 0, 0.2, 0, 1.05, 0.85, 1.05, 1); okb.ico(1.2, greyc(1.0), 0.9, 0.95, 0.2, 1, 0.9, 1, 0); okb.ico(1.1, greyc(0.98), -0.8, 0.8, -0.5, 1, 0.9, 1, 0); okb.ico(1.0, greyc(0.8), 0.2, -0.45, 0.9, 1, 0.8, 1, 0); okb.ico(0.9, greyc(1.0), -0.2, 1.5, 0.1, 1, 0.9, 1, 0);
  const oakGeo = AG ? AG.oak : okb.geometry(okb.lit);
  const nT = W.trees.length, nP = Math.max(1, pines.length), nO = Math.max(1, oaks.length);
  const tMat = new T.MeshLambertMaterial({ vertexColors: true, color: 0x9a6a3c }), fMat = new T.MeshLambertMaterial({ vertexColors: true });
  // spatial chunks (frustum culled manually every frame; instanced meshes can't use three's built-in culling)
  const CH = 110, chunks = new Map(); const chunkOf = (x, z) => { const k = Math.floor((x + 600) / CH) + ',' + Math.floor((z + 600) / CH); let c = chunks.get(k); if (!c) { c = { nT: 0, nP: 0, nO: 0, x0: Math.floor((x + 600) / CH) * CH - 600, z0: Math.floor((z + 600) / CH) * CH - 600 }; chunks.set(k, c); } return c; };
  for (const t of W.trees) { const c = chunkOf(t.x, t.z); t.c = c; c.nT++; if (t.pine) c.nP++; else c.nO++; }
  W.treeChunks = [];
  for (const c of chunks.values()) {
    c.mT = new T.InstancedMesh(trunkGeo, tMat, c.nT); c.mP = c.nP ? new T.InstancedMesh(coneGeo, fMat, c.nP) : null; c.mO = c.nO ? new T.InstancedMesh(oakGeo, fMat, c.nO) : null; c.iT = c.iP = c.iO = 0;
    for (const m of [c.mT, c.mP, c.mO]) if (m) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }
    c.box = new T.Box3(new T.Vector3(c.x0 - 4, -20, c.z0 - 4), new T.Vector3(c.x0 + CH + 4, 120, c.z0 + CH + 4)); W.treeChunks.push(c);
  }
  const mat4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(), col = new T.Color(), UP = new T.Vector3(0, 1, 0);
  const pineCols = [0x2e9a4a, 0x3aa84f, 0x278f5a, 0x4bb860], oakCols = [0x6fd24a, 0x58c43f, 0x8ada4c, 0x6fd24a, 0xf2b13a, 0xff8c5a, 0xf58fc0], trunkCols = [0x8a5a33, 0x9a6a3c, 0x7a4e2a];
  for (const t of W.trees) {
    const c = t.c; q.setFromAxisAngle(UP, R(0, 6.28));
    const th = t.pine ? 2.2 : 2.6; ps.set(t.x, t.y - 0.2, t.z); sc.set(t.s, th * t.s, t.s); mat4.compose(ps, q, sc); c.mT.setMatrixAt(c.iT, mat4); col.setHex(trunkCols[Math.floor(rng() * 3)]).multiplyScalar(1.6); c.mT.setColorAt(c.iT, col); t.insts.push({ m: c.mT, i: c.iT }); c.iT++;
    if (t.pine) {
      ps.set(t.x, t.y + th * t.s * 0.45, t.z); sc.set(t.s, t.s * 1.05, t.s); mat4.compose(ps, q, sc); c.mP.setMatrixAt(c.iP, mat4); col.setHex(pineCols[Math.floor(rng() * 4)]); if (t.y > 40) col.lerp(new T.Color(0xeaf6ff), 0.55); c.mP.setColorAt(c.iP, col); t.insts.push({ m: c.mP, i: c.iP }); c.iP++;
    } else {
      ps.set(t.x, t.y + th * t.s + 0.7 * t.s, t.z); sc.set(t.s, t.s * 0.95, t.s); mat4.compose(ps, q, sc); c.mO.setMatrixAt(c.iO, mat4); col.setHex(oakCols[Math.floor(rng() * oakCols.length)]); c.mO.setColorAt(c.iO, col); t.insts.push({ m: c.mO, i: c.iO }); c.iO++;
    }
    addBox({ x0: t.x - 0.4, x1: t.x + 0.4, z0: t.z - 0.4, z1: t.z + 0.4, y0: t.y - 1, y1: t.y + 5.5, kind: 'tree', mat: 'wood', hp: 6, tree: t, col: 0x8a5a33 }).tree = t; t.box = null;
  }
  for (const c of W.treeChunks) for (const m of [c.mT, c.mP, c.mO]) if (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  // rocks
  const rockGeo = (function () { const g = new T.IcosahedronGeometry(1, 1), p = g.attributes.position, cs = []; const hsh = (x, y, z) => { const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return n - Math.floor(n); };
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k), z = p.getZ(k); const d = 0.82 + 0.3 * hsh(Math.round(x * 50), Math.round(y * 50), Math.round(z * 50)); p.setXYZ(k, x * d, y * d * (y < 0 ? 0.6 : 1), z * d); }
    g.computeVertexNormals(); for (let k = 0; k < p.count; k += 3) { const ny = g.attributes.normal.getY(k); const v = 0.7 + 0.3 * Math.max(0, ny) + 0.08 * hsh(k, 1, 2); for (let m = 0; m < 3; m++) cs.push(v, v, v * 1.04); }
    g.setAttribute('color', new T.Float32BufferAttribute(cs, 3)); return g; })();
  const SG = G.Assets && G.Assets.sceneryGeos && G.Assets.sceneryGeos();
  const nR = 260, rockMeshes = SG ? SG.rock.map(g => { const m = new T.InstancedMesh(g, new T.MeshLambertMaterial({ vertexColors: true }), nR); m.castShadow = true; m.frustumCulled = false; scene.add(m); m.count = 0; return m; }) : [mRock0()];
  function mRock0() { const m = new T.InstancedMesh(rockGeo, new T.MeshLambertMaterial({ vertexColors: true }), nR); m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; }
  const rcnt = rockMeshes.map(() => 0);
  let rc = 0, rtry = 0; const rockCols = SG ? [0xffffff, 0xf0f0f4, 0xe2e4ea, 0xfaf6f0] : [0x9ea2ad, 0x8b8f9b, 0xaeb2bd, 0x7d8290];
  while (rc < nR && rtry++ < 5000) {
    const mtn = rng() < 0.4; let x, z; if (mtn) { const a = R(0, 6.28), r = R(30, 190); x = G.MT.x + Math.cos(a) * r; z = G.MT.z + Math.sin(a) * r; } else { x = R(-430, 430); z = R(-430, 430); }
    const h = heightAt(x, z); if (h < 1.5) continue; if (rects.some(q => x > q.x0 - 3 && x < q.x1 + 3 && z > q.z0 - 3 && z < q.z1 + 3)) continue; if (roadDist(x, z) < 5) continue; if (G.POIS.some(p => Math.hypot(x - p.x, z - p.z) < p.r * 0.8 && !p.snow)) continue;
    const s = R(1.1, 2.8) * (mtn ? 1.3 : 1); const vi = SG ? Math.floor(rng() * rockMeshes.length) : 0, mR = rockMeshes[vi], ri = rcnt[vi]++;
    if (SG) q.setFromAxisAngle(new T.Vector3(0, 1, 0), R(0, 6.28)); else q.setFromEuler(new T.Euler(R(0, 3), R(0, 6), R(0, 3)));
    ps.set(x, h + s * (SG ? 0.28 : 0.35), z); sc.set(s * R(1, 1.3), s * (SG ? R(0.8, 1.15) : 0.85), s * R(1, 1.3)); mat4.compose(ps, q, sc); mR.setMatrixAt(ri, mat4);
    col.setHex(rockCols[Math.floor(rng() * 4)]); mR.setColorAt(ri, col);
    const rr = s * 0.85; const bx = addBox({ x0: x - rr, x1: x + rr, z0: z - rr, z1: z + rr, y0: h - 1, y1: h + s * 1.1, kind: 'rock', mat: 'stone', hp: 8, col: 0x9ea2ad }); bx.rock = { m: mR, i: ri }; W.rocks.push(bx); rc++;
  }
  rockMeshes.forEach((m, k) => { m.count = rcnt[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  // decor from Blender: cottages + stone walls + wooden fences (instanced), with simple axis-aligned collision
  if (SG && SG.cottage) {
    const mk = (geo, mat, n) => { const m = new T.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
    const MC = mk(SG.cottage.lit, G.vcMat, 14), MG = SG.cottage.glow ? mk(SG.cottage.glow, G.glowMat, 14) : null, MW = mk(SG.wall, G.vcMat, 90), MF = mk(SG.fence, G.vcMat, 70);
    const nC = [0], nW = [0], nF = [0], taken = []; const Y = new T.Vector3(0, 1, 0), one = new T.Vector3(1, 1, 1);
    const put = (m, cnt, x, y, z, yaw) => { q.setFromAxisAngle(Y, yaw); ps.set(x, y, z); mat4.compose(ps, q, one); m.setMatrixAt(cnt[0]++, mat4); };
    const free = (x, z, rad) => { const hh = heightAt(x, z); if (hh < 2 || hh > 30) return false; if (Math.abs(heightAt(x + rad, z) - hh) > 0.9 || Math.abs(heightAt(x - rad, z) - hh) > 0.9 || Math.abs(heightAt(x, z + rad) - hh) > 0.9 || Math.abs(heightAt(x, z - rad) - hh) > 0.9) return false;
      if (rects.some(r => x > r.x0 - rad - 4 && x < r.x1 + rad + 4 && z > r.z0 - rad - 4 && z < r.z1 + rad + 4)) return false; if (roadDist(x, z) < rad + 3) return false; if (G.POIS.some(p => Math.hypot(x - p.x, z - p.z) < p.r * 0.85 + rad && !p.snow)) return false; return !taken.some(t => Math.hypot(x - t[0], z - t[1]) < t[2] + rad + 2); };
    const solid = (x0, z0, x1, z1, y0, y1, k) => addBox({ x0, x1, z0, z1, y0, y1, kind: k || 'prop', mat: 'stone', col: 0x8e8a84 });
    for (let n = 0, tries = 0; n < 12 && tries < 900; tries++) {
      const x = R(-400, 400), z = R(-400, 400); if (!free(x, z, 6)) continue; const k = Math.floor(rng() * 4), yaw = k * Math.PI / 2, hh = heightAt(x, z), swap = k % 2 === 1;
      const hx = (swap ? 2.7 : 3.2), hz = (swap ? 3.2 : 2.7);
      put(MC, nC, x, hh - 0.05, z, yaw); if (MG) MG.setMatrixAt(nC[0] - 1, mat4);
      solid(x - hx, z - hz, x + hx, z + hz, hh - 1, hh + 5.2, 'prop'); taken.push([x, z, 6]); n++;
      // little garden: 2 stone wall + 1 fence pieces in front of the door (door faces -z before yaw)
      const fx = Math.sin(yaw) * -1, fz = Math.cos(yaw) * -1; // facing vector of -z rotated by yaw about Y: (-sin, -cos)
      for (let w = 0; w < 2 && nW[0] < 88; w++) { const sd = w ? 1 : -1, px = x + (-fz) * sd * 3.6 + fx * 5.2 * 0 + (-fx) * 0, pz = z; /* placed on the sides */
        const cx = x + (swap ? 0 : sd * 6.2), cz = z + (swap ? sd * 6.2 : 0), wy = swap ? Math.PI / 2 : 0, hh2 = heightAt(cx, cz); if (Math.abs(hh2 - hh) > 1.0) continue;
        put(MW, nW, cx, hh2 - 0.03, cz, wy); const ex = swap ? 0.4 : 2.0, ez = swap ? 2.0 : 0.4; solid(cx - ex, cz - ez, cx + ex, cz + ez, hh2 - 1, hh2 + 1.0, 'prop'); }
    }
    for (let n = 0, tries = 0; n < 24 && tries < 900; tries++) { // stand-alone field walls / fences
      const x = R(-400, 400), z = R(-400, 400); if (!free(x, z, 3)) continue; const horiz = rng() < 0.5, fenceK = rng() < 0.5, hh = heightAt(x, z), ex = horiz ? 2.0 : 0.35, ez = horiz ? 0.35 : 2.0;
      for (let s = 0; s < 3; s++) { const cx = x + (horiz ? s * 4 : 0), cz = z + (horiz ? 0 : s * 4), h2 = heightAt(cx, cz); if (Math.abs(h2 - hh) > 0.8) break;
        if (fenceK) { if (nF[0] >= 68) break; put(MF, nF, cx, h2 - 0.03, cz, horiz ? 0 : Math.PI / 2); } else { if (nW[0] >= 88) break; put(MW, nW, cx, h2 - 0.03, cz, horiz ? 0 : Math.PI / 2); }
        solid(cx - ex, cz - ez, cx + ex, cz + ez, h2 - 1, h2 + (fenceK ? 1.1 : 1.0), 'prop'); }
      taken.push([x, z, 5]); n++;
    }
    for (const [m, c] of [[MC, nC], [MG, nC], [MW, nW], [MF, nF]]) if (m) { m.count = c[0]; m.instanceMatrix.needsUpdate = true; }
    W.decor = { cottages: nC[0], walls: nW[0], fences: nF[0], taken };
  }
  if (G.Extras) G.Extras.populate(scene, rects, R);
  // flowers
  const fg = new T.OctahedronGeometry(0.22, 0); const nF = 1600; const mF = new T.InstancedMesh(fg, new T.MeshLambertMaterial({ color: 0xffffff }), nF); let fc = 0; const fcols = [0xff6bb5, 0xffe14a, 0xffffff, 0xff8a3a, 0xa97bff];
  for (let i = 0; i < 6000 && fc < nF; i++) { const x = R(-430, 430), z = R(-430, 430); const h = heightAt(x, z); if (h < 1.8 || h > 30 || roadDist(x, z) < 4 || rects.some(r => x > r.x0 - 1 && x < r.x1 + 1 && z > r.z0 - 1 && z < r.z1 + 1)) continue; ps.set(x, h + 0.2, z); sc.set(1, 1, 1); q.identity(); mat4.compose(ps, q, sc); mF.setMatrixAt(fc, mat4); col.setHex(fcols[Math.floor(rng() * 5)]); mF.setColorAt(fc, col); fc++; }
  mF.count = fc; scene.add(mF);
  // vehicle spawns along roads
  for (let i = 0; i < roads.length; i++) { const r = roads[i]; for (const t of [0.3, 0.6]) { const x = r[0] + (r[2] - r[0]) * t + R(-3, 3), z = r[1] + (r[3] - r[1]) * t + R(-3, 3); if (heightAt(x, z) > 1.5 && !rects.some(q => x > q.x0 - 3 && x < q.x1 + 3 && z > q.z0 - 3 && z < q.z1 + 3)) W.vehicleSpawns.push({ x, z, yaw: Math.atan2(-(r[2] - r[0]), -(r[3] - r[1])) }); } }
  // clouds
  const cmat = new T.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.96, emissive: 0x6f87a0, emissiveIntensity: 0.55 });
  for (let i = 0; i < 18; i++) { const cb = new G.Builder(); const n = 5 + Math.floor(rng() * 4); const base = R(0.97, 1);
    for (let j = 0; j < n; j++) { const s2 = R(12, 26), px = j * 20 - n * 10 + R(-5, 5), py = R(-2, 5) + (1 - Math.abs(j - n / 2) / (n / 2)) * 8, pz = R(-9, 9); cb.ico(s2, 0xffffff, px, py, pz, 1.35, 0.62, 1, 1); cb.ico(s2 * 0.9, 0xc9d6ea, px, py - s2 * 0.18, pz, 1.4, 0.45, 1.05, 1); }
    const m = new T.Mesh(cb.geometry(cb.lit), cmat); m.position.set(R(-900, 900), R(170, 330), R(-900, 900)); m.scale.setScalar(R(0.9, 1.4)); scene.add(m); W.clouds.push(m); }
  W.renderMap();
};

const _fr = new T.Frustum(), _pm = new T.Matrix4();
W.updateClouds = function (dt) { for (const c of W.clouds) { c.position.x += dt * 3; if (c.position.x > 1100) c.position.x = -1100; } if (W.waterU) W.waterU.time.value += dt; };
/* per-frame frustum + distance culling of the tree chunks (instanced meshes) */
W.cullTrees = function (cam, far) { if (!W.treeChunks) return; cam.updateMatrixWorld(); _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm); const cx = cam.position.x, cz = cam.position.z;
  for (const c of W.treeChunks) { const dx = Math.max(c.x0 - cx, 0, cx - (c.x0 + 110)), dz = Math.max(c.z0 - cz, 0, cz - (c.z0 + 110)); const vis = dx * dx + dz * dz < far * far && _fr.intersectsBox(c.box); c.mT.visible = vis; if (c.mP) c.mP.visible = vis; if (c.mO) c.mO.visible = vis; } };

/* ---------------- minimap source image ---------------- */
W.renderMap = function () {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d'); const img = cx.createImageData(S, S); const c = new T.Color();
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = -HALF + (i + 0.5) * SZ / S, z = -HALF + (j + 0.5) * SZ / S; const h = heightAt(x, z); const sl = slopeAt(x, z);
    let r, g, b; if (h < -12) { r = 40; g = 120; b = 170; } else { surfaceColor(x, z, h, sl, c); c.convertLinearToSRGB(); const sh = 0.88 + Math.min(0.25, (h - 5) * 0.004) + (heightAt(x - 3, z - 3) - h) * 0.03; r = c.r * 255 * sh; g = c.g * 255 * sh; b = c.b * 255 * sh; if (h < -0.3) { r = 70 + h * 3; g = 170 + h * 5; b = 215; } }
    const k = (j * S + i) * 4; img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  // ocean outside island circle already blue; draw buildings
  for (const b of buildings) { const px = (b.x + HALF) / SZ * S, pz = (b.z + HALF) / SZ * S; cx.fillStyle = 'rgba(60,40,40,0.9)'; cx.fillRect(px - b.w / 2 * S / SZ - 0.5, pz - b.d / 2 * S / SZ - 0.5, b.w * S / SZ + 1, b.d * S / SZ + 1); }
  W.mapCanvas = cv;
};

/* ---------------- ground & collision queries ---------------- */
let gx = 0, gz = 0, gfeet = 0, gstep = 0, gbest = 0, gbox = null;
function gFn(b) {
  if (b.ramp !== undefined && b.ramp !== false && b.kind === 'ramp') {
    if (gx >= b.x0 && gx <= b.x1 && gz >= b.z0 && gz <= b.z1) { const s = rampH(b, gx, gz); if (s <= gfeet + gstep && s > gbest) { gbest = s; gbox = b; } }
    return;
  }
  if (b.kind === 'tree' || b.kind === 'rock') { if (!(gx > b.x0 && gx < b.x1 && gz > b.z0 && gz < b.z1)) return; }
  else if (!(gx > b.x0 - 0.2 && gx < b.x1 + 0.2 && gz > b.z0 - 0.2 && gz < b.z1 + 0.2)) return;
  if (b.y1 <= gfeet + gstep && b.y1 > gbest && b.kind !== 'tree' && b.kind !== 'rock') { gbest = b.y1; gbox = b; }
}
W.groundY = function (x, z, feet, step) {
  gx = x; gz = z; gfeet = feet; gstep = step === undefined ? 0.6 : step; gbest = Math.max(heightAt(x, z), G.WATER_Y - 1.3); gbox = null;
  forBoxes(x - 0.3, z - 0.3, x + 0.3, z + 0.3, gFn); W.support = gbox; return gbest;
};
let rx = 0, rz = 0, rfeet = 0, rr = 0, rh = 0, rhit = false;
function rFn(b) {
  let y1 = b.y1;
  if (b.kind === 'ramp') { const px = G.clamp(rx, b.x0, b.x1), pz = G.clamp(rz, b.z0, b.z1); const sh = rampH(b, px, pz); if (sh <= rfeet + STEP) return; y1 = sh; }
  else if (b.y1 <= rfeet + STEP) return;
  if (b.y0 >= rfeet + rh) return;
  const px = G.clamp(rx, b.x0, b.x1), pz = G.clamp(rz, b.z0, b.z1); const dx = rx - px, dz = rz - pz, d2 = dx * dx + dz * dz;
  if (d2 >= rr * rr) return;
  if (d2 > 1e-8) { const d = Math.sqrt(d2); rx = px + dx / d * rr; rz = pz + dz / d * rr; }
  else { const l = rx - b.x0, r = b.x1 - rx, t = rz - b.z0, bt = b.z1 - rz, m = Math.min(l, r, t, bt); if (m === l) rx = b.x0 - rr; else if (m === r) rx = b.x1 + rr; else if (m === t) rz = b.z0 - rr; else rz = b.z1 + rr; }
  rhit = true;
}
const outR = { x: 0, z: 0, hit: false };
W.resolveXZ = function (x, z, feet, r, hgt) {
  rx = x; rz = z; rfeet = feet; rr = r; rh = hgt || 1.8; rhit = false;
  for (let it = 0; it < 3; it++) { const was = rhit; rhit = false; forBoxes(rx - r - 0.1, rz - r - 0.1, rx + r + 0.1, rz + r + 0.1, rFn); if (!rhit) { rhit = was; break; } rhit = true; }
  outR.x = rx; outR.z = rz; outR.hit = rhit; return outR;
};
// ceiling: lowest slab bottom above head
let cx_ = 0, cz_ = 0, cy_ = 0, cbest = 1e9;
function cFn(b) { if (b.kind === 'tree' || b.kind === 'rock' || b.kind === 'wall' || b.kind === 'ramp') return; if (cx_ > b.x0 - 0.2 && cx_ < b.x1 + 0.2 && cz_ > b.z0 - 0.2 && cz_ < b.z1 + 0.2 && b.y0 >= cy_ && b.y0 < cbest) cbest = b.y0; }
W.ceilingAt = function (x, z, headY) { cx_ = x; cz_ = z; cy_ = headY - 0.3; cbest = 1e9; forBoxes(x - 0.3, z - 0.3, x + 0.3, z + 0.3, cFn); return cbest; };

/* ---------------- raycast vs colliders + terrain ---------------- */
function rayBox(b, ox, oy, oz, dx, dy, dz, best) {
  if (b.kind === 'ramp') {
    const sx = b.x1 - b.x0, sz = b.z1 - b.z0; let u0, du;
    if (b.ramp === 0) { u0 = (ox - b.x0) / sx; du = dx / sx; } else if (b.ramp === 2) { u0 = (b.x1 - ox) / sx; du = -dx / sx; } else if (b.ramp === 1) { u0 = (oz - b.z0) / sz; du = dz / sz; } else { u0 = (b.z1 - oz) / sz; du = -dz / sz; }
    const k = b.y1 - b.y0; const h0 = oy - (b.y0 + k * u0), hp = dy - k * du; if (Math.abs(hp) < 1e-9) return -1; const t = -h0 / hp; if (t < 0 || t >= best) return -1;
    const px = ox + dx * t, pz = oz + dz * t; if (px < b.x0 - 0.01 || px > b.x1 + 0.01 || pz < b.z0 - 0.01 || pz > b.z1 + 0.01) return -1; return t;
  }
  let t0 = 0, t1 = best;
  if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) return -1; } else { let a = (b.x0 - ox) / dx, c = (b.x1 - ox) / dx; if (a > c) { const t = a; a = c; c = t; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1; }
  if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) return -1; } else { let a = (b.y0 - oy) / dy, c = (b.y1 - oy) / dy; if (a > c) { const t = a; a = c; c = t; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1; }
  if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) return -1; } else { let a = (b.z0 - oz) / dz, c = (b.z1 - oz) / dz; if (a > c) { const t = a; a = c; c = t; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) return -1; }
  if (t0 <= 0.0001) return -1; return t0 < best ? t0 : -1;
}
const RC = { t: 0, box: null, terrain: false, x: 0, y: 0, z: 0 };
W.raycast = function (ox, oy, oz, dx, dy, dz, maxT, noTerrain) {
  let best = maxT, hb = null, ht = false;
  if (!noTerrain) {
    const stp = 1.5; let pt = 0;
    for (let t = stp; ; t += stp) { const tt = t > best ? best : t; const px = ox + dx * tt, py = oy + dy * tt, pz = oz + dz * tt; if (py < heightAt(px, pz) && py > -20) { let a = pt, c = tt; for (let i = 0; i < 7; i++) { const m = (a + c) / 2; if (oy + dy * m < heightAt(ox + dx * m, oz + dz * m)) c = m; else a = m; } best = c; ht = true; break; } pt = tt; if (tt >= best) break; if (dy > 0 && py > 130) break; }
  }
  const C = CS; let cx = Math.floor((ox + OFF) / C), cz = Math.floor((oz + OFF) / C); const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = Math.abs(dx) > 1e-9 ? C / Math.abs(dx) : Infinity, tdz = Math.abs(dz) > 1e-9 ? C / Math.abs(dz) : Infinity;
  let tmx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (cx + 1) : cx) * C - OFF - ox) / dx : Infinity, tmz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (cz + 1) : cz) * C - OFF - oz) / dz : Infinity;
  const st = ++stampN;
  for (let it = 0; it < 160; it++) {
    if (cx >= 0 && cz >= 0 && cx < GW && cz < GW) { const a = cells[cz * GW + cx]; for (let i = 0; i < a.length; i++) { const b = a[i]; if (b.stamp === st) continue; b.stamp = st; const t = rayBox(b, ox, oy, oz, dx, dy, dz, best); if (t >= 0) { best = t; hb = b; ht = false; } } }
    const nt = tmx < tmz ? tmx : tmz; if (nt > best) break; if (tmx < tmz) { cx += sx; tmx += tdx; } else { cz += sz; tmz += tdz; }
  }
  RC.t = best; RC.box = hb; RC.terrain = ht; RC.x = ox + dx * best; RC.y = oy + dy * best; RC.z = oz + dz * best; RC.hit = !!(hb || ht); return RC;
};
// quick LOS test between two points
W.los = function (ax, ay, az, bx, by, bz) { const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz); if (d < 0.01) return true; const r = W.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.3); return !r.hit; };
// is a walking probe blocked?
W.blocked = function (x, z, feet, r) {
  const g = W.groundY(x, z, feet, 0.6); if (g - feet > 1.0) return true; if (heightAt(x, z) < G.WATER_Y - 3.0) return true;
  const o = W.resolveXZ(x, z, feet, r, 1.8); return o.hit;
};
})();
