// ═══════════════════════════════════════
//  Notion Service — CRUD for R1 app data
// ═══════════════════════════════════════

const { Client } = require('@notionhq/client');
const config = require('../config');

const notion = new Client({ auth: config.NOTION_API_KEY });

// ── Books DB ──

/**
 * Add a book to the Notion Books database.
 * @param {object} book - { title, text, wordCount, chapters, source, discordMsgId }
 * @returns {object} Created page
 */
async function addBook({ title, text, wordCount, chapters = [], source = 'discord', discordMsgId = '' }) {
  // Notion rich text blocks have a 2000 char limit per block.
  // We split the text into chunks and store across multiple blocks.
  const textChunks = splitText(text, 2000);

  const page = await notion.pages.create({
    parent: { database_id: config.NOTION_BOOKS_DB },
    properties: {
      'Title':          { title: [{ text: { content: title } }] },
      'Word Count':     { number: wordCount },
      'Chapters':       { rich_text: [{ text: { content: JSON.stringify(chapters).substring(0, 2000) } }] },
      'Source':         { select: { name: source } },
      'Status':         { select: { name: 'ready' } },
      'Discord MSG ID': { rich_text: [{ text: { content: discordMsgId } }] },
      'Added':          { date: { start: new Date().toISOString() } },
    },
  });

  // Store full text as page content (child blocks)
  // Notion allows up to 100 blocks per append call
  for (let i = 0; i < textChunks.length; i += 100) {
    const batch = textChunks.slice(i, i + 100).map(chunk => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: chunk } }],
      },
    }));

    await notion.blocks.children.append({
      block_id: page.id,
      children: batch,
    });
  }

  return page;
}

/**
 * Get all books from the database (metadata only — not full text).
 */
async function getBooks() {
  const response = await notion.databases.query({
    database_id: config.NOTION_BOOKS_DB,
    filter: {
      property: 'Status',
      select: { equals: 'ready' },
    },
    sorts: [{ property: 'Added', direction: 'descending' }],
  });

  return response.results.map(page => ({
    id: page.id,
    title: page.properties['Title']?.title?.[0]?.plain_text || 'Untitled',
    wordCount: page.properties['Word Count']?.number || 0,
    chapters: safeParseJSON(page.properties['Chapters']?.rich_text?.[0]?.plain_text, []),
    source: page.properties['Source']?.select?.name || 'unknown',
    addedAt: page.properties['Added']?.date?.start || null,
  }));
}

/**
 * Get a book's full text content by reading its child blocks.
 */
async function getBookText(pageId) {
  let text = '';
  let cursor;

  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if (block.type === 'paragraph') {
        const content = block.paragraph.rich_text.map(rt => rt.plain_text).join('');
        text += content;
      }
    }

    cursor = response.has_more ? response.next_cursor : null;
  } while (cursor);

  return text;
}

// ── Feeds DB ──

/**
 * Add an RSS feed to the Notion Feeds database.
 */
async function addFeed({ title, feedUrl, siteUrl = '', category = 'other' }) {
  return notion.pages.create({
    parent: { database_id: config.NOTION_FEEDS_DB },
    properties: {
      'Title':        { title: [{ text: { content: title } }] },
      'URL':          { url: feedUrl },
      'Site URL':     { url: siteUrl || null },
      'Category':     { select: { name: category } },
      'Active':       { checkbox: true },
      'Added':        { date: { start: new Date().toISOString() } },
    },
  });
}

/**
 * Get all active feeds.
 */
async function getFeeds() {
  const response = await notion.databases.query({
    database_id: config.NOTION_FEEDS_DB,
    filter: {
      property: 'Active',
      checkbox: { equals: true },
    },
    sorts: [{ property: 'Added', direction: 'descending' }],
  });

  return response.results.map(page => ({
    id: page.id,
    title: page.properties['Title']?.title?.[0]?.plain_text || 'Untitled',
    feedUrl: page.properties['URL']?.url || '',
    siteUrl: page.properties['Site URL']?.url || '',
    category: page.properties['Category']?.select?.name || 'other',
    addedAt: page.properties['Added']?.date?.start || null,
  }));
}

/**
 * Check if a feed URL already exists in the database.
 */
async function feedExists(feedUrl) {
  const response = await notion.databases.query({
    database_id: config.NOTION_FEEDS_DB,
    filter: {
      property: 'URL',
      url: { equals: feedUrl },
    },
  });
  return response.results.length > 0;
}

// ── Helpers ──

function splitText(text, maxLen) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLen) {
    chunks.push(text.substring(i, i + maxLen));
  }
  return chunks;
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = {
  addBook,
  getBooks,
  getBookText,
  addFeed,
  getFeeds,
  feedExists,
};
