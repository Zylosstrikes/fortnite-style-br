'use strict';
/* Main: renderer, input, camera, storm, bus, game flow */
(function () {
const G = window.G, T = THREE, $ = id => document.getElementById(id), Q = new URLSearchParams(location.search);
const NOLOCK = !!(navigator.webdriver || Q.has('nolock'));
const state = G.state = { phase: 'loading', paused: false, mapOpen: false, helpOpen: false, ended: false, spec: null, deathTime: 0, matchOver: false };
let renderer, scene, camera, sun, sky, sunDisc, stormMesh, stormMat, lootViz = [], ghost = {}, lastT = 0, orbit = Math.random() * 6;
const keys = G.keys = {}; const mouse = { l: false, r: false, lEdge: false }; let yaw = 0, pitch = 0, fovCur = 72;
G.setLook = (y, p) => { yaw = y; pitch = p; };
/* One look path for mouse, touch and arrow keys: sensitivity, invert-Y and pitch limit all live here. */
const LS = G.settings; let lobbyYaw = 0, lobbyElev = 0;
const pitchMax = () => LS.pitch * Math.PI / 180;
function lookBy(dx, dy, base) { const z = G.scoped ? 0.35 : mouse.r ? 0.7 : 1, k = base * LS.sens * z; yaw -= dx * k; pitch = G.clamp(pitch - dy * k * (LS.invertY ? -1 : 1), -pitchMax(), pitchMax()); }
G.lookBy = lookBy; G.onSettings = () => { pitch = G.clamp(pitch, -pitchMax(), pitchMax()); };
let dragging = false, dragX = 0, dragY = 0, dragMoved = 0, dragT = 0, everLocked = false; const dragMode = () => NOLOCK || !!G.lockFailed || !$('c').requestPointerLock;
window.addEventListener('error', e => { const b = $('errbox'); b.style.display = 'block'; b.textContent = 'Error: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')'; });

/* ================= init ================= */
function init() {
  const canvas = $('c'); renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6)); renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  scene = G.scene = new T.Scene(); scene.fog = new T.Fog(0xcfe9ff, 260, 1150);
  camera = G.cam = new T.PerspectiveCamera(72, innerWidth / innerHeight, 0.15, 3000); camera.rotation.order = 'YXZ';
  scene.add(new T.HemisphereLight(0xdff1ff, 0x92c96e, 0.62));
  sun = new T.DirectionalLight(0xfff1d0, 0.82); sun.position.set(60, 100, 40); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 1; sc.far = 400; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6; scene.add(sun); scene.add(sun.target);
  // sky
  sky = new T.Mesh(new T.SphereGeometry(2400, 24, 14), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: new T.Color(0x2f8cff) }, bot: { value: new T.Color(0xcfe9ff) } },
    vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying float vY; void main(){ float k = pow(clamp(vY,0.0,1.0),0.55); gl_FragColor = vec4(mix(bot, top, k),1.0);}' }));
  sky.renderOrder = -10; scene.add(sky);
  sunDisc = new T.Mesh(new T.SphereGeometry(70, 12, 8), new T.MeshBasicMaterial({ color: 0xfff6c0, fog: false })); scene.add(sunDisc);
  G.makeBuildMaterials(); G.FX.init(scene); G.World.build(scene);
  // bus
  G.bus = { mesh: G.makeBus(), active: false, x: 0, y: 220, z: 0, dx: 1, dz: 0, vx: 0, vz: 0, t: 0 }; scene.add(G.bus.mesh);
  // storm wall
  stormMat = new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, depthWrite: false, fog: false, uniforms: { time: { value: 0 }, cam: { value: new T.Vector3() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform float time; uniform vec3 cam; varying vec3 vP; void main(){ float s = 0.5+0.5*sin(vP.y*0.12 + time*1.6 + vP.x*0.02 + vP.z*0.02); float t = 0.5+0.5*sin(atan(vP.z,vP.x)*40.0 - time*2.0); float dd = distance(vP.xz, cam.xz); float a = (0.30 + 0.22*s + 0.12*t) * (1.0 - smoothstep(500.0, 1100.0, dd)*0.7) * (1.0 - smoothstep(180.0, 420.0, vP.y)); vec3 c = mix(vec3(0.45,0.1,0.95), vec3(0.85,0.45,1.0), s*t); gl_FragColor = vec4(c, a);}' });
  stormMesh = new T.Mesh(new T.CylinderGeometry(1, 1, 700, 96, 1, true), stormMat); stormMesh.position.y = 150; stormMesh.frustumCulled = false; scene.add(stormMesh); stormMesh.visible = false;
  // loot visuals
  const beamGeo = new T.CylinderGeometry(0.1, 0.2, 7, 8, 1, true);
  for (let i = 0; i < 44; i++) { const g = new T.Group(); const beam = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })); beam.position.y = 3.5; g.add(beam); const ring = new T.Mesh(new T.RingGeometry(0.5, 0.75, 20), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring); const holder = new T.Group(); g.add(holder); g.visible = false; scene.add(g); lootViz.push({ g, beam, ring, holder, cur: null, icon: null }); }
  // build ghosts
  for (const t of ['wall', 'floor', 'ramp0', 'ramp1', 'ramp2', 'ramp3']) { const geo = t === 'wall' ? G.geo.wall : t === 'floor' ? G.geo.floor : G.geo.ramp[+t[4]]; const m = new T.Mesh(geo, G.previewOK); m.visible = false; scene.add(m); ghost[t] = m; }
  G.UI.init(); bindInput(); if (detectTouch()) initTouch();
  resize();
}
function resize() { layoutTouch(); if (!renderer) return; renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 150));

/* ================= storm ================= */
function initStorm() { G.storm = { phase: 0, stage: 'wait', t: 0, cx: 0, cz: 0, r: 650, c0x: 0, c0z: 0, r0: 650, nx: 0, nz: 0, nr: 330, left: G.STORM[0].wait, dmg: 1, tick: 0 }; planStorm(); }
function planStorm() { const S = G.storm, P = G.STORM[S.phase]; const maxD = Math.max(0, S.r - P.r) * 0.7; const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * maxD; S.nr = P.r; S.nx = G.clamp(S.cx + Math.cos(a) * d, -300, 300); S.nz = G.clamp(S.cz + Math.sin(a) * d, -300, 300); if (S.r > 600) { S.nx = G.rand(-120, 120); S.nz = G.rand(-120, 120); } S.dmg = P.dmg; }
function updateStorm(dt) {
  const S = G.storm; if (!S) return; if (S.stage === 'done') { S.left = 0; } else { S.t += dt; const P = G.STORM[S.phase];
    if (S.stage === 'wait') { S.left = P.wait - S.t; if (S.t >= P.wait) { S.stage = 'shrink'; S.t = 0; S.c0x = S.cx; S.c0z = S.cz; S.r0 = S.r; G.Audio.play('storm'); G.UI.toast('The storm is closing in!', 2200); } }
    else { const k = Math.min(1, S.t / P.shrink); S.left = P.shrink - S.t; S.cx = G.lerp(S.c0x, S.nx, k); S.cz = G.lerp(S.c0z, S.nz, k); S.r = G.lerp(S.r0, S.nr, k); if (k >= 1) { S.phase++; S.t = 0; if (S.phase >= G.STORM.length) { S.stage = 'done'; S.r = 0; } else { S.stage = 'wait'; planStorm(); G.UI.toast('Safe zone updated — storm phase ' + (S.phase + 1), 2000, true); } } } }
  const P2 = G.STORM[Math.min(S.phase, G.STORM.length - 1)]; S.dmg = S.stage === 'shrink' ? Math.max(P2.dmg, 1) : (S.phase > 0 ? G.STORM[S.phase - 1].dmg : 1);
  stormMesh.visible = S.r < 600; stormMesh.scale.set(Math.max(0.5, S.r), 1, Math.max(0.5, S.r)); stormMesh.position.x = S.cx; stormMesh.position.z = S.cz; stormMat.uniforms.time.value = G.time; stormMat.uniforms.cam.value.copy(camera.position);
  S.tick -= dt; if (S.tick <= 0) { S.tick = 1; for (const a of G.actors) if (a.alive && a.state !== 'bus' && Math.hypot(a.x - S.cx, a.z - S.cz) > S.r) G.damageActor(a, Math.max(1, S.dmg), null, false, 'Storm'); }
}

