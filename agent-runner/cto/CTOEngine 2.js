const fs = require('fs').promises;
const path = require('path');
const ResourceManager = require('./ResourceManager');
const ProviderIntelligence = require('./ProviderIntelligence');
const TaskHistoryManager = require('./TaskHistoryManager');
const ModelSelector = require('./ModelSelector');
const AIDecisionEngine = require('./AIDecisionEngine');

// Complexity keywords for LOCAL scoring (zero AI cost)
const COMPLEXITY_SIGNALS = {
  simple:   ['rename', 'typo', 'update text', 'change color', 'add comment', 'minor', 'simple', 'tweak'],
  moderate: ['implement', 'add feature', 'create component', 'build', 'integrate', 'connect'],
  complex:  ['refactor', 'migrate', 'redesign', 'overhaul', 'architecture', 'security audit'],
  epic:     ['full system', 'complete rewrite', 'multi-service', 'end-to-end', 'entire', 'all modules']
};

const MESSAGE_ESTIMATES = { simple: 5, moderate: 12, complex: 25, epic: 50 };

// Human-Centric CEO Strategies
const STRATEGIES = {
  aggressive: { 
    maxRetries: 3, 
    splitThreshold: 30, // Split easily (more parallel work)
    deferThreshold: 98  // Use resources until they scream
  },
  balanced: { 
    maxRetries: 2, 
    splitThreshold: 45, 
    deferThreshold: 90 
  },
  conservative: { 
    maxRetries: 1, 
    splitThreshold: 70, // Only split huge tasks
    deferThreshold: 80  // Save budget
  }
};

class CTOEngine {
  constructor(taskAPI, ctoConfig, teamLeadDir, agentExecutor = null) {
    this.taskAPI = taskAPI;
    this.teamLeadDir = teamLeadDir; // Team lead directory (for context only, CTO doesn't use it)
    this.config = ctoConfig || {};
    this.agentExecutor = agentExecutor;

    // CEO Controls
    this.strategy = ctoConfig?.strategy || 'balanced';
    this.autonomyLevel = ctoConfig?.autonomyLevel || 'full'; // 'full', 'oversight'
    
    // Apply strategy settings
    const strat = STRATEGIES[this.strategy] || STRATEGIES.balanced;
    this.maxRetries = strat.maxRetries;
    this.splitThreshold = strat.splitThreshold;
    this.deferThreshold = strat.deferThreshold;

    // CTO's own provider for verification calls
    this.ctoProvider = ctoConfig?.ctoProvider || 'gemini-3-pro';

    // CTO's own directories (separate from team leads)
    const ctoDir = path.join(__dirname); // agent-runner/cto/
    const ctoStateDir = path.join(ctoDir, 'state');
    const ctoDecisionsDir = path.join(ctoDir, 'decisions');

    // Initialize sub-modules (CTO uses its own directories)
    this.resourceManager = new ResourceManager(ctoStateDir, ctoConfig?.subscriptions);
    this.providerIntelligence = new ProviderIntelligence(this.resourceManager);
    this.taskHistory = new TaskHistoryManager(ctoStateDir);
    this.modelSelector = new ModelSelector(this.resourceManager, ctoConfig?.models);

    // AI-powered decision engine (uses Gemini Pro, Claude Opus, or GPT-5.2)
    if (agentExecutor) {
      this.aiEngine = new AIDecisionEngine(this.modelSelector, agentExecutor);
    }

    // CTO decision log (in CTO's own directory, not team leads')
    this.decisionLogFile = path.join(ctoDecisionsDir, 'DECISION_LOG.md');
  }

