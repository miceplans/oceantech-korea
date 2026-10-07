// Client-side search, sort and paging for the native boards (static data embedded in the page).
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.oc-board').forEach((root) => {
    const dataEl = root.querySelector('script.oc-board-data');
    const form = root.querySelector('.oc-board-search');
    const sortEl = root.querySelector('.oc-board-sort');
    const tbody = root.querySelector('tbody');
    const pager = root.querySelector('.oc-board-pagination');
    const total = root.querySelector('.oc-board-total');
    if (!dataEl || !form || !tbody) return;

    const { posts, perPage } = JSON.parse(dataEl.textContent);
    const original = { rows: tbody.innerHTML, pager: pager.innerHTML, total: total.innerHTML };
    let page = 1;

    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

    function matches(post, keyword, target) {
      const field = { title: post.title, content: post.text, author: post.author };
      const haystack = target ? field[target] : `${post.title} ${post.text} ${post.author}`;
      return haystack.toLocaleLowerCase().includes(keyword);
    }

    function render() {
      const keyword = form.elements.keyword.value.trim().toLocaleLowerCase();
      const sort = sortEl?.value ?? 'newest';
      if (!keyword && sort === 'newest') {
        tbody.innerHTML = original.rows;
        pager.innerHTML = original.pager;
        total.innerHTML = original.total;
        return;
      }

      let list = posts.filter((post) => !keyword || matches(post, keyword, form.elements.target.value));
      if (sort === 'oldest') list = [...list].sort((a, b) => a.no - b.no);
      if (sort === 'viewed') list = [...list].sort((a, b) => b.views - a.views || b.no - a.no);

      const pages = Math.max(1, Math.ceil(list.length / perPage));
      page = Math.min(page, pages);
      const slice = list.slice((page - 1) * perPage, page * perPage);
      total.innerHTML = `전체 <strong>${list.length}</strong>건`;
      tbody.innerHTML = slice.length ? slice.map((post) => `<tr>
        <td class="oc-col-no">${post.no}</td>
        <td class="oc-col-title"><a href="${esc(post.href)}">${esc(post.title)}</a>
          <div class="oc-board-meta">${esc(post.author)} | ${esc(post.date)} | 조회 ${post.views}</div></td>
        <td class="oc-col-author">${esc(post.author)}</td><td class="oc-col-date">${esc(post.date)}</td>
        <td class="oc-col-views">${post.views}</td></tr>`).join('')
        : '<tr><td colspan="5" class="oc-board-empty">검색 결과가 없습니다.</td></tr>';
      pager.innerHTML = pages > 1
        ? `<ul class="oc-board-pages">${Array.from({ length: pages }, (_, i) =>
          `<li class="${i + 1 === page ? 'active' : ''}"><a href="#" data-page="${i + 1}">${i + 1}</a></li>`).join('')}</ul>`
        : '';
    }

    form.addEventListener('submit', (event) => { event.preventDefault(); page = 1; render(); });
    sortEl?.addEventListener('change', () => { page = 1; render(); });
    pager.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-page]');
      if (!link) return;
      event.preventDefault();
      page = Number(link.dataset.page);
      render();
    });
  });
});