/* ================= bus ================= */
function startBus() {
  const b = G.bus; const th = Math.random() * 6.283, off = G.rand(-130, 130); const dx = Math.cos(th), dz = Math.sin(th), px = -dz * off, pz = dx * off;
  b.dx = dx; b.dz = dz; b.sx = px - dx * 620; b.sz = pz - dz * 620; b.ex = px + dx * 620; b.ez = pz + dz * 620; b.x = b.sx; b.z = b.sz; b.y = 230; b.vx = dx * 30; b.vz = dz * 30; b.t = 0; b.dur = 1240 / 30; b.active = true; b.mesh.visible = true;
  yaw = Math.atan2(-dx, -dz); pitch = -0.12; G.Audio.play('bus');
}
function updateBus(dt) {
  const b = G.bus; if (!b.active) { if (state.phase === 'lobby') { orbit += dt * 0.04; b.x = Math.cos(orbit * 2.2) * 330; b.z = Math.sin(orbit * 2.2) * 330; b.y = 200; b.dx = -Math.sin(orbit * 2.2); b.dz = Math.cos(orbit * 2.2); } }
  else { b.t += dt; b.x += b.vx * dt; b.z += b.vz * dt; if (b.t > b.dur) { b.active = false; for (const a of G.actors) if (a.alive && a.state === 'bus') G.jumpFromBus(a, b); b.mesh.visible = false; } }
  b.mesh.position.set(b.x, b.y, b.z); b.mesh.rotation.y = Math.atan2(-b.dx, -b.dz); b.mesh.userData.prop.rotation.z += dt * 18;
  if (b.active) for (const a of G.actors) if (a.alive && a.state === 'bus') { a.x = b.x; a.y = b.y; a.z = b.z; }
}

/* ================= match flow ================= */
function startMatch() {
  if (state.phase === 'playing') return; G.Audio.init(); G.Audio.stopMusic();
  const name = ($('nameInput').value || 'Player').trim().slice(0, 14) || 'Player'; localStorage.setItem('sf_name', name);
  const pc = UI().skinColor; const skin = { shirt: pc, pants: 0x2b3a55, acc: pc === 0xffd83a ? 0xff5a5a : 0xffd83a, hat: 'cap', tone: 0xf2c9a0, pick: UI().pick };
  G.time = 0; G._xpDone = false; G.Extras.llamaT = 45; G.Extras.llamaN = 0; const pl = G.player = G.createActor(name, true, skin); pl.stats.born = 0; G.view = pl;
  startBus(); G.spawnBots(34); initStorm(); G.spawnVehicles();
  $('lobby').classList.add('hidden'); $('hud').classList.remove('hidden'); $('busHint').style.display = 'block'; state.phase = 'playing'; state.ended = false; state.spec = null; state.matchOver = false; state.paused = false;
  if (!NOLOCK) lock();
  $('lobbyInfo').textContent = '';
  if (G.touchOn) { $('touch').classList.remove('hidden'); $('lookpad').classList.remove('hidden'); $('busHint').innerHTML = 'Tap <b>DROP</b> to jump from the Battle Bus!'; $('pause').querySelector('p').textContent = 'Tap RESUME to keep playing.'; layoutTouch(); }
}
const UI = () => G.UI;
function lock() { if (NOLOCK || G.touchOn) return; const c = $('c'); if (!c.requestPointerLock) { lockFailed(); return; } try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(lockFailed); } catch (e) { lockFailed(); } }
/* If the browser never grants pointer lock (iframe, permissions, old browser) fall back to click-and-drag look. */
function lockFailed() { if (everLocked || G.lockFailed || G.touchOn) return; G.lockFailed = true; if (state.phase === 'playing') G.UI.toast('Mouse capture unavailable — click & drag to look', 3200, true); }
document.addEventListener('pointerlockerror', lockFailed);
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === $('c'); if (locked) { everLocked = true; G.lockFailed = false; }
  if (state.phase === 'playing' && !locked && !state.mapOpen && !state.helpOpen && !state.ended && !G.touchOn && !NOLOCK && !G.lockFailed) { state.paused = true; $('pause').classList.remove('hidden'); }
  else if (locked) { state.paused = false; $('pause').classList.add('hidden'); }
});
G.hooks.death = function (a, killer, wname) {
  if (!a.isPlayer) return; state.deathTime = G.time; state.killer = killer; $('busHint').style.display = 'none'; $('airHint').style.display = 'none';
  state.spec = (killer && killer.alive) ? killer : G.actors.find(x => x.alive) || null; G.UI.toast('ELIMINATED', 2500);
};
function endGame(win) {
  state.ended = true; if (document.exitPointerLock) document.exitPointerLock(); const pl = G.player; const killer = state.killer && state.killer.name;
  if (win) { pl.stats.placement = 1; pl.stats.timeAlive = G.time - pl.stats.born; }
  G.UI.showEnd(win, pl, killer, !win && !state.matchOver);
}
function winnerCheck() {
  const pl = G.player; if (!pl || state.matchOver) return; const alive = G.aliveCount();
  if (pl.alive && alive === 1 && G.time > 12) { state.matchOver = true; setTimeout(() => endGame(true), 1200); }
  else if (!pl.alive && !state.ended && G.time - state.deathTime > 2.0) endGame(false);
  else if (!pl.alive && alive <= 1 && state.ended === 'spectating') { state.matchOver = true; const w = G.actors.find(a => a.alive); G.UI.toast((w ? w.name : 'Nobody') + ' wins the match!', 4000); setTimeout(() => { state.ended = true; G.UI.showEnd(false, pl, state.killer && state.killer.name, false); $('endSub').textContent = 'Winner: ' + (w ? w.name : 'nobody') + ' • you placed #' + pl.stats.placement; }, 3500); }
}

