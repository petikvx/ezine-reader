#!/usr/bin/env python3
"""Build catalog + search index for the 29A reader. Usage: build.py [raw_dir] [out_dir]"""
import os, re, sys, json, zipfile

RAW = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '../../29a'))
OUT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '../data'))
os.makedirs(OUT, exist_ok=True)
MATRIX = os.path.abspath(os.path.join(RAW, '..', 'MATRiX'))
APP = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

TEXT_EXT = {'txt','doc','diz','asm','inc','c','h','bat','cpp','pas','htm','html','nfo','ini','ans','cmd','vbs','js','pl','php','sh','mac','def','lst','mak','rc','s','bas','reg','cfg','ion','1st','inf','scr','hlp_'}
def is_text(path, data=None):
    ext = path.rsplit('.',1)[-1].lower() if '.' in os.path.basename(path) else ''
    if ext in TEXT_EXT: return True
    if ext in {'exe','com','zip','rar','dll','mp3','bmp','raw','dat','idx','sys','ovl','bin','gif','jpg','png','mod','xm','s3m','ico','lha','arj','ace','7z','cab','vxd','ocx','scr_'}: return False
    if data is None:
        try:
            with open(path,'rb') as f: data = f.read(4096)
        except OSError: return False
    if not data: return False
    if b'\0' in data or data[:2] == b'MZ' or data[:2] == b'PK': return False
    bad = sum(1 for b in data if b < 9 or (13 < b < 32 and b != 27))
    return bad / len(data) < 0.05

def dec(b):
    try: return b.decode('utf-8') if any(x > 127 for x in b) else b.decode('ascii')
    except UnicodeDecodeError: return b.decode('cp437')

def read_text(p):
    with open(p,'rb') as f: return dec(f.read()).replace('\r\n','\n').replace('\r','\n')

def clean_title(t):
    return re.sub(r'\s+',' ',t).strip(' -_=*~#;.>:|/\\\xc4\xcd')

def guess_title(path):
    for l in read_text(path).split('\n')[:25]:
        s = re.sub(r'[^\w\s\.\'\(\)\-,/&!?:+#]', ' ', l)
        s = clean_title(s)
        if len(s) >= 4 and re.search(r'[A-Za-z]{3}', s): return s[:80]
    return os.path.basename(path)

def parse_idx(path):
    """-> list of (section, [(title, author)])"""
    secs, cur = [], None
    for l in read_text(path).split('\n'):
        if not l.strip(): continue
        if not l.startswith((' ','\t')) and l.rstrip().endswith(':'):
            cur = (l.strip().rstrip(':').strip(), []); secs.append(cur); continue
        if cur is None or l.startswith(' ' * 10): continue
        m = re.match(r'^(29A[#-][\w.]+)\s*(?:-\s+|\t+)(.*)$', l)
        if m: l = m.group(2)
        parts = re.split(r'\t+|\s{2,}', l.strip(), maxsplit=1)
        cur[1].append((clean_title(parts[0]), parts[1].strip() if len(parts) > 1 else ''))
    return secs

def rel(p):
    if p == MATRIX or p.startswith(MATRIX + os.sep): return 'MATRiX/' + os.path.relpath(p, MATRIX).replace(os.sep, '/')
    return os.path.relpath(p, RAW).replace(os.sep, '/')
def absp(r):
    return os.path.join(MATRIX, r[7:]) if r.startswith('MATRiX/') else os.path.join(RAW, r)

import html as _html
from html.parser import HTMLParser
class _Strip(HTMLParser):
    BLOCK = {'p','div','br','tr','li','h1','h2','h3','h4','h5','h6','pre','table','hr','title'}
    def __init__(s): super().__init__(convert_charrefs=True); s.o=[]; s.skip=0; s.pre=0
    def handle_starttag(s, t, a):
        if t in ('script','style'): s.skip += 1
        if t == 'pre': s.pre += 1
        if t in s.BLOCK: s.o.append('\n')
    def handle_endtag(s, t):
        if t in ('script','style'): s.skip = max(0, s.skip-1)
        if t == 'pre': s.pre = max(0, s.pre-1)
        if t in s.BLOCK: s.o.append('\n')
    def handle_data(s, d):
        if s.skip: return
        s.o.append(d if s.pre else re.sub(r'\s+', ' ', d))
def html_to_text(raw):
    p = _Strip(); p.feed(raw); t = ''.join(p.o).replace('\xa0',' ')
    t = re.sub(r'[ \t]*\n[ \t]*', '\n', t)
    return re.sub(r'\n{3,}', '\n\n', t).strip()
