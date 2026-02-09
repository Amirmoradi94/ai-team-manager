const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const os = require('os');
const execAsync = promisify(exec);

class AgentExecutor {
  constructor(taskAPI, workDir = process.cwd()) {
    this.taskAPI = taskAPI;
    this.workDir = workDir;
    this.logsDir = path.join(workDir, 'logs');
    // Runner Brain Directory (centralized intelligence) - inside agent-runner package
    this.runnerBrainDir = path.join(__dirname, 'runner_brain');
    this.globalRolesDir = path.join(this.runnerBrainDir, 'roles');
    this.globalTeamsDir = path.join(this.runnerBrainDir, 'teams');
  }

  async ensureLogsDir() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
    } catch (error) {}
  }

  /**
   * Ensure a specific directory exists, create it if not
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      console.error(`[Agent] Failed to create directory ${dirPath}:`, error.message);
      return false;
    }
  }

  /**
   * Sync Runner Brain (Global Intelligence) - ~/runner_brain/
   * This is where ALL roles and teams are stored globally
   */
  async syncRunnerBrain(allSpecialists = [], allTeams = []) {
    try {
      // Ensure Runner Brain directories exist
      await this.ensureDirectoryExists(this.runnerBrainDir);
      await this.ensureDirectoryExists(this.globalRolesDir);
      await this.ensureDirectoryExists(this.globalTeamsDir);

      // Cleanup: Remove team folders that no longer exist in the database
      try {
        const existingTeamFolders = await fs.readdir(this.globalTeamsDir);
        const activeTeamNames = allTeams.map(t => t.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));

        for (const folder of existingTeamFolders) {
          if (folder === '.DS_Store') continue; // Skip system files
          if (!activeTeamNames.includes(folder)) {
            const folderPath = path.join(this.globalTeamsDir, folder);
            await fs.rm(folderPath, { recursive: true, force: true });
            console.log(`[Runner Brain] Removed deleted team folder: ${folder}`);
          }
        }
      } catch (error) {
        console.error(`[Runner Brain] Error cleaning up team folders:`, error.message);
      }

      // 1. Sync ALL Roles to ~/runner_brain/roles/
      if (allSpecialists && allSpecialists.length > 0) {
        for (const spec of allSpecialists) {
          const specFilename = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.md';
          const specContent = `# Role: ${spec.name}

## Description
${spec.description || 'No description provided.'}

## Capabilities
${spec.system_prompt || 'Standard capabilities.'}

## Tools
${spec.tools || 'Standard tools'}

---
*This role is globally available to all projects and teams.*
`;
          await fs.writeFile(path.join(this.globalRolesDir, specFilename), specContent);
        }
      }

      // 2. Sync ALL Teams to ~/runner_brain/teams/
      if (allTeams && allTeams.length > 0) {
        for (const team of allTeams) {
          const teamFolderName = team.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
          const teamDir = path.join(this.globalTeamsDir, teamFolderName);
          await this.ensureDirectoryExists(teamDir);

          // Team Lead Identity
          const lead = team.lead || { name: 'Lead Agent', system_prompt: 'Primary orchestrator.' };
          const leadContent = `# Team Lead: ${lead.name}

## System Prompt
${lead.system_prompt}

## Model Configuration
${JSON.stringify(lead.model_config || { provider: 'claude' }, null, 2)}

---
*This is your core identity. Read this first when assigned to any project.*
`;
          await fs.writeFile(path.join(teamDir, 'LEAD.md'), leadContent);

          // Team Mission
          const missionContent = `# Team: ${team.name}

## Mission Statement
${team.mission_statement || 'Execute assigned tasks efficiently.'}

## Team Roles
${team.specialists && team.specialists.length > 0
  ? team.specialists.map(s => {
      const specFile = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.md';
      return `- **${s.name}**: See \`~/runner_brain/roles/${specFile}\``;
    }).join('\n')
  : '- No roles assigned yet.'}

---
*This team can be assigned to any project.*
`;
          await fs.writeFile(path.join(teamDir, 'MISSION.md'), missionContent);
        }
      }

      console.log(`[Runner Brain] Synced ${allSpecialists.length} roles and ${allTeams.length} teams to ~/runner_brain/`);
      return true;
    } catch (error) {
      console.error(`[Runner Brain] Failed to sync:`, error.message);
      return false;
    }
  }

  /**
   * Create lightweight Project Context in the project workspace
   * This contains project-specific rules, available teams, and session workflow
   */
  async syncProjectContext(project, teams = []) {
    try {
      const targetDir = project.repository_path || this.workDir;
      const contextDir = path.join(targetDir, 'ai_task_context');
      await this.ensureDirectoryExists(contextDir);

      // 1. Create AI_HISTORY.md if it doesn't exist (tracks AI activity)
      const historyPath = path.join(contextDir, 'AI_HISTORY.md');
      try {
        await fs.access(historyPath);
      } catch {
        // File doesn't exist, create it
        const historyContent = `# AI Activity History - ${project.name}

