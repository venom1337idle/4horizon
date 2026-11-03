// i18n.js: the language of the app. Shared by the window, the dashboard and the main process.
//
// English is the KEY: t('Log in all') gives 'Log in all' in English and the Portuguese text in pt-BR (the dictionary is in i18n-pt.js). A text with no entry is shown in
// English, never blank, and is noted in I18N.missing so that a test can find it. A text can have {names} in it that are filled from the second argument:
//     t('Looked at {n} panels', { n: 4 })
// The numbers follow the language too: 1,384 and 0.25 in English, 1.384 and 0,25 in Portuguese.
//
// Static text of a page (labels, buttons, tooltips written in the HTML) is translated by I18N.dom(root), which looks up the text of each node as it is written and puts the
// original back when the language goes back to English.

(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.I18N = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const LANGS = [{ id: 'en', name: 'English' }, { id: 'pt-BR', name: 'Portugu\u00eas (Brasil)' }];
  const LOCALE = { 'en': 'en-US', 'pt-BR': 'pt-BR' };
  const STORE = '4h.lang';
  const dicts = {};
  const listeners = [];
  const missing = new Set();
  let lang = 'en';

  // any spelling of a language becomes one of the two known ids; anything else is English
  function normalize(l) {
    const s = String(l === undefined || l === null ? '' : l).trim().toLowerCase().replace('_', '-');
    return (s === 'pt-br' || s === 'pt') ? 'pt-BR' : 'en';
  }
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function add(l, d) { const id = normalize(l); dicts[id] = Object.assign(dicts[id] || {}, d); }
  function fill(s, p) {
    if (!p) return String(s);
    return String(s).replace(/\{(\w+)\}/g, (m, k) => (p[k] === undefined || p[k] === null ? m : String(p[k])));
  }
  // the translation of an English text in a language, or null when there is none (English: the text itself)
  function lookup(en, l) { const d = dicts[l]; return d && has(d, en) ? d[en] : null; }
  function tFor(l) {
    const id = normalize(l);
    return function (en, p) {
      if (id === 'en') return fill(en, p);
      const tr = lookup(en, id);
      if (tr === null) { missing.add(en); return fill(en, p); }
      return fill(tr, p);
    };
  }
  const t = function (en, p) { return tFor(lang)(en, p); };

  // ---- numbers
  const locale = () => LOCALE[lang];
  const int = n => Math.round(Number(n) || 0).toLocaleString(locale());                                         // 1384 -> "1,384" / "1.384"
  const full = n => Number(n).toLocaleString(locale(), { maximumFractionDigits: 0 });
  const num = (x, d) => { const s = Number(x).toFixed(d); return lang === 'en' ? s : s.replace('.', ','); };   // like toFixed, with the decimal sign of the language
  const dec = s => (lang === 'en' ? String(s) : String(s).replace(/(\d)\.(\d)/g, '$1,$2'));                     // a number already written with a point: 63.9K -> 63,9K

  // ---- the language itself
  function getLang() { return lang; }
  function setLang(l) {
    const id = normalize(l);
    if (id === lang) return false;
    lang = id;
    try { if (root && root.document && root.document.documentElement) root.document.documentElement.setAttribute('lang', id); } catch (e) {}
    listeners.slice().forEach(f => { try { f(id); } catch (e) {} });
    return true;
  }
  function poke() { listeners.slice().forEach(f => { try { f(lang); } catch (e) {} }); }                // the menus of the main process are built again (something other than the language changed)
  function onChange(f) { if (typeof f === 'function') listeners.push(f); }
  // the language saved by the page (localStorage), if there is one
  function load() { try { const v = root.localStorage && root.localStorage.getItem(STORE); if (v) { setLang(v); return lang; } } catch (e) {} return lang; }
  function save(l) { try { root.localStorage && root.localStorage.setItem(STORE, normalize(l)); } catch (e) {} }

  // ---- the static text of a page
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, OPTION_NO: 1 };
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const origText = new WeakMap(), appliedText = new WeakMap();      // text node -> what it said in English / what was written into it
  const origAttr = new WeakMap(), appliedAttr = new WeakMap();      // element -> { attr: ... }
  function translateExact(s) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    if (!m[2] || lang === 'en') return null;
    const tr = lookup(m[2], lang);
    return tr === null ? null : m[1] + tr + m[3];
  }
  function dom(rootNode) {
    const doc = root && root.document; if (!doc) return;
    const start = rootNode || doc.body; if (!start) return;
    const skipped = el => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { if (SKIP[e.tagName] || (e.hasAttribute && e.hasAttribute('data-no-i18n'))) return true; } return false; };
    const tw = doc.createTreeWalker(start, 4 /* SHOW_TEXT */, null);
    const nodes = []; for (let n = tw.nextNode(); n; n = tw.nextNode()) nodes.push(n);
    nodes.forEach(n => {
      if (skipped(n.parentElement)) return;
      const cur = n.nodeValue;
      const orig = (appliedText.has(n) && appliedText.get(n) === cur) ? origText.get(n) : cur;          // somebody wrote new text into it: that is the new original
      origText.set(n, orig);
      const tr = translateExact(orig), out = tr === null ? orig : tr;
      if (out !== cur) n.nodeValue = out;
      appliedText.set(n, out);
    });
    const els = start.nodeType === 1 ? [start].concat(Array.from(start.querySelectorAll('[title],[placeholder],[aria-label],[alt]'))) : Array.from(start.querySelectorAll('[title],[placeholder],[aria-label],[alt]'));
    els.forEach(el => {
      if (skipped(el)) return;
      const o = origAttr.get(el) || {}, a = appliedAttr.get(el) || {};
      ATTRS.forEach(at => {
        if (!el.hasAttribute(at)) return;
        const cur = el.getAttribute(at);
        const orig = (a[at] !== undefined && a[at] === cur) ? o[at] : cur;
        o[at] = orig;
        const tr = translateExact(orig), out = tr === null ? orig : tr;
        if (out !== cur) el.setAttribute(at, out);
        a[at] = out;
      });
      origAttr.set(el, o); appliedAttr.set(el, a);
    });
  }

  return { t, tFor, add, normalize, getLang, setLang, onChange, poke, load, save, dom, LANGS, locale, int, full, num, dec, fill, missing, lookup, dicts, STORE };
});
