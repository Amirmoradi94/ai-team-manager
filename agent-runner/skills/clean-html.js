#!/usr/bin/env node
/**
 * Clean HTML from downloaded skill files
 * Converts HTML fragments to readable plain text
 */

const fs = require('fs').promises;
const path = require('path');

const DOCS_DIR = path.join(__dirname, 'documentation');

// Simple HTML to text converter
function htmlToText(html) {
  return html
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    // Remove HTML tags but keep content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|h[1-6]|ul|ol|li|pre|code)[^>]*>/gi, '\n')
    .replace(/<span[^>]*class="[^"]*token[^"]*"[^>]*>/gi, '') // Remove syntax highlighting spans
    .replace(/<span[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<[^>]+>/g, '') // Remove any remaining tags
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .trim();
}

async function cleanFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');

    // Check if file contains HTML
    if (content.includes('<') && content.includes('>')) {
      const cleaned = htmlToText(content);

      // Only update if we actually cleaned something meaningful
      if (cleaned.length > 20 && cleaned !== content) {
        await fs.writeFile(filePath, cleaned, 'utf8');
        return { success: true, file: path.basename(filePath) };
      }
    }

    return { success: false, file: path.basename(filePath), reason: 'No changes needed' };
  } catch (error) {
    return { success: false, file: path.basename(filePath), error: error.message };
  }
}

async function cleanAll() {
  console.log('🧹 Cleaning HTML from skill documentation files...\n');

  const files = await fs.readdir(DOCS_DIR);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  console.log(`📁 Found ${mdFiles.length} markdown files\n`);

  let cleaned = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of mdFiles) {
    const filePath = path.join(DOCS_DIR, file);
    const result = await cleanFile(filePath);

    if (result.success) {
      cleaned++;
      console.log(`✅ Cleaned: ${result.file}`);
    } else if (result.error) {
      errors++;
      console.error(`❌ Error: ${result.file}: ${result.error}`);
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Cleaning complete!`);
  console.log(`📊 Cleaned: ${cleaned}, Skipped: ${skipped}, Errors: ${errors}`);
}

cleanAll().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
