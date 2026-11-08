# leak.py PT.json: every text node of every state that still reads as English in the Portuguese run
import json, re, sys
G = json.load(open(sys.argv[1], encoding='utf-8'))
EN = set('the and of is are with this that from your you not can will has have by or when than which what how only if in on at to it its yet still'.split())
SKIP_STATES = {'win:diag-report'}                     # the copyable report is English on purpose
ALLOW = [re.compile(p) for p in (r'^[\W\d_]*$',)]
def english(line):
    words = re.findall(r"[^\W\d_]+(?:'[^\W\d_]+)?", line.lower())
    hits = [w for w in words if w in EN]
    return hits
found = {}
for st, v in G.items():
    if st.startswith('errors') or st in SKIP_STATES: continue
    for part in ('text', 'attrs', 'options'):
        items = v[part].split('\n') if part == 'text' else v[part]
        for l in items:
            l2 = re.sub(r'^(title|placeholder|aria-label|alt): ', '', l)
            if any(a.search(l2) for a in ALLOW): continue
            h = english(l2)
            if h: found.setdefault(l2, set()).add(st)
print(len(found), 'texts that still read as English')
mx = int(sys.argv[2]) if len(sys.argv) > 2 else 40
for l, sts in sorted(found.items(), key=lambda x: -len(x[1]))[:mx]: print('  [%d states] %s' % (len(sts), l[:150].replace('\n', ' ')))
