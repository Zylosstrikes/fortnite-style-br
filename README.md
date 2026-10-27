# Stormfall Royale 3D
Original low-poly 3D battle royale (Three.js r152 bundled locally, no CDN, no build step, all art is procedural: boxes, cylinders and canvas textures generated in code).

Play: https://zylosstrikes.github.io/fortnite-style-br/
Model gallery: https://zylosstrikes.github.io/fortnite-style-br/gallery.html

Run locally: `python3 -m http.server 8000` then open http://localhost:8000
(opening index.html directly also works in most browsers). Press **H** in game for the full controls.

## What's in the game
- 35-actor match: bus drop, glider, building, storm, bots with sense/aim/loot AI, Victory screen.
- **Healing:** Bandage, Medkit (red case, white cross), Small Shield Potion, Shield Potion, Slurp Bottle, **Chug Jug** (full health + shield, long use time).
- **Weapons:** Peacemaker Pistol, Twin Gold-Grip Pistols (dual wield), Pump Shotgun, Dune Scar Rifle, Micro SMG, Longshot Sniper, Orange Boom Cannon (rockets). Rarity tiers colour the beams, hotbar and names.
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

## v2 art & performance pass
- **Characters:** original stylised HUMANS (realistic-ish proportions, smooth subdivided skin) modelled in Blender (`blender/human.py`) and exported as rigged-segment glTF (`char_<outfit>.glb`, ~6–8k tris each in the near mesh plus a ~1.5k-tri `lod_low` mesh, after `blender/optimize_chars.sh` (gltfpack ratio 0.4)). 14 outfits: **Default** (plain tee, jeans, sneakers, short hair — the skin every new player starts with), **Street Hoodie** (zip hoodie with side stripes, ribbed cuffs, dog-tag chain, cargo pants, chunky sneakers — original, no logos/text) and 12 more (masks, helmets, backpacks, hair variants). Bots reuse the same rig with recoloured outfit/hair. **Animation (v3):** 51 clips defined once in `blender/anims.py` (pure python): locomotion (idle, walk, run, sprint, back, strafe L/R, jump, fall, land, freefall, dive, glide), weapons (aim + shoot per weapon type pistol / rifle / shotgun-pump / sniper-bolt / rocket, reload, shotgun reload, equip), tools & actions (pickaxe idle + swing, build idle + place, heal drink / apply, chest open, drive, bush hide, throw, hit, death, victory) and **12 emotes** (dance, wave, flex, spin, clap, cheer, salute, bow, shrug, robot, jacks, boxing). `blender/rig_anim.py` keys them onto the game's armature in Blender (`/workspace/bv/bin/python blender/build_all.py -- <dir> anims` -> `assets/models/rigged/anims.glb`) and `python3 blender/anims.py` writes the same clips as keyframes to `js/animdata.js` (fallback). `js/anim.js` (replaces `clips.js`) bakes the .glb through an AnimationMixer into two layers (lower body / upper body) with crossfades, drives the player, bots and lobby character from the game state (speed bands, strafe/back from velocity, air, landing, aim, reload scrubbed by reload progress, pickaxe swing scrubbed by `a.swing`, one-shot overlays for shooting/hit/throw/chest/equip/build) and adds a 2-bone IK so the left hand grips the weapon's fore-grip. The equipped weapon / pickaxe is parented to the **right-hand (forearm) bone** (`hand` holder in `models3.js`, grip points in `G.GRIP`), so it follows every animation. Fallbacks: `?animdata` / `?noclips` (keyframe data in plain JS), `?legacyanim` (original procedural code). `?anim=NAME` loops any clip on the player, bots and the lobby character. Locker -> EMOTES previews every emote; in a match press **B** for the emote menu (T / Y / U / I quick emotes). Controls: **LEFT CLICK = fire**, **E = interact** (chests, loot, vehicles, bushes) - shown in the on-screen control pill.
If a .glb fails to load the old procedural characters are used.
- **World props:** `blender/props2.py` builds stylised rocks, bushes, a timber cottage, stone walls and fences (`assets/models/scenery.glb`, instanced, with AABB collision for the decor) and the lobby manor (`manor.glb`). The game's enterable buildings remain procedural.
- **Lobby:** original snowy-forest scene (instanced pines, candy-cane lamp posts, a spooky manor in the fog, drifting snow, glowing platform) with top tabs **PLAY / LOCKER / QUESTS / CAREER**, party-slot '+' circles, a BATTLE ROYALE mode card with the yellow PLAY button, level badge and EMOTE / BACK / CHAT buttons. Drag to rotate the character; EMOTE cycles dance / wave / flex / spin. **LOCKER** holds outfits (Default first), pickaxes, glider/outfit tint and skin tone (saved in localStorage). All art is original and generated from primitives — no V-Bucks or store UI.
- **Gear:** umbrella glider (coloured to your outfit), blue Battle Bus slung under a striped hot-air balloon, pump shotgun / tactical SMG / modern AR / scoped sniper / shoulder rocket launcher / pistols, five pickaxes. All rarity-tinted.
- **World:** toon (stepped) shading with a rim light and inverted-hull outlines, gradient sky with sun glow, fluffy merged clouds, animated depth-tinted water with shore foam, layered pines / blobby oaks / faceted rocks, brick-wood-metal building textures.
- **FX / audio:** star-shaped muzzle flash, tracers, hit sparks, explosions with shockwave ring, fireball, embers and smoke; surface-aware footsteps (grass / sand / building), wind and birdsong ambience.
- **Performance:** terrain split into frustum-culled chunks, chunked + culled instanced trees, merged cloud meshes, character LOD (articulated + outline -> articulated -> single merged mesh -> hidden), adaptive quality manager (pixel ratio, shadows, fog and cull distance; auto-adjusts to the frame time on phones). URL options: `?q=0|1|2` fixes the quality level, `?noadapt` disables auto-adjust.

