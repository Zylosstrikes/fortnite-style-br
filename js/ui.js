'use strict';
/* HUD, minimap, big map, screens */
(function () {
const G = window.G; const $ = id => document.getElementById(id);
const UI = G.UI = { skinColor: G.SKIN_COLORS[5], pick: (function () { try { const p = localStorage.getItem('sf_pick'); if (G.PICKAXES.some(x => x.id === p)) return p; } catch (e) { } return 'pick'; })() };
let toastT = 0, sigs = {};
UI.init = function () {
  const sw = $('swatches'); G.SKIN_COLORS.forEach((c, i) => { const d = document.createElement('div'); d.className = 'sw' + (i === 5 ? ' sel' : ''); d.style.background = '#' + c.toString(16).padStart(6, '0'); d.onclick = () => { UI.skinColor = c; [...sw.children].forEach(x => x.classList.remove('sel')); d.classList.add('sel'); G.Audio.init(); G.Audio.play('click'); }; sw.appendChild(d); });
  const pr = $('pickRow'); G.PICKAXES.forEach(px => { const d = document.createElement('div'); d.className = 'pk' + (px.id === UI.pick ? ' sel' : ''); d.dataset.id = px.id; const url = G.itemIconURL({ type: 'pickaxe', pick: px.id }); d.innerHTML = (url ? '<img src="' + url + '">' : '') + '<span>' + px.name + '</span>'; d.onclick = () => { UI.pick = px.id; try { localStorage.setItem('sf_pick', px.id); } catch (e) { } [...pr.children].forEach(x => x.classList.toggle('sel', x === d)); G.Audio.init(); G.Audio.play('click'); }; pr.appendChild(d); });
  UI.refreshLevel();
  const hb = $('hotbar'); for (let i = 0; i < 6; i++) { const d = document.createElement('div'); d.className = 'slot empty'; d.innerHTML = '<span class="k">' + (i + 1) + '</span>'; d.onclick = () => { if (G.player) G.selectSlot(G.player, i); }; hb.appendChild(d); }
  const bb = $('buildbar'); bb.innerHTML = ['wall|Q', 'floor|F', 'ramp|Z', 'roof|C'].map(s => { const [n, k] = s.split('|'); return '<div class="bslot" data-t="' + n + '"><b>' + k + '</b><span>' + n.toUpperCase() + '</span></div>'; }).join('') + ['wood', 'stone', 'metal'].map(m => '<div class="bmat" data-m="' + m + '"><b>0</b><span>' + m.toUpperCase() + ' (G)</span></div>').join('');
  const mb = $('matsBox'); mb.innerHTML = ['wood', 'stone', 'metal'].map(m => '<div class="mat" data-m="' + m + '" style="border-color:' + G.MATS[m].css + '">' + G.MATS[m].name + ' <b>0</b></div>').join('');
  // hooks
  const H = G.hooks;
  H.msg = t => UI.toast(t, 1600, true);
  H.pickup = it => UI.toast('Picked up ' + G.itemName(it), 1400, true);
  H.harvest = (m, n) => { const el = $('matsBox').querySelector('[data-m=' + m + ']'); if (el) { el.style.transform = 'skew(-8deg) scale(1.15)'; setTimeout(() => el.style.transform = 'skew(-8deg)', 120); } };
  H.hitmarker = (head, kill) => { const h = $('hitmark'); h.className = 'on' + (head || kill ? ' head' : ''); setTimeout(() => h.className = '', 110); };
  H.dmgnum = (t, dmg, head) => { if (!G.cam) return; const v = new THREE.Vector3(t.x, t.y + 2.0, t.z).project(G.cam); if (v.z > 1) return; const d = document.createElement('div'); d.className = 'dn' + (head ? ' head' : ''); d.textContent = dmg; d.style.left = ((v.x + 1) / 2 * innerWidth + (Math.random() - 0.5) * 30) + 'px'; d.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; $('dmgnums').appendChild(d); setTimeout(() => d.remove(), 900); };
  H.damaged = () => { const e = $('hurtFx'); e.style.transition = 'none'; e.style.opacity = 1; requestAnimationFrame(() => { e.style.transition = 'opacity .5s'; e.style.opacity = 0; }); };
  H.killfeed = e => {
    const d = document.createElement('div'); d.className = 'kf' + (e.you ? ' you' : '') + (e.died ? ' died' : '');
    d.innerHTML = e.killer ? '<b>' + esc(e.killer) + '</b><em>[' + esc(e.weapon) + ']</em>' + esc(e.victim) : esc(e.victim) + '<em>[' + esc(e.weapon) + ']</em>eliminated'; const f = $('killfeed'); f.appendChild(d); while (f.children.length > 6) f.firstChild.remove(); setTimeout(() => d.remove(), 7000);
  };
  $('hitmark').className = '';
};
UI.refreshLevel = function () { const l = G.levelFromXp(G.loadXp()); $('lvlNum').textContent = l.level; $('lvlTxt').textContent = l.into + ' / ' + l.need + ' XP'; $('lvlFill').style.width = (l.into / l.need * 100) + '%'; };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
UI.toast = function (t, ms, small) { const e = $('toast'); e.textContent = t; e.style.fontSize = small ? '20px' : '30px'; e.style.top = small ? '20%' : '16%'; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), ms || 2200); };
function setHTML(el, key, html) { if (sigs[key] !== html) { sigs[key] = html; el.innerHTML = html; } }
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

