# Lanternfall

A 2D action-adventure Metroidvania set in Umbravale, a buried kingdom whose Great Lantern has gone dark. You play the last Wick, a small lantern-headed spirit. You fight through ten regions and the hub town, gain nine abilities from the ten guardians, and climb to the Lantern's Heart.

Everything is original: the world, story, characters, enemies and bosses. All of the art is drawn in code (no image files), and all music and sound are synthesised live with the Web Audio API.

**To play:** open `index.html` in Chrome, Edge, Firefox or Safari. There's no install, no build step and no internet needed. It also works from GitHub Pages.

## Controls

| Action | Keyboard + mouse (default) | Keyboard only (arrows layout) | Gamepad |
|---|---|---|---|
| Move | A D | ← → | Stick / D-pad |
| Look up / down | W S | ↑ ↓ | Stick |
| Jump (hold for height) | Space | Z or Space | A |
| Attack | Left Click (or J) | X | X |
| Dash | Shift | C or Shift | RT / RB |
| Spell | Q | A | B |
| Focus (hold to heal) | F | S | Y |
| Interact / talk / rest | W or E | ↑ or E | Up |
| Inventory · Map · Pause | Tab · M · Esc | Tab · M · Esc | Select · LB · Start |

You can switch to the arrows layout in **Settings**. In the default layout every key sits under the left hand, so it works on a 60% keyboard. Some moves are combinations:

- **Stonefall slam:** hold Down and press Dash in mid-air.
- **Lumen Cleave:** hold Attack, then release.
- **Drop through a ledge or grate:** hold Down and press Jump.
- **Pogo:** strike downward in mid-air to bounce off enemies and spikes.

## What's in it

- **87 interconnected rooms in 11 areas:**
  - Lanternwatch (the hub town)
  - Old Umbravale
  - Mossdeep Thicket
  - Sunken Ruins of Aurel
  - Glasswyrm Caves
  - City of Quiet Bells
  - The Mirrorlake
  - Cinderdeep
  - Temple of the Veiled Eye
  - Gloamreach
  - Heart of the Lantern

  Each area has its own palette, parallax backgrounds, props, particles, hazards, enemies, music and boss.
- **Ability-gated exploration.** These abilities open new paths through the world:

  | Ability | What it gets past |
  |---|---|
  | Moth Cloak (dash) | spike gaps |
  | Thornhook Claws (cling, wall-jump, climb) | sheer walls |
  | Ember Bolt | wax seals |
  | Lumen Cleave | crystal walls |
  | Moth Wings (double jump) | thorn hedges |
  | Tide Pearl | Gloomwater pools |
  | Stonefall | cracked floors |
  | Veilstep | shimmering veils |
  | Lantern Key | the Great Lantern Gate |

  There's also a hidden spell, Ember Nova.
- **10 bosses**, each with its own art, several attacks, 2–3 phases, telegraphed moves and a reward. They are the Hollow Warden, Mother Bramble, the Stone Archivist, the Glasswyrm, the Bellwright, the Eelmother, Forge Tyrant Vulk, the Veiled Oracle, the Gloam Knight and Ysolde, the Unlit.
- **38 enemy types** built from 16 behaviours. Examples: walkers, shield guards, chargers, hoppers, divers, turrets, teleporters, shell-hiders, ghosts that pass through walls, exploders, ambushers and spell-casters.
- **Combat:**
  - A three-hit combo, plus up- and down-strikes (pogo)
  - Charged attack, dash and air dash, and invincibility frames
  - Knockback, hit-stop and screen shake
  - Focus-healing with Lumen, and spells
- **22 charms** with notch costs. You can only change them while resting at a bench.
- **Progression:**
  - Mask shards (health) and vessel fragments (Lumen)
  - Charm notches
  - Four blade upgrades from the smith (these need pale ore)
  - 24 lost wisps to bring home for rewards
- **Folk and story.** There are shops, a smith, a cartographer who sells a map of each region and pins for marking it, and travellers who move through the world and change what they say as you progress. You can also read 29 ancient tablets, discover 10 hidden rooms and break open dozens of hidden walls.
- **Map.** Rooms appear as you explore them, or all at once when you buy a region's map. It shows where you are, benches, guardians, sealed paths, folk and treasure. Some of these need pins or charms.
- **Saving:**
  - Three save slots, saved automatically
  - Benches heal you, save your game and respawn the enemies
  - When you die you leave a shade holding your glimmer; strike it to get the glimmer back
- **Settings:** volume levels, screen shake, keyboard layout, play timer, FPS counter and fullscreen.

## For developers

The game is plain JavaScript, loaded by `index.html`, with no dependencies.

| File | Contents |
|---|---|
| `js/core.js` | constants, RNG, input (keyboard, gamepad), audio engine and generative music |
| `js/data.js` | regions, abilities, charms, enemies, bosses, the world layout and its connections, shops |
| `js/world.js` | builds rooms from the layout (doors, ability gates, secrets, hazards, spawns) and a tile-level reachability solver |
| `js/story.js` | NPC dialogue, lore tablets and tutorial signs |
| `js/player.js` | player movement and combat |
| `js/entities.js` | enemies, projectiles, pickups, the shade and the companion wisp |
| `js/bosses.js` | the ten bosses |
| `js/render.js` | terrain, parallax, characters, lighting and atmosphere |
| `js/ui.js` | HUD, menus, map, inventory, dialogue, shops, title screen and cards |
| `js/main.js` | game state, rooms, combat, saves, the main loop and the test harness |

### Tests

```bash
node tools/validate.js        # proves the whole world can be completed: every room, item and boss is reachable in progression order, and no reachable spot is a softlock
npm i playwright              # browser tests below need Playwright and Chromium
node tools/systems.js         # all 204 door transitions, all 10 boss fights from start to finish, all 38 enemies, the UI screens, save and load
node tools/mechanics.js       # checks jump, dash and wall physics against the solver, and every ability gate in-engine
node tools/playthrough.js     # a scripted keyboard playthrough of the opening
```
