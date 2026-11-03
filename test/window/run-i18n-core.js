const { chromium } = require('./pw');
const fs = require('fs'), path = require('path');
const out = console.log.bind(console);
let pass = 0, fail = 0; const ok = (l, c, x) => { out((c ? '  PASS  ' : '  FAIL  ') + l + (c ? '' : '   ' + JSON.stringify(x))); c ? pass++ : fail++; };
const I = require('./i18n');
I.add('pt-BR', { 'Log in all': 'Entrar em todas', 'Looked at {n} panels ({m} not sending data)': 'Olhei {n} painéis ({m} sem enviar dados)', 'Cancel': 'Cancelar', 'constructor': 'construtor', 'toString': 'texto', 'A <b>bold</b> word': 'Uma palavra <b>forte</b>', 'Twice {x} and {x}': 'Duas vezes {x} e {x}' });

// ---- which language
const norm = ['pt-BR', 'pt_br', 'PT', 'pt-br', ' pt-BR '].map(I.normalize), other = ['en', 'EN', 'fr', '', null, undefined, 123, 'pt-PT-x', {}].map(I.normalize);
ok('pt-BR, pt_br, PT, pt-br (with spaces too) all mean pt-BR', norm.every(x => x === 'pt-BR'), norm);
ok('English, other languages, empty, null, undefined, a number or an object all mean English', other.every(x => x === 'en'), other);
ok('the language starts as English', I.getLang() === 'en');

// ---- lookup
ok('English: the text itself, with {names} filled', I.t('Log in all') === 'Log in all' && I.t('Looked at {n} panels ({m} not sending data)', { n: 4, m: 1 }) === 'Looked at 4 panels (1 not sending data)');
ok('a {name} with no value is left as it is (not "undefined"); 0 and "" are values', I.t('Looked at {n} panels ({m} not sending data)', { n: 0 }) === 'Looked at 0 panels ({m} not sending data)' && I.t('a{x}b', { x: '' }) === 'ab' && I.t('a{x}b', { x: null }) === 'a{x}b' && I.t('a{x}b', { x: undefined }) === 'a{x}b');
ok('the same name twice is filled twice; HTML in a text is kept', I.t('Twice {x} and {x}', { x: 7 }) === 'Twice 7 and 7' && I.t('A <b>bold</b> word') === 'A <b>bold</b> word');
const events = []; I.onChange(l => events.push(l)); I.onChange(() => { throw new Error('a listener that breaks'); }); I.onChange(l => events.push('after:' + l));
ok('setLang gives true when it changed, false when it did not; every listener is told, also those after one that throws', I.setLang('pt-BR') === true && I.setLang('pt-BR') === false && JSON.stringify(events) === JSON.stringify(['pt-BR', 'after:pt-BR']), events);
ok('Portuguese: the dictionary text, with {names} filled', I.t('Log in all') === 'Entrar em todas' && I.t('Looked at {n} panels ({m} not sending data)', { n: 4, m: 1 }) === 'Olhei 4 painéis (1 sem enviar dados)' && I.t('A <b>bold</b> word') === 'Uma palavra <b>forte</b>');
ok('a text that is not in the dictionary stays English (never blank) and is noted as missing, once', I.t('Not in the dictionary {x}', { x: 1 }) === 'Not in the dictionary 1' && (I.t('Not in the dictionary {x}', { x: 2 }), I.missing.has('Not in the dictionary {x}') && I.missing.size === 1), [...I.missing]);
ok('words that are properties of every object ("constructor", "toString", "hasOwnProperty", "valueOf", "__proto__") are looked up as plain keys, and do not break a text that is not there', I.t('constructor') === 'construtor' && I.t('toString') === 'texto' && I.t('__proto__') === '__proto__' && I.t('hasOwnProperty') === 'hasOwnProperty' && I.t('valueOf') === 'valueOf');
ok('tFor works for a language without changing the current one (how the English report is made while the window is in Portuguese)', I.tFor('en')('Log in all') === 'Log in all' && I.tFor('pt-BR')('Cancel') === 'Cancelar' && I.getLang() === 'pt-BR');
ok('add() merges into what is there: a second call keeps the first entries and can replace one', (() => { I.add('pt-BR', { 'Cancel': 'Cancelar!' , 'New one': 'Novo' }); const r = I.t('Cancel') === 'Cancelar!' && I.t('New one') === 'Novo' && I.t('Log in all') === 'Entrar em todas'; I.add('pt-BR', { 'Cancel': 'Cancelar' }); return r; })());