UI.update = function (dt) {
  const p = G.view || G.player; if (!p) return;
  $('aliveN').textContent = G.aliveCount(); $('killN').textContent = G.player.kills;
  $('hpBar').style.width = Math.max(0, p.hp) + '%'; $('shBar').style.width = p.shield + '%'; $('hpTxt').textContent = Math.ceil(p.hp); $('shTxt').textContent = Math.ceil(p.shield);
  // hotbar
  const slots = $('hotbar').children;
  for (let i = 0; i < 6; i++) {
    const s = p.inv[i], el = slots[i]; let sig = i + '|' + (p.sel === i && !p.buildMode ? 1 : 0) + '|' + (s ? (s.type + (s.w || s.id || '') + (s.rarity === undefined ? '' : s.rarity) + (s.mag === undefined ? '' : s.mag) + (s.n || '')) : '-');
    if (sigs['s' + i] === sig) continue; sigs['s' + i] = sig; el.className = 'slot' + (s ? '' : ' empty') + (p.sel === i && !p.buildMode ? ' sel' : '');
    let inner = '<span class="k">' + (i + 1) + '</span>';
    if (s) { let col = '#fff', nm = '', c = '';
      if (s.type === 'pickaxe') { nm = G.PICKAXES.find(x => x.id === (p.skin && p.skin.pick)) ? G.PICKAXES.find(x => x.id === p.skin.pick).name.split(' ')[1] || 'Pickaxe' : 'Pickaxe'; col = '#ff9a3a'; } else if (s.type === 'weapon') { nm = G.WEAPONS[s.w].short; col = G.RARITY[s.rarity].color; c = s.mag; } else if (s.type === 'gadget') { nm = G.GADGETS[s.id].short; col = G.GADGETS[s.id].color; c = s.n; } else { nm = G.HEALS[s.id].name.replace(' Potion', '').replace('Small Shield', 'Mini Shield'); col = G.HEALS[s.id].color; c = s.n; }
      const url = G.itemIconURL(s.type === 'pickaxe' ? { type: 'pickaxe', pick: p.skin && p.skin.pick } : s);
      el.style.borderColor = col; inner += (url ? '<span class="ic img" style="background-image:url(' + url + ');color:' + col + '"></span>' : '<span class="ic" style="background:' + col + ';color:' + col + '"></span>') + '<span class="n">' + nm + '</span><span class="c">' + c + '</span>'; } else el.style.borderColor = '';
    el.innerHTML = inner;
  }
  // build bar / mats
  const bb = $('buildbar'), hbx = $('hotbar'); const bm = !!p.buildMode; bb.classList.toggle('hidden', !bm || !!G.touchOn); hbx.classList.toggle('hidden', bm && !G.touchOn);
  $('cross').classList.toggle('build', bm);
  if (bm) { for (const el of bb.querySelectorAll('.bslot')) el.classList.toggle('sel', el.dataset.t === (p.buildType === 'floor' || p.buildType === 'roof' || p.buildType === 'ramp' || p.buildType === 'wall' ? p.buildType : 'wall')); for (const el of bb.querySelectorAll('.bmat')) { const m = el.dataset.m; el.classList.toggle('sel', p.buildMat === m); el.firstChild.textContent = p.mats[m]; el.style.borderColor = p.buildMat === m ? '' : ''; } }
  for (const el of $('matsBox').children) { const m = el.dataset.m; el.lastElementChild.textContent = p.mats[m]; el.classList.toggle('sel', bm && p.buildMat === m); }
  // ammo
  const it = p.inv[p.sel]; let main = '', res = '';
  if (!p.buildMode && it && it.type === 'weapon') { const W = G.WEAPONS[it.w]; main = it.mag + ' <small>/ ' + p.ammo[W.ammo] + '</small>'; res = G.RARITY[it.rarity].name + ' ' + W.name + (p.reloading > 0 ? ' — RELOADING' : ''); $('ammoRes').style.color = G.RARITY[it.rarity].color; }
  else if (it && it.type === 'heal' && !p.buildMode) { main = it.n; res = G.HEALS[it.id].name; $('ammoRes').style.color = G.HEALS[it.id].color; }
  else if (it && it.type === 'gadget' && !p.buildMode) { main = it.n; res = G.GADGETS[it.id].name + (it.id === 'tnt' ? ' — LMB to throw' : ' — LMB to place'); $('ammoRes').style.color = G.GADGETS[it.id].color; } else { $('ammoRes').style.color = '#fff'; res = p.buildMode ? 'Building — ' + p.buildType.toUpperCase() + ' (' + G.MATS[p.buildMat].name + ')' : ''; }
  setHTML($('ammoMain'), 'am', main); setHTML($('ammoRes'), 'ar', res);
  setHTML($('ammoAll'), 'aa', Object.keys(G.AMMO).map(t => '<span style="color:' + G.AMMO[t].color + '">' + G.AMMO[t].name.replace(' Bullets', '') + ' ' + p.ammo[t] + '</span>').join('<br>'));
  // action progress
  const pw = $('progressWrap');
  if (p.action) { pw.style.display = 'block'; $('progressLabel').textContent = G.HEALS[p.action.id].name; $('progress').firstChild.style.width = (p.action.t / p.action.dur * 100) + '%'; }
  else if (p.reloading > 0) { pw.style.display = 'block'; $('progressLabel').textContent = 'Reloading'; $('progress').firstChild.style.width = (1 - p.reloading / p.reloadDur) * 100 + '%'; } else pw.style.display = 'none';
  // storm
  const S = G.storm; if (S) {
    $('stormText').textContent = S.stage === 'wait' ? (S.phase === 0 ? 'Storm forming — closes in' : 'Storm shrinks in') : S.stage === 'shrink' ? 'Storm is closing' : 'Final storm'; $('stormTime').textContent = S.stage === 'done' ? '--' : mmss(S.left);
    const inStorm = Math.hypot(p.x - S.cx, p.z - S.cz) > S.r; $('stormFx').classList.toggle('on', inStorm && p.alive);
  }
  $('scope').classList.toggle('on', !!G.scoped); $('hideTag').style.display = p.hidden ? 'block' : 'none'; $('campTag').style.display = p.camp ? 'block' : 'none';
  $('cross').style.display = G.scoped || (G.view && G.view !== G.player) || p.state === 'bus' ? 'none' : 'block';
};