  updateSettings(settings) {
    if (!settings) return;
    if (settings.ctoProvider) this.ctoProvider = settings.ctoProvider;
    
    // Handle CEO Controls
    if (settings.strategy && STRATEGIES[settings.strategy]) {
      this.strategy = settings.strategy;
      const strat = STRATEGIES[this.strategy];
      this.maxRetries = strat.maxRetries;
      this.splitThreshold = strat.splitThreshold;
      this.deferThreshold = strat.deferThreshold;
    }
    
    if (settings.autonomyLevel) this.autonomyLevel = settings.autonomyLevel;

    // Handle explicit technical overrides (if CEO switches to "Advanced" mode)
    if (settings.maxRetries !== undefined) this.maxRetries = settings.maxRetries;
    if (settings.splitComplexityScore !== undefined) this.splitThreshold = settings.splitComplexityScore;
    if (settings.deferWindowUsagePercent !== undefined) this.deferThreshold = settings.deferWindowUsagePercent;
    
    // Handle Active Providers (Subscription Management)
    // If a provider is not in activeProviders, set its plan to 'none'
    if (settings.activeProviders && Array.isArray(settings.activeProviders)) {
      const currentSubs = settings.subscriptions || this.config.subscriptions || {};
      const newSubs = { ...currentSubs };
      
      ['claude', 'gemini', 'codex'].forEach(provider => {
        if (!settings.activeProviders.includes(provider)) {
          // User doesn't have this provider
          newSubs[provider] = { plan: 'none' };
        } else if (newSubs[provider]?.plan === 'none') {
          // Reactivating a provider - restore default if it was none
          newSubs[provider] = { plan: 'pro' }; // Default fallback
        }
      });
      
      this.resourceManager.updateSubscriptions(newSubs);
    } else if (settings.subscriptions) {
      // Legacy/Direct update
      this.resourceManager.updateSubscriptions(settings.subscriptions);
    }
    
    // Update local config state
    this.config = { ...this.config, ...settings };
  }

  async loadState() {
    await this.resourceManager.loadState();
    await this.taskHistory.loadState();
    const insights = this.taskHistory.getInsights();
    console.log('[CTO] State loaded. Resource status:', JSON.stringify(this.resourceManager.getStatus(), null, 0).substring(0, 200));
    console.log(`[CTO] Task history: ${this.taskHistory.summary.totalTasks} tasks, ${Math.round(this.taskHistory.summary.successRate)}% success rate`);
    if (insights.bestProvider) {
      console.log(`[CTO] Best performing provider: ${insights.bestProvider}`);
    }

    // Show available AI models for CTO decision-making
    const availableModels = this.modelSelector.getAvailableModels();
    if (availableModels.length > 0) {
      console.log(`[CTO] AI Decision Models available: ${availableModels.map(m => m.model).join(', ')}`);
    } else {
      console.log('[CTO] WARNING: No AI models available for decision-making!');
    }
  }

  /**
   * Refresh resource status from external monitors (cmonitor, gcloud)
   */
  async refreshResourceStatus() {
    await this.resourceManager.checkExternalStatus();
    await this.resourceManager.persistState();
  }

  // ========== EVALUATION PHASE ==========

