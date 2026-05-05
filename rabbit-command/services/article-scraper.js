// ═══════════════════════════════════════
//  Article Scraper Service
//  Extracts clean article text from URLs
//  using Mozilla Readability + JSDOM
// ═══════════════════════════════════════

const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

/**
 * Fetch a URL and extract clean article text.
 * @param {string} url - Article URL
 * @returns {object} { title, text, wordCount, excerpt }
 */
async function scrapeArticle(url) {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RabbitRSS/1.0; +https://rabbit-reader.app)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();

  // Parse with JSDOM + Readability
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent) {
    throw new Error('Could not extract article content');
  }

  // Clean up the text
  const text = article.textContent
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();

  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  return {
    title: article.title || 'Untitled',
    text,
    wordCount,
    excerpt: article.excerpt || text.substring(0, 200),
  };
}

module.exports = { scrapeArticle };
