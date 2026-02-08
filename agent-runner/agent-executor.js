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
  }

  async ensureLogsDir() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  /**
   * Physically create sub-agent/specialist files on the local machine
   */
  async provisionSpecialists(specialists, provider) {
    for (const spec of specialists) {
      try {
        if (provider === 'claude') {
          const agentPath = path.join(os.homedir(), '.claude', 'agents');
          await fs.mkdir(agentPath, { recursive: true });
          
          const content = `---
name: ${spec.name}
description: "${spec.description}"
model: sonnet
---

${spec.system_prompt}

Allowed Tools: ${(JSON.parse(spec.tools || '[]')).join(', ')}
`;
          await fs.writeFile(path.join(agentPath, `${spec.name.toLowerCase().replace(/\s+/g, '-')}.md`), content);
        } else if (provider === 'gemini') {
          const skillPath = path.join(this.workDir, '.gemini', 'skills', spec.name.toLowerCase().replace(/\s+/g, '-'));
          await fs.mkdir(skillPath, { recursive: true });
          
          const content = `---
name: ${spec.name}
description: "${spec.description}"
---
# ${spec.name} Instructions

${spec.system_prompt}

Allowed Tools: ${(JSON.parse(spec.tools || '[]')).join(', ')}
`;
          await fs.writeFile(path.join(skillPath, 'SKILL.md'), content);
        }
      } catch (error) {
        console.error(`[Agent] Failed to provision specialist ${spec.name}:`, error.message);
      }
    }
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

    console.log(`[Agent] Launching task execution...`);
    console.log(`[Agent] Provider: ${provider.toUpperCase()} (${mode})`);

    try {
      await fs.writeFile(promptFile, prompt);

      let providerCommand = '';
      switch (provider) {
        case 'gemini':
          providerCommand = `gemini chat -p "$(cat ${promptFile})" --format json`;
          break;
        case 'codex':
        case 'openai':
          providerCommand = `codex -p "$(cat ${promptFile})" --json`;
          break;
        case 'claude':
        default:
          providerCommand = `unset ANTHROPIC_API_KEY && claude -p "$(cat ${promptFile})" --permission-mode bypassPermissions --output-format stream-json --verbose`;
          break;
      }

      const scriptContent = `#!/bin/bash
set -e
cd ${this.workDir}
${providerCommand} > ${outputFile} 2>&1
exit $?
`;

      await fs.writeFile(wrapperScript, scriptContent);
      await fs.chmod(wrapperScript, '755');

      await execAsync(`bash ${wrapperScript} > /dev/null 2>&1 &`);
      await this.sleep(500);

      const result = await this.monitorOutputFile(outputFile, logFile, promptFile, taskId);

      try {
        await fs.unlink(wrapperScript);
        await fs.unlink(promptFile);
      } catch (e) {}

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
            } catch (e) {
              if (line.trim()) textOutput += line + '\n';
            }
          }
        } else if (Date.now() - lastChangeTime > inactivityThreshold && Date.now() - startTime > minRunTime) {
          break;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') break;
      }
    }

    let prompt = '';
    try { prompt = await fs.readFile(promptFile, 'utf-8'); } catch (e) {}
    await fs.writeFile(logFile, `=== PROMPT ===\n${prompt}\n\n=== TEXT OUTPUT ===\n${textOutput}`);
    try { await fs.unlink(outputFile); } catch (e) {}

    return {
      success: textOutput.trim().length > 5,
      output: textOutput.trim(),
      logFile,
      sessionId,
      tokens_used: numTurns,
      cost: costUsd,
      duration: durationMs,
      toolsUsed
    };
  }

  async executeKanbanTask(task, history = [], identity = {}, specialists = [], project = {}) {
    // 1. Summarize History if too long
    let conversationHistory = '';
    if (history.length > 4) {
      const summaryItems = history.slice(0, history.length - 2);
      const recentItems = history.slice(history.length - 2);
      
      conversationHistory = `\n\n### Summary of Previous Turns:\n- The task has been through ${summaryItems.length} previous iterations involving both system logs and user feedback.\n`;
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

    // 2. Determine Provider
    let provider = 'claude';
    try {
      const config = typeof identity.model_config === 'string' ? JSON.parse(identity.model_config) : identity.model_config;
      if (config?.provider) provider = config.provider;
    } catch (e) {}

    // 3. Provision Specialists locally
    await this.provisionSpecialists(specialists, provider);

    // 4. Lean Specialist Descriptions
    let specialistSummary = '';
    if (specialists.length > 0) {
      specialistSummary = `\n\n## Available Specialist Tools:\nYou can delegate sub-tasks to these specialized agents:\n` + 
        specialists.map(s => `- **${s.name}**: ${s.description}`).join('\n');
    }

    const prompt = `
<identity>
You are **${identity.name}**.
${identity.system_prompt}
</identity>

<task_context>
Title: ${task.title}
Description: ${task.description}
</task_context>

${project.global_rules ? `\n## Project Rules:\n${project.global_rules}` : ''}
${specialistSummary}
${conversationHistory}

<instruction>
Complete the task. Focus on user feedback if present. Update AI_CONTEXT.md upon completion with a 1-line summary.
</instruction>
    `.trim();

    return this.executeTask(prompt, { provider, mode: 'cli', taskId: task.id });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AgentExecutor;
