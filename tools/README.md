# tools

Two scripts that build the app's data files from the game's own data module:

- `build-data.mjs` writes `game-data.json` (item names and NPC prices, hunts, species names)
- `build-hunts.mjs` writes `hunt-data.js` (hunts with their level, Pokémon, XP and loot value)

They need `tools/game-data.mjs`: a module of the game's own website code, which holds the game's tables.
**It is not part of this repository and must never be committed** (it is in `.gitignore`): it is the game's code, not ours.

To rebuild the data after a game update: save the game's data module as `tools/game-data.mjs`, then, from the project folder:

```
node tools/build-data.mjs
node tools/build-hunts.mjs
```

The game's code is minified, so the short names the scripts import (`I`, `H`, `j`, `B`, `a`, `s`, `h`, `aa`) can change with any game update.
If a script fails after an update, those names have to be found again in the new module.
