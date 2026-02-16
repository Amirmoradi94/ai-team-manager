/**
 * Company Context Manager
 *
 * Manages the repo-local mycompany/ directory structure and keeps it synchronized
 * with the task-manager database. This ensures AI agents always have
 * up-to-date context about the company, projects, teams, and employees.
 */

const fsSync = require('fs');
const fs = require('fs').promises;
const path = require('path');

class CompanyContextManager {
  constructor() {
    this.companyDir = path.resolve(__dirname, '..', 'mycompany');
    this.skillsPoolPath = path.resolve(__dirname, 'skills', 'pool.json');
    this.skillsDocDir = path.resolve(__dirname, 'skills', 'documentation');
    this.skillsRootDir = path.resolve(__dirname, 'skills');
    this.skillsMeta = null;
    this.coreToolDescriptions = {
      file_edit: 'Edits or creates files in the workspace safely.',
      terminal: 'Executes shell commands in the workspace.',
      browser: 'Browses the web and extracts information.',
      npm_install: 'Installs Node.js dependencies for a project.',
      git: 'Performs git operations like status, diff, and commit.'
    };
  }

  /**
   * Initialize the company directory structure
   */
  async initialize() {
    const dirs = [
      this.companyDir,
      path.join(this.companyDir, 'organization'),
      path.join(this.companyDir, 'employees'),
      path.join(this.companyDir, 'teams'),
      path.join(this.companyDir, 'projects'),
      path.join(this.companyDir, 'cto'),
      path.join(this.companyDir, 'cto', 'decisions'),
      path.join(this.companyDir, 'knowledge')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    console.log('[ContextManager] Initialized company directory structure');
  }

  /**
   * Full sync of all entities from database
   */
  async syncAll(db) {
    console.log('[ContextManager] Starting full sync...');

    await this.initialize();

    // Sync all entity types
    await this.syncOrganization(db);
    await this.syncEmployees(db);
    await this.syncTeams(db);
    await this.syncProjects(db);

    console.log('[ContextManager] Full sync completed');
  }

  /**
   * Sync organization overview
   */
  async syncOrganization(db) {
    console.log('[ContextManager] Syncing organization...');

    // Get all employees
    const employees = await db.all('SELECT * FROM specialists ORDER BY name');

    // Get all teams
    const teams = await db.all('SELECT * FROM teams ORDER BY name');

    // Get all projects
    const projects = await db.all('SELECT * FROM projects ORDER BY name');

    // Create OVERVIEW.md
    const overviewPath = path.join(this.companyDir, 'organization', 'OVERVIEW.md');
    const overview = this.generateOrganizationOverview(employees, teams, projects);
    await fs.writeFile(overviewPath, overview, 'utf8');

    // Create EMPLOYEES.md
    const employeesPath = path.join(this.companyDir, 'organization', 'EMPLOYEES.md');
    const employeesList = this.generateEmployeesList(employees);
    await fs.writeFile(employeesPath, employeesList, 'utf8');

    // Create TEAMS.md
    const teamsPath = path.join(this.companyDir, 'organization', 'TEAMS.md');
    const teamsList = this.generateTeamsList(teams);
    await fs.writeFile(teamsPath, teamsList, 'utf8');

    console.log('[ContextManager] Organization synced');
  }

  /**
   * Sync all employee profiles
   */
  async syncEmployees(db) {
    console.log('[ContextManager] Syncing employees...');

    const employees = await db.all('SELECT * FROM specialists ORDER BY name');
    const employeesDir = path.join(this.companyDir, 'employees');
    await this.loadSkillsMetadata();

    // Get valid employee file names
    const validFileNames = new Set(
      employees.map(e => e.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.md')
    );
    validFileNames.add('INDEX.md'); // Keep the index file

    // Remove files for deleted employees
    try {
      const existingFiles = await fs.readdir(employeesDir);

      for (const file of existingFiles) {
        if (file.startsWith('.')) continue;

        if (!validFileNames.has(file)) {
          const fullPath = path.join(employeesDir, file);
          console.log(`[ContextManager] Removing deleted employee file: ${file}`);
          await fs.rm(fullPath, { force: true });
        }
      }
    } catch (e) {
      // Directory might not exist yet
    }

    // Sync current employees
    for (const employee of employees) {
      await this.syncEmployee(db, employee);
    }

    // Create employee index
    const indexPath = path.join(this.companyDir, 'employees', 'INDEX.md');
    const index = this.generateEmployeesIndex(employees);
    await fs.writeFile(indexPath, index, 'utf8');

    console.log(`[ContextManager] Synced ${employees.length} employees`);
  }

  /**
   * Sync a single employee profile
   */
  async syncEmployee(db, employee) {
    const fileName = employee.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.md';
    const filePath = path.join(this.companyDir, 'employees', fileName);

    // Get employee's teams
    const teams = await db.all(`
      SELECT t.* FROM teams t
      INNER JOIN team_specialists ts ON t.id = ts.team_id
      WHERE ts.specialist_id = ?
    `, [employee.id]);

    // Parse tools
    let tools = [];
    try {
      tools = JSON.parse(employee.tools || '[]');
    } catch (e) {
      tools = [];
    }

    await this.ensureSkillDocs(tools);
    const content = this.generateEmployeeProfile(employee, teams, tools);
    await fs.writeFile(filePath, content, 'utf8');
  }

  parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const lines = match[1].split('\n');
    const data = {};
    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      data[key] = value;
    }
    return data;
  }

