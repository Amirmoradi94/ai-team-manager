#!/usr/bin/env node
/**
 * Download all SKILL.md files from skills.sh
 *
 * This script:
 * 1. Fetches the skills.sh homepage to get all skill URLs
 * 2. For each skill, downloads the SKILL.md documentation
 * 3. Saves to skills/documentation/{skill-id}.md
 */

const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

const SKILLS_SH_URL = 'https://skills.sh/';
const DOCS_DIR = path.join(__dirname, 'documentation');
const BATCH_SIZE = 10; // Download in batches to avoid rate limiting
const DELAY_MS = 1000; // Delay between batches

// Fetch URL content
async function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
      });
    }).on('error', reject);
  });
}

// Extract skills from homepage
async function getAllSkills() {
  console.log('📥 Fetching skills list from skills.sh...');
  const html = await fetchURL(SKILLS_SH_URL);

  // Parse skill URLs from HTML
  // Format: /vercel-labs/skills/find-skills
  const skillUrlRegex = /href="(\/[^"]+\/[^"]+\/[^"]+)"/g;
  const matches = [...html.matchAll(skillUrlRegex)];

  const skills = matches
    .map(m => m[1])
    .filter(url => {
      // Filter to only skill detail pages (have 3 parts after /)
      const parts = url.split('/').filter(p => p);
      return parts.length === 3;
    })
    .filter((url, index, self) => self.indexOf(url) === index); // Unique

  console.log(`✅ Found ${skills.length} unique skills`);
  return skills;
}

// Extract SKILL.md content from skill page
async function getSkillDoc(skillUrl) {
  const fullUrl = `https://skills.sh${skillUrl}`;
  try {
    const html = await fetchURL(fullUrl);

    // Extract the SKILL.md content from the page
    // The content is typically in a markdown section or pre tag
    // We'll look for common patterns

    // Method 1: Try to find markdown content in code blocks
    const codeBlockMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (codeBlockMatch) {
      // Decode HTML entities
      let content = codeBlockMatch[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'");
      return content;
    }

    // Method 2: Try to find in article or main content
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      // Strip HTML tags but keep structure
      let content = articleMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(p|div|h[1-6]|ul|ol|li)[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      return content;
    }

    // If we can't parse it, return a placeholder
    return `# ${skillUrl}\n\nDocumentation available at: https://skills.sh${skillUrl}\n\n*Content could not be automatically extracted. Please visit the URL above.*`;

  } catch (error) {
    console.error(`❌ Error fetching ${skillUrl}:`, error.message);
    return `# ${skillUrl}\n\nError: ${error.message}\n\nVisit: https://skills.sh${skillUrl}`;
  }
}

// Save skill documentation
async function saveSkillDoc(skillUrl, content) {
  // Extract skill ID from URL (last part)
  const skillId = skillUrl.split('/').pop();
  const filePath = path.join(DOCS_DIR, `${skillId}.md`);
  await fs.writeFile(filePath, content, 'utf8');
  return skillId;
}

// Download all skills in batches
async function downloadAll() {
  console.log('🚀 Starting skill documentation download...\n');

  const skills = await getAllSkills();
  const total = skills.length;
  let completed = 0;
  let errors = 0;

  console.log(`📚 Downloading ${total} skill documentation files...`);
  console.log(`⚡ Batch size: ${BATCH_SIZE}, Delay: ${DELAY_MS}ms\n`);

  // Process in batches
  for (let i = 0; i < skills.length; i += BATCH_SIZE) {
    const batch = skills.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (skillUrl) => {
        const content = await getSkillDoc(skillUrl);
        const skillId = await saveSkillDoc(skillUrl, content);
        return skillId;
      })
    );

    // Count results
    results.forEach((result, idx) => {
      completed++;
      if (result.status === 'fulfilled') {
        console.log(`✅ [${completed}/${total}] ${result.value}`);
      } else {
        errors++;
        console.error(`❌ [${completed}/${total}] ${batch[idx]}: ${result.reason?.message || 'Failed'}`);
      }
    });

    // Progress update
    const percent = ((completed / total) * 100).toFixed(1);
    console.log(`📊 Progress: ${percent}% (${completed}/${total}, ${errors} errors)\n`);

    // Delay between batches (except for last batch)
    if (i + BATCH_SIZE < skills.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n✅ Download complete!');
  console.log(`📁 Files saved to: ${DOCS_DIR}`);
  console.log(`📊 Total: ${completed}, Success: ${completed - errors}, Errors: ${errors}`);
}

// Run
downloadAll().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
