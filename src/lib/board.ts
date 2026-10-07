import boardData from '../data/boards.json';

// Native board rendering (no KBoard). Posts live in src/data/boards.json;
// extract them again from saved pages with scripts/extract-boards.py.

interface Post {
  id: number;
  no: number;
  title: string;
  author: string;
  date: string;
  votes: number;
  views: number;
  datetime: string;
  content: string;
}

interface Board {
  title: string;
  dir: string;
  perPage: number;
  posts: Post[];
}

const boards = boardData as Record<string, Board>;

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function boardOfPost(id: number): [string, Board] | undefined {
  return Object.entries(boards).find(([, board]) => board.posts.some((post) => post.id === id));
}

// Balanced <div> block starting at `start` (index of the opening tag).
function divBlockEnd(html: string, start: number): number {
  const tag = /<(\/?)div\b[^>]*>/g;
  tag.lastIndex = start;
  let depth = 0;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return html.length;
}

function replaceBlocks(html: string, marker: string, render: (block: string) => string): string {
  let out = '';
  let cursor = 0;
  for (let start = html.indexOf(marker); start !== -1; start = html.indexOf(marker, cursor)) {
    const end = divBlockEnd(html, start);
    out += html.slice(cursor, start) + render(html.slice(start, end));
    cursor = end;
  }
  return out + html.slice(cursor);
}

interface Context {
  source: string; // e.g. "notice/q-pageid-2_mod-list.html"
  sources: Set<string>; // every saved page, to pick links that exist
}

const pageOf = (source: string) => Number(source.match(/q-pageid-(\d+)_/)?.[1] ?? 1);
const listFile = (page: number) => (page > 1 ? `q-pageid-${page}_mod-list.html` : 'q-mod-list.html');

function postHref(board: Board, post: Post, page: number, ctx: Context): string {
  const candidates = [
    page > 1 && `${board.dir}/q-pageid-${page}_mod-document_uid-${post.id}.html`,
    `${board.dir}/q-mod-document_uid-${post.id}.html`,
    `${board.dir}/q-pageid-1_mod-document_uid-${post.id}.html`,
  ];
  const found = candidates.find((file) => file && ctx.sources.has(file))
    ?? [...ctx.sources].find((file) => file.startsWith(`${board.dir}/q-pageid-`) && file.endsWith(`_mod-document_uid-${post.id}.html`));
  return found ? `/${found}` : `/q-kboard_content_redirect-${post.id}.html`;
}

function renderRows(board: Board, posts: Post[], page: number, ctx: Context): string {
  if (!posts.length) return '<tr><td colspan="5" class="oc-board-empty">등록된 게시물이 없습니다.</td></tr>';
  return posts.map((post) => `
    <tr>
      <td class="oc-col-no">${post.no}</td>
      <td class="oc-col-title">
        <a href="${postHref(board, post, page, ctx)}">${escape(post.title)}</a>
        <div class="oc-board-meta">${escape(post.author)} | ${post.date} | 조회 ${post.views}</div>
      </td>
      <td class="oc-col-author">${escape(post.author)}</td>
      <td class="oc-col-date">${post.date}</td>
      <td class="oc-col-views">${post.views}</td>
    </tr>`).join('');
}

function renderPagination(board: Board, page: number): string {
  const pages = Math.max(1, Math.ceil(board.posts.length / board.perPage));
  if (pages < 2) return '';
  const link = (n: number, label: string, cls = '') =>
    `<li class="${cls}"><a href="/${board.dir}/${listFile(n)}"${n === page && !cls ? ' aria-current="page" onclick="return false"' : ''}>${label}</a></li>`;
  const numbers = Array.from({ length: pages }, (_, i) => link(i + 1, String(i + 1), i + 1 === page ? 'active' : ''));
  return `<ul class="oc-board-pages">
    ${page > 1 ? link(1, '처음', 'first') + link(page - 1, '‹', 'prev') : ''}
    ${numbers.join('')}
    ${page < pages ? link(page + 1, '›', 'next') + link(pages, '마지막', 'last') : ''}
  </ul>`;
}

