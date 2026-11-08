# tools

Two scripts that build the app's data files from the game's own data module:

- `build-data.mjs` writes `game-data.json` (item names and NPC prices, hunts, species names)
- `build-hunts.mjs` writes `hunt-data.js` (hunts with their level, unlock level, region, Pokémon and loot value; species and moves)

Both use `game-exports.mjs`, which finds what they need in the game's module **by its content** (the items, the hunts, the species,
the moves, the settings, and the game's functions for a species, its region, its drops and the unlock level of a hunt).
The game's code is minified and the short names of its exports change with every game update, so nothing is looked up by name.
If something cannot be found, the build stops and says what is missing.

## Getting the game's data module

It is one of the game's own JavaScript files (about 2.3 MB). **It is not part of this repository and must never be committed**
(it is the game's code, not ours; `.gitignore` blocks it).

1. In Chrome or Edge (not in 4horizon), open https://pokehorizonidle.com, **log in** and wait until you are in the game. Open the Hunts panel once.
2. Open the developer tools (F12) and search all files with **Ctrl+Shift+F** for the name of a hunt, for example `dos Torchic`, or for `absorb`.
3. The result is in a file called `game-data-<something>.js`. It starts with a long list of moves (`const Fe=JSON.parse('[{"id":"absorb"…`).
4. Right-click in that file › **Save as…**, and save it as `tools/game-data.mjs`.

Then, from the project folder:

```
node tools/build-data.mjs
node tools/build-hunts.mjs
```

## XP per kill

Since the game's update of 2026-11-03 the XP of a kill comes from `killXpCurve`: a fixed value for the hunts of Nv. 150 and up
(the "EXP por abate" of the Hunts panel), and for lower hunts a value the game works out in code that is not in the data module.
`hunt-data.js` therefore has the XP per kill only from Nv. 150 up (`null` below). 4horizon itself does not use it.
