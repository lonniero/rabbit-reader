// ═══════════════════════════════════════
//  RABBIT READER — App Logic
//  RSVP Engine + PDF/EPUB Parser
// ═══════════════════════════════════════

// ── Configure PDF.js worker ──
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
let currentChapters = [];  // [{title, wordIndex}]

const MIN_WPM = 100;
const MAX_WPM = 1000;
const WPM_STEP = 25;
const STORAGE_KEY = 'rabbit_reader_books';
const POS_KEY = 'rabbit_reader_positions';  // universal position store

// ── Sample texts ──
const SAMPLES = [
  {
    id: '_sample_focus', title: 'The Art of Focus', isSample: true,
    text: 'Focus is not about saying yes to the thing you have to focus on. It is about saying no to the hundred other good ideas. Innovation is saying no to a thousand things. You have to pick carefully. Concentration and focus are qualities that need to be cultivated. In a world filled with constant distractions and notifications and demands for our attention, the ability to deeply focus on a single task has become a rare and valuable skill. The people who master this ability are the ones who produce remarkable work and make meaningful contributions. Start by eliminating distractions. Put your phone away. Close unnecessary tabs. Create an environment that supports deep work. Then commit to a block of focused time. Even twenty minutes of true focus can accomplish more than hours of scattered attention.'
  },
  {
    id: '_sample_rsvp', title: 'Speed Reading 101', isSample: true,
    text: 'Rapid Serial Visual Presentation is a technique that displays text one word at a time at a fixed point on the screen. This eliminates the need for eye movement across lines of text, which is one of the biggest bottlenecks in traditional reading. By keeping your eyes fixed on a single point, your brain can process words much faster. Most people read at about 250 words per minute with traditional reading. With RSVP trained readers can reach 500 to 700 words per minute while maintaining good comprehension. The key is starting at a comfortable speed and gradually increasing it as your brain adapts to the new input pattern.'
  },
  {
    id: '_sample_stoic', title: 'Daily Stoic', isSample: true,
    text: 'You have power over your mind not outside events. Realize this and you will find strength. The happiness of your life depends upon the quality of your thoughts. Waste no more time arguing about what a good person should be. Be one. Very little is needed to make a happy life. It is all within yourself in your way of thinking. The best revenge is to be unlike him who performed the injury. Accept the things to which fate binds you and love the people with whom fate brings you together.'
  }
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

function showLoader(msg) {
  elLoaderTxt.textContent = msg || 'Processing...';
  elOverlay.classList.add('active');
}
function hideLoader() { elOverlay.classList.remove('active'); }

// ══════════════════════════════════════
//  BOOK STORAGE (localStorage)
// ══════════════════════════════════════
function getBooks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveBooks(books) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}
function addBook(title, text) {
  const books = getBooks();
  const id = 'book_' + Date.now();
  const wordCount = text.trim().split(/\s+/).length;
  books.unshift({ id, title, text, wordCount, lastPosition: 0, addedAt: new Date().toISOString() });
  saveBooks(books);
  return id;
}
function deleteBook(id) {
  saveBooks(getBooks().filter(b => b.id !== id));
}
function updateBookPosition(id, pos) {
  // Update user books store
  const books = getBooks();
  const book = books.find(b => b.id === id);
  if (book) { book.lastPosition = pos; saveBooks(books); }
  // Always save to universal position store
  savePosition(id, pos);
}

// ── Universal position store (works for all book types) ──
function getPositions() {
  try { return JSON.parse(localStorage.getItem(POS_KEY)) || {}; }
  catch { return {}; }
}
function savePosition(id, pos) {
  const positions = getPositions();
  positions[id] = pos;
  localStorage.setItem(POS_KEY, JSON.stringify(positions));
}
function getPosition(id) {
  return getPositions()[id] || 0;
}

// ══════════════════════════════════════
//  PDF PARSER
// ══════════════════════════════════════
async function parsePDF(arrayBuffer) {
  showLoader('Reading PDF...');
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const total = pdf.numPages;
    for (let i = 1; i <= total; i++) {
      elLoaderTxt.textContent = `Page ${i} / ${total}`;
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += pageText + ' ';
    }
    return fullText.replace(/\s+/g, ' ').trim();
  } catch (err) {
    console.error('PDF parse error:', err);
    alert('Could not read this PDF.');
    return null;
  }
}