/* ================= input ================= */
const act = {
  jump() { const a = G.player; if (!a.alive) return; if (a.state === 'bus') { if (G.bus.active) { G.jumpFromBus(a, G.bus); $('busHint').style.display = 'none'; } } else if (a.state === 'freefall') { a.openNow = true; } },
  interact() { interact(); },
  reload() { const a = G.player; if (a.alive && a.state === 'ground') G.startReload(a); },
  build(t) { const a = G.player; if (!a.alive || a.state !== 'ground' || a.vehicle) return; if (a.buildMode && a.buildType === t) { a.buildMode = false; } else { a.buildMode = true; a.buildType = t; a.action = null; a.reloading = 0; a.swing = 0; } G.updateHeld(a); G.Audio.play('click', 0.5); },
  slot(i) { const a = G.player; if (a.alive && a.state === 'ground') { if (a.inv[i]) G.selectSlot(a, i); } },
  cycle(dir) { const a = G.player; if (!a.alive || a.state !== 'ground') return; let i = a.sel; for (let k = 0; k < 6; k++) { i = (i + dir + 6) % 6; if (a.inv[i]) { G.selectSlot(a, i); break; } } },
  mat() { const a = G.player; const o = ['wood', 'stone', 'metal']; a.buildMat = o[(o.indexOf(a.buildMat) + 1) % 3]; G.Audio.play('click', 0.5); },
  edit() { const a = G.player; if (!a.alive || a.state !== 'ground') return; const d = camDir(); G.Build.edit(a, camera.position.x, camera.position.y, camera.position.z, d.x, d.y, d.z); },
  emote(n) { if (G.player.alive) G.startEmote(G.player, n); },
  map() { toggleMap(); },
  pause() { if (state.phase !== 'playing' || state.ended === true) return; state.paused = true; keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false; mouse.l = false; $('pause').classList.remove('hidden'); },
  mute() { const m = G.Audio.toggleMute(); G.UI.toast(m ? 'Sound off' : 'Sound on', 800, true); return m; },
  help() { toggleHelp(); },
};
G.act = act;
function toggleMap() {
  if (state.phase !== 'playing' || state.ended) return; state.mapOpen = !state.mapOpen; $('mapScreen').classList.toggle('hidden', !state.mapOpen);
  if (state.mapOpen) { G.UI.mapReset(); if (document.exitPointerLock) document.exitPointerLock(); } else lock();
}
function toggleHelp(force) {
  const open = force !== undefined ? force : !state.helpOpen; state.helpOpen = open; $('help').classList.toggle('hidden', !open);
  if (state.phase === 'playing') { state.paused = open || state.paused && !open && !NOLOCK && document.pointerLockElement !== $('c'); if (open && document.exitPointerLock) document.exitPointerLock(); if (!open) { state.paused = false; lock(); } }
}
function bindInput() {
  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Enter') startMatch(); return; }
    if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault(); const first = !keys[e.code]; keys[e.code] = true;
    if (!first) return; G.Audio.init();
    if (e.code === 'Escape' && state.phase === 'playing' && !G.touchOn && dragMode() && !state.mapOpen && !state.helpOpen && !state.ended) { if (state.paused) { $('resumeBtn').click(); } else act.pause(); return; }
    if (e.code === 'KeyH') { toggleHelp(); return; } if (e.code === 'KeyN') { const m = G.Audio.toggleMute(); G.UI.toast(m ? 'Sound off' : 'Sound on', 800, true); return; }
    if (state.phase !== 'playing') return; if (e.code === 'KeyM') { act.map(); return; } if (state.paused || state.ended === true && !G.player.alive && false) return;
    if (!G.player.alive) return;
    switch (e.code) {
      case 'Space': act.jump(); break; case 'KeyE': act.interact(); break; case 'KeyR': act.reload(); break;
      case 'KeyQ': act.build('wall'); break; case 'KeyF': act.build('floor'); break; case 'KeyZ': act.build('ramp'); break; case 'KeyC': act.build('roof'); break;
      case 'KeyG': act.mat(); break; case 'KeyX': act.edit(); break;
      case 'KeyT': act.emote('dance'); break; case 'KeyY': act.emote('wave'); break; case 'KeyU': act.emote('flex'); break; case 'KeyI': act.emote('spin'); break;
      default: if (/^Digit[1-6]$/.test(e.code)) act.slot(+e.code[5] - 1);
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.l = mouse.r = false; });
  const cv = $('c');
  window.addEventListener('mousedown', e => {
    if (e.target.closest && e.target.closest('#lobby,#help,#end,#mapScreen,#pause,.slot')) return; if (G.touchOn && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return; G.Audio.init();
    if (state.phase !== 'playing' || state.paused) return; if (!dragMode() && !G.touchOn && document.pointerLockElement !== cv) { lock(); return; }
    if (state.spec && !G.player.alive) { if (e.button === 0) cycleSpec(); return; }
    if (dragMode() && !G.touchOn && document.pointerLockElement !== cv) {
      // click-and-drag look: a quick click shoots, holding still fires, moving the mouse while pressed turns the camera
      dragging = true; dragX = e.clientX; dragY = e.clientY; dragMoved = 0;
      if (e.button === 0) { clearTimeout(dragT); dragT = setTimeout(() => { dragT = 0; if (dragging && dragMoved < 6) { mouse.l = true; mouse.lEdge = true; } }, 150); }
      if (e.button === 2) mouse.r = true; return;
    }
    if (e.button === 0) { mouse.l = true; mouse.lEdge = true; } if (e.button === 2) mouse.r = true;
  });
  window.addEventListener('mouseup', e => {
    if (dragging && e.button === 0 && dragT) { clearTimeout(dragT); dragT = 0; if (dragMoved < 6) { mouse.l = true; mouse.lEdge = true; fireRel = true; } }  // quick click = one shot
    if (e.button === 0 && !fireRel) mouse.l = false; if (e.button === 2) mouse.r = false; if (!e.buttons) dragging = false;
  });
  window.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('mousemove', e => {
    if (state.phase !== 'playing' || state.paused || state.mapOpen) return;
    if (G.touchOn && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
    if (document.pointerLockElement === cv) { lookBy(e.movementX, e.movementY, 0.0022); return; }
    if (dragging && dragMode()) { const dx = e.clientX - dragX, dy = e.clientY - dragY; dragX = e.clientX; dragY = e.clientY; dragMoved += Math.abs(dx) + Math.abs(dy); if (dragMoved >= 6 && dragT) { clearTimeout(dragT); dragT = 0; } lookBy(dx, dy, 0.0022); }
  });
  window.addEventListener('wheel', e => { if (state.phase !== 'playing' || state.paused || state.mapOpen) return; act.cycle(e.deltaY > 0 ? 1 : -1); }, { passive: true });
  $('playBtn').onclick = () => { G.Audio.init(); G.Audio.play('click'); startMatch(); };
  $('helpBtn').onclick = () => toggleHelp(true); $('helpBtn2').onclick = () => toggleHelp(true); $('helpClose').onclick = () => toggleHelp(false);
  $('resumeBtn').onclick = () => { lock(); state.paused = false; $('pause').classList.add('hidden'); };
  $('pause').addEventListener('click', e => { if (e.target.id === 'pause') { lock(); } });
  $('againBtn').onclick = () => { sessionStorage.setItem('sf_auto', '1'); location.reload(); };
  $('specBtn').onclick = () => { G.UI.hideEnd(); state.ended = 'spectating'; if (!state.spec) state.spec = G.actors.find(a => a.alive) || null; G.UI.toast('Spectating — click to switch player', 2500, true); lock(); };
  initMapInput(); $('mapClose').onclick = () => toggleMap();
  initLobbyDrag();
  document.addEventListener('gesturestart', e => e.preventDefault()); document.addEventListener('dblclick', e => e.preventDefault());
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 || !(e.target.closest && e.target.closest('.lobby-left,.panel'))) e.preventDefault(); }, { passive: false });
  $('optShadow').onchange = e => { renderer.shadowMap.enabled = e.target.checked; sun.castShadow = e.target.checked; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); };
  $('optSound').onchange = e => { if (G.Audio.muted === e.target.checked) G.Audio.toggleMute(); };
  const saved = localStorage.getItem('sf_name'); if (saved) $('nameInput').value = saved;
  document.addEventListener('visibilitychange', () => { if (document.hidden && state.phase === 'playing' && !state.ended) { /* auto-pause by pointer lock loss */ } });
}
/* full map: drag to pan, pinch / wheel / buttons to zoom, tap or click (without dragging) to set a waypoint */
function initMapInput() {
  const bm = $('bigmap'), U = G.UI, pts = new Map(); let moved = 0, t0 = 0, pd = 0;
  const cs = () => { const r = bm.getBoundingClientRect(); return { r, f: bm.width / r.width }; };
  const mid = () => { const a = [...pts.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; };
  bm.addEventListener('pointerdown', e => { e.preventDefault(); try { bm.setPointerCapture(e.pointerId); } catch (_) { } pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 1) { moved = 0; t0 = performance.now(); } else if (pts.size === 2) { pd = mid().d; moved = 99; } });
  bm.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const { r, f } = cs();
    if (pts.size === 1) { const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy); p.x = e.clientX; p.y = e.clientY; if (moved > 6) U.mapPan(dx * f, dy * f); }
    else if (pts.size === 2) { const m0 = mid(); p.x = e.clientX; p.y = e.clientY; const m1 = mid(); if (pd > 0 && m1.d > 0) U.mapZoomAt(m1.d / pd, (m1.x - r.left) * f, (m1.y - r.top) * f); U.mapPan((m1.x - m0.x) * f, (m1.y - m0.y) * f); pd = m1.d; } });
  const up = e => { if (!pts.has(e.pointerId)) return; const wasOne = pts.size === 1; pts.delete(e.pointerId); if (wasOne && moved <= 6 && performance.now() - t0 < 700 && e.type === 'pointerup') U.bigClick(e); if (pts.size === 1) { moved = 99; } };
  bm.addEventListener('pointerup', up); bm.addEventListener('pointercancel', up); bm.addEventListener('lostpointercapture', e => pts.delete(e.pointerId));
  bm.addEventListener('wheel', e => { e.preventDefault(); const { r, f } = cs(); U.mapZoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, (e.clientX - r.left) * f, (e.clientY - r.top) * f); }, { passive: false });
  $('mapZoomIn').onclick = () => U.mapZoomAt(1.5, 360, 360); $('mapZoomOut').onclick = () => U.mapZoomAt(1 / 1.5, 360, 360); $('mapReset').onclick = () => U.mapReset();
}
/* lobby: drag the island view to orbit it (horizontal = rotate, vertical = raise/lower camera) */
function initLobbyDrag() {
  const lob = $('lobby'); let pid = null, lx = 0, ly = 0;
  lob.addEventListener('pointerdown', e => { if (state.phase !== 'lobby' || pid !== null || (e.pointerType === 'mouse' && e.button !== 0)) return; if (e.target.closest('input,button,label,.sw,.pk,#lvlBox,.lookset,select')) return; pid = e.pointerId; lx = e.clientX; ly = e.clientY; try { lob.setPointerCapture(pid); } catch (_) { } });
  lob.addEventListener('pointermove', e => { if (e.pointerId !== pid) return; lobbyYaw -= (e.clientX - lx) * 0.006 * LS.sens; lobbyElev = G.clamp(lobbyElev + (e.clientY - ly) * 0.004 * LS.sens * (LS.invertY ? -1 : 1), -0.55, 1); lx = e.clientX; ly = e.clientY; });
  const end = e => { if (e.pointerId === pid) pid = null; };
  lob.addEventListener('pointerup', end); lob.addEventListener('pointercancel', end); lob.addEventListener('lostpointercapture', end);
}
function cycleSpec() { const al = G.actors.filter(a => a.alive); if (!al.length) return; const i = al.indexOf(state.spec); state.spec = al[(i + 1) % al.length]; }

