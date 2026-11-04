# Rootbound

A cooperative fantasy exploration board game, playable in the browser as a 3D tabletop. Up to five
Mushroomfolk explore the Everdeep Forest, gather resources, build an invention, and finish it before
the corruption wakes the Root King.

## Running it

It is a static page: serve the folder and open `index.html`.

```bash
python3 -m http.server 8000
```

Online play (shared games between friends) works when the page is published as a Claude artifact;
served anywhere else, games are kept in the browser for pass-and-play.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Page shell and styles |
| `game/engine.js` | The rules: pure functions, `act(state, seat, action)` returns the next state and its events |
| `game/data.js` | All game content: biomes, cards, decks, weather, night deck, quests, characters, inventions |
| `game/ai.js` | AI Mushroomfolk (also used by the simulators) |
| `game/board3d.js`, `game/models.js` | The three.js table, tiles, figures and dice |
| `game/main.js` | Menus, HUD, turn flow, AI turns |
| `game/net.js` | Online sync (artifact database) and local saves |
| `assets/` | Tile art, card art, tokens, portraits and compressed 3D figures |
| `reference/` | Monster and Thorncap reference images and image prompts |
| `tools/` | Asset cutting scripts, rule tests and balance simulators |

## Tests and balance

```bash
node tools/test_quests.mjs
node tools/test_outpost.mjs
node tools/test_story.mjs
node tools/sim2.mjs 100 4 3 2 skyship rep standard quests   # games players spawnEvery lives goal hunger board quests
```
