// Rootbound — game content. Card art comes from the concept sheets in assets/cards;
// cards marked `draft` have no printed art yet and are rendered from tile art.

export const RES = ['food', 'wood', 'metal', 'crystal', 'essence', 'artifact'];
export const RES_LABEL = { food: 'Food', wood: 'Wood', metal: 'Metal', crystal: 'Crystal', essence: 'Essence', artifact: 'Artifact' };
// Backpack: 5 slots; each slot stacks this many of one resource.
export const STACK = { food: 3, wood: 3, metal: 2, crystal: 2, essence: 2, artifact: 1 };
export const BAG_SLOTS = 5;
export const BAG_SLOTS_UPGRADED = 7;
export const MAX_LIVES = 2;
export const HORROR_MAX = 20;

export const BIOMES = {
  workshop:  { name: 'The Workshop',    cost: 1, hue: '#d9a441', art: 1 },
  forest:    { name: 'Forest',          cost: 1, hue: '#9bb83a', art: 1, yields: [{ wood: 2 }, { food: 2 }] },
  ruins:     { name: 'Ruins',           cost: 1, hue: '#d8c49a', art: 1, yields: [{ metal: 2 }, { metal: 1, wood: 1 }] },
  crystal:   { name: 'Crystal Fields',  cost: 1, hue: '#a35cff', art: 1, yields: [{ crystal: 2 }, { essence: 1 }] },
  swamp:     { name: 'Swamp',           cost: 2, hue: '#5fa3a0', art: 1, yields: [{ food: 2 }, { essence: 1 }] },
  highlands: { name: 'Highlands',       cost: 2, hue: '#8fa9c8', art: 1, yields: [{ metal: 1, wood: 1 }] },
  corrupted: { name: 'Corrupted Lands', cost: 2, hue: '#d23a5a', art: 1, yields: [{ essence: 1 }] },
};

// 36 exploration tiles around the single Workshop tile (radius-3 hex map = 37 hexes).
export const TILE_MIX = { forest: 13, ruins: 6, crystal: 6, swamp: 5, highlands: 4, corrupted: 2 };
// Full game: radius-4 map, the Workshop plus 60 exploration tiles (61 hexes).
export const TILE_MIX_FULL = { forest: 20, ruins: 9, crystal: 9, swamp: 9, highlands: 8, corrupted: 5 };
export const MODES = {
  standard: { name: 'Standard', radius: 3, mix: TILE_MIX, outposts: 2, text: '37 hexes' },
  full:     { name: 'Full game', radius: 4, mix: TILE_MIX_FULL, outposts: 4, text: '61 hexes' },
};
// Outposts: forward bases with a small store, a place to Rest, and fast travel (1 move) to the
// Workshop and every other Outpost. Corruption reaching one destroys it and what it holds.
export const OUTPOST = { cost: { wood: 2, metal: 1 }, capacity: 6 };

export const CHARACTERS = {
  mushy: {
    name: 'Mushy', role: 'The Scout', quote: 'Every path has a story.',
    cap: '#c8352b', spots: '#f6efe2', tunic: '#3f6b4a', base: '#c8352b', model: 'models/mushy.gltf.json?v=20', turn: -1.66,
    ability: 'Trailblazer', abilityText: 'The first difficult hex you enter each turn costs only 1 movement.',
    levels: [
      { name: 'Long Strides', text: '+1 movement whenever you set out.', cost: { food: 2, essence: 1 }, rep: 2 },
      { name: 'Pathfinder', text: 'Each tile you reveal also reveals one unexplored tile beside it.', cost: { food: 2, essence: 2, crystal: 1 }, rep: 3 },
    ],
  },
  bramblecap: {
    name: 'Bramblecap', role: 'The Trapper', quote: 'The forest teaches those who listen.',
    cap: '#a8642c', spots: '#e9c99a', tunic: '#5b6b2f', base: '#d08a3a', model: 'models/bramblecap.gltf.json?v=20', turn: -1.66,
    ability: 'Snares Ready', abilityText: 'Rolls 1 extra attack die when fighting a monster.',
    levels: [
      { name: 'Hunter\u2019s Hide', text: 'Wound results never hurt you when you attack.', cost: { wood: 2, metal: 1 }, rep: 2 },
      { name: 'Killing Blow', text: 'Your attacks deal +1 damage if any die hits.', cost: { wood: 2, metal: 2, crystal: 1 }, rep: 3 },
    ],
  },
  morella: {
    name: 'Morella', role: 'The Dreamwalker', quote: 'There is more than what we see.',
    cap: '#6b3f8f', spots: '#c9b2e6', tunic: '#3d2f5c', base: '#8f5fc4', model: 'models/morella.gltf.json?v=20', turn: -2.06,
    ability: 'Dreamsight', abilityText: 'When you Search, draw 2 Discovery cards and keep 1.',
    levels: [
      { name: 'Lucid Path', text: 'Your first Search each turn costs no decision.', cost: { essence: 2, crystal: 1 }, rep: 2 },
      { name: 'Dream Ward', text: 'Corruption never costs you a life at the end of your turn (only Essence).', cost: { essence: 2, crystal: 2, food: 1 }, rep: 3 },
    ],
  },
  sporewick: {
    name: 'Sporewick', role: 'The Alchemist', quote: 'Curiosity builds a brighter world.',
    cap: '#d9a520', spots: '#f3df9a', tunic: '#6b5a2a', base: '#e2b93b', model: 'models/sporewick.gltf.json?v=20', turn: -1.27,
    ability: 'Field Tonics', abilityText: 'Can Rest anywhere, not only at the Workshop. Cleanse costs no Essence.',
    levels: [
      { name: 'Remedy', text: 'Spend a decision to heal a friend on your tile by 1 life.', cost: { crystal: 1, essence: 2 }, rep: 2 },
      { name: 'Transmute', text: 'Once per turn, anywhere: turn 2 of one resource into 1 of another.', cost: { crystal: 2, essence: 2, metal: 1 }, rep: 3 },
    ],
  },
  thorncap: {
    name: 'Thorncap', role: 'The Guardian', quote: 'Stand behind me.',
    cap: '#4f7a3a', spots: '#c9d98f', tunic: '#5a4a3a', base: '#6f9a3e', model: 'models/thorncap.gltf.json?v=20', turn: -1.27,
    ability: 'Shield Wall', abilityText: 'When a monster steps onto your tile, only you get hurt. Friends beside you are spared.',
    levels: [
      { name: 'Stalwart', text: 'Rolls 1 extra attack die when fighting a monster.', cost: { metal: 2, wood: 1 }, rep: 2 },
      { name: 'Hold the Line', text: 'Monsters can no longer step onto your tile.', cost: { metal: 2, wood: 2, crystal: 1 }, rep: 3 },
    ],
  },
};
export const MAX_SEATS = 5;

// Movement-die faces → flat-top hex directions. 1 = North on the tile, then clockwise.
export const DIRS = [
  { n: 1, name: 'North',      dq: 0,  dr: -1 },
  { n: 2, name: 'North-east', dq: 1,  dr: -1 },
  { n: 3, name: 'South-east', dq: 1,  dr: 0 },
  { n: 4, name: 'South',      dq: 0,  dr: 1 },
  { n: 5, name: 'South-west', dq: -1, dr: 1 },
  { n: 6, name: 'North-west', dq: -1, dr: 0 },
];

// Attack ("risk") die.
export const RISK_FACES = ['hit', 'hit', 'double', 'shield', 'wound', 'panic'];
export const RISK_LABEL = { hit: 'Hit', double: 'Double Hit', shield: 'Shield', wound: 'Wound', panic: 'Panic' };

export const MONSTERS = {
  'corrupted-wolf':    { name: 'Corrupted Wolf',    hp: 2, card: 'corrupted-wolf', model: 'models/corrupted-wolf.gltf.json?v=20', turn: -2.84, size: 0.8 },
  // model: sculpted figure (Tripo); size: its largest dimension on the table; turn: yaw so it faces the players
  'blighted-mushroom': { name: 'Blighted Mushroom', hp: 3, card: 'blighted-mushroom', model: 'models/blighted-mushroom.gltf.json?v=20', turn: 0, size: 0.78 },
  'shadow-stalker':    { name: 'Shadow Stalker',    hp: 4, card: 'shadow-stalker', model: 'models/shadow-stalker.gltf.json?v=20', turn: -0.49, size: 0.9 },
  'crystal-husk':      { name: 'Crystal Husk',      hp: 4, card: 'crystal-husk', model: 'models/crystal-husk.gltf.json?v=20', turn: -1.27, size: 0.8 },
  'root-king':         { name: 'The Root King',     hp: 6, card: 'root-king', boss: true, model: 'models/root-king.gltf.json?v=20', turn: -1.27, size: 1.3 },
};
// Spawn order: early monsters are weaker.
export const SPAWN_ORDER = ['corrupted-wolf', 'blighted-mushroom', 'corrupted-wolf', 'shadow-stalker', 'crystal-husk', 'blighted-mushroom', 'shadow-stalker', 'crystal-husk'];

