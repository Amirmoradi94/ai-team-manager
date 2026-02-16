const path = require('path');
const { spawn } = require('child_process');

class GoogleAdkExecutor {
  constructor(taskAPI) {
    this.taskAPI = taskAPI;
    this.projectRoot = path.resolve(__dirname, 'google_adk');
  }

  async executeKanbanTask(task, history = [], identity = {}, employees = [], project = {}, team = {}, allEmployees = [], options = {}) {
    const projectDir = project.repository_path || process.cwd();
    const prompt = this._buildPrompt(task, history, identity, employees, project, team);
    const executionContext = {
      projectDir,
      identity,
      employees,
      model: options?.model || null,
      actorType: options?.actorType || 'team_lead'
    };
    return this.executePrompt(prompt, executionContext);
  }

  async executePrompt(prompt, ctx) {
    const start = Date.now();
    const payload = {
      actor_type: ctx.actorType || 'team_lead',
      prompt,
      model: ctx.model || null,
      identity: ctx.identity || {},
      employees: ctx.employees || [],
      project_dir: ctx.projectDir || process.cwd()
    };

    const result = await this._runPython(payload, ctx.projectDir || process.cwd());

    return {
      success: !!result.final_output,
      output: result.final_output || '',
      duration: Date.now() - start,
      tokens_used: Number.isFinite(result.usage?.total_tokens) ? result.usage.total_tokens : null,
      toolsUsed: result.tool_calls || [],
      usage: result.usage || null,
      rawUsage: result.raw_result || null,
      needsApproval: result.needs_approval || false,
      approvalRequests: result.approval_requests || []
    };
  }

  async _runPython(payload, workingDir) {
    const scriptPath = path.join(this.projectRoot, 'runner.py');
    const pythonBin = process.env.PYTHON_BIN || 'python3';

    return new Promise((resolve, reject) => {
      const child = spawn(pythonBin, [scriptPath], {
        cwd: workingDir,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (!stdout) {
          return reject(new Error(stderr || `Google ADK runner failed (exit ${code})`));
        }
        try {
          const parsed = JSON.parse(stdout);
          if (parsed.error) {
            return reject(new Error(parsed.error));
          }
          resolve(parsed);
        } catch (err) {
          reject(new Error(`Failed to parse Google ADK output: ${err.message}. stderr=${stderr}`));
        }
      });

      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    });
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
You are **${identity.name || 'TEAM LEAD'}**, the **TEAM LEAD** for **${team.name || 'Unknown'}**.
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
}

module.exports = GoogleAdkExecutor;
