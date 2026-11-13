// theme.js: shared colours. (HG_TYPE, the colour of a hunt's type, is no longer used for the headers: they now take the colour of their ACCOUNT, see HG_ACCOUNT at the end.)
// The colour of a hunt's header, by the type of the hunt.
// The game's hunt ids begin with the type ("ground-10", "psychic-10", "rock-60", "water-300-1"), and its hunt cards are
// coloured by that type (the green Planta header on the Bosque dos Bulbasaur card). The panels and the dashboard do the same.
// Each type has: a dark colour (left of the header), a lighter one (right) and a bright edge colour (the line on top, the ring).
(function () {
  var T = {
    grass:    ['#2b5c2b', '#3d863a', '#7ac74c'],
    fire:     ['#7d2f1a', '#b04a22', '#ff9a5a'],
    water:    ['#1f4a86', '#2c6cc0', '#74b8ff'],
    electric: ['#7d6a14', '#b0911c', '#ffe066'],
    psychic:  ['#7a2a62', '#ad3d8a', '#ff8fd6'],
    ghost:    ['#40307a', '#5d45a8', '#b79bff'],
    poison:   ['#582a78', '#7e3ea8', '#d28fff'],
    ground:   ['#6b4f24', '#92702f', '#e0b46a'],
    rock:     ['#5a4e36', '#7d6d49', '#cbb98a'],
    bug:      ['#476a1c', '#6a9026', '#bde85a'],
    flying:   ['#3a5d8c', '#5584bc', '#a5d3ff'],
    ice:      ['#256a78', '#3a92a3', '#8ff0ff'],
    dragon:   ['#2e2e84', '#4242b6', '#9a9aff'],
    dark:     ['#2b2b3a', '#46465c', '#8a8aa8'],
    steel:    ['#46586a', '#677c90', '#b8c8d8'],
    fairy:    ['#85365f', '#b9528f', '#ffb0dc'],
    fighting: ['#7a2a2a', '#a63c3c', '#ff8a8a'],
    normal:   ['#5a5a50', '#7c7c6e', '#d0d0c0']
  };
  var DEFAULT = ['#1a2548', '#28396e', '#e3c06b'];        // a hunt without a known type: navy with a gold edge

  // colours for a hunt id, always an answer (the default when the type is not known)
  window.HG_TYPE = function (huntId) {
    var t = String(huntId || '').split('-')[0].toLowerCase();
    var c = T[t] || DEFAULT;
    return { type: T[t] ? t : null, a: c[0], b: c[1], edge: c[2] };
  };
  window.HG_TYPES = Object.keys(T);

  // ---------------------------------------------------------------------------------------------------------------
  // The game's colour ladder. On its own screens the game colours the tier words and the IV numbers with the same six colours:
  // gray, green, blue, purple, orange, pale yellow (the bars of a Pok\u00e9mon's stats use them too).
  var L = { gray: '#d3d3d3', green: '#88e788', blue: '#0f52ba', purple: '#8a00c4', orange: '#ffa500', red: '#95101b', pale: '#ffffc5' };
  window.HG_LADDER = L;

  // The tier words (Fraca, Comum, Incomum, Rara, \u00c9pica, Lend\u00e1ria...). What was SEEN in the game: Fraca and Comum gray, Incomum green, Rara blue,
  // Lend\u00e1ria orange. \u00c9pica is purple because that is the step between blue and orange in the same ladder. M\u00edtica is red (seen on the badge of a shiny Golem, \u00d72.44). Anci\u00e3 and Divina
  // have not been seen yet: they use the top colour of the ladder until their real colours are known (change them here).
  var TIER = {
    fraca: L.gray, weak: L.gray, comum: L.gray, common: L.gray,
    incomum: L.green, uncommon: L.green,
    rara: L.blue, rare: L.blue,
    epica: L.purple, epic: L.purple,
    lendaria: L.orange, legendary: L.orange,
    mitica: L.red, mythic: L.red,
    ancia: L.pale, ancient: L.pale, divina: L.pale, divine: L.pale
  };
  window.HG_TIER = function (word) {
    var k = String(word || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return TIER[k] || null;
  };

  // The IV total (out of 192). What was SEEN in the game (the Hunt Analyzer, Capturas tab): 62 to 83 gray, 94 to 112 green, 114 to 139 blue, 146 purple (166 is still purple),
  // 168 and 174 orange, 181 red (the dark red of the ladder, #95101b: measured on the badge). The limits sit between the numbers that were seen: 90, 113, 144, and 168 for orange
  // (167 was not seen); above 180 it is red, up to the top.
  window.HG_IV = function (iv) {
    iv = Number(iv) || 0;
    return iv > 180 ? L.red : iv >= 168 ? L.orange : iv >= 144 ? L.purple : iv >= 113 ? L.blue : iv >= 90 ? L.green : L.gray;
  };

  // ---------------------------------------------------------------------------------------------------------------
  // ONE COLOUR PER ACCOUNT, used everywhere: its dot, its button in the top bar, the ring of its emblem, the band of its header (in the
  // panels and in the summary), its tab, its dots in the lists. They were chosen as a family: the same lightness and chroma (in the CIE LCH
  // colour space) with only the hue changing, so they sit well on the navy; away from the app's gold, green and red so that an account is never
  // mistaken for "profit", "loss" or the gold highlight; and far enough from each other to be told apart by colour-blind eyes too.
  //   base = the bright colour (dots, ring, the line on top of a band)   a / b = the dark and the lighter end of the header band
  window.HG_ACCOUNT = [          // lang-71: palette D, easy to tell apart (also for colour-blind eyes): sky, teal, vermilion, orchid
  { name: 'sky', base: '#56b4e9', a: '#214059', b: '#2d5b7a' },
  { name: 'teal', base: '#34c39a', a: '#174542', b: '#1d6256' },
  { name: 'vermilion', base: '#e7694a', a: '#4c2a2a', b: '#703831' },
  { name: 'orchid', base: '#cc79a7', a: '#442f46', b: '#63405c' }
];
})();
