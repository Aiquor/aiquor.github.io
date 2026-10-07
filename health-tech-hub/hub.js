const searchInput = document.querySelector('#hub-search');
const resourceCards = [...document.querySelectorAll('.resource-card')];
const filterButtons = [...document.querySelectorAll('.filter-button')];
const emptyState = document.querySelector('#empty-state');
let activeFilter = 'all';

function filterResources() {
  const query = searchInput.value.trim().toLowerCase();
  let visible = 0;
  for (const card of resourceCards) {
    const matchesCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
    const haystack = `${card.dataset.search} ${card.textContent}`.toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const show = matchesCategory && matchesSearch;
    card.hidden = !show;
    if (show) visible += 1;
  }
  emptyState.hidden = visible > 0;
}

searchInput.addEventListener('input', filterResources);
for (const button of filterButtons) {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    for (const filterButton of filterButtons) {
      const selected = filterButton === button;
      filterButton.classList.toggle('active', selected);
      filterButton.setAttribute('aria-pressed', String(selected));
    }
    filterResources();
  });
}

const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-nav');
menuToggle.addEventListener('click', () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
  navigation.classList.toggle('open', !isOpen);
});
navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    navigation.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation');
  }
});

const dialog = document.querySelector('#join-dialog');
for (const button of document.querySelectorAll('[data-open-dialog]')) {
  button.addEventListener('click', () => dialog.showModal());
}
document.querySelector('#interest-form').addEventListener('submit', (event) => {
  event.preventDefault();
  document.querySelector('#interest-status').textContent = 'Thanks for exploring the concept. This demo does not send or store submissions.';
  event.currentTarget.reset();
});

const launcher = document.querySelector('#chat-launcher');
const chatPanel = document.querySelector('#chat-panel');
const chatMessages = document.querySelector('#chat-messages');
const chatInput = document.querySelector('#chat-input');

function setChatOpen(open) {
  chatPanel.hidden = !open;
  launcher.setAttribute('aria-expanded', String(open));
  if (open) chatInput.focus();
}
launcher.addEventListener('click', () => setChatOpen(chatPanel.hidden));
document.querySelector('#chat-close').addEventListener('click', () => setChatOpen(false));
if (window.location.hash === '#chat-launcher') setChatOpen(true);
if (window.location.hash === '#join-dialog') dialog.showModal();
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#chat-launcher') setChatOpen(true);
  if (window.location.hash === '#join-dialog' && !dialog.open) dialog.showModal();
});
if (window.location.hash === '#chat-launcher') setChatOpen(true);
if (window.location.hash === '#join-dialog') dialog.showModal();

const responses = [
  {
    match: /who|for whom|audience|professional|organization|provider|supplier/i,
    answer: 'The concept is designed for healthcare professionals, healthcare organizations, training providers, and technology or medical suppliers. Each group gets a route to relevant learning, tools, assessment, or opportunities.',
  },
  {
    match: /explore|offer|inside|resource|learning|course|career|job|tool|technology/i,
    answer: 'This demo includes sample learning pathways, team assessment concepts, a digital health tools directory, and career spotlights. The listings are illustrative; a live hub would review providers and content before publishing.',
  },
  {
    match: /medical|clinical|diagnos|treatment|patient|advice|care decision/i,
    answer: 'No. This demo assistant is for navigating the hub concept, not for clinical guidance or patient-care decisions. A production assistant would need carefully approved content and clear safety boundaries.',
  },
  {
    match: /trust|verify|safe|privacy|data/i,
    answer: 'Trust is a core design principle in this concept. A real platform would define review standards for listings, explain how information is used, and scope any AI features around approved content.',
  },
  {
    match: /ai|artificial intelligence/i,
    answer: 'The concept brings together learning about healthcare AI and technology discovery. The assistant shown here uses prepared demo responses only; it is not connected to an AI provider or live health data.',
  },
  {
    match: /how|start|join|participate/i,
    answer: 'The “Join the network” button opens a sample interest form. It demonstrates the experience only: this prototype does not transmit or save your information.',
  },
];

function respond(question) {
  const response = responses.find((item) => item.match.test(question));
  return response?.answer ?? 'I can share more about the hub’s audiences, sample learning and technology resources, or its trust principles. This concept assistant only answers questions about the demo.';
}

function appendMessage(text, kind) {
  const message = document.createElement('div');
  message.className = `message ${kind === 'user' ? 'user-message' : 'assistant-message'}`;
  message.textContent = text;
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function askAssistant(question) {
  const cleaned = question.trim();
  if (!cleaned) return;
  chatMessages.querySelector('.suggestion-list')?.remove();
  appendMessage(cleaned, 'user');
  window.setTimeout(() => appendMessage(respond(cleaned), 'assistant'), 360);
}

document.querySelector('#chat-form').addEventListener('submit', (event) => {
  event.preventDefault();
  askAssistant(chatInput.value);
  chatInput.value = '';
});
chatMessages.addEventListener('click', (event) => {
  const button = event.target.closest('[data-question]');
  if (button) askAssistant(button.dataset.question);
});
document.querySelectorAll('[data-resource]').forEach((button) => {
  button.addEventListener('click', () => {
    setChatOpen(true);
    askAssistant(`Tell me about ${button.dataset.resource}`);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !dialog.open && !chatPanel.hidden) setChatOpen(false);
  if (event.key === '/' && !event.metaKey && !event.ctrlKey && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});
