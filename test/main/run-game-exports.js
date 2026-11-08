// run-game-exports.js (lang-66): tools/game-exports.mjs finds the game's data by its CONTENT, whatever the short names of the minified module are
// (they change with every game update). A small stand-in module with made-up names, in the style of before and after the update of 2026-11-03.
const fs = require('fs'), path = require('path'), os = require('os');
let pass = 0, fail = 0; const ok = (l, c, x) => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + String(JSON.stringify(x)).slice(0, 500))); c ? pass++ : fail++; };
const helper = path.join(__dirname, 'tools', 'game-exports.mjs');
const fake = settings => `
const sp = [${[1, 4, 7, 102, 255, 300, 400].map((id, i) => `{id:${id},name:'Mon${id}',types:['GRASS'],base:{hp:1,atk:1,def:1,spa:1,spd:1,spe:1},learnset:[],experience:${10 + i},sellValue:${5 + i},huntLevel:1}`).join(',')}];
const hu = [{id:'start-1',name:'Bosque do Mon1',type:'GRASS',species:[1],level:20},{id:'grass-10',name:'Selva Tropical dos Mon102',type:'GRASS',species:[102],level:10},
            {id:'torchic',name:'Monte Chaminé dos Mon255',type:'FIRE',species:[255],level:300},{id:'deep',name:'Lago do Mon400',type:'WATER',species:[400],level:600}];
const it = [{id:'poke-ball',name:'Poké Ball',kind:'ball',buyPrice:10,npcPrice:5,catchRate:1,captureValue:1},{id:'seed',name:'Semente',kind:'loot',buyPrice:0,npcPrice:3}];
const mv = [{id:'absorb',name:'Absorb',type:'GRASS',category:'SPECIAL',power:20}];
const cfg = ${settings};
function q9(id) { return sp.find(s => s.id === id); }
function zz(id) { return id >= 400 ? 'sinnoh' : id >= 252 ? 'hoenn' : 'kanto'; }
function k3(id) { return id === 300 ? [] : [{item:'seed',chance:70000,min:1,max:3}]; }
function w7(h) { return h.species.some(id => cfg.starters.includes(id)) ? 1 : Math.max(1, h.level); }
function decoy(h) { return Math.max(1, h.level); }
const other = { region: 'x' };
export { sp as Qa, hu as Zz, it as b1, mv as r5, cfg as X, q9 as e, zz as t, k3 as m, w7 as y, decoy as o, other as p };`;
(async () => {
  const { loadGame } = await import('file://' + helper);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ge-'));
  const NEW = "{starters:[1,4,7],wild:{},combat:{},moves:{},killXpCurve:{killsPerHour:1000,xpMultiplier:1.5,fixedKillXp:[{level:300,xp:5520}]}}";
  const OLD = "{starters:[1,4,7],wild:{},combat:{},moves:{},killXpMultiplier:0.45,killXpByHuntLevel:{},killXpHuntLevelBands:[],regionKillXpMultiplier:{kanto:1,hoenn:1,sinnoh:1}}";
  for (const [label, settings] of [['the style since 2026-11-03 (killXpCurve)', NEW], ['the style before (killXpByHuntLevel)', OLD]]) {
    const f = path.join(dir, 'g' + label.length + '.mjs'); fs.writeFileSync(f, fake(settings));
    const g = await loadGame('file://' + f);
    ok(label + ': items, hunts, species, moves and settings are found under made-up names', g.names.items === 'b1' && g.names.hunts === 'Zz' && g.names.species === 'Qa' && g.names.moves === 'r5' && g.names.cfg === 'X', g.names);
    ok('...and the four functions by what they answer: a species by id, its region, its drops, the unlock level (1 for a starter hunt, not the look-alike)', g.names.speciesById === 'e' && g.names.regionOf === 't' && g.names.drops === 'm' && g.names.unlockOf === 'y' && g.unlockOf(g.hunts[0]) === 1 && g.speciesById(255).name === 'Mon255', g.names);
  }
  const broken = path.join(dir, 'broken.mjs'); fs.writeFileSync(broken, fake(NEW).replace(/learnset:\[\],/g, ''));
  let msg = ''; try { await loadGame('file://' + broken); } catch (e) { msg = e.message; }
  ok('a module where something cannot be found: the build stops and says what is missing (it never builds a half-wrong list)', /could not find the species/.test(msg), msg);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED ' + e.message + '\n' + e.stack); process.exit(1); });
