const state = {
  quote: null,
  favorites: [],
  search: '',
  topic: 'all'
};

const quoteText = document.getElementById('quoteText');
const quoteAuthor = document.getElementById('quoteAuthor');
const topicBadge = document.getElementById('topicBadge');
const sourceBadge = document.getElementById('sourceBadge');
const apiStatus = document.getElementById('apiStatus');
const feedback = document.getElementById('feedback');
const favoriteBtn = document.getElementById('favoriteBtn');
const favoritesList = document.getElementById('favoritesList');
const favoriteCount = document.getElementById('favoriteCount');
const topicFilter = document.getElementById('topicFilter');
const searchInput = document.getElementById('searchInput');
const template = document.getElementById('favoriteTemplate');

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function showFeedback(message, error = false) {
  feedback.textContent = message;
  feedback.style.color = error ? '#a04444' : '';
  window.clearTimeout(showFeedback.timer);
  showFeedback.timer = window.setTimeout(() => { feedback.textContent = ''; }, 2600);
}

function setQuote(quote) {
  state.quote = quote;
  quoteText.textContent = quote.text;
  quoteAuthor.textContent = `— ${quote.author}`;
  topicBadge.textContent = quote.topic || 'General';
  sourceBadge.textContent = quote.source === 'local-fallback' ? 'Local fallback' : 'External API';
  favoriteBtn.classList.toggle('saved', isFavorite(quote.quoteId));
  favoriteBtn.setAttribute('aria-pressed', String(isFavorite(quote.quoteId)));
  favoriteBtn.innerHTML = isFavorite(quote.quoteId) ? '<span>♥</span> Saved' : '<span>♡</span> Save favorite';
}

function isFavorite(quoteId) {
  return state.favorites.some((item) => item.quoteId === quoteId);
}

async function loadQuote(random = false) {
  const button = document.getElementById('newQuoteBtn');
  button.disabled = true;
  button.textContent = 'Loading…';
  try {
    const quote = await api(random ? '/api/quote/random' : '/api/quote');
    setQuote(quote);
    apiStatus.classList.add('live');
    apiStatus.innerHTML = `<span class="dot"></span>${quote.isFallback ? 'Fallback ready' : 'API connected'}`;
  } catch (error) {
    showFeedback(error.message, true);
    apiStatus.classList.remove('live');
    apiStatus.innerHTML = '<span class="dot"></span>Unavailable';
  } finally {
    button.disabled = false;
    button.textContent = 'New quote';
  }
}

async function loadFavorites() {
  try {
    state.favorites = await api('/api/favorites');
  } catch (error) {
    state.favorites = [];
    showFeedback('Connect MongoDB to enable favorites history.', true);
  }
  updateTopicFilter();
  renderFavorites();
  if (state.quote) setQuote(state.quote);
}

function updateTopicFilter() {
  const topics = [...new Set(state.favorites.map((item) => item.topic).filter(Boolean))].sort();
  topicFilter.innerHTML = '<option value="all">All topics</option>' + topics.map((topic) => `<option value="${escapeHtml(topic)}">${escapeHtml(topic)}</option>`).join('');
  topicFilter.value = state.topic;
}

function filteredFavorites() {
  const query = state.search.trim().toLowerCase();
  return state.favorites.filter((item) => {
    const matchesTopic = state.topic === 'all' || item.topic === state.topic;
    const haystack = `${item.text} ${item.author} ${item.topic}`.toLowerCase();
    return matchesTopic && (!query || haystack.includes(query));
  });
}

function renderFavorites() {
  favoriteCount.textContent = String(state.favorites.length);
  const items = filteredFavorites();
  favoritesList.innerHTML = '';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = state.favorites.length
      ? '<div class="empty-icon">⌕</div><strong>No matches</strong><span>Try another search or topic.</span>'
      : '<div class="empty-icon">♡</div><strong>No favorites yet</strong><span>Save a quote and it will appear here.</span>';
    favoritesList.appendChild(empty);
    return;
  }

  for (const item of items) {
    const node = template.content.cloneNode(true);
    const root = node.querySelector('.favorite-item');
    root.dataset.id = item._id;
    node.querySelector('.topic').textContent = item.topic || 'General';
    node.querySelector('.item-text').textContent = `“${item.text}”`;
    node.querySelector('.item-author').textContent = `— ${item.author}`;
    node.querySelector('.saved-date').textContent = formatDate(item.createdAt);
    node.querySelector('.remove-btn').addEventListener('click', () => removeFavorite(item._id));
    node.querySelector('.copy-favorite').addEventListener('click', async () => {
      await copyText(`“${item.text}” — ${item.author}`);
      showFeedback('Favorite copied.');
    });
    favoritesList.appendChild(node);
  }
}

async function saveFavorite() {
  if (!state.quote) return;
  if (isFavorite(state.quote.quoteId)) {
    showFeedback('This quote is already saved.');
    return;
  }

  favoriteBtn.disabled = true;
  try {
    const saved = await api('/api/favorites', {
      method: 'POST',
      body: JSON.stringify(state.quote)
    });
    state.favorites.unshift(saved);
    updateTopicFilter();
    renderFavorites();
    setQuote(state.quote);
    showFeedback('Saved to favorites.');
  } catch (error) {
    showFeedback(error.message, true);
  } finally {
    favoriteBtn.disabled = false;
  }
}

async function removeFavorite(id) {
  try {
    await api(`/api/favorites/${id}`, { method: 'DELETE' });
    state.favorites = state.favorites.filter((item) => item._id !== id);
    updateTopicFilter();
    renderFavorites();
    if (state.quote) setQuote(state.quote);
    showFeedback('Removed from favorites.');
  } catch (error) {
    showFeedback(error.message, true);
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

document.getElementById('newQuoteBtn').addEventListener('click', () => loadQuote(true));
document.getElementById('copyBtn').addEventListener('click', async () => {
  if (!state.quote) return;
  await copyText(`“${state.quote.text}” — ${state.quote.author}`);
  showFeedback('Quote copied to clipboard.');
});
favoriteBtn.addEventListener('click', saveFavorite);
searchInput.addEventListener('input', (event) => { state.search = event.target.value; renderFavorites(); });
topicFilter.addEventListener('change', (event) => { state.topic = event.target.value; renderFavorites(); });

(async function init() {
  await Promise.all([loadQuote(false), loadFavorites()]);
})();
