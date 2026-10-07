#!/usr/bin/env python3
"""Extract the saved KBoard lists/posts in src/legacy into src/data/boards.json.

One-off migration: after this runs, the board data lives in JSON and is rendered
by src/lib/board.ts (no KBoard markup/plugin involved).
"""
import glob, html, json, os, re, sys
from urllib.parse import unquote

ROOT = os.path.join(os.path.dirname(__file__), '..')
LEGACY = os.path.join(ROOT, 'src/legacy')
OUT = os.path.join(ROOT, 'src/data/boards.json')

BOARDS = {
    'notice': {'title': '공지사항', 'dir': 'notice'},
    **{y: {'title': f'{y} 발표자료·단행본', 'dir': f'{y}-material-book'} for y in range(2020, 2027)},
}
BOARDS = {str(k): v for k, v in BOARDS.items()}


def read(path):
    return open(path, encoding='utf-8').read()


def text(fragment):
    return html.unescape(re.sub(r'<[^>]+>', '', fragment)).strip()


def rows(page):
    """Yield (uid, title, author, date, votes, views) for list rows in a page."""
    for tr in re.findall(r'<tr class="[^"]*">(.*?)</tr>', page, re.S):
        m = re.search(r'kboard_content_redirect-(\d+)|mod-document_uid-(\d+)', tr)
        if not m:
            continue
        uid = int(m.group(1) or m.group(2))
        cell = lambda cls: text(re.search(rf'<td class="kboard-list-{cls}">(.*?)</td>', tr, re.S).group(1))
        title = text(re.search(r'<div class="kboard-default-cut-strings">(.*?)<span', tr, re.S).group(1))
        yield dict(id=uid, no=int(cell('uid')), title=title, author=cell('user'),
                   date=cell('date'), votes=int(cell('vote') or 0), views=int(cell('view') or 0))


def normalize(content):
    content = re.sub(r'(?:\.\./)+(wp-content/)', r'/\1', content)
    content = re.sub(r'https?://(?:ocean\.docuhut\.com|k-oceantech\.org)/(wp-content/)', r'/\1', content)
    # Drop images whose file was never crawled (dead links to the old host).
    def keep(m):
        src = unquote(re.search(r'src="([^"]*)"', m.group(0)).group(1).split('?')[0])
        return m.group(0) if not src.startswith('/wp-content/') or os.path.exists(os.path.join(ROOT, 'public', src[1:])) else ''
    content = re.sub(r'<img\b[^>]*>', keep, content)
    return content.strip()


def detail(uid):
    for f in sorted(glob.glob(f'{LEGACY}/**/*document_uid-{uid}.html', recursive=True)):
        page = read(f)
        m = re.search(r'<div class="content-view">(.*?)</div>\s*</div>\s*<div class="kboard-document-action">', page, re.S)
        if not m:
            continue
        dt = re.search(r'detail-date">.*?detail-value">([^<]*)<', page, re.S)
        return dict(datetime=dt.group(1).strip() if dt else '', content=normalize(m.group(1)))
    return None


def main():
    data, seen = {}, set()
    for key, meta in BOARDS.items():
        d = os.path.join(LEGACY, meta['dir'])
        files = sorted(glob.glob(f'{d}/q-pageid-*_mod-list.html'), key=lambda p: int(re.search(r'pageid-(\d+)', p).group(1)))
        posts = []
        for f in files:
            for r in rows(read(f)):
                if r['id'] not in {p['id'] for p in posts}:
                    posts.append(r)
        for p in posts:
            info = detail(p['id'])
            if info is None:
                print(f'warning: no detail page for {key}/{p["id"]}', file=sys.stderr)
                info = dict(datetime='', content='')
            p.update(info)
            seen.add(p['id'])
        data[key] = dict(title=meta['title'], dir=meta['dir'], perPage=10, posts=posts)
        print(key, len(posts))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


main()