/* ================= touch ================= */
function detectTouch() {
  if (Q.has('notouch')) return false; if (Q.has('touch')) return true;
  const mm = q => !!(window.matchMedia && matchMedia(q).matches);
  if (mm('(pointer:coarse)')) return true;
  return ('ontouchstart' in window) && !mm('(pointer:fine)') && !mm('(hover:hover)');
}
/* One scale factor drives every touch control so the layout is identical in shape on every phone/tablet. */
function layoutTouch() {
  if (!G.touchOn) return; const w = innerWidth, h = innerHeight, port = h >= w, r = document.documentElement.style;
  const s = port ? G.clamp(w / 390, 0.82, 1.2) : G.clamp(h / 390, 0.8, 1.2);
  const slot = port ? Math.floor(Math.min(50, (w - 28 - 5 * 4) / 6)) : Math.floor(Math.min(46, h * 0.115, (w - 640) / 6 + 20));
  r.setProperty('--s', s.toFixed(3)); r.setProperty('--slot', Math.max(34, slot) + 'px');
  // portrait: controls sit above the ammo/health/hotbar stack; landscape: stack lives between the two thumbs
  r.setProperty('--hb', port ? (Math.max(34, slot) + 60) + 'px' : '0px');
  document.body.classList.toggle('port', port); document.body.classList.toggle('land', !port);
}
const ICONS = {
  map: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path class="wave" d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/><path class="x" d="M17 9l5 6M22 9l-5 6"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 115 .8c0 1.8-2.5 2-2.5 3.7M12 17.5v.1"/></svg>',
};
let fireRel = false, fireTick = 0, simTick = 0; // a very short tap still reaches one sim step
const TB = {}; let sprintL = false, joyFar = false, aimOn = false, tsig = {};
function initTouch() {
  G.touchOn = true; document.body.classList.add('touch'); layoutTouch();
  const t = $('touch'), lp = $('lookpad');
  t.innerHTML = '<div id="leftCtl"><div id="buildPanel" class="hidden"></div><div id="joy"><i></i></div></div><div id="actions"></div>';
  const actions = $('actions'), panel = $('buildPanel');
  const look = (dx, dy) => lookBy(dx, dy, 0.005);
  const bindPtr = (el, h) => { let pid = null;
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (pid !== null) return; pid = e.pointerId; try { el.setPointerCapture(pid); } catch (_) { } el.classList.add('down'); G.Audio.init(); h.down && h.down(e); });
    el.addEventListener('pointermove', e => { if (e.pointerId === pid && h.move) h.move(e); });
    const up = e => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('down'); h.up && h.up(e); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    el.addEventListener('contextmenu', e => e.preventDefault()); };
  const mk = (parent, id, label, cls, pos, h) => { const b = document.createElement('div'); b.className = 'tb ' + cls; b.id = 'tb-' + id; b.innerHTML = label; if (pos) b.style.cssText = pos; parent.appendChild(b); TB[id] = b; bindPtr(b, h); return b; };
  const P = (r, b, s) => 'right:' + r + 'px;bottom:' + b + 'px;width:' + s + 'px;height:' + s + 'px';
  /* ---- right-hand action cluster (design px, scaled by --s). FIRE in the corner, the rest in an arc around it ---- */
  let fx = 0, fy = 0;
  mk(actions, 'fire', 'FIRE', 'fire', P(0, 0, 80), { down: e => { mouse.l = true; mouse.lEdge = true; fireRel = false; fireTick = simTick; fx = e.clientX; fy = e.clientY; }, move: e => { look(e.clientX - fx, e.clientY - fy); fx = e.clientX; fy = e.clientY; }, up: () => { if (simTick === fireTick) fireRel = true; else mouse.l = false; } });
  mk(actions, 'aim', 'AIM', '', P(88, 6, 52), { down: () => { aimOn = !aimOn; mouse.r = aimOn; TB.aim.classList.toggle('on', aimOn); } });
  mk(actions, 'jump', 'JUMP', '', P(13, 90, 54), { down: () => { keys.Space = true; act.jump(); }, up: () => { keys.Space = false; } });
  mk(actions, 'sprint', 'SPRINT', '', P(88, 70, 48), { down: () => { sprintL = !sprintL; sprintSync(); } });
  mk(actions, 'reload', 'RELOAD', '', P(148, 62, 48), { down: () => act.reload() });
  mk(actions, 'build', 'BUILD', '', P(13, 154, 50), { down: () => { const a = G.player; if (!a || !a.alive) return; if (a.buildMode) act.build(a.buildType); else act.build(a.buildType || 'wall'); } });
  mk(actions, 'emote', 'EMOTE', '', P(148, 116, 44), { down: () => openEmotes(true) });
  mk(actions, 'use', '<b>E</b><span>USE</span>', 'ctx off', P(88, 126, 54), { down: () => act.interact() });
  mk(actions, 'air', 'DROP', 'ctx off', P(13, 90, 54), { down: () => act.jump() });
  /* ---- build panel: wall/floor/ramp/roof, material cycle, edit ---- */
  for (const [n, k] of [['wall', 'Q'], ['floor', 'F'], ['ramp', 'Z'], ['roof', 'C']]) mk(panel, n, '<b>' + k + '</b>' + n.toUpperCase(), '', '', { down: () => { const a = G.player; if (!a || !a.alive || a.state !== 'ground') return; if (!(a.buildMode && a.buildType === n)) act.build(n); } });
  mk(panel, 'mat', '<b>0</b>WOOD', 'mat', '', { down: () => act.mat() });
  mk(panel, 'edit', '<b>X</b>EDIT', 'edit', '', { down: () => act.edit() });
  /* ---- joystick (left thumb) ---- */
  const joy = $('joy'), knob = joy.firstChild; let jid = null;
  const jset = e => { const r = joy.getBoundingClientRect(), R = r.width / 2, sc = r.width / 124; let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R); const m = R * 0.62, l = Math.hypot(dx, dy); if (l > m) { dx *= m / l; dy *= m / l; }
    knob.style.transform = 'translate(' + (dx / sc) + 'px,' + (dy / sc) + 'px)'; const nx = dx / m, ny = dy / m;
    keys.KeyW = ny < -0.28; keys.KeyS = ny > 0.28; keys.KeyA = nx < -0.28; keys.KeyD = nx > 0.28; joyFar = l >= m * 0.97 && ny < -0.45; sprintSync(); };
  const jend = () => { jid = null; knob.style.transform = ''; keys.KeyW = keys.KeyS = keys.KeyA = keys.KeyD = false; joyFar = false; sprintL = false; sprintSync(); };
  joy.addEventListener('pointerdown', e => { e.preventDefault(); if (jid !== null) return; jid = e.pointerId; try { joy.setPointerCapture(jid); } catch (_) { } G.Audio.init(); jset(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jset(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) joy.addEventListener(ev, e => { if (e.pointerId === jid) jend(); });
  /* ---- look pad: drag to look, tap to switch spectated player ---- */
  let lid = null, lx = 0, ly = 0, lt = 0, lm = 0;
  lp.addEventListener('pointerdown', e => { e.preventDefault(); if (lid !== null) return; lid = e.pointerId; try { lp.setPointerCapture(lid); } catch (_) { } lx = e.clientX; ly = e.clientY; lt = performance.now(); lm = 0; G.Audio.init(); });
  lp.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; lm += Math.abs(dx) + Math.abs(dy); if (state.phase === 'playing' && !state.paused && !state.mapOpen) look(dx, dy); });
  const lend = e => { if (e.pointerId !== lid) return; lid = null; if (lm < 10 && performance.now() - lt < 300 && state.spec && !G.player.alive) cycleSpec(); };
  lp.addEventListener('pointerup', lend); lp.addEventListener('pointercancel', lend); lp.addEventListener('lostpointercapture', lend);
  /* ---- top-right menu cluster: map / pause / sound / help ---- */
  const mc = $('menuCluster'); mc.innerHTML = '';
  for (const [id, ic, fn] of [['map', ICONS.map, () => act.map()], ['pause', ICONS.pause, () => act.pause()], ['sound', ICONS.sound, () => { const m = act.mute(); TB.sound.classList.toggle('muted', m); }], ['help', ICONS.help, () => act.help()]]) {
    const b = document.createElement('div'); b.className = 'mb'; b.id = 'tb-' + id; b.innerHTML = ic; b.setAttribute('role', 'button'); b.setAttribute('aria-label', id); mc.appendChild(b); TB[id] = b; bindPtr(b, { down: fn }); }
  TB.sound.classList.toggle('muted', !!G.Audio.muted);
  bindPtr($('mini'), { down: () => act.map() });
  /* ---- emote wheel: one button opens it ---- */
  const ew = document.createElement('div'); ew.id = 'emoteWheel'; ew.className = 'hidden';
  ew.innerHTML = '<div class="ring"></div>'; t.appendChild(ew); const ring = ew.firstChild;
  for (const [n, l] of [['dance', 'DANCE'], ['spin', 'SPIN'], ['flex', 'FLEX'], ['wave', 'WAVE']]) { const b = document.createElement('div'); b.className = 'tb'; b.textContent = l; ring.appendChild(b); bindPtr(b, { down: () => { act.emote(n); openEmotes(false); } }); }
  const x = document.createElement('div'); x.className = 'tb'; x.textContent = '✕'; ring.appendChild(x); bindPtr(x, { down: () => openEmotes(false) });
  ew.addEventListener('pointerdown', e => { if (e.target === ew) openEmotes(false); });
  G.openEmotes = openEmotes;
}
function openEmotes(on) { const ew = $('emoteWheel'); if (!ew) return; ew.classList.toggle('hidden', !on); if (on) { keys.KeyW = keys.KeyA = keys.KeyS = keys.KeyD = false; mouse.l = false; } }
function sprintSync() { keys.ShiftLeft = sprintL || joyFar; if (TB.sprint) TB.sprint.classList.toggle('on', keys.ShiftLeft); }
const setOff = (id, off) => { const e = TB[id]; if (e && tsig[id] !== off) { tsig[id] = off; e.classList.toggle('off', off); } };
const setTxt = (id, html) => { const e = TB[id]; if (e && tsig['t' + id] !== html) { tsig['t' + id] = html; e.innerHTML = html; } };
/* Contextual visibility: only controls that make sense for the player's current state are shown. */
function touchUpdate() {
  const a = G.player; if (!a) return; const alive = a.alive, ground = alive && a.state === 'ground', veh = ground && !!a.vehicle, onFoot = ground && !a.vehicle;
  const bus = alive && a.state === 'bus' && G.bus.active, fall = alive && a.state === 'freefall';
  for (const id of ['fire', 'aim', 'reload', 'build', 'emote', 'sprint']) setOff(id, !onFoot);
  setOff('jump', !onFoot);
  setOff('air', !(bus || fall)); if (bus) setTxt('air', 'DROP'); else if (fall) setTxt('air', 'GLIDE');
  const tg = promptTarget && !state.mapOpen && ground ? promptTarget : null; setOff('use', !tg);
  if (tg) setTxt('use', '<b>E</b><span>' + ({ chest: 'OPEN', loot: 'TAKE', veh: 'DRIVE', exit: 'EXIT', bush: a.hideLock ? 'LEAVE' : 'HIDE' }[tg.kind] || 'USE') + '</span>');
  const bm = onFoot && !!a.buildMode; $('buildPanel').classList.toggle('hidden', !bm); TB.build.classList.toggle('on', bm);
  if (bm) { for (const n of ['wall', 'floor', 'ramp', 'roof']) TB[n].classList.toggle('sel', a.buildType === n); const mc = G.MATS[a.buildMat]; setTxt('mat', '<b>' + a.mats[a.buildMat] + '</b>' + mc.name.toUpperCase()); TB.mat.style.borderColor = mc.css; }
  if (!onFoot && aimOn) { aimOn = false; mouse.r = false; TB.aim.classList.remove('on'); }
  if (!alive || (state.ended === true)) openEmotes(false);
  if ($('progressWrap').style.display === 'block') $('prompt').style.display = 'none'; // heal/reload bar and prompt share one slot
}
G.touchUpdate = touchUpdate;

