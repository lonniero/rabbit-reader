// ═══════════════════════════════════════
//  Handler: #rss-feeds channel
//  Watches for URLs, auto-discovers RSS
//  feeds, validates, and saves to Notion.
// ═══════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { validateFeed, discoverFeed } = require('../services/rss-validator');
const { addFeed, feedExists } = require('../services/notion');

// URL regex to detect links in messages
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

/**
 * Handle a message in the #rss-feeds channel.
 */
async function handleRSSMessage(message) {
  const content = message.content.trim();
  if (!content) return;

  // Extract URLs from the message
  const urls = content.match(URL_REGEX);
  if (!urls || urls.length === 0) {
    await message.react('🤔');
    await message.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xFFAA00)
        .setDescription('💡 Drop a website URL or direct RSS feed link here to add it to your reader.')
      ],
    });
    return;
  }

  for (const rawUrl of urls) {
    await message.react('⏳');

    try {
      let feedInfo;
      let feedUrl = rawUrl;

      // First, try to parse the URL directly as an RSS feed
      try {
        feedInfo = await validateFeed(rawUrl);
        feedUrl = rawUrl;
      } catch {
        // Not a direct RSS feed — try to discover one from the website
        const discovered = await discoverFeed(rawUrl);
        if (!discovered) {
          await message.reactions.cache.get('⏳')?.remove();
          await message.react('⚠️');
          await message.reply({
            embeds: [new EmbedBuilder()
              .setColor(0xFF4444)
              .setTitle('⚠️ No RSS Feed Found')
              .setDescription(`Could not find an RSS feed at **${rawUrl}**.\n\nTry pasting the direct RSS/Atom feed URL instead.`)
            ],
          });
          continue;
        }
        feedUrl = discovered;
        feedInfo = await validateFeed(discovered);
      }

      // Check for duplicates
      if (await feedExists(feedUrl)) {
        await message.reactions.cache.get('⏳')?.remove();
        await message.react('🔄');
        await message.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xFFAA00)
            .setTitle('🔄 Already Subscribed')
            .setDescription(`**${feedInfo.title}** is already in your feed list.`)
          ],
        });
        continue;
      }

      // Detect category from URL
      const category = detectCategory(feedUrl, feedInfo.title);

      // Save to Notion
      await addFeed({
        title: feedInfo.title,
        feedUrl: feedUrl,
        siteUrl: feedInfo.siteUrl,
        category,
      });

      // Success
      await message.reactions.cache.get('⏳')?.remove();
      await message.react('📰');

      const embed = new EmbedBuilder()
        .setColor(0x00CC88)
        .setTitle('📰 Feed Added')
        .setDescription(`**${feedInfo.title}** is now in your RSS reader!`)
        .addFields(
          { name: 'Feed URL', value: feedUrl, inline: false },
          { name: 'Articles', value: `${feedInfo.itemCount} available`, inline: true },
          { name: 'Category', value: category, inline: true },
        )
        .setFooter({ text: 'Open Rabbit RSS on your R1 to read' })
        .setTimestamp();

      if (feedInfo.siteUrl) {
        embed.setURL(feedInfo.siteUrl);
      }

      await message.reply({ embeds: [embed] });

    } catch (err) {
      console.error(`[rss] Error processing ${rawUrl}:`, err);
      await message.reactions.cache.get('⏳')?.remove();
      await message.react('❌');
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle('❌ Feed Error')
          .setDescription(`Could not process **${rawUrl}**:\n\`${err.message}\``)
        ],
      });
    }
  }
}

/**
 * Simple category detection based on URL/title keywords.
 */
function detectCategory(url, title) {
  const combined = (url + ' ' + title).toLowerCase();

  if (/tech|hacker|verge|ars|wired|dev|github|code|programming/.test(combined)) return 'tech';
  if (/news|times|post|bbc|cnn|reuters|ap\b/.test(combined)) return 'news';
  if (/design|dribbble|behance|ux|ui|creative/.test(combined)) return 'design';
  if (/music|spotify|sound|audio|band/.test(combined)) return 'music';
  if (/finance|market|stock|crypto|invest|money/.test(combined)) return 'finance';
  if (/sport|espn|athletic|football|basketball/.test(combined)) return 'sports';

  return 'other';
}

module.exports = { handleRSSMessage };
