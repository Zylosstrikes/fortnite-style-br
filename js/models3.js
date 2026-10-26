'use strict';
/* v2 art: stylised humanoid characters + outfits, umbrella glider, balloon battle bus, weapons, pickaxes.
   100% original, procedurally generated from primitives (merged into a few draw calls each). */
(function () {
const G = window.G, T = THREE; const Bd = G.Builder;
const GOLD = 0xffc83a;

/* ================= weapons (one merged mesh + one glow mesh each, cached) ================= */
function pistol(b, ox, acc) {
  const slide = 0xdfe4ec, frame = 0x8a909b, dark = 0x2b2f38;
  b.box(0.066, 0.08, 0.32, slide, ox, 0.025, -0.14); b.box(0.06, 0.05, 0.27, frame, ox, -0.035, -0.12); b.cyl(0.018, 0.07, dark, ox, 0.025, -0.33, 'z');
  for (let i = 0; i < 4; i++) b.box(0.07, 0.07, 0.012, 0xb0b7c2, ox, 0.025, -0.02 - i * 0.025);
  b.box(0.012, 0.03, 0.02, dark, ox, 0.078, -0.3); b.box(0.04, 0.022, 0.04, dark, ox, 0.078, 0.0);
  b.box(0.068, 0.02, 0.22, acc, ox, 0.07, -0.14, 0, 0, 0, true);
  b.box(0.06, 0.18, 0.09, dark, ox, -0.125, 0.04, 0.2, 0, 0); for (const s of [-1, 1]) b.box(0.014, 0.15, 0.075, GOLD, ox + s * 0.037, -0.12, 0.04, 0.2, 0, 0);
  b.box(0.014, 0.05, 0.1, dark, ox, -0.075, -0.03);
}
const WCACHE = {};
G.weaponModel = function (id, rarHex) {
  const key = id + '|' + (rarHex || 0xffffff); if (!WCACHE[key]) WCACHE[key] = buildWeapon(id, rarHex || 0xffffff); return WCACHE[key].clone();
};
function buildWeapon(id, acc) {
  const b = new Bd(); const dark = 0x2b2f38, mid = 0x454b57, blk = 0x1b1e24;
  if (id === 'pistol') pistol(b, 0, acc);
  else if (id === 'dual') { pistol(b, -0.1, acc); pistol(b, 0.1, acc); }
  else if (id === 'shotgun') { // pump-action
    const steel = 0x6a7280, wood = 0xa86a36, woodD = 0x7a4a26;
    b.cyl(0.03, 0.86, steel, 0, 0.03, -0.5, 'z'); b.cyl(0.036, 0.05, dark, 0, 0.03, -0.94, 'z'); b.cyl(0.027, 0.66, 0x4a505c, 0, -0.045, -0.46, 'z'); b.cyl(0.034, 0.04, 0x9aa2ae, 0, -0.045, -0.8, 'z');
    b.box(0.014, 0.014, 0.8, 0xcfd6e2, 0, 0.07, -0.5); b.box(0.012, 0.03, 0.012, 0xffd83a, 0, 0.085, -0.92); b.box(0.04, 0.025, 0.03, dark, 0, 0.085, 0.04);
    b.box(0.108, 0.14, 0.36, 0x3a3f4a, 0, 0.0, -0.04); b.box(0.112, 0.045, 0.1, 0x14161b, 0.0, 0.03, -0.14); b.box(0.115, 0.012, 0.3, 0x5a6270, 0, 0.075, -0.04);
    b.box(0.118, 0.1, 0.26, wood, 0, -0.055, -0.5); for (let i = 0; i < 4; i++) b.box(0.122, 0.104, 0.012, woodD, 0, -0.055, -0.4 - i * 0.055);
    b.box(0.09, 0.14, 0.4, wood, 0, -0.04, 0.3, -0.12, 0, 0); b.box(0.095, 0.17, 0.04, 0x1d2026, 0, -0.07, 0.5, -0.12, 0, 0); b.box(0.096, 0.03, 0.2, acc, 0, 0.04, 0.3, -0.12, 0, 0, true);
    b.box(0.06, 0.13, 0.07, wood, 0, -0.12, 0.1, 0.25, 0, 0); b.box(0.014, 0.012, 0.1, dark, 0, -0.08, -0.02); b.box(0.03, 0.06, 0.012, GOLD, 0.06, 0.0, -0.1, 0, 0, 0, true);
  } else if (id === 'ar') { // modern assault rifle
    const tan = 0xd2b070, tanD = 0xa98450;
    b.box(0.094, 0.11, 0.3, tan, 0, 0, -0.05); b.box(0.092, 0.075, 0.4, tanD, 0, 0.075, -0.14); b.box(0.088, 0.1, 0.46, tan, 0, 0.0, -0.58); for (let i = 0; i < 5; i++) b.box(0.07, 0.016, 0.03, blk, 0, 0.056, -0.42 - i * 0.07);
    b.box(0.07, 0.02, 0.5, blk, 0, 0.06, -0.62); b.cyl(0.019, 0.3, blk, 0, 0.02, -0.98, 'z'); b.cyl(0.032, 0.08, blk, 0, 0.02, -1.14, 'z', 0.026, 6);
    b.box(0.058, 0.09, 0.26, blk, 0, 0.13, -0.16); b.box(0.04, 0.025, 0.05, 0x14161b, 0, 0.18, -0.16); b.box(0.026, 0.026, 0.02, 0xff3a3a, 0, 0.12, -0.3, 0, 0, 0, true); b.box(0.02, 0.07, 0.02, blk, 0, 0.1, -0.88); b.box(0.014, 0.014, 0.1, blk, 0, 0.145, 0.1);
    b.box(0.062, 0.2, 0.09, blk, 0, -0.17, -0.1, 0.15, 0, 0); b.box(0.06, 0.12, 0.085, blk, 0, -0.3, -0.03, 0.35, 0, 0); b.box(0.064, 0.016, 0.092, acc, 0, -0.34, -0.015, 0.35, 0, 0, true);
    b.box(0.066, 0.17, 0.085, blk, 0, -0.14, 0.12, 0.35, 0, 0); b.cyl(0.03, 0.28, blk, 0, 0.0, 0.3, 'z'); b.box(0.085, 0.15, 0.22, tan, 0, -0.02, 0.48, -0.04, 0, 0); b.box(0.09, 0.17, 0.04, 0x14161b, 0, -0.02, 0.6);
    b.box(0.096, 0.02, 0.36, acc, 0, 0.0, -0.6, 0, 0, 0, true);
  } else if (id === 'smg') { // tactical SMG
    const gm = 0x3a404c;
    b.box(0.088, 0.12, 0.36, blk, 0, 0, -0.08); b.box(0.074, 0.025, 0.4, gm, 0, 0.074, -0.1); for (let i = 0; i < 7; i++) b.box(0.08, 0.016, 0.014, 0x707886, 0, 0.088, 0.06 - i * 0.055);
    b.box(0.074, 0.085, 0.22, gm, 0, 0.005, -0.36); b.cyl(0.037, 0.26, 0x24272e, 0, 0.01, -0.58, 'z'); for (const z of [-0.5, -0.58, -0.66]) b.cyl(0.04, 0.012, 0x6a7280, 0, 0.01, z, 'z');
    b.box(0.06, 0.05, 0.1, blk, 0, 0.125, -0.15); b.box(0.052, 0.05, 0.012, 0x14161b, 0, 0.14, -0.2); b.box(0.034, 0.03, 0.01, 0xff4a4a, 0, 0.14, -0.206, 0, 0, 0, true);
    b.box(0.044, 0.15, 0.052, gm, 0, -0.11, -0.34); b.box(0.052, 0.34, 0.075, blk, 0, -0.22, -0.02, 0.1, 0, 0); b.box(0.056, 0.02, 0.08, acc, 0, -0.395, -0.005, 0.1, 0, 0, true); b.box(0.054, 0.1, 0.082, 0x2a2e36, 0, -0.1, 0.0, 0.15, 0, 0);
    b.box(0.062, 0.14, 0.078, blk, 0, -0.11, 0.1, 0.3, 0, 0); for (const s of [-1, 1]) b.box(0.014, 0.014, 0.24, 0xaab2c0, s * 0.032, 0.02, 0.27); b.box(0.08, 0.1, 0.024, 0x9aa1ad, 0, 0.0, 0.4);
    b.box(0.03, 0.045, 0.04, blk, 0, 0.1, 0.06); b.box(0.09, 0.02, 0.3, acc, 0, 0.0, -0.1, 0, 0, 0, true);
  } else if (id === 'sniper') {
    const body = 0x3b4a5c, bodyD = 0x2a3442;
    b.cyl(0.024, 0.95, 0x22262d, 0, 0.02, -0.98, 'z'); b.cyl(0.045, 0.1, blk, 0, 0.02, -1.5, 'z'); for (const z of [-1.47, -1.52]) b.box(0.1, 0.016, 0.012, 0x6a7280, 0, 0.02, z);
    b.box(0.085, 0.12, 0.62, body, 0, 0, -0.18); b.box(0.07, 0.07, 0.4, bodyD, 0, 0.03, -0.62); b.box(0.09, 0.07, 0.2, body, 0, 0.1, 0.1);
    b.cyl(0.052, 0.46, 0x14161b, 0, 0.16, -0.22, 'z'); b.cyl(0.07, 0.1, 0x14161b, 0, 0.16, -0.5, 'z', 0.052); b.cyl(0.058, 0.07, 0x14161b, 0, 0.16, 0.05, 'z'); b.cyl(0.058, 0.01, 0x6ad0ff, 0, 0.16, -0.555, 'z', 0.058, 10, true);
    b.box(0.024, 0.06, 0.04, blk, 0, 0.11, -0.12); b.box(0.024, 0.06, 0.04, blk, 0, 0.11, -0.4); b.box(0.026, 0.026, 0.12, acc, 0, 0.16, -0.22, 0, 0, 0, true);
    b.cyl(0.012, 0.12, 0xaab2c0, 0.09, 0.04, 0.02, 'x'); b.sph(0.028, 0xaab2c0, 0.155, 0.04, 0.02);
    b.box(0.095, 0.2, 0.46, body, 0, -0.02, 0.45, -0.05, 0, 0); b.box(0.1, 0.07, 0.2, bodyD, 0, 0.1, 0.5, -0.05, 0, 0); b.box(0.1, 0.22, 0.04, blk, 0, -0.03, 0.7);
    b.box(0.06, 0.13, 0.08, blk, 0, -0.11, 0.12, 0.3, 0, 0); b.box(0.05, 0.1, 0.07, blk, 0, -0.09, -0.15);
    for (const s of [-1, 1]) b.box(0.014, 0.014, 0.42, 0x6a7280, s * 0.04, -0.03, -1.0, 0, s * 0.04, 0);
  } else if (id === 'rocket') { // shoulder launcher with loaded warhead
    const og = 0xff7a1a, ogD = 0xd85a08, steel = 0x59606c;
    b.cyl(0.15, 0.95, og, 0, 0.04, -0.3, 'z', 0.15, 14); b.cyl(0.2, 0.14, ogD, 0, 0.04, -0.82, 'z', 0.2, 14); b.cyl(0.15, 0.03, 0x15181d, 0, 0.04, -0.9, 'z', 0.15, 14);
    for (const z of [-0.56, -0.1, 0.18]) b.cyl(0.158, 0.07, steel, 0, 0.04, z, 'z', 0.158, 14); b.cyl(0.203, 0.04, acc, 0, 0.04, -0.68, 'z', 0.203, 14, true);
    b.cyl(0.2, 0.26, steel, 0, 0.04, 0.4, 'z', 0.1, 14); b.cyl(0.11, 0.06, 0x15181d, 0, 0.04, 0.55, 'z', 0.11, 10);
    b.cone(0.12, 0.34, 0xff3a3a, 0, 0.04, -1.1, -Math.PI / 2, 0, 0, 12); b.cyl(0.115, 0.18, 0xffd83a, 0, 0.04, -0.96, 'z', 0.115, 12);
    b.box(0.05, 0.12, 0.4, 0xffb040, 0, 0.24, -0.3); b.box(0.04, 0.05, 0.03, 0x15181d, 0, 0.32, -0.12); b.box(0.07, 0.16, 0.09, 0x23262c, 0, -0.16, 0.05, 0.2, 0, 0); b.box(0.06, 0.14, 0.07, 0x23262c, 0, -0.14, -0.42);
    b.box(0.014, 0.12, 0.6, 0xffd24a, 0.152, 0.04, -0.3, 0, 0, 0, true);
  }
  const g = G.bakeBuilder(b, { outline: false }); g.scale.setScalar(1.15); return g;
}

/* ================= pickaxes ================= */
G._buildWeapon = (id, acc) => buildWeapon(id, acc); G._buildPick = (k) => buildPick(k); // used by blender/tools/dump_specs.py
const PCACHE = {};
G.pickaxeModel = function (kind) { kind = kind || 'pick'; if (!PCACHE[kind]) PCACHE[kind] = buildPick(kind); return PCACHE[kind].clone(); };
function buildPick(kind) {
  const b = new Bd(); const wood = 0x9a6a3c, steel = 0xb0bac8, steelD = 0x6a7482;
  if (kind === 'axe') { b.cyl(0.027, 1.0, wood, 0, 0, -0.32, 'z'); b.box(0.06, 0.06, 0.1, GOLD, 0, 0, 0.18, 0, 0, 0, true); b.box(0.07, 0.17, 0.2, steelD, 0, 0, -0.78); b.box(0.035, 0.36, 0.28, steel, 0, -0.18, -0.8); b.box(0.04, 0.3, 0.04, 0xe6f0ff, 0, -0.18, -0.95, 0, 0, 0, true); b.box(0.06, 0.1, 0.12, steelD, 0, 0.09, -0.74); }
  else if (kind === 'shovel') { b.cyl(0.026, 1.0, wood, 0, 0, -0.32, 'z'); b.box(0.2, 0.045, 0.045, wood, 0, 0, 0.2); b.box(0.1, 0.04, 0.14, steelD, 0, 0, -0.82); b.box(0.26, 0.03, 0.36, steel, 0, 0, -1.02); b.box(0.04, 0.034, 0.3, GOLD, 0, 0.02, -1.02, 0, 0, 0, true); }
  else if (kind === 'sickle') { b.cyl(0.026, 1.0, 0x3a3340, 0, 0, -0.32, 'z'); b.sph(0.05, 0xb45cff, 0, 0, 0.18, 1, 1, 1, 8, true); const tor = new T.TorusGeometry(0.3, 0.032, 6, 18, Math.PI * 1.15); b.add(tor, 0xdfe6f2, 0, -0.28, -0.78, 1, 1, 1, 0, Math.PI / 2, 0); b.box(0.06, 0.06, 0.1, steelD, 0, 0, -0.74); }
  else if (kind === 'hammer') { b.cyl(0.03, 0.98, wood, 0, 0, -0.3, 'z'); b.box(0.05, 0.05, 0.1, GOLD, 0, 0, 0.2, 0, 0, 0, true); b.box(0.34, 0.19, 0.19, steel, 0, 0, -0.82); for (const s of [-1, 1]) b.box(0.05, 0.22, 0.22, GOLD, s * 0.19, 0, -0.82, 0, 0, 0, true); b.box(0.08, 0.1, 0.1, steelD, 0, 0, -0.72); }
  else { b.cyl(0.027, 0.9, wood, 0, 0, -0.35, 'z'); b.box(0.12, 0.09, 0.12, steelD, 0, 0, -0.78); // curved double pick head
    b.box(0.2, 0.07, 0.08, steel, 0.14, 0, -0.78, 0, 0, -0.12); b.box(0.2, 0.07, 0.08, steel, -0.14, 0, -0.78, 0, 0, 0.12); b.cone(0.04, 0.2, 0xff6b3a, 0.3, -0.03, -0.78, 0, 0, Math.PI / 2 + 0.3, 6); b.cone(0.04, 0.2, 0xff6b3a, -0.3, -0.03, -0.78, 0, 0, -Math.PI / 2 - 0.3, 6); b.cyl(0.035, 0.12, 0xff6b3a, 0, 0, 0.05, 'z'); }
  return G.bakeBuilder(b, { outline: false });
}

/* ================= outfits ================= */
G.OUTFITS = [
  { id: 'ranger', name: 'Trail Ranger', top: 0x3f9a4a, top2: 0xf0e2a6, pants: 0x8a6a3a, boots: 0x5a3a22, glove: 0x5a3a22, pack: 0x7a6a30, packT: 'round', head: 'cap', headC: 0x3f9a4a, hair: 'short', hairC: 0x6a4026 },
  { id: 'neon', name: 'Neon Drifter', top: 0xff4fa8, top2: 0x35e0ff, pants: 0x232633, boots: 0xffffff, glove: 0x232633, pack: 0x35e0ff, packT: 'box', head: null, hair: 'spiky', hairC: 0x35e0ff, glasses: 'visor' },
  { id: 'frost', name: 'Frost Guard', top: 0xeaf4ff, top2: 0x3fa0ff, pants: 0x2d5fb0, boots: 0x34405a, glove: 0x3fa0ff, pack: 0x3fa0ff, packT: 'box', head: 'beanie', headC: 0x3fa0ff, hair: 'short', hairC: 0xd8b07a },
  { id: 'gold', name: 'Gold Rush', top: 0xffc83a, top2: 0x1f3b78, pants: 0x1f3b78, boots: 0x23262c, glove: 0xffffff, pack: 0xff7a1a, packT: 'round', head: 'helmet', headC: 0xffc83a, hair: 'none' },
  { id: 'shadow', name: 'Shadow Op', top: 0x35304a, top2: 0xb45cff, pants: 0x1d1c28, boots: 0x111116, glove: 0xb45cff, pack: 0x4a4468, packT: 'box', head: 'hood', headC: 0x35304a, mask: 0x1d1c28, glasses: 'visor', hair: 'none' },
  { id: 'beach', name: 'Beach Bro', top: 0xff8a3a, top2: 0xfff2c0, pants: 0x2ec4b6, shorts: true, boots: 0xffffff, glove: 0, pack: 0xffd83a, packT: 'round', head: 'sunhat', headC: 0xffe08a, hair: 'short', hairC: 0xe0b060, glasses: 'shades' },
  { id: 'knight', name: 'Tin Knight', top: 0xb9c2d0, top2: 0xe03a3a, pants: 0x7c8594, boots: 0x4a5260, glove: 0x7c8594, pack: 0xe03a3a, packT: 'cape', head: 'knight', headC: 0xc9d2de, plates: true, hair: 'none' },
  { id: 'circuit', name: 'Circuit Pal', top: 0xf4f4f4, top2: 0x3fd0ff, pants: 0xcfd6e2, boots: 0x3fd0ff, glove: 0xf4f4f4, pack: 0x3fd0ff, packT: 'box', head: 'robot', headC: 0xf4f4f4, robot: true, hair: 'none' },
  { id: 'dino', name: 'Dino Hoodie', top: 0x5ad65a, top2: 0xffe36a, pants: 0x40414a, boots: 0xffe36a, glove: 0x5ad65a, pack: 0x2f9a3a, packT: 'round', head: 'dino', headC: 0x5ad65a, hair: 'none' },
  { id: 'cow', name: 'Dusty Cowpoke', top: 0xc6823a, top2: 0x7a3d1c, pants: 0x3a5a8a, boots: 0x6a3d1c, glove: 0x6a3d1c, pack: 0x7a3d1c, packT: 'roll', head: 'cowboy', headC: 0x8a5a2c, hair: 'short', hairC: 0x2a1a10, mask: 0xd9433a },
  { id: 'lab', name: 'Lab Rat', top: 0xf4f4f4, top2: 0xff7a1a, pants: 0x40414a, boots: 0xff7a1a, glove: 0xffffff, pack: 0xff7a1a, packT: 'box', head: 'goggles', headC: 0xff7a1a, hair: 'spiky', hairC: 0xff7a1a },
  { id: 'punk', name: 'Pixel Punk', top: 0x8a6bff, top2: 0xffe36a, pants: 0x2b2f3a, boots: 0xff4f4f, glove: 0xffe36a, pack: 0xff4f4f, packT: 'round', head: null, hair: 'mohawk', hairC: 0xff4fa8, glasses: 'round' },
];
G.SKIN_TONES = [0xffe0c4, 0xf2c9a0, 0xd9a577, 0xa87650, 0x7b5236, 0x5a3a26];
const _hsl = {};
function hueShift(hex, dh, ds) { const c = new T.Color(hex); c.getHSL(_hsl); c.setHSL((_hsl.h + dh + 1) % 1, Math.max(0, Math.min(1, _hsl.s * (ds || 1))), _hsl.l); return c.getHex(); }
/* random outfit for a bot: random preset, random hue/tone shift, random hair colour */
G.randomSkin = function () {
  const oi = Math.floor(Math.random() * G.OUTFITS.length), o = G.OUTFITS[oi]; const dh = Math.random() < 0.6 ? (Math.random() - 0.5) * 0.5 : 0;
  return { outfit: oi, tone: G.pick(G.SKIN_TONES), shirt: dh ? hueShift(o.top, dh) : o.top, acc: dh ? hueShift(o.top2, dh * 0.6) : o.top2, pants: dh ? hueShift(o.pants, -dh * 0.5) : o.pants, hairC: G.pick([0x2a1a10, 0x6a4026, 0xd8b07a, 0xff7a1a, 0xf4f4f4, 0x35e0ff, 0xff4fa8, 0x5ad65a]), pick: G.pick(G.PICKAXES).id };
};

/* ================= character rig ================= */
const SEGCACHE = {};
function buildSegments(skin) {
  const oi = skin.outfit === undefined ? 0 : skin.outfit; const O = G.OUTFITS[oi % G.OUTFITS.length];
  const tone = skin.tone || 0xf2c9a0, top = skin.shirt !== undefined ? skin.shirt : O.top, top2 = skin.acc !== undefined ? skin.acc : O.top2, pants = skin.pants !== undefined ? skin.pants : O.pants, hairC = skin.hairC !== undefined ? skin.hairC : (O.hairC || 0x3a2a1a);
  const key = [oi, tone, top, top2, pants, hairC].join('|'); if (SEGCACHE[key]) return SEGCACHE[key];
  const robot = !!O.robot, skinC = robot ? 0xdfe6f2 : tone, glove = O.glove === 0 ? skinC : (O.glove || top2), boots = O.boots, trim = 0x22252c;
  const S = { torso: new Bd(), head: new Bd(), uarm: [new Bd(), new Bd()], farm: [new Bd(), new Bd()], thigh: [new Bd(), new Bd()], shin: [new Bd(), new Bd()] };
  // ---- torso (absolute m-space; feet at y=0) ----
  const t = S.torso;
  t.box(0.64, 0.2, 0.38, pants, 0, 0.9, 0); t.box(0.66, 0.06, 0.4, trim, 0, 1.0, 0); t.box(0.1, 0.07, 0.03, GOLD, 0, 1.0, -0.2, 0, 0, 0, true);
  t.box(0.7, 0.5, 0.42, top, 0, 1.25, 0); t.box(0.78, 0.16, 0.4, top, 0, 1.46, 0); t.box(0.2, 0.2, 0.03, top2, 0, 1.28, -0.215); t.box(0.07, 0.07, 0.03, top, 0, 1.28, -0.235, 0, 0, Math.PI / 4);
  t.box(0.7, 0.06, 0.43, top2, 0, 1.06, 0); t.box(0.3, 0.08, 0.3, skinC, 0, 1.55, -0.02); t.box(0.34, 0.07, 0.34, O.hood ? top : top2, 0, 1.52, 0);
  if (O.plates) { for (const s of [-1, 1]) { t.sph(0.17, O.top, s * 0.44, 1.5, 0, 1, 0.7, 1.1); t.box(0.1, 0.03, 0.1, O.top2, s * 0.44, 1.58, 0); } t.box(0.5, 0.36, 0.05, 0xdfe6f2, 0, 1.27, -0.23); }
  if (robot) { t.box(0.34, 0.2, 0.04, 0x1d2530, 0, 1.28, -0.215); t.box(0.26, 0.12, 0.03, 0x3fd0ff, 0, 1.28, -0.235, 0, 0, 0, true); }
  // backpack
  const pk = O.pack, pt = O.packT;
  if (pt === 'round') { t.sph(0.22, pk, 0, 1.25, 0.37, 1, 1.1, 0.8); t.box(0.3, 0.12, 0.1, trim, 0, 1.12, 0.52); }
  else if (pt === 'cape') { t.box(0.72, 0.85, 0.05, pk, 0, 1.1, 0.26, 0.05, 0, 0); t.box(0.78, 0.08, 0.08, GOLD, 0, 1.52, 0.24, 0, 0, 0, true); }
  else if (pt === 'roll') { t.box(0.46, 0.46, 0.2, pk, 0, 1.2, 0.3); t.cyl(0.13, 0.52, 0xd9c9a0, 0, 1.48, 0.3, 'x'); }
  else { t.box(0.46, 0.54, 0.22, pk, 0, 1.2, 0.31); t.box(0.38, 0.2, 0.05, trim, 0, 1.1, 0.43); t.box(0.1, 0.5, 0.24, top2, 0.12, 1.2, 0.31); }
  for (const s of [-1, 1]) t.box(0.07, 0.5, 0.03, trim, s * 0.2, 1.35, -0.215);
  // ---- head (pivot (0,1.76,0), built in head-local coords) ----
  const h = S.head;
  if (!O.dinoHead) h.sph(0.34, skinC, 0, 0, 0, 1, 1.05, 0.97, 14);
  h.box(0.2, 0.12, 0.2, skinC, 0, -0.3, 0.0);
  if (robot) { h.box(0.5, 0.2, 0.06, 0x1d2530, 0, 0.03, -0.3); h.box(0.1, 0.1, 0.03, 0x3fd0ff, -0.11, 0.03, -0.335, 0, 0, 0, true); h.box(0.1, 0.1, 0.03, 0x3fd0ff, 0.11, 0.03, -0.335, 0, 0, 0, true); h.box(0.2, 0.025, 0.03, 0x3fd0ff, 0, -0.1, -0.33, 0, 0, 0, true); h.cyl(0.015, 0.2, 0x8a929e, 0, 0.5, 0.0); h.sph(0.05, 0xff4f4f, 0, 0.62, 0, 1, 1, 1, 8, true); for (const s of [-1, 1]) h.cyl(0.07, 0.1, 0x3fd0ff, s * 0.35, 0, 0, 'x'); }
  else {
    for (const s of [-1, 1]) { h.sph(0.075, 0xffffff, s * 0.125, 0.03, -0.285, 1, 1.25, 0.5, 8); h.sph(0.043, 0x1a1a22, s * 0.125, 0.025, -0.318, 1, 1.15, 0.5, 8); h.sph(0.014, 0xffffff, s * 0.135, 0.05, -0.335, 1, 1, 1, 6);
      h.box(0.11, 0.03, 0.03, hairC === 0xf4f4f4 ? 0x9aa1ad : hairC, s * 0.125, 0.12, -0.3, 0, 0, s * -0.12); h.sph(0.06, skinC, s * 0.335, -0.02, 0.02, 0.6, 1, 1, 6); }
    h.box(0.055, 0.06, 0.06, skinC, 0, -0.04, -0.325); h.box(0.12, 0.022, 0.03, 0x7a2f2f, 0, -0.14, -0.3);
  }
  if (O.mask) { const mc = O.mask; h.box(0.4, 0.17, 0.1, mc, 0, -0.12, -0.26); h.box(0.42, 0.04, 0.36, mc, 0, -0.03, -0.1); }
  const hk = O.head, HC = O.headC || top2;
  const hairStyle = O.hair === undefined ? 'short' : O.hair;
  if (hairStyle === 'short' && hk !== 'helmet' && hk !== 'hood') { h.sph(0.355, hairC, 0, 0.1, 0.05, 1, 0.8, 1.0, 12); h.box(0.38, 0.07, 0.04, hairC, 0, 0.2, -0.3, 0.2, 0, 0); }
  else if (hairStyle === 'spiky') { h.sph(0.35, hairC, 0, 0.1, 0.05, 1, 0.7, 1.0, 10); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; h.cone(0.07, 0.3, hairC, Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17, Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6, 5); } h.cone(0.08, 0.34, hairC, 0, 0.36, 0, 0, 0, 0, 5); }
  else if (hairStyle === 'mohawk') { for (let i = 0; i < 6; i++) h.box(0.07, 0.16 + 0.12 * Math.sin(i / 5 * Math.PI), 0.1, hairC, 0, 0.33 + 0.02 * Math.sin(i / 5 * Math.PI), -0.28 + i * 0.1); }
  if (hk === 'cap') { h.sph(0.365, HC, 0, 0.12, 0.02, 1, 0.62, 1.0, 12); h.box(0.34, 0.035, 0.24, HC, 0, 0.14, -0.4); h.box(0.1, 0.06, 0.04, top2, 0, 0.26, -0.34, 0, 0, 0, true); }
  else if (hk === 'beanie') { h.cyl(0.355, 0.26, HC, 0, 0.2, 0.0, 'y', 0.3, 12); h.cyl(0.365, 0.07, top2, 0, 0.1, 0, 'y', 0.365, 12); h.sph(0.09, 0xffffff, 0, 0.4, 0, 1, 1, 1, 8); }
  else if (hk === 'helmet') { h.sph(0.385, HC, 0, 0.1, 0.02, 1, 0.85, 1.02, 14); h.box(0.1, 0.06, 0.62, top2, 0, 0.42, 0); h.box(0.5, 0.05, 0.1, 0x23262c, 0, 0.17, -0.3); for (const s of [-1, 1]) h.box(0.04, 0.2, 0.2, HC, s * 0.37, -0.05, 0.02); }
  else if (hk === 'hood') { h.sph(0.4, HC, 0, 0.04, 0.1, 1, 1, 1.08, 12); h.box(0.5, 0.08, 0.1, trim, 0, 0.2, -0.33); h.cone(0.12, 0.3, HC, 0, 0.36, 0.2, 0.7, 0, 0, 6); }
  else if (hk === 'sunhat') { h.cyl(0.62, 0.035, HC, 0, 0.16, 0, 'y', 0.62, 16); h.sph(0.3, HC, 0, 0.18, 0, 1, 0.7, 1, 10); h.box(0.62, 0.05, 0.62, top2, 0, 0.19, 0); h.cyl(0.31, 0.06, 0xff4f4f, 0, 0.2, 0, 'y', 0.31, 12); }
  else if (hk === 'cowboy') { h.cyl(0.55, 0.03, HC, 0, 0.16, 0, 'y', 0.55, 16); h.box(0.7, 0.03, 0.12, HC, 0, 0.18, -0.4, -0.2, 0, 0); h.cyl(0.28, 0.24, HC, 0, 0.3, 0, 'y', 0.24, 12); h.cyl(0.285, 0.05, 0x4a2a14, 0, 0.22, 0, 'y', 0.285, 12); }
  else if (hk === 'knight') { h.sph(0.39, HC, 0, 0.08, 0.02, 1, 0.95, 1.02, 14); h.box(0.5, 0.06, 0.06, 0x23262c, 0, 0.06, -0.37); h.box(0.06, 0.2, 0.06, 0x23262c, 0, -0.04, -0.37); for (let i = 0; i < 5; i++) h.cone(0.05, 0.22 - Math.abs(i - 2) * 0.03, 0xe03a3a, 0, 0.44, -0.12 + i * 0.1, -0.2 + i * 0.1, 0, 0, 5); }
  else if (hk === 'dino') { h.sph(0.39, HC, 0, 0.04, 0.06, 1, 1, 1.04, 12); for (let i = 0; i < 5; i++) h.cone(0.07, 0.2 - i * 0.015, top2, 0, 0.36 - i * 0.07, -0.1 + i * 0.12, 0, 0, 0, 5); for (const s of [-1, 1]) { h.sph(0.08, 0xffffff, s * 0.17, 0.3, -0.24, 1, 1, 1, 8); h.sph(0.04, 0x1a1a22, s * 0.17, 0.3, -0.31, 1, 1, 1, 6); } }
  else if (hk === 'goggles') { h.box(0.72, 0.07, 0.62, 0x23262c, 0, 0.2, 0.0, 0, 0, 0); for (const s of [-1, 1]) { h.cyl(0.1, 0.06, 0x23262c, s * 0.14, 0.22, -0.32, 'z'); h.cyl(0.075, 0.02, 0xff9a1a, s * 0.14, 0.22, -0.35, 'z', 0.075, 10, true); } }
  const gl = O.glasses;
  if (gl === 'shades') { h.box(0.4, 0.075, 0.05, 0x14161b, 0, 0.05, -0.31); h.box(0.5, 0.03, 0.05, 0x14161b, 0, 0.07, -0.0); }
  else if (gl === 'visor') { h.box(0.46, 0.09, 0.06, 0x1d2530, 0, 0.05, -0.3); h.box(0.42, 0.05, 0.02, 0x35e0ff, 0, 0.05, -0.335, 0, 0, 0, true); }
  else if (gl === 'round') for (const s of [-1, 1]) { h.cyl(0.09, 0.025, 0x14161b, s * 0.125, 0.03, -0.33, 'z'); h.cyl(0.07, 0.01, 0x9fe0ff, s * 0.125, 0.03, -0.345, 'z'); }
  // ---- limbs (absolute m-space; split per side) ----
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? -1 : 1, X = s * 0.46;
    const ua = S.uarm[i], fa = S.farm[i]; const sleeve = top, cuff = top2;
    ua.box(0.23, 0.4, 0.23, sleeve, X, 1.22, 0); ua.sph(0.14, sleeve, X, 1.4, 0, 1, 0.9, 1.0, 8); ua.box(0.24, 0.05, 0.24, cuff, X, 1.04, 0);
    fa.box(0.2, 0.3, 0.2, O.shorts || O.sleeveless ? skinC : sleeve, X, 0.88, 0); fa.box(0.215, 0.06, 0.215, cuff, X, 0.74, 0); fa.sph(0.115, glove, X, 0.64, 0, 1, 1, 1, 8); fa.box(0.05, 0.08, 0.06, glove, X + s * -0.09, 0.66, -0.06, 0, 0, 0);
    const th = S.thigh[i], sh = S.shin[i], LX = s * 0.17;
    th.box(0.29, 0.44, 0.32, pants, LX, 0.6, 0); th.sph(0.16, pants, LX, 0.82, 0, 1, 0.8, 1, 8);
    sh.box(0.26, 0.28, 0.29, O.shorts ? skinC : pants, LX, 0.24, 0); sh.box(0.3, 0.05, 0.33, O.shorts ? top2 : trim, LX, 0.12, 0);
    sh.box(0.31, 0.12, 0.34, boots, LX, 0.06, 0.0); sh.box(0.3, 0.1, 0.18, boots, LX, 0.05, -0.2); sh.box(0.32, 0.03, 0.46, 0x1b1d22, LX, 0.0, -0.06);
  }
  SEGCACHE[key] = { S, O, geos: null }; return SEGCACHE[key];
}
G._segGeos = function (skin) { return segGeos(skin || {}); };
const PIV = { head: [0, 1.76, 0], sh: [0.46, 1.4, 0], el: 0.4 - 0.0, hip: [0.17, 0.84, 0], knee: 0.42 };
function segGeos(skin) {
  const E = buildSegments(skin); if (E.geos) return E;
  if (G.Assets && G.Assets.charGeos) { const ag = G.Assets.charGeos(skin, E.O); if (ag) { E.geos = ag; return E; } } // glTF model (assets/models/char_*.glb) replaces the procedural parts
  const S = E.S, GG = {}; const mk = (b, px, py, pz) => { const g = b.geometry(b.lit, true); g.translate(-px, -py, -pz); return g; };
  GG.torso = mk(S.torso, 0, 0, 0); GG.head = mk(S.head, 0, 0, 0); GG.head.translate(0, 0, 0);
  GG.uarm = []; GG.farm = []; GG.thigh = []; GG.shin = [];
  for (let i = 0; i < 2; i++) { const s = i === 0 ? -1 : 1; const sx = s * 0.46, sy = 1.4, ey = 1.0, hx = s * 0.17, hy = 0.84, ky = 0.42;
    GG.uarm.push(mk(S.uarm[i], sx, sy, 0)); GG.farm.push(mk(S.farm[i], sx, ey, 0)); GG.thigh.push(mk(S.thigh[i], hx, hy, 0)); GG.shin.push(mk(S.shin[i], hx, ky, 0)); }
  // low-LOD static silhouette: everything merged in the neutral pose (head built about its own pivot -> shift back up)
  const all = []; const addAll = (b, dy) => { for (const p of b.lit) all.push(Object.assign({}, p, { y: p.y + (dy || 0) })); };
  addAll(S.torso); addAll(S.head, 1.76); S.uarm.forEach(b => addAll(b)); S.farm.forEach(b => addAll(b)); S.thigh.forEach(b => addAll(b)); S.shin.forEach(b => addAll(b));
  GG.low = G.mergeParts(all, false); E.geos = GG; return E;
}
/* head parts were authored around the head pivot: bake the pivot offset only for the low LOD merge (done above); torso etc. are absolute. */
const HOLD = { pistol: { z: -0.12, s: 1.25, mz: -0.36 }, dual: { z: -0.12, s: 1.3, mz: -0.36 }, shotgun: { z: -0.2, s: 1.05, mz: -0.98 }, ar: { z: -0.2, s: 1.0, mz: -1.2 }, smg: { z: -0.12, s: 1.1, mz: -0.72 }, sniper: { z: -0.05, s: 0.82, mz: -1.56 }, rocket: { z: 0.12, s: 0.85, mz: -1.28, f: 2 } };
G.makeCharacter = function (skin) {
  const E = segGeos(skin), GG = E.geos, O = E.O; const mat = G.vcMat, om = G.outlineMat;
  const root = new T.Group(), lean = new T.Group(), m = new T.Group(); lean.position.y = 1; m.position.y = -1; root.add(lean); lean.add(m);
  const hi = new T.Group(); m.add(hi); const outlines = [];
  const seg = (geo, parent, px, py, pz) => { const g = new T.Group(); g.position.set(px, py, pz); parent.add(g); const me = new T.Mesh(geo, mat); me.castShadow = true; g.add(me); const ol = new T.Mesh(geo, om); ol.renderOrder = -1; g.add(ol); outlines.push(ol); return g; };
  seg(GG.torso, hi, 0, 0, 0);
  const head = seg(GG.head, hi, 0, 1.76, 0); head.scale.setScalar(1.12); const legs = [], knees = [], arms = [], elbows = [];
  for (let i = 0; i < 2; i++) { const s = i === 0 ? -1 : 1;
    const hip = seg(GG.thigh[i], hi, s * 0.17, 0.84, 0); const knee = seg(GG.shin[i], hip, 0, -0.42, 0); legs.push(hip); knees.push(knee);
    const sh = seg(GG.uarm[i], hi, s * 0.46, 1.4, 0); const el = seg(GG.farm[i], sh, 0, -0.4, 0); arms.push(sh); elbows.push(el); }
  const low = new T.Mesh(GG.low, mat); low.castShadow = false; low.visible = false; m.add(low);
  const gun = new T.Group(); gun.position.set(0.12, 1.3, -0.3); m.add(gun);
  const pick = G.pickaxeModel(skin.pick); pick.position.set(0, -0.62, 0); pick.rotation.x = Math.PI / 2; arms[1].add(pick); elbows[1].add(pick); pick.position.set(0, -0.3, 0); pick.visible = false;
  // muzzle flash: crossed additive quads + core
  const flash = new T.Group(); const fm = new T.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.95, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
  for (let k = 0; k < 3; k++) { const q = new T.Mesh(G.flashGeo || (G.flashGeo = new T.PlaneGeometry(0.5, 0.5)), fm); q.rotation.z = k * Math.PI / 3; flash.add(q); } const core = new T.Mesh(new T.SphereGeometry(0.09, 6, 5), new T.MeshBasicMaterial({ color: 0xffffff, fog: false })); flash.add(core); flash.visible = false; gun.add(flash);
  const glider = G.makeGlider(skin.shirt !== undefined ? skin.shirt : (O.packT === 'cape' || O.top === 0xeaf4ff || O.top === 0xf4f4f4 ? O.top2 : O.top)); glider.visible = false; root.add(glider);
  const o = { root, lean, m, legs, knees, arms, elbows, head, gun, pick, flash, glider, held: null, heldKey: '', hi, low, outlines, lod: 0, outfit: O };
  o.setLOD = function (lv) { // 0 near+outline, 1 near, 2 far silhouette, 3 hidden
    if (lv === o.lod) return; o.lod = lv; root.visible = lv < 3 ? o.wantVisible !== false : false; hi.visible = lv < 2; low.visible = lv === 2; for (const x of outlines) x.visible = lv === 0; gun.visible = lv < 2 || true;
  };
  o.setHeld = function (kind, w, rar) {
    const key = kind + (w || '') + (rar === undefined ? '' : rar); if (key === o.heldKey) return; o.heldKey = key;
    if (o.held) { gun.remove(o.held); o.held = null; } pick.visible = kind === 'pickaxe'; flash.position.set(0, 0, -1.2);
    if (kind === 'weapon') { const H = HOLD[w] || HOLD.ar, wm = G.weaponModel(w, G.RARITY[rar].hex); wm.position.set(0, -0.02, H.z); wm.scale.multiplyScalar(H.s); gun.add(wm); o.held = wm; flash.position.set(0, 0.04, H.z + H.mz * 1.15 * H.s); flash.scale.setScalar(H.f || 1); }
    else if (kind === 'gadget') { const wm = G.gadgetModel(w); wm.position.set(0, -0.1, -0.25); wm.scale.setScalar(1.4); gun.add(wm); o.held = wm; }
    o.hasGun = kind === 'weapon';
  };
  o.setLOD(0); return o;
};