// ══════════════════════════════════════
//  EPUB PARSER
// ══════════════════════════════════════
async function parseEPUB(arrayBuffer) {
  showLoader('Reading EPUB...');
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 1. Find container.xml → rootfile path
    const containerXml = await zip.file('META-INF/container.xml').async('text');
    const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
    const rootfilePath = containerDoc.querySelector('rootfile').getAttribute('full-path');
    const rootDir = rootfilePath.includes('/') ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1) : '';

    // 2. Parse content.opf → spine reading order
    const opfXml = await zip.file(rootfilePath).async('text');
    const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

    // Build manifest map (id → href)
    const manifest = {};
    opfDoc.querySelectorAll('item').forEach(item => {
      manifest[item.getAttribute('id')] = item.getAttribute('href');
    });

    // Get spine order
    const spineItems = [];
    opfDoc.querySelectorAll('itemref').forEach(ref => {
      const idref = ref.getAttribute('idref');
      if (manifest[idref]) spineItems.push(manifest[idref]);
    });

    // 3. Extract text from each chapter
    let fullText = '';
    for (let i = 0; i < spineItems.length; i++) {
      elLoaderTxt.textContent = `Chapter ${i + 1} / ${spineItems.length}`;
      const filePath = rootDir + spineItems[i];
      const file = zip.file(filePath);
      if (!file) continue;
      const html = await file.async('text');
      const doc = new DOMParser().parseFromString(html, 'application/xhtml+xml');
      const bodyText = doc.body ? doc.body.textContent : '';
      fullText += bodyText.replace(/\s+/g, ' ').trim() + ' ';
    }
    return fullText.trim();
  } catch (err) {
    console.error('EPUB parse error:', err);
    alert('Could not read this EPUB.');
    return null;
  }
}

// ══════════════════════════════════════
//  FILE UPLOAD HANDLER
// ══════════════════════════════════════
elFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const arrayBuffer = await file.arrayBuffer();
  const ext = file.name.split('.').pop().toLowerCase();
  const title = file.name.replace(/\.[^.]+$/, '');
  let text = null;

  if (ext === 'pdf') {
    text = await parsePDF(arrayBuffer);
  } else if (ext === 'epub') {
    text = await parseEPUB(arrayBuffer);
  } else {
    alert('Unsupported format. Use PDF or EPUB.');
    hideLoader();
    return;
  }

  if (text && text.length > 0) {
    const bookId = addBook(title, text);
    hideLoader();
    loadBook(bookId);
  } else {
    hideLoader();
  }
  // Reset input so same file can be re-uploaded
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

  // Detect chapters from bundled books
  if (bookId) {
    const bundled = (typeof BUNDLED_BOOKS !== 'undefined') ? BUNDLED_BOOKS : [];
    const bbook = bundled.find(b => b.id === bookId);
    if (bbook && bbook.chapters) {
      currentChapters = bbook.chapters;
    }
  }

  // Auto-detect chapter markers in text if none from bundle
  if (currentChapters.length === 0) {
    detectChapters();
  }

  // Resume position (universal store)
  if (bookId) {
    const savedPos = getPosition(bookId);
    if (savedPos > 0 && savedPos < words.length) {
      wordIndex = savedPos;
    }
  }

  updateDisplay();
  elState.textContent = 'TAP TO START';
  elPlay.textContent = '▶';
  showScreen('reader-screen');
}

