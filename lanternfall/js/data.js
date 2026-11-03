// Lanternfall — game data: regions, abilities, charms, enemies, bosses, world layout, NPCs, lore
'use strict';
var LF = globalThis.LF || (globalThis.LF = {});

// ------------------------------------------------------------------ REGIONS
LF.REGIONS = {
  hub: { name: 'Lanternwatch', sub: 'The Last Lit Hearth', bg: ['#1c1724', '#0b0910'], rock: '#2a2430', rockHi: '#5d4c55', rim: '#d1a265', accent: '#ffb35a', fog: '255,190,120', dark: 0.32, fx: 'embers', bgs: 'town', music: 'hub', diff: 0, enemies: [] },
  umbravale: { name: 'Old Umbravale', sub: 'The Abandoned Kingdom', bg: ['#151b28', '#07090f'], rock: '#242a37', rockHi: '#4a566f', rim: '#93a7cb', accent: '#a7c8ff', fog: '150,170,220', dark: 0.42, fx: 'dust', bgs: 'halls', music: 'umbravale', diff: 1, enemies: ['husk', 'husk_guard', 'gloomfly', 'mite'] },
  mossdeep: { name: 'Mossdeep Thicket', sub: 'Where the Roots Remember', bg: ['#0f2018', '#040a07'], rock: '#1c2a1e', rockHi: '#3f5b37', rim: '#86ba5c', accent: '#c4f582', fog: '120,200,120', dark: 0.4, fx: 'spores', bgs: 'forest', music: 'mossdeep', diff: 2, enemies: ['mossback', 'sporepuff', 'thornling', 'leafwing', 'husk'] },
  aurel: { name: 'Sunken Ruins of Aurel', sub: 'City of the First Scribes', bg: ['#211b14', '#0b0907'], rock: '#3a3127', rockHi: '#7a6a52', rim: '#dcc58f', accent: '#74e4d4', fog: '220,200,150', dark: 0.38, fx: 'dust', bgs: 'ruins', music: 'aurel', diff: 2, enemies: ['sentinel', 'glyphwisp', 'rubble', 'hopper', 'gloomfly'] },
  glasswyrm: { name: 'Glasswyrm Caves', sub: 'The Singing Dark', bg: ['#160f27', '#06040c'], rock: '#221b38', rockHi: '#4c4080', rim: '#b9a2ff', accent: '#83f2ff', fog: '160,140,255', dark: 0.5, fx: 'sparkles', bgs: 'crystal', music: 'glasswyrm', diff: 3, enemies: ['shardling', 'prismbat', 'geode', 'spitter'] },
  quietbells: { name: 'City of Quiet Bells', sub: 'Where No Bell Has Rung', bg: ['#0f1626', '#05070d'], rock: '#1f2433', rockHi: '#3e4864', rim: '#aab9da', accent: '#ffd27a', fog: '140,160,210', dark: 0.42, fx: 'rain', bgs: 'city', music: 'quietbells', diff: 4, enemies: ['belldrone', 'watchman', 'hound', 'wraith'] },
  mirrorlake: { name: 'The Mirrorlake', sub: 'Waters That Hold Their Breath', bg: ['#0b1d23', '#03080a'], rock: '#17292e', rockHi: '#345a61', rim: '#83d3d3', accent: '#a5ffff', fog: '120,210,210', dark: 0.45, fx: 'drips', bgs: 'lake', music: 'mirrorlake', diff: 5, enemies: ['mirefrog', 'gloomjelly', 'reedstalker', 'bubbler'] },
  cinderdeep: { name: 'Cinderdeep', sub: 'The Forge That Never Cooled', bg: ['#2b1008', '#0d0403'], rock: '#2c1b17', rockHi: '#5f3527', rim: '#ff8c4c', accent: '#ffb243', fog: '255,120,60', dark: 0.34, fx: 'embers', bgs: 'volcano', music: 'cinderdeep', diff: 5, enemies: ['magmaslug', 'emberbat', 'ashgolem', 'flamespitter'] },
  veiledeye: { name: 'Temple of the Veiled Eye', sub: 'It Sees What Was', bg: ['#1d1527', '#08050c'], rock: '#2c2236', rockHi: '#5d4b70', rim: '#ebcb7e', accent: '#ffa3f2', fog: '230,180,255', dark: 0.42, fx: 'motes', bgs: 'temple', music: 'veiledeye', diff: 6, enemies: ['templeguard', 'specter', 'eyesentry', 'acolyte'] },
  gloamreach: { name: 'Gloamreach', sub: 'The Kingdom Beneath the Kingdom', bg: ['#0b0913', '#020103'], rock: '#15121d', rockHi: '#2d2542', rim: '#6d5d9e', accent: '#c47dff', fog: '120,80,200', dark: 0.74, fx: 'gloom', bgs: 'gloam', music: 'gloamreach', diff: 7, enemies: ['stalker', 'shademoth', 'voidmaw', 'knightling'] },
  heart: { name: 'Heart of the Lantern', sub: 'Where the Light Was Kept', bg: ['#2b2111', '#0a0704'], rock: '#2e2618', rockHi: '#6f5b31', rim: '#ffe28c', accent: '#fff3c4', fog: '255,230,160', dark: 0.3, fx: 'motes', bgs: 'heart', music: 'heart', diff: 8, enemies: ['lanternwraith', 'emberhusk', 'shademoth'] },
};