/* ================= umbrella glider ================= */
const GLCACHE = {};
G.makeGlider = function (col) {
  col = col === undefined ? 0xff5a5a : col; if (GLCACHE[col]) return GLCACHE[col].clone();
  const g = new T.Group(), N = 8, R = 2.5; const c1 = new T.Color(col), c2 = new T.Color(0xffffff), c3 = new T.Color(col).multiplyScalar(0.6);
  const geo = new T.SphereGeometry(R, 32, 9, 0, Math.PI * 2, 0, Math.PI * 0.46); const p = geo.attributes.position, cols = [];
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x), ph = ((a + Math.PI) / (Math.PI * 2) * N); const gore = Math.floor(ph), fr = ph - gore; const rim = 1 - y / R; // 0 at top
    const scallop = Math.pow(Math.abs(fr - 0.5) * 2, 2.2); const k = 1 - 0.07 * scallop * Math.min(1, rim * 3);
    x *= k; z *= k; y = y * 0.5 - 0.0 - 0.14 * scallop * Math.min(1, rim * 2); p.setXYZ(i, x, y, z);
    const c = (gore % 2 === 0) ? c1 : c2; const shade = 0.88 + 0.12 * Math.sin(fr * Math.PI); cols.push(c.r * shade, c.g * shade, c.b * shade);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const cm = new T.Mesh(geo, G.vcMatDS); cm.position.y = 3.15; cm.castShadow = true; g.add(cm);
  const b = new Bd(); b.cyl(0.035, 1.2, 0xdfe3ea, 0, 3.55 - 0.9, 0); b.cyl(0.06, 0.06, 0x8a929e, 0, 3.55 + 0.05, 0); b.sph(0.07, GOLD, 0, 3.15 + R * 0.5 + 0.02, 0);
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; b.box(0.018, 0.018, R * 0.95, 0xe9edf3, Math.cos(a) * R * 0.46, 3.15 + R * 0.26, Math.sin(a) * R * 0.46, 0, -a + Math.PI / 2, 0.0); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; b.box(0.012, 1.3, 0.012, 0xcfd5de, Math.cos(a) * R * 0.5, 2.7, Math.sin(a) * R * 0.5, Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); }
  b.cyl(0.04, 0.5, 0x8a5a33, 0, 2.2, 0, 'x'); b.cyl(0.03, 0.42, 0x8a5a33, 0, 2.38, 0);
  const pm = G.bakeBuilder(b, { outline: false }); g.add(pm); GLCACHE[col] = g; return g.clone();
};

