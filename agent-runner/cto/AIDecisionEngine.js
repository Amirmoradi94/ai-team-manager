/**
 * AIDecisionEngine - Uses actual AI models for CTO decision-making
 *
 * Leverages Gemini Pro, Claude Opus 4.5, or GPT-5.2 for:
 * - Intelligent task evaluation
 * - Complexity analysis with reasoning
 * - Strategic provider selection
 * - Smart verification
 */

const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const ClaudeApiClient = require('./claude-api-client');

class AIDecisionEngine {
  constructor(modelSelector, agentExecutor, usageTracker = null, openaiSdkExecutor = null, googleAdkExecutor = null) {
    this.modelSelector = modelSelector;
    this.agentExecutor = agentExecutor;
    this.usageTracker = usageTracker;
    this.openaiSdkExecutor = openaiSdkExecutor;
    this.googleAdkExecutor = googleAdkExecutor;
    this.systemPromptPath = path.resolve(__dirname, '..', '..', 'mycompany', 'cto', 'SYSTEM_PROMPT.md');
    this.companyDir = path.resolve(__dirname, '..', '..', 'mycompany');
    this.claudeClient = process.env.ANTHROPIC_API_KEY ? new ClaudeApiClient(process.env.ANTHROPIC_API_KEY) : null;
  }

  async _executeWithProvider(prompt, provider, modelName, actorType = 'cto') {
    if (provider === 'gemini' && this.googleAdkExecutor) {
      return this.googleAdkExecutor.executePrompt(prompt, {
        projectDir: process.cwd(),
        identity: { name: 'CTO', system_prompt: 'You are the CTO.' },
        employees: [],
        model: modelName,
        actorType
      });
    }
    return this.agentExecutor.execute({
      id: 'cto-analysis',
      title: 'CTO Task Analysis',
      description: prompt
    }, provider, modelName);
  }

  /**
   * Read system prompt from mycompany directory
   */
  async getSystemPrompt() {
    try {
      const content = await fs.readFile(this.systemPromptPath, 'utf-8');
      let soul = '';
      let user = '';
      try {
        soul = await fs.readFile(path.resolve(__dirname, '..', '..', 'mycompany', 'cto', 'SOUL.md'), 'utf-8');
      } catch {}
      try {
        user = await fs.readFile(path.resolve(__dirname, '..', '..', 'mycompany', 'cto', 'USER.md'), 'utf-8');
      } catch {}
      return [soul, user, content].filter(Boolean).join('\n\n');
    } catch (error) {
      console.warn('[CTO] Could not read system prompt from file, using fallback');
      return this._getFallbackPrompt();
    }
  }

  /**
   * Read context files from mycompany directory
   */
  async getCompanyContext() {
    try {
      const context = {
        organization: '',
        employees: '',
        teams: '',
        projects: ''
      };

      // Read organization overview
      try {
        context.organization = await fs.readFile(
          path.join(this.companyDir, 'organization', 'OVERVIEW.md'),
          'utf-8'
        );
      } catch (e) { /* skip if missing */ }

      // Read employees index
      try {
        context.employees = await fs.readFile(
          path.join(this.companyDir, 'employees', 'INDEX.md'),
          'utf-8'
        );
      } catch (e) { /* skip if missing */ }

      // Read teams overview
      try {
        context.teams = await fs.readFile(
          path.join(this.companyDir, 'organization', 'TEAMS.md'),
          'utf-8'
        );
      } catch (e) { /* skip if missing */ }

      return context;
    } catch (error) {
      console.warn('[CTO] Could not read company context:', error.message);
      return {};
    }
  }

