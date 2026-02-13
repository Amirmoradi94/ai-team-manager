const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const ResourceManager = require('./ResourceManager');
const ProviderIntelligence = require('./ProviderIntelligence');
const TaskHistoryManager = require('./TaskHistoryManager');
const ModelSelector = require('./ModelSelector');
const AIDecisionEngine = require('./AIDecisionEngine');

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
  constructor(taskAPI, ctoConfig, teamLeadDir, agentExecutor = null, dbPath = null, runnerConfig = null) {
    this.taskAPI = taskAPI;
    this.teamLeadDir = teamLeadDir; // Team lead directory (for context only, CTO doesn't use it)
    this.config = ctoConfig || {};
    this.runnerSchedule = runnerConfig?.schedule?.specificTasks || [];
    this.agentExecutor = agentExecutor;
    this.dbPath = dbPath || path.join(__dirname, '..', '..', 'task-manager', 'server', 'taskmanager.db');

    // CTO Enabled Flag
    this.enabled = ctoConfig?.enabled !== false; // Default to true

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
    this.executor = agentExecutor;
    this.lastTaskResourceCheckAt = 0;

    // AI-powered decision engine (uses Gemini Pro, Claude Opus, or GPT-5.2)
    if (agentExecutor) {
      this.aiEngine = new AIDecisionEngine(this.modelSelector, agentExecutor);
    }

    // CTO decision log (in CTO's own directory, not team leads')
    this.decisionLogFile = path.join(ctoDecisionsDir, 'DECISION_LOG.md');
  }

  /**
   * Load employees from database
   */
  async getEmployees() {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('[CTO] Failed to connect to database:', err.message);
          resolve([]);
          return;
        }

        db.all('SELECT id, name, description, tools FROM specialists ORDER BY name', [], (err, rows) => {
          db.close();

          if (err) {
            console.error('[CTO] Failed to query employees:', err.message);
            resolve([]);
            return;
          }

          resolve(rows || []);
        });
      });
    });
  }

  updateSettings(settings) {
    if (!settings) return;

    // Update enabled status
    if (settings.enabled !== undefined) this.enabled = settings.enabled;

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
      const modelNames = availableModels.map(m => (m.provider === 'gemini' ? 'gemini' : m.model));
      console.log(`[CTO] AI Decision Models available: ${modelNames.join(', ')}`);
    } else {
      console.log('[CTO] WARNING: No AI models available for decision-making!');
    }
  }

  /**
   * Refresh resource status from external monitors (cmonitor, gcloud)
   */
  async refreshResourceStatus(forceCheck = false, executor = null) {
    if (forceCheck && executor) {
      await this.resourceManager.checkExternalStatusWithExecutor(executor, 'hello');
    } else {
      await this.resourceManager.checkExternalStatus();
    }
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
    // Task-level resource check (independent of CTO dashboard refresh)
    try {
      const now = Date.now();
      if (this.executor && (!this.lastTaskResourceCheckAt || now - this.lastTaskResourceCheckAt > 2 * 60 * 1000)) {
        await this.resourceManager.checkExternalStatusWithExecutor(this.executor, 'hello');
        this.lastTaskResourceCheckAt = now;
      }
    } catch (e) {
      console.warn('[CTO] Task resource check failed:', e.message);
    }
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
    const activeTasksUntilDeadline = await this._countActiveTasksUntil(deadline, task.id);

    // 3. Load available employees from database
    const employees = await this.getEmployees();
    console.log(`[CTO] Loaded ${employees.length} employees for context`);

    // AI-powered analysis (Always used)
    if (this.aiEngine) {
      const context = {
        availableProviders: ['claude', 'gemini', 'codex'],
        resourceStatus: resourceStatus, // This contains the 'cmonitor' ground truth
        historicalData: this.taskHistory.getInsights(),
        deadline: deadline,
        activeTasksUntilDeadline: activeTasksUntilDeadline,
        priority: priority || 'medium',
        employees: employees, // Pass employees to AI for decision-making
        team: payload?.team || null
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
            aiPowered: true,
            aiAnalysis: aiAnalysis
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

    // No AI available - do not execute. Keep in backlog with warning.
    console.warn('[CTO] AI analysis not available. Deferring execution and flagging task.');
    const warningMsg = 'CTO paused: No AI model available for decision-making. Task requires AI to split/analyze.';

    try {
      const resourceMetadata = JSON.stringify({
        cto_warning: warningMsg,
        cto_warning_at: new Date().toISOString()
      });
      await this.taskAPI.updateTask(task.id, {
        status: 'backlog',
        resource_metadata: resourceMetadata
      });
      await this.taskAPI.addComment(
        task.id,
        `To CEO:\n${warningMsg}`,
        true,
        { id: 'cto-system', name: 'CTO' }
      );
    } catch (e) {
      console.warn('[CTO] Failed to flag task with AI-unavailable warning:', e.message);
    }

    const decision = {
      action: 'defer',
      reason: warningMsg,
      confidence: 0,
      estimatedMessages: 0,
      complexity: { level: 'unknown', score: 0 },
      aiPowered: false
    };
    await this._logDecision(task, decision);
    return decision;
  }

  async _countActiveTasksUntil(deadlineDate, excludeTaskId = null) {
    if (!deadlineDate) return null;
    try {
      const tasks = await this.taskAPI.getAllTasks();
      const cutoff = new Date(deadlineDate).getTime();
      const excludedStatuses = new Set(['done', 'completed', 'cancelled', 'archived']);
      const active = tasks.filter(t => {
        if (excludeTaskId && t.id === excludeTaskId) return false;
        if (excludedStatuses.has((t.status || '').toLowerCase())) return false;
        if (!t.due_date) return false;
        const due = new Date(t.due_date).getTime();
        return Number.isFinite(due) && due <= cutoff;
      });
      return active.length;
    } catch (error) {
      console.warn('[CTO] Failed to count active tasks until deadline:', error.message);
      return null;
    }
  }

  // ========== SPLIT LOGIC ==========

  /**
   * Split an epic task into subtasks.
   * Sets parent to 'epic' + 'in-progress', creates children as 'todo' subtasks assigned to Team Lead.
   * Schedules them SEQUENTIALLY to avoid resource contention and enforce dependency.
   * Calculates smart deadlines for each subtask based on overall deadline.
   */
  async splitTask(task, payload, existingAnalysis = null) {
    // Load employees for AI context
    const employees = await this.getEmployees();

    const context = {
      employees: employees,
      availableProviders: ['claude', 'gemini', 'codex'],
      resourceStatus: this.resourceManager.getStatus(),
      historicalData: this.taskHistory.getInsights(),
      deadline: task.due_date ? new Date(task.due_date) : null,
      priority: task.priority || 'medium',
      team: payload?.team || null
    };

    const aiAnalysis = existingAnalysis || await this.aiEngine.analyzeTask(task, context);

    // Fallback if AI fails
    if (!aiAnalysis || !aiAnalysis.subtasks || aiAnalysis.subtasks.length === 0) {
      return this._fallbackSplitTask(task, payload);
    }

    const subtasksData = aiAnalysis.subtasks;
    const teamLeadId = payload?.team?.lead?.id;
    const teamName = payload?.team?.name || null;
    const projectName = payload?.project?.name || null;

    // Calculate deadline distribution
    const deadlineDate = task.due_date ? new Date(task.due_date) : null;
    const overallDeadline = deadlineDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const totalTimeAvailable = overallDeadline - now; // milliseconds
    const subtaskCount = subtasksData.length;
    const blockedIntervals = await this._getBlockedIntervals(overallDeadline, task.id);

    // Create subtasks assigned to Team Lead
    const subtasks = [];
    let failedCreates = 0;
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

      // Calculate schedule time for start
      let scheduleTime = new Date(Date.now() + (accumulatedDelayMinutes * 60 * 1000));
      scheduleTime = this._findNextAvailableSlot(scheduleTime, blockedIntervals, 30);
      const dateStr = this._formatLocalDate(scheduleTime);
      const timeStr = this._formatLocalTime(scheduleTime);

      // Calculate deadline for this subtask
      // Distribute time evenly, leaving 20% buffer for final review
      const timePerSubtask = (totalTimeAvailable * 0.8) / subtaskCount;
      const subtaskDeadline = new Date(now.getTime() + timePerSubtask * (i + 1));
      const deadlineStr = subtaskDeadline.toISOString().split('T')[0];

      // Build paths for context files (only relevant ones)
      const companyDir = path.join(require('os').homedir(), 'mycompany');
      const projectSlug = projectName ? projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_') : null;
      const teamSlug = teamName ? teamName.toLowerCase().replace(/[^a-z0-9]+/g, '_') : null;

      // Get team members (employees assigned to this team)
      const teamMembers = (payload?.team?.specialists && payload.team.specialists.length > 0)
        ? payload.team.specialists
        : (payload?.specialists || []);
      const teamMembersList = teamMembers.length > 0
        ? teamMembers.map(emp => `- **${emp.name}**: ${emp.description || 'No description'}`).join('\n')
        : '_No specific employees assigned to this team_';

      // Build Focused Markdown Contract (This is the ONLY prompt the Team Lead sees)
      const contract = `# ${sub.title}

## 🎯 Objective

${sub.objective || 'Complete this subtask as part of the larger epic.'}

## 🔗 Context

This is **Subtask ${i + 1} of ${subtasksData.length}** in the epic: "${task.title}"

${task.description ? `**Parent Task Description:**\n${task.description.substring(0, 500)}${task.description.length > 500 ? '...' : ''}` : ''}

## 📂 Output Directory

\`${taskDir}\` (Create if not exists)

**CRITICAL**: All artifacts (code, configs, docs) must be saved in this directory.

## 📚 Relevant Context

${projectSlug ? `**Project Overview**: Read \`${companyDir}/projects/${projectSlug}/OVERVIEW.md\` for project goals and requirements.\n` : ''}

${teamSlug ? `**Your Team**: Read \`${companyDir}/teams/${teamSlug}/OVERVIEW.md\` for team mission and working guidelines.\n` : ''}

${i > 0 ? `**Previous Subtask**: Check outputs in \`${taskDir}\` from "${subtasksData[i-1].title}" for dependencies.\n` : ''}

${payload?.project?.repository_path ? `**Codebase**: \`${payload.project.repository_path}\` - Review existing patterns before implementing.\n` : ''}

${task.failed_at ? `**⚠️ Previous Attempt**: This task was attempted before. Check task comments/logs for what went wrong and avoid the same issues.\n` : ''}

**Action**: Read the relevant context files above using the \`Read\` tool before implementing.

## 👥 Team Members Available

${teamMembersList}

**Note**: You can call upon any of these team members for specialized tasks.

## 📥 Inputs Required

${sub.inputs || 'Use outputs from previous subtasks if applicable.'}

${i > 0 ? `**Previous Subtask Output**: Check \`${taskDir}\` for outputs from "${subtasksData[i-1].title}"` : ''}

## 📝 Implementation Guidelines

${sub.guidelines || 'Follow project coding standards and best practices.'}

**Additional Requirements:**
- Write clean, well-documented code
- Include error handling and validation
- Add inline comments for complex logic
- Follow naming conventions
- Ensure backward compatibility if modifying existing code

## 📤 Expected Output (Definition of Done)

${sub.expectedOutput || 'Complete implementation with working code.'}

**Acceptance Criteria:**
- All specified features implemented and working
- Code follows project standards
- No breaking changes to existing functionality
- Output files saved in correct directory

## ⏰ Timeline

- **Start Time**: ${scheduleTime.toISOString()}
- **Deadline**: ${subtaskDeadline.toISOString()}
- **Estimated Duration**: ${estimatedDuration} minutes

${deadlineDate ? `**⚠️ Parent Deadline**: ${deadlineDate.toISOString()} - Stay on schedule!\n` : ''}

## 🔄 Next Steps

${i < subtasksData.length - 1 ? `After completion, next subtask: "${subtasksData[i+1].title}"` : 'Final subtask - all epic components will be ready for integration after this.'}

---

*Generated by CTO Intelligence Layer*
*Epic: ${task.title} | Subtask ${i + 1}/${subtasksData.length} | Complexity: ${sub.complexity || 'moderate'}*
      `.trim();

      const subtaskData = {
        title: sub.title,
        description: contract,
        status: 'todo',
        priority: task.priority || 'medium',
        parent_id: task.id,
        task_type: 'task',
        project_id: task.project_id, // Inherit from parent
        team_id: task.team_id, // Inherit from parent
        assignee_id: teamLeadId, // EXPLICITLY assign to Team Lead
        scheduled_date: dateStr,
        scheduled_time: timeStr,
        due_date: deadlineStr // Set calculated deadline
      };

      try {
        const created = await this.taskAPI.createTask(subtaskData);
        subtasks.push(created);
        // Add duration + buffer for next task's start time
        accumulatedDelayMinutes += (estimatedDuration + BASE_BUFFER);
      } catch (e) {
        console.error(`[CTO] Failed to create subtask ${i + 1}:`, e.message);
        failedCreates += 1;
      }
    }

    console.log(`[CTO] ✅ Split "${task.title}" into ${subtasks.length} subtasks`);
    console.log(`[CTO] Schedule span: ${accumulatedDelayMinutes}m | Team: ${teamName || 'N/A'} | Project: ${projectName || 'N/A'}`);

    await this.taskHistory.recordEpicSplit(task, subtasks.length);

    // Log subtask creation summary
    subtasks.forEach((st, idx) => {
      console.log(`  ${idx + 1}. ${st.title} → Scheduled: ${st.scheduled_date} ${st.scheduled_time}`);
    });

    console.log(`[CTO] All subtasks created with focused context (team members, project overview, previous outputs only)`);

    // Distribute attachments intelligently across subtasks
    if (task.attachments) {
      try {
        await this.distributeAttachments(task, subtasks, subtasksData);
      } catch (error) {
        console.error('[CTO] Failed to distribute attachments:', error);
      }
    }

    if (subtasks.length > 0 && failedCreates === 0) {
      try {
        await this.taskAPI.deleteTask(task.id);
        console.log(`[CTO] Deleted parent task "${task.title}" after splitting`);
      } catch (error) {
        console.error('[CTO] Failed to delete parent task after splitting:', error.message);
      }
    }

    return subtasks;
  }

  async _fallbackSplitTask(task, payload) {
    console.warn('[CTO] Using fallback split logic (AI analysis failed)');

    const steps = this._extractSteps(task.description);

    if (steps.length === 0) {
      console.error('[CTO] No steps found for splitting. Cannot split task.');
      return [];
    }

    const teamLeadId = payload?.team?.lead?.id;
    const subtasks = [];
    let failedCreates = 0;

    const blockedIntervals = await this._getBlockedIntervals(null, task.id);

    // Create subtasks from extracted steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let scheduleTime = new Date(Date.now() + (i * 30 * 60 * 1000)); // 30 min apart
      scheduleTime = this._findNextAvailableSlot(scheduleTime, blockedIntervals, 30);
      const dateStr = this._formatLocalDate(scheduleTime);
      const timeStr = this._formatLocalTime(scheduleTime);

      const subtaskData = {
        title: `Step ${i + 1}: ${step.substring(0, 50)}`,
        description: step,
        status: 'todo',
        priority: task.priority || 'medium',
        parent_id: task.id,
        task_type: 'task',
        project_id: task.project_id, // Inherit from parent
        team_id: task.team_id, // Inherit from parent
        assignee_id: teamLeadId,
        scheduled_date: dateStr,
        scheduled_time: timeStr
      };

      try {
        const created = await this.taskAPI.createTask(subtaskData);
        subtasks.push(created);
      } catch (e) {
        console.error(`[CTO] Failed to create subtask ${i + 1}:`, e.message);
        failedCreates += 1;
      }
    }

    console.log(`[CTO] Fallback split created ${subtasks.length} subtasks`);

    if (subtasks.length > 0 && failedCreates === 0) {
      try {
        await this.taskAPI.deleteTask(task.id);
        console.log(`[CTO] Deleted parent task "${task.title}" after fallback splitting`);
      } catch (error) {
        console.error('[CTO] Failed to delete parent task after fallback splitting:', error.message);
      }
    }
    return subtasks;
  }

  /**
   * Intelligently distribute attachments from parent task to subtasks.
   * Uses AI to analyze each attachment and determine which subtask(s) it's relevant for.
   *
   * @param {Object} parentTask - The parent task with attachments
   * @param {Array} subtasks - The created subtasks
   * @param {Array} subtasksData - The subtask data with objectives
   * @returns {Promise<Object>} - Mapping of subtask IDs to their attachments
   */
  async distributeAttachments(parentTask, subtasks, subtasksData) {
    // Parse parent task attachments
    const parentAttachments = parentTask.attachments
      ? (typeof parentTask.attachments === 'string'
          ? JSON.parse(parentTask.attachments)
          : parentTask.attachments)
      : [];

    if (!parentAttachments || parentAttachments.length === 0) {
      console.log('[CTO] No attachments to distribute');
      return {};
    }

    console.log(`[CTO] Analyzing ${parentAttachments.length} attachments for distribution across ${subtasks.length} subtasks`);

    // Build context for AI analysis
    const subtaskSummaries = subtasksData.map((sub, idx) => ({
      index: idx + 1,
      title: sub.title,
      objective: sub.objective,
      expectedOutput: sub.expectedOutput
    }));

    const attachmentSummaries = parentAttachments.map((att, idx) => ({
      index: idx + 1,
      filename: att.filename || att.name || `attachment-${idx + 1}`,
      type: att.type || att.mimeType || 'unknown',
      size: att.size || 0,
      description: att.description || ''
    }));

    // Use AI to analyze and distribute
    const prompt = `You are a CTO analyzing task attachments to distribute them to the correct subtasks.

## Parent Task
**Title**: ${parentTask.title}
**Description**: ${parentTask.description ? parentTask.description.substring(0, 500) : 'N/A'}

## Subtasks
${subtaskSummaries.map(st => `**Subtask ${st.index}**: ${st.title}
   Objective: ${st.objective}
   Expected Output: ${st.expectedOutput}`).join('\n\n')}

## Attachments
${attachmentSummaries.map(att => `**Attachment ${att.index}**: ${att.filename}
   Type: ${att.type}
   Size: ${att.size} bytes
   Description: ${att.description || 'No description'}`).join('\n\n')}

## Your Task
Analyze each attachment and determine which subtask(s) it's relevant for based on:
1. Filename and file type
2. The subtask objectives and expected outputs
3. Logical workflow dependencies

Return a JSON object mapping attachment indices to subtask indices:
{
  "distribution": {
    "1": [1, 2],  // Attachment 1 is relevant for subtasks 1 and 2
    "2": [3],     // Attachment 2 is only for subtask 3
    "3": [1, 2, 3, 4]  // Attachment 3 is needed by all subtasks
  },
  "reasoning": {
    "1": "API spec document needed for backend setup and endpoint implementation",
    "2": "Design mockup only relevant for frontend work",
    "3": "Configuration file needed by all components"
  }
}

If an attachment doesn't clearly belong to any subtask, include it in subtask 1 by default.`;

    try {
      const analysis = await this.aiEngine.analyzeWithPrompt(prompt, null, { schema: 'attachments' });

      if (!analysis || !analysis.distribution) {
        console.warn('[CTO] AI attachment analysis failed, using fallback distribution');
        return this._fallbackDistributeAttachments(parentAttachments, subtasks);
      }

      // Build attachment mapping for each subtask
      const subtaskAttachments = {};

      for (const [attIndex, subtaskIndices] of Object.entries(analysis.distribution)) {
        const attachment = parentAttachments[parseInt(attIndex) - 1];

        for (const subtaskIdx of subtaskIndices) {
          const subtask = subtasks[subtaskIdx - 1];
          if (!subtask) continue;

          if (!subtaskAttachments[subtask.id]) {
            subtaskAttachments[subtask.id] = [];
          }

          subtaskAttachments[subtask.id].push({
            ...attachment,
            relevance_reason: analysis.reasoning[attIndex]
          });
        }
      }

      // Update each subtask with its attachments
      for (const [subtaskId, attachments] of Object.entries(subtaskAttachments)) {
        await this.taskAPI.updateTask(subtaskId, {
          attachments: JSON.stringify(attachments)
        });

        console.log(`[CTO] ✅ Assigned ${attachments.length} attachment(s) to subtask ${subtaskId}`);
        attachments.forEach(att => {
          console.log(`   - ${att.filename}: ${att.relevance_reason}`);
        });
      }

      return subtaskAttachments;

    } catch (error) {
      console.error('[CTO] Error distributing attachments:', error);
      return this._fallbackDistributeAttachments(parentAttachments, subtasks);
    }
  }

  /**
   * Fallback: Distribute all attachments to all subtasks if AI analysis fails
   */
  _fallbackDistributeAttachments(attachments, subtasks) {
    if (subtasks.length === 0) return {};

    const result = {};
    for (const subtask of subtasks) {
      result[subtask.id] = attachments;
      this.taskAPI.updateTask(subtask.id, {
        attachments: JSON.stringify(attachments)
      }).catch(err => console.error('[CTO] Failed to update subtask attachments:', err));
    }

    console.log(`[CTO] ⚠️ Fallback: Assigned all ${attachments.length} attachments to all ${subtasks.length} subtasks`);
    return result;
  }

  _findNextAvailableSlot(startTime, blockedIntervals, stepMinutes = 30) {
    if (!blockedIntervals || blockedIntervals.length === 0) return startTime;
    const stepMs = stepMinutes * 60 * 1000;
    let candidate = new Date(startTime.getTime());
    const maxIterations = 2000;
    let iterations = 0;

    while (iterations < maxIterations) {
      const conflict = blockedIntervals.some(([start, end]) => {
        const t = candidate.getTime();
        return t >= start && t < end;
      });
      if (!conflict) return candidate;
      candidate = new Date(candidate.getTime() + stepMs);
      iterations += 1;
    }

    return candidate;
  }

  async _getBlockedIntervals(deadlineDate = null, excludeTaskId = null) {
    const blocked = [];
    const oneHourMs = 60 * 60 * 1000;
    const now = Date.now();

    try {
      const tasks = await this.taskAPI.getAllTasks();
      for (const task of tasks) {
        if (excludeTaskId && task.id === excludeTaskId) continue;
        const status = (task.status || '').toLowerCase();
        if (status === 'in-progress') {
          const start = task.execution_started_at ? new Date(task.execution_started_at).getTime() : now;
          blocked.push([start, start + oneHourMs]);
          continue;
        }

        if (task.scheduled_date && task.scheduled_time) {
          const scheduled = this._parseLocalDateTime(task.scheduled_date, task.scheduled_time);
          if (Number.isFinite(scheduled)) {
            blocked.push([scheduled, scheduled + oneHourMs]);
          }
        }
      }
    } catch (error) {
      console.warn('[CTO] Failed to load tasks for scheduling conflicts:', error.message);
    }

    if (this.runnerSchedule && this.runnerSchedule.length > 0 && deadlineDate) {
      const deadlineTs = new Date(deadlineDate).getTime();
      for (const job of this.runnerSchedule) {
        const nextRun = this._getNextCronRun(job.cron, now, deadlineTs);
        if (nextRun) {
          blocked.push([nextRun, nextRun + oneHourMs]);
        }
      }
    }

    return blocked;
  }

  _parseLocalDateTime(dateStr, timeStr) {
    try {
      const [year, month, day] = dateStr.split('-').map(n => parseInt(n, 10));
      const [hour, minute] = timeStr.split(':').map(n => parseInt(n, 10));
      if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return NaN;
      return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
    } catch {
      return NaN;
    }
  }

  _getNextCronRun(cronExpr, fromTs, deadlineTs) {
    // Supports simple 5-field cron: "m h * * *" or "m h * * d"
    const parts = (cronExpr || '').trim().split(/\s+/);
    if (parts.length < 5) return null;
    const [minStr, hourStr, , , dowStr] = parts;
    const minute = parseInt(minStr, 10);
    const hour = parseInt(hourStr, 10);
    if (Number.isNaN(minute) || Number.isNaN(hour)) return null;

    const now = new Date(fromTs);
    for (let i = 0; i < 30; i++) {
      const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hour, minute, 0, 0);
      if (candidate.getTime() < fromTs) continue;
      if (deadlineTs && candidate.getTime() > deadlineTs) return null;
      if (dowStr === '*' || typeof dowStr === 'undefined') {
        return candidate.getTime();
      }
      const dow = parseInt(dowStr, 10);
      if (!Number.isNaN(dow) && candidate.getDay() === dow) {
        return candidate.getTime();
      }
    }
    return null;
  }

  _formatLocalDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  _formatLocalTime(date) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
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