/* ================= battle bus: blue bus slung under a hot-air balloon ================= */
G.makeBus = function () {
  const g = new T.Group(); const blue = 0x2f78f0, blueD = 0x1d4fb0, gold = 0xffc83a, white = 0xf6f9ff, glass = 0x9fe4ff, dark = 0x1d2430;
  const b = new Bd();
  b.box(3.4, 1.9, 8.6, blue, 0, 0.1, 0.4); b.box(3.2, 0.2, 8.4, white, 0, 1.12, 0.4); b.box(3.5, 0.5, 8.7, blueD, 0, -0.55, 0.4); b.box(3.42, 0.28, 8.62, gold, 0, -0.12, 0.4);
  b.box(3.0, 1.4, 2.2, blue, 0, -0.1, -5.0); b.box(2.6, 0.6, 0.14, dark, 0, 0.35, -6.12); b.box(3.1, 0.34, 0.3, gold, 0, -0.5, -6.2); for (const s of [-1, 1]) b.box(0.55, 0.3, 0.15, 0xfff3a0, s * 1.0, -0.1, -6.15, 0, 0, 0, true);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { b.box(0.06, 0.8, 1.4, glass, s * 1.72, 0.42, -2.4 + i * 2.1, 0, 0, 0, true); b.box(0.08, 0.06, 1.5, white, s * 1.73, 0.86, -2.4 + i * 2.1); }
  b.box(2.8, 0.8, 0.06, glass, 0, 0.46, -3.9, 0, 0, 0, true); for (const s of [-1, 1]) b.box(0.1, 1.8, 0.1, white, s * 1.6, 0.2, 4.8);
  b.box(3.0, 0.12, 2.2, gold, 0, 1.28, -5.0); b.box(0.8, 0.3, 0.6, white, 0, 1.45, 1.0);
  // wheels
  for (const s of [-1, 1]) for (const z of [-3.4, 2.6]) { b.cyl(0.8, 0.5, 0x22252c, s * 1.7, -1.1, z, 'x', 0.8, 14); b.cyl(0.42, 0.52, gold, s * 1.7, -1.1, z, 'x', 0.42, 10); b.cyl(0.18, 0.54, white, s * 1.7, -1.1, z, 'x', 0.18, 8); }
  // rear deck for the balloon rig + burner
  b.box(0.22, 2.2, 0.22, gold, -1.4, 1.3, 4.3); b.box(0.22, 2.2, 0.22, gold, 1.4, 1.3, 4.3); b.box(3.0, 0.2, 0.24, gold, 0, 2.4, 4.3); b.cyl(0.35, 0.5, 0x8a929e, 0, 2.7, 4.3, 'y', 0.25, 8); b.cone(0.22, 0.6, 0xff7a1a, 0, 3.2, 4.3, 0, 0, 0, 8, true);
  const body = G.bakeBuilder(b, { outline: false }); g.add(body);
  const prop = new G.Obj3(); const pb = new Bd(); pb.box(0.16, 2.3, 0.2, 0x333844, 0, 0, 0); pb.box(2.3, 0.16, 0.2, 0x333844, 0, 0, 0); pb.cyl(0.2, 0.3, gold, 0, 0, -0.1, 'z', 0.2, 8); prop.add(G.bakeBuilder(pb, { outline: false })); prop.position.set(0, 0.2, 5.6); g.add(prop); g.userData.prop = prop;
  // balloon: 12 coloured gores with a scalloped lower skirt
  const N = 12, R = 7.4; const bg = new T.SphereGeometry(R, 36, 20); const p = bg.attributes.position, cols = []; const pal = [new T.Color(0xff5a5a), new T.Color(0xffd83a), new T.Color(0x3fa0ff), new T.Color(0xffffff)];
  for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x), ph = (a + Math.PI) / (Math.PI * 2) * N, gore = Math.floor(ph), fr = ph - gore; const v = y / R;
    const sc = 1 - 0.035 * Math.pow(Math.abs(fr - 0.5) * 2, 2) * (v < 0.4 ? 1 : 0.4); x *= sc; z *= sc; if (v < -0.55) { const k = 1 - (-0.55 - v) * 0.9; x *= Math.max(0.3, k); z *= Math.max(0.3, k); }
    p.setXYZ(i, x, y * 1.18, z); let c = pal[gore % 3]; if (v > 0.82) c = pal[3]; if (Math.abs(v - 0.05) < 0.05) c = pal[3]; const sh = 0.86 + 0.14 * Math.sin(fr * Math.PI); cols.push(c.r * sh, c.g * sh, c.b * sh); }
  bg.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); bg.computeVertexNormals(); const bl = new T.Mesh(bg, G.vcMat); bl.position.set(0, 14.4, 0.6); bl.castShadow = true; g.add(bl);
  const rb = new Bd(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, ax = Math.cos(a) * 1.3, az = Math.sin(a) * 1.3 + 0.6; const bx0 = Math.cos(a) * 3.8, bz0 = Math.sin(a) * 3.8 + 0.6; const len = Math.hypot(bx0 - ax, 7.2 - 1.4, bz0 - az);
    rb.box(0.06, len, 0.06, 0xf1ead6, (ax + bx0) / 2, (1.4 + 8.6) / 2, (az + bz0) / 2, Math.atan2(bz0 - az, 7.2) * -1, 0, Math.atan2(bx0 - ax, 7.2) * -1); }
  rb.cyl(1.4, 0.2, gold, 0, 1.4, 0.6, 'y', 1.4, 12); g.add(G.bakeBuilder(rb, { outline: false }));
  g.scale.setScalar(1.25); return g;
};
})();