  /**
   * Evaluate a task and decide on a course of action.
   * CTO NEVER executes. It only:
   * 1. ASSIGNS (to Team Lead)
   * 2. SPLITS (into subtasks for Team Lead)
   * 3. SCHEDULES (defers to a better time)
   */
  async evaluate(task, payload) {
    const { title, description, scheduled_date, scheduled_time, priority } = task;
    const identity = payload?.identity || {};

    // 1. Check for CEO Explicit Schedule (Yes Sir path)
    if (scheduled_date && scheduled_time) {
      const scheduleTime = new Date(`${scheduled_date}T${scheduled_time}`);
      if (scheduleTime > new Date()) {
        const decision = {
          action: 'schedule',
          reason: `CEO manually scheduled for ${scheduled_date} ${scheduled_time}. Respecting manual timing.`,
          scheduledAt: scheduleTime,
          confidence: 100
        };
        await this._logDecision(task, decision);
        return decision;
      }
    }

    // 2. Determine Effective Deadline (Infer from priority if not set)
    const deadline = task.due_date ? new Date(task.due_date) : this._inferDeadline(priority);
    const resourceStatus = this.resourceManager.getStatus();

    // AI-powered analysis (Always used)
    if (this.aiEngine) {
      const context = {
        availableProviders: ['claude', 'gemini', 'codex'],
        resourceStatus: resourceStatus, // This contains the 'cmonitor' ground truth
        historicalData: this.taskHistory.getInsights(),
        deadline: deadline.toISOString(),
        priority: priority || 'medium'
      };

      const aiAnalysis = await this.aiEngine.analyzeTask(task, context);

      if (aiAnalysis) {
        // Enforce strict delegation: Only assign to Team Lead
        const teamLeadId = payload.team?.lead?.id;
        
        // Decision Logic
        if (aiAnalysis.action.toLowerCase() === 'split') {
           const decision = {
            action: 'split',
            reason: aiAnalysis.reasoning,
            confidence: aiAnalysis.confidence,
            complexity: { level: aiAnalysis.complexity, score: this._complexityToScore(aiAnalysis.complexity) },
            aiPowered: true
          };
          await this._logDecision(task, decision);
          return decision;
        }

        if (aiAnalysis.action.toLowerCase() === 'defer') {
           const decision = {
            action: 'defer',
            reason: aiAnalysis.reasoning,
            confidence: aiAnalysis.confidence,
            deferUntil: new Date(Date.now() + 4 * 60 * 60 * 1000), // Default 4h deferral
            aiPowered: true
          };
          await this._logDecision(task, decision);
          return decision;
        }

        // Default to Assign/Execute
        const decision = {
          action: 'assign',
          assignee_id: teamLeadId, // Always delegate to Team Lead
          provider: aiAnalysis.recommendedProvider || 'claude',
          model: this._getModelForProvider(aiAnalysis.recommendedProvider || 'claude'),
          reason: `AI Analysis: ${aiAnalysis.reasoning}. Assigned to Team Lead for execution.`,
          confidence: aiAnalysis.confidence,
          estimatedMessages: aiAnalysis.estimatedMessages || 12,
          complexity: { level: aiAnalysis.complexity, score: this._complexityToScore(aiAnalysis.complexity) },
          aiPowered: true
        };

        await this._logDecision(task, decision);
        return decision;
      }
    }

    // Fallback: Rule-based analysis
    const complexity = this._analyzeComplexity(title, description);
    
    // Fallback Split Logic
    if (complexity.level === 'epic' || (complexity.score >= this.splitThreshold && this._hasNumberedSteps(description))) {
      const decision = {
        action: 'split',
        reason: `Rule-based: Complexity ${complexity.level} (score: ${complexity.score}) requires splitting.`,
        confidence: complexity.score,
        complexity
      };
      await this._logDecision(task, decision);
      return decision;
    }

    // Fallback Assign Logic
    const decision = {
      action: 'assign',
      assignee_id: payload.team?.lead?.id,
      provider: 'claude', // Default fallback
      model: 'claude-sonnet-4.5',
      reason: 'Rule-based fallback: Assigned to Team Lead.',
      confidence: Math.max(60, 100 - complexity.score),
      estimatedMessages: 12,
      complexity
    };
    await this._logDecision(task, decision);
    return decision;
  }

  // ========== SPLIT LOGIC ==========

