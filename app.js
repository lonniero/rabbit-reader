// ═══════════════════════════════════════
//  RABBIT READER — App Logic
//  RSVP Engine + Browse Mode + PDF/EPUB
// ═══════════════════════════════════════

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ══════════════════════════════════════
//  STATE
// ══════════════════════════════════════
let words = [];
let wordIndex = 0;
let wpm = 300;
let isPlaying = false;
let timer = null;
let currentBookId = null;
let currentChapters = [];
let browseFontSize = 10;

const MIN_WPM = 100, MAX_WPM = 1000, WPM_STEP = 25;
const STORAGE_KEY = 'rabbit_reader_books';
const POS_KEY = 'rabbit_reader_positions';

// Canvas for measuring text widths (ORP alignment)
const _mc = document.createElement('canvas').getContext('2d');
_mc.font = '700 28px -apple-system, "Helvetica Neue", sans-serif';

// ── Samples ──
const SAMPLES = [
  { id:'_sample_focus', title:'The Art of Focus', isSample:true,
    text:'Focus is not about saying yes to the thing you have to focus on. It is about saying no to the hundred other good ideas. Innovation is saying no to a thousand things. You have to pick carefully. Concentration and focus are qualities that need to be cultivated. In a world filled with constant distractions and notifications and demands for our attention, the ability to deeply focus on a single task has become a rare and valuable skill. The people who master this ability are the ones who produce remarkable work and make meaningful contributions. Start by eliminating distractions. Put your phone away. Close unnecessary tabs. Create an environment that supports deep work. Then commit to a block of focused time. Even twenty minutes of true focus can accomplish more than hours of scattered attention.' },
  { id:'_sample_rsvp', title:'Speed Reading 101', isSample:true,
    text:'Rapid Serial Visual Presentation is a technique that displays text one word at a time at a fixed point on the screen. This eliminates the need for eye movement across lines of text, which is one of the biggest bottlenecks in traditional reading. By keeping your eyes fixed on a single point, your brain can process words much faster. Most people read at about 250 words per minute with traditional reading. With RSVP trained readers can reach 500 to 700 words per minute while maintaining good comprehension. The key is starting at a comfortable speed and gradually increasing it as your brain adapts to the new input pattern.' },
  { id:'_sample_stoic', title:'Daily Stoic', isSample:true,
    text:'You have power over your mind not outside events. Realize this and you will find strength. The happiness of your life depends upon the quality of your thoughts. Waste no more time arguing about what a good person should be. Be one. Very little is needed to make a happy life. It is all within yourself in your way of thinking. The best revenge is to be unlike him who performed the injury. Accept the things to which fate binds you and love the people with whom fate brings you together.' }
];

// ══════════════════════════════════════
//  DOM REFS
// ══════════════════════════════════════
const $ = (sel) => document.querySelector(sel);
const elWord      = $('#current-word');
const elWpm       = $('#wpm-label');
const elCount     = $('#word-count');
const elProgress  = $('#progress-fill');
const elState     = $('#state-label');
const elPlay      = $('#btn-play');
const elFileInput = $('#file-input');
const elOverlay   = $('#loading-overlay');
const elLoaderTxt = $('#loader-text');

// ══════════════════════════════════════
//  SCREEN NAV
// ══════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'library-screen') buildLibrary();
}
function showLoader(msg) { elLoaderTxt.textContent = msg || 'Processing...'; elOverlay.classList.add('active'); }
function hideLoader() { elOverlay.classList.remove('active'); }

// ══════════════════════════════════════
//  BOOK STORAGE
// ══════════════════════════════════════
function getBooks() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function saveBooks(books) { localStorage.setItem(STORAGE_KEY, JSON.stringify(books)); }
function addBook(title, text) {
  const books = getBooks();
  const id = 'book_' + Date.now();
  const wordCount = text.trim().split(/\s+/).length;
  books.unshift({ id, title, text, wordCount, lastPosition:0, addedAt: new Date().toISOString() });
  saveBooks(books);
  return id;
}
function deleteBook(id) { saveBooks(getBooks().filter(b => b.id !== id)); }
function updateBookPosition(id, pos) {
  const books = getBooks();
  const book = books.find(b => b.id === id);
  if (book) { book.lastPosition = pos; saveBooks(books); }
  savePosition(id, pos);
}

// Universal position store
function getPositions() { try { return JSON.parse(localStorage.getItem(POS_KEY)) || {}; } catch { return {}; } }
function savePosition(id, pos) { const p = getPositions(); p[id] = pos; localStorage.setItem(POS_KEY, JSON.stringify(p)); }
function getPosition(id) { return getPositions()[id] || 0; }