// ------------------------------------------------------------------ MUSIC (generative definitions)
const minor = [0, 2, 3, 5, 7, 8, 10], dorian = [0, 2, 3, 5, 7, 9, 10], phryg = [0, 1, 3, 5, 7, 8, 10], lyd = [0, 2, 4, 6, 7, 9, 11], major = [0, 2, 4, 5, 7, 9, 11], harm = [0, 2, 3, 5, 7, 8, 11];
LF.MUSIC = {
  title: { bpm: 60, root: 110, scale: minor, prog: [0, 5, 3, 4], pad: 'sawtooth', padLp: 700, arp: [0, 4, 7, 9, 7, 4, 2, 4], arpDensity: 0.55, arpVol: 0.03, bass: true, melody: 0.3, wet: 1 },
  hub: { bpm: 66, root: 130.8, scale: major, prog: [0, 3, 5, 4], pad: 'triangle', padLp: 1400, padVol: 0.035, arp: [0, 2, 4, 7, 4, 2], arpDensity: 0.6, arpWave: 'sine', arpVol: 0.04, bass: true, bells: 0.3, melody: 0.25 },
  umbravale: { bpm: 56, root: 98, scale: minor, prog: [0, 5, 3, 6], padLp: 650, arp: [0, 2, 4, 2, 7, 4], arpDensity: 0.45, arpVol: 0.03, bass: true, melody: 0.35, melWave: 'triangle', drone: true },
  mossdeep: { bpm: 72, root: 116.5, scale: dorian, prog: [0, 3, 0, 4], pad: 'triangle', padLp: 1200, padVol: 0.03, arp: [0, 4, 2, 6, 4, 7, 2, 4], arpDensity: 0.7, arpWave: 'sine', arpVol: 0.04, bass: true, melody: 0.3 },
  aurel: { bpm: 60, root: 103.8, scale: phryg, prog: [0, 1, 0, 6], padLp: 800, arp: [0, 1, 4, 1, 7, 4], arpDensity: 0.5, arpWave: 'triangle', arpVol: 0.03, bass: true, melody: 0.35, drone: true },
  glasswyrm: { bpm: 64, root: 146.8, scale: lyd, prog: [0, 1, 4, 3], pad: 'sine', padVol: 0.04, padLp: 2000, arp: [0, 4, 7, 11, 14, 11, 7, 4], arpDensity: 0.75, arpWave: 'sine', arpOct: 4, arpVol: 0.025, arpLen: 3, bells: 0.5, melody: 0.2 },
  quietbells: { bpm: 58, root: 92.5, scale: minor, prog: [0, 3, 4, 0], padLp: 900, arp: [0, 7, 4, 7], arpDensity: 0.35, arpVol: 0.025, bass: true, bells: 0.8, melody: 0.3, melWave: 'triangle' },
  mirrorlake: { bpm: 52, root: 110, scale: dorian, prog: [0, 6, 3, 4], pad: 'sine', padVol: 0.045, padLp: 1500, arp: [0, 2, 4, 6, 9, 6, 4, 2], arpDensity: 0.5, arpWave: 'sine', arpVol: 0.03, arpLen: 3, melody: 0.25, drone: true },
  cinderdeep: { bpm: 84, root: 87.3, scale: harm, prog: [0, 5, 6, 4], padLp: 700, arp: [0, 3, 4, 7, 4, 3], arpDensity: 0.6, arpWave: 'sawtooth', arpVol: 0.018, bass: true, bassEvery: 4, bassVol: 0.14, melody: 0.2, drums: { kick: [0, 5], tom: true } },
  veiledeye: { bpm: 62, root: 123.5, scale: phryg, prog: [0, 1, 3, 1], pad: 'triangle', padVol: 0.03, padLp: 1100, arp: [0, 1, 4, 5, 7, 5, 4, 1], arpDensity: 0.55, arpWave: 'triangle', arpVol: 0.03, bells: 0.4, melody: 0.3, drone: true },
  gloamreach: { bpm: 48, root: 77.8, scale: [0, 1, 3, 6, 7, 8, 10], prog: [0, 1, 0, 5], padLp: 500, padVol: 0.03, arp: [0, 6, 1, 7], arpDensity: 0.25, arpVol: 0.025, bass: true, melody: 0.2, melWave: 'triangle', drone: true },
  heart: { bpm: 60, root: 130.8, scale: lyd, prog: [0, 4, 1, 5], pad: 'sawtooth', padLp: 1300, padVol: 0.026, arp: [0, 4, 7, 11, 7, 4], arpDensity: 0.6, arpWave: 'sine', arpOct: 4, arpVol: 0.025, bells: 0.6, melody: 0.35, drone: true },
  boss: { bpm: 132, root: 98, scale: harm, prog: [0, 0, 5, 4], padLp: 1100, padVol: 0.02, arp: [0, 2, 3, 7, 3, 2, 0, 7], arpDensity: 0.95, arpWave: 'sawtooth', arpVol: 0.02, arpLen: 0.8, bass: true, bassEvery: 2, bassVol: 0.13, drums: { kick: [0, 3, 4], snare: [2, 6], hat: [1, 3, 5, 7], tom: true }, wet: 0.5 },
  finalboss: { bpm: 140, root: 87.3, scale: [0, 1, 4, 5, 7, 8, 11], prog: [0, 1, 0, 5, 4, 1], padLp: 1400, padVol: 0.024, arp: [0, 2, 4, 7, 9, 7, 4, 2], arpDensity: 0.95, arpWave: 'sawtooth', arpVol: 0.02, arpLen: 0.7, bass: true, bassEvery: 2, bassVol: 0.14, bells: 0.5, drums: { kick: [0, 2, 4, 6], snare: [2, 6], hat: [1, 3, 5, 7], tom: true }, wet: 0.6 },
  ending: { bpm: 54, root: 130.8, scale: major, prog: [0, 5, 3, 4], pad: 'triangle', padVol: 0.04, padLp: 1600, arp: [0, 4, 7, 12, 7, 4], arpDensity: 0.7, arpWave: 'sine', arpVol: 0.04, arpLen: 3, bells: 0.7, melody: 0.4, bass: true },
};

// ------------------------------------------------------------------ ABILITIES
LF.ABILITIES = {
  dash: { name: 'Moth Cloak', desc: 'Press [dash] to dash. You may dash once in mid-air between landings.', icon: 'cloak' },
  claws: { name: 'Thornhook Claws', desc: 'Cling to walls and slide down them. Press [jump] to leap off a wall; hold [up] to climb.', icon: 'claw' },
  bolt: { name: 'Ember Bolt', desc: 'Press [spell] to hurl a bolt of flame (33 Lumen). It melts wax seals.', icon: 'bolt' },
  charge: { name: 'Lumen Cleave', desc: 'Hold [attack] until your blade shines, then release for a great cleave. It shatters crystal.', icon: 'cleave' },
  wings: { name: 'Moth Wings', desc: 'Press [jump] again in mid-air to take flight once more.', icon: 'wings' },
  pearl: { name: 'Tide Pearl', desc: 'You can swim through the black Gloomwater unharmed. Press [jump] to stroke upward.', icon: 'pearl' },
  slam: { name: 'Stonefall', desc: 'In mid-air, hold [down] and press [dash] to slam into the ground. It breaks cracked floors.', icon: 'slam' },
  veil: { name: 'Veilstep', desc: 'Your dash now passes through shimmering veils, and you can\'t be harmed while dashing.', icon: 'veil' },
  key: { name: 'Lantern Key', desc: 'A key of cold light. It opens the Great Lantern Gate above Lanternwatch.', icon: 'key' },
  nova: { name: 'Ember Nova', desc: 'Hold [up] and press [spell] to raise a pillar of flame (33 Lumen).', icon: 'nova' },
};