/* ================= interaction ================= */
let promptT = 0, promptTarget = null;
function findInteract() {
  const a = G.player; if (!a.alive || a.state !== 'ground') return null; if (a.vehicle) return { kind: 'exit', text: 'Exit vehicle' };
  let best = null, bd = 99;
  const c = G.nearestChest(a, 2.8); if (c) { const d = Math.hypot(c.x - a.x, c.z - a.z); best = { kind: 'chest', o: c, text: c.kind === 'llama' ? 'Smash Supply Llama' : c.kind === 'truck' ? 'Open Armored Truck' : 'Open ' + (c.style === 'metal' ? 'Blue Metal' : 'Wooden') + ' Chest (' + G.RARITY[c.rar].name + ')', color: G.RARITY[c.rar].color }; bd = d; }
  const l = G.nearestLoot(a, 2.8); if (l) { const d = Math.hypot(l.x - a.x, l.z - a.z); if (d < bd) { bd = d; best = { kind: 'loot', o: l, text: 'Pick up ' + G.itemName(l.item), color: G.RARITY[l.item.rarity !== undefined ? l.item.rarity : 0].color }; } }
  const v = G.nearestVehicle(a, 3.4); if (v) { const d = Math.hypot(v.x - a.x, v.z - a.z); if (d < bd) { bd = d; best = { kind: 'veh', o: v, text: 'Drive Buggy' }; } }
  if (!best && G.Extras) { const b = a.hideLock ? a.hideLock : G.Extras.nearestBush(a, 3.4); if (b && (a.hideLock || Math.hypot(b.x - a.x, b.z - a.z) > b.r * 0.6)) best = { kind: 'bush', o: b, text: a.hideLock ? 'Leave bush' : 'Hide in bush' }; }
  return best;
}
function interact() {
  const a = G.player; if (!a.alive || state.paused) return; const t = findInteract(); if (!t) return;
  if (t.kind === 'exit') G.exitVehicle(a); else if (t.kind === 'chest') { G.World.openChest(t.o); G.Audio.play('chest'); } else if (t.kind === 'loot') G.pickupLoot(a, t.o); else if (t.kind === 'veh') G.enterVehicle(a, t.o); else if (t.kind === 'bush') { if (a.hideLock) { const b = a.hideLock; a.hideLock = null; a.x = b.x - Math.sin(a.yaw) * (b.r + 1.4); a.z = b.z - Math.cos(a.yaw) * (b.r + 1.4); } else { G.Extras.enterBush(a, t.o); G.UI.toast('Hidden in the bush', 900, true); } }
}

