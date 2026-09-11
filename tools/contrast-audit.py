import io, re, collections, glob, os

FILES = [r'C:\Users\Admin\fist\apps\client\index.html'] + \
        glob.glob(r'C:\Users\Admin\fist\apps\client\src\*.ts')


def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(ch * 2 for ch in h)
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def ratio(fg, bg):
    a, b = lum(fg), lum(bg)
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


BACK = {'page': '#0a0a0f', 'panel': '#08080e', 'btn': '#11111a'}

uses = collections.Counter()
where = collections.defaultdict(list)

for f in FILES:
    s = io.open(f, encoding='utf-8').read()
    name = os.path.basename(f)
    for i, line in enumerate(s.split('\n'), 1):
        # any colour used as a text colour: css `color:`, or a JS fillStyle/colour literal
        for m in re.finditer(r'(?:color\s*[:=]\s*|fillStyle\s*=\s*)[\'"]?(#[0-9a-fA-F]{3,8})', line):
            c = m.group(1)
            if len(c.lstrip('#')) in (3, 6):
                uses[c.lower()] += 1
                if len(where[c.lower()]) < 4:
                    where[c.lower()].append('%s:%d' % (name, i))

rows = []
for c, n in uses.items():
    rs = [ratio(c, b) for b in BACK.values()]
    rows.append((min(rs), c, n, rs))

print('%-10s %5s  %7s %7s %7s   %-11s  %s' % ('COLOR', 'USES', 'page', 'panel', 'btn', 'VERDICT', 'EXAMPLES'))
print('-' * 100)
for worst, c, n, rs in sorted(rows):
    v = 'PASS AA' if worst >= 4.5 else ('large-only' if worst >= 3.0 else '>>> FAIL')
    print('%-10s %5d  %7.2f %7.2f %7.2f   %-11s  %s' % (c, n, rs[0], rs[1], rs[2], v, ', '.join(where[c])))

fails = [r for r in rows if r[0] < 4.5]
print()
print('FAILING COLOURS: %d   TOTAL DECLARATIONS AFFECTED: %d'
      % (len(fails), sum(r[2] for r in fails)))