  collectSkillDocs(rootDir) {
    const results = [];
    if (!fsSync.existsSync(rootDir)) return results;
    const entries = fsSync.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.collectSkillDocs(fullPath));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  async loadSkillsMetadata() {
    if (this.skillsMeta) return;
    try {
      if (fsSync.existsSync(this.skillsPoolPath)) {
        const raw = await fs.readFile(this.skillsPoolPath, 'utf8');
        const skills = JSON.parse(raw);
        this.skillsMeta = new Map(
          skills.map((s) => [s.id, { description: s.description || '', label: s.label || '' }])
        );
        return;
      }
      const docs = this.collectSkillDocs(this.skillsRootDir);
      const meta = new Map();
      for (const docPath of docs) {
        try {
          const content = await fs.readFile(docPath, 'utf8');
          const frontmatter = this.parseFrontmatter(content);
          const dirName = path.basename(path.dirname(docPath));
          const fileName = path.basename(docPath, path.extname(docPath));
          const id = frontmatter.name || (fileName.toLowerCase() === 'skill' ? dirName : fileName);
          const label = frontmatter.title || frontmatter.name || id;
          const description = frontmatter.description || '';
          if (id) meta.set(id, { description, label });
        } catch (err) {
          console.warn(`[ContextManager] Failed to read skill doc ${docPath}: ${err.message}`);
        }
      }
      this.skillsMeta = meta;
    } catch (e) {
      console.warn(`[ContextManager] Failed to load skills metadata: ${e.message}`);
      this.skillsMeta = new Map();
    }
  }

  async ensureSkillDocs(tools) {
    await fs.mkdir(this.skillsDocDir, { recursive: true });
    for (const tool of tools) {
      const docPath = path.join(this.skillsDocDir, `${tool}.md`);
      if (fsSync.existsSync(docPath)) continue;
      const description = this.getSkillDescription(tool);
      const content = `# ${tool}\n\n${description}\n`;
      await fs.writeFile(docPath, content, 'utf8');
      console.log(`[ContextManager] Created missing skill doc: ${docPath}`);
    }
  }

  getSkillDescription(tool) {
    const meta = this.skillsMeta?.get(tool);
    if (meta?.description) return meta.description;
    if (this.coreToolDescriptions[tool]) return this.coreToolDescriptions[tool];
    return 'Description not available.';
  }

  getSkillLabel(tool) {
    const meta = this.skillsMeta?.get(tool);
    if (meta?.label) return meta.label;
    return tool;
  }

  /**
   * Sync all teams
   */
  async syncTeams(db) {
    console.log('[ContextManager] Syncing teams...');

    const teams = await db.all('SELECT * FROM teams ORDER BY name');
    const teamsDir = path.join(this.companyDir, 'teams');

    // Get existing team directories
    try {
      const existingDirs = await fs.readdir(teamsDir);
      const validTeamNames = new Set(
        teams.map(t => t.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'))
      );

      // Remove directories for deleted teams
      for (const dir of existingDirs) {
        if (dir.startsWith('.') || dir === 'INDEX.md') continue;

        const fullPath = path.join(teamsDir, dir);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory() && !validTeamNames.has(dir)) {
          console.log(`[ContextManager] Removing deleted team directory: ${dir}`);
          await fs.rm(fullPath, { recursive: true, force: true });
        }
      }
    } catch (e) {
      // Teams directory might not exist yet
    }

    // Sync current teams
    for (const team of teams) {
      await this.syncTeam(db, team);
    }

    console.log(`[ContextManager] Synced ${teams.length} teams`);
  }