/* ================= loot visuals / culling ================= */
let lootT = 0, cullT = 0;
const tmpv = new T.Vector3();
function updateLootViz(dt) {
  lootT -= dt; const cx = camera.position.x, cz = camera.position.z;
  if (lootT <= 0) {
    lootT = 0.25; const cand = []; const L = G.loot; for (let i = 0; i < L.length; i++) { const l = L[i]; if (l.taken) continue; const d = (l.x - cx) ** 2 + (l.z - cz) ** 2; if (d < 110 * 110) cand.push([d, l]); }
    cand.sort((a, b) => a[0] - b[0]); const want = new Set(cand.slice(0, lootViz.length).map(c => c[1]));
    for (const v of lootViz) if (v.cur && !want.has(v.cur)) { v.cur = null; v.g.visible = false; } const have = new Set(lootViz.map(v => v.cur).filter(Boolean));
    for (const l of want) { if (have.has(l)) continue; const v = lootViz.find(q => !q.cur); if (!v) break; v.cur = l; v.g.visible = true; v.g.position.set(l.x, l.y, l.z); while (v.holder.children.length) v.holder.remove(v.holder.children[0]); const ic = G.pickupIcon(l.item); v.holder.add(ic); const col = G.itemColor(l.item); v.beam.material.color.setHex(col); v.ring.material.color.setHex(col); v.beam.visible = l.item.kind !== 'ammo' || true; }
    if (G.loot.length > 1500) G.loot = G.loot.filter(l => !l.taken);
  }
  const t = G.time; for (const v of lootViz) if (v.cur) { if (v.cur.taken) { v.cur = null; v.g.visible = false; continue; } v.beam.visible = (v.cur.x - camera.position.x) ** 2 + (v.cur.z - camera.position.z) ** 2 > 36; v.holder.rotation.y = t * 1.6; v.holder.position.y = 0.75 + Math.sin(t * 2.5 + v.cur.id) * 0.12; }
}
function updateCull(dt) {
  cullT -= dt; if (cullT > 0) return; cullT = 0.3; const cx = camera.position.x, cz = camera.position.z;
  for (const c of G.chests) { const d = Math.hypot(c.x - cx, c.z - cz); c.grp.visible = !c.gone && d < 380; c.mesh.visible = c.lid.visible = d < 130; }
  for (const a of G.actors) { if (!a.alive || a === G.view && a.isPlayer) continue; if (a.state === 'bus') continue; const d = Math.hypot(a.x - cx, a.z - cz); a.rig.root.visible = d < 280 && !(a.hidden && d > 9); if (a.plate) a.plate.visible = d < 32 && a.alive && !a.hidden; }
}

