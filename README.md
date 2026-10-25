# Stormfall Royale 3D
Original low-poly 3D battle royale (Three.js r152 bundled locally, no CDN, no build step, all art is procedural: boxes, cylinders and canvas textures generated in code).

Play: https://zylosstrikes.github.io/fortnite-style-br/
Model gallery: https://zylosstrikes.github.io/fortnite-style-br/gallery.html

Run locally: `python3 -m http.server 8000` then open http://localhost:8000
(opening index.html directly also works in most browsers). Press **H** in game for the full controls.

## What's in the game
- 35-actor match: bus drop, glider, building, storm, bots with sense/aim/loot AI, Victory screen.
- **Healing:** Bandage, Medkit (red case, white cross), Small Shield Potion, Shield Potion, Slurp Bottle, **Chug Jug** (full health + shield, long use time).
- **Weapons:** Peacemaker Pistol, Twin Gold-Grip Pistols (dual wield), Double-Barrel Shotgun, Dune Scar Rifle, Micro SMG, Longshot Sniper, Orange Boom Cannon (rockets). Rarity tiers colour the beams, hotbar and names.
- **Chests:** wooden gold-trim chests (common to epic loot) and blue metal chests (epic to legendary loot). Rarity shown by beam colour and gem; the prompt names the rarity.
- **Bushes:** press E (or just walk in) to hide. Bushes go translucent for you; bots lose sight of hidden targets beyond a few metres unless you fire.
- **Supply Llama:** a balloon pinata drops from the sky into the safe zone roughly every minute with a big loot pile (marked on the map).
- **Dynamite (TNT):** throwable, bounces, 2.6 s fuse, area damage. Bots throw it too.
- **Traps:** Launch Pad (bounces you up and forward, auto-opens the glider) and Spike Trap (damages whoever steps on it). Both are lootable items you place.
- **Armored Supply Trucks:** parked beside roads, rear doors open for loot.
- **Rifts:** glowing crystal clusters that launch you skyward so you can glide (8 s cooldown).
- **Campfires:** heal anyone nearby; a small ember mascot sits beside each.
- **Victory Crown:** floats above the last player alive and is shown on the Victory screen.
- **Pickaxe cosmetics (lobby):** Classic Pickaxe, Battle Axe, Digger Shovel, Reaper Sickle, Smash Hammer. Stored in localStorage.
- **XP and levels:** after each match you earn XP (survival time, eliminations, placement, win bonus), see a progress bar and a level-up badge. Stored in localStorage (`sf_xp`, `sf_pick`). XP is not a currency; the game has no currency or purchases.

## Code layout
- `js/data.js` weapons, heals, gadgets, pickaxes, XP helpers
- `js/models.js`, `js/models2.js` procedural models and icon renderer
- `js/world.js` terrain, buildings, chests, loot; `js/features.js` bushes, trucks, llama, traps, rifts, campfires, crown, XP
- `js/actors.js`, `js/bots.js`, `js/ui.js`, `js/main.js`, `js/util.js`
- `gallery.html` turntable-free gallery of every model (add `?static` for a still render)

All art is original; nothing is copied from any other game's assets.