  async getPreviousAttempts(task, context = {}) {
    const historyPath = path.resolve(__dirname, '..', '..', 'mycompany', 'cto', 'TASK_HISTORY.md');
    const teamId = context.team?.id || null;
    const teamName = context.team?.name || null;
    try {
      const content = await fs.readFile(historyPath, 'utf-8');
      const lines = content.split('\n');
      const records = [];
      for (const line of lines) {
        if (!line.startsWith('| ') || line.includes('taskId')) continue;
        const parts = line.split('|').map(s => s.trim()).filter(Boolean);
        if (parts.length < 6) continue;
        records.push({
          taskId: parts[0],
          title: parts[1],
          type: parts[2],
          provider: parts[3],
          outcome: parts[4],
          reason: parts[5],
          timestamp: parts[6] || '',
          recTeamId: parts[7] || '',
          recTeamName: parts[8] || ''
        });
      }

      const title = (task.title || '').toLowerCase();
      const matches = records.filter(r => {
        const rTitle = (r.title || '').toLowerCase();
        const titleMatch = title.includes(rTitle) || rTitle.includes(title);
        if (!titleMatch) return false;
        if (teamId || teamName) {
          const idMatch = teamId && r.recTeamId && r.recTeamId === teamId;
          const nameMatch = teamName && r.recTeamName && r.recTeamName.toLowerCase() === teamName.toLowerCase();
          return idMatch || nameMatch;
        }
        return false;
      });

      return matches.slice(-5);
    } catch (error) {
      return [];
    }
  }

  _getFallbackPrompt() {
    return `
You are the Chief Technology Officer (CTO). You design solutions and delegate execution to Team Leads.
Analyze tasks and return JSON with: action (execute/split/defer), reasoning, complexity, and subtasks if splitting.
    `.trim();
  }

  /**
   * Use AI to analyze task complexity and recommend action
   * @param {object} task - Full task object with all metadata
   * @param {object} context - { availableProviders, resourceStatus, historicalData, employees, deadline }
   * @returns {object} { action, reasoning, confidence, complexity }
   */
  async analyzeTask(task, context = {}) {
    const { title, description, id, created_at, due_date, scheduled_date, scheduled_time, project_id, team_id } = task;

    // Select best AI model for this analysis
    const modelSelection = this.modelSelector.selectModel('high');

    if (!modelSelection.model) {
      console.log('[CTO] No AI model available for decision-making. Falling back to rule-based.');
      return null; // Will use fallback logic
    }

    if (modelSelection.provider === 'gemini') {
      console.log('[CTO] Using gemini for task analysis...');
    } else {
      console.log(`[CTO] Using ${modelSelection.model} for task analysis...`);
    }

    // Read system prompt from file
    const systemPrompt = await this.getSystemPrompt();

    // Read company context from mycompany directory
    const companyContext = await this.getCompanyContext();

    // Calculate time context
    const now = new Date();
    const createdDate = created_at ? new Date(created_at) : now;
    const deadlineDate = due_date ? new Date(due_date) : context.deadline;
    const scheduledDateTime = scheduled_date && scheduled_time
      ? new Date(`${scheduled_date}T${scheduled_time}`)
      : null;

    const timeUntilDeadline = deadlineDate
      ? Math.round((deadlineDate - now) / (1000 * 60 * 60)) // hours
      : null;

    const previousAttempts = await this.getPreviousAttempts(task, context);
    const previousAttemptsBlock = previousAttempts.length > 0
      ? previousAttempts.map(a => `- ${a.timestamp} | ${a.outcome} | ${a.provider} | ${a.reason}`).join('\n')
      : 'None found for this team/task.';

    const workloadLine = context.activeTasksUntilDeadline === null || context.activeTasksUntilDeadline === undefined
      ? 'Unknown'
      : String(context.activeTasksUntilDeadline);

    const costUsage = context.costUsage || {};
    const costLine24h = costUsage.last24h?.total_cost_usd != null
      ? `$${costUsage.last24h.total_cost_usd.toFixed(2)}`
      : 'Unknown';
    const costLine7d = costUsage.last7d?.total_cost_usd != null
      ? `$${costUsage.last7d.total_cost_usd.toFixed(2)}`
      : 'Unknown';
    const costLineTask = costUsage.taskLast7d?.total_cost_usd != null
      ? `$${costUsage.taskLast7d.total_cost_usd.toFixed(2)}`
      : 'Unknown';
    const budgetWarnings = costUsage.budgetStatus?.warnings?.length
      ? costUsage.budgetStatus.warnings.join(' | ')
      : 'None';

    const prompt = `
${systemPrompt}

---

## Task Details

**Title:** ${title}
**Description:** ${description || 'No description provided'}
**Task ID:** ${id}
**Created:** ${createdDate.toISOString()}
${deadlineDate ? `**Deadline:** ${deadlineDate.toISOString()} (${timeUntilDeadline} hours from now)` : ''}
${scheduledDateTime ? `**Scheduled For:** ${scheduledDateTime.toISOString()}` : ''}
**Project ID:** ${project_id || 'None'}
**Team ID:** ${team_id || 'None'}
**Priority:** ${task.priority || 'medium'}

---

## Active Workload

**Active tasks due on or before this deadline:** ${workloadLine}

---

## Cost & Usage (Soft Budget Signals)

**Team spend last 24h:** ${costLine24h}
**Project spend last 7d:** ${costLine7d}
**Task spend last 7d:** ${costLineTask}
**Budget warnings:** ${budgetWarnings}
**Soft budget rule:** If budget warnings are present, prefer the lowest-cost viable action (enhance or defer) unless splitting is necessary to meet the deadline.
**Soft budget rule:** If budget warnings are present, prefer the lowest-cost viable action (enhance or defer) unless splitting is necessary to meet the deadline.

---

## Company Context

### Organization Overview
${companyContext.organization ? companyContext.organization.substring(0, 1000) : 'Not available'}

### Teams Structure
${companyContext.teams ? companyContext.teams.substring(0, 1000) : 'Not available'}

---

## Previous Attempts (Same Team)

${previousAttemptsBlock}

---

## Your Decision

Analyze this task using the instructions from the system prompt above.
When splitting tasks, calculate realistic schedules for each subtask based on the deadline.
All subtasks must inherit project_id: ${project_id || 'null'} and team_id: ${team_id || 'null'}.
    `.trim();

    try {
      // Call AI model for analysis
      const result = await this._executeWithProvider(prompt, modelSelection.provider, modelSelection.model, 'cto');

      if (!result.success || !result.output) {
        console.log('[CTO] AI analysis failed, falling back to rule-based');
        return null;
      }

      // Parse AI response
      const analysis = await this._parseAIResponse(result.output, 'decision');

      if (analysis) {
        console.log(`[CTO] AI Decision: ${analysis.action} (confidence: ${analysis.confidence}%)`);
        console.log(`[CTO] Reasoning: ${analysis.reasoning}`);

        if (this.usageTracker) {
          const usageEvent = this.usageTracker.buildExecutionUsageEvent(
            task,
            'cto',
            modelSelection.provider,
            modelSelection.model,
            {
              cost: result.cost,
              tokens_used: result.tokens_used,
              duration: result.duration,
              toolsUsed: result.toolsUsed,
              sessionId: result.sessionId
            }
          );
          await this.usageTracker.recordEvent(usageEvent);
        }
      }

      return analysis;

    } catch (error) {
      console.error('[CTO] AI analysis error:', error.message);
      return null; // Fallback to rule-based
    }
  }

