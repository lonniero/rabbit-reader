// ═══════════════════════════════════════
//  PDF Parser Service
// ═══════════════════════════════════════

const pdf = require('pdf-parse');

/**
 * Extract text from a PDF buffer.
 * @param {Buffer} buffer - Raw PDF file buffer
 * @returns {object} { text, wordCount, chapters }
 */
async function parsePDF(buffer) {
  const data = await pdf(buffer);
  const text = cleanText(data.text);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const chapters = detectChapters(text);

  return { text, wordCount, chapters };
}

/**
 * Strip non-printable characters and normalize whitespace.
 */
function cleanText(txt) {
  return txt
    .replace(/[^\x20-\x7E\u00A0-\u024F\u2000-\u206F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect chapter markers in the text.
 */
function detectChapters(text) {
  const words = text.split(/\s+/);
  const chapters = [];
  const chPat = /^(chapter|part|book|section|prologue|epilogue|introduction|preface|foreword|afterword)$/i;

  for (let i = 0; i < words.length - 1; i++) {
    if (chPat.test(words[i])) {
      const next = words[i + 1];
      if (/^[\dIVXLCDM]+:?$/i.test(next) || /^(one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(next)) {
        const title = words[i] + ' ' + next.replace(/:$/, '');
        if (chapters.length === 0 || i - chapters[chapters.length - 1].wordIndex > 50) {
          chapters.push({ title, wordIndex: i });
        }
      }
    }
  }

  return chapters;
}

module.exports = { parsePDF };