## Purpose
This file tracks all AI-powered work performed on this project. Each entry should include:
- Date and time
- Team/Agent that performed the work
- Task description
- Changes made
- Results/outcome

---

## Activity Log

*No activity recorded yet. This file will be updated as AI agents work on tasks in this project.*
`;
        await fs.writeFile(historyPath, historyContent);
      }

      // 2. PROJECT.md - Project-specific rules, description, available teams, and workflow
      const teamsListContent = teams.length > 0
        ? teams.map(t => {
            const teamFolderName = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
            return `### ${t.name}
- **Mission**: ${t.mission_statement || 'N/A'}
- **Lead Identity**: \`~/runner_brain/teams/${teamFolderName}/LEAD.md\`
- **Team Details**: \`~/runner_brain/teams/${teamFolderName}/MISSION.md\``;
          }).join('\n\n')
        : '*No teams assigned yet. Assign teams in the task manager UI.*';

      const projectContent = `# Project: ${project.name}

## Description
${project.description || 'No description provided.'}

## Repository Path
\`${project.repository_path || 'Not specified'}\`

## Global Rules
${project.global_rules || 'Follow standard best practices and write clean code.'}

---

## Assigned Teams
${teamsListContent}

---

## AI Workflow Instructions

When you (an AI agent) are assigned a task in this project:

1. **Identify Your Team**
   - Check which team you belong to from the list above
   - Read your team's LEAD.md file at \`~/runner_brain/teams/{team_name}/LEAD.md\`
   - Understand your identity, role, and responsibilities

2. **Understand Your Mission**
   - Read your team's MISSION.md file at \`~/runner_brain/teams/{team_name}/MISSION.md\`
   - Understand your team's goals and mission statement
   - Review assigned roles you can collaborate with

3. **Review Project Context**
   - You're reading this file now (PROJECT.md)
   - Follow the Global Rules specified above
   - Work within the repository path specified

4. **Check Available Roles**
   - Global roles are available at: \`~/runner_brain/roles/\`
   - Review their capabilities when you need specialized help

5. **Execute Your Task**
   - Follow your team's guidelines from LEAD.md
   - Apply the project's global rules
   - Work in this directory: \`${project.repository_path || process.cwd()}\`

6. **Document Your Work**
   - Update \`AI_HISTORY.md\` with your activities
   - Include: date, task, changes made, and outcomes
   - Keep the team and project stakeholders informed

---

*Last synced: ${new Date().toLocaleString()}*
*Team intelligence is stored centrally in ~/runner_brain/*
`;
      await fs.writeFile(path.join(contextDir, 'PROJECT.md'), projectContent);

      console.log(`[Project Context] Synced .ai_task_context/ in ${project.name} with ${teams.length} teams`);
      return contextDir;
    } catch (error) {
      console.error(`[Project Context] Failed to sync:`, error.message);
      return null;
    }
  }

  /**
   * Physically create sub-agent/specialist files on the local machine
   * @deprecated Now handled by syncTeamEnvironment inside the project folder
   */
  async provisionSpecialists(specialists, provider) {
    // Legacy support kept empty to avoid breaking older calls
  }

  async executeTask(prompt, options = {}) {
    await this.ensureLogsDir();
    const provider = options.provider || 'claude';
    const mode = options.mode || 'cli';
    const taskId = options.taskId;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionName = `${provider}-task-${timestamp}`;
    const outputFile = path.join(this.logsDir, `${sessionName}-output.jsonl`);
    const logFile = path.join(this.logsDir, `task-${timestamp}.log`);
    const promptFile = path.join(this.logsDir, `${sessionName}-prompt.txt`);
    const wrapperScript = path.join(this.logsDir, `${sessionName}-wrapper.sh`);

    try {
      await fs.writeFile(promptFile, prompt);
      let providerCommand = '';
      switch (provider) {
        case 'gemini': providerCommand = `gemini chat -p "$(cat ${promptFile})" --format json`; break;
        case 'codex':
        case 'openai': providerCommand = `codex -p "$(cat ${promptFile})" --json`; break;
        case 'claude':
        default: providerCommand = `unset ANTHROPIC_API_KEY && claude -p "$(cat ${promptFile})" --permission-mode bypassPermissions --output-format stream-json --verbose`; break;
      }

      const scriptContent = `#!/bin/bash\nset -e\ncd ${this.workDir}\n${providerCommand} > ${outputFile} 2>&1\nexit $?\n`;
      await fs.writeFile(wrapperScript, scriptContent);
      await fs.chmod(wrapperScript, '755');
      await execAsync(`bash ${wrapperScript} > /dev/null 2>&1 &`);
      await this.sleep(500);
      const result = await this.monitorOutputFile(outputFile, logFile, promptFile, taskId);
      try { await fs.unlink(wrapperScript); await fs.unlink(promptFile); } catch (e) {}
      return result;
    } catch (error) {
      console.error(`[Agent] Error executing task:`, error.message);
      throw error;
    }
  }

  async monitorOutputFile(outputFile, logFile, promptFile, taskId) {
    const maxWaitTime = 600000;
    const checkInterval = 2000;
    const inactivityThreshold = 45000; 
    const minRunTime = 10000;
    let lastSize = 0;
    let lastChangeTime = Date.now();
    const startTime = Date.now();
    let textOutput = '';
    let sessionId = null;
    let costUsd = null;
    let durationMs = null;
    let numTurns = null;
    let toolsUsed = [];

    while (Date.now() - startTime < maxWaitTime) {
      await this.sleep(checkInterval);
      try {
        const stats = await fs.stat(outputFile);
        const currentSize = stats.size;
        if (currentSize > lastSize) {
          const fullContent = await fs.readFile(outputFile, 'utf-8');
          const newContent = fullContent.slice(lastSize);
          lastSize = currentSize;
          lastChangeTime = Date.now();
          
          // Send live logs to API for streaming
          if (taskId && this.taskAPI) {
            this.taskAPI.sendRunnerLogs(taskId, newContent).catch(() => {});
          }

          const lines = newContent.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const event = JSON.parse(line);
              if (event.type === 'system' && event.subtype === 'init') sessionId = event.session_id;
              if (event.type === 'assistant' && event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === 'text') textOutput += block.text;
                  if (block.type === 'tool_use') toolsUsed.push(block.name);
                }
              }
              if (event.type === 'result') {
                costUsd = event.cost_usd || event.total_cost_usd || null;
                durationMs = event.duration_ms || null;
                numTurns = event.num_turns || null;
              }
            } catch (e) { if (line.trim()) textOutput += line + '\n'; }
          }
        } else if (Date.now() - lastChangeTime > inactivityThreshold && Date.now() - startTime > minRunTime) break;
      } catch (error) { if (error.code !== 'ENOENT') break; }
    }
    let prompt = '';
    try { prompt = await fs.readFile(promptFile, 'utf-8'); } catch (e) {}
    await fs.writeFile(logFile, `=== PROMPT ===\n${prompt}\n\n=== TEXT OUTPUT ===\n${textOutput}`);
    try { await fs.unlink(outputFile); } catch (e) {}
    return { success: textOutput.trim().length > 5, output: textOutput.trim(), logFile, sessionId, tokens_used: numTurns, cost: costUsd, duration: durationMs, toolsUsed };
  }

  async executeKanbanTask(task, history = [], identity = {}, specialists = [], project = {}, team = {}, allSpecialists = []) {
    // 1. Sync Project Context (lightweight, project-specific)
    const contextDir = await this.syncProjectContext(project, team);

    // 2. Summarize History if too long
    let conversationHistory = '';
    if (history.length > 4) {
      const recentItems = history.slice(history.length - 2);
      conversationHistory = `\n\n### Recent Task History:\n`;
      recentItems.forEach((comment, index) => {
        const type = comment.is_system ? 'SYSTEM LOG' : `USER: ${comment.user_name}`;
        conversationHistory += `\n[Recent] ${type}:\n${comment.content}\n`;
      });
    } else if (history.length > 0) {
      conversationHistory = '\n\n### History of this Task:\n';
      history.forEach((comment, index) => {
        const type = comment.is_system ? 'SYSTEM LOG' : `USER: ${comment.user_name}`;
        conversationHistory += `\n[${index + 1}] ${type}:\n${comment.content}\n`;
      });
    }

    // 3. Determine Provider
    let provider = 'claude';
    try {
      const config = typeof identity.model_config === 'string' ? JSON.parse(identity.model_config) : identity.model_config;
      if (config?.provider) provider = config.provider;
    } catch (e) {}

    // 4. Construct Prompt using Runner-Centralized Intelligence
    const teamFolderName = team.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const runnerBrainPath = this.runnerBrainDir;

    const prompt = `
<identity>
You are **${identity.name}**, the Team Lead for **${team.name}**.

🧠 **Your Brain Location:**
- Core Identity: \`${runnerBrainPath}/teams/${teamFolderName}/LEAD.md\`
- Team Mission: \`${runnerBrainPath}/teams/${teamFolderName}/MISSION.md\`

Read these files FIRST to understand who you are and what your team does.
</identity>

<task_context>
**Title:** ${task.title}
**Description:** ${task.description}
</task_context>

<workspace>
You are working in: \`${project.repository_path || process.cwd()}\`

📋 **Project Context:** Read \`${contextDir}/PROJECT.md\` for project-specific rules and requirements.
📝 **Session Info:** Read \`${contextDir}/CURRENT_SESSION.md\` for current session details.
</workspace>

<available_roles>
Global roles are available at: \`${runnerBrainPath}/roles/\`

You can invoke any role's capabilities by reading their .md file and understanding their responsibilities.
</available_roles>

${conversationHistory}

<instruction>
**Your Mission:**
1. Read your identity files to understand your role
2. Read the project context to understand requirements
3. Execute the task following all rules and guidelines
4. Execute autonomously with best judgment

Complete the task now.
</instruction>
    `.trim();

    return this.executeTask(prompt, { provider, mode: 'cli', taskId: task.id });
  }

  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

module.exports = AgentExecutor;