// ------------------------------------------------------------------ CHARMS
LF.CHARMS = {
  hearthstone: { name: 'Hearthstone', cost: 2, desc: 'A warm stone that beats like a heart. Grants 2 extra masks.' },
  quickstep: { name: 'Quickstep Sash', cost: 1, desc: 'A sash of moth silk. You run 18% faster.' },
  longthorn: { name: 'Longthorn Pin', cost: 2, desc: 'A pin cut from a great thorn. Your blade reaches 30% farther.' },
  ironbite: { name: 'Ironbite Band', cost: 3, desc: 'A band forged in Cinderdeep. Your blade deals 35% more damage.' },
  magpie: { name: 'Magpie Feather', cost: 1, desc: 'Glimmer flies to you from afar, and enemies drop 25% more of it.' },
  patient: { name: 'Patient Wick', cost: 1, desc: 'A slow-burning wick. You focus 40% faster.' },
  kindled: { name: 'Kindled Soul', cost: 2, desc: 'Fans your inner flame. Your spells deal 50% more damage.' },
  soulcatcher: { name: 'Soulcatcher Lantern', cost: 2, desc: 'Each strike with your blade gathers 60% more Lumen.' },
  thorn_mantle: { name: 'Thorn Mantle', cost: 2, desc: 'When you are struck, thorns burst outward and wound nearby foes.' },
  swift_needle: { name: 'Swift Needle', cost: 3, desc: 'A needle from the Bellwright\'s works. You attack 30% faster.' },
  steady: { name: 'Steady Stance', cost: 1, desc: 'You are no longer knocked back when you strike or are struck.' },
  compass: { name: 'Wayfarer\'s Compass', cost: 1, desc: 'Shows exactly where you are on the map.' },
  featherfall: { name: 'Featherfall', cost: 1, desc: 'Hold [jump] while falling to drift down gently.' },
  twin_flame: { name: 'Twin Flame', cost: 2, desc: 'Your Ember Bolt splits into three flames.' },
  crystal_guard: { name: 'Crystal Guard', cost: 2, desc: 'You stay protected 60% longer after being struck.' },
  moonlit: { name: 'Moonlit Dash', cost: 2, desc: 'Your dash recovers twice as fast.' },
  gambler: { name: 'Gambler\'s Shard', cost: 1, desc: 'Enemies drop twice the glimmer, but every blow against you hurts one mask more.' },
  deep_focus: { name: 'Deep Focus', cost: 3, desc: 'Focusing takes longer, but each focus restores two masks.' },
  spirit_kin: { name: 'Spirit Kin', cost: 2, desc: 'A little lost wisp follows you and fires sparks at your foes.' },
  ember_trail: { name: 'Ember Trail', cost: 2, desc: 'Your dash leaves a trail of flames behind it.' },
  wicks_lament: { name: 'Wick\'s Lament', cost: 1, desc: 'Being struck fills you with 20 Lumen.' },
  oathbound: { name: 'Oathbound Sigil', cost: 3, desc: 'Brother Cask\'s oath. You deal double damage while at one mask.' },
};

