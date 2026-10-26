'use strict';
/* Lobby scene: a snowy pine forest at dusk with a glowing character platform, candy-cane lamp posts, a spooky manor in the fog,
   drifting snow and empty party-slot discs.  100% original, generated from primitives. */
(function () {
const G = window.G, T = THREE; const L = G.Lobby = {};
let seed = 1234; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, R = (a, b) => a + (b - a) * rnd();

L.slots = [{ x: -2.0, z: 0.5 }, { x: 2.0, z: 0.5 }, { x: -3.5, z: 1.9 }, { x: 3.5, z: 1.9 }];   // party slot discs (world space, character at origin)

L.build = function (scene) {
  scene.background = new T.Color(0x060d24); scene.fog = new T.Fog(0x101c3e, 11, 78);
  L.hemi = new T.HemisphereLight(0x8aa0ff, 0x1c2040, 0.4); scene.add(L.hemi);
  const key = new T.DirectionalLight(0xc8dcff, 0.45); key.position.set(3, 6, -5); scene.add(key);
  const spot = new T.SpotLight(0xdff0ff, 1.0, 22, 0.55, 0.65, 1.2); spot.position.set(-1.5, 7.5, -4.5); spot.target.position.set(0, 1.0, 0); scene.add(spot, spot.target); L.spot = spot;
  const rim = new T.DirectionalLight(0x6a8cff, 0.7); rim.position.set(-4, 3.5, 5); scene.add(rim);
  const warm = new T.DirectionalLight(0xff9a50, 0.28); warm.position.set(5, 2, 4); scene.add(warm);
  // ---- ground: snow with soft drifts, clearing in the middle
  const gg = new T.PlaneGeometry(120, 90, 60, 45); gg.rotateX(-Math.PI / 2); const p = gg.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const d = Math.hypot(x, z - 2); const h = (Math.sin(x * 0.35) * Math.cos(z * 0.3) + Math.sin(x * 0.13 + z * 0.17)) * 0.35 * Math.min(1, Math.max(0, (d - 5) / 8)); p.setY(i, h - 0.02);
    const k = 0.86 + 0.14 * Math.sin(x * 0.8 + z * 0.6); const c = new T.Color(0xaec6e2).multiplyScalar(k * 0.85); col.push(c.r, c.g, c.b); }
  gg.setAttribute('color', new T.Float32BufferAttribute(col, 3)); gg.computeVertexNormals(); const ground = new T.Mesh(gg, new T.MeshLambertMaterial({ vertexColors: true })); ground.position.z = 14; ground.receiveShadow = true; scene.add(ground);
  // ---- pines (one instanced mesh): trunk + 4 tiers with snow caps
  const tb = new G.Builder(); tb.cyl(0.25, 1.4, 0x5a3a2a, 0, 0.7, 0, 'y', 0.33, 6);
  [[2.0, 2.4, 1.2, 0x123a48], [1.6, 2.2, 2.5, 0x16463f], [1.2, 2.0, 3.7, 0x1c5648], [0.8, 1.7, 4.8, 0x246654]].forEach(([r, h, y, c]) => { tb.cone(r, h, c, 0, y + h / 2, 0, 0, 0, 0, 8); tb.cone(r * 0.82, h * 0.42, 0xf2f9ff, 0, y + h * 0.78, 0, 0, 0, 0, 8); tb.cone(r * 1.02, 0.1, 0xe4f1fb, 0, y + 0.06, 0, 0, 0, 0, 8); });
  const treeGeo = tb.geometry(tb.lit); const N = 190; const trees = new T.InstancedMesh(treeGeo, G.vcMat, N); const m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(); let n = 0;
  for (let tries = 0; tries < 900 && n < N; tries++) {
    const x = R(-34, 34), z = R(-1, 60); if (Math.abs(x) < 9 && z < 12) continue; if (Math.abs(x) < 6 && z < 18) continue; if (z < 8 && Math.abs(x) < 15 && rnd() < 0.6) continue; if (x > -8 && x < 24 && z > 14 && z < 56) continue;
    const s = R(0.55, 1.15) * (z > 26 ? 1.4 : 1); q.setFromAxisAngle(new T.Vector3(0, 1, 0), R(0, 6.28)); ps.set(x, 0, z); sc.set(s, s * R(0.9, 1.25), s); m.compose(ps, q, sc); trees.setMatrixAt(n++, m);
  }
  trees.count = n; trees.frustumCulled = false; scene.add(trees);
  // ---- candy-cane lamp posts (striped tube + glow bulb)
  const cane = (x, z, s, rot) => { const pts = [new T.Vector3(0, 0, 0), new T.Vector3(0, 1.2, 0), new T.Vector3(0, 2.0, 0), new T.Vector3(0.12, 2.5, 0), new T.Vector3(0.5, 2.78, 0), new T.Vector3(0.95, 2.6, 0), new T.Vector3(1.1, 2.15, 0)];
    const geo = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 48, 0.14, 8, false); const pa = geo.attributes.position, cl = []; const seg = 9;
    for (let i = 0; i < pa.count; i++) { const ring = Math.floor(i / 9), on = Math.floor(ring / 2) % 2 === 0; const c = on ? new T.Color(0xe8404a) : new T.Color(0xfdf6f0); cl.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new T.Float32BufferAttribute(cl, 3)); const g = new T.Group(); const mesh = new T.Mesh(geo, G.vcMat); g.add(mesh);
    const bulb = new T.Mesh(new T.SphereGeometry(0.17, 10, 8), new T.MeshBasicMaterial({ color: 0xffe8a0, fog: false })); bulb.position.set(1.1, 2.0, 0); g.add(bulb);
    g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = rot; scene.add(g); return g; };
  [[-6.2, 5, 1.0, 0.5], [6.4, 4.2, 1.0, 2.7], [-9.5, 10, 1.2, 0.2], [9.2, 9, 1.2, 3.0], [-5.2, 15, 1.4, 1.0], [-12, 6, 1.1, 2.2]].forEach(a => cane(...a));
  // ---- spooky manor (Blender model manor.glb; falls back to a primitive silhouette)
  let house = G.Assets && G.Assets.manor && G.Assets.manor();
  if (house) { house.position.set(8, 0, 50); house.scale.setScalar(1.25); house.rotation.y = 0.08; }
  else {
    const hb = new G.Builder(), wall = 0x34314f, roof = 0x16132a, win = 0xffb347, win2 = 0xb98cff;
    hb.box(14, 7, 8, wall, 0, 3.5, 0); hb.box(5, 11, 5, wall, -6, 5.5, 1); hb.box(4, 9, 4, wall, 7.5, 4.5, -0.5); hb.cone(5.6, 5, roof, -6, 13.5, 1, 0, Math.PI / 4, 0, 4); hb.cone(4.4, 4, roof, 7.5, 11, -0.5, 0, Math.PI / 4, 0, 4); hb.box(15, 1.2, 9, roof, 0, 7.4, 0);
    for (let i = 0; i < 5; i++) { const x = -4.5 + i * 2.4; hb.box(0.9, 1.5, 0.2, i % 2 ? win2 : win, x, 4.8, -4.05, 0, 0, 0, true); hb.box(0.9, 1.5, 0.2, i % 3 ? win : win2, x, 2.2, -4.05, 0, 0, 0, true); }
    house = G.bakeBuilder(hb, { outline: false }); house.position.set(5, 0, 40); house.scale.setScalar(0.9);
  }
  scene.add(house); L.house = house; L.houseX = house.position.x; L.houseZ = house.position.z;
  // window glow on the snow in front of the manor (flickering warm lights)
  L.lamps = [[-3, 5, -9], [3, 5, -9], [0, 3, -14]].map((o, i) => { const pl = new T.PointLight(i == 2 ? 0xffa850 : 0xff9a3a, 1.3, 26, 1.6); pl.position.set(L.houseX + o[0] * 1.1, o[1], L.houseZ + o[2] * 1.1); scene.add(pl); return pl; });
  // low ground fog banks (soft sprites), drifting bats, distant moon
  const fogTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(160,180,230,0.55)'); g.addColorStop(1, 'rgba(160,180,230,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  L.fogs = []; for (let i = 0; i < 12; i++) { const m = new T.Mesh(new T.PlaneGeometry(16, 16), new T.MeshBasicMaterial({ map: fogTex, transparent: true, opacity: 0.22 + rnd() * 0.12, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(R(-14, 22), 0.5 + rnd() * 0.5, R(8, 44)); m.userData.sp = R(0.15, 0.4); scene.add(m); L.fogs.push(m); }
  const batG = new T.BufferGeometry(); batG.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, -0.5, 0.15, 0.2, -0.2, 0, 0.3, 0, 0, 0, 0.5, 0.15, 0.2, 0.2, 0, 0.3], 3)); const batM = new T.MeshBasicMaterial({ color: 0x07070f, side: T.DoubleSide, fog: false });
  L.bats = []; for (let i = 0; i < 7; i++) { const b = new T.Mesh(batG, batM); b.scale.setScalar(1.1 + rnd() * 0.5); b.userData = { a: rnd() * 6.28, r: R(6, 14), y: R(9, 17), s: R(0.5, 1.1) * (i % 2 ? 1 : -1) }; scene.add(b); L.bats.push(b); }
  // ---- character platform: dark disc + glowing ring + light shaft + soft shadow
  const plat = new T.Group();
  const disc = new T.Mesh(new T.CylinderGeometry(0.95, 1.02, 0.1, 40), new T.MeshLambertMaterial({ color: 0x1b3550 })); disc.position.y = -0.05; plat.add(disc);
  const glowTop = new T.Mesh(new T.CylinderGeometry(0.86, 0.86, 0.02, 40), new T.MeshBasicMaterial({ color: 0x9fe8ff, fog: false })); glowTop.position.y = 0.005; plat.add(glowTop);
  const ring = new T.Mesh(new T.TorusGeometry(0.97, 0.035, 8, 56), new T.MeshBasicMaterial({ color: 0x6fe0ff, fog: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; plat.add(ring);
  const shaft = new T.Mesh(new T.CylinderGeometry(0.78, 0.92, 6, 28, 1, true), new T.MeshBasicMaterial({ color: 0x3fc4ff, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide, fog: false })); shaft.position.y = 3; plat.add(shaft);
  const halo = new T.Mesh(new T.CircleGeometry(2.6, 40), new T.MeshBasicMaterial({ color: 0x3fb8ff, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, fog: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.02; plat.add(halo);
  const pl = new T.PointLight(0x58c8ff, 0.5, 7); pl.position.set(0, 0.6, -0.6); plat.add(pl); scene.add(plat); L.shaft = shaft; L.ring = ring; L.halo = halo;
  // ---- party slots: dim discs on the snow
  L.slotMeshes = L.slots.map(s => { const g = new T.Group(); const d = new T.Mesh(new T.CylinderGeometry(0.5, 0.54, 0.06, 32), new T.MeshLambertMaterial({ color: 0x24465f })); d.position.y = -0.03; g.add(d);
    const r = new T.Mesh(new T.TorusGeometry(0.52, 0.02, 6, 40), new T.MeshBasicMaterial({ color: 0x4aa8d8, transparent: true, opacity: 0.8, fog: false })); r.rotation.x = Math.PI / 2; r.position.y = 0.005; g.add(r);
    g.position.set(s.x, 0, s.z); scene.add(g); return g; });
  // ---- moon
  const moon = new T.Mesh(new T.CircleGeometry(5, 28), new T.MeshBasicMaterial({ color: 0xeaf6ff, fog: false })); moon.position.set(-26, 16, 85); moon.rotation.y = Math.PI; scene.add(moon);
  const mh = new T.Mesh(new T.CircleGeometry(11, 28), new T.MeshBasicMaterial({ color: 0x7cc8ff, transparent: true, opacity: 0.22, fog: false, depthWrite: false })); mh.position.set(-26, 16, 84.5); mh.rotation.y = Math.PI; scene.add(mh);
  // ---- drifting snow
  const SN = 700, sp = new Float32Array(SN * 3); L.snowSpd = new Float32Array(SN);
  for (let i = 0; i < SN; i++) { sp[i * 3] = R(-16, 16); sp[i * 3 + 1] = R(0, 10); sp[i * 3 + 2] = R(-5, 24); L.snowSpd[i] = R(0.35, 0.95); }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
  const sc2 = document.createElement('canvas'); sc2.width = sc2.height = 32; const cx = sc2.getContext('2d'); const gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
  L.snow = new T.Points(sg, new T.PointsMaterial({ size: 0.16, map: new T.CanvasTexture(sc2), transparent: true, depthWrite: false, fog: false, opacity: 0.95 })); L.snow.frustumCulled = false; scene.add(L.snow);
  L.t = 0;
};

L.update = function (dt) {
  L.t += dt; const p = L.snow.geometry.attributes.position, a = p.array, N = a.length / 3;
  for (let i = 0; i < N; i++) { a[i * 3 + 1] -= L.snowSpd[i] * dt; a[i * 3] += Math.sin(L.t * 0.6 + i) * dt * 0.25 - dt * 0.12; if (a[i * 3 + 1] < 0) { a[i * 3 + 1] = 10; a[i * 3] = (Math.random() - 0.5) * 32; } if (a[i * 3] < -16) a[i * 3] = 16; }
  p.needsUpdate = true; L.shaft.material.opacity = 0.18 + Math.sin(L.t * 1.6) * 0.03; L.halo.scale.setScalar(1 + Math.sin(L.t * 1.6) * 0.03);
  L.lamps.forEach((p, i) => { p.intensity = 1.1 + Math.sin(L.t * (3 + i) + i * 2) * 0.2 + Math.sin(L.t * 11 + i) * 0.1; });
  L.fogs.forEach(f => { f.position.x += f.userData.sp * dt; if (f.position.x > 26) f.position.x = -16; });
  L.bats.forEach(b => { const u = b.userData; u.a += u.s * dt * 0.4; b.position.set(L.houseX + Math.cos(u.a) * u.r, u.y + Math.sin(L.t * 1.3 + u.a * 3) * 0.8, L.houseZ + Math.sin(u.a) * u.r * 0.7); b.rotation.y = -u.a + (u.s > 0 ? Math.PI : 0); b.scale.y = 0.5 + Math.abs(Math.sin(L.t * 9 + u.a * 5)) * 1.0; });
  L.flashT = (L.flashT === undefined ? 6 : L.flashT) - dt; if (L.flashT < 0) { L.flashT = 8 + Math.random() * 9; L.flash = 0.45; } if (L.flash > 0) { L.flash -= dt; const k = Math.max(0, L.flash) / 0.45; L.hemi.intensity = 0.4 + k * (0.8 + Math.sin(L.t * 70) * 0.4); } else L.hemi.intensity = 0.4;
};
})();