// ══════════════════════════════════════
//  PDF / EPUB PARSERS
// ══════════════════════════════════════
async function parsePDF(arrayBuffer) {
  showLoader('Parsing PDF...');
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + ' ';
    }
    return cleanText(text);
  } catch (err) { console.error('PDF parse error:', err); return null; }
}

async function parseEPUB(arrayBuffer) {
  showLoader('Parsing EPUB...');
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const containerXml = await zip.file('META-INF/container.xml').async('text');
    const rootMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!rootMatch) throw new Error('No rootfile');
    const rootPath = rootMatch[1];
    const rootDir = rootPath.includes('/') ? rootPath.substring(0, rootPath.lastIndexOf('/') + 1) : '';
    const opfXml = await zip.file(rootPath).async('text');
    const manifest = {};
    let m;
    const r1 = /<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]*>/g;
    while ((m = r1.exec(opfXml))) manifest[m[1]] = m[2];
    const r2 = /<item[^>]+href="([^"]+)"[^>]+id="([^"]+)"[^>]*>/g;
    while ((m = r2.exec(opfXml))) manifest[m[2]] = m[1];
    const spine = [];
    const r3 = /<itemref[^>]+idref="([^"]+)"[^>]*>/g;
    while ((m = r3.exec(opfXml))) if (manifest[m[1]]) spine.push(manifest[m[1]]);
    let text = '';
    for (const href of spine) {
      const f = zip.file(rootDir + href);
      if (!f) continue;
      const html = await f.async('text');
      text += html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ') + ' ';
    }
    return cleanText(text);
  } catch (err) { console.error('EPUB parse error:', err); return null; }
}

function cleanText(txt) {
  return txt.replace(/[^\x20-\x7E\u00A0-\u024F\u2000-\u206F]/g, ' ')
            .replace(/\s+/g, ' ').trim();
}

// ── File input handler ──
elFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const ab = await file.arrayBuffer();
  const ext = file.name.split('.').pop().toLowerCase();
  const title = file.name.replace(/\.[^.]+$/, '');
  let text = ext === 'pdf' ? await parsePDF(ab) : ext === 'epub' ? await parseEPUB(ab) : null;
  if (text && text.length > 0) { const id = addBook(title, text); hideLoader(); loadBook(id); }
  else { hideLoader(); }
  elFileInput.value = '';
});

// ══════════════════════════════════════
//  READER ENGINE
// ══════════════════════════════════════
function loadText(text, bookId) {
  words = text.trim().split(/\s+/).filter(w => w.length > 0);
  wordIndex = 0;
  currentBookId = bookId || null;
  currentChapters = [];
  isPlaying = false;
  clearTimeout(timer);

  // Load chapters from bundled books
  if (bookId) {
    const bundled = (typeof BUNDLED_BOOKS !== 'undefined') ? BUNDLED_BOOKS : [];
    const bb = bundled.find(b => b.id === bookId);
    if (bb && bb.chapters) currentChapters = bb.chapters;
  }
  if (currentChapters.length === 0) detectChapters();

  // Resume position
  if (bookId) {
    const pos = getPosition(bookId);
    if (pos > 0 && pos < words.length) wordIndex = pos;
  }

  updateDisplay();
  elState.textContent = 'TAP TO START';
  elPlay.textContent = '▶';
  showScreen('reader-screen');
}

