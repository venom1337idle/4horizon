# compare.py GOLDEN NEW: is the English screen still the same? Window states are compared without the top bar and the panel headers (they changed on purpose).
import json, sys
# lang-35: the explanation of the button of the comparison (a hidden tooltip, read by the harness like any text); it is removed from the NEW side only, once, and only as the whole block in this order
CMP_TIP = ['Choose what this hunt is compared with: the previous hunt, or one of the 5 best hunts of this account, from best to worst.', 'Rank by:', '$', 'gold per hour,', 'XP', 'XP per hour,', '$+XP', 'both together (each as a share of this account\u2019s best hunt, then added).', 'Each hunt is the average of all the time this account spent on it, kept on this computer.', 'For a reliable average spend at least 30 minutes on a hunt (in one visit or several); 1 hour or more is best. Hunts with less are marked \u25cb.']
CAP_SORT = ['latest', 'highest IV', 'highest quality', 'IV \u00d7 Quality']        # lang-37: the order menu of Latest captures (its four options, just before "shiny only")
import re as _re
def team_out(text):            # lang-40: the team of the Summary is one card plus icons now (tested by run-summary-compact / run-team-card): the block from "Team" to "Session" is left out
    ls = text.split('\n'); out = []; skip = False
    for l in ls:
        if l == 'Team': skip = True; continue
        if skip and l == 'Session': skip = False
        if not skip: out.append(l)
    return '\n'.join(out)
def eggs_out(text):            # lang-44: the incubators are rings now (tested by run-eggs): the card, from its title to the next card, is left out
    ls = text.split('\n'); out = []; skip = False
    for l in ls:
        if l.startswith('Incubators \u00b7'): skip = True; continue
        if skip and l.startswith('Latest captures \u00b7'): skip = False
        if not skip: out.append(l)
    return '\n'.join(out)
def today_out(text):           # lang-47: the day's tracker (tested by run-today) is the last card of the Overview: from its title to the end
    ls = text.split('\n')
    for i, l in enumerate(ls):
        if l.startswith('Today\u2019s highlights \u00b7 00:00 to 23:59'): return '\n'.join(ls[:i])
    return text
def drop_one(items, block):
    items = list(items)
    for x in block:
        if x in items: items.remove(x)
    return items
def drop_block(text, block):
    ls = text.split('\n'); n = len(block)
    for i in range(len(ls) - n + 1):
        if ls[i:i + n] == block: return '\n'.join(ls[:i] + ls[i + n:])
    return text
g = json.load(open(sys.argv[1])); n = json.load(open(sys.argv[2]))
import re
EXPECTED = [(re.compile(r'(combat|lang|calib|plan)-[0-9]+'), 'BUILD'), (re.compile('\u25c6 ?'), ''), (re.compile(r'\d+ fine \u00b7 \d+ to look at \u00b7 \d+ failed \u00b7 \d+ cannot tell yet'), 'COUNTS OF THE CHECKS')]       # the number of checks grows with the package       # the build of the app changes with every package
LANG_OPTS = {'English', 'Portugu\u00eas (Brasil)'}                          # the language select of Settings is new
def norm(s):
    for rx, rep in EXPECTED: s = rx.sub(rep, s)
    return re.sub(r' (notifyGet|notifySet|startupSet)=(yes|NO)', '', s)          # the report lists three more functions of the bridge
def lines(s): return [norm(l) for l in s.split('\n')]
barG = set(lines(g['win:panels']['text'])) | set(lines(n['win:panels']['text']))        # the same lines are left out on both sides (the window's own text: top bar, Settings dialog)
for _k in ('win:settings', 'win:settings-history-all'):
    if _k in n: barG |= set(lines(n[_k]['text']))          # the text of the Settings dialog (it holds the History card now)
barN = barG
attrG = set(g['win:panels']['attrs']) | set(n['win:panels']['attrs']); attrN = attrG
bad = 0; checked = 0
# History moved from the dashboard into Settings: the two History states of the dashboard are gone on purpose, and the History tab and the text of its (hidden) card are left out of the other dashboard states on both sides
def lastcatch_row(text):
    # the "Last catch" row of the Summary of an account now has the tier and the IV (in colour) as in the table: its lines are left out on both sides (run-iv-colors.js tests it)
    L = text.split('\n')
    for key in ('Last catch', 'Best catch'):
        if key in L:
            i = L.index(key); j = i + 1
            while j < len(L) and L[j] not in ('Loot (sell)', 'Session gold', 'Captures (sell)') and j < i + 14: j += 1
            del L[i:j]
    return '\n'.join(L)
