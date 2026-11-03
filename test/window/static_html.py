# static_html.py: the text WRITTEN IN the markup of a page (outside <script> and <style>): text nodes and title / placeholder / aria-label / alt, as I18N.dom() sees them (entities decoded, spaces collapsed).
import re, sys, json
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(self): super().__init__(convert_charrefs=True); self.out = []; self.stack = []
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if 'data-no-i18n' in d: self.stack.append((tag, True))
        elif tag not in ('br', 'img', 'input', 'meta', 'link', 'hr', 'source'): self.stack.append((tag, False))
        if tag == 'title': self.stack[-1] = ('title', True)           # the title of the page is not on screen
        skip = any(x[1] for x in self.stack) or any(x[0] in ('script', 'style') for x in self.stack)
        if not skip:
            for a in ('title', 'placeholder', 'aria-label', 'alt'):
                v = d.get(a)
                if v and re.search(r'[A-Za-z]{3,}', v): self.out.append(re.sub(r'\s+', ' ', v).strip())
    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag: del self.stack[i:]; break
    def handle_data(self, data):
        if any(x[1] for x in self.stack) or any(x[0] in ('script', 'style') for x in self.stack): return
        s = re.sub(r'\s+', ' ', data).strip()
        if s and re.search(r'[A-Za-z]{3,}', s): self.out.append(s)
def static_texts(path):
    p = P(); p.feed(open(path, encoding='utf-8').read()); return sorted(set(p.out))
if __name__ == '__main__':
    for f in sys.argv[1:]: ks = static_texts(f); print(f, len(ks)); [print('   ', repr(k[:130])) for k in ks]