  /**
   * Sync a single team
   */
  async syncTeam(db, team) {
    // Use team name instead of ID for folder
    const teamFolderName = team.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const teamDir = path.join(this.companyDir, 'teams', teamFolderName);
    await fs.mkdir(teamDir, { recursive: true });

    // Get team members
    const members = await db.all(`
      SELECT s.* FROM specialists s
      INNER JOIN team_specialists ts ON s.id = ts.specialist_id
      WHERE ts.team_id = ?
    `, [team.id]);

    // Get team lead from users table (AI agent marked as team lead)
    let teamLead = null;
    const leadUser = await db.get(
      'SELECT * FROM users WHERE team_id = ? AND is_team_lead = 1',
      [team.id]
    );
    if (leadUser) {
      teamLead = leadUser; // Use the user object as team lead
    }

    // Create team overview
    const overviewPath = path.join(teamDir, 'OVERVIEW.md');
    const overview = this.generateTeamOverview(team, teamLead, members);
    await fs.writeFile(overviewPath, overview, 'utf8');

    // Create employees list
    const employeesPath = path.join(teamDir, 'EMPLOYEES.md');
    const employeesList = this.generateTeamEmployeesList(members);
    await fs.writeFile(employeesPath, employeesList, 'utf8');
  }

  /**
   * Sync all projects
   */
  async syncProjects(db) {
    console.log('[ContextManager] Syncing projects...');

    const projects = await db.all('SELECT * FROM projects ORDER BY name');
    const projectsDir = path.join(this.companyDir, 'projects');

    // Get existing project directories
    try {
      const existingDirs = await fs.readdir(projectsDir);
      const validProjectNames = new Set(
        projects.map(p => p.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'))
      );

      // Remove directories for deleted projects
      for (const dir of existingDirs) {
        if (dir.startsWith('.') || dir === 'INDEX.md') continue;

        const fullPath = path.join(projectsDir, dir);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory() && !validProjectNames.has(dir)) {
          console.log(`[ContextManager] Removing deleted project directory: ${dir}`);
          await fs.rm(fullPath, { recursive: true, force: true });
        }
      }
    } catch (e) {
      // Directory might not exist yet
    }

    // Sync current projects
    for (const project of projects) {
      await this.syncProject(db, project);
    }

    console.log(`[ContextManager] Synced ${projects.length} projects`);
  }

  /**
   * Sync a single project
   */
  async syncProject(db, project) {
    // Use project name instead of ID for folder
    const projectFolderName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const projectDir = path.join(this.companyDir, 'projects', projectFolderName);
    await fs.mkdir(projectDir, { recursive: true });

    // Get project teams
    const teams = await db.all(`
      SELECT t.* FROM teams t
      INNER JOIN project_teams pt ON t.id = pt.team_id
      WHERE pt.project_id = ?
    `, [project.id]);

    // Get project tasks
    const tasks = await db.all(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC',
      [project.id]
    );

    // Create project overview
    const overviewPath = path.join(projectDir, 'OVERVIEW.md');
    const overview = this.generateProjectOverview(project, teams, tasks);
    await fs.writeFile(overviewPath, overview, 'utf8');

    // Create teams list
    const teamsPath = path.join(projectDir, 'TEAMS.md');
    const teamsList = this.generateProjectTeamsList(teams);
    await fs.writeFile(teamsPath, teamsList, 'utf8');

    // Create tasks list
    const tasksPath = path.join(projectDir, 'TASKS.md');
    const tasksList = this.generateProjectTasksList(tasks);
    await fs.writeFile(tasksPath, tasksList, 'utf8');
  }

  // ==================== MARKDOWN GENERATORS ====================

  generateOrganizationOverview(employees, teams, projects) {
    const now = new Date().toISOString().split('T')[0];
    return `# Organization Overview

**Last Updated**: ${now}

## Company Statistics

- **Total Employees**: ${employees.length}
- **Active Teams**: ${teams.length}
- **Active Projects**: ${projects.length}

## Quick Links

- **All Employees**: See [EMPLOYEES.md](${this.companyDir}/organization/EMPLOYEES.md)
- **All Teams**: See [TEAMS.md](${this.companyDir}/organization/TEAMS.md)
- **Employee Directory**: See [${this.companyDir}/employees/INDEX.md]

## Recent Activity

This document provides a high-level overview of the organization structure.
For detailed information about specific entities, navigate to their respective directories.

## Directory Structure

\`\`\`
mycompany/
├── organization/    # Company-wide overviews
├── employees/       # Individual employee profiles
├── teams/          # Team configurations and members
├── projects/       # Project data and tasks
├── cto/           # CTO decisions and resource management
└── knowledge/     # Shared knowledge and documentation
\`\`\`

---

*This file is automatically generated and synchronized with the task manager database.*
`;
  }