function detectChapters() {
  // Scan words for chapter patterns
  const chapterPatterns = /^(chapter|part|book|section|prologue|epilogue|introduction|preface|foreword|afterword)$/i;
  for (let i = 0; i < words.length - 1; i++) {
    if (chapterPatterns.test(words[i])) {
      // Check if next word is a number or roman numeral
      const next = words[i + 1];
      if (/^[\dIVXLCDM]+:?$/i.test(next) || /^(one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(next)) {
        const title = words[i] + ' ' + next.replace(/:$/, '');
        // Avoid duplicate near-by entries
        if (currentChapters.length === 0 || i - currentChapters[currentChapters.length - 1].wordIndex > 50) {
          currentChapters.push({ title, wordIndex: i });
        }
      }
    }
  }
}

function loadBook(bookId) {
  // Check stored books first
  const books = getBooks();
  const book = books.find(b => b.id === bookId);
  if (book) { loadText(book.text, book.id); return; }
  // Check samples
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
  if (!word) { elWord.textContent = ''; return; }
  const i = getORP(word);
  elWord.innerHTML = word.substring(0, i) + '<span class="orp">' + (word[i] || '') + '</span>' + word.substring(i + 1);
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
  if (wordIndex >= words.length - 1) {
    stopReading(); elState.textContent = '✓ FINISHED'; return;
  }
  wordIndex++;
  updateDisplay();
  // Save position every 20 words
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

// ── Chapter Navigation ──
function getCurrentChapterIndex() {
  if (currentChapters.length === 0) return -1;
  let ch = 0;
  for (let i = 1; i < currentChapters.length; i++) {
    if (wordIndex >= currentChapters[i].wordIndex) ch = i;
    else break;
  }
  return ch;
}

function prevChapter() {
  if (currentChapters.length === 0) return;
  const ch = getCurrentChapterIndex();
  // If we're past the start of current chapter, go back to its start
  // Otherwise go to previous chapter
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
  const currentCh = getCurrentChapterIndex();
  currentChapters.forEach((ch, idx) => {
    const el = document.createElement('div');
    el.className = 'lib-item' + (idx === currentCh ? ' ch-current' : '');
    const wordNum = ch.wordIndex.toLocaleString();
    el.innerHTML = `
      <div class="lib-item-info">
        <div class="lib-item-title">${idx === currentCh ? '▸ ' : ''}${ch.title}</div>
        <div class="lib-item-meta">word ${wordNum}</div>
      </div>
    `;
    el.addEventListener('click', () => {
      stopReading();
      wordIndex = ch.wordIndex;
      updateDisplay();
      elState.textContent = ch.title.toUpperCase();
      showScreen('reader-screen');
    });
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      stopReading();
      wordIndex = ch.wordIndex;
      updateDisplay();
      elState.textContent = ch.title.toUpperCase();
      showScreen('reader-screen');
    });
    list.appendChild(el);
  });
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
    el.innerHTML = `
      <div class="lib-item-info">
        <div class="lib-item-title">${icon} ${book.title}</div>
        <div class="lib-item-meta">${wc.toLocaleString()} words · ~${mins} min${resumed}</div>
      </div>
      ${!isSystem ? '<div class="lib-item-del" data-del="' + book.id + '">✕</div>' : ''}
    `;
    // Open book
    el.querySelector('.lib-item-info').addEventListener('click', () => {
      if (isSystem) loadText(book.text, book.id);
      else loadBook(book.id);
    });
    el.querySelector('.lib-item-info').addEventListener('touchend', (e) => {
      e.preventDefault();
      if (isSystem) loadText(book.text, book.id);
      else loadBook(book.id);
    });
    // Delete button
    const delBtn = el.querySelector('.lib-item-del');
    if (delBtn) {
      const handler = (e) => { e.stopPropagation(); deleteBook(book.id); buildLibrary(); };
      delBtn.addEventListener('click', handler);
      delBtn.addEventListener('touchend', (e) => { e.preventDefault(); handler(e); });
    }
    list.appendChild(el);
  });
}

// ══════════════════════════════════════
//  SCROLL WHEEL → WPM
// ══════════════════════════════════════
window.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (!$('#reader-screen').classList.contains('active')) return;
  wpm = e.deltaY < 0
    ? Math.min(MAX_WPM, wpm + WPM_STEP)
    : Math.max(MIN_WPM, wpm - WPM_STEP);
  elWpm.textContent = wpm + ' WPM';
}, { passive: false });

// ══════════════════════════════════════
//  EVENT DELEGATION
// ══════════════════════════════════════
// ── URL Import ──
async function loadFromURL() {
  const url = $('#url-input').value.trim();
  if (!url) return;

  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  if (ext !== 'pdf' && ext !== 'epub') {
    alert('URL must end in .pdf or .epub');
    return;
  }

  showLoader('Downloading ' + ext.toUpperCase() + '...');
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const arrayBuffer = await resp.arrayBuffer();
    const title = url.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '') || 'Imported Book';
    let text = null;

    if (ext === 'pdf') text = await parsePDF(arrayBuffer);
    else text = await parseEPUB(arrayBuffer);

    if (text && text.length > 0) {
      const bookId = addBook(title, text);
      hideLoader();
      loadBook(bookId);
    } else {
      hideLoader();
      alert('Could not extract text from this file.');
    }
  } catch (err) {
    hideLoader();
    console.error('URL import error:', err);
    alert('Failed to download file. Make sure the URL is a direct link to a .pdf or .epub file.');
  }
}

document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  switch (action) {
    case 'paste':       showScreen('input-screen'); break;
    case 'url-import':  showScreen('url-screen'); break;
    case 'library':     showScreen('library-screen'); break;
    case 'back-menu':   stopReading(); showScreen('menu-screen'); break;
    case 'back-reader': showScreen('reader-screen'); break;
    case 'load-input':
      const txt = $('#text-input').value;
      if (txt.trim()) loadText(txt);
      break;
    case 'load-url':    loadFromURL(); break;
    case 'toggle-play': togglePlay(); break;
    case 'step-back':   stepBack(); break;
    case 'step-fwd':    stepForward(); break;
    case 'prev-chapter': prevChapter(); break;
    case 'next-chapter': nextChapter(); break;
    case 'chapters':    stopReading(); buildChapterList(); showScreen('chapters-screen'); break;
    case 'restart':     restart(); break;
    case 'exit-reader': stopReading(); showScreen('menu-screen'); break;
  }
});

// Touch delegation (same actions)
document.addEventListener('touchend', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  e.preventDefault();
  document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  // Re-trigger via click handler above
  const el = e.target.closest('[data-action]');
  if (el) el.click();
});

// Tap word zone to play/pause
$('#word-zone').addEventListener('click', togglePlay);

// ── Init ──
buildLibrary();
