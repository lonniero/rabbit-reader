// ═══════════════════════════════════════
//  🐰 Rabbit Command — Main Bot
//  Discord command center for R1 apps
// ═══════════════════════════════════════

const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express');
const cors = require('cors');
const config = require('./config');

// Handlers
const { handleReaderMessage } = require('./handlers/reader');
const { handleRSSMessage } = require('./handlers/rss');

// Services (for API proxy)
const { getBooks, getBookText, getFeeds } = require('./services/notion');
const { fetchArticles } = require('./services/rss-validator');
const { scrapeArticle } = require('./services/article-scraper');

// ══════════════════════════════════════
//  DISCORD BOT
// ══════════════════════════════════════

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`🐰 Rabbit Command online as ${c.user.tag}`);
  console.log(`   Watching channels:`);
  console.log(`   📚 Reader:  ${config.CHANNELS.READER || '(not set)'}`);
  console.log(`   📰 RSS:     ${config.CHANNELS.RSS || '(not set)'}`);
  console.log(`   🔧 Logs:    ${config.CHANNELS.LOGS || '(not set)'}`);
  console.log();

  // Send startup log
  sendLog('🐰 Rabbit Command is online and watching.');
});

client.on(Events.MessageCreate, async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  const channelId = message.channelId;

  try {
    // Route to the correct handler based on channel
    if (channelId === config.CHANNELS.READER) {
      await handleReaderMessage(message);
    } else if (channelId === config.CHANNELS.RSS) {
      await handleRSSMessage(message);
    }
    // Other channels are silently ignored
  } catch (err) {
    console.error('[bot] Unhandled error:', err);
    sendLog(`❌ Error in <#${channelId}>: \`${err.message}\``);
  }
});

/**
 * Send a message to the #bot-logs channel.
 */
function sendLog(text) {
  if (!config.CHANNELS.LOGS) return;
  try {
    const channel = client.channels.cache.get(config.CHANNELS.LOGS);
    if (channel) channel.send(text);
  } catch (err) {
    console.error('[log] Could not send to logs channel:', err.message);
  }
}

// ══════════════════════════════════════
//  EXPRESS API PROXY
//  R1 frontends call these endpoints
//  to read data from Notion.
// ══════════════════════════════════════

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({
    name: 'Rabbit Command API',
    status: 'online',
    version: '1.0.0',
  });
});

// ── Books API ──

// GET /api/books — list all books (metadata only)
app.get('/api/books', async (req, res) => {
  try {
    const books = await getBooks();
    res.json(books);
  } catch (err) {
    console.error('[api] GET /api/books error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/books/:id/text — get full text for a specific book
app.get('/api/books/:id/text', async (req, res) => {
  try {
    const text = await getBookText(req.params.id);
    if (!text) return res.status(404).json({ error: 'Book not found' });
    res.json({ text });
  } catch (err) {
    console.error(`[api] GET /api/books/${req.params.id}/text error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ── Feeds API ──

// GET /api/feeds — list all active feeds
app.get('/api/feeds', async (req, res) => {
  try {
    const feeds = await getFeeds();
    res.json(feeds);
  } catch (err) {
    console.error('[api] GET /api/feeds error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/feeds/:id/articles — fetch latest articles for a feed
app.get('/api/feeds/:id/articles', async (req, res) => {
  try {
    // Get the feed URL from our feeds list
    const feeds = await getFeeds();
    const feed = feeds.find(f => f.id === req.params.id);
    if (!feed) return res.status(404).json({ error: 'Feed not found' });

    const limit = parseInt(req.query.limit) || 20;
    const articles = await fetchArticles(feed.feedUrl, limit);
    res.json({ feed: feed.title, articles });
  } catch (err) {
    console.error(`[api] GET /api/feeds/${req.params.id}/articles error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ── Timeline API ──

// GET /api/timeline — aggregated articles from all feeds, sorted by date
app.get('/api/timeline', async (req, res) => {
  try {
    const feeds = await getFeeds();
    const limit = parseInt(req.query.limit) || 10; // per feed
    const category = req.query.category || null;

    // Filter by category if specified
    const activeFeeds = category && category !== 'all'
      ? feeds.filter(f => f.category === category)
      : feeds;

    // Fetch articles from all feeds in parallel
    const results = await Promise.allSettled(
      activeFeeds.map(async (feed) => {
        try {
          const articles = await fetchArticles(feed.feedUrl, limit);
          return articles.map(a => ({
            ...a,
            feedId: feed.id,
            feedTitle: feed.title,
            category: feed.category,
          }));
        } catch (err) {
          console.error(`[timeline] Failed to fetch ${feed.title}:`, err.message);
          return [];
        }
      })
    );

    // Merge and sort by date (newest first)
    const allArticles = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });

    // Get unique categories for filter UI
    const categories = [...new Set(feeds.map(f => f.category))];

    res.json({
      articles: allArticles,
      categories,
      feedCount: activeFeeds.length,
    });
  } catch (err) {
    console.error('[api] GET /api/timeline error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/articles/content — scrape full article text from a URL
app.get('/api/articles/content', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'url query parameter required' });

    const article = await scrapeArticle(url);
    res.json(article);
  } catch (err) {
    console.error(`[api] GET /api/articles/content error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════
//  STARTUP
// ══════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  🐰 RABBIT COMMAND');
  console.log('  Discord Bot + API for R1 Mini-Apps');
  console.log('═══════════════════════════════════════');
  console.log();

  // Validate config
  if (!config.DISCORD_BOT_TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN is required');
    process.exit(1);
  }
  if (!config.NOTION_API_KEY) {
    console.error('❌ NOTION_API_KEY is required');
    process.exit(1);
  }

  // Start Express API
  app.listen(config.PORT, () => {
    console.log(`🌐 API proxy running on port ${config.PORT}`);
    console.log(`   GET /api/books             — list books`);
    console.log(`   GET /api/books/:id/text    — get book text`);
    console.log(`   GET /api/feeds             — list feeds`);
    console.log(`   GET /api/feeds/:id/articles — get articles`);
    console.log(`   GET /api/timeline          — aggregated feed`);
    console.log(`   GET /api/articles/content  — scrape article`);
    console.log();
  });

  // Start Discord bot
  await client.login(config.DISCORD_BOT_TOKEN);
}

main().catch((err) => {
  console.error('💀 Fatal error:', err);
  process.exit(1);
});