/* ================= camera ================= */
function camDir() { const cp = Math.cos(pitch); return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp }; }
let camPos = new T.Vector3(); const aim = { x: 0, y: 0, z: 0 };
function updateCamera(dt) {
  const v = G.view; let fovT = 72;
  if (state.phase === 'lobby') {
    orbit += dt * 0.04; const R = 560, oa = orbit + lobbyYaw; camera.position.set(Math.cos(oa) * R, 210 + lobbyElev * 320, Math.sin(oa) * R); camera.lookAt(0, 15, 0); fovT = 62; G.scoped = false;
  } else {
    const p = G.player;
    if (state.spec && !p.alive) { if (!state.spec.alive) state.spec = G.actors.find(a => a.alive) || null; G.view = state.spec || p; } else G.view = p;
    const w = G.view;
    if (w !== p) { yaw = w.yaw; pitch = G.clamp(w.pitch, -1, 1); }
    const it = w.inv[w.sel]; const sniper = it && it.type === 'weapon' && G.WEAPONS[it.w].zoom; const ads = w === p && mouse.r && w.state === 'ground' && !w.buildMode && it && it.type === 'weapon' && !w.vehicle;
    G.scoped = !!(ads && sniper);
    const d = camDir(); const eye = w.state === 'bus' ? 0 : (w.vehicle ? 2.1 : 1.65); let head;
    if (w.state === 'bus') { head = { x: G.bus.x, y: G.bus.y + 6, z: G.bus.z }; const dist = 34; camPos.set(head.x - d.x * dist, head.y - d.y * dist + 4, head.z - d.z * dist); }
    else {
      head = { x: w.x, y: w.y + eye, z: w.z }; let dist = w.state === 'freefall' ? 7.5 : w.state === 'glide' ? 8 : w.vehicle ? 7 : w.buildMode ? 4.6 : ads ? 2.2 : 3.7; let sh = w.state === 'glide' || w.state === 'freefall' ? 0 : w.vehicle ? 0 : ads ? 0.55 : 0.95; if (G.scoped) { dist = 0.05; sh = 0; }
      const rx = Math.cos(yaw), rz = -Math.sin(yaw); const dx = -d.x * dist + rx * sh, dy = -d.y * dist + 0.25, dz = -d.z * dist + rz * sh; const len = Math.hypot(dx, dy, dz) || 1;
      const r = G.World.raycast(head.x, head.y, head.z, dx / len, dy / len, dz / len, len + 0.25); const t = r.hit && r.t < len + 0.25 ? Math.max(0.35, r.t - 0.3) : len;
      camPos.set(head.x + dx / len * t, head.y + dy / len * t, head.z + dz / len * t); const gh = G.World.heightAt(camPos.x, camPos.z) + 0.45; if (camPos.y < gh) camPos.y = gh;
    }
    const sh = G.FX.shake * 0.35; camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z + (Math.random() - 0.5) * sh);
    const rc = w.recoil || 0; camera.rotation.set(pitch + (w === p ? rc * 0.6 : 0), yaw, 0);
    fovT = G.scoped ? it && G.WEAPONS[it.w].zoom : ads ? 56 : (w.state === 'freefall' ? 85 : w.input.sprint && w.speedNow > 6 ? 77 : 72);
    // aim point
    const dd = camDir(); const rr = G.World.raycast(camera.position.x, camera.position.y, camera.position.z, dd.x, dd.y, dd.z, 400); if (rr.hit) { aim.x = rr.x; aim.y = rr.y; aim.z = rr.z; } else { aim.x = camera.position.x + dd.x * 300; aim.y = camera.position.y + dd.y * 300; aim.z = camera.position.z + dd.z * 300; }
    // hide player model when scoped
    if (w === p) p.rig.root.visible = !G.scoped && p.state !== 'bus' && p.alive || (!p.alive);
  }
  if (G.debug && G.debug.cam) { const c = G.debug.cam; camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); }
  fovCur += (fovT - fovCur) * Math.min(1, dt * 10); if (Math.abs(camera.fov - fovCur) > 0.05) { camera.fov = fovCur; camera.updateProjectionMatrix(); }
  // follow lights / sky
  sky.position.copy(camera.position); sunDisc.position.set(camera.position.x + 1400 * 0.45, camera.position.y + 1400 * 0.75, camera.position.z + 1400 * 0.3);
  const fx = state.phase === 'playing' && G.view ? G.view : null; const tx = fx ? fx.x : 0, tz = fx ? fx.z : 0, ty = fx ? fx.y : 0;
  sun.position.set(tx + 60, ty + 100, tz + 40); sun.target.position.set(tx, ty, tz); sun.target.updateMatrixWorld();
  G.Audio.L.x = camera.position.x; G.Audio.L.y = camera.position.y; G.Audio.L.z = camera.position.z; G.Audio.L.yaw = yaw;
}

/* ================= player control ================= */
function updatePlayer(dt) {
  const a = G.player; if (!a.alive) return; const inp = a.input;
  if (!a.vehicle) a.yaw = yaw; a.pitch = pitch;
  inp.f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0); inp.s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); inp.sprint = !!(keys.ShiftLeft || keys.ShiftRight);
  const it = a.inv[a.sel]; inp.ads = mouse.r && a.state === 'ground' && it && it.type === 'weapon' && !a.buildMode;
  if (a.emote && (inp.f || inp.s || keys.Space)) a.emote = null;
  if (a.state === 'ground' && !a.vehicle) { inp.jump = !!keys.Space; }
  if (a.state === 'freefall' && keys.Space && G.time - (a.jumpedAt || 0) > 0.6) a.openNow = true;
  if (a.state === 'ground' && !a.vehicle && a.alive) {
    G.autoAmmoT = (G.autoAmmoT || 0) - dt; if (G.autoAmmoT <= 0) { G.autoAmmoT = 0.2; G.autoAmmo(a); }
    if (a.buildMode) {
      if (mouse.l && a.placeCD <= 0) { const sp = G.Build.spec(a, a.buildType); const ok = G.Build.canPlace(a, sp); if (ok) { G.Build.place(a, sp); a.placeCD = 0.11; } else if (mouse.lEdge) { G.UI.toast(a.mats[a.buildMat] < 10 ? 'Not enough ' + a.buildMat : 'Spot taken', 800, true); } }
    } else if (mouse.l) {
      if (it && it.type === 'weapon') { const W = G.WEAPONS[it.w]; if (W.auto || mouse.lEdge) G.tryFire(a, aim.x, aim.y, aim.z); }
      else if (it && it.type === 'pickaxe') G.startSwing(a);
      else if (it && it.type === 'heal' && mouse.lEdge) G.startHeal(a);
      else if (it && it.type === 'gadget' && mouse.lEdge) G.useGadget(a, aim.x, aim.y, aim.z);
    }
    if (mouse.lEdge && !(it && it.type === 'weapon' && mouse.l)) { }
    a.placeCD -= 0; // handled in updateActor
  }
  mouse.lEdge = false; simTick++; if (fireRel) { fireRel = false; mouse.l = false; }
}
let ghostShown = null;
function updateGhost() {
  const a = G.player; for (const k in ghost) ghost[k].visible = false; ghostShown = null;
  if (!a.alive || !a.buildMode || a.state !== 'ground' || state.phase !== 'playing') return;
  const sp = G.Build.spec(a, a.buildType); const ok = G.Build.canPlace(a, sp); let m;
  if (sp.type === 'wall') { m = ghost.wall; m.position.set(sp.cx, sp.lv, sp.cz); m.rotation.y = sp.o ? Math.PI / 2 : 0; }
  else if (sp.type === 'floor') { m = ghost.floor; m.position.set(sp.cx, sp.lv, sp.cz); m.rotation.y = 0; }
  else { m = ghost['ramp' + sp.d]; m.position.set(sp.cx, sp.lv, sp.cz); m.rotation.y = 0; }
  m.material = ok ? G.previewOK : G.previewBad; m.visible = true;
}