## HUD & touch controls (v3 layout)
- **Desktop:** minimap top-left, storm timer top-centre, alive/elims + kill feed top-right, shield/health + hotbar bottom-centre with a one-line key-hint strip, materials bottom-left, ammo bottom-right. Touch controls are hidden.
- **Touch (auto-detected, or add `?touch`):** left joystick (push to the edge to sprint) + drag anywhere on the right to look. Right-hand action cluster: big FIRE (drag the finger to aim while firing), AIM (toggle), JUMP, SPRINT (toggle), RELOAD, BUILD, EMOTE. One BUILD button opens a grouped build panel (wall / floor / ramp / roof, material cycle, edit) above the stick. EMOTE opens a 4-way wheel. USE (chest / loot / vehicle / bush), DROP (bus) and GLIDE (free-fall) only appear when relevant. Top-right menu cluster: map, pause, sound, help; tapping the minimap opens the map.
- Layout scales with screen size, respects safe-area insets (`viewport-fit=cover`), works in portrait and landscape, and blocks page scroll / pinch-zoom / text selection while playing.
- **Camera / look (all inputs):** touch — drag any free part of the screen (works together with the joystick and with FIRE held); desktop — mouse look via pointer lock, automatic click-and-drag fallback if the browser denies/does not support pointer lock (quick click = one shot, hold still = fire, move while pressed = turn; Esc pauses); arrow keys always look. Look sensitivity, look up/down limit and invert-Y are in the lobby and the pause menu and are saved in localStorage (`sf_look`). Drag the lobby island view to orbit it. The full map pans by drag and zooms by pinch / wheel / buttons.

## Code layout
- `js/data.js` weapons, heals, gadgets, pickaxes, XP helpers
- `js/gfx.js` toon/rim shading, geometry builder + merger, outline material, quality manager
- `js/models.js`, `js/models2.js` procedural models and icon renderer; `js/models3.js` characters / outfits, glider, bus, weapons, pickaxes
- `js/world.js` terrain, buildings, chests, loot; `js/features.js` bushes, trucks, llama, traps, rifts, campfires, crown, XP
- `js/actors.js`, `js/bots.js`, `js/ui.js`, `js/main.js`, `js/util.js`
- `gallery.html` turntable-free gallery of every model (add `?static` for a still render)

All art is original; nothing is copied from any other game's assets.


## Round 3 — Blender models + performance
* **Models are now real glTF files built in Blender** (`blender/` scripts → `assets/models/*.glb`, ~2.3 MB total, 20 files): 12 outfit characters, 7 weapons + 5 pickaxes, umbrella glider, battle bus with a gored hot-air balloon, wood/metal chests, healing pickups, supply llama and trees. Bevelled edges + smooth shading come from Blender; the game bakes them to a few draw calls and recolours role materials (outfit colours, rarity glow, glider tint).
* **Automatic fallback**: `js/assets.js` wraps every model factory — if a `.glb` is missing or fails, the original procedural model is used (`?noassets` forces it). Drop in your own Blender models: see `assets/models/README.md`.
* **Performance**: chunked terrain, culled instanced tree chunks, merged clouds, merged character rigs with LOD, adaptive quality manager (pixel ratio / shadows / draw distance), distant shadow casters off.
* Rebuild the models: `python3 blender/tools/dump_specs.py` (needs the game running locally) then `blender -b --python blender/build_all.py -- assets/models`.
