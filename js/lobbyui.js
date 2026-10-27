'use strict';
/* Lobby menu: PLAY / LOCKER / QUESTS / CAREER tabs, locker (outfit, pickaxe, glider/tint, skin tone), settings, party slots, emote/back/chat. */
(function () {
const G = window.G; const $ = id => document.getElementById(id); const U = G.LobbyUI = {};
let tab = 'play'; document.addEventListener('DOMContentLoaded', () => { const l = document.getElementById('lobby'); if (l) l.dataset.tab = 'play'; }); let ei = 0; const EMOTES = () => (G.Anim && G.Anim.emotes) || ['dance', 'wave', 'flex', 'spin'];
const panels = { locker: 'locker', quests: 'questsPanel', career: 'careerPanel' };
function show(t) {
  tab = t; document.querySelectorAll('.ntab').forEach(b => b.classList.toggle('sel', b.dataset.tab === t));
  for (const k in panels) $(panels[k]).classList.toggle('hidden', k !== t); $('lobbySettings').classList.add('hidden');
  const play = t === 'play'; $('lobby').classList.toggle('t-' + 'play', play); $('lobby').dataset.tab = t;
  if (t === 'career') careerFill(); if (G.UI && G.UI.refreshLevel) G.UI.refreshLevel();
  try { G.Audio.init(); G.Audio.play('click'); } catch (e) { }
}
function careerFill() {
  const l = G.levelFromXp(G.loadXp()); const nm = ($('nameInput').value || 'Player');
  $('careerBody').innerHTML = '<div class="cr-big"><b>' + nm.replace(/[<>&]/g, '') + '</b><span>Level ' + l.level + '</span></div><div class="cr-bar"><i style="width:' + (l.into / l.need * 100) + '%"></i></div><div class="lnote">' + l.into + ' / ' + l.need + ' XP to the next level. Earn XP by surviving, eliminating players and winning matches.</div>';
}
function init() {
  document.querySelectorAll('.ntab').forEach(b => b.addEventListener('click', () => show(b.dataset.tab)));
  document.querySelectorAll('.ltab').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.ltab').forEach(x => x.classList.toggle('sel', x === b)); document.querySelectorAll('.lpane').forEach(p => p.classList.toggle('hidden', p.dataset.lp !== b.dataset.lt)); }));
  const eg = $('emoteGrid'); if (eg) { EMOTES().forEach((n, i) => { const b = document.createElement('button'); b.dataset.e = n; b.innerHTML = '<i>' + (i + 1) + '</i>' + ((G.Anim && G.Anim.labels[n]) || n.toUpperCase()); b.onclick = () => { eg.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); if (G.Anim) G.Anim.lobbyPlay(n, { hold: true }); }; eg.appendChild(b); });
    $('emoteStop').onclick = () => { eg.querySelectorAll('button').forEach(x => x.classList.remove('sel')); if (G.Anim) G.Anim.lobbyStop(); }; }
  $('gearBtn').addEventListener('click', () => { const s = $('lobbySettings'); const open = s.classList.contains('hidden'); show('play'); s.classList.toggle('hidden', !open); });
  $('backBtn').addEventListener('click', () => { if (tab !== 'play' || !$('lobbySettings').classList.contains('hidden') || !$('lobbyChat').classList.contains('hidden')) { show('play'); $('lobbyChat').classList.add('hidden'); } else G.UI.toast('Already at the main lobby', 1400); });
  $('emoteBtn').addEventListener('click', () => { if (G.lobbyEmote) G.lobbyEmote(EMOTES()[ei++ % EMOTES().length]); });
  $('chatBtn').addEventListener('click', () => $('lobbyChat').classList.toggle('hidden'));
  const send = () => { const i = $('chatIn'), v = i.value.trim(); if (!v) return; const p = document.createElement('p'); p.innerHTML = '<b></b> '; p.firstChild.textContent = ($('nameInput').value || 'Player'); p.appendChild(document.createTextNode(v)); $('chatLog').appendChild(p); i.value = ''; $('chatLog').scrollTop = 1e6; };
  $('chatSend').addEventListener('click', send); $('chatIn').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') send(); });
  $('nameInput').addEventListener('keydown', e => e.stopPropagation());
  // party slots (HTML '+' markers follow the 3D discs)
  U.slotEls = G.Lobby.slots.map((s, i) => { const b = document.createElement('button'); b.className = 'slotPlus'; b.textContent = '+'; b.title = 'Invite a friend'; b.onclick = () => G.UI.toast('Party invites need online play — this build is single-player', 2600); $('slotsLayer').appendChild(b); return b; });
}
/* called every lobby frame with the lobby camera + canvas rect */
U.layout = function (cam, w, h) {
  if (!U.slotEls) return; const V = new THREE.Vector3();
  G.Lobby.slots.forEach((s, i) => { V.set(s.x, 1.3, s.z).project(cam); const el = U.slotEls[i]; const vis = V.z < 1 && tab === 'play'; el.style.display = vis ? 'flex' : 'none'; if (vis) { el.style.left = ((V.x + 1) / 2 * w) + 'px'; el.style.top = ((1 - V.y) / 2 * h) + 'px'; } });
};
U.tab = () => tab;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0)); else setTimeout(init, 0);
})();