/* ================= main loop ================= */
let acc = 0, uiT = 0;
function simStep(dt) {
  { const ax = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0), ay = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0); if ((ax || ay) && !state.mapOpen) lookBy(-ax * 1.9 * dt, -ay * 1.5 * dt, 1); }
  G.time += dt; updateBus(dt); updateStorm(dt);
  updatePlayer(dt);
  if (!G.debug.noAI) for (const a of G.actors) { if (a.isBot) G.AI.update(a, dt); }
  G.updateVehicles(dt);
  for (const a of G.actors) G.updateActor(a, dt);
  G.updateExtras(dt); G.updateProjectiles(dt); G.FX.update(dt); G.World.updateClouds(dt); winnerCheck();
  const p = G.player; $('busHint').style.display = p.state === 'bus' && p.alive ? 'block' : 'none';
  const ah = $('airHint'); if (p.state === 'freefall') { ah.style.display = 'block'; ah.innerHTML = G.touchOn ? 'Free-falling — stick forward to dive • tap <b>GLIDE</b> (auto at low altitude)' : 'Free-falling — <b>W</b> dive • <b>SPACE</b> deploy glider (auto at low altitude)'; } else if (p.state === 'glide') { ah.style.display = 'block'; ah.innerHTML = 'Gliding — steer to land near buildings & loot'; } else ah.style.display = 'none';
  if (G.waypoint && Math.hypot(p.x - G.waypoint.x, p.z - G.waypoint.z) < 8) G.waypoint = null;
  promptT -= dt; if (promptT <= 0) { promptT = 0.08; promptTarget = findInteract(); const pe = $('prompt'); if (promptTarget && !state.mapOpen) { pe.style.display = 'block'; pe.innerHTML = '<kbd>E</kbd>' + promptTarget.text; pe.style.borderColor = promptTarget.color || '#fff'; } else pe.style.display = 'none'; }
}
G.simStep = simStep;

function frame(ts) {
  requestAnimationFrame(frame); const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016); lastT = ts;
  if (state.phase === 'loading') return;
  if (state.phase === 'lobby') { updateBus(dt); G.World.updateClouds(dt); updateCamera(dt); renderer.render(scene, camera); return; }
  if (!state.paused && !state.helpOpen) simStep(dt);
  updateCamera(dt); updateGhost(); updateLootViz(dt); updateCull(dt);
  uiT -= dt; G.UI.update(dt); if (G.touchOn) touchUpdate(); G.UI.drawMini(); if (state.mapOpen) G.UI.drawBig();
  renderer.render(scene, camera);
}

/* ================= debug helpers (used for automated testing) ================= */
G.debug = {
  drop(poiId, dx, dz) { const p = G.POIS.find(q => q.id === poiId) || G.POIS[0]; const a = G.player; a.state = 'ground'; a.x = p.x + (dx || 0); a.z = p.z + (dz || 0); a.y = G.World.groundY(a.x, a.z, 500, 0); a.onGround = true; a.vx = a.vy = a.vz = 0; a.rig.glider.visible = false; a.rig.lean.rotation.x = 0; $('busHint').style.display = 'none'; },
  kit() { const a = G.player; for (const [i, w, r] of [[1, 'ar', 3], [2, 'shotgun', 2], [3, 'sniper', 4], [4, 'rocket', 1]]) a.inv[i] = { type: 'weapon', w, rarity: r, mag: G.WEAPONS[w].mag }; a.inv[5] = { type: 'heal', id: 'medkit', n: 2 }; a.ammo = { light: 100, medium: 150, shells: 30, heavy: 20, rockets: 8 }; a.mats = { wood: 300, stone: 200, metal: 100 }; G.selectSlot(a, 1); },
  kit2() { const a = G.player; a.inv[1] = { type: 'weapon', w: 'shotgun', rarity: 3, mag: 2 }; a.inv[2] = { type: 'weapon', w: 'dual', rarity: 2, mag: 24 }; a.inv[3] = { type: 'gadget', id: 'tnt', n: 4 }; a.inv[4] = { type: 'gadget', id: 'launchpad', n: 2 }; a.inv[5] = { type: 'heal', id: 'chug', n: 1 }; a.ammo = { light: 100, medium: 150, shells: 30, heavy: 20, rockets: 8 }; G.selectSlot(a, 1); },
  step(n, dt) { for (let i = 0; i < n; i++) { simStep(dt || 0.05); } },
  fastForward(sec) { G.time += sec; const S = G.storm; for (let i = 0; i < sec * 10; i++) updateStorm(0.1); },
  warpBus(t) { const b = G.bus; if (b.active) { b.x += b.vx * t; b.z += b.vz * t; b.t += t; } },
  state, mouse,
};

/* ================= boot ================= */
setTimeout(() => {
  try { init(); } catch (e) { $('loadMsg').textContent = 'Failed to start: ' + e.message; console.error(e); throw e; }
  $('loading').style.display = 'none'; state.phase = 'lobby'; G.Audio.lobbyMusic && 0; 
  $('lobbyInfo').innerHTML = 'Island: ' + G.POIS.length + ' named locations • ' + G.World.buildings.length + ' buildings • ' + G.chests.length + ' chests & supply trucks • ' + G.Extras.bushes.length + ' bushes • ' + G.Extras.camps.length + ' campfires • ' + G.Extras.rifts.length + ' rifts<br>35 players • 34 AI bots • storm shrinks in 6 phases<br>Three.js (bundled locally) — all art generated procedurally';
  requestAnimationFrame(frame);
  if (Q.has('autostart') || sessionStorage.getItem('sf_auto')) { sessionStorage.removeItem('sf_auto'); setTimeout(() => startMatch(), 200); }
}, 60);
})();
