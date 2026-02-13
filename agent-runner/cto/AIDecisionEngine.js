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
const os = require('os');
const OpenAI = require('openai');

class AIDecisionEngine {
  constructor(modelSelector, agentExecutor) {
    this.modelSelector = modelSelector;
    this.agentExecutor = agentExecutor;
    this.systemPromptPath = path.join(os.homedir(), 'mycompany', 'cto', 'SYSTEM_PROMPT.md');
    this.companyDir = path.join(os.homedir(), 'mycompany');
  }

  /**
   * Read system prompt from mycompany directory
   */
  async getSystemPrompt() {
    try {
      const content = await fs.readFile(this.systemPromptPath, 'utf-8');
      return content;
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
    const historyPath = path.join(os.homedir(), 'mycompany', 'cto', 'TASK_HISTORY.md');
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
      const result = await this.agentExecutor.execute({
        id: 'cto-analysis',
        title: 'CTO Task Analysis',
        description: prompt
      }, modelSelection.provider, modelSelection.model);

      if (!result.success || !result.output) {
        console.log('[CTO] AI analysis failed, falling back to rule-based');
        return null;
      }

      // Parse AI response
      const analysis = await this._parseAIResponse(result.output, 'decision');

      if (analysis) {
        console.log(`[CTO] AI Decision: ${analysis.action} (confidence: ${analysis.confidence}%)`);
        console.log(`[CTO] Reasoning: ${analysis.reasoning}`);

        // Record CTO usage
        this.modelSelector.resourceManager.trackCTOUsage(
          modelSelection.provider,
          result.messagesUsed || 1
        );
      }

      return analysis;

    } catch (error) {
      console.error('[CTO] AI analysis error:', error.message);
      return null; // Fallback to rule-based
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
      const verificationResult = await this.agentExecutor.execute({
        id: 'cto-verification',
        title: 'CTO Verification',
        description: prompt
      }, modelSelection.provider, modelSelection.model);

      if (verificationResult.success && verificationResult.output) {
        const verification = await this._parseAIResponse(verificationResult.output, 'verification');

        if (verification) {
          console.log(`[CTO] Verification: ${verification.passed ? 'PASSED' : 'FAILED'} (score: ${verification.score})`);

          this.modelSelector.resourceManager.trackCTOUsage(
            modelSelection.provider,
            verificationResult.messagesUsed || 1
          );

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
      const result = await this.agentExecutor.execute({
        id: 'cto-analysis',
        title: 'CTO Analysis',
        description: prompt
      }, modelSelection.provider, modelSelection.model);

      if (result.success && result.output) {
        const analysis = await this._parseAIResponse(result.output, options.schema || 'decision', options.systemPrompt);

        // Track usage
        this.modelSelector.resourceManager.trackCTOUsage(
          modelSelection.provider,
          result.messagesUsed || 1
        );

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
    return [
      'You are a strict JSON extractor.',
      'Extract ONLY the single JSON object from the messy text.',
      'Return ONLY raw JSON, no markdown, no commentary.',
      'The JSON MUST include fields: action, reasoning, complexity, confidence, strategy_note, subtasks.',
      'The action field MUST be exactly one of: split, execute, defer.',
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