// ------------------------------------------------------------------ ENEMIES
// ai: walker guard charger hopper flyer diver turret teleporter heavy shell ghost exploder ambusher shooterfly caster runner
LF.ENEMIES = {
  husk: { name: 'Wandering Husk', ai: 'walker', hp: 12, dmg: 1, spd: 55, w: 26, h: 34, glim: 3, style: 'bug', col: '#6b6f80', col2: '#c9ccd8', desc: 'Once a citizen of Umbravale. The Gloam stole its name, and now it only walks.' },
  husk_guard: { name: 'Husk Sentry', ai: 'guard', hp: 22, dmg: 1, spd: 50, w: 30, h: 40, glim: 6, style: 'bug', col: '#4f5873', col2: '#b8c4de', shield: '#8c96b0', desc: 'It still stands its post. The shield is all it remembers. Strike it from behind or above.' },
  gloomfly: { name: 'Gloomfly', ai: 'flyer', hp: 8, dmg: 1, spd: 70, w: 24, h: 20, glim: 2, style: 'fly', col: '#3b3550', col2: '#a99cff', desc: 'Drifts toward any warmth. Harmless alone. It is rarely alone.' },
  mite: { name: 'Lantern Mite', ai: 'hopper', hp: 7, dmg: 1, spd: 90, w: 20, h: 16, glim: 2, style: 'mite', col: '#7a5a3a', col2: '#ffcf7a', desc: 'Once lit the streets. Now it bites the ankles of travellers.' },
  mossback: { name: 'Mossback', ai: 'charger', hp: 24, dmg: 1, spd: 60, w: 42, h: 30, glim: 6, style: 'beetle', col: '#3d5a2e', col2: '#a8d86a', desc: 'A grazing beetle overgrown with moss. Easily startled. Very hard when startled.' },
  sporepuff: { name: 'Spore Puff', ai: 'exploder', hp: 10, dmg: 1, spd: 45, w: 28, h: 28, glim: 4, style: 'puff', col: '#8a6aa0', col2: '#e6c8ff', desc: 'It swells with spores as it nears you and bursts when it has drawn too close.' },
  thornling: { name: 'Thornling', ai: 'runner', hp: 16, dmg: 1, spd: 120, w: 26, h: 24, glim: 4, style: 'spiky', col: '#4a3a24', col2: '#d6b25a', desc: 'Small, quick and covered in barbs. It leaps when it gets close.' },
  leafwing: { name: 'Leafwing', ai: 'diver', hp: 12, dmg: 1, spd: 80, w: 30, h: 22, glim: 5, style: 'fly', col: '#5a7a2a', col2: '#d9ff8a', desc: 'Hangs still like a dead leaf, then dives.' },
  sentinel: { name: 'Ruin Sentinel', ai: 'turret', hp: 26, dmg: 1, spd: 0, w: 30, h: 36, glim: 7, style: 'turret', col: '#6a5a44', col2: '#74e4d4', shot: 'aim', rate: 2.2, desc: 'A stone guardian of Aurel. Its eye still burns with an old command: let none pass.' },
  glyphwisp: { name: 'Glyph Wisp', ai: 'teleporter', hp: 18, dmg: 1, spd: 0, w: 24, h: 24, glim: 6, style: 'wisp', col: '#2a6a6a', col2: '#9ffff0', desc: 'A rune that slipped free of its page. It blinks about and hurls letters.' },
  rubble: { name: 'Rubble Golem', ai: 'heavy', hp: 48, dmg: 2, spd: 40, w: 46, h: 48, glim: 12, style: 'golem', col: '#5a4c3a', col2: '#dcc58f', desc: 'Pieces of a fallen statue, still trying to stand guard.' },
  hopper: { name: 'Ruin Hopper', ai: 'hopper', hp: 16, dmg: 1, spd: 120, w: 26, h: 22, glim: 4, style: 'mite', col: '#5a5040', col2: '#74e4d4', desc: 'It nests in the cracks of the old archives and springs out at passers-by.' },
  shardling: { name: 'Shardling', ai: 'hopper', hp: 22, dmg: 1, spd: 140, w: 24, h: 24, glim: 5, style: 'crystalbug', col: '#4c3f80', col2: '#83f2ff', desc: 'A beetle that ate crystal until it became crystal.' },
  prismbat: { name: 'Prism Bat', ai: 'diver', hp: 18, dmg: 1, spd: 100, w: 30, h: 20, glim: 6, style: 'bat', col: '#5a3f9a', col2: '#c8b2ff', desc: 'It hunts by the echoes of singing crystals.' },
  geode: { name: 'Geode Tortoise', ai: 'shell', hp: 42, dmg: 1, spd: 40, w: 42, h: 30, glim: 10, style: 'shell', col: '#3a3060', col2: '#b9a2ff', desc: 'When threatened it seals itself inside a shell no blade can crack. Wait for it to open.' },
  spitter: { name: 'Crystal Spitter', ai: 'turret', hp: 24, dmg: 1, spd: 0, w: 30, h: 30, glim: 7, style: 'turret', col: '#3a3070', col2: '#83f2ff', shot: 'arc', rate: 2.4, desc: 'It spits shards in high arcs.' },
  belldrone: { name: 'Bell Drone', ai: 'shooterfly', hp: 22, dmg: 1, spd: 90, w: 26, h: 26, glim: 7, style: 'bell', col: '#8a7040', col2: '#ffd27a', desc: 'A tiny flying bell. It cannot ring, so it shoots instead.' },
  watchman: { name: 'Watchman Husk', ai: 'charger', hp: 34, dmg: 1, spd: 55, w: 30, h: 42, glim: 9, style: 'bug', col: '#3e4864', col2: '#ffd27a', spear: true, desc: 'The city watch still patrols. It lowers its spear and charges at any light.' },
  hound: { name: 'Clockwork Hound', ai: 'runner', hp: 28, dmg: 1, spd: 170, w: 38, h: 24, glim: 8, style: 'hound', col: '#6a5a3a', col2: '#ffd27a', desc: 'The Bellwright built them to herd the citizens home. They still herd.' },
  wraith: { name: 'Quiet Wraith', ai: 'ghost', hp: 24, dmg: 1, spd: 60, w: 28, h: 34, glim: 8, style: 'ghost', col: '#5a6a9a', col2: '#dfe8ff', desc: 'The echo of a citizen who could not leave. It passes through walls.' },
  mirefrog: { name: 'Mire Toad', ai: 'hopper', hp: 32, dmg: 1, spd: 150, w: 34, h: 26, glim: 8, style: 'frog', col: '#2a5a50', col2: '#a5ffff', desc: 'Heavy and patient. It lands hard.' },
  gloomjelly: { name: 'Gloomjelly', ai: 'flyer', hp: 20, dmg: 1, spd: 40, w: 30, h: 34, glim: 6, style: 'jelly', col: '#3a5a8a', col2: '#a5e8ff', desc: 'It drifts through the air as if it were water. It has forgotten it isn\'t.' },
  reedstalker: { name: 'Reed Stalker', ai: 'charger', hp: 36, dmg: 1, spd: 65, w: 28, h: 44, glim: 9, style: 'bug', col: '#2a4a40', col2: '#83d3d3', spear: true, desc: 'A tall wader. It hides among the reeds and strikes fast.' },
  bubbler: { name: 'Bubble Spitter', ai: 'turret', hp: 28, dmg: 1, spd: 0, w: 30, h: 30, glim: 8, style: 'turret', col: '#2a5a60', col2: '#a5ffff', shot: 'arc', rate: 2.0, desc: 'Lobs heavy bubbles of Gloomwater.' },
  magmaslug: { name: 'Magma Slug', ai: 'walker', hp: 42, dmg: 2, spd: 35, w: 42, h: 24, glim: 10, style: 'slug', col: '#7a2a10', col2: '#ffb243', trail: true, desc: 'Leaves a trail that burns for a while.' },
  emberbat: { name: 'Ember Bat', ai: 'diver', hp: 26, dmg: 1, spd: 120, w: 30, h: 20, glim: 8, style: 'bat', col: '#6a2010', col2: '#ff8c4c', desc: 'Its wings throw off sparks as it dives.' },
  ashgolem: { name: 'Ash Golem', ai: 'heavy', hp: 72, dmg: 2, spd: 45, w: 48, h: 52, glim: 16, style: 'golem', col: '#3a2420', col2: '#ff8c4c', desc: 'Slag and cinder in the shape of a smith. It still swings its fists like hammers.' },
  flamespitter: { name: 'Cinder Spitter', ai: 'turret', hp: 34, dmg: 1, spd: 0, w: 30, h: 30, glim: 9, style: 'turret', col: '#5a2010', col2: '#ffb243', shot: 'arc', rate: 1.8, desc: 'Spits globs of molten rock.' },
  templeguard: { name: 'Temple Guardian', ai: 'guard', hp: 56, dmg: 2, spd: 60, w: 34, h: 46, glim: 14, style: 'bug', col: '#5d4b70', col2: '#ebcb7e', shield: '#ebcb7e', desc: 'Sworn to the Oracle. Its golden shield is said to be blessed.' },
  specter: { name: 'Veil Specter', ai: 'teleporter', hp: 34, dmg: 1, spd: 0, w: 26, h: 30, glim: 10, style: 'ghost', col: '#7a4a8a', col2: '#ffa3f2', desc: 'A prayer that was never answered.' },
  eyesentry: { name: 'Eye Sentry', ai: 'turret', hp: 40, dmg: 1, spd: 0, w: 30, h: 30, glim: 10, style: 'eye', col: '#5d4b70', col2: '#ffa3f2', shot: 'burst', rate: 2.6, desc: 'An unblinking eye set in stone.' },
  acolyte: { name: 'Hollow Acolyte', ai: 'caster', hp: 40, dmg: 1, spd: 45, w: 28, h: 40, glim: 10, style: 'robed', col: '#4a3a5a', col2: '#ebcb7e', desc: 'It still chants, though it no longer remembers the words.' },
  stalker: { name: 'Gloom Stalker', ai: 'charger', hp: 52, dmg: 2, spd: 90, w: 38, h: 30, glim: 14, style: 'beast', col: '#1d1830', col2: '#c47dff', desc: 'Born in the Gloam. It has never known light, and it hates it.' },
  shademoth: { name: 'Shade Moth', ai: 'diver', hp: 30, dmg: 1, spd: 130, w: 32, h: 24, glim: 10, style: 'moth', col: '#2a2040', col2: '#c47dff', desc: 'The Queen\'s moths, unlit. They still circle the place where the light was.' },
  voidmaw: { name: 'Void Maw', ai: 'ambusher', hp: 50, dmg: 2, spd: 0, w: 42, h: 30, glim: 14, style: 'maw', col: '#1d1830', col2: '#ff6a9a', desc: 'A mouth in the ground. Watch for loose stones.' },
  knightling: { name: 'Gloam Knightling', ai: 'guard', hp: 62, dmg: 2, spd: 70, w: 30, h: 42, glim: 16, style: 'bug', col: '#221d33', col2: '#c47dff', shield: '#3d3460', leaps: true, desc: 'A squire of the First Wick, unlit long ago.' },
  lanternwraith: { name: 'Lantern Wraith', ai: 'ghost', hp: 52, dmg: 2, spd: 80, w: 30, h: 36, glim: 14, style: 'ghost', col: '#8a7a40', col2: '#fff3c4', desc: 'The last keepers of the Lantern, burned hollow by its light.' },
  emberhusk: { name: 'Ember-Bound Husk', ai: 'caster', hp: 60, dmg: 2, spd: 50, w: 30, h: 42, glim: 16, style: 'robed', col: '#6f5b31', col2: '#ffe28c', desc: 'It carried the Queen\'s train. Now it carries her fire.' },
};