export const SCENARIOS = {
  skyship: {
    name: 'The Skyship', art: 'ui/skyship.jpg',
    goal: 'Build all four parts, then gather every standing Mushroomfolk at the Workshop with 1 Food each in storage for the voyage, and Launch.',
    parts: [
      { id: 'hull',   name: 'Hull',            cost: { wood: 3, metal: 1 } },
      { id: 'sails',  name: 'Lift Sails',      cost: { wood: 2, essence: 1 } },
      { id: 'engine', name: 'Crystal Engine',  cost: { metal: 2, crystal: 2 } },
      { id: 'core',   name: 'Navigation Core', cost: { crystal: 1, artifact: 1 } },
    ],
  },
  'weather-engine': {
    name: 'The Weather Engine', art: 'ui/weather-engine.jpg',
    goal: 'Build all four parts. Two Pylon sites then light up out in the wild: keep a Mushroomfolk on each clean Pylon at the end of 3 rounds.',
    parts: [
      { id: 'north',      name: 'North Pylon', cost: { crystal: 2, metal: 1 } },
      { id: 'south',      name: 'South Pylon', cost: { crystal: 2, metal: 1 } },
      { id: 'stabilizer', name: 'Stabilizer',  cost: { essence: 2, metal: 1 } },
      { id: 'core',       name: 'Storm Core',  cost: { crystal: 1, artifact: 1 } },
    ],
  },
  'monster-cage': {
    name: 'The Monster Cage', art: 'ui/monster-cage.jpg',
    goal: 'Build all four parts. The finished Cage calls the Root King out of the dark: bring it down to capture it. Without the Cage it cannot be held.',
    parts: [
      { id: 'frame', name: 'Reinforced Frame', cost: { wood: 3, metal: 2 } },
      { id: 'bars',  name: 'Crystal Bars',     cost: { crystal: 3, metal: 1 } },
      { id: 'locks', name: 'Rune Locks',       cost: { essence: 2, crystal: 1 } },
      { id: 'seal',  name: 'Containment Seal', cost: { artifact: 1, essence: 1 } },
    ],
  },
};

// Shared Workshop improvements (one each per game).
export const WORKSHOP = {
  watchtower: { name: 'Watchtower',       cost: { wood: 2, crystal: 1 },             text: 'Reveals the 3 unexplored tiles nearest the Workshop.' },
  furnace:    { name: 'Crystal Furnace',  cost: { metal: 2, crystal: 1 },            text: 'At the Workshop, once per turn: turn 2 of one resource into 1 of another.' },
  archive:    { name: 'Rune Archive',     cost: { wood: 1, essence: 2 },             text: 'Every Search draws 1 extra card to choose from.' },
  beacon:     { name: 'Emergency Beacon', cost: { metal: 1, crystal: 1, essence: 1 }, text: 'From the Workshop, spend a decision to bring a Lost friend home with 1 life.' },
};

// Field crafting: anywhere, 1 decision, paid from your backpack (plus storage at the Workshop).
export const CRAFTS = {
  bandage: { name: 'Bandage',       cost: { food: 1, essence: 1 },  text: 'Heal 1 life.' },
  snare:   { name: 'Snare Trap',    cost: { wood: 1, metal: 1 },    text: 'Set on your tile. The next monster to step in stops dead, takes 1 damage, and is stuck there for the next round too.' },
  flare:   { name: 'Crystal Flare', cost: { crystal: 1 },           text: 'Reveal an unexplored tile next to you.' },
};

export const UPGRADES = {
  backpack: { name: 'Reinforced Backpack', cost: { wood: 1, metal: 1 }, rep: 2, text: 'Backpack grows from 5 to 7 slots.' },
};

// ---------------- Discovery cards ----------------
// type: resource | ally | enemy | relic | event.  fx: list of effects (see engine.applyFx).
// `note` explains where the app's rule differs from the printed card.
const C = (id, title, type, fx, extra = {}) => ({ id, title, type, fx, img: `cards/${id}.jpg`, ...extra });
const D = (id, title, type, biome, flavor, text, art, fx, extra = {}) =>
  ({ id, title, type, fx, draft: { biome, flavor, text, art }, ...extra });

export const CARDS = {
  // Forest
  'discovery-trail':   C('discovery-trail', 'Discovery Trail', 'resource', [{ gain: { essence: 1, wood: 1 } }]),
  'supply-cache':      C('supply-cache', 'Supply Cache', 'resource', [{ gain: { wood: 2, food: 1 } }]),
  'hidden-village':    C('hidden-village', 'Hidden Village', 'resource', [{ gain: { wood: 1, food: 1, metal: 1 } }]),
  'crystal-vein':      C('crystal-vein', 'Crystal Vein', 'resource', [{ gain: { crystal: 2 } }],
                        { note: 'Updated card: now gives 2 Crystal (reprint pending).' }),
  'essence-vein':      { ...C('crystal-vein', 'Essence Vein', 'resource', [{ gain: { essence: 2 } }]), id: 'essence-vein',
                        note: 'Updated card: renamed Essence Vein (reprint pending).' },
  'mushroom-forge':    C('mushroom-forge', 'Mushroom Forge', 'resource', [{ gain: { metal: 2, essence: 1 } }]),
  'whispering-spirit': C('whispering-spirit', 'Whispering Spirit', 'ally', [{ gain: { essence: 1 } }, { draw: 1 }]),
  'night-journey':     C('night-journey', 'Night Journey', 'event', [{ mp: 2 }, { draw: 1 }]),
  'luminous-fields':   C('luminous-fields', 'Luminous Fields', 'event', [{ allGain: { essence: 1 } }],
                        { note: 'In the app: every player gains 1 Essence (no discard piles yet).' }),
  'forest-wraith':     C('forest-wraith', 'Forest Wraith', 'enemy', [{ allLose: { wood: 1, food: 1 } }]),
  'forest-shrine':     C('forest-shrine', 'Forest Shrine', 'resource', [{ choice: [
                          { label: 'Gain 1 Essence', fx: [{ gain: { essence: 1 } }] },
                          { label: '+1 Reputation', fx: [{ rep: 1 }] }] }]),
  'rootbound':         C('rootbound', 'Rootbound', 'relic', [{ gain: { essence: 3, wood: 2, food: 2 } }, { draw: 2 }]),
  'mushroom-scout':    C('mushroom-scout', 'Mushroom Scout', 'ally', [{ gain: { food: 1 } }, { mp: 2 }]),
  'forest-stag':       C('forest-stag', 'Forest Stag', 'ally', [{ gain: { wood: 1, essence: 1 } }, { sureFooted: true }]),
  'ancient-treant':    C('ancient-treant', 'Ancient Treant', 'ally', [{ gain: { wood: 2 } }, { mp: 1 }],
                        { note: 'In the app: you gain +1 movement.' }),
  'glade-spirit':      C('glade-spirit', 'Glade Spirit', 'ally', [{ gain: { essence: 1 } }, { peek: 2 }]),
  // Ruins
  'forgotten-workshop':C('forgotten-workshop', 'Forgotten Workshop', 'resource', [{ gain: { metal: 1, wood: 1 } }]),
  'ancient-ruin':      C('ancient-ruin', 'Ancient Ruin', 'resource', [{ gain: { metal: 1, essence: 1 } }]),
  'ancient-monolith':  C('ancient-monolith', 'Ancient Monolith', 'resource', [{ gain: { essence: 1, metal: 1 } }, { draw: 1 }]),
  'forest-relic':      C('forest-relic', 'Ancient Relic', 'relic', [{ gain: { essence: 1, metal: 1 } }, { rep: 1 }],
                        { note: 'Updated card: renamed Ancient Relic (reprint pending). Relics give +1 Reputation.' }),
  'stone-guardian':    C('stone-guardian', 'Stone Guardian', 'ally', [{ gain: { metal: 1 } }, { endMove: true }],
                        { note: 'In the app: the Guardian halts you here (movement ends) and offers 1 Metal.' }),
  'lost-vault':        D('lost-vault', 'Lost Vault', 'relic', 'Ruins', 'Behind the waterfall, a door that remembers.',
                        'Gain 1 Artifact. +1 Reputation.', 'cardart/ruins_3.jpg', [{ gain: { artifact: 1 } }, { rep: 1 }]),
  'clockwork-remnant': D('clockwork-remnant', 'Clockwork Remnant', 'relic', 'Ruins', 'Its gears still turn, very slowly.',
                        'Gain 1 Artifact and 1 Metal. +1 Reputation.', 'cardart/ruins_2.jpg', [{ gain: { artifact: 1, metal: 1 } }, { rep: 1 }]),
  // Crystal Fields
  'crystal-bloom':     C('crystal-bloom', 'Crystal Bloom', 'resource', [{ choice: [
                          { label: 'Gain 2 Crystal', fx: [{ gain: { crystal: 2 } }] },
                          { label: 'Leave them: +1 Reputation', fx: [{ rep: 1 }] }] }]),
  'prism-heart':       D('prism-heart', 'Prism Heart', 'relic', 'Crystal Fields', 'A crystal that beats like a heart.',
                        'Gain 1 Artifact. +1 Reputation.', 'cardart/crystal_1.jpg', [{ gain: { artifact: 1 } }, { rep: 1 }]),
  'singing-shards':    D('singing-shards', 'Singing Shards', 'resource', 'Crystal Fields', 'They hum the note of the deep.',
                        'Gain 1 Crystal and 1 Essence.', 'cardart/crystal_2.jpg', [{ gain: { crystal: 1, essence: 1 } }]),
  // Swamp
  'marsh-larder':      D('marsh-larder', 'Marsh Larder', 'resource', 'Swamp', 'Someone stocked this hollow long ago.',
                        'Gain 2 Food.', 'cardart/swamp_1.jpg', [{ gain: { food: 2 } }]),
  'sunken-hollow':     D('sunken-hollow', 'Sunken Hollow', 'resource', 'Swamp', 'Glowcaps grow where the water stills.',
                        'Gain 1 Food and 1 Essence.', 'cardart/swamp_2.jpg', [{ gain: { food: 1, essence: 1 } }]),
  'willow-lantern':    D('willow-lantern', 'Willow Lantern', 'ally', 'Swamp', 'A light that walks ahead of you.',
                        'Gain 1 Essence. +1 movement this turn.', 'cardart/swamp_3.jpg', [{ gain: { essence: 1 } }, { mp: 1 }]),
  'mire-hermit':       D('mire-hermit', 'Mire Hermit', 'ally', 'Swamp', 'Tea, a blanket, and no questions.',
                        'Heal 1 life. Gain 1 Food.', 'cardart/swamp_1.jpg', [{ heal: 1 }, { gain: { food: 1 } }]),
  'bog-lurker':        D('bog-lurker', 'Bog Lurker', 'enemy', 'Swamp', 'The reeds part. Something was waiting.',
                        'Lose 2 Food.', 'cardart/swamp_2.jpg', [{ lose: { food: 2 } }], { corrupt: true }),
  // Highlands
  'ridge-ore':         D('ridge-ore', 'Ridge Ore', 'resource', 'Highlands', 'Silver threads in the old stone.',
                        'Gain 2 Metal.', 'cardart/highlands_2.jpg', [{ gain: { metal: 2 } }]),
  'cliffside-cache':   D('cliffside-cache', 'Cliffside Cache', 'resource', 'Highlands', 'A climber’s stash, still dry.',
                        'Gain 1 Metal, 1 Wood and 1 Food.', 'cardart/highlands_1.jpg', [{ gain: { metal: 1, wood: 1, food: 1 } }]),
  'eagles-view':       D('eagles-view', 'Eagle’s View', 'ally', 'Highlands', 'From up here, the forest has edges.',
                        'Reveal 2 unexplored tiles next to explored land.', 'cardart/highlands_3.jpg', [{ reveal: 2 }]),
  'rockslide':         D('rockslide', 'Rockslide', 'enemy', 'Highlands', 'The mountain shrugs.',
                        'Lose 1 Wood. Your movement ends.', 'cardart/highlands_2.jpg', [{ lose: { wood: 1 } }, { endMove: true }], { corrupt: true }),
  // Blight (drawn on corrupted tiles, Corrupted Lands, and repeat searches)
  'corrupted-grove':   C('corrupted-grove', 'Corrupted Grove', 'event', [{ lose: { wood: 1 } }, { allLoseRandom: 1 }],
                        { corrupt: true, note: 'In the app: “discard 1 card” becomes “lose 1 random resource”.' }),
  'shadow-rift':       C('shadow-rift', 'Shadow Rift', 'event', [{ spawn: 'elite' }, { corruptAdjacent: 1 }], { corrupt: true }),
  'ruined-gateway':    C('ruined-gateway', 'Ruined Gateway', 'event', [{ allLose: { metal: 1 } }], { corrupt: true }),
  'root-ambush':       C('root-ambush', 'Root Ambush', 'event', [{ allLose: { food: 1 } }, { drawIfWood: true }], { corrupt: true }),
};

