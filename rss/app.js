// ═══════════════════════════════════════
//  RABBIT RSS — App Logic
//  Timeline + Article Reader + RSVP
// ═══════════════════════════════════════

// ══════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════

// API base URL — change this when deployed to Railway
const API_BASE = 'https://rabbit-bot-production.up.railway.app';
// For local development, use: 'http://localhost:3000'

const CACHE_KEY = 'rabbit_rss_timeline';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ══════════════════════════════════════
//  STATE
// ══════════════════════════════════════
let timeline = [];
let categories = [];
let activeCategory = 'all';
let currentArticle = null;

// RSVP state
let words = [];
let wordIndex = 0;
let wpm = 300;
let isPlaying = false;
let timer = null;
let browseFontSize = 10;
let artFontSize = 9;

const MIN_WPM = 100, MAX_WPM = 1000, WPM_STEP = 25;

// Canvas for ORP measurement
const _mc = document.createElement('canvas').getContext('2d');
_mc.font = '700 28px -apple-system, "Helvetica Neue", sans-serif';

// ══════════════════════════════════════
//  DOM REFS
// ══════════════════════════════════════
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const elWord      = $('#current-word');
const elWpm       = $('#wpm-label');
const elCount     = $('#word-count');
const elProgress  = $('#progress-fill');
const elState     = $('#state-label');
const elPlay      = $('#btn-play');

// ══════════════════════════════════════
//  SCREEN NAV
// ══════════════════════════════════════
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ══════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h';
  const days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd';
  return Math.floor(days / 7) + 'w';
}

function getInitial(title) {
  if (!title) return '?';
  return title.charAt(0).toUpperCase();
}

function getCategoryClass(cat) {
  const valid = ['tech', 'news', 'design', 'music', 'finance', 'sports'];
  return valid.includes(cat) ? cat : 'other';
}

// ══════════════════════════════════════
//  API CALLS
// ══════════════════════════════════════

async function fetchTimeline(category) {
  const params = new URLSearchParams();
  if (category && category !== 'all') params.set('category', category);
  params.set('limit', '15');

  const url = `${API_BASE}/api/timeline?${params}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

async function fetchArticleContent(articleUrl) {
  const url = `${API_BASE}/api/articles/content?url=${encodeURIComponent(articleUrl)}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!resp.ok) throw new Error(`Scrape error: ${resp.status}`);
  return resp.json();
}

async function fetchFeeds() {
  const resp = await fetch(`${API_BASE}/api/feeds`, { signal: AbortSignal.timeout(10000) });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

// ══════════════════════════════════════
//  CACHE
// ══════════════════════════════════════

function getCachedTimeline() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  } catch {}
  return null;
}