// ------------------------------------------------------------------ BOSSES
LF.BOSSES = {
  warden: { name: 'The Hollow Warden', title: 'Keeper of the Fallen Gate', hp: 165, reward: 'dash', region: 'umbravale' },
  bramble: { name: 'Mother Bramble', title: 'Heart of the Thicket', hp: 250, reward: 'claws', region: 'mossdeep' },
  archivist: { name: 'The Stone Archivist', title: 'Last Keeper of Aurel', hp: 260, reward: 'bolt', region: 'aurel' },
  wyrm: { name: 'Glasswyrm', title: 'Serpent of Prisms', hp: 330, reward: 'charge', region: 'glasswyrm' },
  bellwright: { name: 'The Bellwright', title: 'Who Tolls in Silence', hp: 380, reward: 'wings', region: 'quietbells' },
  eelmother: { name: 'The Eelmother', title: 'Mourner of the Mirrorlake', hp: 400, reward: 'pearl', region: 'mirrorlake' },
  tyrant: { name: 'Forge Tyrant Vulk', title: 'Hammer of Cinderdeep', hp: 470, reward: 'slam', region: 'cinderdeep' },
  oracle: { name: 'The Veiled Oracle', title: 'Eye That Would Not Close', hp: 480, reward: 'veil', region: 'veiledeye' },
  gloamknight: { name: 'The Gloam Knight', title: 'First Wick, Unlit', hp: 560, reward: 'key', region: 'gloamreach' },
  ysolde: { name: 'Ysolde, the Unlit', title: 'Queen of Moths', hp: 950, reward: null, region: 'heart' },
};