def read_html(path):
    b = open(path,'rb').read()
    try: s = b.decode('utf-8')
    except UnicodeDecodeError: s = b.decode('cp1252', 'replace')
    return html_to_text(s)
def search_text(path):
    return read_html(path) if path.lower().endswith(('.htm','.html')) else read_text(path)

def walk_files(d):
    out = []
    for r, ds, fs in os.walk(d):
        ds.sort()
        for f in sorted(fs): out.append(os.path.join(r, f))
    return out

def sorted_leaf(d):
    """leaf entries of a directory, sorted by name (files; dirs count as one entry)"""
    if not os.path.isdir(d): return []
    return sorted(os.listdir(d), key=lambda s: s.lower())

issues, search = [], []
ISSUES = [('1','29a-1',1996,'1996'),('2','29a-2',1997,'1997'),('3','29a-3',1998,'1998'),('4','29a-4',1999,'1999'),
          ('4s','29a-4s/29a4s',1999,'1999'),('5','29a-5',2000,'2000'),('6','29a-6',2001,'2001'),('7','29a-7',2002,'2002'),('8','29a-8',2005,'2005')]
for iid, folder, _, year in ISSUES:
    base = os.path.join(RAW, folder)
    if not os.path.isdir(base): continue
    files = walk_files(base)
    diz = next((f for f in files if re.fullmatch(r'file[-_]?id_?\.diz', os.path.basename(f).lower()) and os.path.dirname(f)==base), None)
    idx = next((f for f in files if f.lower().endswith('.idx') and os.path.dirname(f)==base), None)
    idxsecs = parse_idx(idx) if idx else []
    titles = {}  # section -> [(t,a)]
    for name, items in idxsecs: titles.setdefault(name.lower(), []).extend(items)
    sections = []

    def add_section(key, name, paths, tl):
        items = []
        use_idx = len(tl) == len(paths)
        nums = [re.search(r'\.(\d+)$', os.path.basename(p)) for p in paths]
        bynum = None
        if not use_idx and tl and all(nums):
            ns = [int(m.group(1)) for m in nums]
            if len(set(ns)) == len(ns) and max(ns) <= len(tl): bynum = ns
        if bynum:
            tl = [tl[n-1] for n in bynum]; use_idx = True
        for i, p in enumerate(paths):
            if os.path.isdir(p):
                fl = [f for f in walk_files(p)]
                main = next((f for f in fl if is_text(f) and re.search(r'readme|\.txt$|\.diz$',os.path.basename(f),re.I)), None)
                t = tl[i][0] if use_idx else os.path.basename(p)
                items.append({'t': t, 'a': tl[i][1] if use_idx else '', 'p': rel(p), 'k': 'dir', 'n': len(fl), 'main': rel(main) if main else None})
            else:
                k = 'text' if is_text(p) else 'bin'
                t = tl[i][0] if use_idx else (guess_title(p) if k == 'text' else os.path.basename(p))
                items.append({'t': t, 'a': tl[i][1] if use_idx else '', 'p': rel(p), 'k': k, 'size': os.path.getsize(p), 'ok': use_idx})
        if items: sections.append({'key': key, 'name': name, 'items': items})
        return use_idx

    if os.path.isdir(os.path.join(base,'Editorial')) or os.path.isdir(os.path.join(base,'Articles')):
        for key, folder_name in (('editorial','Editorial'),('articles','Articles'),('utilities','Utilities')):
            d = os.path.join(base, folder_name)
            paths = [os.path.join(d, n) for n in sorted_leaf(d)]
            tl = titles.get(key) or titles.get('utilities & tools') if key=='utilities' else titles.get(key, [])
            add_section(key, folder_name, paths, tl or [])
        # viruses: group subfolders
        vd = os.path.join(base,'Viruses')
        if os.path.isdir(vd):
            for sub in sorted_leaf(vd):
                sp = os.path.join(vd, sub)
                if os.path.isdir(sp):
                    entries = [os.path.join(sp,n) for n in sorted_leaf(sp)]
                    add_section('viruses:'+sub, 'Viruses / '+sub, entries, [])
            direct = [os.path.join(vd,n) for n in sorted_leaf(vd) if not os.path.isdir(os.path.join(vd,n))]
            if direct: add_section('viruses', 'Viruses', direct, [])
    else:
        # old issues: chunks 29A#N.S_K
        chunk = [f for f in files if re.search(r'29A#\d\.\d_\w$', f)]
        names = {'1':'Editorial','2':'Articles','3':'Utilities','4':'Windows','5':'Viruses','6':'Viruses'}
        groups = {}
        for f in chunk: groups.setdefault(re.search(r'\.(\d)_', f).group(1), []).append(f)
        idxi = {'1':'editorial','2':'articles','3':'utilities'}
        tlists = []
        for name, items in idxsecs: tlists.append(items)
        for s in sorted(groups):
            paths = sorted(groups[s], key=lambda x: os.path.basename(x))
            tl = tlists[int(s)-1] if idxsecs and int(s)-1 < len(tlists) else []
            nm = idxsecs[int(s)-1][0] if idxsecs and int(s)-1 < len(idxsecs) else names.get(s, 'Section '+s)
            add_section(idxi.get(s, 'section'+s), nm, paths, tl)
        sec_extra = os.path.join(base,'FILES')
    flat = []
    for f in files:
        flat.append([rel(f), os.path.getsize(f), 't' if is_text(f) else 'b'])
    diz_txt = '\n'.join(l.expandtabs(8).rstrip() for l in read_text(diz).split('\n')).strip('\n') if diz else ''
    info = {'id': iid, 'ezine': '29a', 'name': '29A #' + iid.replace('s','') + (' (special)' if iid.endswith('s') else ''), 'year': year, 'folder': folder, 'diz': diz_txt, 'sections': sections, 'fileCount': len(files)}
    issues.append(info)
    json.dump(flat, open(os.path.join(OUT, f'files-{iid}.json'),'w'), separators=(',',':'))
    # search corpus: text items in editorial/articles/utilities/others except big
    for sec in sections:
        if iid == '4s' or sec['key'] not in ('editorial','articles','utilities'): continue
        for it in sec['items']:
            paths = [it['p']] if it['k'] != 'dir' else [x for x in [it.get('main')] if x]
            for pp in paths:
                full = absp(pp)
                if is_text(full) and os.path.getsize(full) < 400000:
                    search.append({'i': iid, 's': sec['key'], 'p': pp, 't': it['t'], 'x': search_text(full)})