def oldsummary(text):
    text = re.sub(r'\n\u2726\n[\d,.KMB]+ balls at shinies', '', text)                       # the card of an account: "\u2726 N balls at shinies" (the stock of a ball, not what was thrown) is gone
    text = re.sub(r'\n([\d,.KMB]+)\nShiny balls\n', '\n\u2014\nBalls at shinies\n', text)     # the tile of the session: now "Balls at shinies" and a dash until the reader sends its count
    text = re.sub(r'\n\u2726\n([^\n]+)\n([^\n]+ balls)\n', lambda m: '\n' + m.group(2) + '\n\u2726\n' + m.group(1) + '\n', text)          # the card of an account: the balls have a line of their own now, before the shiny captures and the potions
    # the Summary of one account lost the list "Latest captures" on purpose (down to the next part of the page)
    L = text.split('\n')
    if 'Latest captures' in L:
        i = L.index('Latest captures'); j = i + 1
        if j < len(L) and L[j] == 'None since this window opened': j += 1
        else:
            while j < len(L):                      # a capture is: (a star,) the name, the multiplier (\u00d71.5) and the IV (115/192)
                k = j + 1 if L[j] == '\u2726' else j
                if k + 2 < len(L) + 0 and re.match(r'^\u00d7[\d.]+$', L[k + 1] if k + 1 < len(L) else '') and re.match(r'^\d+/\d+$', L[k + 2] if k + 2 < len(L) else ''): j = k + 3
                else: break
        del L[i:j]
    return '\n'.join(L)
GONE = {'dash:history', 'dash:history-all', 'dash:captures-shiny-filter', 'hunt:acc1', 'hunt:acc2', 'hunt:acc2-nothing-saved', 'hunt:acc2-limit-lifted', 'hunt:acc3-party', 'hunt:acc4'}          # (the hunt:* ones: the Where to hunt tab is not part of the app any more)          # (the last one: the old snapshot of it is an empty page, the History clicks before it had left the dashboard blank)
HOPT = {'Today', 'Last 7 days', 'Last 30 days', 'All time', 'All accounts', 'trainer1', 'trainer2', 'trainer3', 'trainer4'}          # the period and account lists of the History card (now in the window, not in the dashboard)
HIST = {'Where to hunt', 'History', 'HISTORY \u00b7 DAILY TOTALS, SAVED ON THIS COMPUTER', 'Period', 'Today', 'Last 7 days', 'Last 30 days', 'All time', 'Account', 'All accounts', 'Export CSV', 'Loading\u2026'} | {l for l in lines(g['dash:history']['text']) if l.startswith('Gold is loot + captures sold')}          # only the lines of the History card itself
# The Where to hunt tab is gone. Its card was part of the text of every dashboard screen (hidden), so those lines, attributes and options are not there any more. Only what the OLD hunts screens had,
# and the new screen does not have, is taken out of the old screen: anything else that differs is still reported.
from collections import Counter
HUNTS = [x for x in g if x.startswith('hunt:')]
HUNT_TEXT = {l for x in HUNTS for l in lines(g[x]['text'])}; HUNT_ATTRS = {y for x in HUNTS for y in g[x]['attrs']}; HUNT_OPTS = {y for x in HUNTS for y in g[x]['options']}
NUMLIKE = re.compile(r'^[+\-\u2212\u00d7]?[\d.,]+[KMB%]?$|^\u2014$')          # the numbers of the hunts tables (a number that vanished from a table row is part of the removed tab)
def strip_surplus(old, new, belongs):
    surplus = Counter(old) - Counter(new); out = []
    for item in reversed(old):
        if surplus[item] > 0 and belongs(item): surplus[item] -= 1; continue
        out.append(item)
    return out[::-1]
