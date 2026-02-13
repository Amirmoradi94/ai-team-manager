# Agent Skills Documentation

This directory contains a comprehensive pool of agent skills and their documentation.

## Structure

```
skills/
├── pool.json                    # Metadata for 590 skills (id, label, category, description)
├── documentation/               # Documentation for 98 skills (markdown files)
│   ├── find-skills.md
│   ├── vercel-react-best-practices.md
│   ├── frontend-design.md
│   └── ... (98 files)
├── download-docs.js            # Script to download from skills.sh
├── download-from-github.js     # Script to download from GitHub (experimental)
├── clean-html.js               # Script to clean HTML from downloaded files
└── README.md                   # This file
```

## Skills Pool

**pool.json** contains metadata for **590 skills** from skills.sh registry:

- **ID**: Unique identifier (e.g., "find-skills")
- **Label**: Display name (e.g., "Find Skills")
- **Category**: Technical, Creative, Strategic, Operational, or AI & Agents
- **Description**: Brief description of the skill

### Categories

- **Technical** (~200 skills): React, TypeScript, Node.js, Python, databases, DevOps, etc.
- **Creative** (~150 skills): UI/UX design, graphic design, copywriting, video editing
- **Strategic** (~100 skills): Product strategy, market research, SEO, growth hacking
- **Operational** (~100 skills): Project management, customer success, data analysis
- **AI & Agents** (~40 skills): Agent skills, brainstorming, debugging, testing

## Documentation Files

We have downloaded **98 skill documentation files** from skills.sh, including:

### AI & Agent Skills
- find-skills.md
- agent-browser.md
- skill-creator.md
- brainstorming.md
- systematic-debugging.md
- writing-plans.md
- test-driven-development.md
- executing-plans.md
- subagent-driven-development.md
- dispatching-parallel-agents.md

### Technical Skills
- vercel-react-best-practices.md
- web-design-guidelines.md
- vercel-composition-patterns.md
- next-best-practices.md
- vue-best-practices.md
- react-native-best-practices.md
- tailwind-design-system.md
- typescript-advanced-types.md
- supabase-postgres-best-practices.md
- better-auth-best-practices.md

### Design & Creative
- frontend-design.md
- canvas-design.md
- ui-ux-pro-max.md
- web-design-guidelines.md
- shadcn-ui.md
- design-md.md

### Productivity & Development
- pdf.md, pptx.md, docx.md, xlsx.md
- mcp-builder.md
- webapp-testing.md
- using-git-worktrees.md
- finishing-a-development-branch.md
- verification-before-completion.md

### Marketing & Growth
- seo-audit.md
- copywriting.md
- marketing-psychology.md
- programmatic-seo.md
- social-content.md
- pricing-strategy.md
- paid-ads.md
- email-sequence.md

### And 40+ more...

## Usage

### In Agent-Runner Code

```javascript
const skillsPool = require('./skills/pool.json');

// Get all skills in a category
const technicalSkills = skillsPool.filter(s => s.category === 'Technical');

// Find a specific skill
const skill = skillsPool.find(s => s.id === 'find-skills');

// Read documentation
const fs = require('fs');
const doc = fs.readFileSync(`./skills/documentation/${skill.id}.md`, 'utf8');
```

### For CTO Intelligence

The CTO can reference skill documentation when:
- Assigning tasks to agents
- Recommending skills for team members
- Understanding available capabilities

### For OpenAI Skill Analysis

The skills pool is used by the OpenAI-based skill suggestion system in task-manager to automatically recommend relevant skills when hiring employees.

## Downloading More Skills

### Method 1: From skills.sh Homepage (Current)
```bash
node download-docs.js
```
- Scrapes skills.sh homepage
- Downloads ~200 skill pages
- Extracts content from HTML
- Auto-cleans HTML to readable text

### Method 2: From GitHub (Experimental)
```bash
node download-from-github.js
```
- Fetches SKILL.md directly from GitHub repos
- Cleaner markdown format
- Limited to skills with known GitHub paths
- Many skills return 404 (not publicly accessible)

### Cleaning Downloaded Files
```bash
node clean-html.js
```
- Removes HTML tags from downloaded files
- Converts to readable plain text
- Preserves code blocks and structure

## Expanding the Collection

To add more skill documentation:

1. **Find the skill on skills.sh**: https://skills.sh/
2. **Download manually** or add to download scripts
3. **Save as** `documentation/{skill-id}.md`
4. **Update** `pool.json` if needed

## Notes

- Skills from skills.sh are community-contributed
- Not all skills have public documentation
- Documentation quality varies
- Some skills may require installation to access full docs
- Skills are organized by the skills.sh community

## Links

- **Skills.sh**: https://skills.sh/
- **Skills CLI**: `npx skills`
- **Documentation**: https://skills.sh/docs

---

**Last Updated**: 2026-02-12
**Skills in Pool**: 590
**Documentation Files**: 98
