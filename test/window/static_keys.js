// static_keys.js: the text that is WRITTEN IN a page (labels, buttons, tooltips, options, dialog text), found by loading it: every text node and every title / placeholder / aria-label / alt.
const { chromium } = require('./pw');
const path = require('path'), fs = require('fs');
(async () => {
  const [file, outFile, dirArg] = process.argv.slice(2);
  const dir = dirArg || '.';
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1700, height: 1000 } });
  await ctx.route(/fonts\./, r => r.abort());
  const head = fs.readFileSync(path.join(dir, 'run-diag-ui.js'), 'utf8'); const upto = head.indexOf('async function open(');
  const defs = new Function('require', 'process', head.slice(0, upto) + '; return { BRIDGE };')(require, process);
  if (/index\.html$/.test(file)) await ctx.addInitScript(defs.BRIDGE);
  const p = await ctx.newPage(); await p.goto('file://' + path.resolve(dir, file)); await p.waitForTimeout(900);
  const keys = await p.evaluate(() => {
    const out = new Set(); const skip = e => { for (let x = e; x && x.nodeType === 1; x = x.parentElement) if (['SCRIPT', 'STYLE', 'TEXTAREA'].indexOf(x.tagName) >= 0 || x.hasAttribute('data-no-i18n')) return true; return false; };
    const tw = document.createTreeWalker(document.body, 4); for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (skip(n.parentElement)) continue; const s = n.nodeValue.trim(); if (/[A-Za-z]{3,}/.test(s)) out.add(s); }
    document.querySelectorAll('[title],[placeholder],[aria-label],[alt]').forEach(e => { if (skip(e)) return; ['title', 'placeholder', 'aria-label', 'alt'].forEach(a => { const v = e.getAttribute(a); if (v && /[A-Za-z]{3,}/.test(v)) out.add(v.trim()); }); });
    return Array.from(out);
  });
  await b.close();
  fs.writeFileSync(outFile, JSON.stringify(keys.sort(), null, 1)); console.log(keys.length + ' static texts from ' + file);
})();