// ------------------------------------------------------------------ WORLD LAYOUT
// [id, name, region, cellX, cellY, wCells, hCells, features]
const R = [
  // Lanternwatch (hub)
  ['h_secret', 'Forgotten Nook', 'hub', -3, 0, 1, 1, { secret: true, items: [{ t: 'mask', where: 'floor', x: 0.5 }] }],
  ['h_cliff', 'Lantern\'s Fall', 'hub', -2, 0, 1, 1, { start: true, lore: ['fall'], signs: [{ x: 0.62, text: 'tut_move' }] }],
  ['h_town', 'Lanternwatch', 'hub', -1, 0, 3, 1, { bench: 0.42, npcs: [{ id: 'mirelle', x: 0.22 }, { id: 'thrennic', x: 0.62 }, { id: 'penna', x: 0.8 }], lore: [{ id: 'lantern_gate', x: 0.5 }], calm: true }],
  ['h_east', 'Elder\'s Hollow', 'hub', 2, 0, 1, 1, { npcs: [{ id: 'lumen', x: 0.55 }], calm: true, items: [{ t: 'glim', v: 40, where: 'alcove' }] }],
  // Old Umbravale
  ['r1_hall', 'Hall of Banners', 'umbravale', -1, 1, 2, 1, { npcs: [{ id: 'quillon', x: 0.7 }], lore: ['banners'], items: [{ t: 'wisp', where: 'floor', x: 0.3 }], signs: [{ x: 0.5, text: 'tut_attack' }] }],
  ['r1_stair', 'Broken Stair', 'umbravale', -2, 1, 1, 1, { items: [{ t: 'glim', v: 40, where: 'alcove' }] }],
  ['r1_gallery', 'Gallery of Kings', 'umbravale', 1, 1, 2, 1, { lore: ['kings'], items: [{ t: 'mask', where: 'high', x: 0.3 }] }],
  ['r1_ante', 'Antechamber', 'umbravale', 0, 2, 2, 1, { items: [{ t: 'vessel', where: 'alcove' }], signs: [{ x: 0.2, text: 'tut_heal' }] }],
  ['r1_cistern', 'Dry Cistern', 'umbravale', -1, 2, 1, 1, { items: [{ t: 'wisp', where: 'high', x: 0.5 }] }],
  ['r1_shrine', 'Shrine of Small Lights', 'umbravale', 2, 2, 1, 1, { bench: 0.5, npcs: [{ id: 'vell', x: 0.25, stage: 0 }], calm: true }],
  ['r1_crypt', 'Crypt of the Wick-Guard', 'umbravale', -2, 2, 1, 2, { lore: ['crypt'], items: [{ t: 'mask', where: 'alcove' }] }],
  ['r1_arena', 'The Fallen Gate', 'umbravale', -1, 3, 2, 1, { boss: 'warden' }],
  ['r1_deep', 'Stair Into Nothing', 'umbravale', 1, 3, 2, 1, { lore: ['stair_down'], items: [{ t: 'notch', where: 'floor', x: 0.2 }], dark: 0.6 }],
  // Mossdeep
  ['m_edge', 'Thicket\'s Edge', 'mossdeep', -3, 1, 1, 1, { npcs: [{ id: 'quillon', x: 0.6 }], items: [{ t: 'wisp', where: 'floor', x: 0.3 }] }],
  ['m_canopy', 'Underground Canopy', 'mossdeep', -5, 1, 2, 1, { lore: ['thicket'], items: [{ t: 'glim', v: 60, where: 'high', x: 0.6 }] }],
  ['m_roots', 'Root Ladder', 'mossdeep', -6, 1, 1, 2, { items: [{ t: 'mask', where: 'alcove' }] }],
  ['m_glade', 'Lantern Glade', 'mossdeep', -5, 2, 2, 1, { npcs: [{ id: 'cask', x: 0.3, stage: 0 }], items: [{ t: 'wisp', where: 'high', x: 0.7 }] }],
  ['m_bench', 'Mossy Rest', 'mossdeep', -3, 2, 1, 1, { bench: 0.45, npcs: [{ id: 'oro', x: 0.75, stage: 0 }], calm: true }],
  ['m_burrow', 'Thornling Burrow', 'mossdeep', -6, 3, 1, 1, { items: [{ t: 'charm', id: 'thorn_mantle', where: 'floor', x: 0.3 }] }],
  ['m_arena', 'Bramble\'s Cradle', 'mossdeep', -5, 3, 2, 1, { boss: 'bramble' }],
  ['m_well', 'Rootwell', 'mossdeep', -3, 3, 1, 1, { lore: [{ id: 'roots_deep', x: 0.2 }] }],
  ['m_secret', 'Hidden Bower', 'mossdeep', -7, 1, 1, 1, { secret: true, items: [{ t: 'charm', id: 'longthorn', where: 'floor', x: 0.5 }] }],
  // Aurel
  ['a_gate', 'Gate of Aurel', 'aurel', 3, 1, 1, 1, { npcs: [{ id: 'quillon', x: 0.6 }], lore: ['aurel'] }],
  ['a_colonnade', 'Fallen Colonnade', 'aurel', 4, 1, 2, 1, { items: [{ t: 'wisp', where: 'high', x: 0.4 }, { t: 'mask', where: 'alcove' }] }],
  ['a_spire', 'Scribe\'s Spire', 'aurel', 6, 1, 1, 2, { items: [{ t: 'ore', where: 'alcove' }] }],
  ['a_library', 'Drowned Library', 'aurel', 4, 2, 2, 1, { lore: ['archive'], items: [{ t: 'wisp', where: 'floor', x: 0.7 }] }],
  ['a_bench', 'Reading Room', 'aurel', 3, 2, 1, 1, { bench: 0.5, npcs: [{ id: 'vell', x: 0.25, stage: 1 }], calm: true }],
  ['a_arena', 'The Last Archive', 'aurel', 3, 3, 2, 1, { boss: 'archivist' }],
  ['a_vault', 'Sealed Vault', 'aurel', 5, 3, 2, 1, { lore: ['vault'], items: [{ t: 'vessel', where: 'alcove' }, { t: 'wisp', where: 'floor', x: 0.15 }] }],
  ['a_secret', 'Scriptorium', 'aurel', 7, 1, 1, 1, { secret: true, items: [{ t: 'charm', id: 'kindled', where: 'floor', x: 0.5 }] }],
  // Glasswyrm
  ['g_mouth', 'Singing Mouth', 'glasswyrm', -3, 4, 1, 1, { npcs: [{ id: 'quillon', x: 0.65 }], items: [{ t: 'wisp', where: 'floor', x: 0.3 }] }],
  ['g_hall', 'Prism Hall', 'glasswyrm', -5, 4, 2, 1, { lore: ['crystal'], items: [{ t: 'mask', where: 'high', x: 0.5 }] }],
  ['g_geode', 'Hollow Geode', 'glasswyrm', -6, 4, 1, 1, { items: [{ t: 'charm', id: 'hearthstone', where: 'floor', x: 0.4 }] }],
  ['g_secret', 'Refraction', 'glasswyrm', -7, 4, 1, 1, { secret: true, items: [{ t: 'charm', id: 'twin_flame', where: 'floor', x: 0.5 }] }],
  ['g_shaft', 'Glass Chimney', 'glasswyrm', -5, 5, 1, 2, { items: [{ t: 'wisp', where: 'high', x: 0.5 }, { t: 'glim', v: 80, where: 'alcove' }] }],
  ['g_bench', 'Quiet Facet', 'glasswyrm', -4, 5, 2, 1, { bench: 0.4, npcs: [{ id: 'oro', x: 0.7, stage: 1 }], calm: true }],
  ['g_arena', 'Wyrm\'s Nest', 'glasswyrm', -4, 6, 2, 1, { boss: 'wyrm' }],
  ['g_depths', 'Crystal Depths', 'glasswyrm', -6, 6, 1, 1, { lore: [{ id: 'depths', x: 0.2 }], items: [{ t: 'mask', where: 'alcove' }] }],
  // Quiet Bells
  ['c_stair', 'Belltower Stair', 'quietbells', 5, 4, 1, 1, { npcs: [{ id: 'quillon', x: 0.3 }] }],
  ['c_avenue', 'Lamplighter Avenue', 'quietbells', 3, 4, 2, 1, { lore: ['city'], items: [{ t: 'wisp', where: 'floor', x: 0.3 }, { t: 'mask', where: 'alcove' }] }],
  ['c_belfry', 'Silent Belfry', 'quietbells', 6, 4, 2, 1, { npcs: [{ id: 'bellkeeper', x: 0.6 }], items: [{ t: 'vessel', where: 'high', x: 0.3 }] }],
  ['c_plaza', 'Plaza of Echoes', 'quietbells', 3, 5, 2, 1, { npcs: [{ id: 'cask', x: 0.3, stage: 1 }], items: [{ t: 'wisp', where: 'high', x: 0.7 }] }],
  ['c_tower', 'Clockwork Tower', 'quietbells', 5, 5, 1, 2, { lore: ['bells'], items: [{ t: 'ore', where: 'alcove' }] }],
  ['c_bench', 'Bellkeeper\'s Lodge', 'quietbells', 6, 5, 1, 1, { bench: 0.45, npcs: [{ id: 'vell', x: 0.75, stage: 2 }], calm: true }],
  ['c_secret', 'Workshop of Needles', 'quietbells', 7, 5, 1, 1, { secret: true, items: [{ t: 'charm', id: 'swift_needle', where: 'floor', x: 0.5 }] }],
  ['c_arena', 'The Great Bell', 'quietbells', 3, 6, 2, 1, { boss: 'bellwright' }],
  ['c_aqueduct', 'Old Aqueduct', 'quietbells', 6, 6, 2, 1, { lore: [{ id: 'aqueduct', x: 0.2 }], items: [{ t: 'wisp', where: 'floor', x: 0.15 }] }],
  // Mirrorlake
  ['l_shore', 'Still Shore', 'mirrorlake', -6, 7, 2, 1, { npcs: [{ id: 'quillon', x: 0.7 }], items: [{ t: 'wisp', where: 'floor', x: 0.85 }] }],
  ['l_reeds', 'Whispering Reeds', 'mirrorlake', -4, 7, 2, 1, { lore: ['lake'], items: [{ t: 'mask', where: 'pool', x: 0.3 }] }],
  ['l_grotto', 'Scholar\'s Grotto', 'mirrorlake', -4, 8, 1, 1, { npcs: [{ id: 'ilse', x: 0.6 }], items: [{ t: 'wisp', where: 'high', x: 0.3 }], calm: true }],
  ['l_mirror', 'The Mirror', 'mirrorlake', -6, 8, 2, 1, { lore: ['mirror'], items: [{ t: 'vessel', where: 'pool', x: 0.5 }] }],
  ['l_bench', 'Lakeside Rest', 'mirrorlake', -3, 8, 1, 1, { bench: 0.5, npcs: [{ id: 'oro', x: 0.2, stage: 2 }], calm: true }],
  ['l_sunk', 'Sunken Steps', 'mirrorlake', -6, 9, 1, 1, { items: [{ t: 'wisp', where: 'floor', x: 0.4 }, { t: 'glim', v: 120, where: 'alcove' }] }],
  ['l_arena', 'Mourning Pool', 'mirrorlake', -5, 9, 2, 1, { boss: 'eelmother' }],
  ['l_secret', 'Pearl Hollow', 'mirrorlake', -7, 9, 1, 1, { secret: true, items: [{ t: 'charm', id: 'deep_focus', where: 'floor', x: 0.5 }] }],
  // Cinderdeep
  ['v_vent', 'Smoking Vent', 'cinderdeep', 7, 7, 1, 1, { npcs: [{ id: 'quillon', x: 0.3 }], items: [{ t: 'wisp', where: 'floor', x: 0.7 }] }],
  ['v_ash', 'Ashfall', 'cinderdeep', 6, 7, 1, 1, { npcs: [{ id: 'brask', x: 0.5 }], calm: true }],
  ['v_flow', 'Magma Flow', 'cinderdeep', 4, 7, 2, 1, { items: [{ t: 'mask', where: 'high', x: 0.55 }, { t: 'wisp', where: 'floor', x: 0.2 }] }],
  ['v_forge', 'Cold Forge', 'cinderdeep', 3, 7, 1, 1, { lore: [{ id: 'forge', x: 0.25 }], items: [{ t: 'ore', where: 'alcove' }] }],
  ['v_chasm', 'Cinder Chasm', 'cinderdeep', 4, 8, 1, 2, { lore: ['tyrant'], items: [{ t: 'charm', id: 'ironbite', where: 'alcove' }] }],
  ['v_bench', 'Smith\'s Respite', 'cinderdeep', 5, 8, 1, 1, { bench: 0.4, npcs: [{ id: 'oro', x: 0.75, stage: 3 }], calm: true }],
  ['v_secret', 'Heart of Embers', 'cinderdeep', 6, 8, 1, 1, { secret: true, items: [{ t: 'ability', id: 'nova', where: 'floor', x: 0.5 }] }],
  ['v_arena', 'Anvil of Vulk', 'cinderdeep', 5, 9, 2, 1, { boss: 'tyrant' }],
  ['v_lower', 'Slag Tunnels', 'cinderdeep', 3, 8, 1, 1, { items: [{ t: 'mask', where: 'alcove' }, { t: 'wisp', where: 'high', x: 0.6 }] }],
  // Veiled Eye
  ['t_portico', 'Temple Portico', 'veiledeye', 1, 8, 2, 1, { npcs: [{ id: 'quillon', x: 0.6 }], lore: ['temple'] }],
  ['t_flooded', 'Flooded Narthex', 'veiledeye', -2, 7, 2, 1, { items: [{ t: 'wisp', where: 'pool', x: 0.6 }, { t: 'vessel', where: 'pool', x: 0.35 }] }],
  ['t_cloister', 'Cloister of Eyes', 'veiledeye', 0, 7, 2, 1, { npcs: [{ id: 'vell', x: 0.3, stage: 3 }], lore: [{ id: 'eye', x: 0.7 }] }],
  ['t_nave', 'Nave of Veils', 'veiledeye', 0, 8, 1, 2, { items: [{ t: 'mask', where: 'high', x: 0.5 }, { t: 'wisp', where: 'floor', x: 0.5 }] }],
  ['t_bench', 'Acolyte\'s Cell', 'veiledeye', -1, 8, 1, 1, { bench: 0.6, npcs: [{ id: 'neme', x: 0.25 }], calm: true }],
  ['t_secret', 'Moon Chapel', 'veiledeye', -2, 8, 1, 1, { secret: true, items: [{ t: 'charm', id: 'moonlit', where: 'floor', x: 0.5 }] }],
  ['t_ossuary', 'Ossuary', 'veiledeye', -2, 9, 2, 1, { lore: ['ossuary'], items: [{ t: 'charm', id: 'crystal_guard', where: 'alcove' }, { t: 'wisp', where: 'floor', x: 0.4 }] }],
  ['t_crypt', 'Under-Crypt', 'veiledeye', 0, 10, 1, 1, { items: [{ t: 'glim', v: 200, where: 'alcove' }] }],
  ['t_arena', 'Sanctum of the Eye', 'veiledeye', -2, 10, 2, 1, { boss: 'oracle' }],
  // Gloamreach
  ['k_descent', 'Descent', 'gloamreach', 2, 4, 1, 1, { npcs: [{ id: 'quillon', x: 0.4 }], lore: [{ id: 'gloam', x: 0.75 }] }],
  ['k_hall', 'Hall of Unlit Kings', 'gloamreach', -1, 4, 3, 1, { items: [{ t: 'wisp', where: 'floor', x: 0.5 }, { t: 'mask', where: 'alcove' }] }],
  ['k_court', 'Court of Shadows', 'gloamreach', -2, 4, 1, 2, { npcs: [{ id: 'orla', x: 0.5 }], items: [{ t: 'vessel', where: 'high', x: 0.5 }] }],
  ['k_dark', 'The Deep Dark', 'gloamreach', -1, 5, 2, 1, { lore: ['first_wick'], items: [{ t: 'wisp', where: 'high', x: 0.6 }] }],
  ['k_bench', 'Last Candle', 'gloamreach', 1, 5, 2, 1, { bench: 0.3, npcs: [{ id: 'oro', x: 0.6, stage: 4 }], calm: true }],
  ['k_shrine', 'Shrine of the Oath', 'gloamreach', -2, 6, 1, 1, { npcs: [{ id: 'cask', x: 0.5, stage: 2 }], lore: [{ id: 'cask', x: 0.2 }] }],
  ['k_arena', 'Throne of the First Wick', 'gloamreach', -1, 6, 3, 1, { boss: 'gloamknight' }],
  ['k_secret', 'Ember Reliquary', 'gloamreach', 2, 6, 1, 1, { secret: true, items: [{ t: 'notch', where: 'floor', x: 0.5 }] }],
  // Heart of the Lantern
  ['f_gate', 'Inner Gate', 'heart', 0, -1, 2, 1, { lore: ['gate_inner'] }],
  ['f_ascent', 'The Long Ascent', 'heart', 0, -3, 2, 2, { items: [{ t: 'glim', v: 300, where: 'high', x: 0.3 }, { t: 'wisp', where: 'floor', x: 0.7 }] }],
  ['f_gallery', 'Gallery of Moths', 'heart', -2, -3, 2, 1, { lore: ['queen'] }],
  ['f_reliq', 'Reliquary', 'heart', 2, -2, 1, 1, { bench: 0.5, npcs: [{ id: 'vell', x: 0.2, stage: 4 }], calm: true }],
  ['f_spire', 'Spire of Light', 'heart', 0, -4, 2, 1, { lore: ['last'] }],
  ['f_throne', 'The Lantern\'s Heart', 'heart', -1, -5, 4, 1, { boss: 'ysolde' }],
];
LF.ROOMS = R.map(a => ({ id: a[0], name: a[1], region: a[2], x: a[3], y: a[4], w: a[5], h: a[6], f: a[7] || {} }));

