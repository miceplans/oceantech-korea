// Search and sort the saved KBoard lists without a WordPress server.
document.addEventListener('DOMContentLoaded', () => {
  const board = document.querySelector('#kboard-default-list');
  if (!board) return;

  const searchForm = board.querySelector('.kboard-search form');
  const sortForm = board.querySelector('.kboard-sort form');
  const tbody = board.querySelector('.kboard-list tbody');
  const pagination = board.querySelector('.kboard-pagination');
  const total = board.querySelector('.kboard-total-count');
  if (!searchForm || !tbody) return;

  const original = tbody.innerHTML;
  const originalTotal = total?.textContent ?? '';
  let rowsPromise;

  async function allRows() {
    if (rowsPromise) return rowsPromise;
    rowsPromise = (async () => {
      const pageUrls = new Set([location.href]);
      pagination?.querySelectorAll('a[href]').forEach((link) => {
        pageUrls.add(new URL(link.getAttribute('href'), location.href).href);
      });
      const documents = await Promise.all([...pageUrls].map(async (url) => {
        if (url === location.href) return { doc: document, url };
        const response = await fetch(url);
        if (!response.ok) return null;
        return { doc: new DOMParser().parseFromString(await response.text(), 'text/html'), url };
      }));
      const seen = new Set();
      return documents.flatMap((page) => [...(page?.doc.querySelectorAll('#kboard-default-list .kboard-list tbody tr') ?? [])].map((row) => {
        const link = row.querySelector('.kboard-list-title a');
        if (link) row.dataset.detailUrl = new URL(link.getAttribute('href'), page.url).href;
        return row;
      }))
        .filter((row) => {
          const href = row.dataset.detailUrl;
          if (!href || seen.has(href)) return false;
          seen.add(href);
          return true;
        });
    })();
    return rowsPromise;
  }

  async function update() {
    const keyword = searchForm.elements.keyword.value.trim().toLocaleLowerCase();
    const target = searchForm.elements.target.value;
    const sort = sortForm?.elements.kboard_list_sort.value ?? 'newest';
    if (!keyword && sort === 'newest') {
      tbody.innerHTML = original;
      if (pagination) pagination.hidden = false;
      if (total) total.textContent = originalTotal;
      return;
    }

    const rows = await allRows();
    const matches = [];
    for (const row of rows) {
      const title = row.querySelector('.kboard-list-title')?.textContent ?? '';
      const author = row.querySelector('.kboard-list-user')?.textContent ?? '';
      let haystack = target === 'title' ? title : target === 'member_display' ? author : `${title} ${author}`;
      if (target === 'content' && keyword) {
        if (row.dataset.detailUrl) {
          const response = await fetch(row.dataset.detailUrl);
          if (response.ok) {
            const detail = new DOMParser().parseFromString(await response.text(), 'text/html');
            haystack = detail.querySelector('.kboard-content')?.textContent ?? '';
          }
        }
      }
      if (!keyword || haystack.toLocaleLowerCase().includes(keyword)) matches.push(row);
    }

    const number = (row, selector) => Number(row.querySelector(selector)?.textContent.replace(/[^\d]/g, '') ?? 0);
    if (sort === 'best') matches.sort((a, b) => number(b, '.kboard-list-vote') - number(a, '.kboard-list-vote'));
    if (sort === 'viewed') matches.sort((a, b) => number(b, '.kboard-list-view') - number(a, '.kboard-list-view'));
    if (sort === 'updated') matches.sort((a, b) => (b.querySelector('.kboard-list-date')?.textContent ?? '').localeCompare(a.querySelector('.kboard-list-date')?.textContent ?? ''));
    tbody.replaceChildren(...matches.map((row) => row.cloneNode(true)));
    if (pagination) pagination.hidden = true;
    if (total) total.textContent = `Total ${matches.length}`;
  }

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    update().catch(console.error);
  });
  sortForm?.querySelector('select')?.removeAttribute('onchange');
  sortForm?.addEventListener('submit', (event) => event.preventDefault());
  sortForm?.querySelector('select')?.addEventListener('change', () => update().catch(console.error));
});
