'use strict';
(function () {
const G = window.G;
G.RARITY = [
  { name: 'Common', color: '#b8bec6', hex: 0xb8bec6, mult: 1.0, w: 50 },
  { name: 'Uncommon', color: '#4cd84c', hex: 0x4cd84c, mult: 1.05, w: 28 },
  { name: 'Rare', color: '#3fa0ff', hex: 0x3fa0ff, mult: 1.10, w: 14 },
  { name: 'Epic', color: '#b45cff', hex: 0xb45cff, mult: 1.15, w: 6 },
  { name: 'Legendary', color: '#ffb627', hex: 0xffb627, mult: 1.20, w: 2 },
];
G.CHEST_RARITY_W = [8, 30, 36, 20, 6];
G.WEAPONS = {
  pistol:  { name: 'Peacemaker Pistol', short: 'Pistol', ammo: 'light', dmg: 24, rate: 6.5, mag: 16, reload: 1.6, spread: 0.010, range: 120, pellets: 1, auto: false, hs: 2.0, w: 13, bots: 20 },
  dual:    { name: 'Twin Gold-Grip Pistols', short: 'Duals', ammo: 'light', dmg: 20, rate: 9, mag: 24, reload: 2.1, spread: 0.018, range: 100, pellets: 1, auto: false, hs: 1.9, w: 8, bots: 21 },
  shotgun: { name: 'Pump Shotgun', short: 'Pump', ammo: 'shells', dmg: 13, rate: 1.0, mag: 5, reload: 3.0, spread: 0.07, range: 45, pellets: 10, auto: false, hs: 1.6, w: 15, bots: 11 },
  ar:      { name: 'Dune Scar Rifle', short: 'SCAR', ammo: 'medium', dmg: 30, rate: 5.5, mag: 30, reload: 2.3, spread: 0.014, range: 170, pellets: 1, auto: true, hs: 1.6, w: 18, bots: 28 },
  smg:     { name: 'Micro SMG', short: 'Micro', ammo: 'light', dmg: 16, rate: 12, mag: 30, reload: 1.9, spread: 0.030, range: 95, pellets: 1, auto: true, hs: 1.5, w: 16, bots: 20 },
  sniper:  { name: 'Longshot Sniper', short: 'Sniper', ammo: 'heavy', dmg: 95, rate: 0.6, mag: 1, reload: 2.6, spread: 0.0012, range: 420, pellets: 1, auto: false, hs: 2.4, zoom: 18, w: 8, bots: 8 },
  rocket:  { name: 'Orange Boom Cannon', short: 'Cannon', ammo: 'rockets', dmg: 100, rate: 0.4, mag: 1, reload: 3.2, spread: 0.004, range: 300, pellets: 1, auto: false, hs: 1, rocket: true, w: 4, bots: 3 },
};
G.AMMO = {
  light: { name: 'Light Bullets', color: '#ffa43a', hex: 0xffa43a, pick: 24, max: 220 },
  medium: { name: 'Medium Bullets', color: '#6fdc5a', hex: 0x6fdc5a, pick: 30, max: 220 },
  shells: { name: 'Shells', color: '#ff5a5a', hex: 0xff5a5a, pick: 8, max: 60 },
  heavy: { name: 'Heavy Bullets', color: '#4a9bff', hex: 0x4a9bff, pick: 6, max: 40 },
  rockets: { name: 'Rockets', color: '#c05cff', hex: 0xc05cff, pick: 3, max: 14 },
};
G.HEALS = {
  bandage:   { name: 'Bandages', hp: 15, cap: 75, sh: 0, time: 3.5, stack: 15, color: '#f4f4f4', hex: 0xf4f4f4, w: 28, n: [2, 5] },
  medkit:    { name: 'Med Kit', hp: 100, cap: 100, sh: 0, time: 8, stack: 3, color: '#ff4d4d', hex: 0xff4d4d, w: 10, n: [1, 1] },
  minishield:{ name: 'Small Shield Potion', hp: 0, cap: 100, sh: 25, shcap: 50, time: 2.5, stack: 6, color: '#6ec6ff', hex: 0x6ec6ff, w: 20, n: [1, 2] },
  shield:    { name: 'Shield Potion', hp: 0, sh: 50, shcap: 100, time: 5, stack: 3, color: '#2f7bff', hex: 0x2f7bff, w: 9, n: [1, 1] },
  slurp:     { name: 'Slurp Bottle', hp: 25, cap: 100, sh: 25, shcap: 100, time: 3.2, stack: 2, color: '#38e8ff', hex: 0x38e8ff, w: 6, n: [1, 1] },
  chug:      { name: 'Chug Jug', hp: 100, cap: 100, sh: 100, shcap: 100, time: 12, stack: 1, color: '#3dffb4', hex: 0x3dffb4, w: 3, n: [1, 1] },
};
G.GADGETS = {
  tnt:       { name: 'Dynamite Bundle', short: 'TNT', color: '#ff4a3a', hex: 0xff4a3a, w: 7, n: [1, 3], stack: 6, fuse: 2.6, dmg: 120, radius: 7 },
  launchpad: { name: 'Launch Pad Trap', short: 'Launch Pad', color: '#ffd23a', hex: 0xffd23a, w: 6, n: [1, 2], stack: 3 },
  spike:     { name: 'Spike Floor Trap', short: 'Spike Trap', color: '#c8ccd6', hex: 0xc8ccd6, w: 5, n: [1, 2], stack: 3, dmg: 45 },
};
G.PICKAXES = [
  { id: 'pick', name: 'Classic Pickaxe' }, { id: 'axe', name: 'Battle Axe' }, { id: 'shovel', name: 'Digger Shovel' },
  { id: 'sickle', name: 'Reaper Sickle' }, { id: 'hammer', name: 'Smash Hammer' },
];
// XP / level (persisted in localStorage, no currency of any kind)
G.xpToNext = lvl => 120 + (lvl - 1) * 60;
G.levelFromXp = function (xp) { let l = 1; while (xp >= G.xpToNext(l)) { xp -= G.xpToNext(l); l++; } return { level: l, into: xp, need: G.xpToNext(l) }; };
G.loadXp = function () { try { return Math.max(0, parseInt(localStorage.getItem('sf_xp') || '0', 10) || 0); } catch (e) { return 0; } };
G.saveXp = function (x) { try { localStorage.setItem('sf_xp', String(x)); } catch (e) { } };
G.MATS = {
  wood:  { name: 'Wood', hp: 150, color: 0xc98b4c, css: '#d99a55', cost: 10 },
  stone: { name: 'Stone', hp: 280, color: 0xa4acb6, css: '#a9b2bd', cost: 10 },
  metal: { name: 'Metal', hp: 450, color: 0x7fb6e0, css: '#7fc0f0', cost: 10 },
};
G.MAPSZ = 1000; G.HALF = 500;
G.MT = { x: -300, z: -250, r: 200, h: 95 };
G.LK = { x: -245, z: 185, r: 100 };
G.WATER_Y = -0.3;
G.POIS = [
  { id: 'tumble', name: 'Tumble Town', x: 15, z: 5, r: 72, style: 'town', n: 15, tower: 'clock' },
  { id: 'maple', name: 'Maple Meadows', x: 215, z: -175, r: 62, style: 'suburb', n: 11 },
  { id: 'depot', name: 'Dusty Depot', x: 235, z: 225, r: 70, style: 'industrial', n: 9, tower: 'water' },
  { id: 'lagoon', name: 'Lagoon Landing', x: -105, z: 175, r: 42, style: 'houses', n: 7, dock: true },
  { id: 'lodge', name: 'Frostpeak Lodge', x: -205, z: -125, r: 44, style: 'cabin', n: 6, snow: true, keep: true },
  { id: 'woods', name: 'Whisper Woods', x: -35, z: -300, r: 58, style: 'cabin', n: 7, forest: true },
  { id: 'hollow', name: 'Pine Hollow', x: 360, z: 30, r: 48, style: 'cabin', n: 6, forest: true },
];
G.REGIONS = [ // extra labels on the map
  { name: 'Mt. Frostpeak', x: -320, z: -275 }, { name: 'Lazy Lagoon', x: -255, z: 200 },
];
G.STORM = [
  { wait: 80, shrink: 55, r: 330, dmg: 1 }, { wait: 40, shrink: 45, r: 210, dmg: 2 }, { wait: 30, shrink: 35, r: 125, dmg: 3 },
  { wait: 25, shrink: 30, r: 62, dmg: 5 }, { wait: 20, shrink: 25, r: 26, dmg: 8 }, { wait: 12, shrink: 25, r: 0, dmg: 10 },
];
G.BOT_NAMES = ['PixelPanda', 'NeonNomad', 'CosmoCat', 'TacoTitan', 'BlipBlop', 'ZigZag', 'MangoMage', 'Rustle', 'FrostByte', 'Gizmo', 'WobbleKnight', 'SunnyDay',
  'Quasar', 'Turbo', 'Mochi', 'Zephyr', 'Bumble', 'Kiwi', 'Noodle', 'Jolt', 'Pogo', 'Ravenous', 'Sprocket', 'Clover', 'Glitch', 'Waffles', 'Orbit', 'Dash', 'Cobalt',
  'Pepper', 'Ember', 'Yeti', 'Ripple', 'Biscuit', 'Vortex'];
G.SKIN_COLORS = [0xff5a5a, 0xff9f2e, 0xffd83a, 0x5ad65a, 0x2ec4b6, 0x3fa0ff, 0x8a6bff, 0xff6bd0, 0xf4f4f4, 0x2b2f3a];
G.FH = 3.2; G.BS = 4;
})();
