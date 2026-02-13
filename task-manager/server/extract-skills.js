const fs = require('fs');
const path = require('path');

// Read the TypeScript file
const skillsContent = fs.readFileSync(path.join(__dirname, '../src/data/skills.ts'), 'utf8');

// Extract skill objects using regex
const skillMatches = skillsContent.matchAll(/{[^}]*"id":\s*"([^"]+)"[^}]*"label":\s*"([^"]+)"[^}]*"category":\s*"([^"]+)"[^}]*"description":\s*"([^"]+)"[^}]*}/g);

const skills = [];
for (const match of skillMatches) {
  skills.push({
    id: match[1],
    label: match[2],
    category: match[3],
    description: match[4]
  });
}

// Save to JSON file
fs.writeFileSync(
  path.join(__dirname, 'skills-pool.json'),
  JSON.stringify(skills, null, 2)
);

console.log(`✅ Extracted ${skills.length} skills to skills-pool.json`);
