// ═══════════════════════════════════════
//  Handler: #rabbit-reader channel
//  Watches for PDF/EPUB file attachments,
//  parses them, and saves to Notion.
// ═══════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { parsePDF } = require('../services/pdf-parser');
const { addBook } = require('../services/notion');

const SUPPORTED_EXTENSIONS = ['.pdf']; // EPUB support can be added later

/**
 * Handle a message in the #rabbit-reader channel.
 */
async function handleReaderMessage(message) {
  // Only process messages with file attachments
  const attachments = message.attachments.filter(att => {
    const name = att.name?.toLowerCase() || '';
    return SUPPORTED_EXTENSIONS.some(ext => name.endsWith(ext));
  });

  if (attachments.size === 0) {
    // If they sent a message without a file, acknowledge
    if (message.content.trim()) {
      await message.react('👀');
    }
    return;
  }

  for (const [, attachment] of attachments) {
    const fileName = attachment.name || 'unknown.pdf';
    const title = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

    // React to show we're processing
    await message.react('⏳');

    try {
      // Download the file
      const response = await fetch(attachment.url);
      if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Parse PDF
      const { text, wordCount, chapters } = await parsePDF(buffer);

      if (!text || wordCount < 50) {
        await message.react('⚠️');
        await message.reply({
          embeds: [new EmbedBuilder()
            .setColor(0xFF4444)
            .setTitle('⚠️ Could not extract text')
            .setDescription(`**${title}** — The PDF might be image-based or too short (${wordCount} words).`)
            .setFooter({ text: 'Try a text-based PDF' })
          ],
        });
        return;
      }

      // Save to Notion
      const page = await addBook({
        title,
        text,
        wordCount,
        chapters,
        source: 'discord',
        discordMsgId: message.id,
      });

      // Remove processing reaction, add success
      await message.reactions.cache.get('⏳')?.remove();
      await message.react('📚');

      // Send rich confirmation
      const readTime = Math.ceil(wordCount / 300);
      const embed = new EmbedBuilder()
        .setColor(0x00CC88)
        .setTitle('📚 Book Added to Library')
        .setDescription(`**${title}** is now available on your R1!`)
        .addFields(
          { name: 'Words', value: wordCount.toLocaleString(), inline: true },
          { name: 'Read Time', value: `~${readTime} min`, inline: true },
          { name: 'Chapters', value: `${chapters.length} found`, inline: true },
        )
        .setFooter({ text: 'Open Rabbit Reader on your R1 to start reading' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

    } catch (err) {
      console.error(`[reader] Error processing ${fileName}:`, err);
      await message.reactions.cache.get('⏳')?.remove();
      await message.react('❌');
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle('❌ Processing Failed')
          .setDescription(`Could not process **${title}**:\n\`${err.message}\``)
        ],
      });
    }
  }
}

module.exports = { handleReaderMessage };