// New cards from the Rootbound Card Catalogue (drafts until their art is made).
const CX = { corrupt: true };
Object.assign(CARDS, {
  'strawberry-patch': D('strawberry-patch', 'Wild Strawberry Patch', 'resource', 'Forest', 'Sweet, and only a little bit poisonous.', 'Gain 3 Food.', 'cardart/forest_1.jpg', [{ gain: { food: 3 } }]),
  'deepwood-owl':     D('deepwood-owl', 'Owl of the Deep Wood', 'ally', 'Forest', 'She has watched this forest for a thousand winters.', 'Reveal 1 unexplored tile. +1 Reputation.', 'cardart/forest_3.jpg', [{ reveal: 1 }, { rep: 1 }]),
  'bramble-thicket':  D('bramble-thicket', 'Bramble Thicket', 'enemy', 'Forest', 'The path closes behind you.', 'Lose 1 Food. Your movement ends.', 'cardart/forest_2.jpg', [{ lose: { food: 1 } }, { endMove: true }], CX),
  'gearsmith-toolbox':D('gearsmith-toolbox', 'Gearsmith\u2019s Toolbox', 'resource', 'Ruins', 'Every tool still oiled, as if its owner just stepped out.', 'Gain 2 Metal and 1 Wood.', 'cardart/ruins_1.jpg', [{ gain: { metal: 2, wood: 1 } }]),
  'sunken-reliquary': D('sunken-reliquary', 'Sunken Reliquary', 'relic', 'Ruins', 'Some treasures are guarded.', 'Gain 1 Artifact. +1 Reputation. A Corrupted Wolf appears beside you.', 'cardart/ruins_3.jpg', [{ gain: { artifact: 1 } }, { rep: 1 }, { spawn: 'corrupted-wolf' }]),
  'rust-mites':       D('rust-mites', 'Rust Mites', 'enemy', 'Ruins', 'A crunching sound from inside your backpack.', 'Lose 2 Metal.', 'cardart/ruins_2.jpg', [{ lose: { metal: 2 } }], CX),
  'collapsing-arch':  D('collapsing-arch', 'Collapsing Arch', 'enemy', 'Ruins', 'The ruin finally gives way.', 'Lose 1 life.', 'cardart/ruins_1.jpg', [{ life: -1 }], CX),
  'resonant-geode':   D('resonant-geode', 'Resonant Geode', 'resource', 'Crystal Fields', 'It hums a little louder when you smile.', 'Gain 2 Crystal.', 'cardart/crystal_2.jpg', [{ gain: { crystal: 2 } }]),
  'moonlit-pool':     D('moonlit-pool', 'Moonlit Pool', 'ally', 'Crystal Fields', 'The water remembers what you were before you were tired.', 'Heal 1 life. Gain 1 Essence.', 'cardart/crystal_3.jpg', [{ heal: 1 }, { gain: { essence: 1 } }]),
  'starfall-relic':   D('starfall-relic', 'Starfall Relic', 'relic', 'Crystal Fields', 'It fell from the sky the night the forest was born.', 'Gain 1 Artifact and 1 Crystal. +1 Reputation.', 'cardart/crystal_1.jpg', [{ gain: { artifact: 1, crystal: 1 } }, { rep: 1 }]),
  'shard-swarm':      D('shard-swarm', 'Shard Swarm', 'enemy', 'Crystal Fields', 'Tiny crystal beetles, all teeth.', 'Lose 1 Crystal and 1 Essence.', 'cardart/crystal_2.jpg', [{ lose: { crystal: 1, essence: 1 } }], CX),
  'crystal-fracture': D('crystal-fracture', 'Crystal Fracture', 'event', 'Crystal Fields', 'Beauty, cracking open.', 'Corrupt a tile next to you. Gain 1 Crystal.', 'cardart/crystal_3.jpg', [{ corruptAdjacent: 1 }, { gain: { crystal: 1 } }], CX),
  'frog-ferry':       D('frog-ferry', 'Frog Ferry', 'ally', 'Swamp', 'Hop on. Mind the tongue.', '+2 movement. Difficult terrain costs 1 this turn.', 'cardart/swamp_1.jpg', [{ mp: 2 }, { sureFooted: true }]),
  'will-o-wisp':      D('will-o-wisp', 'Will-o\u2019-Wisp', 'event', 'Swamp', 'A light where no light should be.', 'Choose: follow it (+2 movement, draw another card), or let it go (+1 Reputation).', 'cardart/swamp_2.jpg', [{ choice: [
                        { label: 'Follow it: +2 movement, draw again', fx: [{ mp: 2 }, { draw: 1 }] },
                        { label: 'Let it go: +1 Reputation', fx: [{ rep: 1 }] }] }]),
  'drowned-lantern':  D('drowned-lantern', 'Drowned Lantern', 'relic', 'Swamp', 'Still burning, deep under the water.', 'Gain 1 Artifact. +1 Reputation.', 'cardart/swamp_3.jpg', [{ gain: { artifact: 1 } }, { rep: 1 }]),
  'peat-camp':        D('peat-camp', 'Peat Cutters\u2019 Camp', 'resource', 'Swamp', 'Abandoned in a hurry. Their stew is still warm.', 'Gain 1 Wood and 2 Food.', 'cardart/swamp_1.jpg', [{ gain: { wood: 1, food: 2 } }]),
  'leech-pool':       D('leech-pool', 'Leech Pool', 'enemy', 'Swamp', 'You feel lighter. Much lighter.', 'Lose 1 Food and 1 Essence.', 'cardart/swamp_2.jpg', [{ lose: { food: 1, essence: 1 } }], CX),
  'marsh-gas':        D('marsh-gas', 'Marsh Gas', 'event', 'Swamp', 'The bubbles smell of rot and old magic.', 'Every player loses 1 Essence.', 'cardart/swamp_3.jpg', [{ allLose: { essence: 1 } }], CX),
  'hidden-spring':    D('hidden-spring', 'Hidden Spring', 'resource', 'Highlands', 'Cold enough to make your cap curl.', 'Gain 2 Food. Heal 1 life.', 'cardart/highlands_1.jpg', [{ gain: { food: 2 } }, { heal: 1 }]),
  'rocs-nest':        D('rocs-nest', 'Roc\u2019s Nest', 'resource', 'Highlands', 'It collects shiny things. So do you.', 'Gain 1 Crystal and 1 Metal.', 'cardart/highlands_2.jpg', [{ gain: { crystal: 1, metal: 1 } }]),
  'wind-nymph':       D('wind-nymph', 'Wind Nymph', 'ally', 'Highlands', 'She laughs, and the wind laughs with her.', '+3 movement. Reveal 1 unexplored tile.', 'cardart/highlands_3.jpg', [{ mp: 3 }, { reveal: 1 }]),
  'peak-shrine':      D('peak-shrine', 'Peak Shrine', 'relic', 'Highlands', 'Built where the sky is closest.', 'Gain 1 Artifact. +1 Reputation.', 'cardart/highlands_3.jpg', [{ gain: { artifact: 1 } }, { rep: 1 }]),
  'thunder-roc':      D('thunder-roc', 'Thunder Roc', 'enemy', 'Highlands', 'A shadow the size of a hill.', 'Lose 1 life.', 'cardart/highlands_2.jpg', [{ life: -1 }], CX),
  'frostbite':        D('frostbite', 'Frostbite', 'enemy', 'Highlands', 'The cold gets in through the gaps in your boots.', 'Lose 1 Food and 1 Wood. Your movement ends.', 'cardart/highlands_1.jpg', [{ lose: { food: 1, wood: 1 } }, { endMove: true }]),
  'grasping-roots':   D('grasping-roots', 'Grasping Roots', 'event', 'Blight', 'They have been waiting a long time.', 'Lose 1 Wood. Your movement ends.', 'cardart/corrupted_1.jpg', [{ lose: { wood: 1 } }, { endMove: true }], CX),
  'spore-plague':     D('spore-plague', 'Spore Plague', 'event', 'Blight', 'Every cough is a little grey cloud.', 'Every player loses 1 Food. Corruption spreads once.', 'cardart/corrupted_2.jpg', [{ allLose: { food: 1 } }, { spread: 1 }], CX),
  'rootling-swarm':   D('rootling-swarm', 'Rootling Swarm', 'event', 'Blight', 'The ground boils with little roots, then something bigger.', 'A Corrupted Wolf appears beside you.', 'cardart/corrupted_3.jpg', [{ spawn: 'corrupted-wolf' }], CX),
  'whispers-dark':    D('whispers-dark', 'Whispers in the Dark', 'event', 'Blight', 'It knows your name. It tells the others.', 'Lose 1 Reputation. Corruption spreads once.', 'cardart/corrupted_1.jpg', [{ rep: -1 }, { spread: 1 }], CX),
  'hollow-echo':      D('hollow-echo', 'Hollow Echo', 'enemy', 'Blight', 'Your own voice calls you from the trees.', 'Lose 2 random resources.', 'cardart/corrupted_2.jpg', [{ loseRandom: 2 }], CX),
  'withered-ward':    D('withered-ward', 'Withered Ward', 'event', 'Blight', 'Something old protected this place. Not any more.', 'Corrupt a tile next to you. Gain 1 Essence.', 'cardart/corrupted_3.jpg', [{ corruptAdjacent: 1 }, { gain: { essence: 1 } }], CX),
});

