const { exec, spawn } = require('child_process');
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
    this.teamLeadDir = path.join(__dirname, 'team_lead');
    this.globalRolesDir = path.join(this.teamLeadDir, 'roles');
    this.globalTeamsDir = path.join(this.teamLeadDir, 'teams');
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
   * Sync Runner Brain (Global Intelligence) - ~/team_lead/
   * This is where ALL roles and teams are stored globally
   */
  async syncRunnerBrain(allEmployees = [], allTeams = []) {
    try {
      // Ensure Runner Brain directories exist
      await this.ensureDirectoryExists(this.teamLeadDir);
      await this.ensureDirectoryExists(this.globalRolesDir);
      await this.ensureDirectoryExists(this.globalTeamsDir);
      // CTO product manager directory for persistent state
      const pmDir = path.join(this.teamLeadDir, 'product_manager');
      await this.ensureDirectoryExists(pmDir);

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

      // 1. Sync ALL Roles to ~/team_lead/roles/
      if (allEmployees && allEmployees.length > 0) {
        for (const employee of allEmployees) {
          const specFilename = employee.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.md';
          const specContent = `# Role: ${employee.name}

## Description
${employee.description || 'No description provided.'}

## Capabilities
${employee.system_prompt || 'Standard capabilities.'}

## Tools
${employee.tools || 'Standard tools'}

---
*This role is globally available to all projects and teams.*
`;
          await fs.writeFile(path.join(this.globalRolesDir, specFilename), specContent);
        }
      }

      // 2. Sync ALL Teams to ~/team_lead/teams/
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
${team.employees && team.employees.length > 0
  ? team.employees.map(s => {
      const specFile = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.md';
      return `- **${s.name}**: See \`~/team_lead/roles/${specFile}\``;
    }).join('\n')
  : '- No roles assigned yet.'}

---
*This team can be assigned to any project.*
`;
          await fs.writeFile(path.join(teamDir, 'MISSION.md'), missionContent);
        }
      }

      console.log(`[Runner Brain] Synced ${allEmployees.length} roles and ${allTeams.length} teams to ~/team_lead/`);
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
- **Lead Identity**: \`~/team_lead/teams/${teamFolderName}/LEAD.md\`
- **Team Details**: \`~/team_lead/teams/${teamFolderName}/MISSION.md\``;
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
   - Read your team's LEAD.md file at \`~/team_lead/teams/{team_name}/LEAD.md\`
   - Understand your identity, role, and responsibilities

2. **Understand Your Mission**
   - Read your team's MISSION.md file at \`~/team_lead/teams/{team_name}/MISSION.md\`
   - Understand your team's goals and mission statement
   - Review assigned roles you can collaborate with

3. **Review Project Context**
   - You're reading this file now (PROJECT.md)
   - Follow the Global Rules specified above
   - Work within the repository path specified

4. **Check Available Roles**
   - Global roles are available at: \`~/team_lead/roles/\`
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
*Team intelligence is stored centrally in ~/team_lead/*
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
   * Physically create sub-agent/employee files on the local machine
   * @deprecated Now handled by syncTeamEnvironment inside the project folder
   */
  async provisionEmployees(employees, provider) {
    // Legacy support kept empty to avoid breaking older calls
  }

  /**
   * Execute task with specific model (used by CTO for AI-powered decisions)
   */
  async execute(task, provider = 'claude', model = null) {
    const prompt = task.description || task.title;
    return this.executeTask(prompt, {
      provider,
      model,
      mode: 'cli',
      taskId: task.id,
      workDir: process.cwd()
    });
  }

  async executeTask(prompt, options = {}) {
    await this.ensureLogsDir();
    const provider = options.provider || 'claude';
    const model = options.model || null; // CTO-specified model
    const mode = options.mode || 'cli';
    const taskId = options.taskId;
    const envVars = options.env || {};
    const useIsolatedSession = provider === 'gemini' || provider === 'claude' || provider === 'codex' || provider === 'openai';

    const modelInfo = model && provider !== 'gemini' ? ` [${model}]` : '';
    console.log(`[Executor] Starting task execution with ${provider}${modelInfo} (mode: ${mode}, taskId: ${taskId})`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionName = `${provider}-task-${timestamp}`;
    const outputFile = path.join(this.logsDir, `${sessionName}-output.jsonl`);
    const logFile = path.join(this.logsDir, `task-${timestamp}.log`);
    const promptFile = path.join(this.logsDir, `${sessionName}-prompt.txt`);
    const wrapperScript = path.join(this.logsDir, `${sessionName}-wrapper.sh`);

    try {
      await fs.writeFile(promptFile, prompt);
      let providerCommand = '';
      let binInit = '';

      // Add --model flag if CTO specified a model (never pass model to gemini/codex CLI)
      const modelFlag = model && provider !== 'gemini' && provider !== 'codex' && provider !== 'openai'
        ? ` --model ${model}`
        : '';

      switch (provider) {
        case 'gemini':
          binInit = `GEMINI_BIN="${'${'}GEMINI_BIN:-$(command -v gemini)}"
if [ -z "$GEMINI_BIN" ]; then echo "gemini: command not found" >&2; exit 127; fi`;
          providerCommand = `"${'${'}GEMINI_BIN}" --yolo -p "$(cat ${promptFile})"`;
          break;
        case 'codex':
        case 'openai':
          binInit = `CODEX_BIN="${'${'}CODEX_BIN:-$(command -v codex)}"
if [ -z "$CODEX_BIN" ]; then echo "codex: command not found" >&2; exit 127; fi`;
          providerCommand = `"${'${'}CODEX_BIN}" exec --dangerously-bypass-approvals-and-sandbox --sandbox danger-full-access "$(cat ${promptFile})"`;
          break;
        case 'claude':
        default:
          binInit = `CLAUDE_BIN="${'${'}CLAUDE_BIN:-$(command -v claude)}"
if [ -z "$CLAUDE_BIN" ]; then echo "claude: command not found" >&2; exit 127; fi`;
          providerCommand = `"${'${'}CLAUDE_BIN}" -p "$(cat ${promptFile})" --dangerously-skip-permissions${modelFlag}`;
          break;
      }

      // Build env exports
      const envExports = Object.entries({
        ...envVars,
        HOME: process.env.HOME || '',
        XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || ''
      })
        .map(([key, val]) => `export ${key}="${val.replace(/"/g, '\\"')}"`)
        .join('\n');

      const workingDir = options.workDir || this.workDir;
      const scriptContent = `#!/bin/bash
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd ${workingDir}
${envExports}
${binInit}
${providerCommand} > ${outputFile} 2>&1
exit $?
`;
      await fs.writeFile(wrapperScript, scriptContent);
      await fs.chmod(wrapperScript, '755');
      console.log(`[Executor] Launching ${provider} CLI in background...`);
      console.log(`[Executor] Working directory: ${workingDir}`);
      console.log(`[Executor] Output file: ${outputFile}`);
      const child = spawn('bash', [wrapperScript], {
        detached: useIsolatedSession,
        stdio: 'ignore'
      });
      const childState = { exited: false };
      child.on('exit', () => { childState.exited = true; });
      child.unref();
      await this.sleep(500);
      console.log(`[Executor] Monitoring output file for results...`);
      let result;
      try {
        result = await this.monitorOutputFile(outputFile, logFile, promptFile, taskId, childState);
      } finally {
        if (useIsolatedSession) {
          await this._terminateIsolatedSession(child);
        }
        try { await fs.unlink(wrapperScript); await fs.unlink(promptFile); } catch (e) {}
      }
      return result;
    } catch (error) {
      console.error(`[Agent] Error executing task:`, error.message);
      throw error;
    }
  }

  async runProviderHealthCheck(provider, prompt = 'hello') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionName = `health-${provider}-${timestamp}`;
    const outputFile = path.join(this.logsDir, `${sessionName}-output.txt`);
    const promptFile = path.join(this.logsDir, `${sessionName}-prompt.txt`);
    const wrapperScript = path.join(this.logsDir, `${sessionName}-wrapper.sh`);
    const useIsolatedSession = true;

    try {
      await fs.writeFile(promptFile, prompt);

      let providerCommand = '';
      let binInit = '';
      switch (provider) {
        case 'gemini':
          binInit = `GEMINI_BIN="${'${'}GEMINI_BIN:-$(command -v gemini)}"
if [ -z "$GEMINI_BIN" ]; then echo "gemini: command not found" >&2; exit 127; fi`;
          providerCommand = `"${'${'}GEMINI_BIN}" --yolo -p "$(cat ${promptFile})"`;
          break;
        case 'codex':
        case 'openai':
          binInit = `CODEX_BIN="${'${'}CODEX_BIN:-$(command -v codex)}"
if [ -z "$CODEX_BIN" ]; then echo "codex: command not found" >&2; exit 127; fi`;
          providerCommand = `"${'${'}CODEX_BIN}" exec --dangerously-bypass-approvals-and-sandbox --sandbox danger-full-access "$(cat ${promptFile})"`;
          break;
        case 'claude':
        default:
          binInit = `CLAUDE_BIN="${'${'}CLAUDE_BIN:-$(command -v claude)}"
if [ -z "$CLAUDE_BIN" ]; then echo "claude: command not found" >&2; exit 127; fi`;
          providerCommand = `"${'${'}CLAUDE_BIN}" -p "$(cat ${promptFile})" --dangerously-skip-permissions`;
          break;
      }

      const scriptContent = `#!/bin/bash
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export HOME="${process.env.HOME || ''}"
export XDG_CONFIG_HOME="${process.env.XDG_CONFIG_HOME || ''}"
${binInit}
${providerCommand} > ${outputFile} 2>&1
exit $?
`;
      await fs.writeFile(wrapperScript, scriptContent);
      await fs.chmod(wrapperScript, '755');

      const child = spawn('bash', [wrapperScript], {
        detached: useIsolatedSession,
        stdio: 'ignore'
      });
      const childState = { exited: false };
      child.on('exit', () => { childState.exited = true; });
      child.unref();

      const timeoutMs = 15000;
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const stat = await fs.stat(outputFile);
          if (stat.size > 0 && childState.exited) break;
        } catch {}
        if (childState.exited) break;
        await this.sleep(300);
      }

      let output = '';
      try {
        output = await fs.readFile(outputFile, 'utf-8');
      } catch {}

      if (!childState.exited) {
        await this._terminateIsolatedSession(child);
      }

      const trimmed = (output || '').trim();
      const lower = trimmed.toLowerCase();
      const ok = trimmed.length > 0 && !lower.includes('credit balance is too low') && !lower.includes('not authenticated');
      return { ok, output: output.slice(0, 1000) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async monitorOutputFile(outputFile, logFile, promptFile, taskId, childState = null) {
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
        await fs.stat(outputFile);
        const fullContent = await fs.readFile(outputFile, 'utf-8');
        const currentSize = fullContent.length;
        if (currentSize > lastSize) {
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

              // Handle Claude format
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

              // Handle Gemini delta format
              if (event.delta && event.content) {
                if (textOutput.length < 100) {
                  console.log('[Executor] First Gemini delta:', event.content.substring(0, 200));
                }
                textOutput += event.content;
              }

              // Handle Gemini role-based format
              if (event.role === 'assistant' && event.content && !event.delta) {
                if (textOutput.length < 100) {
                  console.log('[Executor] First Gemini message:', event.content.substring(0, 200));
                }
                textOutput += event.content;
              }
            } catch (e) {
              // Preserve raw output lines (Gemini/Claude may emit non-JSON text)
              textOutput += `${line}\n`;
            }
          }
        } else if (childState?.exited && Date.now() - lastChangeTime > checkInterval) {
          break;
        } else if (Date.now() - lastChangeTime > inactivityThreshold && Date.now() - startTime > minRunTime) break;
      } catch (error) { if (error.code !== 'ENOENT') break; }
    }
    let prompt = '';
    try { prompt = await fs.readFile(promptFile, 'utf-8'); } catch (e) {}
    await fs.writeFile(logFile, `=== PROMPT ===\n${prompt}\n\n=== TEXT OUTPUT ===\n${textOutput}`);
    try { await fs.unlink(outputFile); } catch (e) {}
    return { success: textOutput.trim().length > 5, output: textOutput.trim(), logFile, sessionId, tokens_used: numTurns, cost: costUsd, duration: durationMs, toolsUsed };
  }

  async _terminateIsolatedSession(child) {
    if (!child || !child.pid) return;
    try {
      // Kill entire process group (detached session)
      process.kill(-child.pid, 'SIGTERM');
      await this.sleep(300);
      process.kill(-child.pid, 'SIGKILL');
    } catch (e) {
      // Ignore if already exited
    }
  }

  async executeKanbanTask(task, history = [], identity = {}, employees = [], project = {}, team = {}, allEmployees = [], options = {}) {
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
    let provider = options.provider || 'claude';
    let model = options.model || null;
    try {
      const config = typeof identity.model_config === 'string' ? JSON.parse(identity.model_config) : identity.model_config;
      if (!options.provider && config?.provider) provider = config.provider;
      if (!options.model && config?.model) model = config.model;
    } catch (e) {}

    // 4. Fetch Arsenal Tools (Equipped capabilities)
    let arsenalBlock = '';
    let arsenalEnv = {};
    try {
      if (identity.id) {
        const tools = await this.taskAPI.getEmployeeTools(identity.id);
        if (tools && tools.length > 0) {
          arsenalBlock = `
<equipped_arsenal>
You have been equipped with the following specialized capabilities. YOU MUST USE THEM when applicable.

${tools.map(t => `### 🛠️ ${t.name} (${t.type.toUpperCase()})
- **Description:** ${t.description}
- **Usage Command:** \`${t.command}\`
`).join('\n')}
</equipped_arsenal>`;

          // Prepare environment variables for credentials
          tools.forEach(t => {
            if (t.config_values) {
              const config = JSON.parse(t.config_values);
              Object.entries(config).forEach(([key, value]) => {
                // Format: TOOLNAME_KEY (e.g. FIRECRAWL_API_KEY)
                const envKey = `${t.name.toUpperCase().replace(/\s+/g, '_')}_${key.toUpperCase()}`;
                if (value) arsenalEnv[envKey] = value;
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Executor] Failed to fetch arsenal tools:', e.message);
    }

    // 5. Construct Prompt using Runner-Centralized Intelligence
    const teamFolderName = team.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const runnerBrainPath = this.teamLeadDir;

    const prompt = `
<identity>
You are **${identity.name}**, the **TEAM LEAD** for **${team.name}**.

🎯 **Your Role:**
As Team Lead, you are NOT just an individual contributor. You are a MANAGER responsible for:
- **Strategic Planning**: Breaking down tasks and planning the approach
- **Team Coordination**: Delegating work to your employee team members when appropriate
- **Quality Oversight**: Ensuring all work meets high standards
- **Execution**: Completing tasks yourself when appropriate, or orchestrating team efforts
- **Reporting**: Delivering clear, complete results to stakeholders

🧠 **Your Brain & Resources:**
- **Your Identity**: \`${runnerBrainPath}/teams/${teamFolderName}/LEAD.md\`
- **Team Mission**: \`${runnerBrainPath}/teams/${teamFolderName}/MISSION.md\`
- **Available Roles**: \`${runnerBrainPath}/roles/\` (read any role's .md file to understand their capabilities)

📋 **Your Team:**
You have access to specialized roles who can assist with specific aspects of work. Read their documentation to understand when to leverage their expertise.
</identity>
${arsenalBlock}
<task_assignment>
**Title:** ${task.title}
**Description:** ${task.description}

${conversationHistory ? '**Previous Context:**' + conversationHistory : ''}
</task_assignment>

<workspace>
**Working Directory:** \`${project.repository_path || process.cwd()}\`

**Project Guidelines:**
- Read \`${contextDir}/PROJECT.md\` for project-specific rules and requirements
- Read \`${contextDir}/CURRENT_SESSION.md\` for current session details
- Follow all coding standards and best practices outlined in project context
</workspace>

<leadership_approach>
**How to Approach This Task:**

1. **UNDERSTAND** - Read your identity files and project context first
2. **ANALYZE** - Break down the requirements and complexity
3. **PLAN** - Decide the best approach:
   - Can you handle this directly? → Execute it
   - Need employee expertise? → Read their role docs and leverage their capabilities
   - Complex multi-part task? → Coordinate multiple employees
4. **EXECUTE** - Complete the work with excellence
   - **USE YOUR ARSENAL**: If you have equipped tools, use them instead of writing custom code for those tasks.
5. **VERIFY** - Ensure quality and completeness
6. **REPORT** - The files you create/modify ARE your report to stakeholders

**Remember:**
- You represent your team - deliver professional, high-quality work
- Think strategically, not just tactically
- When in doubt, over-communicate rather than under-communicate
- Your work reflects on the entire ${team.name} team
</leadership_approach>

<instruction>
Now, as the Team Lead, complete this task with excellence. Show your leadership by delivering outstanding results.

**Tool/Skill Policy (REQUIRED):**
- You must delegate to the specific employee who is equipped with a tool/skill before it is used.
- Do not use tools/skills directly unless you are that equipped employee.
- If no equipped employee exists, request clarification.

**IMPORTANT - Final Deliverable:**
After completing the work, you MUST provide a completion summary in this exact format:

---COMPLETION REPORT---
## Task Summary
[Brief 1-2 sentence overview of what was accomplished]

## Changes Made
[Bulleted list of specific changes, files modified, features added, etc.]

## Technical Details
[Any important technical decisions, approaches used, or considerations]

## Next Steps (if applicable)
[Any recommended follow-up work or things to watch for]
---END REPORT---

This report will be shown to the project stakeholders, so make it clear, professional, and informative.

**If you need clarification:**
Respond with the following block and DO NOT proceed with execution:
---NEEDS_CLARIFICATION---
[Your questions for CEO]
---END_CLARIFICATION---
</instruction>
    `.trim();

    return this.executeTask(prompt, { provider, model, mode: 'cli', taskId: task.id, workDir: project.repository_path || process.cwd(), env: arsenalEnv });
  }

  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

module.exports = AgentExecutor;