// connections: [a, b, opts]  opts.at = cell coordinate along shared edge; gate:{type, in}
LF.CONNS = [
  ['h_secret', 'h_cliff', { secret: true }],
  ['h_cliff', 'h_town'], ['h_town', 'h_east'],
  ['h_town', 'r1_hall', { at: -1 }], ['h_town', 'r1_gallery', { at: 1 }],
  ['h_town', 'f_gate', { at: 0, gate: { type: 'key', in: 'h_town' } }],
  // Umbravale
  ['r1_hall', 'r1_stair'], ['r1_hall', 'r1_gallery'], ['r1_hall', 'r1_ante', { at: 0 }],
  ['r1_stair', 'm_edge', { gate: { type: 'gap', in: 'r1_stair' } }], ['r1_stair', 'r1_crypt'],
  ['r1_gallery', 'a_gate', { gate: { type: 'gap', in: 'r1_gallery' } }], ['r1_gallery', 'r1_shrine', { at: 2 }],
  ['r1_ante', 'r1_cistern'], ['r1_ante', 'r1_shrine'], ['r1_ante', 'r1_deep', { at: 1, gate: { type: 'veil', in: 'r1_ante' } }],
  ['r1_cistern', 'r1_crypt'], ['r1_cistern', 'r1_arena', { at: -1 }],
  ['r1_crypt', 'r1_arena', { at: 3 }],
  ['r1_deep', 'k_descent', { at: 2 }],
  // Mossdeep
  ['m_edge', 'm_canopy'], ['m_edge', 'm_bench'], ['m_canopy', 'm_roots'], ['m_canopy', 'm_glade', { at: -4 }],
  ['m_roots', 'm_glade', { at: 2 }], ['m_glade', 'm_bench'], ['m_roots', 'm_burrow'], ['m_burrow', 'm_arena'],
  ['m_glade', 'm_arena', { at: -5 }], ['m_arena', 'm_well'],
  ['m_well', 'g_mouth', { gate: { type: 'climb', in: 'm_well' } }],
  ['m_secret', 'm_roots', { at: 1, secret: true }],
  // Aurel
  ['a_gate', 'a_colonnade'], ['a_gate', 'a_bench'], ['a_colonnade', 'a_spire', { at: 1 }], ['a_colonnade', 'a_library', { at: 5 }],
  ['a_spire', 'a_library', { at: 2 }], ['a_spire', 'a_secret', { at: 1, secret: true }], ['a_library', 'a_bench'],
  ['a_library', 'a_arena', { at: 4 }], ['a_arena', 'a_vault'], ['a_vault', 'a_spire', { at: 6 }],
  ['a_vault', 'c_stair', { at: 5, gate: { type: 'seal', in: 'a_vault' } }],
  // Glasswyrm
  ['g_mouth', 'g_hall'], ['g_hall', 'g_geode'], ['g_geode', 'g_secret', { secret: true }], ['g_hall', 'g_shaft', { at: -5 }],
  ['g_shaft', 'g_bench', { at: 5 }], ['g_shaft', 'g_arena', { at: 6 }], ['g_shaft', 'g_depths', { at: 6 }],
  ['g_depths', 'l_shore', { at: -6, gate: { type: 'crystal', in: 'g_depths' } }],
  // Quiet Bells
  ['c_stair', 'c_avenue'], ['c_stair', 'c_belfry'], ['c_avenue', 'c_plaza', { at: 4 }], ['c_plaza', 'c_tower', { at: 5 }],
  ['c_tower', 'c_bench', { at: 5 }], ['c_belfry', 'c_bench', { at: 6 }], ['c_bench', 'c_secret', { secret: true }],
  ['c_tower', 'c_arena', { at: 6 }], ['c_tower', 'c_aqueduct', { at: 6 }],
  ['c_aqueduct', 'v_vent', { at: 7, gate: { type: 'thorn', in: 'c_aqueduct' } }],
  // Mirrorlake
  ['l_shore', 'l_reeds'], ['l_shore', 'l_mirror', { at: -5 }], ['l_reeds', 'l_grotto', { at: -4 }], ['l_grotto', 'l_mirror'],
  ['l_grotto', 'l_bench'], ['l_mirror', 'l_sunk', { at: -6 }], ['l_sunk', 'l_arena'], ['l_sunk', 'l_secret', { secret: true }],
  ['l_reeds', 't_flooded', { gate: { type: 'water', in: 'l_reeds' } }],
  // Cinderdeep
  ['v_vent', 'v_ash'], ['v_ash', 'v_flow'], ['v_flow', 'v_forge'], ['v_flow', 'v_chasm', { at: 4 }],
  ['v_chasm', 'v_bench', { at: 8 }], ['v_bench', 'v_secret', { secret: true }], ['v_chasm', 'v_arena', { at: 9 }],
  ['v_forge', 'v_lower', { gate: { type: 'slam', in: 'v_forge' } }], ['v_lower', 't_portico'],
  // Veiled Eye
  ['t_flooded', 't_cloister'], ['t_cloister', 't_portico', { at: 1 }], ['t_portico', 't_nave', { at: 8 }],
  ['t_nave', 't_bench', { at: 8 }], ['t_bench', 't_secret', { secret: true }], ['t_nave', 't_ossuary', { at: 9 }],
  ['t_nave', 't_crypt', { gate: { type: 'slam', in: 't_nave' } }], ['t_crypt', 't_arena', { gate: { type: 'water', in: 't_crypt' } }],
  ['t_flooded', 'k_arena', { at: -1, gate: { type: 'veil', in: 't_flooded' } }],
  // Gloamreach
  ['k_descent', 'k_hall'], ['k_hall', 'k_court', { at: 4 }], ['k_hall', 'k_dark', { at: -1 }],
  ['k_court', 'k_dark', { at: 5 }], ['k_dark', 'k_bench'], ['k_dark', 'k_arena', { at: 0 }], ['k_court', 'k_shrine'],
  ['k_shrine', 'k_arena'], ['k_arena', 'k_secret', { secret: true }],
  // Heart
  ['f_gate', 'f_ascent', { at: 1 }], ['f_ascent', 'f_gallery', { at: -3 }], ['f_ascent', 'f_reliq', { at: -2 }],
  ['f_ascent', 'f_spire', { at: 0 }], ['f_spire', 'f_throne', { at: 1 }],
];