export const DECKS = {
  forest: ['discovery-trail', 'supply-cache', 'supply-cache', 'hidden-village', 'essence-vein', 'whispering-spirit',
           'mushroom-scout', 'forest-stag', 'ancient-treant', 'forest-shrine', 'mushroom-forge', 'night-journey',
           'luminous-fields', 'forest-wraith', 'rootbound', 'strawberry-patch', 'deepwood-owl', 'bramble-thicket'],
  ruins: ['forgotten-workshop', 'forgotten-workshop', 'ancient-ruin', 'ancient-ruin', 'ancient-monolith',
          'forest-relic', 'lost-vault', 'clockwork-remnant', 'stone-guardian',
          'gearsmith-toolbox', 'sunken-reliquary', 'rust-mites', 'collapsing-arch'],
  crystal: ['crystal-bloom', 'crystal-bloom', 'crystal-vein', 'crystal-vein', 'singing-shards', 'luminous-fields',
            'glade-spirit', 'prism-heart', 'resonant-geode', 'moonlit-pool', 'starfall-relic', 'shard-swarm', 'crystal-fracture'],
  swamp: ['marsh-larder', 'marsh-larder', 'sunken-hollow', 'sunken-hollow', 'willow-lantern', 'mire-hermit',
          'mushroom-scout', 'bog-lurker', 'frog-ferry', 'will-o-wisp', 'drowned-lantern', 'peat-camp', 'leech-pool', 'marsh-gas'],
  highlands: ['ridge-ore', 'ridge-ore', 'cliffside-cache', 'cliffside-cache', 'eagles-view', 'stone-guardian', 'rockslide',
              'hidden-spring', 'rocs-nest', 'wind-nymph', 'peak-shrine', 'thunder-roc', 'frostbite'],
  blight: ['corrupted-grove', 'corrupted-grove', 'shadow-rift', 'ruined-gateway', 'root-ambush', 'forest-wraith', 'bog-lurker',
           'grasping-roots', 'spore-plague', 'rootling-swarm', 'whispers-dark', 'hollow-echo', 'withered-ward'],
};

// ---------------- Discovery cards, second edition ----------------
// The finished cards for Forest, Crystal Fields and Ruins: the printed art carries all the text;
// `v2` repeats it for screen readers and the card catalogue. One copy of each per deck.
const V = (id, title, type, biome, flavor, text, fx, extra = {}) =>
  ({ id, title, type, fx, img: `cards/v2/${id}.webp`, v2: { biome, flavor, text }, ...extra });
