const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function updateDBs() {
  try {
    console.log('Fetching Books DB...');
    const booksDb = await notion.databases.retrieve({ database_id: process.env.NOTION_BOOKS_DB });
    
    // Find Title property for Books
    let booksTitleProp = null;
    for (const [key, value] of Object.entries(booksDb.properties)) {
      if (value.type === 'title') booksTitleProp = key;
    }

    const booksProps = {
      'Word Count': { number: { format: 'number' } },
      'Chapters': { rich_text: {} },
      'Source': { select: { options: [{ name: 'discord', color: 'blue' }] } },
      'Status': { select: { options: [{ name: 'ready', color: 'green' }] } },
      'Discord MSG ID': { rich_text: {} },
      'Added': { date: {} }
    };
    
    if (booksTitleProp && booksTitleProp !== 'Title') {
      booksProps[booksTitleProp] = { name: 'Title' };
    }

    console.log('Updating Books DB properties...');
    await notion.databases.update({
      database_id: process.env.NOTION_BOOKS_DB,
      properties: booksProps
    });
    console.log('✅ Books DB updated!');

    // FEEDS DB
    console.log('\nFetching Feeds DB...');
    const feedsDb = await notion.databases.retrieve({ database_id: process.env.NOTION_FEEDS_DB });
    
    let feedsTitleProp = null;
    for (const [key, value] of Object.entries(feedsDb.properties)) {
      if (value.type === 'title') feedsTitleProp = key;
    }

    const feedsProps = {
      'URL': { url: {} },
      'Site URL': { url: {} },
      // Update Category to ensure it's a select property
      'Category': { select: { options: [{ name: 'other', color: 'default' }] } },
      'Active': { checkbox: {} },
      'Added': { date: {} }
    };

    if (feedsTitleProp && feedsTitleProp !== 'Title') {
      feedsProps[feedsTitleProp] = { name: 'Title' };
    }

    console.log('Updating Feeds DB properties...');
    await notion.databases.update({
      database_id: process.env.NOTION_FEEDS_DB,
      properties: feedsProps
    });
    console.log('✅ Feeds DB updated!');

  } catch (err) {
    console.error('❌ Error updating databases:', err.message);
  }
}

updateDBs();
