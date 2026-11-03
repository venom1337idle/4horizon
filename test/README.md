# Tests

```
npm install
npx playwright install chromium
npm test
```

`npm test` runs `test/run-all.js`: about 50 suites in three groups, then the checks of the texts.

| group  | what it tests | how |
|--------|---------------|-----|
| window | the window and the Summary / Overview (index.html, dashboard.html and what they load) | Playwright opens them in Chromium, with a stand-in for the game data |
| main   | the main process (the game reader, diagnostics, missions, economy mode, the lockdown of the panels...) | Node, with a stand-in for Electron (`main/stubs/electron`) |
| notify | the notifications, the settings module, start with the PC | Node |

Each group runs in a fresh work folder in the system's temp folder: the app files of the project, with the files of `test/<group>` on top.
So the tests always check the code of the project as it is, and they write nothing into it.

Some suites take a while (the window group: about 10 minutes). To run part of it:

```
node test/run-all.js main                     one group
node test/run-all.js window run-today         one suite (or several)
node test/run-all.js window texts             only the checks of the texts
node test/run-all.js window --keep            keep the work folder, to look at it
```

## The texts (English and Portuguese)

The English texts are written in the code; the Portuguese ones are in `test/window/pt/*.py` (one file per part of the app).
`i18n-pt.js` is built from them: after changing a text, or adding one, rebuild it from a kept work folder:

```
node test/run-all.js window texts --keep      (prints the work folder)
cd <that folder>
python3 build.py write <the project folder>/i18n-pt.js
```

The text checks need Python 3:
- **portuguese-dictionary**: every English text the app asks for has its Portuguese, and no Portuguese text is left that nobody asks for
- **english-parity**: the English texts of 20 states of the window are the same as in `test/window/golden-en.json` (changes made on purpose are listed in `compare.py`)
- **portuguese-left-english**: Portuguese text that still reads as English (2 are known and fine: a log line of popup tidy, and the Diagnostics report, which is English on purpose)
