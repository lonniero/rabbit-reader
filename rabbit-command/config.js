// ═══════════════════════════════════════
//  Rabbit Command — Configuration
// ═══════════════════════════════════════

require('dotenv').config();

module.exports = {
  // Discord
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID:  process.env.DISCORD_GUILD_ID,

  // Channel IDs
  CHANNELS: {
    READER: process.env.CHANNEL_READER,
    RSS:    process.env.CHANNEL_RSS,
    LOGS:   process.env.CHANNEL_LOGS,
  },

  // Notion
  NOTION_API_KEY:  process.env.NOTION_API_KEY,
  NOTION_BOOKS_DB: process.env.NOTION_BOOKS_DB,
  NOTION_FEEDS_DB: process.env.NOTION_FEEDS_DB,

  // Server
  PORT: process.env.PORT || 3000,
};