  async analyzeTaskWithProvider(task, context = {}, provider = 'gemini', modelName = null) {
    if (!provider) return null;
    const { title, description } = task;
    const systemPrompt = await this.getSystemPrompt();
    const companyContext = await this.getCompanyContext();
    const now = new Date();
    const createdDate = task.created_at ? new Date(task.created_at) : now;
    const deadlineDate = task.due_date ? new Date(task.due_date) : context.deadline;
    const scheduledDateTime = task.scheduled_date && task.scheduled_time
      ? new Date(`${task.scheduled_date}T${task.scheduled_time}`)
      : null;

    const prompt = `
${systemPrompt}

---
## Task Details
**Title:** ${title}
**Description:** ${description || 'No description provided'}
**Task ID:** ${task.id}
**Created:** ${createdDate.toISOString()}
${deadlineDate ? `**Deadline:** ${deadlineDate.toISOString()}` : ''}
${scheduledDateTime ? `**Scheduled For:** ${scheduledDateTime.toISOString()}` : ''}
**Project ID:** ${task.project_id || 'None'}
**Team ID:** ${task.team_id || 'None'}
**Priority:** ${task.priority || 'medium'}

---
## Active Workload
**Active tasks due on or before this deadline:** ${context.activeTasksUntilDeadline ?? 'Unknown'}

---
## Company Context
${companyContext.organization ? companyContext.organization.substring(0, 1000) : 'Not available'}
${companyContext.teams ? companyContext.teams.substring(0, 1000) : 'Not available'}

---
Return strictly JSON (no markdown).
If action is "enhance", include "enhanced_description" with the full Team Lead-ready task description.`.trim();

    try {
      const result = await this._executeWithProvider(prompt, provider, modelName, 'cto');

      if (!result.success || !result.output) {
        console.log('[CTO] AI analysis failed, falling back to rule-based');
        return null;
      }

      const analysis = await this._parseAIResponse(result.output, 'decision');
      if (analysis) {
        analysis._usage = {
          provider,
          model: modelName,
          usage: null,
          modelUsage: null,
          raw: { tokens_used: result.tokens_used, cost: result.cost }
        };
      }
      return analysis;
    } catch (err) {
      console.error('[CTO] AI analysis error:', err.message);
      return null;
    }
  }