/* ---------- minimap ---------- */
UI.drawMini = function () {
  const p = G.view || G.player; if (!p) return; const cv = $('mini'), c = cv.getContext('2d'), S = cv.width; const src = G.World.mapCanvas; if (!src) return;
  const span = 360, k = S / span; c.save(); c.clearRect(0, 0, S, S); c.fillStyle = '#1b6a9a'; c.fillRect(0, 0, S, S);
  const sc = 512 / G.MAPSZ; const sx = (p.x + G.HALF) * sc - span * sc / 2, sz = (p.z + G.HALF) * sc - span * sc / 2; c.imageSmoothingEnabled = true;
  c.drawImage(src, sx, sz, span * sc, span * sc, 0, 0, S, S);
  const wx = x => (x - p.x) * k + S / 2, wz = z => (z - p.z) * k + S / 2;
  const St = G.storm; if (St) {
    c.save(); c.beginPath(); c.rect(0, 0, S, S); c.arc(wx(St.cx), wz(St.cz), St.r * k, 0, 6.2832, true); c.fillStyle = 'rgba(150,50,255,.5)'; c.fill('evenodd'); c.restore();
    c.strokeStyle = '#e9d0ff'; c.lineWidth = 2; c.beginPath(); c.arc(wx(St.cx), wz(St.cz), St.r * k, 0, 6.2832); c.stroke();
    if (St.stage !== 'done') { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(wx(St.nx), wz(St.nz), St.nr * k, 0, 6.2832); c.stroke(); }
  }
  const B = G.bus; if (B && B.active) { c.strokeStyle = 'rgba(255,230,80,.8)'; c.setLineDash([6, 6]); c.lineWidth = 2; c.beginPath(); c.moveTo(wx(B.sx), wz(B.sz)); c.lineTo(wx(B.ex), wz(B.ez)); c.stroke(); c.setLineDash([]); c.fillStyle = '#ffd83a'; c.beginPath(); c.arc(wx(B.x), wz(B.z), 6, 0, 6.3); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke(); }
  for (const ch of G.chests) { if (ch.opened) continue; const dx = ch.x - p.x, dz = ch.z - p.z; const big = ch.kind === 'llama' || ch.kind === 'truck'; if (Math.abs(dx) < span / 2 - 4 && Math.abs(dz) < span / 2 - 4 && (big || dx * dx + dz * dz < 140 * 140)) { if (ch.kind === 'llama') { c.fillStyle = '#ff5fb0'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(wx(ch.x), wz(ch.z), 6, 0, 6.3); c.fill(); c.stroke(); } else if (ch.kind === 'truck') { c.fillStyle = '#c08aff'; c.fillRect(wx(ch.x) - 4, wz(ch.z) - 4, 8, 8); } else { c.fillStyle = ch.style === 'metal' ? '#4de3ff' : '#ffd23a'; c.fillRect(wx(ch.x) - 2, wz(ch.z) - 2, 4, 4); } } }
  if (G.Extras) { for (const q of G.Extras.camps) { const dx = q.x - p.x, dz = q.z - p.z; if (Math.abs(dx) < span / 2 - 4 && Math.abs(dz) < span / 2 - 4) { c.fillStyle = '#ff8a2a'; c.beginPath(); c.arc(wx(q.x), wz(q.z), 3, 0, 6.3); c.fill(); } } for (const q of G.Extras.rifts) { const dx = q.x - p.x, dz = q.z - p.z; if (Math.abs(dx) < span / 2 - 5 && Math.abs(dz) < span / 2 - 5) { c.fillStyle = '#b8a8ff'; c.beginPath(); c.moveTo(wx(q.x), wz(q.z) - 5); c.lineTo(wx(q.x) + 4, wz(q.z)); c.lineTo(wx(q.x), wz(q.z) + 5); c.lineTo(wx(q.x) - 4, wz(q.z)); c.fill(); } } }
  if (G.waypoint) { let x = wx(G.waypoint.x), z = wz(G.waypoint.z); x = G.clamp(x, 8, S - 8); z = G.clamp(z, 8, S - 8); c.fillStyle = '#4de3ff'; c.beginPath(); c.moveTo(x, z + 8); c.lineTo(x - 6, z - 6); c.lineTo(x + 6, z - 6); c.fill(); }
  // player
  if (p.state !== 'bus') { c.save(); c.translate(S / 2, S / 2); c.rotate(Math.atan2(-Math.cos(p.yaw), -Math.sin(p.yaw)) + Math.PI / 2); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -9); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.stroke(); c.restore(); }
  c.restore();
};
/* ---------- big map ---------- */
UI.drawBig = function () {
  const cv = $('bigmap'), c = cv.getContext('2d'), S = cv.width, k = S / G.MAPSZ; const p = G.view || G.player; const src = G.World.mapCanvas; if (!src) return;
  c.clearRect(0, 0, S, S); c.drawImage(src, 0, 0, S, S); const wx = x => (x + G.HALF) * k, wz = z => (z + G.HALF) * k;
  const St = G.storm; if (St) { c.save(); c.beginPath(); c.rect(0, 0, S, S); c.arc(wx(St.cx), wz(St.cz), St.r * k, 0, 6.2832, true); c.fillStyle = 'rgba(150,50,255,.45)'; c.fill('evenodd'); c.restore(); c.strokeStyle = '#e9d0ff'; c.lineWidth = 3; c.beginPath(); c.arc(wx(St.cx), wz(St.cz), St.r * k, 0, 6.2832); c.stroke(); if (St.stage !== 'done') { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(wx(St.nx), wz(St.nz), St.nr * k, 0, 6.2832); c.stroke(); } }
  const B = G.bus; if (B && B.active) { c.strokeStyle = 'rgba(255,230,80,.9)'; c.setLineDash([10, 8]); c.lineWidth = 3; c.beginPath(); c.moveTo(wx(B.sx), wz(B.sz)); c.lineTo(wx(B.ex), wz(B.ez)); c.stroke(); c.setLineDash([]); c.fillStyle = '#ffd83a'; c.beginPath(); c.arc(wx(B.x), wz(B.z), 9, 0, 6.3); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 2; c.stroke(); }
  c.font = 'bold 15px Trebuchet MS, Arial'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.8)'; c.fillStyle = '#fff';
  for (const q of G.POIS) { c.strokeText(q.name, wx(q.x), wz(q.z) - 8); c.fillText(q.name, wx(q.x), wz(q.z) - 8); c.fillStyle = '#ffe36a'; c.beginPath(); c.arc(wx(q.x), wz(q.z), 4, 0, 6.3); c.fill(); c.fillStyle = '#fff'; }
  c.font = 'italic 13px Trebuchet MS, Arial'; c.fillStyle = '#e8f6ff'; for (const q of G.REGIONS) { c.strokeText(q.name, wx(q.x), wz(q.z)); c.fillText(q.name, wx(q.x), wz(q.z)); }
  for (const v of G.vehicles) { if (v.driver) continue; c.fillStyle = '#ff7a3a'; c.fillRect(wx(v.x) - 3, wz(v.z) - 3, 6, 6); }
  if (G.Extras) { for (const q of G.Extras.camps) { c.fillStyle = '#ff8a2a'; c.beginPath(); c.arc(wx(q.x), wz(q.z), 4, 0, 6.3); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke(); } for (const q of G.Extras.rifts) { c.fillStyle = '#b8a8ff'; c.beginPath(); c.moveTo(wx(q.x), wz(q.z) - 7); c.lineTo(wx(q.x) + 5, wz(q.z)); c.lineTo(wx(q.x), wz(q.z) + 7); c.lineTo(wx(q.x) - 5, wz(q.z)); c.fill(); c.stroke(); }
    for (const ch of G.chests) { if (ch.opened || (ch.kind !== 'llama' && ch.kind !== 'truck')) continue; c.fillStyle = ch.kind === 'llama' ? '#ff5fb0' : '#c08aff'; c.beginPath(); c.arc(wx(ch.x), wz(ch.z), ch.kind === 'llama' ? 8 : 6, 0, 6.3); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#fff'; c.font = 'bold 12px Trebuchet MS'; c.textAlign = 'center'; c.fillText(ch.kind === 'llama' ? 'LLAMA' : 'TRUCK', wx(ch.x), wz(ch.z) - 11); } }
  if (G.waypoint) { c.fillStyle = '#4de3ff'; c.beginPath(); c.moveTo(wx(G.waypoint.x), wz(G.waypoint.z) + 4); c.lineTo(wx(G.waypoint.x) - 8, wz(G.waypoint.z) - 14); c.lineTo(wx(G.waypoint.x) + 8, wz(G.waypoint.z) - 14); c.fill(); }
  if (p && p.state !== 'bus') { c.save(); c.translate(wx(p.x), wz(p.z)); c.rotate(Math.atan2(-Math.cos(p.yaw), -Math.sin(p.yaw)) + Math.PI / 2); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -13); c.lineTo(10, 11); c.lineTo(0, 6); c.lineTo(-10, 11); c.closePath(); c.fill(); c.stroke(); c.restore(); }
};
UI.bigClick = function (e) { const cv = $('bigmap'), r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * G.MAPSZ - G.HALF, z = (e.clientY - r.top) / r.height * G.MAPSZ - G.HALF; G.waypoint = { x, z }; G.Audio.play('click'); UI.toast('Waypoint set', 900, true); };