Object.assign(CARDS, {
  // Forest
  'fallen-timber': V('fallen-timber', 'Fallen Timber', 'resource', 'Forest',
    'A toppled giant offers the forestfolk one last gift.',
    'Gain 2 Wood.', [{ gain: { wood: 2 } }]),
  'ancient-fallen-oak': V('ancient-fallen-oak', 'Ancient Fallen Oak', 'resource', 'Forest',
    'Old strength still serves the forestfolk.',
    'Gain 3 Wood.', [{ gain: { wood: 3 } }]),
  'sugarberry-bramble': V('sugarberry-bramble', 'Sugarberry Bramble', 'resource', 'Forest',
    'Each berry is sweeter than the last.',
    'Gain 2 Food.', [{ gain: { food: 2 } }]),
  'nutfall-hollow': V('nutfall-hollow', 'Nutfall Hollow', 'resource', 'Forest',
    'Hazelnuts and twigs tumble down like little brown raindrops.',
    'Gain 1 Wood and 1 Food.', [{ gain: { wood: 1, food: 1 } }]),
  'honeydrip-stump': V('honeydrip-stump', 'Honeydrip Stump', 'resource', 'Forest',
    'An old hive, long empty, still holds honey as sweet as the day it was made.',
    'Gain 1 Food.', [{ gain: { food: 1 } }]),
  'strawberry-log': V('strawberry-log', 'Strawberry Log', 'resource', 'Forest',
    'An old fallen log, crowned with wild strawberries.',
    'Gain 2 Wood and 1 Food.', [{ gain: { wood: 2, food: 1 } }]),
  'puffcap-meadow': V('puffcap-meadow', 'Puffcap Meadow', 'resource', 'Forest',
    'Plump little caps, soft as pillows and twice as tasty.',
    'Gain 3 Food.', [{ gain: { food: 3 } }]),
  'plum-bough': V('plum-bough', 'Plum Bough', 'resource', 'Forest',
    'A branch bent so low with plums that it finally broke.',
    'Gain 2 Food and 1 Wood.', [{ gain: { food: 2, wood: 1 } }]),
  'forgotten-orchard': V('forgotten-orchard', 'Forgotten Orchard', 'resource', 'Forest',
    'Planted long ago, it still blossoms and bears fruit.',
    'Gain 3 Food.', [{ gain: { food: 3 } }]),
  'amber-sap': V('amber-sap', 'Amber Sap', 'resource', 'Forest',
    'Golden sap flows through the bark, carrying traces of ancient magic.',
    'Gain 1 Essence and 1 Wood.', [{ gain: { essence: 1, wood: 1 } }]),
  'windfall-apples': V('windfall-apples', 'Windfall Apples', 'resource', 'Forest',
    'Last night’s breeze shook down branches and rosy apples.',
    'Gain 1 Wood and 1 Food.', [{ gain: { wood: 1, food: 1 } }]),
  'glowcap-circle': V('glowcap-circle', 'Glowcap Circle', 'resource', 'Forest',
    'Moonlit caps gather soft power in their crowns.',
    'Gain 1 Essence.', [{ gain: { essence: 1 } }]),
  'forests-embrace': V('forests-embrace', 'Forest’s Embrace', 'event', 'Forest',
    'A gentle warmth moves through the roots, carrying the forest’s healing touch.',
    'Every player restores 1 Health, up to their maximum.', [{ allHeal: 1 }]),
  'spiritwood-totem': V('spiritwood-totem', 'Spiritwood Totem', 'relic', 'Forest',
    'Carved by forgotten hands, the little totem still carries the forest’s blessing.',
    'Gain 1 Essence and 1 Reputation.', [{ gain: { essence: 1 } }, { rep: 1 }]),
  'elders-carved-staff': V('elders-carved-staff', 'Elder’s Carved Staff', 'relic', 'Forest',
    'The ancient staff remembers every path its master once traveled.',
    'Gain 1 Wood and 1 Reputation.', [{ gain: { wood: 1 } }, { rep: 1 }]),
  'golden-picnic-meadow': V('golden-picnic-meadow', 'Golden Picnic Meadow', 'event', 'Forest',
    'In the warm light, everyone finds something sweet to share.',
    'Every player gains 1 Food.', [{ allGain: { food: 1 } }]),
  // Crystal Fields
  'shimmering-fragments': V('shimmering-fragments', 'Shimmering Fragments', 'resource', 'Crystal Fields',
    'Tiny shards sparkle beneath the earth, remnants of something once magnificent.',
    'Gain 1 Crystal.', [{ gain: { crystal: 1 } }]),
  'crystal-bloom': V('crystal-bloom', 'Crystal Bloom', 'resource', 'Crystal Fields',
    'Among the stones, delicate crystal flowers bloom where no sunlight reaches.',
    'Gain 2 Crystal.', [{ gain: { crystal: 2 } }]),
  'essence-spring': V('essence-spring', 'Essence Spring', 'resource', 'Crystal Fields',
    'From a crack in the ancient stone, a spring flows with liquid starlight.',
    'Gain 2 Essence.', [{ gain: { essence: 2 } }]),
  'crystal-cluster': V('crystal-cluster', 'Crystal Cluster', 'resource', 'Crystal Fields',
    'Great crystal spires rise from the earth, humming softly with ancient energy.',
    'Gain 3 Crystal.', [{ gain: { crystal: 3 } }]),
  'luminous-cavern': V('luminous-cavern', 'Luminous Cavern', 'resource', 'Crystal Fields',
    'Every surface glimmers with hidden light, as though the stars themselves were buried here.',
    'Gain 2 Crystal and 1 Essence.', [{ gain: { crystal: 2, essence: 1 } }]),
  'prismatic-growth': V('prismatic-growth', 'Prismatic Growth', 'resource', 'Crystal Fields',
    'What was bare stone yesterday now glitters with a thousand new colors.',
    'Gain 2 Crystal.', [{ gain: { crystal: 2 } }]),
  'arcane-deposits': V('arcane-deposits', 'Arcane Deposits', 'resource', 'Crystal Fields',
    'Beneath a thin layer of stone, strange minerals pulse with a living glow.',
    'Gain 1 Crystal and 1 Essence.', [{ gain: { crystal: 1, essence: 1 } }]),
  'crystal-petals': V('crystal-petals', 'Crystal Petals', 'resource', 'Crystal Fields',
    'Fragile petals of crystal drift upon the wind, dissolving into sparks of pure magic.',
    'Gain 1 Essence.', [{ gain: { essence: 1 } }]),
  'magical-condensation': V('magical-condensation', 'Magical Condensation', 'resource', 'Crystal Fields',
    'At dawn, droplets of magic gather upon the crystals like morning dew.',
    'Gain 2 Essence and 1 Crystal.', [{ gain: { essence: 2, crystal: 1 } }]),
  'hidden-crystal-vein': V('hidden-crystal-vein', 'Hidden Crystal Vein', 'resource', 'Crystal Fields',
    'A single glimmer leads to a treasure the mountain has guarded for centuries.',
    'Gain 3 Crystal.', [{ gain: { crystal: 3 } }]),
  'echoing-geodes': V('echoing-geodes', 'Echoing Geodes', 'resource', 'Crystal Fields',
    'Crack one open, and the song trapped inside rings out across the valley.',
    'Gain 1 Crystal and 2 Essence.', [{ gain: { crystal: 1, essence: 2 } }]),
  'living-crystal-formation': V('living-crystal-formation', 'Living Crystal Formation', 'resource', 'Crystal Fields',
    'The crystals shift when no one is watching, slowly weaving themselves around ancient metal.',
    'Gain 2 Crystal and 1 Metal.', [{ gain: { crystal: 2, metal: 1 } }]),
  'friendly-crystal-beetle': V('friendly-crystal-beetle', 'Friendly Crystal Beetle', 'ally', 'Crystal Fields',
    'A tiny guardian with a body of living gemstones offers a healing glow from its crystalline shell.',
    'Gain 1 Crystal and restore 1 Health.', [{ gain: { crystal: 1 } }, { heal: 1 }]),
  'crystal-nymph': V('crystal-nymph', 'Crystal Nymph', 'ally', 'Crystal Fields',
    'From within the shimmering stones, a gentle spirit awakens to mend what corruption has touched.',
    'Gain 1 Crystal and remove 1 Corruption from your tile, if present.', [{ gain: { crystal: 1 } }, { cleanseNear: true }], { note: 'In the app: if your own tile is clean, the Nymph cleanses a corrupted tile next to you instead (corrupted tiles draw from the Blight deck).' }),
  'prismatic-butterfly': V('prismatic-butterfly', 'Prismatic Butterfly', 'ally', 'Crystal Fields',
    'Its wings are woven from living light, and those who follow its colors find their journey strangely shortened.',
    'Gain 1 Essence and 1 additional movement point this turn.', [{ gain: { essence: 1 } }, { mp: 1 }]),
  'ancient-crystal-lens': V('ancient-crystal-lens', 'Ancient Crystal Lens', 'relic', 'Crystal Fields',
    'Through its polished surface, the forgotten wonders of the old world shine once more.',
    'Gain 1 Essence and 1 Reputation.', [{ gain: { essence: 1 } }, { rep: 1 }]),
  'harmonic-resonance': V('harmonic-resonance', 'Harmonic Resonance', 'event', 'Crystal Fields',
    'The crystal spires begin to sing in harmony, sending a wave of gentle magic across the land.',
    'Every player gains 1 Essence.', [{ allGain: { essence: 1 } }]),
  'radiant-renewal': V('radiant-renewal', 'Radiant Renewal', 'event', 'Crystal Fields',
    'A brilliant light washes across the fields, lifting weary hearts and soothing old wounds.',
    'Every player removes 1 Fear, if present, and restores 1 Health.', [{ allFear: -1 }, { allHeal: 1 }]),
  'crystal-shatter': V('crystal-shatter', 'Crystal Shatter', 'enemy', 'Crystal Fields',
    'A sharp ringing fills the air, and the crystal in your pack fractures without warning.',
    'Lose 1 Crystal.', [{ lose: { crystal: 1 } }]),
  'glimmering-wisp': V('glimmering-wisp', 'Glimmering Wisp', 'ally', 'Crystal Fields',
    'A wandering light circles you playfully, and for a moment, the darkness feels far away.',
    'Gain 1 Essence and remove 1 Fear.', [{ gain: { essence: 1 } }, { fear: -1 }]),
  'fractured-reality': V('fractured-reality', 'Fractured Reality', 'enemy', 'Crystal Fields',
    'For a heartbeat, the world splits into a thousand reflections, and none of them show the way home.',
    'Lose 1 movement point this turn and gain 1 Fear.', [{ mp: -1 }, { fear: 1 }]),
  'crystal-husk': V('crystal-husk', 'Crystal Husk', 'enemy', 'Crystal Fields',
    'What first appeared to be a crystal statue rises from the stone, its hollow eyes burning with an unnatural light.',
    'Gain 1 Fear and lose 1 Crystal.', [{ lose: { crystal: 1 } }, { fear: 1 }]),
  'crystal-storm': V('crystal-storm', 'Crystal Storm', 'event', 'Crystal Fields',
    'A violent storm of glittering shards sweeps across the land, tearing loose the crystals carried by travelers.',
    'Every player loses 1 Crystal.', [{ allLose: { crystal: 1 } }]),
  'razor-crystal-growth': V('razor-crystal-growth', 'Razor Crystal Growth', 'enemy', 'Crystal Fields',
    'Sharp crystals erupt from beneath your feet, growing faster than you can escape.',
    'Lose 1 Health or discard 1 Crystal.', [{ choice: [
      { label: 'Discard 1 Crystal', fx: [{ lose: { crystal: 1 } }], needs: { crystal: 1 } },
      { label: 'Lose 1 life', fx: [{ life: -1 }] }] }]),
  'unstable-energy': V('unstable-energy', 'Unstable Energy', 'enemy', 'Crystal Fields',
    'The crystal pulses wildly in your hands, demanding either its magic or a piece of your strength.',
    'Lose 1 Essence or 1 Health.', [{ choice: [
      { label: 'Lose 1 Essence', fx: [{ lose: { essence: 1 } }], needs: { essence: 1 } },
      { label: 'Lose 1 life', fx: [{ life: -1 }] }] }]),
  'arcane-feedback': V('arcane-feedback', 'Arcane Feedback', 'enemy', 'Crystal Fields',
    'The energy you gathered suddenly turns against you, scattering into the air like frightened fireflies.',
    'Lose 1 Essence.', [{ lose: { essence: 1 } }]),
  'prismatic-explosion': V('prismatic-explosion', 'Prismatic Explosion', 'enemy', 'Crystal Fields',
    'A beautiful shimmer becomes a blinding flash, sending razor-sharp fragments in every direction.',
    'Lose 1 Health.', [{ life: -1 }]),
  // Ruins
  'broken-machinery': V('broken-machinery', 'Broken Machinery', 'resource', 'Ruins',
    'The great machine has fallen silent, but its pieces may yet serve another purpose.',
    'Gain 2 Metal.', [{ gain: { metal: 2 } }]),
  'rusted-supply-chest': V('rusted-supply-chest', 'Rusted Supply Chest', 'resource', 'Ruins',
    'Beneath a blanket of rust, an old chest still guards its master’s forgotten supplies.',
    'Gain 1 Metal and 1 Wood.', [{ gain: { metal: 1, wood: 1 } }]),
  'collapsed-armory': V('collapsed-armory', 'Collapsed Armory', 'resource', 'Ruins',
    'Broken blades and battered shields lie beneath the rubble, their battles long forgotten.',
    'Gain 3 Metal.', [{ gain: { metal: 3 } }]),
  'hidden-tool-cabinet': V('hidden-tool-cabinet', 'Hidden Tool Cabinet', 'resource', 'Ruins',
    'Behind a crumbling wall, a craftsman’s finest tools have escaped the passage of time.',
    'Gain 2 Metal and 1 Wood.', [{ gain: { metal: 2, wood: 1 } }]),
  'forgotten-workshop': V('forgotten-workshop', 'Forgotten Workshop', 'resource', 'Ruins',
    'Tools lie untouched upon dusty tables, waiting for hands that will never return.',
    'Gain 2 Metal.', [{ gain: { metal: 2 } }]),
  'abandoned-furnace': V('abandoned-furnace', 'Abandoned Furnace', 'resource', 'Ruins',
    'The forge has been cold for centuries, yet its heart still holds a crystalline ember.',
    'Gain 1 Metal and 1 Crystal.', [{ gain: { metal: 1, crystal: 1 } }]),
  'ancient-scrap-pile': V('ancient-scrap-pile', 'Ancient Scrap Pile', 'resource', 'Ruins',
    'What the old world discarded may be just what the new world needs.',
    'Gain 1 Metal.', [{ gain: { metal: 1 } }]),
  'forgotten-guardian': V('forgotten-guardian', 'Forgotten Guardian', 'ally', 'Ruins',
    'The ancient guardian lowers its weapon, recognizing a kindness that survived the ages.',
    'Gain 1 Crystal and remove 1 Fear.', [{ gain: { crystal: 1 } }, { fear: -1 }]),
  'clockwork-helper': V('clockwork-helper', 'Clockwork Helper', 'ally', 'Ruins',
    'With a click, a whirr, and a shower of sparks, the little automaton remembers its purpose.',
    'Gain 1 Metal and 1 additional movement point this turn.', [{ gain: { metal: 1 } }, { mp: 1 }]),
  'lost-inventors-parts': V('lost-inventors-parts', 'Lost Inventor’s Parts', 'resource', 'Ruins',
    'Scattered pieces of an unfinished invention lie beside their maker’s final sketches.',
    'Gain 1 Metal, 1 Wood, and 1 Crystal.', [{ gain: { metal: 1, wood: 1, crystal: 1 } }]),
  'crystal-powered-lantern': V('crystal-powered-lantern', 'Crystal-Powered Lantern', 'resource', 'Ruins',
    'A little lantern flickers to life, its crystal heart remembering how to shine.',
    'Gain 1 Crystal and 1 Metal.', [{ gain: { crystal: 1, metal: 1 } }]),
  'sealed-supply-room': V('sealed-supply-room', 'Sealed Supply Room', 'resource', 'Ruins',
    'An ancient iron door gives way, revealing provisions carefully hidden from a forgotten disaster.',
    'Gain 2 Metal and 1 Food.', [{ gain: { metal: 2, food: 1 } }]),
  'ancient-engineers-spirit': V('ancient-engineers-spirit', 'Ancient Engineer’s Spirit', 'ally', 'Ruins',
    'A shimmering figure appears beside an unfinished machine, eager to help one last inventor.',
    'Gain 1 Essence and restore 1 Health.', [{ gain: { essence: 1 } }, { heal: 1 }]),
  'wandering-archaeologist': V('wandering-archaeologist', 'Wandering Archaeologist', 'ally', 'Ruins',
    'A curious mushroomkin has spent years studying the ruins and knows where forgotten paths may lead.',
    'Gain 1 Metal and examine the next tile in the exploration stack without placing it.', [{ gain: { metal: 1 } }, { reveal: 1 }], { note: 'In the app: the nearest unexplored tile is revealed (the map is already laid out).' }),
  'forgotten-storehouse': V('forgotten-storehouse', 'Forgotten Storehouse', 'resource', 'Ruins',
    'Shelves have fallen and crates have split, but useful materials remain beneath the dust.',
    'Gain 1 Wood and 2 Metal.', [{ gain: { wood: 1, metal: 2 } }]),
  'collapsing-corridor': V('collapsing-corridor', 'Collapsing Corridor', 'enemy', 'Ruins',
    'A single loose stone falls, followed by the terrible rumble of an entire passage giving way.',
    'Lose 1 Health.', [{ life: -1 }]),
  'possessed-armor': V('possessed-armor', 'Possessed Armor', 'enemy', 'Ruins',
    'An empty suit of armor rises from its pedestal, its joints creaking with an unseen will.',
    'Lose 1 Metal or gain 1 Fear.', [{ choice: [
      { label: 'Lose 1 Metal', fx: [{ lose: { metal: 1 } }], needs: { metal: 1 } },
      { label: 'Gain 1 Fear', fx: [{ fear: 1 }] }] }]),
  'rusted-blade-trap': V('rusted-blade-trap', 'Rusted Blade Trap', 'enemy', 'Ruins',
    'Hidden blades spring from the walls, their ancient mechanisms still cruelly precise.',
    'Lose 1 Health or 1 Metal.', [{ choice: [
      { label: 'Lose 1 Metal', fx: [{ lose: { metal: 1 } }], needs: { metal: 1 } },
      { label: 'Lose 1 life', fx: [{ life: -1 }] }] }]),
  'crumbling-foundations': V('crumbling-foundations', 'Crumbling Foundations', 'event', 'Ruins',
    'A deep tremor rolls beneath the ruins, and the ancient roads begin to split apart.',
    'Every player on a Ruins tile loses 1 movement point on their next turn.', [{ slowOn: 'ruins' }]),
  'buried-guardian': V('buried-guardian', 'Buried Guardian', 'enemy', 'Ruins',
    'Ancient stone hands break through the rubble, determined to protect a treasure no one remembers.',
    'Lose 1 Crystal or 1 Health.', [{ choice: [
      { label: 'Lose 1 Crystal', fx: [{ lose: { crystal: 1 } }], needs: { crystal: 1 } },
      { label: 'Lose 1 life', fx: [{ life: -1 }] }] }]),
  'ancient-sentinel': V('ancient-sentinel', 'Ancient Sentinel', 'enemy', 'Ruins',
    'Two glowing eyes awaken beneath a stone helmet, and the forgotten soldier raises its spear.',
    'Gain 1 Fear and lose 1 movement point this turn.', [{ fear: 1 }, { mp: -1 }]),
  'hidden-pitfall': V('hidden-pitfall', 'Hidden Pitfall', 'enemy', 'Ruins',
    'The floor beneath your feet crumbles, revealing a dark chamber far below.',
    'Lose 1 Health.', [{ life: -1 }]),
  'cursed-machinery': V('cursed-machinery', 'Cursed Machinery', 'enemy', 'Ruins',
    'The machine hums an unsettling tune as its hungry gears pull the magic from your belongings.',
    'Lose 1 Essence.', [{ lose: { essence: 1 } }]),
  'awakening-darkness': V('awakening-darkness', 'Awakening Darkness', 'event', 'Ruins',
    'Deep beneath the shattered towers, something that should have remained forgotten begins to stir.',
    'Advance the Horror Track by 1.', [{ horror: 1 }]),
  'ancient-curse': V('ancient-curse', 'Ancient Curse', 'event', 'Ruins',
    'A forgotten warning glows upon the walls, and the air grows cold as an ancient curse awakens.',
    'Every player loses 1 Essence.', [{ allLose: { essence: 1 } }]),
});
DECKS.forest = ['fallen-timber', 'ancient-fallen-oak', 'sugarberry-bramble', 'nutfall-hollow', 'honeydrip-stump', 'strawberry-log', 'puffcap-meadow', 'plum-bough', 'forgotten-orchard', 'amber-sap', 'windfall-apples', 'glowcap-circle', 'forests-embrace', 'spiritwood-totem', 'elders-carved-staff', 'golden-picnic-meadow',
  'forest-wraith', 'bramble-thicket']; // the Forest's own hazards stay until its enemy cards are printed
