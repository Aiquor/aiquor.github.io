const cards = [...document.querySelectorAll('.resource-card')];
const search = document.querySelector('#hub-search');
const empty = document.querySelector('#empty-state');
let filter = 'all';

function updateResources() {
  const query = search.value.trim().toLowerCase();
  let shown = 0;
  for (const card of cards) {
    const matchesFilter = filter === 'all' || card.dataset.category === filter;
    const matchesQuery = !query || `${card.dataset.search} ${card.textContent}`.toLowerCase().includes(query);
    card.hidden = !(matchesFilter && matchesQuery);
    if (!card.hidden) shown += 1;
  }
  empty.hidden = shown !== 0;
}

search.addEventListener('input', updateResources);
for (const button of document.querySelectorAll('.filter-button')) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('.filter-button').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    updateResources();
  });
}

const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  navigation.classList.toggle('open', open);
});
navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    navigation.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !event.metaKey && !event.ctrlKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    search.focus();
  }
});