// ---- numbers
I.setLang('en');
const en = [I.int(1384), I.int(1234567.6), I.int(-1500), I.int(NaN), I.int(undefined), I.int('12'), I.num(0.25, 2), I.num(2, 0), I.num(1234.5678, 1), I.num(-0.5, 1), I.dec('63.9K / 1.5 s'), I.full(1234567.89)];
I.setLang('pt-BR');
const pt = [I.int(1384), I.int(1234567.6), I.int(-1500), I.int(NaN), I.int(undefined), I.int('12'), I.num(0.25, 2), I.num(2, 0), I.num(1234.5678, 1), I.num(-0.5, 1), I.dec('63.9K / 1.5 s'), I.full(1234567.89)];
ok('English numbers: 1,384 and 1,234,568 and -1,500; nonsense (NaN, undefined) is 0; decimals use a point; dec() leaves a point alone', JSON.stringify(en) === JSON.stringify(['1,384', '1,234,568', '-1,500', '0', '0', '12', '0.25', '2', '1234.6', '-0.5', '63.9K / 1.5 s', '1,234,568']), en);
ok('Portuguese numbers: 1.384 and 1.234.568 and -1.500; decimals use a comma (0,25 and 1234,6); dec() turns 63.9K into 63,9K and 1.5 s into 1,5 s', JSON.stringify(pt) === JSON.stringify(['1.384', '1.234.568', '-1.500', '0', '0', '12', '0,25', '2', '1234,6', '-0,5', '63,9K / 1,5 s', '1.234.568']), pt);
ok('dec() does not touch a number without decimals, nor a version-like or list text that is not a decimal (1.2.3 keeps its shape apart from the first pair): 1.384 stays', I.dec('1.384') === '1,384' && I.dec('a.b') === 'a.b' && I.dec('v1') === 'v1');
ok('locale() follows the language', I.locale() === 'pt-BR' && (I.setLang('en'), I.locale() === 'en-US'));
I.setLang('en');