# ---------------- MATRiX ----------------
LET = {
 'M':[" __  __ ","|  \\/  |","| |\\/| |","| |  | |","|_|  |_|"],
 'A':["    _    ","   / \\   ","  / _ \\  "," / ___ \\ ","/_/   \\_\\"],
 'T':[" _____ ","|_   _|","  | |  ","  | |  ","  |_|  "],
 'R':[" ____  ","|  _ \\ ","| |_) |","|  _ < ","|_| \\_\\"],
 'i':[" _ ","(_)","| |","| |","|_|"],
 'X':["__  __","\\ \\/ /"," \\  / "," /  \\ ","/_/\\_\\"],
}
def matrix_banner(n, year):
    rows = [''.join(LET[c][r] for c in 'MATRiX') for r in range(5)]
    return '\n'.join(rows) + f'\n\n  [ e-zine issue #{n} - {year} ]'

def ci_resolve(base, relp):
    cur = base
    for seg in re.split(r'[\\/]+', relp.strip()):
        if not seg or seg == '.': continue
        if not os.path.isdir(cur): return None
        hit = next((n for n in os.listdir(cur) if n.lower() == seg.lower()), None)
        if hit is None: return None
        cur = os.path.join(cur, hit)
    return cur

def mk_item(path, title, author=''):
    if os.path.isdir(path):
        fl = walk_files(path)
        main = next((f for f in fl if is_text(f) and re.search(r'readme|\.txt$|\.diz$|\.htm', os.path.basename(f), re.I)), None)
        return {'t': title or os.path.basename(path), 'a': author, 'p': rel(path), 'k': 'dir', 'n': len(fl), 'main': rel(main) if main else None}
    k = 'text' if is_text(path) else 'bin'
    return {'t': title or os.path.basename(path), 'a': author, 'p': rel(path), 'k': k, 'size': os.path.getsize(path), 'ok': True}

def parse_matrix_xml(path, base):
    raw = open(path,'rb').read().decode('cp1252','replace')
    stack, top = [], []
    for m in re.finditer(r'<(/?)(item|title|author|file)>\s*([^<]*)', raw, re.I):
        close, tag, txt = m.group(1), m.group(2).lower(), m.group(3).strip()
        if tag == 'item':
            if close:
                if not stack: continue
                it = stack.pop()
                (stack[-1]['kids'] if stack else top).append(it)
            else: stack.append({'title':'','author':'','file':'','kids':[]})
        elif not close and stack:
            stack[-1][tag] = _html.unescape(txt)
    secs = []
    def leaves(it):
        if it['file']: yield it
        for k in it['kids']: yield from leaves(k)
    for sec in top:
        items = []
        for lf in leaves(sec):
            fp = ci_resolve(base, lf['file'])
            if fp: items.append(mk_item(fp, clean_title(lf['title']) or lf['file'], lf['author'].strip()))
        if items:
            nm = sec['title'].strip()
            key = {'editorial':'editorial','articles':'articles','tools':'utilities','interviews':'interviews','interview':'interviews'}.get(nm.lower(), 'viruses' if re.match(r'vir', nm, re.I) else re.sub(r'\W+','_',nm.lower()))
            secs.append({'key': key, 'name': nm, 'items': items})
    return secs

