// ═══════════════════════════════════════
//  RSS Validator Service
// ═══════════════════════════════════════

const Parser = require('rss-parser');
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/rdf+xml;q=0.8, application/atom+xml;q=0.6, application/xml;q=0.4, text/xml;q=0.4'
  },
});

/**
 * Validate and parse an RSS/Atom feed URL.
 * @param {string} url - Direct RSS feed URL
 * @returns {object} { title, description, feedUrl, siteUrl, itemCount }
 */
async function validateFeed(url) {
  const feed = await parser.parseURL(url);

  return {
    title: feed.title || 'Untitled Feed',
    description: feed.description || '',
    feedUrl: feed.feedUrl || url,
    siteUrl: feed.link || '',
    itemCount: feed.items?.length || 0,
  };
}

/**
 * Fetch latest articles from a feed URL.
 * @param {string} url - RSS feed URL
 * @param {number} limit - Max articles to return
 * @returns {Array} Articles with title, link, date, snippet
 */
async function fetchArticles(url, limit = 20) {
  const feed = await parser.parseURL(url);

  return (feed.items || []).slice(0, limit).map(item => ({
    title: item.title || 'Untitled',
    link: item.link || '',
    date: item.isoDate || item.pubDate || null,
    snippet: stripHtml(item.contentSnippet || item.content || '').substring(0, 300),
    author: item.creator || item.author || '',
  }));
}

/**
 * Try to discover an RSS feed from a regular website URL.
 * Fetches the HTML and looks for <link rel="alternate" type="application/rss+xml">.
 * @param {string} url - Website URL
 * @returns {string|null} Discovered feed URL or null
 */
async function discoverFeed(url) {
  try {
    const resp = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await resp.text();

    // Look for RSS/Atom link tags
    const patterns = [
      /href="([^"]+)"[^>]*type="application\/rss\+xml"/gi,
      /type="application\/rss\+xml"[^>]*href="([^"]+)"/gi,
      /href="([^"]+)"[^>]*type="application\/atom\+xml"/gi,
      /type="application\/atom\+xml"[^>]*href="([^"]+)"/gi,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(html);
      if (match?.[1]) {
        let feedUrl = match[1];
        // Handle relative URLs
        if (feedUrl.startsWith('/')) {
          const base = new URL(url);
          feedUrl = base.origin + feedUrl;
        }
        return feedUrl;
      }
    }

    // Common fallback paths
    const base = url.replace(/\/$/, '');
    const fallbacks = ['/feed', '/rss', '/feed.xml', '/rss.xml', '/atom.xml'];
    for (const path of fallbacks) {
      try {
        const testUrl = base + path;
        await parser.parseURL(testUrl); // Throws if not valid RSS
        return testUrl;
      } catch { /* not a valid feed, try next */ }
    }

    return null;
  } catch {
    return null;
  }
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { validateFeed, fetchArticles, discoverFeed };
