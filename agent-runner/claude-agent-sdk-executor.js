const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { query, tool, createSdkMcpServer } = require('@anthropic-ai/claude-agent-sdk');
const { z } = require('zod');

class ClaudeAgentSdkExecutor {
  constructor(taskAPI) {
    this.taskAPI = taskAPI;
    this.skillsDirs = [
      path.resolve(__dirname, 'skills', 'documentation'),
      path.resolve(__dirname, '.claude', 'skills')
    ];
    this.claudeDirName = '.claude';
  }

  async executeKanbanTask(task, history = [], identity = {}, employees = [], project = {}, team = {}, allEmployees = [], options = {}) {
    const projectDir = project.repository_path || process.cwd();
    const prompt = this._buildPrompt(task, history, identity, employees, project, team);
    const executionContext = {
      projectDir,
      identity,
      employees,
      model: options?.model || null,
      thinking: options?.thinking || null
    };
    return this.executePrompt(prompt, executionContext);
  }

  async executePrompt(prompt, ctx) {
    const start = Date.now();
    await this._stageClaudeProject(ctx.projectDir, ctx.identity, ctx.employees);
    const { agents, tools } = this._buildAgentsAndTools(ctx.employees, ctx.model);

    const options = {
      cwd: ctx.projectDir,
      settingSources: ['project'],
      setting_sources: ['project'],
      allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
      allowed_tools: ['Read', 'Write', 'Edit', 'Bash'],
      agents,
      tools
    };
    if (ctx.model) options.model = ctx.model;
    if (ctx.thinking?.enabled) {
      options.thinking = {
        type: 'enabled',
        budget_tokens: ctx.thinking.budget_tokens || 4000
      };
    }

    let output = '';
    let usage = null;
    let modelUsage = null;
    let rawResult = null;
    try {
      const result = await query(prompt, options);
      rawResult = result;
      output = this._extractText(result);
      usage = result?.usage || null;
      modelUsage = result?.modelUsage || result?.model_usage || null;
    } catch (e) {
      output = `SDK Error: ${e.message}`;
    }

    const resultObj = {
      success: output.trim().length > 0,
      output,
      duration: Date.now() - start,
      tokens_used: null,
      toolsUsed: [],
      usage,
      modelUsage,
      rawUsage: rawResult
    };
    await this._cleanupClaudeProject(ctx.projectDir);
    return resultObj;
  }

  _buildAgentsAndTools(employees, baseModel = null) {
    const agents = [];
    const tools = [];
    const toolNameSet = new Set();

    for (const employee of employees) {
      const skills = this._parseJsonArray(employee.tools);
      const equippedTools = Array.isArray(employee.equipped_tools) ? employee.equipped_tools : [];

      const agentPrompt = [
        employee.system_prompt || '',
        '',
        'You may only use skills/tools you are explicitly equipped with.',
        'If you need a tool/skill outside your equipment, ask the Team Lead.',
        '',
        skills.length > 0 ? `Skills: ${skills.join(', ')}` : 'Skills: none',
        equippedTools.length > 0 ? `Tools: ${equippedTools.map(t => t.name).join(', ')}` : 'Tools: none'
      ].join('\n').trim();

      agents.push({
        name: employee.name,
        description: employee.description || 'Subagent',
        prompt: agentPrompt,
        model: employee.model_claude || baseModel || undefined,
        allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Skill', ...equippedTools.map(t => t.name)],
        allowed_tools: ['Read', 'Write', 'Edit', 'Bash', 'Skill', ...equippedTools.map(t => t.name)]
      });

      for (const toolDef of equippedTools) {
        if (toolNameSet.has(toolDef.name)) continue;
        toolNameSet.add(toolDef.name);
        tools.push(this._buildTool(toolDef));
      }
    }

    return { agents, tools };
  }

