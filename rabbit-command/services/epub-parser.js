// ═══════════════════════════════════════
//  EPUB Parser Service
// ═══════════════════════════════════════

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const { EPub } = require('epub2');
const { convert } = require('html-to-text');

/**
 * Extract text from an EPUB buffer.
 * @param {Buffer} buffer - Raw EPUB file buffer
 * @returns {object} { text, wordCount, chapters }
 */
async function parseEPUB(buffer) {
  const tmpFilePath = path.join(os.tmpdir(), `${randomUUID()}.epub`);
  
  try {
    // epub2 requires a file path, so write buffer to a temp file
    await fs.writeFile(tmpFilePath, buffer);
    
    // Parse the EPUB
    const epub = await EPub.createAsync(tmpFilePath);
    
    let fullText = '';
    const chapters = [];
    let currentWordIndex = 0;
    
    // epub.flow contains the reading order / chapters
    for (const chapterRef of epub.flow) {
      if (!chapterRef.id) continue;
      
      try {
        const html = await epub.getChapterAsync(chapterRef.id);
        if (!html) continue;
        
        // Convert HTML to clean plain text
        const plainText = convert(html, {
          wordwrap: false,
          preserveNewlines: true,
          selectors: [
            { selector: 'a', options: { ignoreHref: true } },
            { selector: 'img', format: 'skip' }
          ]
        });
        
        const cleanTxt = cleanText(plainText);
        if (cleanTxt.length === 0) continue;
        
        // Extract a title from the EPUB TOC, or fallback to something generic
        const title = chapterRef.title || 'Chapter';
        
        chapters.push({
          title,
          wordIndex: currentWordIndex
        });
        
        fullText += cleanTxt + ' \n\n';
        
        // Count words added by this chapter
        const addedWords = cleanTxt.split(/\s+/).filter(Boolean).length;
        currentWordIndex += addedWords;
        
      } catch (err) {
        console.error(`[epub] Failed to read chapter ${chapterRef.id}:`, err.message);
      }
    }
    
    const wordCount = currentWordIndex;
    
    return { text: fullText.trim(), wordCount, chapters };
    
  } finally {
    // Always clean up the temp file
    try {
      await fs.unlink(tmpFilePath);
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Strip non-printable characters and normalize whitespace.
 */
function cleanText(txt) {
  return txt
    .replace(/[^\x20-\x7E\u00A0-\u024F\u2000-\u206F\n]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

module.exports = { parseEPUB };