  async analyzeTaskWithClaudeApi(task, context = {}, modelName = 'claude-opus-4-5-20251101') {
    if (!this.claudeClient) return null;
    const systemPrompt = await this.getSystemPrompt();
    const companyContext = await this.getCompanyContext();
    const now = new Date();
    const createdDate = task.created_at ? new Date(task.created_at) : now;
    const deadlineDate = task.due_date ? new Date(task.due_date) : context.deadline;
    const scheduledDateTime = task.scheduled_date && task.scheduled_time
      ? new Date(`${task.scheduled_date}T${task.scheduled_time}`)
      : null;
    const costUsage = context.costUsage || {};
    const costLine24h = costUsage.last24h?.total_cost_usd != null
      ? `$${costUsage.last24h.total_cost_usd.toFixed(2)}`
      : 'Unknown';
    const costLine7d = costUsage.last7d?.total_cost_usd != null
      ? `$${costUsage.last7d.total_cost_usd.toFixed(2)}`
      : 'Unknown';
    const costLineTask = costUsage.taskLast7d?.total_cost_usd != null
      ? `$${costUsage.taskLast7d.total_cost_usd.toFixed(2)}`
      : 'Unknown';
    const budgetWarnings = costUsage.budgetStatus?.warnings?.length
      ? costUsage.budgetStatus.warnings.join(' | ')
      : 'None';

    const prompt = `
${systemPrompt}

---
## Task Details
**Title:** ${task.title}
**Description:** ${task.description || 'No description provided'}
**Task ID:** ${task.id}
**Created:** ${createdDate.toISOString()}
${deadlineDate ? `**Deadline:** ${deadlineDate.toISOString()}` : ''}
${scheduledDateTime ? `**Scheduled For:** ${scheduledDateTime.toISOString()}` : ''}
**Project ID:** ${task.project_id || 'None'}
**Team ID:** ${task.team_id || 'None'}
**Priority:** ${task.priority || 'medium'}

---
## Active Workload
**Active tasks due on or before this deadline:** ${context.activeTasksUntilDeadline ?? 'Unknown'}

---
## Cost & Usage (Soft Budget Signals)
**Team spend last 24h:** ${costLine24h}
**Project spend last 7d:** ${costLine7d}
**Task spend last 7d:** ${costLineTask}
**Budget warnings:** ${budgetWarnings}

---
## Company Context
${companyContext.organization ? companyContext.organization.substring(0, 1000) : 'Not available'}
${companyContext.teams ? companyContext.teams.substring(0, 1000) : 'Not available'}

---
Return strictly JSON (no markdown).
If action is "enhance", include "enhanced_description" with the full Team Lead-ready task description.`.trim();

    const result = await this.claudeClient.completeJson({
      model: modelName,
      system: 'You are a CTO. Output valid JSON only.',
      prompt,
      thinking: { type: 'enabled', budget_tokens: 4000 }
    });
    const raw = result?.text || '';
    const analysis = this._parseAIResponse(raw, 'decision');
    if (analysis) {
      analysis._usage = {
        provider: 'claude',
        model: modelName,
        usage: result?.usage || null,
        modelUsage: result?.modelUsage || null,
        raw: result?.raw || null
      };
    }
    return analysis;
  }

