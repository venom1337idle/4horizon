# build.py: collects the Portuguese texts of pt/*.py, checks them against every text the app asks for, and writes i18n-pt.js.
#   python3 build.py check            only checks         python3 build.py write OUT.js     checks and writes
import re, sys, json, glob, importlib.util, os
from keys import keys_in
from static_html import static_texts
HERE = os.path.dirname(os.path.abspath(__file__))
SOURCES = {   # the files whose t('...') calls are the dynamic texts, and the static-text files made by static_keys.js
  'dynamic': ['index.html', 'dashboard.html', 'history-ui.js', 'diag-core.js', 'notify.js', 'diag.js', 'missions.js', 'live.js'],
  'static': ['index.html', 'dashboard.html']}      # the text written in the markup of these pages
def load_areas():
    areas = []
    for f in sorted(glob.glob(os.path.join(HERE, 'pt', '*.py'))):
        spec = importlib.util.spec_from_file_location(os.path.basename(f)[:-3], f); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        areas.append((os.path.basename(f)[:-3], getattr(m, 'EXACT', {}), getattr(m, 'PREFIX', {}), getattr(m, 'INDIRECT', {})))
    return areas
def used_keys():
    used = {}
    for f in SOURCES['dynamic']:
        p = os.path.join(HERE, f)
        if not os.path.exists(p): continue
        for k, line in keys_in(open(p, encoding='utf-8').read().replace('\r\n', '\n')): used.setdefault(k, []).append(f + ':' + str(line))
    for f in SOURCES['static']:
        p = os.path.join(HERE, f)
        if os.path.exists(p):
            for k in static_texts(p): used.setdefault(k, []).append(f + ' (markup)')
    return used
# static texts that are not the interface: the brand, and the account names that the test stand-ins carry
NOT_TEXT = [re.compile(p) for p in (r'^4horizon$', r'^trainer1\d?$', r'^Conta \d$', r'^<img ')]
PH = re.compile(r'\{(\w+)\}'); TAG = re.compile(r'</?([a-zA-Z0-9]+)[^>]*>')
def check(areas, used, extra_used=()):
    problems, dictionary, owner = [], {}, {}
    pool = set(used) | set(extra_used)
    for name, exact, prefix, indirect in areas:
        for src in (exact, indirect):
            for k, v in src.items():
                if k in dictionary and dictionary[k] != v: problems.append(('two different translations', k, name + ' and ' + owner[k]))
                dictionary[k] = v; owner[k] = name; pool.add(k) if src is indirect else None
        for pre, v in prefix.items():
            hits = [k for k in pool if k.startswith(pre)]
            if len(hits) != 1: problems.append(('prefix matches %d texts' % len(hits), pre, ''))
            else: dictionary[hits[0]] = v; owner[hits[0]] = name
    for k, v in dictionary.items():
        if not v.strip(): problems.append(('empty translation', k, ''))
        if sorted(PH.findall(k)) != sorted(PH.findall(v)): problems.append(('placeholders differ', k, v))
        if [t.lower() for t in TAG.findall(k)] != [t.lower() for t in TAG.findall(v)]: problems.append(('html tags differ', k, v))
    return problems, dictionary, owner
def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'check'
    areas = load_areas(); used = used_keys()
    indirect = {k for _, _, _, ind in areas for k in ind}
    problems, dictionary, owner = check(areas, used)
    missing = sorted(k for k in used if k not in dictionary and not any(p.search(k) for p in NOT_TEXT))
    unused = sorted(k for k in dictionary if k not in used and k not in indirect)
    print('%d texts asked for, %d translated, %d indirect, %d areas' % (len(used), len(dictionary), len(indirect), len(areas)))
    for p in problems: print('  PROBLEM', p[0], '|', p[1][:90], '|', p[2][:60])
    print('  missing (asked for, no translation): %d' % len(missing)); [print('     ', repr(k[:120]), used[k][0]) for k in missing[:int(os.environ.get('SHOW', 12))]]
    print('  unused (translated, nobody asks): %d' % len(unused)); [print('     ', repr(k[:120])) for k in unused[:6]]
    if mode == 'write':
        out = sys.argv[2]
        lines = ["// i18n-pt.js: the Brazilian Portuguese texts of the app. The English text is the key; a text that is not here is shown in English.", "// To change a text, change the Portuguese after the colon (keep every {name} and every <b> tag as in the English). Restart the app to see it.", "(function () {", "  const I18N = (typeof module === 'object' && module.exports) ? require('./i18n') : window.I18N;", "  I18N.add('pt-BR', {"]
        for name, exact, prefix, indirect_ in areas:
            ks = [k for k in dictionary if owner[k] == name]
            lines.append('    // ---- ' + name)
            for k in sorted(ks, key=lambda x: (x.lower(), x)): lines.append('    ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(dictionary[k], ensure_ascii=False) + ',')
        lines += ['  });', '})();', '']
        open(out, 'w', encoding='utf-8').write('\n'.join(lines)); print('written', out, len(dictionary), 'texts')
    return 1 if (problems or missing) else 0
sys.exit(main())