function setCachedTimeline(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

// ══════════════════════════════════════
//  TIMELINE
// ══════════════════════════════════════

async function loadTimeline(force = false) {
  const list = $('#tl-list');
  const status = $('#tl-status');

  // Show cached content immediately
  if (!force) {
    const cached = getCachedTimeline();
    if (cached) {
      timeline = cached.articles || [];
      categories = cached.categories || [];
      renderFilters();
      renderTimeline();
      status.textContent = `${timeline.length} articles · cached`;
      // Still refresh in background
      refreshTimelineQuiet();
      return;
    }
  }

  // Show loading
  list.innerHTML = `
    <div class="tl-loading">
      <div class="loader-ring"></div>
      <div class="loader-text">Loading feeds...</div>
    </div>
  `;

  try {
    const data = await fetchTimeline(activeCategory);
    timeline = data.articles || [];
    categories = data.categories || [];
    setCachedTimeline(data);
    renderFilters();
    renderTimeline();
    status.textContent = `${timeline.length} articles · ${data.feedCount} feeds`;
  } catch (err) {
    console.error('[timeline]', err);
    list.innerHTML = `
      <div class="tl-error">
        Could not load feeds<br>
        <small>${err.message}</small>
        <div class="tl-retry" data-action="retry-load">Retry</div>
      </div>
    `;
    status.textContent = '';
  }
}

async function refreshTimelineQuiet() {
  try {
    const data = await fetchTimeline(activeCategory);
    timeline = data.articles || [];
    categories = data.categories || [];
    setCachedTimeline(data);
    renderTimeline();
    $('#tl-status').textContent = `${timeline.length} articles · ${data.feedCount} feeds`;
  } catch {}
}

function renderFilters() {
  const container = $('#tl-filters');
  let html = '<div class="filter-pill' + (activeCategory === 'all' ? ' active' : '') + '" data-category="all">All</div>';

  categories.forEach(cat => {
    const cls = getCategoryClass(cat);
    const active = activeCategory === cat ? ' active' : '';
    html += `<div class="filter-pill${active}" data-category="${cat}">${cat}</div>`;
  });

  container.innerHTML = html;
}

function renderTimeline() {
  const list = $('#tl-list');

  if (timeline.length === 0) {
    list.innerHTML = `
      <div class="tl-empty">
        <div class="tl-empty-icon">📰</div>
        <div class="tl-empty-text">No articles yet.<br>Drop a site URL in #rss-feeds<br>on Discord to get started.</div>
      </div>
    `;
    return;
  }

  let html = '';
  timeline.forEach((art, idx) => {
    const cat = getCategoryClass(art.category);
    const initial = getInitial(art.feedTitle);
    const ago = timeAgo(art.date);

    html += `
      <div class="tl-card" data-action="open-article" data-idx="${idx}">
        <div class="tl-card-icon icon-${cat}">${initial}</div>
        <div class="tl-card-body">
          <div class="tl-card-title">${escapeHtml(art.title)}</div>
          <div class="tl-card-meta">
            <span class="tl-card-source">${escapeHtml(art.feedTitle)}</span>
            <span>·</span>
            <span>${ago}</span>
            <span class="tl-card-cat cat-${cat}">${cat}</span>
          </div>
        </div>
      </div>
    `;
  });

  list.innerHTML = html;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ══════════════════════════════════════
//  ARTICLE VIEW
// ══════════════════════════════════════

async function openArticle(idx) {
  const art = timeline[idx];
  if (!art) return;
  currentArticle = art;

  // Set header
  $('#art-source').textContent = art.feedTitle || 'Article';

  // Set meta
  const dateStr = art.date ? new Date(art.date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) : '';
  $('#art-meta').innerHTML = `
    <div class="art-meta-title">${escapeHtml(art.title)}</div>
    <div class="art-meta-date">${art.author ? art.author + ' · ' : ''}${dateStr}</div>
  `;

  // Show loading
  const body = $('#art-body');
  body.style.fontSize = artFontSize + 'px';
  body.innerHTML = `
    <div class="tl-loading">
      <div class="loader-ring"></div>
      <div class="loader-text">Fetching article...</div>
    </div>
  `;

  showScreen('article-screen');

  // Fetch full article
  try {
    const content = await fetchArticleContent(art.link);
    currentArticle.fullText = content.text;
    currentArticle.wordCount = content.wordCount;

    // Render paragraphs
    const paragraphs = content.text.split(/\n\n+/);
    body.innerHTML = paragraphs
      .map(p => `<p style="margin-bottom:8px;">${escapeHtml(p.trim())}</p>`)
      .join('');

  } catch (err) {
    console.error('[article]', err);
    // Fall back to snippet
    if (art.snippet) {
      body.innerHTML = `
        <p style="margin-bottom:8px;">${escapeHtml(art.snippet)}</p>
        <p style="color:var(--text-muted);font-size:7px;margin-top:12px;">
          Full article could not be loaded.<br>${err.message}
        </p>
      `;
      currentArticle.fullText = art.snippet;
      currentArticle.wordCount = art.snippet.split(/\s+/).length;
    } else {
      body.innerHTML = `<div class="tl-error">Could not load article<br><small>${err.message}</small></div>`;
    }
  }
}

function changeArtFont(delta) {
  artFontSize = Math.max(7, Math.min(16, artFontSize + delta));
  $('#art-body').style.fontSize = artFontSize + 'px';
}

// ══════════════════════════════════════
//  RSVP ENGINE
// ══════════════════════════════════════

function startRSVP() {
  if (!currentArticle?.fullText) return;
  words = currentArticle.fullText.trim().split(/\s+/).filter(w => w.length > 0);
  wordIndex = 0;
  isPlaying = false;
  clearTimeout(timer);
  updateDisplay();
  elState.textContent = 'TAP TO START';
  elPlay.textContent = '▶';
  showScreen('reader-screen');
}

function getORP(word) {
  const len = word.replace(/[^a-zA-Z0-9]/g, '').length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

function renderWord(word) {
  if (!word) { elWord.innerHTML = ''; elWord.style.left = ''; return; }
  const i = getORP(word);
  const pre = word.substring(0, i);
  const letter = word[i] || '';
  const post = word.substring(i + 1);
  elWord.innerHTML =
    '<span class="orp-pre">' + pre + '</span>' +
    '<span class="orp-letter">' + letter + '</span>' +
    '<span class="orp-post">' + post + '</span>';

  const zoneW = elWord.parentElement.offsetWidth;
  const preW = _mc.measureText(pre).width;
  const orpW = _mc.measureText(letter).width;
  elWord.style.left = (zoneW / 2 - preW - orpW / 2) + 'px';
}

function updateDisplay() {
  renderWord(words[wordIndex] || '');
  elWpm.textContent = wpm + ' WPM';
  elCount.textContent = (wordIndex + 1) + ' / ' + words.length;
  elProgress.style.width = (words.length > 0 ? ((wordIndex + 1) / words.length) * 100 : 0) + '%';
}

function getDelay(word) {
  const base = 60000 / wpm;
  if (/[.!?]$/.test(word)) return base * 2.2;
  if (/[,;:]$/.test(word)) return base * 1.5;
  if (word.length > 8) return base * 1.2;
  return base;
}

function tick() {
  if (wordIndex >= words.length - 1) { stopReading(); elState.textContent = '✓ FINISHED'; return; }
  wordIndex++;
  updateDisplay();
  clearTimeout(timer);
  timer = setTimeout(tick, getDelay(words[wordIndex]));
}

function startReading() {
  if (words.length === 0) return;
  isPlaying = true;
  elState.textContent = 'READING';
  elPlay.textContent = '❚❚';
  timer = setTimeout(tick, getDelay(words[wordIndex]));
}

function stopReading() {
  isPlaying = false;
  clearTimeout(timer);
  elState.textContent = 'PAUSED';
  elPlay.textContent = '▶';
}

function togglePlay() {
  if (wordIndex >= words.length - 1 && !isPlaying) { wordIndex = 0; updateDisplay(); }
  isPlaying ? stopReading() : startReading();
}

function stepBack()    { stopReading(); wordIndex = Math.max(0, wordIndex - 1); updateDisplay(); }
function stepForward() { stopReading(); wordIndex = Math.min(words.length - 1, wordIndex + 1); updateDisplay(); }
function restart()     { stopReading(); wordIndex = 0; updateDisplay(); elState.textContent = 'TAP TO START'; }

function changeSpeed(delta) {
  wpm = Math.max(MIN_WPM, Math.min(MAX_WPM, wpm + delta));
  elWpm.textContent = wpm + ' WPM';
  if (isPlaying) { clearTimeout(timer); timer = setTimeout(tick, getDelay(words[wordIndex])); }
}

// ══════════════════════════════════════
//  BROWSE MODE
// ══════════════════════════════════════

function openBrowseMode() {
  stopReading();
  const body = $('#browse-body');
  body.style.fontSize = browseFontSize + 'px';

  const range = 400;
  const start = Math.max(0, wordIndex - range);
  const end = Math.min(words.length, wordIndex + range);

  let html = '';
  for (let i = start; i < end; i++) {
    const cls = i === wordIndex ? 'bw bw-current' : 'bw';
    html += '<span class="' + cls + '" data-wi="' + i + '">' + words[i] + '</span> ';
  }
  body.innerHTML = html;

  const cur = body.querySelector('.bw-current');
  if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 50);

  $('#browse-title').textContent = currentArticle?.title?.substring(0, 30) || 'Browse';
  showScreen('browse-screen');

  body.onclick = (e) => {
    const wi = e.target.dataset?.wi;
    if (wi !== undefined) {
      wordIndex = parseInt(wi);
      updateDisplay();
      elState.textContent = 'POSITION SET';
      showScreen('reader-screen');
    }
  };
}

function changeBrowseFont(delta) {
  browseFontSize = Math.max(7, Math.min(18, browseFontSize + delta));
  $('#browse-body').style.fontSize = browseFontSize + 'px';
}

// ══════════════════════════════════════
//  FEEDS MANAGER
// ══════════════════════════════════════

async function loadFeeds() {
  const list = $('#feeds-list');
  list.innerHTML = `
    <div class="tl-loading">
      <div class="loader-ring"></div>
      <div class="loader-text">Loading feeds...</div>
    </div>
  `;

  showScreen('feeds-screen');

  try {
    const feeds = await fetchFeeds();

    if (feeds.length === 0) {
      list.innerHTML = `
        <div class="tl-empty" style="padding:12px;">
          <div class="tl-empty-icon">📡</div>
          <div class="tl-empty-text">No feeds yet.<br>Drop a URL in #rss-feeds.</div>
        </div>
      `;
      return;
    }

    list.innerHTML = feeds.map(feed => {
      const cat = getCategoryClass(feed.category);
      const initial = getInitial(feed.title);
      return `
        <div class="feed-item">
          <div class="feed-item-icon icon-${cat}">${initial}</div>
          <div class="feed-item-info">
            <div class="feed-item-title">${escapeHtml(feed.title)}</div>
            <div class="feed-item-meta">
              <span class="tl-card-cat cat-${cat}">${cat}</span>
              ${feed.addedAt ? ' · added ' + timeAgo(feed.addedAt) : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    list.innerHTML = `<div class="tl-error">Could not load feeds<br><small>${err.message}</small></div>`;
  }
}

// ══════════════════════════════════════
//  EVENT DELEGATION
// ══════════════════════════════════════

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  switch (action) {
    // Timeline
    case 'show-feeds':     loadFeeds(); break;
    case 'retry-load':     loadTimeline(true); break;
    case 'open-article':   openArticle(parseInt(el.dataset.idx)); break;

    // Article
    case 'back-timeline':  showScreen('timeline-screen'); break;
    case 'start-rsvp':     startRSVP(); break;
    case 'art-font-up':    changeArtFont(1); break;
    case 'art-font-down':  changeArtFont(-1); break;

    // RSVP
    case 'toggle-play':    togglePlay(); break;
    case 'step-back':      stepBack(); break;
    case 'step-fwd':       stepForward(); break;
    case 'speed-up':       changeSpeed(WPM_STEP); break;
    case 'speed-down':     changeSpeed(-WPM_STEP); break;
    case 'restart':        restart(); break;
    case 'browse-mode':    openBrowseMode(); break;
    case 'back-article':   stopReading(); showScreen('article-screen'); break;

    // Browse
    case 'back-rsvp':      showScreen('reader-screen'); break;
    case 'browse-font-up':   changeBrowseFont(1); break;
    case 'browse-font-down': changeBrowseFont(-1); break;
  }
});

// ── Filter clicks ──
$('#tl-filters').addEventListener('click', (e) => {
  const pill = e.target.closest('.filter-pill');
  if (!pill) return;
  activeCategory = pill.dataset.category;
  $$('.filter-pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  loadTimeline(true);
});

// ── Touch delegation ──
document.addEventListener('touchend', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  e.preventDefault();
  e.target.closest('[data-action]').click();
});

// ── Tap word zone to play/pause ──
$('#word-zone').addEventListener('click', togglePlay);

// ── Scroll wheel → speed control in RSVP ──
document.addEventListener('wheel', (e) => {
  const screen = document.querySelector('.screen.active');
  if (!screen) return;

  // In browse mode or article view, let scroll happen naturally
  if (screen.id === 'browse-screen' || screen.id === 'article-screen') return;
  // In timeline, let scroll happen naturally
  if (screen.id === 'timeline-screen') return;

  e.preventDefault();
  if (e.deltaY < 0) changeSpeed(WPM_STEP);
  else if (e.deltaY > 0) changeSpeed(-WPM_STEP);
}, { passive: false });

// ── Side button toggle ──
document.addEventListener('keydown', (e) => {
  const screen = document.querySelector('.screen.active');
  if (e.key === 'b' || e.key === 'F1' || e.key === 'Camera' || e.key === 'MediaRecord') {
    e.preventDefault();
    if (screen?.id === 'reader-screen' && words.length > 0) openBrowseMode();
    else if (screen?.id === 'browse-screen') showScreen('reader-screen');
  }
  if (e.key === ' ' && screen?.id === 'reader-screen') {
    e.preventDefault(); togglePlay();
  }
});

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════
loadTimeline();
