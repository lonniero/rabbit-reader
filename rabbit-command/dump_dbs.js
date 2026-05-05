const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function run() {
  try {
    const booksDb = await notion.databases.retrieve({ database_id: process.env.NOTION_BOOKS_DB });
    console.log("Books DB Properties:", Object.keys(booksDb.properties));
    
    const feedsDb = await notion.databases.retrieve({ database_id: process.env.NOTION_FEEDS_DB });
    console.log("Feeds DB Properties:", Object.keys(feedsDb.properties));
  } catch (err) {
    console.error(err.message);
  }
}
run();