  async analyzeClarificationWithClaudeApi(task, context = {}, modelName = 'claude-opus-4-5-20251101') {
    if (!this.claudeClient) return null;
    const prompt = `
You are the CTO. Determine if you can provide clarification for the blocked task.
Return strict JSON:
{
  "canAnswer": true|false,
  "answer": "clarification to give team lead",
  "escalationNote": "why CEO attention is required"
}

Task: ${task.title}
Description: ${task.description || ''}
History: ${(context.history || []).map(h => h.content).join('\n')}
`.trim();

    const result = await this.claudeClient.completeJson({
      model: modelName,
      system: 'Return JSON only.',
      prompt,
      thinking: { type: 'enabled', budget_tokens: 4000 }
    });
    const raw = result?.text || '';
    const analysis = this._parseAIResponse(raw, 'clarification');
    if (analysis) {
      analysis._usage = {
        provider: 'claude',
        model: modelName,
        usage: result?.usage || null,
        modelUsage: result?.modelUsage || null,
        raw: result?.raw || null
      };
    }
    return analysis;
  }

  async analyzeFailureWithClaudeApi(task, context = {}, modelName = 'claude-opus-4-5-20251101') {
    if (!this.claudeClient) return null;
    const prompt = `
You are the CTO. Decide whether to retry execution or block for CEO attention.
Return strict JSON:
{
  "action": "retry_execute" | "block_ceo",
  "reasoning": "why",
  "comment": "comment to post"
}

Task: ${task.title}
Description: ${task.description || ''}
Last Output: ${context.lastOutput || ''}
`.trim();

    const result = await this.claudeClient.completeJson({
      model: modelName,
      system: 'Return JSON only.',
      prompt,
      thinking: { type: 'enabled', budget_tokens: 4000 }
    });
    const raw = result?.text || '';
    const analysis = this._parseAIResponse(raw, 'failure');
    if (analysis) {
      analysis._usage = {
        provider: 'claude',
        model: modelName,
        usage: result?.usage || null,
        modelUsage: result?.modelUsage || null,
        raw: result?.raw || null
      };
    }
    return analysis;
  }

  async analyzeTaskWithOpenAI(task, context = {}, modelName = 'gpt-5.2-pro') {
    if (!this.openaiSdkExecutor) return null;
    const systemPrompt = await this.getSystemPrompt();
    const companyContext = await this.getCompanyContext();
    const now = new Date();
    const createdDate = task.created_at ? new Date(task.created_at) : now;
    const deadlineDate = task.due_date ? new Date(task.due_date) : context.deadline;
    const scheduledDateTime = task.scheduled_date && task.scheduled_time
      ? new Date(`${task.scheduled_date}T${task.scheduled_time}`)
      : null;

    const prompt = `
${systemPrompt}

---
## Task Details
**Title:** ${task.title}
**Description:** ${task.description || 'No description provided'}
**Task ID:** ${task.id}
**Created:** ${createdDate.toISOString()}
${deadlineDate ? `**Deadline:** ${deadlineDate.toISOString()}` : ''}
${scheduledDateTime ? `**Scheduled For:** ${scheduledDateTime.toISOString()}` : ''}
**Project ID:** ${task.project_id || 'None'}
**Team ID:** ${task.team_id || 'None'}
**Priority:** ${task.priority || 'medium'}

---
## Active Workload
**Active tasks due on or before this deadline:** ${context.activeTasksUntilDeadline ?? 'Unknown'}

---
## Cost & Usage (Soft Budget Signals)
**Team spend last 24h:** ${context.costUsage?.last24h?.total_cost_usd ?? 'Unknown'}
**Project spend last 7d:** ${context.costUsage?.last7d?.total_cost_usd ?? 'Unknown'}
**Task spend last 7d:** ${context.costUsage?.taskLast7d?.total_cost_usd ?? 'Unknown'}
**Budget warnings:** ${(context.costUsage?.budgetStatus?.warnings || []).join(' | ') || 'None'}
**Soft budget rule:** If budget warnings are present, prefer the lowest-cost viable action (enhance or defer) unless splitting is necessary to meet the deadline.

---
## Company Context
${companyContext.organization ? companyContext.organization.substring(0, 1000) : 'Not available'}
${companyContext.teams ? companyContext.teams.substring(0, 1000) : 'Not available'}

---
Return strictly JSON (no markdown).
If action is "enhance", include "enhanced_description" with the full Team Lead-ready task description.`.trim();

    try {
      const result = await this.openaiSdkExecutor.executePrompt(prompt, {
        projectDir: process.cwd(),
        identity: { name: 'CTO', system_prompt: systemPrompt },
        employees: context.employees || [],
        model: modelName,
        actorType: 'cto'
      });

      const text = result?.output || '';
      const analysis = this._parseAIResponse(text.trim(), 'decision');
      if (analysis) {
        analysis._usage = {
          provider: 'openai',
          model: modelName,
          usage: result.usage || null,
          modelUsage: null,
          raw: result.rawUsage || null
        };
      }
      return analysis;
    } catch (err) {
      console.error('[CTO] OpenAI SDK analysis error:', err.message);
      return null;
    }
  }