  generateEmployeesList(employees) {
    const now = new Date().toISOString().split('T')[0];
    let content = `# Company Employees

**Last Updated**: ${now}
**Total**: ${employees.length}

## All Employees

`;

    for (const emp of employees) {
      const fileName = emp.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      content += `### ${emp.name}\n\n`;
      content += `- **ID**: ${emp.id}\n`;
      content += `- **Description**: ${emp.description || 'No description'}\n`;
      content += `- **Profile**: See [${fileName}.md](${this.companyDir}/employees/${fileName}.md)\n\n`;
    }

    content += `\n---\n\n*This file is automatically generated and synchronized with the task manager database.*\n`;

    return content;
  }

  generateTeamsList(teams) {
    const now = new Date().toISOString().split('T')[0];
    let content = `# Company Teams

**Last Updated**: ${now}
**Total**: ${teams.length}

## All Teams

`;

    for (const team of teams) {
      content += `### ${team.name}\n\n`;
      content += `- **ID**: ${team.id}\n`;
      content += `- **Mission**: ${team.mission_statement || 'No mission defined'}\n`;
      content += `- **Details**: See [${this.companyDir}/teams/${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}/OVERVIEW.md]\n\n`;
    }

    content += `\n---\n\n*This file is automatically generated and synchronized with the task manager database.*\n`;

    return content;
  }

  generateEmployeesIndex(employees) {
    const now = new Date().toISOString().split('T')[0];
    let content = `# Employee Directory

**Last Updated**: ${now}
**Total Employees**: ${employees.length}

## Directory

`;

    for (const emp of employees) {
      const fileName = emp.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      content += `- [${emp.name}](./${fileName}.md) - ${emp.description || 'Employee'}\n`;
    }

    content += `\n---\n\n*This directory is automatically synchronized with the task manager database.*\n`;

    return content;
  }

  generateEmployeeProfile(employee, teams, tools) {
    const now = new Date().toISOString().split('T')[0];
    const fileName = employee.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    let content = `# ${employee.name}

**Last Updated**: ${now}
**Employee ID**: ${employee.id}

## Profile

**Description**: ${employee.description || 'No description provided'}

## Model Profiles

- **Claude**: ${employee.model_claude || 'Not set'}
- **Gemini**: ${employee.model_gemini || 'Not set'}
- **OpenAI**: ${employee.model_openai || 'Not set'}

## System Instructions

\`\`\`
${employee.system_prompt || 'No system prompt configured'}
\`\`\`

## Skills & Capabilities

`;

    if (tools.length > 0) {
      content += `**Total Skills**: ${tools.length}\n\n`;
      for (const tool of tools) {
        const description = this.getSkillDescription(tool);
        const label = this.getSkillLabel(tool);
        const docPath = path.join(this.skillsDocDir, `${tool}.md`);
        content += `- ${label}: ${description} (${docPath})\n`;
      }
    } else {
      content += `No skills assigned yet.\n`;
    }

    content += `\n## Team Assignments\n\n`;

    if (teams.length > 0) {
      for (const team of teams) {
        content += `- **${team.name}**: ${team.mission || 'Team member'}\n`;
        content += `  - See [${this.companyDir}/teams/${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}/OVERVIEW.md]\n\n`;
      }
    } else {
      content += `Not assigned to any team yet.\n`;
    }

    content += `\n---\n\n*This profile is automatically synchronized with the task manager database.*\n`;

    return content;
  }

  generateTeamOverview(team, teamLead, members) {
    const now = new Date().toISOString().split('T')[0];

    let content = `# ${team.name}

**Last Updated**: ${now}
**Team ID**: ${team.id}

## Mission

${team.mission_statement || 'No mission defined'}

## Team Lead

`;

    if (teamLead) {
      content += `**${teamLead.name}**\n`;
      content += `- **Type**: AI Agent (Team Lead)\n`;

      if (teamLead.system_prompt) {
        content += `\n### System Prompt\n\n`;
        content += `\`\`\`\n${teamLead.system_prompt}\n\`\`\`\n`;
      }

      if (teamLead.model_config) {
        try {
          const modelConfig = typeof teamLead.model_config === 'string'
            ? JSON.parse(teamLead.model_config)
            : teamLead.model_config;
          content += `\n### Model Configuration\n\n`;
          content += `- **Provider**: ${modelConfig.provider || 'claude'}\n`;
          content += `- **Model**: ${modelConfig.model || 'sonnet'}\n`;
        } catch (e) {
          // Invalid JSON, skip
        }
      }
    } else {
      content += `No team lead assigned.\n`;
    }

    content += `\n## Team Employees\n\n`;
    content += `**Total Employees**: ${members.length}\n\n`;

    if (members.length > 0) {
      content += `**Quick Summary**: `;
      content += members.map(m => m.name).join(', ');
      content += `\n\n`;
      content += `📋 **For detailed employee profiles and capabilities**, see [EMPLOYEES.md](${this.companyDir}/teams/${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}/EMPLOYEES.md)\n`;
    } else {
      content += `No employees assigned yet.\n`;
    }

    content += `\n## Quick Links\n\n`;
    content += `- [Detailed Employees List](${this.companyDir}/teams/${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}/EMPLOYEES.md)\n`;
    content += `- [Organization Overview](${this.companyDir}/organization/OVERVIEW.md)\n`;

    content += `\n---\n\n*This file is automatically synchronized with the task manager database.*\n`;

    return content;
  }