/* ---------- end screens ---------- */
UI.showEnd = function (win, pl, byName, canSpec) {
  const e = $('end'); e.classList.remove('hidden', 'win', 'lose'); e.classList.add(win ? 'win' : 'lose'); $('endTitle').textContent = win ? 'VICTORY ROYALE' : 'ELIMINATED';
  const st = pl.stats; $('endSub').textContent = win ? 'You are the last one standing!' : ('You placed #' + st.placement + (byName ? ' — eliminated by ' + byName : ''));
  const acc = st.shots ? Math.round(st.hits / st.shots * 100) + '%' : '--'; const tm = mmss(st.timeAlive || (G.time - st.born));
  const items = [['#' + (win ? 1 : st.placement), 'PLACEMENT'], [pl.kills, 'ELIMINATIONS'], [Math.round(st.dealt), 'DAMAGE DEALT'], [Math.round(st.taken), 'DAMAGE TAKEN'], [acc, 'ACCURACY'], [tm, 'TIME SURVIVED'], [Math.round(st.dist) + 'm', 'DISTANCE'], [st.harvested + ' / ' + st.built, 'MATS / BUILT']];
  $('endStats').innerHTML = items.map(i => '<div class="st"><b>' + i[0] + '</b><span>' + i[1] + '</span></div>').join(''); $('specBtn').style.display = canSpec ? '' : 'none';
  const cf = $('confetti'); cf.innerHTML = ''; if (win) { for (let i = 0; i < 90; i++) { const d = document.createElement('div'); d.className = 'cf'; d.style.left = Math.random() * 100 + '%'; d.style.background = ['#ffd83a', '#ff5a5a', '#3fa0ff', '#5ad65a', '#ff6bd0', '#fff'][i % 6]; d.style.animationDuration = (2.5 + Math.random() * 3) + 's'; d.style.animationDelay = Math.random() * 2 + 's'; cf.appendChild(d); } }
  // Victory crown render + XP / level-up badge
  const cr = $('crownImg'); if (win) { if (!UI._crownURL) UI._crownURL = G.renderIcon(G.makeCrown(), 260, 0.45, 0.4); if (UI._crownURL) { cr.src = UI._crownURL; cr.style.display = 'block'; } } else cr.style.display = 'none';
  if (!G._xpDone) { G._xpDone = true; try { G._xpRes = G.awardXp(pl, win); } catch (err) { G._xpRes = null; } }
  const xr = G._xpRes, xb = $('xpBox'); $('lvlBadge').classList.add('hidden');
  if (xr) { xb.style.display = 'block';
    const fr = o => o.into / o.need * 100; const startW = fr(xr.lb), endW = fr(xr.la);
    xb.innerHTML = '<div class="xpHead"><b>+' + xr.gain + ' XP</b><span>LEVEL ' + xr.la.level + '</span></div><div class="xpBar"><i id="xpFill" style="width:' + startW + '%"></i></div><div class="xpParts">' + xr.parts.filter(q => q[1] > 0).map(q => '<em>' + q[0] + ' +' + q[1] + '</em>').join('') + '</div>';
    const fill = $('xpFill'); setTimeout(() => { if (xr.levelUp) { fill.style.width = '100%'; setTimeout(() => { fill.style.transition = 'none'; fill.style.width = '0%'; requestAnimationFrame(() => { fill.style.transition = 'width .9s'; fill.style.width = endW + '%'; }); }, 1000); } else fill.style.width = endW + '%'; }, 250);
    if (xr.levelUp) { const bd = $('lvlBadge'); $('lvlBadgeNum').textContent = xr.la.level; bd.classList.remove('hidden'); bd.style.animation = 'none'; void bd.offsetWidth; bd.style.animation = ''; setTimeout(() => G.Audio.play('levelup'), 600); }
    UI.refreshLevel(); }
  G.Audio.play(win ? 'victory' : 'elim');
};
UI.hideEnd = function () { $('end').classList.add('hidden'); };
})();