  async analyzeClarificationWithOpenAI(task, context = {}, modelName = 'gpt-5.2-pro') {
    if (!this.openaiSdkExecutor) return null;
    const prompt = `
You are the CTO. Determine if you can provide clarification for the blocked task.
Return strict JSON:
{
  "canAnswer": true|false,
  "answer": "clarification to give team lead",
  "escalationNote": "why CEO attention is required"
}

Task: ${task.title}
Description: ${task.description || ''}
History: ${(context.history || []).map(h => h.content).join('\n')}
`.trim();

    try {
      const result = await this.openaiSdkExecutor.executePrompt(prompt, {
        projectDir: process.cwd(),
        identity: { name: 'CTO' },
        employees: context.employees || [],
        model: modelName,
        actorType: 'cto'
      });
      const text = result?.output || '';
      const analysis = this._parseAIResponse(text.trim(), 'clarification');
      if (analysis) {
        analysis._usage = {
          provider: 'openai',
          model: modelName,
          usage: result.usage || null,
          modelUsage: null,
          raw: result.rawUsage || null
        };
      }
      return analysis;
    } catch (err) {
      console.error('[CTO] OpenAI SDK clarification error:', err.message);
      return null;
    }
  }

  async analyzeFailureWithOpenAI(task, context = {}, modelName = 'gpt-5.2-pro') {
    if (!this.openaiSdkExecutor) return null;
    const prompt = `
You are the CTO. Decide whether to retry execution or block for CEO attention.
Return strict JSON:
{
  "action": "retry_execute" | "block_ceo",
  "reasoning": "why",
  "comment": "comment to post"
}

Task: ${task.title}
Description: ${task.description || ''}
Last Output: ${context.lastOutput || ''}
`.trim();

    try {
      const result = await this.openaiSdkExecutor.executePrompt(prompt, {
        projectDir: process.cwd(),
        identity: { name: 'CTO' },
        employees: context.employees || [],
        model: modelName,
        actorType: 'cto'
      });
      const text = result?.output || '';
      const analysis = this._parseAIResponse(text.trim(), 'failure');
      if (analysis) {
        analysis._usage = {
          provider: 'openai',
          model: modelName,
          usage: result.usage || null,
          modelUsage: null,
          raw: result.rawUsage || null
        };
      }
      return analysis;
    } catch (err) {
      console.error('[CTO] OpenAI SDK failure analysis error:', err.message);
      return null;
    }
  }

