#!/usr/bin/env node
/**
 * Download SKILL.md files directly from GitHub
 *
 * Skills on skills.sh are stored in GitHub repos.
 * This script fetches the raw SKILL.md from GitHub for each skill.
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

const DOCS_DIR = path.join(__dirname, 'documentation');
const BATCH_SIZE = 5;
const DELAY_MS = 500;

// List of skills with their GitHub paths
// Format: { id, owner, repo, path }
const KNOWN_SKILLS = [
  // Vercel Labs
  { id: 'find-skills', owner: 'vercel-labs', repo: 'skills', path: 'find-skills' },
  { id: 'vercel-react-best-practices', owner: 'vercel-labs', repo: 'agent-skills', path: 'vercel-react-best-practices' },
  { id: 'web-design-guidelines', owner: 'vercel-labs', repo: 'agent-skills', path: 'web-design-guidelines' },
  { id: 'vercel-composition-patterns', owner: 'vercel-labs', repo: 'agent-skills', path: 'vercel-composition-patterns' },
  { id: 'vercel-react-native-skills', owner: 'vercel-labs', repo: 'agent-skills', path: 'vercel-react-native-skills' },
  { id: 'next-best-practices', owner: 'vercel-labs', repo: 'next-skills', path: 'next-best-practices' },

  // Anthropic
  { id: 'frontend-design', owner: 'anthropics', repo: 'skills', path: 'frontend-design' },
  { id: 'skill-creator', owner: 'anthropics', repo: 'skills', path: 'skill-creator' },
  { id: 'pdf', owner: 'anthropics', repo: 'skills', path: 'pdf' },
  { id: 'pptx', owner: 'anthropics', repo: 'skills', path: 'pptx' },
  { id: 'docx', owner: 'anthropics', repo: 'skills', path: 'docx' },
  { id: 'xlsx', owner: 'anthropics', repo: 'skills', path: 'xlsx' },
  { id: 'webapp-testing', owner: 'anthropics', repo: 'skills', path: 'webapp-testing' },
  { id: 'mcp-builder', owner: 'anthropics', repo: 'skills', path: 'mcp-builder' },
  { id: 'canvas-design', owner: 'anthropics', repo: 'skills', path: 'canvas-design' },

  // Obra (Superpowers)
  { id: 'brainstorming', owner: 'obra', repo: 'superpowers', path: 'brainstorming' },
  { id: 'systematic-debugging', owner: 'obra', repo: 'superpowers', path: 'systematic-debugging' },
  { id: 'writing-plans', owner: 'obra', repo: 'superpowers', path: 'writing-plans' },
  { id: 'test-driven-development', owner: 'obra', repo: 'superpowers', path: 'test-driven-development' },
  { id: 'executing-plans', owner: 'obra', repo: 'superpowers', path: 'executing-plans' },
  { id: 'requesting-code-review', owner: 'obra', repo: 'superpowers', path: 'requesting-code-review' },
  { id: 'receiving-code-review', owner: 'obra', repo: 'superpowers', path: 'receiving-code-review' },
  { id: 'using-superpowers', owner: 'obra', repo: 'superpowers', path: 'using-superpowers' },
  { id: 'verification-before-completion', owner: 'obra', repo: 'superpowers', path: 'verification-before-completion' },
  { id: 'using-git-worktrees', owner: 'obra', repo: 'superpowers', path: 'using-git-worktrees' },
  { id: 'writing-skills', owner: 'obra', repo: 'superpowers', path: 'writing-skills' },
  { id: 'dispatching-parallel-agents', owner: 'obra', repo: 'superpowers', path: 'dispatching-parallel-agents' },
  { id: 'finishing-a-development-branch', owner: 'obra', repo: 'superpowers', path: 'finishing-a-development-branch' },
  { id: 'subagent-driven-development', owner: 'obra', repo: 'superpowers', path: 'subagent-driven-development' },

  // Marketing skills
  { id: 'copywriting', owner: 'coreyhaines31', repo: 'marketingskills', path: 'copywriting' },
  { id: 'seo-audit', owner: 'coreyhaines31', repo: 'marketingskills', path: 'seo-audit' },
  { id: 'marketing-psychology', owner: 'coreyhaines31', repo: 'marketingskills', path: 'marketing-psychology' },
  { id: 'programmatic-seo', owner: 'coreyhaines31', repo: 'marketingskills', path: 'programmatic-seo' },
  { id: 'marketing-ideas', owner: 'coreyhaines31', repo: 'marketingskills', path: 'marketing-ideas' },
  { id: 'social-content', owner: 'coreyhaines31', repo: 'marketingskills', path: 'social-content' },
  { id: 'pricing-strategy', owner: 'coreyhaines31', repo: 'marketingskills', path: 'pricing-strategy' },

  // Other popular skills
  { id: 'remotion-best-practices', owner: 'remotion-dev', repo: 'skills', path: 'remotion-best-practices' },
  { id: 'agent-browser', owner: 'vercel-labs', repo: 'agent-browser', path: 'agent-browser' },
  { id: 'browser-use', owner: 'browser-use', repo: 'browser-use', path: 'browser-use' },
  { id: 'audit-website', owner: 'squirrelscan', repo: 'skills', path: 'audit-website' },
  { id: 'supabase-postgres-best-practices', owner: 'supabase', repo: 'agent-skills', path: 'supabase-postgres-best-practices' },
  { id: 'better-auth-best-practices', owner: 'better-auth', repo: 'skills', path: 'better-auth-best-practices' },
  { id: 'ui-ux-pro-max', owner: 'nextlevelbuilder', repo: 'ui-ux-pro-max-skill', path: 'ui-ux-pro-max' },
  { id: 'vue-best-practices', owner: 'inf-sh', repo: 'skills', path: 'vue-best-practices' },
  { id: 'tailwind-design-system', owner: 'inf-sh', repo: 'skills', path: 'tailwind-design-system' },
  { id: 'agent-tools', owner: 'inf-sh', repo: 'skills', path: 'agent-tools' },
  { id: 'building-native-ui', owner: 'expo', repo: 'skills', path: 'building-native-ui' },
  { id: 'react-native-best-practices', owner: 'expo', repo: 'skills', path: 'react-native-best-practices' },
];

// Fetch from GitHub raw URL
async function fetchGitHubRaw(owner, repo, path) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}/SKILL.md`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 404) {
        // Try 'master' branch
        const masterUrl = `https://raw.githubusercontent.com/${owner}/${repo}/master/${path}/SKILL.md`;
        return https.get(masterUrl, (res2) => {
          if (res2.statusCode !== 200) {
            reject(new Error(`HTTP ${res2.statusCode}`));
            return;
          }
          let data = '';
          res2.on('data', chunk => data += chunk);
          res2.on('end', () => resolve(data));
        }).on('error', reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Download skill
async function downloadSkill(skill) {
  try {
    const content = await fetchGitHubRaw(skill.owner, skill.repo, skill.path);
    const filePath = path.join(DOCS_DIR, `${skill.id}.md`);
    await fs.writeFile(filePath, content, 'utf8');
    return { success: true, id: skill.id };
  } catch (error) {
    return { success: false, id: skill.id, error: error.message };
  }
}

// Main download function
async function downloadAll() {
  console.log(`🚀 Downloading ${KNOWN_SKILLS.length} skill documentation files from GitHub...\n`);

  let completed = 0;
  let success = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < KNOWN_SKILLS.length; i += BATCH_SIZE) {
    const batch = KNOWN_SKILLS.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(batch.map(downloadSkill));

    results.forEach((result, idx) => {
      completed++;
      if (result.status === 'fulfilled' && result.value.success) {
        success++;
        console.log(`✅ [${completed}/${KNOWN_SKILLS.length}] ${result.value.id}`);
      } else {
        errors++;
        const errorMsg = result.value?.error || result.reason?.message || 'Failed';
        console.error(`❌ [${completed}/${KNOWN_SKILLS.length}] ${batch[idx].id}: ${errorMsg}`);
      }
    });

    // Progress
    const percent = ((completed / KNOWN_SKILLS.length) * 100).toFixed(1);
    console.log(`📊 Progress: ${percent}% (${success} success, ${errors} errors)\n`);

    // Delay between batches
    if (i + BATCH_SIZE < KNOWN_SKILLS.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n✅ Download complete!');
  console.log(`📊 Total: ${completed}, Success: ${success}, Errors: ${errors}`);
  console.log(`📁 Files saved to: ${DOCS_DIR}`);
}

// Run
downloadAll().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