function detectChapters() {
  const pat = /^(chapter|part|book|section|prologue|epilogue|introduction|preface|foreword|afterword)$/i;
  for (let i = 0; i < words.length - 1; i++) {
    if (pat.test(words[i])) {
      const next = words[i + 1];
      if (/^[\dIVXLCDM]+:?$/i.test(next) || /^(one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(next)) {
        const title = words[i] + ' ' + next.replace(/:$/, '');
        if (currentChapters.length === 0 || i - currentChapters[currentChapters.length - 1].wordIndex > 50)
          currentChapters.push({ title, wordIndex: i });
      }
    }
  }
}

function loadBook(bookId) {
  const books = getBooks();
  const book = books.find(b => b.id === bookId);
  if (book) { loadText(book.text, book.id); return; }
  const sample = SAMPLES.find(s => s.id === bookId);
  if (sample) loadText(sample.text, sample.id);
}

// ── ORP (Optimal Recognition Point) ──
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

  // Position so ORP letter aligns with center guide marks
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

// ── Playback ──
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
  if (currentBookId && wordIndex % 20 === 0) updateBookPosition(currentBookId, wordIndex);
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
  if (currentBookId) updateBookPosition(currentBookId, wordIndex);
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
//  CHAPTER NAVIGATION
// ══════════════════════════════════════
function getCurrentChapterIndex() {
  if (currentChapters.length === 0) return -1;
  let ch = 0;
  for (let i = 1; i < currentChapters.length; i++) {
    if (wordIndex >= currentChapters[i].wordIndex) ch = i; else break;
  }
  return ch;
}

function prevChapter() {
  if (currentChapters.length === 0) return;
  const ch = getCurrentChapterIndex();
  const target = (ch > 0 && wordIndex - currentChapters[ch].wordIndex > 10) ? ch : Math.max(0, ch - 1);
  stopReading();
  wordIndex = currentChapters[target].wordIndex;
  updateDisplay();
  elState.textContent = currentChapters[target].title.toUpperCase();
}

function nextChapter() {
  if (currentChapters.length === 0) return;
  const ch = getCurrentChapterIndex();
  if (ch < currentChapters.length - 1) {
    stopReading();
    wordIndex = currentChapters[ch + 1].wordIndex;
    updateDisplay();
    elState.textContent = currentChapters[ch + 1].title.toUpperCase();
  }
}

function buildChapterList() {
  const list = $('#chapter-list');
  list.innerHTML = '';
  if (currentChapters.length === 0) {
    list.innerHTML = '<div style="text-align:center;font-size:8px;color:#444;padding:20px;">No chapters detected</div>';
    return;
  }
  const curCh = getCurrentChapterIndex();
  currentChapters.forEach((ch, idx) => {
    const el = document.createElement('div');
    el.className = 'lib-item' + (idx === curCh ? ' ch-current' : '');
    el.innerHTML = '<div class="lib-item-info"><div class="lib-item-title">' +
      (idx === curCh ? '▸ ' : '') + ch.title +
      '</div><div class="lib-item-meta">word ' + ch.wordIndex.toLocaleString() + '</div></div>';
    el.addEventListener('click', () => {
      stopReading(); wordIndex = ch.wordIndex; updateDisplay();
      elState.textContent = ch.title.toUpperCase(); showScreen('reader-screen');
    });
    list.appendChild(el);
  });
}

// ══════════════════════════════════════
//  BROWSE MODE
// ══════════════════════════════════════
function openBrowseMode() {
  stopReading();
  const body = $('#browse-body');
  body.style.fontSize = browseFontSize + 'px';

  // Show ~800 words centered on current position
  const range = 400;
  const start = Math.max(0, wordIndex - range);
  const end = Math.min(words.length, wordIndex + range);

  // Find chapter boundaries for labels
  const chapterStarts = new Set(currentChapters.map(c => c.wordIndex));
  const chapterNames = {};
  currentChapters.forEach(c => { chapterNames[c.wordIndex] = c.title; });

  let html = '';
  for (let i = start; i < end; i++) {
    if (chapterStarts.has(i)) {
      html += '<span class="bw-chapter">' + chapterNames[i] + '</span> ';
    }
    const cls = i === wordIndex ? 'bw bw-current' : 'bw';
    html += '<span class="' + cls + '" data-wi="' + i + '">' + words[i] + '</span> ';
  }
  body.innerHTML = html;

  // Scroll current word into view
  const cur = body.querySelector('.bw-current');
  if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 50);

  $('#browse-title').textContent = currentChapters.length > 0 ?
    (currentChapters[getCurrentChapterIndex()] || {}).title || 'Browse' : 'Browse';

  showScreen('browse-screen');

  // Tap a word to jump there
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
//  LIBRARY UI
// ══════════════════════════════════════
function buildLibrary() {
  const list = $('#lib-list');
  list.innerHTML = '';
  const userBooks = getBooks();
  const bundled = (typeof BUNDLED_BOOKS !== 'undefined') ? BUNDLED_BOOKS : [];
  const allBooks = [...userBooks, ...bundled, ...SAMPLES];

  if (allBooks.length === 0) {
    list.innerHTML = '<div style="text-align:center;font-size:8px;color:#444;padding:20px;">No books yet.<br>Upload a PDF or EPUB!</div>';
    return;
  }

  allBooks.forEach(book => {
    const wc = book.wordCount || book.text.trim().split(/\s+/).length;
    const mins = Math.ceil(wc / wpm);
    const isSample = book.isSample || book.id.startsWith('_sample');
    const isBundled = book.isBundled || book.id.startsWith('_bundled');
    const isSystem = isSample || isBundled;
    const savedPos = getPosition(book.id);
    const resumed = (savedPos > 0) ? ' · ▸ ' + Math.round((savedPos / wc) * 100) + '%' : '';
    const icon = isBundled ? '📕' : isSample ? '📝' : '📄';

    const el = document.createElement('div');
    el.className = 'lib-item';
    el.innerHTML =
      '<div class="lib-item-info"><div class="lib-item-title">' + icon + ' ' + book.title +
      '</div><div class="lib-item-meta">' + wc.toLocaleString() + ' words · ~' + mins + ' min' + resumed +
      '</div></div>' + (!isSystem ? '<div class="lib-item-del" data-del="' + book.id + '">✕</div>' : '');

    el.querySelector('.lib-item-info').addEventListener('click', () => {
      if (isSystem) loadText(book.text, book.id); else loadBook(book.id);
    });

    const delBtn = el.querySelector('.lib-item-del');
    if (delBtn) delBtn.addEventListener('click', (ev) => {
      ev.stopPropagation(); deleteBook(book.id); buildLibrary();
    });
    list.appendChild(el);
  });
}

// ══════════════════════════════════════
//  URL IMPORT
// ══════════════════════════════════════
async function loadFromURL() {
  const url = ($('#url-input').value || '').trim();
  if (!url) return;
  showLoader('Downloading...');
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const ab = await resp.arrayBuffer();
    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    let text = null;
    if (ext === 'pdf') text = await parsePDF(ab);
    else if (ext === 'epub') text = await parseEPUB(ab);
    else { hideLoader(); alert('URL must point to a .pdf or .epub file.'); return; }
    if (text && text.length > 0) {
      const title = url.split('/').pop().split('.')[0].replace(/[-_]/g, ' ');
      const id = addBook(title, text);
      hideLoader(); loadBook(id);
    } else { hideLoader(); alert('Could not extract text.'); }
  } catch (err) { hideLoader(); alert('Failed: ' + err.message); }
}