  /**
   * Use AI to verify task completion
   */
  async verifyCompletion(task, result, modelName = null) {
    if (!result?.output || result.output.length < 10) {
      return { passed: false, missing: 'No output produced', score: 0 };
    }

    // Quick checks first (no AI needed)
    const hasReport = result.output.includes('---COMPLETION REPORT---');
    if (hasReport && result.output.length > 200) {
      return { passed: true, missing: '', score: 90 };
    }

    // Use AI for verification if output is ambiguous
    const modelSelection = modelName
      ? { model: modelName, provider: this._getProviderFromModel(modelName) }
      : this.modelSelector.selectModel('simple');

    if (!modelSelection.model) {
      // Fallback to simple heuristics
      if (result.success && result.output.length > 5000) {
        return { passed: true, missing: '', score: 75 };
      }
      return { passed: false, missing: 'Ambiguous output, no AI available', score: 40 };
    }

    if (modelSelection.provider === 'gemini') {
      console.log('[CTO] Using gemini for verification...');
    } else {
      console.log(`[CTO] Using ${modelSelection.model} for verification...`);
    }

    const prompt = `You are a CTO verifying if a task was completed successfully.

**Original Task:** ${task.title}
**Description:** ${task.description?.substring(0, 500) || 'No description'}

**Agent Output:**
${result.output.substring(0, 10000)}

**Your job:**
Determine if the task was completed successfully and identify what's missing (if anything).

Respond in JSON format:
{
  "passed": true/false,
  "score": 0-100,
  "missing": "What's missing or incomplete (if passed=false)",
  "strengths": ["What", "was", "done", "well"],
  "concerns": ["Any", "issues", "or", "concerns"]
}`;

    try {
      const verificationResult = modelSelection.provider === 'openai' && this.openaiSdkExecutor
        ? await this.openaiSdkExecutor.executePrompt(prompt, {
            projectDir: process.cwd(),
            identity: { name: 'CTO' },
            employees: [],
            model: modelSelection.model,
            actorType: 'cto'
          })
        : await this._executeWithProvider(prompt, modelSelection.provider, modelSelection.model, 'cto');

      if (verificationResult.success && verificationResult.output) {
        const verification = await this._parseAIResponse(verificationResult.output, 'verification');

        if (verification) {
          console.log(`[CTO] Verification: ${verification.passed ? 'PASSED' : 'FAILED'} (score: ${verification.score})`);

          if (this.usageTracker) {
            const usageEvent = modelSelection.provider === 'openai' && verificationResult.usage
              ? this.usageTracker.buildOpenAIUsageEvent(
                  task,
                  'cto',
                  'openai',
                  modelSelection.model,
                  verificationResult.usage,
                  verificationResult.rawUsage
                )
              : this.usageTracker.buildExecutionUsageEvent(
                  task,
                  'cto',
                  modelSelection.provider,
                  modelSelection.model,
                  {
                    cost: verificationResult.cost,
                    tokens_used: verificationResult.tokens_used,
                    duration: verificationResult.duration,
                    toolsUsed: verificationResult.toolsUsed,
                    sessionId: verificationResult.sessionId
                  }
                );
            await this.usageTracker.recordEvent(usageEvent);
          }

          return verification;
        }
      }

      // Fallback
      return { passed: result.success, missing: '', score: 65 };

    } catch (error) {
      console.error('[CTO] Verification error:', error.message);
      return { passed: result.success, missing: '', score: 60 };
    }
  }

  /**
   * Generic method to analyze content with a custom prompt
   * Used for attachment distribution and other ad-hoc analyses
   */
  async analyzeWithPrompt(prompt, modelName = null, options = {}) {
    const modelSelection = modelName
      ? { model: modelName, provider: this._getProviderFromModel(modelName) }
      : this.modelSelector.selectModel('simple');

    if (!modelSelection.model) {
      console.warn('[CTO] No AI model available for prompt analysis');
      return null;
    }

    if (modelSelection.provider === 'gemini') {
      console.log('[CTO] Using gemini for custom analysis...');
    } else {
      console.log(`[CTO] Using ${modelSelection.model} for custom analysis...`);
    }

    try {
      const result = modelSelection.provider === 'openai' && this.openaiSdkExecutor
        ? await this.openaiSdkExecutor.executePrompt(prompt, {
            projectDir: process.cwd(),
            identity: { name: 'CTO' },
            employees: [],
            model: modelSelection.model,
            actorType: 'cto'
          })
        : await this._executeWithProvider(prompt, modelSelection.provider, modelSelection.model, 'cto');

      if (result.success && result.output) {
        const analysis = await this._parseAIResponse(result.output, options.schema || 'decision', options.systemPrompt);

        if (this.usageTracker) {
          const usageEvent = modelSelection.provider === 'openai' && result.usage
            ? this.usageTracker.buildOpenAIUsageEvent(
                { id: 'cto-ad-hoc', project_id: null, team_id: null },
                'cto',
                'openai',
                modelSelection.model,
                result.usage,
                result.rawUsage
              )
            : this.usageTracker.buildExecutionUsageEvent(
                { id: 'cto-ad-hoc', project_id: null, team_id: null },
                'cto',
                modelSelection.provider,
                modelSelection.model,
                {
                  cost: result.cost,
                  tokens_used: result.tokens_used,
                  duration: result.duration,
                  toolsUsed: result.toolsUsed,
                  sessionId: result.sessionId
                }
              );
          await this.usageTracker.recordEvent(usageEvent);
        }

        return analysis;
      }

      return null;

    } catch (error) {
      console.error('[CTO] Analysis error:', error.message);
      return null;
    }
  }

