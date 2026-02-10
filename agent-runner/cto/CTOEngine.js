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
   * Evaluate a task and decide what to do with it.
   * Uses AI models (Gemini Pro, Claude Opus 4.5, GPT-5.2) for intelligent decisions.
   */
  async evaluate(task, payload) {
    const { title, description } = task;
    const identity = payload?.identity || {};

    // AI-powered analysis (Always used)
    if (this.aiEngine) {
      const context = {
        availableProviders: ['claude', 'gemini', 'codex'],
        resourceStatus: this.resourceManager.getStatus(),
        historicalData: this.taskHistory.getInsights()
      };

      const aiAnalysis = await this.aiEngine.analyzeTask(task, context);

      if (aiAnalysis) {
        // AI successfully analyzed the task
        const decision = {
          action: aiAnalysis.action.toLowerCase(),
          provider: aiAnalysis.recommendedProvider || 'claude',
          model: this._getModelForProvider(aiAnalysis.recommendedProvider || 'claude'),
          reason: `AI Analysis (${this.modelSelector.selectModel('moderate').model}): ${aiAnalysis.reasoning}`,
          confidence: aiAnalysis.confidence,
          estimatedMessages: aiAnalysis.estimatedMessages || 12,
          complexity: { level: aiAnalysis.complexity, score: this._complexityToScore(aiAnalysis.complexity) },
          aiPowered: true
        };

        await this._logDecision(task, decision);
        return decision;
      }

      console.log('[CTO] AI analysis unavailable, using fallback logic');
    }

    // Fallback: Rule-based analysis
    const complexity = this._analyzeComplexity(title, description);

    // 2. Estimate messages needed
    const estimatedMessages = MESSAGE_ESTIMATES[complexity.level] || 12;

    // 3. Check if this should be split
    if (complexity.level === 'epic' || (complexity.score >= this.splitThreshold && this._hasNumberedSteps(description))) {
      const decision = {
        action: 'split',
        reason: `Complexity ${complexity.level} (score: ${complexity.score}). Task has numbered steps suitable for splitting.`,
        confidence: complexity.score,
        complexity
      };
      await this._logDecision(task, decision);
      return decision;
    }

    // 4. Select provider (use historical insights if available)
    const taskType = this.providerIntelligence.classifyTask(title, description);
    const historicalRec = this.taskHistory.recommendProvider(taskType, ['claude', 'gemini', 'codex']);

    let selection;
    if (historicalRec && historicalRec.confidence > 75) {
      // Use learned preference
      const status = this.resourceManager.checkAvailability(historicalRec.provider);
      if (status.available) {
        selection = {
          provider: historicalRec.provider,
          model: this.providerIntelligence._getModel(historicalRec.provider),
          reason: historicalRec.reason + ' (learned from history)'
        };
      } else {
        // Fallback to standard selection
        selection = this.providerIntelligence.selectProvider(task, identity);
      }
    } else {
      selection = this.providerIntelligence.selectProvider(task, identity);
    }

    if (!selection.provider) {
      const decision = {
        action: 'defer',
        reason: selection.reason,
        confidence: 90,
        deferUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 min
        complexity
      };
      await this._logDecision(task, decision);
      return decision;
    }

    // 5. Check resource pressure (defer if above threshold)
    const status = this.resourceManager.checkAvailability(selection.provider);
    const plan = this.resourceManager._getPlan(selection.provider);
    if (plan) {
      const usagePercent5h = ((plan.per5h - status.remaining5h) / plan.per5h) * 100;
      const usagePercentDay = ((plan.perDay - status.remainingDay) / plan.perDay) * 100;
      const maxUsage = Math.max(usagePercent5h, usagePercentDay);

      if (maxUsage >= this.deferThreshold) {
        const decision = {
          action: 'defer',
          reason: `Resource pressure: ${selection.provider} at ${Math.round(maxUsage)}% usage (threshold: ${this.deferThreshold}%)`,
          confidence: 80,
          deferUntil: new Date(Date.now() + status.windowResetIn + 60000),
          complexity
        };
        await this._logDecision(task, decision);
        return decision;
      }
    }

    // 6. Execute
    const decision = {
      action: 'execute',
      provider: selection.provider,
      model: selection.model,
      reason: selection.reason,
      confidence: Math.max(60, 100 - complexity.score),
      estimatedMessages,
      complexity
    };
    await this._logDecision(task, decision);
    return decision;
  }

  // ========== SPLIT LOGIC ==========

  /**
   * Split an epic task into subtasks.
   * Sets parent to 'epic' + 'in-progress', creates children as 'todo' subtasks.
   */
  async splitTask(task, payload) {
    const steps = this._extractSteps(task.description);
    if (steps.length === 0) {
      // Can't meaningfully split, just execute as-is
      return null;
    }

    // Mark parent as epic in-progress
    await this.taskAPI.updateTask(task.id, {
      task_type: 'epic',
      status: 'in-progress',
      resource_metadata: JSON.stringify({
        split_reason: 'CTO split: complexity above threshold with numbered steps',
        split_at: new Date().toISOString(),
        subtask_count: steps.length
      })
    });

    // Create subtasks
    const subtasks = [];
    for (let i = 0; i < steps.length; i++) {
      const subtaskData = {
        title: steps[i],
        description: `Subtask ${i + 1} of "${task.title}":\n\n${steps[i]}`,
        status: 'todo',
        priority: task.priority || 'medium',
        parent_id: task.id,
        task_type: 'subtask',
        project_id: payload?.project?.id,
        team_id: payload?.team?.id,
        assignee_id: task.assignee_id
      };

      try {
        const created = await this.taskAPI.createTask(subtaskData);
        subtasks.push(created);
      } catch (e) {
        console.error(`[CTO] Failed to create subtask ${i + 1}:`, e.message);
      }
    }

    console.log(`[CTO] Split "${task.title}" into ${subtasks.length} subtasks`);

    // Record epic split in history
    await this.taskHistory.recordEpicSplit(task, subtasks.length);

    return subtasks;
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
  async recordTaskOutcome(outcome) {
    await this.taskHistory.recordOutcome(outcome);
  }

  // ========== PRIVATE HELPERS ==========

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