for k in g:
    if k.startswith('errors'): continue
    if k == 'win:panels': continue
    if k in GONE:
        continue
    if k not in n: print('MISSING STATE', k); bad += 1; continue
    win = k.startswith('win:')
    for part in ('text', 'attrs', 'options'):
        a, b = g[k][part], n[k][part]
        if part == 'text' and k in ('win:diag-check', 'win:diag-report'): continue          # the Diagnostics report grows with every package (new checks, new lines): run-diag-core.js and run-diag-ui.js test it
        if part == 'text': a, b = norm(a), norm(b)
        if part == 'text' and k.startswith(('dash:', 'hunt:')): a = '\n'.join(l for l in a.split('\n') if l not in HIST); b = '\n'.join(l for l in b.split('\n') if l not in HIST)
        if part == 'text' and k.startswith(('dash:', 'hunt:')): a = oldsummary(a)
        if part == 'text' and k.startswith('dash:'): b = drop_block(b, CMP_TIP)       # (the explanation of the comparison button is new on purpose: lang-35)
        if part == 'text' and k.startswith('dash:'): b = drop_block(b, CAP_SORT)      # (the order menu of Latest captures: lang-37)
        if part == 'text' and k.startswith('dash:'): a = eggs_out(a); b = eggs_out(b); b = today_out(b)
        if part == 'text' and k.startswith('dash:'): b = '\n'.join(l for l in b.split('\n') if not _re.match(r'^.+ · party of \d+$', l))          # (the hunt name of a party: "· party of N", added by live.js, a line the reference has not)
        if part == 'text' and k.startswith('dash:'): a = _re.sub(r'(?m)^Nv\. (\d)', r'Lvl. \1', a); a = team_out(a); b = team_out(b)      # lang-40: "Lvl." for "Nv.", and the new team
        if part == 'attrs' and k.startswith('dash:'): b = [x for x in b if not _re.match(r'^title: .+ · Lv \S+ · HP ', x)]; b = [x for x in b if not _re.match(r'^(title|aria-label): .+ · \d+%( · .*)?$', x)]; b = [x for x in b if not _re.match(r'^title: (Shiny captured|Great catch|Valuable drop|Evolved|New hunt unlocked|Egg hatched): ', x)]          # lang-40: the tooltips of the team
        if part == 'options' and k.startswith('dash:'): b = drop_one(b, CAP_SORT)
        if part == 'options' and k.startswith('win:'): b = drop_one(b, ['1', '2', '3', '4'])          # lang-49: Settings › Game panels (1 to 4)
        if part == 'text' and k.startswith('dash:'): a = lastcatch_row(a); b = lastcatch_row(b)
        if part == 'text' and k.startswith('dash:'): a = '\n'.join(strip_surplus(a.split('\n'), b.split('\n'), lambda l: l in HUNT_TEXT or bool(NUMLIKE.match(l))))
        if part == 'attrs' and k.startswith('dash:'): a = strip_surplus(list(a), list(b), lambda x: x in HUNT_ATTRS)
        if part == 'options' and k.startswith('dash:'): a = strip_surplus(list(a), list(b), lambda x: x in HUNT_OPTS)
        if part == 'attrs' and k.startswith(('dash:', 'hunt:')): a = [x for x in a if 'istory' not in x and 'ISTORY' not in x]; b = [x for x in b if 'istory' not in x and 'ISTORY' not in x]
        if part == 'attrs' and k.startswith(('dash:', 'hunt:')): a = [x for x in a if 'Items worth' not in x and 'Balls thrown at shiny' not in x and 'Redraw' not in x]; b = [x for x in b if 'Items worth' not in x and 'Balls thrown at shiny' not in x and 'Summary settings' not in x and 'Balls: the kinds' not in x and 'Lock the Summary' not in x]      # (the lock beside the gear is new on purpose)
        if part == 'attrs' and k.startswith('dash:'): b = [x for x in b if x != 'aria-label: Compare with']; b = drop_one(b, ['aria-label: Order of the list', 'title: Order of the list'])
        if part == 'options': a = [x for x in a if x not in LANG_OPTS and x not in HOPT]; b = [x for x in b if x not in LANG_OPTS and x not in HOPT]
        if win and part == 'text': a = '\n'.join(l for l in lines(a) if l not in barG); b = '\n'.join(l for l in lines(b) if l not in barN)
        if win and part == 'attrs': a = [x for x in a if x not in attrG]; b = [x for x in b if x not in attrN]
        checked += 1
        if a != b:
            bad += 1
            if part == 'text':
                al, bl = a.split('\n'), b.split('\n'); d = [(i, x, y) for i, (x, y) in enumerate(zip(al, bl)) if x != y][:3]
                print('DIFF', k, part, 'lines %d vs %d' % (len(al), len(bl)), d)
            else: print('DIFF', k, part, 'only before:', sorted(set(a) - set(b))[:4], '| only after:', sorted(set(b) - set(a))[:4])
print('compared %d parts of %d states: %d different' % (checked, len([x for x in g if not x.startswith('errors') and x != 'win:panels']), bad))
print('JS errors after:', {k: v for k, v in n.items() if k.startswith('errors') and v})
