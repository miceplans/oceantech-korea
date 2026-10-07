document.addEventListener('click', function (event) {
  var tab = event.target.closest('.e-n-tab-title');
  if (!tab) return;
  var root = tab.closest('.e-n-tabs');
  if (!root) return;
  var index = tab.getAttribute('data-tab-index');
  root.classList.add('e-activated');
  root.querySelectorAll('.e-n-tab-title').forEach(function (button) {
    var active = button === tab;
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.setAttribute('tabindex', active ? '0' : '-1');
  });
  root.querySelectorAll('[role="tabpanel"]').forEach(function (panel) {
    panel.classList.toggle('e-active', panel.getAttribute('data-tab-index') === index);
  });
});
