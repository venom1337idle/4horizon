# keys.py: every English text the code asks the language layer for.  t('...')  /  T('...')  /  tr('...')   including both sides of a  cond ? 'a' : 'b'.
import re, sys, json
ESC = {'n': '\n', 't': '\t', "'": "'", '"': '"', '\\': '\\', '/': '/', 'r': '\r', '`': '`'}
def unesc(s):
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == '\\' and i + 1 < len(s):
            n = s[i + 1]
            if n == 'u' and re.match(r'[0-9a-fA-F]{4}', s[i + 2:i + 6]): out.append(chr(int(s[i + 2:i + 6], 16))); i += 6; continue
            out.append(ESC.get(n, n)); i += 2; continue
        out.append(c); i += 1
    return ''.join(out)
def call_args(src, start):
    """src[start] is just after the '(' of a call; returns (first_arg_text, index_after_the_call)"""
    depth, i, q, first_end = 1, start, None, None
    while i < len(src):
        c = src[i]
        if q:
            if c == '\\': i += 2; continue
            if c == q: q = None
        elif c in '\'"`': q = c
        elif c in '([{': depth += 1
        elif c in ')]}':
            depth -= 1
            if depth == 0: return src[start:(first_end if first_end is not None else i)], i + 1
        elif c == ',' and depth == 1 and first_end is None: first_end = i
        i += 1
    return src[start:], len(src)
LIT = re.compile(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"")
def keys_in(src, names=('t', 'T', 'tt')):
    found = []
    pat = re.compile(r'(?<![\w.$])(' + '|'.join(names) + r')\(')
    for m in pat.finditer(src):
        arg, _ = call_args(src, m.end())
        # a first argument that is only a variable (t(x)) has no literal: that case must be listed by hand elsewhere
        for lm in LIT.finditer(arg):
            s = lm.group(1) if lm.group(1) is not None else lm.group(2)
            found.append((unesc(s), src.count('\n', 0, m.start()) + 1))
    return found
if __name__ == '__main__':
    for f in sys.argv[1:]:
        ks = keys_in(open(f, encoding='utf-8').read().replace('\r\n', '\n'))
        print(f, len(ks), 'calls,', len(set(k for k, _ in ks)), 'different texts')