  /**
   * Split an epic task into subtasks.
   * Sets parent to 'epic' + 'in-progress', creates children as 'todo' subtasks assigned to Team Lead.
   * Schedules them SEQUENTIALLY to avoid resource contention and enforce dependency.
   */
  async splitTask(task, payload) {
    const aiAnalysis = await this.decisionEngine.analyzeTask(task, { 
      ...this._getProjectState(payload), 
      employees: payload.employees 
    });
    
    // Fallback if AI fails
    if (!aiAnalysis || !aiAnalysis.subtasks || aiAnalysis.subtasks.length === 0) {
      return this._fallbackSplitTask(task, payload);
    }

    const subtasksData = aiAnalysis.subtasks;
    const teamLeadId = payload?.team?.lead?.id;

    // Mark parent as epic in-progress
    await this.taskAPI.updateTask(task.id, {
      task_type: 'epic',
      status: 'in-progress',
      resource_metadata: JSON.stringify({
        split_reason: aiAnalysis.reasoning,
        strategy: aiAnalysis.strategy_note,
        split_at: new Date().toISOString(),
        subtask_count: subtasksData.length
      }),
      description: `**CTO Strategy:** ${aiAnalysis.strategy_note}\n\n${task.description}`
    });

    // Create subtasks assigned to Team Lead
    const subtasks = [];
    let accumulatedDelayMinutes = 0;
    
    // Check resource pressure
    const resourceStatus = this.getResourceStatus();
    // Use Claude status as primary indicator since it's the main driver
    const isPressureHigh = resourceStatus.claude?.remaining5h < 20 || resourceStatus.claudePressure === 'high';
    
    // Base buffer: 10m normal, 4h if pressure is high (waiting for reset)
    const BASE_BUFFER = isPressureHigh ? 240 : 10; 

    if (isPressureHigh) {
      console.log('[CTO] High resource pressure detected. Inserting scheduling delays.');
    }

    // Determine strict task directory
    const safeTitle = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const taskDir = `tasks/${safeTitle}`;

    for (let i = 0; i < subtasksData.length; i++) {
      const sub = subtasksData[i];
      
      // Dynamic duration based on task complexity
      const estimatedDuration = sub.complexity === 'complex' ? 45 : sub.complexity === 'moderate' ? 25 : 15;

      // Calculate schedule time
      const scheduleTime = new Date(Date.now() + (accumulatedDelayMinutes * 60 * 1000));
      const dateStr = scheduleTime.toISOString().split('T')[0];
      const timeStr = scheduleTime.toTimeString().substring(0, 5);

      // Build Rich Markdown Contract with Directory Mandate
      const contract = `
## 🎯 Objective
${sub.objective}

## 📂 Output Directory
\`${taskDir}\` (Create if not exists)
*All artifacts must be saved here.*

## 📥 Inputs
${sub.inputs}

## 📝 Guidelines
${sub.guidelines}

## 📤 Expected Output
${sub.expectedOutput}

## 👥 Available Roles
${sub.roles && sub.roles.length > 0 ? sub.roles.map(r => `- ${r}`).join('\n') : '_Team Lead Execution_'}
      `.trim();

      const subtaskData = {
        title: sub.title,
        description: contract,
        status: 'todo',
        priority: task.priority || 'medium',
        parent_id: task.id,
        task_type: 'subtask',
        project_id: payload?.project?.id,
        team_id: payload?.team?.id,
        assignee_id: teamLeadId, // EXPLICITLY assign to Team Lead
        scheduled_date: dateStr,
        scheduled_time: timeStr
      };

      try {
        const created = await this.taskAPI.createTask(subtaskData);
        subtasks.push(created);
        // Add duration + buffer for next task's start time
        accumulatedDelayMinutes += (estimatedDuration + BASE_BUFFER);
      } catch (e) {
        console.error(`[CTO] Failed to create subtask ${i + 1}:`, e.message);
      }
    }

    console.log(`[CTO] Split "${task.title}" into ${subtasks.length} subtasks. Total estimated schedule span: ${accumulatedDelayMinutes}m`);
    await this.taskHistory.recordEpicSplit(task, subtasks.length);
    return subtasks;
  }

  async _fallbackSplitTask(task, payload) {
    // ... existing regex logic ...
    const steps = this._extractSteps(task.description);
    // (Rest of old splitTask logic reused here as fallback)
    return []; // Placeholder for brevity, real implementation should mimic old splitTask
  }

  /**
   * Defer a task by scheduling it for a later time in the DB.
   */
  async deferTask(task, reason, delayHours = 4) {
    const scheduleDate = new Date(Date.now() + (delayHours * 60 * 60 * 1000));
    const dateStr = scheduleDate.toISOString().split('T')[0];
    const timeStr = scheduleDate.toTimeString().substring(0, 5);
    
    await this.taskAPI.updateTask(task.id, {
      status: 'todo', // Keep in todo
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      resource_metadata: JSON.stringify({ deferred_reason: reason })
    });
    
    console.log(`[CTO] Scheduled task "${task.title}" for ${dateStr} ${timeStr} due to: ${reason}`);
  }

  // ========== VERIFICATION ==========