// ---- the page
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
  const src = fs.readFileSync('i18n.js', 'utf8');
  fs.writeFileSync('blank.html', '<!doctype html><html><body></body></html>'); await p.goto('file://' + path.resolve('blank.html')); await p.addScriptTag({ content: src });
  await p.evaluate(() => I18N.add('pt-BR', { 'Log in all': 'Entrar em todas', 'Cancel': 'Cancelar', 'Sign in every panel': 'Entre em todos os painéis', 'E-mail or username': 'E-mail ou usuário', 'Close': 'Fechar', 'All accounts': 'Todas as contas', 'Skip me': 'Pule-me', 'Zoom out': 'Diminuir' }));
  await p.evaluate(() => { document.body.innerHTML = '<div id="a"><button id="b1" title="Sign in every panel">  Log in all  </button><input id="i1" placeholder="E-mail or username"><img id="im" alt="Close" src="data:,"><span id="s1" aria-label="Zoom out">x</span>' +
    '<select id="sel"><option value="all">All accounts</option><option value="x">trainer2</option></select><p id="mix">Cancel <b id="bold">Close</b> and trainer2 99</p><div id="skipme" data-no-i18n>Cancel<span title="Close">y</span></div>' +
    '<textarea id="ta">Cancel</textarea><style id="st">.x{}</style><script id="sc">/*Cancel*/</script><p id="unk">A text nobody translated</p></div>'; });
  const snap = () => p.evaluate(() => ({ b1: document.getElementById('b1').textContent, b1t: document.getElementById('b1').title, ph: document.getElementById('i1').placeholder, alt: document.getElementById('im').alt, al: document.getElementById('s1').getAttribute('aria-label'),
    opts: Array.from(document.querySelectorAll('#sel option')).map(o => o.textContent + '=' + o.value), mix: document.getElementById('mix').innerHTML, skip: document.getElementById('skipme').innerHTML, ta: document.getElementById('ta').value, ta2: document.getElementById('ta').textContent, st: document.getElementById('st').textContent, unk: document.getElementById('unk').textContent }));
  const en0 = await snap();
  await p.evaluate(() => { I18N.setLang('pt-BR'); I18N.dom(document.body); }); const pt1 = await snap();
  ok('in Portuguese the text of a button (keeping its spaces), its tooltip, a placeholder, an image alt, an aria-label and the text of the options are translated; the VALUES of the options are not', pt1.b1 === '  Entrar em todas  ' && pt1.b1t === 'Entre em todos os painéis' && pt1.ph === 'E-mail ou usuário' && pt1.alt === 'Fechar' && pt1.al === 'Diminuir' && pt1.opts[0] === 'Todas as contas=all' && pt1.opts[1] === 'trainer2=x', pt1);
  ok('...text between elements: "Cancel" translated, the bold "Close" translated, the account name and the number around them left alone', pt1.mix === 'Cancelar <b id="bold">Fechar</b> and trainer2 99', pt1.mix);
  ok('...an element with data-no-i18n (and everything in it), a textarea, a style and a script are left alone, and a text with no entry stays as it is', pt1.skip === en0.skip && pt1.ta === 'Cancel' && pt1.st === en0.st && pt1.unk === 'A text nobody translated', pt1);
  await p.evaluate(() => { I18N.dom(document.body); }); const pt2 = await snap();
  ok('running it again changes nothing (nothing is translated twice)', JSON.stringify(pt2) === JSON.stringify(pt1));
  await p.evaluate(() => { I18N.setLang('en'); I18N.dom(document.body); }); const en1 = await snap();
  ok('back to English everything is exactly what it was before: text, spaces, tooltips, placeholders, alt, aria-label, options and the mixed paragraph', JSON.stringify(en1) === JSON.stringify(en0), [en0, en1]);
  await p.evaluate(() => { I18N.setLang('pt-BR'); I18N.dom(document.body); document.getElementById('b1').textContent = 'Cancel'; I18N.dom(document.body); });
  ok('text that the page itself writes later (new English) is translated when it is run again; the old original is forgotten', (await snap()).b1 === 'Cancelar');
  await p.evaluate(() => { document.getElementById('b1').title = 'Close'; I18N.dom(document.body); });
  ok('...and so is a tooltip rewritten by the page', (await snap()).b1t === 'Fechar');
  await p.evaluate(() => { I18N.setLang('en'); I18N.dom(document.body); }); const en2 = await snap();
  ok('...and in English again it shows what the page wrote (Cancel, Close), not the first original', en2.b1 === 'Cancel' && en2.b1t === 'Close', en2);
  // a part of the page only
  await p.evaluate(() => { document.getElementById('b1').textContent = 'Log in all'; document.getElementById('b1').title = 'Sign in every panel'; I18N.setLang('pt-BR'); I18N.dom(document.getElementById('sel')); });
  const part = await snap();
  ok('translating one element translates only inside it: the options change, the button next to it does not', part.opts[0].indexOf('Todas as contas') === 0 && part.b1 === 'Log in all', part);
  // the whole page, fast
  const ms = await p.evaluate(() => { let h = ''; for (let i = 0; i < 6000; i++) h += '<div class="r"><span>Cancel</span><i title="Close">Log in all</i><b>trainer\d' + i + '</b></div>'; const d = document.createElement('div'); d.innerHTML = h; document.body.appendChild(d); const t0 = performance.now(); I18N.dom(document.body); const t1 = performance.now() - t0; I18N.setLang('en'); const t2s = performance.now(); I18N.dom(document.body); return [t1, performance.now() - t2s]; });
  ok('6000 rows (18000 texts and 6000 tooltips) are translated in under 1.5 s and put back in under 1.5 s (' + ms.map(x => Math.round(x) + ' ms').join(' and ') + ')', ms[0] < 1500 && ms[1] < 1500, ms);
  await p.evaluate(() => { I18N.setLang('pt-BR'); localStorage.clear(); });
  const stored = await p.evaluate(() => { I18N.save('pt_br'); const a = localStorage.getItem('4h.lang'); I18N.setLang('en'); const l = I18N.load(); return [a, l, I18N.getLang()]; });
  ok('save() keeps the language under "4h.lang" in its normal spelling and load() brings it back (and tells the listeners)', stored[0] === 'pt-BR' && stored[1] === 'pt-BR' && stored[2] === 'pt-BR', stored);
  const attr = await p.evaluate(() => document.documentElement.getAttribute('lang'));
  ok('the <html lang> follows the language (pt-BR)', attr === 'pt-BR', attr);
  // poke(): the main process builds its menus again (the tray) when something other than the language changed
  { const I = require('./i18n'); const got = []; I.onChange(l => got.push(l)); I.setLang('pt-BR'); const n0 = got.length; I.poke();
    ok('poke() calls the listeners once with the language that is set, and does not change it', got.length === n0 + 1 && got[got.length - 1] === 'pt-BR' && I.getLang() === 'pt-BR', got);
    I.onChange(() => { throw new Error('a listener that fails'); }); let threw = false; try { I.poke(); } catch (e) { threw = true; }
    ok('a listener that throws does not stop poke() or the other listeners', !threw && got.length === n0 + 2, got); I.setLang('en'); }
  await b.close();
  out('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { out('FAILED: ' + e.message + '\n' + e.stack); process.exit(1); });