DECKS.crystal = ['shimmering-fragments', 'crystal-bloom', 'essence-spring', 'crystal-cluster', 'luminous-cavern', 'prismatic-growth', 'arcane-deposits', 'crystal-petals', 'magical-condensation', 'hidden-crystal-vein', 'echoing-geodes', 'living-crystal-formation', 'friendly-crystal-beetle', 'crystal-nymph', 'prismatic-butterfly', 'ancient-crystal-lens', 'harmonic-resonance', 'radiant-renewal', 'crystal-shatter', 'glimmering-wisp', 'fractured-reality', 'crystal-husk', 'crystal-storm', 'razor-crystal-growth', 'unstable-energy', 'arcane-feedback', 'prismatic-explosion'];
DECKS.ruins = ['broken-machinery', 'rusted-supply-chest', 'collapsed-armory', 'hidden-tool-cabinet', 'forgotten-workshop', 'abandoned-furnace', 'ancient-scrap-pile', 'forgotten-guardian', 'clockwork-helper', 'lost-inventors-parts', 'crystal-powered-lantern', 'sealed-supply-room', 'ancient-engineers-spirit', 'wandering-archaeologist', 'forgotten-storehouse', 'collapsing-corridor', 'possessed-armor', 'rusted-blade-trap', 'crumbling-foundations', 'buried-guardian', 'ancient-sentinel', 'hidden-pitfall', 'cursed-machinery', 'awakening-darkness', 'ancient-curse'];