  /**
   * Parse AI JSON response using GPT-4o-mini
   */
  async _parseAIResponse(output, schema = 'decision', systemPrompt = null) {
    console.log('[CTO] Using GPT-4o-mini to extract JSON from AI output...');
    try {
      const direct = JSON.parse(output.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
      if (direct && typeof direct === 'object') return direct;
    } catch {}
    const extractorPrompt = systemPrompt || this._getExtractorSystemPrompt(schema);
    return await this._extractJsonWithGPT(output, extractorPrompt);
  }

  async _extractJsonWithGPT(messyOutput, systemPrompt) {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: systemPrompt
        }, {
          role: 'user',
          content: `Extract the JSON from this messy output:\n\n${messyOutput}`
        }],
        temperature: 0,
        max_tokens: 16000
      });

      const extracted = response.choices[0].message.content.trim();
      // Remove markdown code fences if GPT added them
      const cleaned = extracted.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      console.log('[CTO] GPT-4o-mini successfully extracted JSON');
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('[CTO] GPT-4o-mini extraction failed:', error.message);
      return null;
    }
  }

  _getExtractorSystemPrompt(schema) {
    if (schema === 'verification') {
      return [
        'You are a strict JSON extractor.',
        'Extract ONLY the single JSON object from the messy text.',
        'Return ONLY raw JSON, no markdown, no commentary.',
        'The JSON MUST include fields: passed, score, missing, strengths, concerns.',
        'passed must be true or false.',
        'score must be a number 0-100.',
        'strengths and concerns must be arrays.',
        'If multiple JSON objects exist, choose the one with the required fields.'
      ].join(' ');
    }
    if (schema === 'attachments') {
      return [
        'You are a strict JSON extractor.',
        'Extract ONLY the single JSON object from the messy text.',
        'Return ONLY raw JSON, no markdown, no commentary.',
        'The JSON MUST include fields: distribution and reasoning.',
        'distribution must map attachment indices (as strings) to arrays of subtask indices (numbers).',
        'reasoning must map attachment indices to short string explanations.',
        'If multiple JSON objects exist, choose the one with the required fields.'
      ].join(' ');
    }
    if (schema === 'clarification') {
      return [
        'You are a strict JSON extractor.',
        'Extract ONLY the single JSON object from the messy text.',
        'Return ONLY raw JSON, no markdown, no commentary.',
        'The JSON MUST include fields: canAnswer, answer, escalationNote.',
        'canAnswer must be true or false.',
        'If multiple JSON objects exist, choose the one with the required fields.'
      ].join(' ');
    }
    if (schema === 'failure') {
      return [
        'You are a strict JSON extractor.',
        'Extract ONLY the single JSON object from the messy text.',
        'Return ONLY raw JSON, no markdown, no commentary.',
        'The JSON MUST include fields: action, reasoning, comment.',
        'The action field MUST be exactly one of: retry_execute, block_ceo.',
        'If multiple JSON objects exist, choose the one with the required fields.'
      ].join(' ');
    }
    return [
      'You are a strict JSON extractor.',
      'Extract ONLY the single JSON object from the messy text.',
      'Return ONLY raw JSON, no markdown, no commentary.',
      'The JSON MUST include fields: action, reasoning, confidence.',
      'If present, include: complexity, strategy_note, subtasks, enhanced_description, estimatedMessages, recommendedProvider, critical_decision, critical_reason.',
      'The action field MUST be exactly one of: enhance, split, defer, execute, clarify, retry_execute, block_ceo, approve, request_changes.',
      'Preserve the action value verbatim from the source (do not reinterpret).',
      'Preserve all subtask objects exactly as they appear in the source, including every field and value.',
      'Do not summarize, reword, or drop any subtask fields.',
      'If there are multiple JSON objects, choose the one that contains the required fields.'
    ].join(' ');
  }

  _getProviderFromModel(modelName) {
    if (modelName.includes('gemini')) return 'gemini';
    if (modelName.includes('claude')) return 'claude';
    if (modelName.includes('gpt')) return 'openai';
    return 'claude';
  }
}

module.exports = AIDecisionEngine;