  generateTeamEmployeesList(employees) {
    const now = new Date().toISOString().split('T')[0];

    let content = `# Team Employees

**Last Updated**: ${now}
**Total Employees**: ${employees.length}

## Employees

`;

    if (employees.length === 0) {
      content += `No employees assigned to this team yet.\n\n`;
    } else {
      for (const employee of employees) {
        const employeeFileName = employee.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        content += `### ${employee.name}\n\n`;
        content += `- **Description**: ${employee.description || 'No description'}\n`;
        content += `- **Profile**: [${employeeFileName}.md](${this.companyDir}/employees/${employeeFileName}.md)\n\n`;
      }
    }

    content += `\n---\n\n*This file is automatically synchronized with the task manager database.*\n`;

    return content;
  }

  generateProjectOverview(project, teams, tasks) {
    const now = new Date().toISOString().split('T')[0];
    const projectFolderName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

    let content = `# ${project.name}

**Last Updated**: ${now}
**Project ID**: ${project.id}

## Description

${project.description || 'No description provided'}

## Details

- **Repository**: ${project.repo_path || 'Not specified'}
- **Created**: ${project.created_at}

## Assigned Teams

**Total Teams**: ${teams.length}

`;

    if (teams.length > 0) {
      for (const team of teams) {
        content += `- **${team.name}**: ${team.mission || 'Assigned team'}\n`;
        content += `  - See [${this.companyDir}/teams/${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}/OVERVIEW.md]\n\n`;
      }
    } else {
      content += `No teams assigned yet.\n`;
    }

    content += `\n## Task Summary\n\n`;
    content += `**Total Tasks**: ${tasks.length}\n\n`;

    const statusCounts = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {});

    for (const [status, count] of Object.entries(statusCounts)) {
      content += `- **${status}**: ${count}\n`;
    }

    content += `\n## Quick Links\n\n`;
    content += `- [Team Assignments](${this.companyDir}/projects/${projectFolderName}/TEAMS.md)\n`;
    content += `- [Tasks List](${this.companyDir}/projects/${projectFolderName}/TASKS.md)\n`;

    content += `\n---\n\n*This file is automatically synchronized with the task manager database.*\n`;

    return content;
  }

  generateProjectTeamsList(teams) {
    const now = new Date().toISOString().split('T')[0];

    let content = `# Project Teams

**Last Updated**: ${now}
**Total Teams**: ${teams.length}

## Assigned Teams

`;

    for (const team of teams) {
      content += `### ${team.name}\n\n`;
      content += `- **Mission**: ${team.mission || 'Team mission'}\n`;
      content += `- **Details**: [${this.companyDir}/teams/${team.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}/OVERVIEW.md]\n\n`;
    }

    content += `\n---\n\n*This file is automatically synchronized with the task manager database.*\n`;

    return content;
  }

  generateProjectTasksList(tasks) {
    const now = new Date().toISOString().split('T')[0];

    let content = `# Project Tasks

**Last Updated**: ${now}
**Total Tasks**: ${tasks.length}

## All Tasks

`;

    for (const task of tasks) {
      content += `### ${task.title}\n\n`;
      content += `- **ID**: ${task.id}\n`;
      content += `- **Status**: ${task.status}\n`;
      content += `- **Priority**: ${task.priority || 'medium'}\n`;
      content += `- **Description**: ${task.description || 'No description'}\n`;
      content += `- **Created**: ${task.created_at}\n\n`;
    }

    content += `\n---\n\n*This file is automatically synchronized with the task manager database.*\n`;

    return content;
  }
}

module.exports = CompanyContextManager;
