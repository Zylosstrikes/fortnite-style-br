'use strict';
/* Lobby scene: a snowy pine forest at dusk with a glowing character platform, candy-cane lamp posts, a spooky manor in the fog,
   drifting snow and empty party-slot discs.  100% original, generated from primitives. */
(function () {
const G = window.G, T = THREE; const L = G.Lobby = {};
let seed = 1234; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, R = (a, b) => a + (b - a) * rnd();

L.slots = [{ x: -2.0, z: 0.5 }, { x: 2.0, z: 0.5 }, { x: -3.5, z: 1.9 }, { x: 3.5, z: 1.9 }];   // party slot discs (world space, character at origin)

L.build = function (scene) {
  scene.background = new T.Color(0x0b2d45); scene.fog = new T.Fog(0x16597a, 12, 95);
  scene.add(new T.HemisphereLight(0xa6d2ff, 0x274a66, 0.95));
  const key = new T.DirectionalLight(0xd8ecff, 0.85); key.position.set(3, 6, -5); scene.add(key);
  const rim = new T.DirectionalLight(0x58c8ff, 1.1); rim.position.set(-4, 3.5, 5); scene.add(rim);
  const warm = new T.DirectionalLight(0xffc890, 0.35); warm.position.set(5, 2, -2); scene.add(warm);
  // ---- ground: snow with soft drifts, clearing in the middle
  const gg = new T.PlaneGeometry(120, 90, 60, 45); gg.rotateX(-Math.PI / 2); const p = gg.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const d = Math.hypot(x, z - 2); const h = (Math.sin(x * 0.35) * Math.cos(z * 0.3) + Math.sin(x * 0.13 + z * 0.17)) * 0.35 * Math.min(1, Math.max(0, (d - 5) / 8)); p.setY(i, h - 0.02);
    const k = 0.86 + 0.14 * Math.sin(x * 0.8 + z * 0.6); const c = new T.Color(0xcfe6f6).multiplyScalar(k); col.push(c.r, c.g, c.b); }
  gg.setAttribute('color', new T.Float32BufferAttribute(col, 3)); gg.computeVertexNormals(); const ground = new T.Mesh(gg, new T.MeshLambertMaterial({ vertexColors: true })); ground.position.z = 14; ground.receiveShadow = true; scene.add(ground);
  // ---- pines (one instanced mesh): trunk + 4 tiers with snow caps
  const tb = new G.Builder(); tb.cyl(0.25, 1.4, 0x5a3a2a, 0, 0.7, 0, 'y', 0.33, 6);
  [[2.0, 2.4, 1.2, 0x1d5b60], [1.6, 2.2, 2.5, 0x226a68], [1.2, 2.0, 3.7, 0x2a7a70], [0.8, 1.7, 4.8, 0x338a78]].forEach(([r, h, y, c]) => { tb.cone(r, h, c, 0, y + h / 2, 0, 0, 0, 0, 8); tb.cone(r * 0.82, h * 0.42, 0xf2f9ff, 0, y + h * 0.78, 0, 0, 0, 0, 8); tb.cone(r * 1.02, 0.1, 0xe4f1fb, 0, y + 0.06, 0, 0, 0, 0, 8); });
  const treeGeo = tb.geometry(tb.lit); const N = 190; const trees = new T.InstancedMesh(treeGeo, G.vcMat, N); const m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3(); let n = 0;
  for (let tries = 0; tries < 900 && n < N; tries++) {
    const x = R(-34, 34), z = R(-1, 50); if (Math.abs(x) < 9 && z < 12) continue; if (Math.abs(x) < 6 && z < 18) continue; if (z < 8 && Math.abs(x) < 15 && rnd() < 0.6) continue; if (x > -6 && x < 18 && z > 12 && z < 46) continue;
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
  // ---- spooky manor far behind the trees
  const hb = new G.Builder(), wall = 0x6a6aa8, roof = 0x302e60, trim = 0x8888c4, win = 0xffb347, win2 = 0xb98cff;
  hb.box(14, 7, 8, wall, 0, 3.5, 0); hb.box(5, 11, 5, wall, -6, 5.5, 1); hb.box(4, 9, 4, wall, 7.5, 4.5, -0.5);
  hb.cone(5.6, 5, roof, -6, 13.5, 1, 0, Math.PI / 4, 0, 4); hb.cone(4.4, 4, roof, 7.5, 11, -0.5, 0, Math.PI / 4, 0, 4);
  hb.box(15, 1.2, 9, roof, 0, 7.4, 0); hb.box(11, 2.6, 6, roof, 0, 8.6, 0); hb.box(14.4, 0.4, 8.4, trim, 0, 7.0, 0);
  for (let i = 0; i < 5; i++) { const x = -4.5 + i * 2.4; hb.box(0.9, 1.5, 0.2, i % 2 ? win2 : win, x, 4.8, -4.05, 0, 0, 0, true); hb.box(0.9, 1.5, 0.2, i % 3 ? win : win2, x, 2.2, -4.05, 0, 0, 0, true); }
  hb.box(1.2, 2.4, 0.25, win, -6, 8.5, -1.55, 0, 0, 0, true); hb.box(1.0, 2.0, 0.25, win2, -6, 5.5, -1.55, 0, 0, 0, true); hb.box(1.1, 1.8, 0.25, win, 7.5, 6.5, -2.55, 0, 0, 0, true);
  hb.box(2, 3, 0.3, 0x2a1f3a, 0, 1.5, -4.1);
  for (let i = 0; i < 18; i++) hb.box(0.2, 1.6, 0.2, 0x25253f, -9 + i, 0.8, -7.5);
  const house = G.bakeBuilder(hb, { outline: true }); house.position.set(5, 0, 44); house.rotation.y = 0.12; house.scale.setScalar(0.85); scene.add(house); L.house = house;
  // ---- character platform: dark disc + glowing ring + light shaft + soft shadow
  const plat = new T.Group();
  const disc = new T.Mesh(new T.CylinderGeometry(0.95, 1.02, 0.1, 40), new T.MeshLambertMaterial({ color: 0x1b3550 })); disc.position.y = -0.05; plat.add(disc);
  const glowTop = new T.Mesh(new T.CylinderGeometry(0.86, 0.86, 0.02, 40), new T.MeshBasicMaterial({ color: 0x9fe8ff, fog: false })); glowTop.position.y = 0.005; plat.add(glowTop);
  const ring = new T.Mesh(new T.TorusGeometry(0.97, 0.035, 8, 56), new T.MeshBasicMaterial({ color: 0x6fe0ff, fog: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; plat.add(ring);
  const shaft = new T.Mesh(new T.CylinderGeometry(0.78, 0.92, 6, 28, 1, true), new T.MeshBasicMaterial({ color: 0x3fc4ff, transparent: true, opacity: 0.13, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); shaft.position.y = 3; plat.add(shaft);
  const halo = new T.Mesh(new T.CircleGeometry(2.6, 40), new T.MeshBasicMaterial({ color: 0x3fb8ff, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, fog: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.02; plat.add(halo);
  const pl = new T.PointLight(0x58c8ff, 1.6, 7); pl.position.set(0, 0.6, -0.6); plat.add(pl); scene.add(plat); L.shaft = shaft; L.ring = ring; L.halo = halo;
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
  p.needsUpdate = true; L.shaft.material.opacity = 0.12 + Math.sin(L.t * 1.6) * 0.03; L.halo.scale.setScalar(1 + Math.sin(L.t * 1.6) * 0.03);
  if (L.house) L.house.position.x = 5 + Math.sin(L.t * 0.05) * 0.2;
};
})();
