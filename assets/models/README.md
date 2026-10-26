# assets/models — Blender-made glTF models

Every `.glb` here is generated headless by Blender (tested with 5.2 LTS) from the scripts in `blender/`:

```
blender -b --python blender/build_all.py -- <output_dir> [weapons characters glider bus chests heals llama trees]
```

* `blender/common.py` – Builder (primitive → bevelled/smooth Blender meshes, role materials, glTF export)
* `blender/spec_models.py` – weapons, pickaxes, 12 outfit characters, umbrella glider, battle bus + gored balloon (from `blender/specs/*.json`, recorded from the game's builders by `blender/tools/dump_specs.py`)
* `blender/props.py` – hand-written chests, healing pickups, llama, trees

`js/assets.js` loads them with `lib/GLTFLoader.js`, bakes each node into one merged vertex-coloured mesh (+ one glow mesh) so draw calls stay
low, and **falls back to the procedural model for anything that fails to load** (`?noassets` forces the fallback).

## Replacing a model with your own Blender export
Keep the file name and node names; materials only matter through their *names*:

| file | nodes | notes |
|---|---|---|
| `weapons.glb` | `w_pistol w_dual w_shotgun w_ar w_smg w_sniper w_rocket`, `p_pick p_axe p_shovel p_sickle p_hammer` | origin = grip/hand, barrel towards -Z (glTF), material `R_rarity` is recoloured to the rarity colour, `G_*` materials glow |
| `char_<outfit>.glb` | `torso head arm_L arm_R forearm_L forearm_R leg_L leg_R shin_L shin_R` (forearm/shin are children of arm/leg; pivots at shoulder/elbow/hip/knee) | materials `R_skin R_top R_top2 R_pants R_hair` are recoloured per player/bot; outfits: ranger neon frost gold shadow beach knight circuit dino cow lab punk |
| `glider.glb` | `glider_canopy` (materials `R_tint` + white), `glider_frame` | `R_tint` takes the player's colour |
| `bus.glb` | `bus_body balloon_rig balloon bus_prop` | `bus_prop` pivot at the nose (spins around Z) |
| `chest_wood.glb` `chest_metal.glb` | `body`, `lid` (lid pivot at 0,0.55,-0.35) | `R_rarity` glows in the rarity colour |
| `heals.glb` | `heal_bandage heal_medkit heal_chug heal_shield heal_minishield heal_slurp` | |
| `llama.glb` | `body`, `balloon` | |
| `trees.glb` | `tree_trunk tree_pine tree_oak` | foliage is greyscale; the game tints every instance |

Export with `+Y up` (glTF default), Apply Modifiers, no animations needed (the game animates the nodes procedurally). Edit `manifest.json` to
add/remove files.