// ══════════════════════════════════════
//  EVENT DELEGATION
// ══════════════════════════════════════
document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  switch (action) {
    case 'paste':       showScreen('input-screen'); break;
    case 'url-import':  showScreen('url-screen'); break;
    case 'library':     showScreen('library-screen'); break;
    case 'back-menu':   stopReading(); showScreen('menu-screen'); break;
    case 'back-reader': showScreen('reader-screen'); break;
    case 'load-input':  { const t = $('#text-input').value; if (t.trim()) loadText(t); } break;
    case 'load-url':    loadFromURL(); break;
    case 'toggle-play': togglePlay(); break;
    case 'step-back':   stepBack(); break;
    case 'step-fwd':    stepForward(); break;
    case 'speed-up':    changeSpeed(WPM_STEP); break;
    case 'speed-down':  changeSpeed(-WPM_STEP); break;
    case 'prev-chapter': prevChapter(); break;
    case 'next-chapter': nextChapter(); break;
    case 'chapters':    stopReading(); buildChapterList(); showScreen('chapters-screen'); break;
    case 'restart':     restart(); break;
    case 'browse-mode': openBrowseMode(); break;
    case 'browse-font-up':   changeBrowseFont(1); break;
    case 'browse-font-down': changeBrowseFont(-1); break;
    case 'exit-reader': stopReading(); showScreen('menu-screen'); break;
  }
});

// Touch delegation
document.addEventListener('touchend', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  e.preventDefault();
  e.target.closest('[data-action]').click();
});

// Tap word zone to play/pause
$('#word-zone').addEventListener('click', togglePlay);

// Scroll wheel → speed control (R1 wheel + desktop mouse)
document.addEventListener('wheel', (e) => {
  e.preventDefault();
  const screen = document.querySelector('.screen.active');
  if (screen && screen.id === 'browse-screen') {
    // In browse mode, wheel scrolls text (default behavior handled by overflow)
    return;
  }
  if (e.deltaY < 0) changeSpeed(WPM_STEP);
  else if (e.deltaY > 0) changeSpeed(-WPM_STEP);
}, { passive: false });

// Side button → toggle browse mode (R1 side button maps to various key events)
document.addEventListener('keydown', (e) => {
  const screen = document.querySelector('.screen.active');
  // Map common R1 side-button keys + 'b' for desktop testing
  if (e.key === 'b' || e.key === 'F1' || e.key === 'Camera' || e.key === 'MediaRecord') {
    e.preventDefault();
    if (screen && screen.id === 'reader-screen' && words.length > 0) openBrowseMode();
    else if (screen && screen.id === 'browse-screen') showScreen('reader-screen');
  }
  // Space = play/pause
  if (e.key === ' ' && screen && screen.id === 'reader-screen') {
    e.preventDefault(); togglePlay();
  }
});

// ── Init ──
buildLibrary();