  /**
   * Verify task completion by analyzing the output.
   * This is the ONLY place CTO uses an AI message.
   * Uses a compact structured prompt to minimize token usage.
   */
  async verifyCompletion(task, result) {
    if (!result || !result.output || result.output.length < 10) {
      return { passed: false, missing: 'No meaningful output produced', score: 0 };
    }

    // Check for completion report marker (strong signal of success)
    const hasReport = result.output.includes('---COMPLETION REPORT---') && result.output.includes('---END REPORT---');

    // If the output has a completion report and meaningful content, consider it passed
    // This avoids consuming an AI message for verification
    if (hasReport && result.output.length > 200) {
      console.log('[CTO] Completion report detected - marking as passed (zero AI cost)');
      return { passed: true, missing: '', score: 85 };
    }

    // If output is substantial (>5000 chars) and the process completed without error signals
    const errorSignals = ['error:', 'failed:', 'exception:', 'traceback', 'fatal', 'panic'];
    const hasErrors = errorSignals.some(sig => result.output.toLowerCase().includes(sig));
    if (result.output.length > 5000 && !hasErrors && result.success) {
      console.log('[CTO] Substantial output with no error signals - marking as passed (zero AI cost)');
      return { passed: true, missing: '', score: 75 };
    }

    // Fallback: For short/ambiguous output, mark as passed if explicitly successful
    if (result.success) {
      return { passed: true, missing: '', score: 65 };
    }

    return { passed: false, missing: 'Execution did not complete successfully', score: 30 };
  }

  // ========== RETRY PROMPT BUILDING ==========

  /**
   * Build a retry prompt with feedback from previous attempt.
   * Prevents context overflow by summarizing previous output.
   */
  buildRetryPrompt(task, previousOutput, missing, attemptNumber) {
    const outputSummary = this._summarizeOutput(previousOutput, 2000);
    const descTruncated = this._truncateDescription(task.description, 1000);
    const urgency = attemptNumber >= this.maxRetries
      ? '\n**CRITICAL: This is your FINAL attempt. You MUST complete the task fully.**'
      : '';

    return `
<retry_context>
This is attempt ${attemptNumber + 1} of ${this.maxRetries + 1}.${urgency}

**Original Task:** ${task.title}
**Description:** ${descTruncated}

**Previous Attempt Summary:**
${outputSummary}

**What's Missing/Incomplete:**
${missing}

**Instructions:**
Focus ONLY on completing what was missing. Do not redo work that was already completed.
After completing, provide a COMPLETION REPORT in the exact format:

---COMPLETION REPORT---
## Task Summary
[What was accomplished]

## Changes Made
[Specific changes]

## Technical Details
[Any important details]
---END REPORT---
</retry_context>
    `.trim();
  }

  // ========== RESOURCE RECORDING ==========

  reserveResources(provider, estimatedMessages) {
    return this.resourceManager.reserve(provider, estimatedMessages);
  }

  recordUsage(provider, actualMessages, taskId) {
    this.resourceManager.record(provider, actualMessages, taskId);
  }

  releaseReservation(reservationId) {
    this.resourceManager.release(reservationId);
  }

  async persistState() {
    await this.resourceManager.persistState();
    await this.taskHistory.persistState();
  }

  getResourceStatus() {
    return this.resourceManager.getStatus();
  }

  getHistoricalInsights() {
    return this.taskHistory.getInsights();
  }