def parse_matrix_html(base):
    secs = []
    for page, key, name in (('intro.htm','editorial','Editorial'),('articles.htm','articles','Articles'),('tools.htm','utilities','Tools'),('viruses.htm','viruses','Viruses'),('Interview.htm','interviews','Interviews')):
        pp = ci_resolve(base, page)
        if not pp: continue
        raw = open(pp,'rb').read().decode('cp1252','replace')
        items, seen = [], set()
        if key == 'editorial':
            items.append(mk_item(pp, 'Intro / Editorial', 'MATRiX'))
        else:
            for m in re.finditer(r'<a\s+[^>]*href="([^"#]+)"[^>]*>(.*?)</a>', raw, re.I | re.S):
                href, txt = m.group(1), clean_title(_html.unescape(re.sub(r'<[^>]+>', ' ', m.group(2))))
                if href.lower().startswith(('http','mailto')) or not txt: continue
                fp = ci_resolve(base, href)
                if not fp or fp in seen: continue
                seen.add(fp)
                title, author = txt, ''
                mm = re.match(r'^(.*?)\s+by\s+(.+)$', txt, re.I | re.S)
                if mm: title, author = mm.group(1), mm.group(2)
                items.append(mk_item(fp, re.sub(r'\s+',' ',title), re.sub(r'\s+',' ',author)))
        if items: secs.append({'key': key, 'name': name, 'items': items})
    return secs

if os.path.isdir(MATRIX):
    for n, (iid, base, year, mode) in enumerate([('m1', os.path.join(MATRIX,'mtx'), '1999', 'html'), ('m2', os.path.join(MATRIX,'mtx2'), '2000', 'xml'), ('m3', os.path.join(MATRIX,'mtx3','MTX#3'), '2001', 'xml')], 1):
        if not os.path.isdir(base): continue
        files = walk_files(base)
        if mode == 'html': sections = parse_matrix_html(base)
        else:
            xml = next((f for f in files if f.lower().endswith('.xml') and os.path.dirname(f) == base), None)
            sections = parse_matrix_xml(xml, base) if xml else []
        info = {'id': iid, 'ezine': 'matrix', 'name': f'MATRiX #{n}', 'year': year, 'folder': rel(base), 'diz': matrix_banner(n, year), 'sections': sections, 'fileCount': len(files)}
        issues.append(info)
        json.dump([[rel(f), os.path.getsize(f), 't' if is_text(f) else 'b'] for f in files], open(os.path.join(OUT, f'files-{iid}.json'),'w'), separators=(',',':'))
        for sec in sections:
            if sec['key'] not in ('editorial','articles','utilities','interviews'): continue
            for it in sec['items']:
                for pp in ([it['p']] if it['k'] != 'dir' else [x for x in [it.get('main')] if x]):
                    full = absp(pp)
                    if is_text(full) and os.path.getsize(full) < 400000:
                        search.append({'i': iid, 's': sec['key'], 'p': pp, 't': it['t'], 'x': search_text(full)})

# raw/ = directory of symlinks exposing both archives to the static site
rawdir = os.path.join(APP, 'raw')
if os.path.islink(rawdir): os.unlink(rawdir)
os.makedirs(rawdir, exist_ok=True)
def link(name, target):
    lp = os.path.join(rawdir, name)
    if os.path.islink(lp) or os.path.exists(lp):
        if os.path.islink(lp): os.unlink(lp)
        else: return
    os.symlink(os.path.relpath(target, rawdir), lp)
for n in os.listdir(RAW): link(n, os.path.join(RAW, n))
if os.path.isdir(MATRIX): link('MATRiX', MATRIX)

json.dump({'ezines':[{'id':'29a','name':'29A'},{'id':'matrix','name':'MATRiX'}],'issues': issues}, open(os.path.join(OUT,'catalog.json'),'w'), separators=(',',':'), ensure_ascii=False)
json.dump(search, open(os.path.join(OUT,'search.json'),'w'), separators=(',',':'), ensure_ascii=False)
for i in issues:
    print(i['id'], i['fileCount'], [(s['key'], len(s['items']), sum(1 for x in s['items'] if x.get('ok'))) for s in i['sections'] if not s['key'].startswith('viruses:')])
print('search docs', len(search), 'bytes', os.path.getsize(os.path.join(OUT,'search.json')))