function renderList(key: string, board: Board, ctx: Context): string {
  const page = Math.min(pageOf(ctx.source), Math.max(1, Math.ceil(board.posts.length / board.perPage)));
  const newest = [...board.posts].sort((a, b) => b.no - a.no);
  const slice = newest.slice((page - 1) * board.perPage, page * board.perPage);
  // Everything the client-side search/sort needs, for all pages of this board.
  const data = {
    perPage: board.perPage,
    posts: newest.map((post) => ({
      no: post.no, title: post.title, author: post.author, date: post.date, views: post.views,
      href: postHref(board, post, 1, ctx), text: post.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    })),
  };
  return `<div class="oc-board" data-board="${key}">
  <div class="oc-board-head">
    <div class="oc-board-total">전체 <strong>${board.posts.length}</strong>건</div>
    <select class="oc-board-sort" aria-label="정렬">
      <option value="newest">최신순</option>
      <option value="oldest">오래된순</option>
      <option value="viewed">조회순</option>
    </select>
  </div>
  <div class="oc-board-table">
    <table>
      <thead><tr><th class="oc-col-no">번호</th><th class="oc-col-title">제목</th><th class="oc-col-author">작성자</th><th class="oc-col-date">날짜</th><th class="oc-col-views">조회</th></tr></thead>
      <tbody>${renderRows(board, slice, page, ctx)}</tbody>
    </table>
  </div>
  <nav class="oc-board-pagination" aria-label="페이지">${renderPagination(board, page)}</nav>
  <form class="oc-board-search" role="search">
    <select name="target" aria-label="검색 대상">
      <option value="">전체</option><option value="title">제목</option><option value="content">내용</option><option value="author">작성자</option>
    </select>
    <input type="text" name="keyword" placeholder="검색어를 입력하세요" aria-label="검색어">
    <button type="submit">검색</button>
  </form>
  <script type="application/json" class="oc-board-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
</div>`;
}

function renderDocument(key: string, board: Board, post: Post, ctx: Context): string {
  const page = pageOf(ctx.source);
  const ordered = [...board.posts].sort((a, b) => a.no - b.no);
  const index = ordered.findIndex((p) => p.id === post.id);
  const older = ordered[index - 1];
  const newer = ordered[index + 1];
  const nav = (target: Post | undefined, label: string, cls: string) => target
    ? `<a class="oc-board-${cls}" href="${postHref(board, target, page, ctx)}"><span class="oc-board-nav-label">${label}</span><span class="oc-board-nav-title">${escape(target.title)}</span></a>`
    : `<span class="oc-board-${cls} is-empty"><span class="oc-board-nav-label">${label}</span><span class="oc-board-nav-title">글이 없습니다.</span></span>`;
  return `<article class="oc-board-post" data-board="${key}">
  <header class="oc-board-post-head">
    <h1>${escape(post.title)}</h1>
    <dl>
      <div><dt>작성자</dt><dd>${escape(post.author)}</dd></div>
      <div><dt>날짜</dt><dd>${escape(post.datetime || post.date)}</dd></div>
      <div><dt>조회</dt><dd>${post.views}</dd></div>
    </dl>
  </header>
  <div class="oc-board-post-body">${post.content}</div>
  <div class="oc-board-post-nav">${nav(older, '이전글', 'prev')}${nav(newer, '다음글', 'next')}</div>
  <div class="oc-board-post-actions"><a class="oc-board-button" href="/${board.dir}/${listFile(page)}">목록</a></div>
</article>`;
}

// Strip KBoard assets from <head> (stylesheets, scripts, feed link).
export function stripKboardHead(head: string): string {
  return head
    .replace(/<script\b[^>]*\bid=["']kboard[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*kboard[^>]*>/gi, '')
    .replace(/<!--\s*WordPress KBoard plugin[\s\S]*?-->/gi, '');
}

// Same for the inline/footer scripts WordPress printed into <body>.
export function stripKboardScripts(body: string): string {
  return body.replace(/<script\b[^>]*\bid=["']kboard[^>]*>[\s\S]*?<\/script>/gi, '');
}

// Swap the saved KBoard list/document markup for natively rendered boards.
export function renderBoards(body: string, ctx: Context): string {
  body = stripKboardScripts(body);
  const sourceDir = ctx.source.split('/')[0];
  const dirBoard = Object.entries(boards).find(([, board]) => board.dir === sourceDir);

  body = replaceBlocks(body, '<div id="kboard-default-list">', (block) => {
    const id = Number(block.match(/kboard_content_redirect-(\d+)|mod-document_uid-(\d+)/)?.slice(1).find(Boolean));
    const found = id ? boardOfPost(id) : dirBoard;
    return found ? renderList(found[0], found[1], ctx) : block;
  });

  return replaceBlocks(body, '<div id="kboard-document">', (block) => {
    const id = Number(ctx.source.match(/document_uid-(\d+)/)?.[1]);
    const found = boardOfPost(id);
    const post = found?.[1].posts.find((p) => p.id === id);
    return found && post ? renderDocument(found[0], found[1], post, ctx) : block;
  });
}