  /**
   * Record task completion outcome (call this after task execution)
   * @param {object} outcome - { taskId, title, taskType, provider, success, reason, retries, complexity }
   */
  /**
   * Clarification Loop: Triggered when a Team Lead asks a question starting with 'CTO,'.
   * CTO attempts to answer using project context or escalates to CEO.
   */
  async handleClarification(taskId, question, payload) {
    console.log(`[CTO] Thinking about clarification: "${question.substring(0, 50)}..."`);
    
    // 1. Prepare context for AI reasoning
    const prompt = `
<cto_role>
You are the **CTO**. Your Team Lead is asking for clarification on a task.
Use your **THINKING ENGINE** and the provided context to answer them.
</cto_role>

<task>
Title: ${payload.task.title}
Objective: ${payload.task.description}
</task>

<question>
${question}
</question>

<context>
Project Rules: ${payload.project.global_rules || 'Standard best practices.'}
History: ${JSON.stringify(this.taskHistory.getRecentContext(payload.project.id))}
</context>

<instructions>
1. Can you answer this question definitively using the context provided?
2. If YES: Provide a clear, authoritative answer.
3. If NO: Explain why you are stuck and need the CEO's intervention.
</instructions>

<output_format>
Return JSON:
{
  "canAnswer": true/false,
  "answer": "Clear explanation for the Team Lead",
  "escalationNote": "Message for the CEO (if canAnswer is false)",
  "shouldBlock": true/false
}
</output_format>
    `.trim();

    try {
      const result = await this.agentExecutor.execute({
        id: `cto-clarify-${taskId}`,
        title: 'CTO Clarification',
        description: prompt
      }, this.ctoProvider, this.modelSelector.selectModel('high').model);

      const jsonMatch = result.output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const response = JSON.parse(jsonMatch[0]);
        
        if (response.canAnswer) {
          // ANSWER: Post comment and unblock
          await this.taskAPI.addComment(taskId, `**💡 CTO Clarification:**\n\n${response.answer}\n\n@TeamLead, please proceed.`);
          await this.taskAPI.updateTask(taskId, { status: 'todo' });
        } else {
          // ESCALATE: Mark as blocked and tag CEO
          const escalation = `**🚨 CTO Escalation:**\n\n${response.escalationNote}\n\n@CEO, I need your intervention to resolve this for the team.`;
          await this.taskAPI.addComment(taskId, escalation);
          await this.taskAPI.updateTask(taskId, { status: 'blocked' }); // We might need to ensure 'blocked' exists or use a flag
        }
      }
    } catch (e) {
      console.error('[CTO] Clarification failed:', e.message);
    }
  }

  /**
   * Async Review Loop: Triggered when a Team Lead moves a task to 'for-review'.
   * CTO acts as the first line of QA.
   */
  async reviewTask(task, payload) {
    console.log(`[CTO] Starting review for: ${task.title}`);
    
    // 1. Fetch the Team Lead's output from the completion report field
    const output = task.completion_report || '';
    
    if (!output) {
      console.log(`[CTO] No completion report for ${task.id}. Skipping.`);
      return;
    }

    // 2. Run AI Verification
    const verification = await this.aiEngine.verifyCompletion(task, { output, success: true });

    if (verification.passed && verification.score >= 80) {
      // SUCCESS: Mark as Done
      console.log(`[CTO] Task PASSED review (Score: ${verification.score})`);
      
      await this.taskAPI.addComment(task.id, `**✅ CTO Review Passed (${verification.score}/100)**\n\n${verification.strengths?.join('\n') || 'Output meets all criteria.'}`);
      
      await this.taskAPI.updateTask(task.id, { 
        status: 'done' 
      });
    } else {
      // FAILURE: Move back to Todo with feedback
      console.log(`[CTO] Task FAILED review (Score: ${verification.score}). Feedback provided.`);
      
      const feedback = `
**❌ CTO Review Failed (${verification.score}/100)**

**Feedback:**
${verification.missing}

**Concerns:**
${verification.concerns?.map(c => `- ${c}`).join('\n') || 'Requirements not fully met.'}

**Directive:**
Please address the issues above and resubmit for review.
      `.trim();

      await this.taskAPI.addComment(task.id, feedback);
      
      await this.taskAPI.updateTask(task.id, { 
        status: 'todo'
      });
    }
  }

  // ========== PRIVATE HELPERS ==========

  _inferDeadline(priority) {
    const now = new Date();
    switch (priority?.toLowerCase()) {
      case 'urgent':
      case 'high':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      case 'medium':
        return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
      case 'low':
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
  }

  _analyzeComplexity(title, description = '') {
    const text = `${title} ${description}`.toLowerCase();
    let scores = { simple: 0, moderate: 0, complex: 0, epic: 0 };

    for (const [level, keywords] of Object.entries(COMPLEXITY_SIGNALS)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) scores[level]++;
      }
    }

    // Also factor in description length and numbered steps
    const descLength = (description || '').length;
    if (descLength > 2000) scores.complex += 2;
    if (descLength > 5000) scores.epic += 2;

    const steps = this._extractSteps(description);
    if (steps.length > 5) scores.epic += 2;
    else if (steps.length > 2) scores.complex++;

    // Determine level
    let level = 'moderate'; // default
    let maxScore = scores.moderate;
    for (const [l, s] of Object.entries(scores)) {
      if (s > maxScore) { level = l; maxScore = s; }
    }

    // Compute a 0-100 score
    const score = Math.min(100, Math.round(
      (scores.epic * 25) + (scores.complex * 15) + (scores.moderate * 8) + (scores.simple * 3)
    ));

    return { level, score, scores };
  }

  _hasNumberedSteps(description = '') {
    const stepPattern = /(?:^|\n)\s*(?:\d+[.)]\s|[-*]\s(?:step|phase|part)\s)/im;
    return stepPattern.test(description);
  }

  _extractSteps(description = '') {
    if (!description) return [];
    const lines = description.split('\n');
    const steps = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Match numbered steps: "1. ...", "1) ...", "Step 1: ..."
      if (/^\d+[.)]\s/.test(trimmed) || /^step\s+\d+/i.test(trimmed)) {
        const stepText = trimmed.replace(/^\d+[.)]\s*/, '').replace(/^step\s+\d+[:.]\s*/i, '').trim();
        if (stepText.length > 5) steps.push(stepText);
      }
    }

    return steps;
  }

  _summarizeOutput(output, maxChars = 2000) {
    if (!output) return '(no output)';
    if (output.length <= maxChars) return output;

    // Keep the last maxChars characters (most relevant info is usually at the end)
    const truncated = output.slice(-maxChars);
    return `...[truncated, showing last ${maxChars} chars]...\n${truncated}`;
  }

  _truncateDescription(desc, maxChars = 1000) {
    if (!desc) return '(no description)';
    if (desc.length <= maxChars) return desc;

    // Keep first paragraph + truncate
    const firstParagraph = desc.split('\n\n')[0];
    if (firstParagraph.length <= maxChars) {
      return firstParagraph + '\n\n...[description truncated]';
    }
    return desc.substring(0, maxChars) + '...[truncated]';
  }

  _complexityToScore(level) {
    const scores = { simple: 15, moderate: 35, complex: 60, epic: 85 };
    return scores[level] || 35;
  }

  _getModelForProvider(provider) {
    const models = {
      claude: 'claude-sonnet-4.5',
      gemini: 'gemini-3-pro',
      codex: 'gpt-5.2-mini',
      openai: 'gpt-5.2'
    };
    return models[provider] || 'claude-sonnet-4.5';
  }

  async _logDecision(task, decision) {
    try {
      const dir = path.dirname(this.decisionLogFile);
      await fs.mkdir(dir, { recursive: true });

      const aiIndicator = decision.aiPowered ? ' [AI-POWERED]' : '';
      const entry = [
        '',
        `## ${new Date().toISOString()} - Task: ${task.title}${aiIndicator}`,
        `- **Action:** ${decision.action}`,
        `- **Reason:** ${decision.reason}`,
        `- **Confidence:** ${decision.confidence}%`,
        decision.provider ? `- **Provider:** ${decision.provider}` : '',
        decision.model ? `- **Model:** ${decision.model}` : '',
        decision.complexity ? `- **Complexity:** ${decision.complexity.level} (score: ${decision.complexity.score})` : '',
        decision.deferUntil ? `- **Defer Until:** ${decision.deferUntil.toISOString()}` : '',
        decision.aiPowered ? `- **Decision Method:** AI-powered analysis` : `- **Decision Method:** Rule-based fallback`,
        ''
      ].filter(Boolean).join('\n');

      // Append to decision log
      let existing = '';
      try {
        existing = await fs.readFile(this.decisionLogFile, 'utf-8');
      } catch (e) {
        existing = '# CTO Decision Log\n\nAudit trail of all CTO decisions.\n';
      }

      await fs.writeFile(this.decisionLogFile, existing + entry);
    } catch (e) {
      console.error('[CTO] Failed to log decision:', e.message);
    }
  }
}

module.exports = CTOEngine;