// ------------------------------------------------------------------ SHOP STOCK
LF.SHOPS = {
  mirelle: [
    { t: 'charm', id: 'compass', price: 120 }, { t: 'charm', id: 'quickstep', price: 220 }, { t: 'charm', id: 'magpie', price: 260 },
    { t: 'mask', key: 'shop_mask1', price: 280 }, { t: 'vessel', key: 'shop_vessel1', price: 380 }, { t: 'charm', id: 'steady', price: 320 },
    { t: 'charm', id: 'featherfall', price: 360 }, { t: 'notch', key: 'shop_notch1', price: 450 }, { t: 'charm', id: 'patient', price: 480, req: 1 },
    { t: 'charm', id: 'soulcatcher', price: 650, req: 2 }, { t: 'mask', key: 'shop_mask2', price: 750, req: 3 }, { t: 'vessel', key: 'shop_vessel2', price: 900, req: 4 },
    { t: 'charm', id: 'gambler', price: 950, req: 4 }, { t: 'notch', key: 'shop_notch2', price: 1300, req: 5 },
  ],
  penna: [
    { t: 'pins', id: 'bench', price: 60, name: 'Bench Pins', desc: 'Marks every rest bench you have found on your map.' },
    { t: 'pins', id: 'npc', price: 90, name: 'Wanderer Pins', desc: 'Marks merchants, travellers and other folk on your map.' },
    { t: 'pins', id: 'items', price: 650, name: 'Seeker\'s Ink', desc: 'A strange ink that shows treasures still waiting in the rooms you have explored.' },
  ],
};
LF.MAP_PRICES = { umbravale: 60, mossdeep: 90, aurel: 90, glasswyrm: 120, quietbells: 120, mirrorlake: 150, cinderdeep: 150, veiledeye: 180, gloamreach: 200, heart: 0 };
LF.NAIL = [
  { name: 'Ember Pin', dmg: 5 }, { name: 'Tempered Pin', dmg: 8, price: 250, ore: 0 }, { name: 'Honed Needle', dmg: 11, price: 600, ore: 1 },
  { name: 'Lumen Needle', dmg: 14, price: 1200, ore: 1 }, { name: 'Lanternblade', dmg: 18, price: 2000, ore: 2 },
];
LF.WISP_REWARDS = [
  { n: 3, t: 'glim', v: 150 }, { n: 6, t: 'mask', key: 'elder_mask' }, { n: 10, t: 'charm', id: 'spirit_kin' }, { n: 14, t: 'vessel', key: 'elder_vessel' },
  { n: 18, t: 'ore', key: 'elder_ore' }, { n: 21, t: 'notch', key: 'elder_notch' }, { n: 24, t: 'charm', id: 'wicks_lament' },
];