// ---------------- Weather ----------------
// Drawn at the start of every round. `now` resolves immediately; `mods` last the whole round.
export const WEATHER = {
  'clear-skies':      { title: 'Clear Skies',      now: [], mods: { mpBonus: 1 }, text: 'Everyone gets +1 movement this round.' },
  'gentle-rain':      { title: 'Gentle Rain',      now: [{ allGain: { food: 1 } }], mods: {}, text: 'Each player gains 1 Food.' },
  'fog':              { title: 'Fog',              now: [], mods: { noExplore: true }, text: 'No one can move into unexplored tiles this round.' },
  'strong-winds':     { title: 'Strong Winds',     now: [{ allLose: { wood: 1 } }], mods: { monsterRolls: 1 }, text: 'Each player loses 1 Wood. Monsters roll one extra move.' },
  'thunderstorm':     { title: 'Thunderstorm',     now: [{ allLose: { metal: 1 } }, { allLoseRandom: 1 }], mods: {}, text: 'Each player loses 1 Metal, then 1 random resource.' },
  'heatwave':         { title: 'Heatwave',         now: [{ allLose: { food: 1 } }], mods: { noFood: true }, text: 'Each player loses 1 Food. No one can gain Food this round.' },
  'heavy-snow':       { title: 'Heavy Snow',       now: [{ allGain: { crystal: 1 } }], mods: { mpCap: 1 }, text: 'Each player gains 1 Crystal. Movement is limited to 1 this round.' },
  'magical-bloom':    { title: 'Magical Bloom',    now: [{ allGain: { essence: 1 } }], mods: {}, text: 'Each player gains 1 Essence.' },
  'corrupting-mists': { title: 'Corrupting Mists', now: [{ allLose: { essence: 1 } }, { spread: 1 }], mods: {}, text: 'Each player loses 1 Essence. Corruption spreads once.' },
  'warm-breeze':      { title: 'Warm Breeze',      now: [{ healLow: 1 }], mods: {}, text: 'Each player with 1 life heals 1.', draft: { art: 'cardart/forest_2.jpg', flavor: 'It smells of honey and old summers.' } },
  'rainbow':          { title: 'Rainbow',          now: [{ allRep: 1 }], mods: {}, text: 'Each player gains 1 Reputation.', draft: { art: 'cardart/highlands_3.jpg', flavor: 'Even the Root King stops to look.' } },
  'eclipse':          { title: 'Eclipse',          now: [{ allLoseRandom: 1 }, { spread: 1 }], mods: {}, text: 'Each player loses 1 random resource. Corruption spreads once.' },
};

// Rounds cycle Day, Day, Night. Night spreads more corruption.
export const CYCLE = ['day', 'day', 'night'];

// Night deck: one card drawn at the start of every Night round, lasting the whole Night.
export const NIGHT = {
  'the-hunt':     { title: 'The Hunt', mood: 'bad', text: 'Each monster takes 1 extra step toward the nearest Mushroomfolk before it rolls.', flavor: 'Tonight, they are not wandering.' },
  'howling':      { title: 'Howling', mood: 'bad', now: [{ spawnAny: 1 }], text: 'A new monster appears on a corrupted tile.', flavor: 'One voice in the dark, then many.' },
  'creeping-rot': { title: 'Creeping Rot', mood: 'bad', now: [{ spread: 2 }], text: 'Corruption spreads twice more.', flavor: 'By morning the moss has turned grey.' },
  'night-terrors':{ title: 'Night Terrors', mood: 'bad', text: 'Everyone not at the Workshop or an Outpost has 1 less movement when they set out.', flavor: 'Every shadow has eyes.' },
  'long-dark':    { title: 'The Long Dark', mood: 'bad', text: 'No one can Gather this Night.', flavor: 'Too dark to tell a berry from a beetle.' },
  'root-dreams':  { title: 'Dreams of the Root King', mood: 'bad', now: [{ essenceOrRot: 2 }], text: 'The party pays 2 Essence (storage first), or corruption spreads once.', flavor: 'You all wake at once, from the same dream.' },
  'snuffed':      { title: 'Snuffed Lanterns', mood: 'bad', text: 'No one can Rest at an Outpost this Night.', flavor: 'The wind found every flame.' },
  'moonlight':    { title: 'Moonlight', mood: 'good', now: [{ allGain: { essence: 1 } }], text: 'Each player gains 1 Essence.', flavor: 'The moon is full, and the forest is quiet for once.' },
  'fireflies':    { title: 'Fireflies', mood: 'good', now: [{ reveal: 2 }], text: 'Reveal 2 unexplored tiles next to explored land.', flavor: 'A thousand tiny lanterns lead the way.' },
  'silent-night': { title: 'Silent Night', mood: 'relief', text: 'Nothing happens.', flavor: 'Nothing stirs. Somehow that is worse.' },
};