  _buildTool(toolDef) {
    const schema = z.record(z.any());
    const handler = async (input) => {
      if (!toolDef.command) {
        return { output: 'No command configured' };
      }

      const args = input?.args ? JSON.stringify(input.args) : '';
      const cmd = `${toolDef.command} ${args}`.trim();

      if (toolDef.type === 'mcp') {
        return { output: `MCP tool invoked: ${cmd}` };
      }

      try {
        const { exec } = require('child_process');
        const env = { ...process.env };
        if (toolDef.config_values) {
          const config = JSON.parse(toolDef.config_values);
          Object.entries(config).forEach(([key, value]) => {
            env[key] = value;
          });
        }
        const result = await new Promise((resolve, reject) => {
          exec(cmd, { env, timeout: 300000 }, (err, stdout, stderr) => {
            if (err) return resolve({ error: err.message, stdout, stderr });
            resolve({ stdout, stderr });
          });
        });
        return { output: JSON.stringify(result, null, 2) };
      } catch (e) {
        return { output: `Tool execution failed: ${e.message}` };
      }
    };

    return tool({
      name: toolDef.name,
      description: toolDef.description || 'Custom tool',
      schema,
      handler
    });
  }

  async _stageClaudeProject(projectDir, identity, employees) {
    const claudeRoot = path.join(projectDir, this.claudeDirName);
    const skillsRoot = path.join(claudeRoot, 'skills');
    await fs.mkdir(skillsRoot, { recursive: true });

    const skillSet = new Set();
    for (const employee of employees) {
      this._parseJsonArray(employee.tools).forEach(s => skillSet.add(s));
    }

    for (const skill of skillSet) {
      const destDir = path.join(skillsRoot, skill);
      const dest = path.join(destDir, 'SKILL.md');
      await fs.mkdir(destDir, { recursive: true });

      let source = null;
      for (const dir of this.skillsDirs) {
        if (!fsSync.existsSync(dir)) continue;
        const candidates = [
          path.join(dir, `${skill}.md`),
          path.join(dir, skill, 'SKILL.md'),
          path.join(dir, skill, `${skill}.md`)
        ];
        source = candidates.find(p => fsSync.existsSync(p)) || null;
        if (source) break;
      }

      if (source) {
        await fs.copyFile(source, dest);
      } else {
        await fs.writeFile(dest, `# ${skill}\n\nNo description found.\n`, 'utf8');
      }
    }

    const systemPrompt = [
      identity.system_prompt || '',
      '',
      'Tool/Skill Policy:',
      '- You MUST delegate to the specific employee who has a tool/skill before it is used.',
      '- Do not invoke skills/tools directly from the Team Lead.',
      '- If no equipped employee exists, ask for clarification.'
      ,
      '',
      'If you need clarification, respond with:',
      '---NEEDS_CLARIFICATION---',
      '[Your questions for CEO]',
      '---END_CLARIFICATION---'
    ].join('\n').trim();

    await fs.writeFile(path.join(claudeRoot, 'CLAUDE.md'), systemPrompt, 'utf8');
  }

  async _cleanupClaudeProject(projectDir) {
    try {
      const claudeRoot = path.join(projectDir, this.claudeDirName);
      await fs.rm(claudeRoot, { recursive: true, force: true });
    } catch {}
  }

  _buildPrompt(task, history, identity, employees, project, team) {
    const historyBlock = history.length
      ? history.map((h, i) => `[#${i + 1}] ${h.is_system ? 'SYSTEM' : h.user_name}: ${h.content}`).join('\n')
      : 'No history.';

    const employeeList = employees.length
      ? employees.map(s => `- ${s.name}: ${s.description || 'No description'}`).join('\n')
      : 'No employees.';

    return `
<identity>
You are **${identity.name}**, the **TEAM LEAD** for **${team.name}**.
You must delegate to employees to use any skill or tool they are equipped with.
</identity>

<task>
Title: ${task.title}
Description: ${task.description || 'No description provided'}
</task>

<project>
Name: ${project.name || 'Unknown'}
Repo: ${project.repository_path || 'N/A'}
</project>

<employees>
${employeeList}
</employees>

<history>
${historyBlock}
</history>
`.trim();
  }

  _extractText(result) {
    if (!result) return '';
    if (typeof result === 'string') return result;
    if (Array.isArray(result)) {
      return result.map(r => (typeof r === 'string' ? r : r?.content || '')).join('\n');
    }
    if (result.message?.content) return result.message.content;
    if (result.content) return result.content;
    return JSON.stringify(result, null, 2);
  }

  _parseJsonArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
}

module.exports = ClaudeAgentSdkExecutor;