// ---------------- Quests (quest mode) ----------------
// Quest tiles hide a quest mark under their tile back: flipping one opens a quest.
// kinds: visit (reach the marker, spend a decision), deliver (bring `need` to the marker),
// escort (pick up at the marker, walk them home), explore / cleanse / slay (counters).
// `where`: 'here' = the tile that opened it; { biome, far } = a tile of that biome at least
// `far` hexes away (any biome if none left).
export const QUEST_TILES = { standard: 6, full: 9 };
export const QUEST_MAX_ACTIVE = 3;
export const QUEST_TIMER = 6;
export const QUESTS_TO_WIN = 3;
export const QUESTS = {
  'crystal-shrine':   { title: 'The Crystal Shrine', kind: 'visit', where: { biome: 'crystal', far: 2 }, art: 'cardart/crystal_3.jpg',
                        flavor: '“The last entry speaks of a shrine of crystal, beyond three waterfalls.”', text: 'Reach the shrine and spend a decision to study it.' },
  'voice-forest':     { title: 'Voice of the Forest', kind: 'deliver', where: 'here', need: { food: 1, essence: 1 }, art: 'cardart/forest_2.jpg',
                        flavor: 'An ancient tree hums, hungry for an offering.', text: 'Bring 1 Food and 1 Essence to this tree.' },
  'crystal-beetle':   { title: 'The Injured Crystal Beetle', kind: 'deliver', where: 'here', need: { food: 1, crystal: 1 }, art: 'cardart/crystal_1.jpg',
                        flavor: 'A tiny beetle lies trapped beneath a fallen crystal.', text: 'Bring 1 Food and 1 Crystal to nurse it back to health.' },
  'forest-spirit':    { title: 'The Lost Spirit', kind: 'escort', where: { edge: true }, art: 'cardart/forest_1.jpg',
                        flavor: 'A small glowing spirit has lost its way home.', text: 'Find it at the edge of the map, in line with you, then carry it safely to the Workshop.' },
  'missing-trapper':  { title: 'The Missing Trapper', kind: 'escort', where: { edge: true }, art: 'cardart/swamp_3.jpg',
                        flavor: 'Old Tansy went out to check her snares and never came back.', text: 'Find her at the edge of the map, in line with you, then bring her home to the Workshop.' },
  'singing-stump':    { title: 'The Singing Stump', kind: 'visit', where: { biome: 'forest', far: 2 }, art: 'cardart/forest_3.jpg',
                        flavor: 'Strange music drifts from somewhere deep in the wood.', text: 'Find the stump and spend a decision listening.' },
  'broken-watchtower':{ title: 'The Broken Watchtower', kind: 'deliver', where: { biome: 'highlands', far: 2 }, need: { wood: 2, metal: 1 }, bonus: 'reveal', art: 'cardart/highlands_3.jpg',
                        flavor: 'From its top, the old watchers could see the whole Everdeep.', text: 'Bring 2 Wood and 1 Metal to repair it. Bonus: reveals 3 tiles.' },
  'hollow-cave':      { title: 'The Hollow Cave', kind: 'visit', where: { biome: 'ruins', far: 2 }, bonus: 'monster', art: 'cardart/ruins_3.jpg',
                        flavor: 'Something glitters at the back of the cave. Something breathes.', text: 'Explore the cave. Beware: a monster wakes beside it.' },
  'dark-root':        { title: 'The Dark Root', kind: 'slay', where: { far: 2 }, spawn: 'blighted-mushroom', art: 'cardart/corrupted_2.jpg',
                        flavor: 'A rotten root is feeding the corruption, and it has grown teeth.', text: 'Defeat the Blighted Mushroom that guards the marker.' },
  'crystal-migration':{ title: 'Crystal Migration', kind: 'explore', goal: 3, art: 'cardart/crystal_2.jpg',
                        flavor: 'The crystal beetles are on the move. Follow them!', text: 'Reveal 3 new tiles.' },
  'forgotten-blueprint':{ title: 'The Forgotten Blueprint', kind: 'visit', where: { biome: 'ruins', far: 1 }, art: 'cardart/ruins_1.jpg',
                        flavor: 'Plans for a machine no Mushroomfolk remembers building.', text: 'Search the ruins at the marker for the plans.' },
  'wind-nymph':       { title: 'Wind Nymph Chase', kind: 'visit', where: { edge: true }, art: 'cardart/highlands_1.jpg',
                        flavor: 'A giggling Wind Nymph darts away through the trees.', text: 'Catch her at the edge of the map, in line with you.' },
  'lantern-keepers':  { title: 'The Lantern Keepers', kind: 'deliver', where: { biome: 'swamp', far: 1 }, need: { food: 2 }, art: 'cardart/swamp_1.jpg',
                        flavor: 'The marsh folk keep the lanterns lit, but they are starving.', text: 'Bring 2 Food to the marsh lanterns.' },
  'shrine-of-dawn':   { title: 'Shrine of Dawn', kind: 'cleanse', goal: 2, art: 'cardart/forest_2.jpg',
                        flavor: 'The dawn shrine dims with every corrupted grove.', text: 'Cleanse 2 corrupted tiles.' },
  'giants-path':      { title: 'The Giant’s Path', kind: 'slay', goal: 1, art: 'cardart/highlands_2.jpg',
                        flavor: 'Something big has been trampling the old trails.', text: 'Defeat any monster.' },
};
// Root King quests appear when the Horror Track reaches these marks (they ignore the limit of 3).
export const HORROR_QUESTS = {
  10: { id: 'whisper', title: 'Whisper of the Root King', kind: 'cleanse', goal: 3, timer: 4, horrorBack: 2, art: 'cardart/corrupted_1.jpg',
        flavor: 'The roots speak your names in the dark.', text: 'Cleanse 3 corrupted tiles within 4 rounds. Reward: Horror −2.' },
  15: { id: 'heartrot', title: 'The Heartrot', kind: 'slay', goal: 1, timer: 4, horrorBack: 2, art: 'cardart/corrupted_3.jpg',
        flavor: 'The Root King’s heart beats through its creatures.', text: 'Defeat a monster within 4 rounds. Reward: Horror −2.' },
};
Object.assign(QUESTS, Object.fromEntries(Object.values(HORROR_QUESTS).map((q) => [q.id, q])));
// Rumour cards (mixed into Discovery decks in quest mode) open a quest from the deck.
Object.assign(CARDS, {
  'explorers-journal': D('explorers-journal', 'Lost Explorer’s Journal', 'event', 'Forest', 'Its last pages point deeper into the wood.',
                         'A quest begins.', 'cardart/forest_3.jpg', [{ quest: 1 }]),
  'old-map':           D('old-map', 'The Old Map', 'event', 'Ruins', 'Inked by a hand long gone to dust.',
                         'A quest begins.', 'cardart/ruins_2.jpg', [{ quest: 1 }]),
  'whispered-rumour':  D('whispered-rumour', 'Whispered Rumour', 'event', 'Swamp', 'The frogs are talking about something.',
                         'A quest begins.', 'cardart/swamp_2.jpg', [{ quest: 1 }]),
});
const RUM = (id, title, biome, flavor, art) => D(id, title, 'story', biome, flavor, 'A quest begins: draw the top Quest card.', art, [{ quest: 1 }]);
const LAND = (id, title, biome, quest, flavor, art) => D(id, title, 'story', biome, flavor, `Opens the quest \u201c${QUESTS[quest].title}\u201d.`, art, [{ questId: quest }]);
const STEP = (id, title, biome, n, text, flavor, art, fx) => D(id, title, 'story', biome, flavor, text, art, [{ chain: n, fx }]);
Object.assign(CARDS, {
  'fallen-messenger':   RUM('fallen-messenger', 'The Fallen Messenger', 'Forest', 'A sparrow with a note tied to its leg, too tired to fly on.', 'cardart/forest_1.jpg'),
  'carved-warning':     RUM('carved-warning', 'Carved Warning', 'Ruins', 'Someone scratched a map into the wall, then a skull beside it.', 'cardart/ruins_2.jpg'),
  'singing-stone':      RUM('singing-stone', 'Singing in the Stone', 'Crystal Fields', 'The crystals hum a tune you have never heard, but somehow know.', 'cardart/crystal_1.jpg'),
  'bottle-message':     RUM('bottle-message', 'Message in a Bottle', 'Swamp', 'The ink has run, but one word is clear: help.', 'cardart/swamp_3.jpg'),
  'wind-echo':          RUM('wind-echo', 'Echo on the Wind', 'Highlands', 'A voice calls from the next ridge. Then the next.', 'cardart/highlands_1.jpg'),
  'ancient-tree':       LAND('ancient-tree', 'The Ancient Tree', 'Forest', 'voice-forest', 'Its bark is warm, like something alive and listening.', 'cardart/forest_2.jpg'),
  'little-light':       LAND('little-light', 'Lost Little Light', 'Forest', 'forest-spirit', 'A glow no bigger than a berry, trembling in the roots.', 'cardart/forest_3.jpg'),
  'beetle-glass':       LAND('beetle-glass', 'Beetle Under Glass', 'Crystal Fields', 'crystal-beetle', 'Tiny legs, waving from under a fallen shard.', 'cardart/crystal_2.jpg'),
  'tansy-snares':       LAND('tansy-snares', 'Tansy\u2019s Snare Line', 'Swamp', 'missing-trapper', 'Every snare is sprung, and every one is empty.', 'cardart/swamp_1.jpg'),
  'flickering-lanterns':LAND('flickering-lanterns', 'Flickering Lanterns', 'Swamp', 'lantern-keepers', 'One by one, the marsh lights are going out.', 'cardart/swamp_2.jpg'),
  'old-watchtower':     LAND('old-watchtower', 'The Old Watchtower', 'Highlands', 'broken-watchtower', 'Half its stairs are gone. The view from the top is not.', 'cardart/highlands_2.jpg'),
  'cave-mouth':         LAND('cave-mouth', 'Cave Mouth', 'Ruins', 'hollow-cave', 'Cold air breathes out of the dark, slow and steady.', 'cardart/ruins_3.jpg'),
  'rotten-root':        LAND('rotten-root', 'Rotten Root', 'Blight', 'dark-root', 'The rot runs deeper here. Something is feeding it.', 'cardart/corrupted_2.jpg'),
  'broken-compass':     STEP('broken-compass', 'The Broken Compass', 'Ruins', 1, 'Quest chain, step 1 of 4. Its needle points somewhere: Search the Highlands to learn where.', 'Its needle never points north.', 'cardart/ruins_1.jpg', []),
  'ancient-map':        STEP('ancient-map', 'The Ancient Map', 'Highlands', 2, 'Step 2 of 4. Reveal 1 tile. Search Crystal Fields next.', 'The coastline on this map does not exist any more.', 'cardart/highlands_3.jpg', [{ reveal: 1 }]),
  'ruined-observatory': STEP('ruined-observatory', 'The Ruined Observatory', 'Crystal Fields', 3, 'Step 3 of 4. Reveal 2 tiles. Search the Ruins for the final step.', 'The stars painted on its dome are in the wrong places.', 'cardart/crystal_3.jpg', [{ reveal: 2 }]),
  'sealed-vault':       STEP('sealed-vault', 'The Sealed Vault', 'Ruins', 4, 'Final step. Gain 2 Artifacts and +2 Reputation. Counts as 2 completed quests.', 'The compass needle finally stops spinning.', 'cardart/ruins_3.jpg', []),
});
// Story cards are shuffled into the Discovery decks in quest mode only.
export const RUMOURS = {
  forest: ['explorers-journal', 'fallen-messenger', 'ancient-tree', 'little-light'],
  ruins: ['old-map', 'carved-warning', 'cave-mouth', 'broken-compass'],
  crystal: ['explorers-journal', 'singing-stone', 'beetle-glass'],
  swamp: ['whispered-rumour', 'bottle-message', 'tansy-snares', 'flickering-lanterns'],
  highlands: ['wind-echo', 'old-watchtower'],
  blight: ['rotten-root'],
};
// Steps 2-4 are set aside; the next Search on a tile of the named biome finds the next step.
export const CHAIN = ['broken-compass', 'ancient-map', 'ruined-observatory', 'sealed-vault'];
export const CHAIN_BIOME = { 1: 'highlands', 2: 'crystal', 3: 'ruins' };
