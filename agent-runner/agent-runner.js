require('dotenv').config();
const cron = require('node-cron');
const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const ioClient = require('socket.io-client');
const TaskManagerAPI = require('./task-manager-api');
const AgentExecutor = require('./agent-executor');
const ClaudeAgentSdkExecutor = require('./claude-agent-sdk-executor');
const OpenAIAgentSdkExecutor = require('./openai-agent-sdk-executor');
const GoogleAdkExecutor = require('./google-adk-executor');
const UsageTracker = require('./usage/UsageTracker');
const config = require('./config.json');
const { CTOEngine } = require('./cto');

class AgentRunner {
  constructor(runtimeConfig) {
    const activeConfig = runtimeConfig || config;
    this.taskAPI = new TaskManagerAPI(activeConfig.taskManagerAPI);
    this.executor = new AgentExecutor(this.taskAPI);
    this.sdkExecutor = new ClaudeAgentSdkExecutor(this.taskAPI);
    this.openaiSdkExecutor = new OpenAIAgentSdkExecutor(this.taskAPI);
    this.googleAdkExecutor = new GoogleAdkExecutor(this.taskAPI);
    this.usageTracker = new UsageTracker(this.taskAPI);
    this.app = express();
    this.scheduledJobs = new Map();
    this.processedTaskIds = new Set();
    this.isPolling = false;
    this.isReviewing = false;
    this.runnerToken = activeConfig.taskManagerAPI.projectToken || activeConfig.taskManagerAPI.runnerToken;

    // Connect Socket.io for real-time commands
    const serverUrl = activeConfig.taskManagerAPI.apiUrl.replace('/api', '');
    this.socket = ioClient(serverUrl);
    this.setupSocketHandlers();

    // CTO Intelligence Layer with AI-powered decision-making
    this.cto = activeConfig.cto?.enabled
      ? new CTOEngine(
        this.taskAPI,
        activeConfig.cto,
        path.join(__dirname, 'team_lead'),
        this.executor,  // Pass executor so CTO can use AI models
        null,
        activeConfig,
        this.usageTracker,
        this.openaiSdkExecutor,
        this.googleAdkExecutor
        )
      : null;
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

  async _recordUsageForExecution(task, decision, result, actorType = 'team_lead') {
    if (!this.usageTracker || !result) return;
    try {
      const provider = decision?.provider === 'claude_sdk'
        ? 'claude'
        : decision?.provider === 'openai_sdk'
          ? 'openai'
          : decision?.provider;
      const model = decision?.model || null;
      const event = provider === 'openai'
        ? this.usageTracker.buildOpenAIUsageEvent(
            task,
            actorType,
            provider,
            model,
            result.usage,
            result.rawUsage
          )
        : (result.usage || result.modelUsage)
          ? this.usageTracker.buildClaudeUsageEvent(
              task,
              actorType,
              provider,
              model,
              result.usage,
              result.modelUsage,
              result.rawUsage
            )
          : this.usageTracker.buildExecutionUsageEvent(task, actorType, provider, model, result);

      await this.usageTracker.recordEvent(event);
    } catch (e) {
      console.warn('[Runner] Usage tracking failed:', e.message);
    }
  }

  setupSocketHandlers() {
    this.socket.on('connect', () => console.log('[Socket] Connected to server'));
    
    // Command: Open Terminal (for Auth/Login)
    this.socket.on('command:open-terminal', (data) => {
      // Prevent multiple triggers in short succession
      const now = Date.now();
      if (this.lastTerminalTrigger && (now - this.lastTerminalTrigger < 5000)) {
        return;
      }
      this.lastTerminalTrigger = now;

      console.log(`[Socket] Received command to open terminal: ${data.command}`);
      
      // macOS specific command to open a visible terminal and run a command
      const cmd = `osascript -e 'tell application "Terminal" to do script "${data.command}"' -e 'tell application "Terminal" to activate'`;
      
      exec(cmd, (error) => {
        if (error) console.error(`[Command] Failed to open terminal: ${error.message}`);
        else console.log(`[Command] Terminal opened for ${data.command}`);
      });
    });

    this.socket.on('cto:refresh-resources', async () => {
      // Health checks disabled by request
      if (!this.cto) return;
      console.log('[CTO] Resource refresh requested (disabled)');
    });
  }

  /**
   * Start the runner loop
   */
  async start() {
    console.log('🤖 Universal Agent Runner Starting...');
    console.log(`🔑 User Token: ${this.runnerToken.substring(0, 5)}...`);
    console.log('📁 Monitoring all your projects');

    // 0. Authenticate with Task Manager API
    console.log('[Debug] Authenticating with Task Manager API...');
    try {
      await this.taskAPI.login();
      console.log('[Debug] Authentication successful');
    } catch (error) {
      console.error('[Debug] Authentication failed:', error.message);
      throw error;
    }

    // 1. Initial Check-in (Heartbeat)
    console.log('[Debug] Sending initial heartbeat...');
    await this.checkIn();
    console.log('[Debug] Initial heartbeat complete');

    // 2. Initialize CTO Intelligence Layer
    if (this.cto) {
      try {
        const ctoSettings = await this.taskAPI.getCTOSettings();
        if (ctoSettings) this.cto.updateSettings(ctoSettings);
        await this.cto.loadState();
        console.log('[CTO] Intelligence layer active');
        await this.cto.runHeartbeat();
      } catch (e) {
        console.log('[CTO] Failed to initialize, running without CTO:', e.message);
        this.cto = null;
      }
    } else {
      console.log('[CTO] Intelligence layer disabled');
    }

    // 3. Start Heartbeat Interval (every 30s)
    console.log('[Debug] Starting heartbeat interval...');
    setInterval(() => this.checkIn(), 30000);

    // CTO proactive heartbeat (every 1 hour)
    if (this.cto) {
      setInterval(() => this.cto.runHeartbeat(), 60 * 60 * 1000);
    }

    // 4. Resource status refresh is triggered on CTO tab open only.
    if (this.cto) {
      // Still sync settings from UI every 20s
      setInterval(async () => {
        try {
          const settings = await this.taskAPI.getCTOSettings();
          if (settings) {
            this.cto.updateSettings(settings);
            await this.cto.persistState();
          }
        } catch (e) {}
      }, 20000);
    }

    // 5. Start Environment Sync (every 20s)
    // This ensures local .md files reflect UI changes even without tasks
    console.log('🔄 Monitoring environment changes...');
    this.syncAllProjectEnvironments(); // Run once immediately
    setInterval(() => this.syncAllProjectEnvironments(), 20000);

    // 5. Start Task Polling (every 10s)
    console.log('📡 Polling for tasks...');
    setInterval(() => this.pollForTasks(), 10000);

    // 6. Start Review Watcher (every 30s)
    console.log('👁️  Watching for tasks needing review...');
    setInterval(() => this.reviewTasks(), 30000);

    // 7. Start Webhook Server (optional fallback)
    console.log('[Debug] Starting webhook server...');
    this.startWebhookServer();

    console.log('\n✅ Runner is active and syncing all project environments.');
    console.log('Press Ctrl+C to stop\n');
  }

  async syncAllProjectEnvironments() {
    try {
      const projects = await this.taskAPI.getRunnerProjects(this.runnerToken);

      // First, sync Runner Brain (global intelligence) - ALWAYS, even without projects
      // Teams and employees are global resources independent of projects
      const payload = await this.taskAPI.getProjectInfo(this.runnerToken, projects[0]?.id);
      await this.executor.syncRunnerBrain(payload.allEmployees || [], payload.teams || []);

      // Then, sync lightweight project contexts for each project
      for (const project of projects) {
        const projectPayload = await this.taskAPI.getProjectInfo(this.runnerToken, project.id);

        // Create lightweight project context with all teams (not team intelligence)
        const teams = projectPayload.teams || [];

        if (projectPayload.project.repository_path) {
          await this.executor.syncProjectContext(projectPayload.project, teams);
        }
      }
    } catch (e) {
      console.error('[Sync] Background sync error:', e.message);
    }
  }


  async checkIn() {
    try {
      // Send heartbeat to server to show as "Online" in UI
      await this.taskAPI.sendHeartbeat(this.runnerToken, null);
      // console.log(`[Runner] Heartbeat sent at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error('[Runner] Heartbeat failed. Check your connection or token.');
    }
  }

  async pollForTasks() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      // Fetch all tasks from all user's projects using universal runner endpoint
      const tasks = await this.taskAPI.getRunnerTasks(this.runnerToken);

      for (const task of tasks) {
        // Skip if already being processed or scheduled in this runner instance
        if (this.processedTaskIds.has(task.id)) continue;

        if ((task.status || '').toLowerCase() === 'blocked') {
          try {
            const meta = task.resource_metadata ? JSON.parse(task.resource_metadata) : {};
            if (meta?.cto_event !== 'needs_clarification') continue;
          } catch {
            continue;
          }
        }

        // Respect scheduled date/time if set (local time)
        if (task.scheduled_date && task.scheduled_time) {
          const scheduledTs = this._parseLocalDateTime(task.scheduled_date, task.scheduled_time);
          if (Number.isFinite(scheduledTs) && Date.now() < scheduledTs) {
            continue;
          }
        }

        console.log(`\n[Runner] New task detected: ${task.title}`);
        
        // ... (rest of the directory switching logic)
        // Switch to project directory
        if (task.project_repository_path) {
          try {
            await this.executor.ensureDirectoryExists(task.project_repository_path);
            process.chdir(task.project_repository_path);
          } catch (e) {
            console.error(`[Runner] Failed to prepare directory: ${e.message}`);
          }
        }

        const payload = await this.taskAPI.getRunnerPayload(task.id);

        // Sync Runner Brain before executing (ensures latest teams/employees)
        const projectInfo = await this.taskAPI.getProjectInfo(this.runnerToken, payload.project.id);
        await this.executor.syncRunnerBrain(projectInfo.allEmployees || [], projectInfo.teams || []);

        // ===== CTO INTELLIGENCE LAYER =====
        if (this.cto && this.cto.enabled) {
          const decision = await this.cto.evaluate(payload.task, payload);
          console.log(`[CTO] Decision: ${decision.action} | Reason: ${decision.reason}`);

          // Normalize legacy action
          if (decision.action === 'assign') {
            decision.action = 'execute';
          }

          // SCHEDULE: CEO manually set a time, or CTO deferred.
          if (decision.action === 'schedule') {
            const delay = decision.scheduledAt.getTime() - Date.now();
            console.log(`[CTO] Task "${task.title}" queued for execution at ${decision.scheduledAt.toLocaleString()} (${Math.round(delay/1000/60)}m from now)`);
            
            this.processedTaskIds.add(task.id);
            
            setTimeout(async () => {
              console.log(`\n[CTO] Scheduled time reached for task: ${task.title}`);
              this.processedTaskIds.delete(task.id); // Remove from set so we can process it
              await this.pollForTasks(); // Re-poll to trigger immediate execution
            }, Math.max(0, delay));
            
            continue;
          }

          // SPLIT: Create subtasks, mark parent as epic, skip to next
          if (decision.action === 'split') {
            console.log(`[CTO] Splitting task "${task.title}" into subtasks...`);
            await this.cto.splitTask(payload.task, payload, decision.aiAnalysis || null);
            await this.cto.persistState();
            continue;
          }

          // ENHANCE: Update description and move to todo
          if (decision.action === 'enhance') {
            const aiAnalysis = decision.aiAnalysis || {};
            const enhanced = aiAnalysis?.enhanced_description || this._buildEnhancedDescription(payload.task, aiAnalysis);
            if (enhanced) {
              await this.taskAPI.updateTask(task.id, { description: enhanced });
            }
            await this.taskAPI.changeTaskStatus(task.id, 'todo');
            await this.cto.persistState();
            continue;
          }

          // CLARIFY: CTO already posted clarification and rescheduled
          if (decision.action === 'clarify') {
            await this.cto.persistState();
            continue;
          }

          // RETRY_EXECUTE: CTO rescheduled for next slot
          if (decision.action === 'retry_execute') {
            await this.cto.persistState();
            continue;
          }

          // BLOCK_CEO: CTO blocked task
          if (decision.action === 'block_ceo') {
            await this.cto.persistState();
            continue;
          }

          // DEFER: Skip this task for now
          if (decision.action === 'defer') {
            console.log(`[CTO] Deferring task "${task.title}": ${decision.reason}`);
            // Prevent repeated polling for deferred tasks
            this.processedTaskIds.add(task.id);
            await this.cto.persistState();
            continue;
          }

          // SKIP: Ignore this task
          if (decision.action === 'skip') {
            console.log(`[CTO] Skipping task "${task.title}": ${decision.reason}`);
            continue;
          }

          // Backlog tasks should never execute directly. Promote to todo first.
          if ((payload.task.status || '').toLowerCase() === 'backlog' && decision.action === 'execute') {
            console.log(`[CTO] Backlog task "${task.title}" requires CTO gate. Moving to todo for execution.`);

            // Enrich description for Team Lead when CTO decides to execute without splitting
            try {
              const aiAnalysis = decision.aiAnalysis || null;
              if (aiAnalysis) {
                const currentDescription = payload.task.description || '';
                if (!currentDescription.includes('## CTO Instructions')) {
                  const subtask = Array.isArray(aiAnalysis.subtasks) ? aiAnalysis.subtasks[0] : null;
                  const ctoBlock = [
                    '## CTO Instructions',
                    aiAnalysis.reasoning ? `**Reasoning:** ${aiAnalysis.reasoning}` : null,
                    aiAnalysis.strategy_note ? `**Strategy Note:** ${aiAnalysis.strategy_note}` : null,
                    subtask?.objective ? `**Objective:** ${subtask.objective}` : null,
                    subtask?.inputs ? `**Inputs:** ${subtask.inputs}` : null,
                    subtask?.guidelines ? `**Guidelines:** ${subtask.guidelines}` : null,
                    subtask?.expectedOutput ? `**Expected Output:** ${subtask.expectedOutput}` : null,
                    subtask?.estimatedDuration ? `**Estimated Duration:** ${subtask.estimatedDuration} minutes` : null,
                    subtask?.complexity ? `**Complexity:** ${subtask.complexity}` : null
                  ].filter(Boolean).join('\n\n');

                  const updatedDescription = currentDescription
                    ? `${currentDescription}\n\n${ctoBlock}`
                    : ctoBlock;

                  await this.taskAPI.updateTask(task.id, { description: updatedDescription });
                }
              }
            } catch (e) {
              console.warn('[CTO] Failed to enrich task description:', e.message);
            }

            await this.taskAPI.changeTaskStatus(task.id, 'todo');
            continue;
          }

          // If this is a subtask, ensure previous subtasks are completed before executing
          if (await this._deferIfPriorSubtasksIncomplete(payload.task)) {
            await this.cto.persistState();
            continue;
          }

          // EXECUTE: Run with CTO verification loop
          // Move to in-progress immediately when execution starts
          try {
            await this.taskAPI.changeTaskStatus(task.id, 'in-progress');
          } catch (e) {
            console.warn('[CTO] Failed to move task to in-progress:', e.message);
          }

          const reservationId = this.cto.reserveResources(decision.provider, decision.estimatedMessages || 12);
          let lastResult = null;
          let lastOutput = '';
          let passed = false;
          let blockedByCapacity = false;
          let capacityRetryUsed = false;
          const maxAttempts = this.cto.maxRetries + 1;

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            console.log(`[CTO] Attempt ${attempt + 1}/${maxAttempts} for "${task.title}"`);

            // Build prompt (retry prompt if not first attempt)
          let result;
          if (attempt === 0) {
              if (decision.provider === 'claude_sdk') {
                result = await this.sdkExecutor.executeKanbanTask(
                  payload.task, payload.history, payload.identity, payload.employees,
                  payload.project, payload.team, projectInfo.allEmployees,
                  { provider: decision.provider, model: decision.model, thinking: decision.thinking }
                );
              } else if (decision.provider === 'gemini') {
                result = await this.googleAdkExecutor.executeKanbanTask(
                  payload.task, payload.history, payload.identity, payload.employees,
                  payload.project, payload.team, projectInfo.allEmployees,
                  { provider: decision.provider, model: decision.model, actorType: 'team_lead' }
                );
              } else if (decision.provider === 'openai_sdk') {
                result = await this.openaiSdkExecutor.executeKanbanTask(
                  payload.task, payload.history, payload.identity, payload.employees,
                  payload.project, payload.team, projectInfo.allEmployees,
                  { provider: decision.provider, model: decision.model, actorType: 'team_lead' }
                );
              } else {
                result = await this.executor.executeKanbanTask(
                  payload.task, payload.history, payload.identity, payload.employees,
                  payload.project, payload.team, projectInfo.allEmployees,
                  { provider: decision.provider, model: decision.model }
                );
              }
            } else {
              // Re-prompt with retry context
              const verification = await this.cto.verifyCompletion(payload.task, lastResult);
              const retryPrompt = this.cto.buildRetryPrompt(
                payload.task, lastOutput, verification.missing, attempt
              );
              if (decision.provider === 'claude_sdk') {
                result = await this.sdkExecutor.executePrompt(retryPrompt, {
                  projectDir: payload.project.repository_path || process.cwd(),
                  identity: payload.identity,
                  employees: payload.employees,
                  model: decision.model,
                  thinking: decision.thinking
                });
              } else if (decision.provider === 'gemini') {
                result = await this.googleAdkExecutor.executePrompt(retryPrompt, {
                  projectDir: payload.project.repository_path || process.cwd(),
                  identity: payload.identity,
                  employees: payload.employees,
                  model: decision.model,
                  actorType: 'team_lead'
                });
              } else if (decision.provider === 'openai_sdk') {
                result = await this.openaiSdkExecutor.executePrompt(retryPrompt, {
                  projectDir: payload.project.repository_path || process.cwd(),
                  identity: payload.identity,
                  employees: payload.employees,
                  model: decision.model,
                  actorType: 'team_lead'
                });
              } else {
                result = await this.executor.executeTask(retryPrompt, {
                  provider: decision.provider,
                  model: decision.model,
                  mode: 'cli',
                  taskId: task.id,
                  workDir: payload.project.repository_path || process.cwd()
                });
              }
            }

            lastResult = result;
            lastOutput = result?.output || '';
            await this._recordUsageForExecution(payload.task, decision, result, 'team_lead');

            if (result?.needsApproval) {
              const approvalDetails = (result.approvalRequests || [])
                .map(r => `- ${r.tool_name || r.type || 'tool'} (${r.call_id || 'n/a'})`)
                .join('\n') || 'Approval required for tool usage.';
              const warningMsg = `CTO paused: Approval required before tool execution.\n${approvalDetails}`;
              try {
                await this.taskAPI.addComment(
                  task.id,
                  `To CEO:\n${warningMsg}`,
                  true,
                  { id: 'cto-system', name: 'CTO' }
                );
                await this.taskAPI.updateTask(task.id, {
                  status: 'blocked',
                  resource_metadata: JSON.stringify(this.cto._mergeResourceMetadata(task.resource_metadata, {
                    cto_warning: warningMsg,
                    cto_warning_at: new Date().toISOString()
                  }))
                });
              } catch (e) {
                console.warn('[CTO] Failed to mark approval-required task:', e.message);
              }
              blockedByCapacity = true;
              break;
            }

            // Detect provider capacity/quota errors and block the task with CEO attention
            const capacityError = this._detectCapacityError(lastOutput);
            if (capacityError) {
              if (!capacityRetryUsed) {
                capacityRetryUsed = true;
                console.warn(`[CTO] Capacity error detected. Retrying once after backoff: ${capacityError}`);
                await this.executor.sleep(2000);
                continue;
              }

              const warningMsg = `CTO paused: AI provider unavailable (${capacityError}). Task requires AI to proceed.`;
              try {
                await this.taskAPI.updateTask(task.id, {
                  status: 'blocked',
                  resource_metadata: JSON.stringify({
                    cto_warning: warningMsg,
                    cto_warning_at: new Date().toISOString()
                  })
                });
                await this.taskAPI.addComment(
                  task.id,
                  `To CEO:\n${warningMsg}`,
                  true,
                  { id: 'cto-system', name: 'CTO' }
                );
              } catch (e) {
                console.warn('[CTO] Failed to mark task blocked after capacity error:', e.message);
              }
              blockedByCapacity = true;
              break;
            }

            // Detect clarification request
            if (this._detectClarificationRequest(lastOutput)) {
              await this.taskAPI.updateTask(task.id, {
                status: 'blocked',
                resource_metadata: JSON.stringify({
                  cto_event: 'needs_clarification',
                  cto_warning: 'Team Lead requested clarification.',
                  cto_warning_at: new Date().toISOString()
                })
              });
              await this.taskAPI.addComment(
                task.id,
                `To CEO:\nTeam Lead requested clarification.\n\n${this._extractClarification(lastOutput)}`,
                true,
                { id: 'cto-system', name: 'CTO' }
              );
              blockedByCapacity = true;
              break;
            }

            // Verify completion
            const verification = await this.cto.verifyCompletion(payload.task, result);
            console.log(`[CTO] Verification: passed=${verification.passed}, score=${verification.score}`);

            if (verification.passed) {
              passed = true;

              // Extract completion report
              let completionReport = '';
              const reportMatch = lastOutput.match(/---COMPLETION REPORT---([\s\S]*?)---END REPORT---/);
              if (reportMatch && reportMatch[1]) {
                completionReport = reportMatch[1].trim();
              } else {
                const lines = lastOutput.trim().split('\n');
                completionReport = lines.slice(-10).join('\n');
              }

              // Record usage and mark for review
              this.cto.recordUsage(decision.provider, result.tokens_used || decision.estimatedMessages || 5, task.id);
              this.cto.releaseReservation(reservationId);

              // Record strategic outcome for CTO memory (high-level only, no tech details)
              if (this.cto) {
                  await this.cto.recordOutcome({
                    taskId: task.id,
                    title: task.title,
                    taskType: payload.task.task_type || 'task',
                    provider: decision.provider,
                    success: true,
                    reason: `Completed successfully on attempt ${attempt + 1}. Verification score: ${verification.score}/100`,
                    complexity: decision.complexity,
                    attempts: attempt + 1,
                    duration: result.duration,
                    teamId: payload?.team?.id || null,
                    teamName: payload?.team?.name || null
                  });
                }

              await this.taskAPI.markTaskForReviewWithMetadata(task.id, {
                execution_time: result.duration,
                tokens_used: result.tokens_used,
                files_modified: result.toolsUsed?.length || 0,
                model_used: decision.provider,
                execution_started_at: new Date(Date.now() - (result.duration || 0)).toISOString(),
                execution_completed_at: new Date().toISOString(),
                completion_report: completionReport + `\n\n_CTO: Passed on attempt ${attempt + 1}/${maxAttempts} (score: ${verification.score})_`
              });
              await this.taskAPI.addComment(
                task.id,
                `To CEO:\nTask executed and sent to review.\n- Provider: ${decision.provider}\n- Attempts: ${attempt + 1}/${maxAttempts}\n- Verification score: ${verification.score}\n\nSummary:\n${completionReport || 'No summary available.'}`,
                true,
                { id: 'cto-system', name: 'CTO' }
              );
              console.log(`[CTO] Task ${task.id} completed on attempt ${attempt + 1}. Marked for review.`);
              break;
            }

            // If final attempt failed, don't retry
            if (attempt === maxAttempts - 1) {
              console.log(`[CTO] Task ${task.id} failed after ${maxAttempts} attempts. Escalating to CEO.`);
            }
          }

          // If all attempts failed, move to blocked (no for-review on failures)
          if (!passed && !blockedByCapacity) {
            this.cto.releaseReservation(reservationId);
            this.cto.recordUsage(decision.provider, (decision.estimatedMessages || 5) * maxAttempts, task.id);

            // Record strategic outcome for CTO memory (high-level only)
            if (this.cto) {
              const verification = await this.cto.verifyCompletion(payload.task, lastResult);
                await this.cto.recordOutcome({
                  taskId: task.id,
                  title: task.title,
                  taskType: payload.task.task_type || 'task',
                  provider: decision.provider,
                  success: false,
                  reason: `Failed after ${maxAttempts} attempts. Missing: ${verification.missing || 'Unknown'}`,
                  complexity: decision.complexity,
                  attempts: maxAttempts,
                  duration: lastResult?.duration,
                  teamId: payload?.team?.id || null,
                  teamName: payload?.team?.name || null
                });
              }

            await this.taskAPI.updateTask(task.id, {
              status: 'backlog',
              resource_metadata: JSON.stringify({
                cto_event: 'execution_failed',
                cto_warning: `Team Lead failed after ${maxAttempts} attempts.`,
                cto_warning_at: new Date().toISOString()
              })
            });
            await this.taskAPI.addComment(
              task.id,
              `To CEO:\nExecution failed. Task returned to backlog for CTO review.\n- Provider: ${decision.provider}\n- Attempts: ${maxAttempts}/${maxAttempts}\n\nLast output summary:\n${this.cto._summarizeOutput(lastOutput, 1000)}`,
              true,
              { id: 'cto-system', name: 'CTO' }
            );
            console.log(`[CTO] Task ${task.id} returned to backlog after failed execution.`);
          }

          await this.cto.persistState();
          continue;
        }

        // ===== FALLBACK: No CTO, execute directly (legacy behavior) =====
        if (await this._deferIfPriorSubtasksIncomplete(payload.task)) {
          continue;
        }
        try {
          await this.taskAPI.changeTaskStatus(task.id, 'in-progress');
        } catch (e) {
          console.warn('[Runner] Failed to move task to in-progress:', e.message);
        }
        const result = await this.executor.executeKanbanTask(
          payload.task, payload.history, payload.identity, payload.employees,
          payload.project, payload.team, projectInfo.allEmployees
        );
        await this._recordUsageForExecution(payload.task, { provider: 'auto', model: null }, result, 'team_lead');

        // Update task status and post results
        if (result && result.success) {
          console.log(`[Runner] Task completed successfully. Updating status...`);

          let completionReport = '';
          const reportMatch = result.output.match(/---COMPLETION REPORT---([\s\S]*?)---END REPORT---/);
          if (reportMatch && reportMatch[1]) {
            completionReport = reportMatch[1].trim();
          } else {
            const lines = result.output.trim().split('\n');
            completionReport = lines.slice(-10).join('\n');
          }

          await this.taskAPI.markTaskForReviewWithMetadata(task.id, {
            execution_time: result.duration,
            tokens_used: result.tokens_used,
            files_modified: result.toolsUsed?.length || 0,
            model_used: payload.identity?.model_config ? JSON.parse(payload.identity.model_config).provider : 'unknown',
            execution_started_at: new Date(Date.now() - (result.duration || 0)).toISOString(),
            execution_completed_at: new Date().toISOString(),
            completion_report: completionReport
          });
          await this.taskAPI.addComment(
            task.id,
            `To CEO:\nTask completed and sent to review.\n- Provider: ${payload.identity?.model_config ? JSON.parse(payload.identity.model_config).provider : 'unknown'}\n\nSummary:\n${completionReport || 'No summary available.'}`,
            true,
            { id: 'cto-system', name: 'CTO' }
          );
          console.log(`[Runner] Task ${task.id} marked for review with completion report`);
        } else {
          console.log(`[Runner] Task execution failed or incomplete`);
        }
      }
    } catch (error) {
      console.error('[Runner] Polling error:', error.message);
      console.error('[Runner] Error stack:', error.stack);
    } finally {
      this.isPolling = false;
    }
  }

  _detectCapacityError(output = '') {
    const text = String(output).toLowerCase();
    const patterns = [
      'exhausted your capacity',
      'quota',
      'rate limit',
      'capacity',
      'insufficient_quota',
      'billing',
      'credit balance is too low',
      'too many requests'
    ];
    return patterns.find(p => text.includes(p)) || null;
  }

  _detectClarificationRequest(output = '') {
    const text = String(output);
    return text.includes('---NEEDS_CLARIFICATION---');
  }

  _extractClarification(output = '') {
    const text = String(output);
    const match = text.match(/---NEEDS_CLARIFICATION---([\s\S]*?)---END_CLARIFICATION---/);
    return match ? match[1].trim() : text.slice(0, 1000);
  }

  _buildEnhancedDescription(task, aiAnalysis = {}) {
    const sub = Array.isArray(aiAnalysis.subtasks) ? aiAnalysis.subtasks[0] : null;
    const parts = [];
    parts.push(task.description || '');
    if (aiAnalysis.reasoning) parts.push(`CTO Reasoning: ${aiAnalysis.reasoning}`);
    if (aiAnalysis.strategy_note) parts.push(`CTO Strategy: ${aiAnalysis.strategy_note}`);
    if (sub?.objective) parts.push(`Objective: ${sub.objective}`);
    if (sub?.inputs) parts.push(`Inputs: ${sub.inputs}`);
    if (sub?.guidelines) parts.push(`Guidelines: ${sub.guidelines}`);
    if (sub?.expectedOutput) parts.push(`Expected Output: ${sub.expectedOutput}`);
    return parts.filter(Boolean).join('\n\n');
  }

  async reviewTasks() {
    if (this.isReviewing || !this.cto) return;
    this.isReviewing = true;

    try {
      const projects = await this.taskAPI.getRunnerProjects(this.runnerToken);
      for (const project of projects) {
        const tasks = await this.taskAPI.getTasksByStatus(project.id, 'for-review');
        for (const task of tasks) {
          if (!this.cto || this.cto.autonomyLevel !== 'full') continue;
          
          console.log(`[CTO] Watcher: Reviewing task "${task.title}"...`);
          const payload = await this.taskAPI.getRunnerPayload(task.id);
          await this.cto.reviewTask(task, payload);
        }
      }
    } catch (e) {
      // console.error('[Review] Watcher error:', e.message);
    } finally {
      this.isReviewing = false;
    }
  }

  async _deferIfPriorSubtasksIncomplete(task) {
    try {
      if (!task?.parent_id || !task.scheduled_date || !task.scheduled_time) return false;
      const scheduledAt = new Date(`${task.scheduled_date}T${task.scheduled_time}`);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt > new Date()) return false;

      const siblings = await this.taskAPI.getSubtasks(task.parent_id);
      if (!Array.isArray(siblings) || siblings.length === 0) return false;

      const currentTime = scheduledAt.getTime();
      const doneStatuses = new Set(['done', 'completed', 'cancelled', 'archived']);
      const hasIncompletePrior = siblings.some(s => {
        if (!s.scheduled_date || !s.scheduled_time) return false;
        const siblingTime = new Date(`${s.scheduled_date}T${s.scheduled_time}`).getTime();
        if (Number.isNaN(siblingTime)) return false;
        return siblingTime < currentTime && !doneStatuses.has(String(s.status || '').toLowerCase());
      });

      if (!hasIncompletePrior) return false;

      const deferUntil = new Date(Date.now() + 30 * 60 * 1000);
      const deferDate = this._formatLocalDate(deferUntil);
      const deferTime = this._formatLocalTime(deferUntil);

      await this.taskAPI.updateTask(task.id, {
        scheduled_date: deferDate,
        scheduled_time: deferTime
      });
      await this.taskAPI.addComment(
        task.id,
        `To CEO:\nCTO deferred execution until ${deferDate} ${deferTime} because a previous subtask is still incomplete.`,
        true,
        { id: 'cto-system', name: 'CTO' }
      );
      console.log(`[CTO] Deferred subtask ${task.id} because previous subtask is incomplete.`);
      return true;
    } catch (e) {
      console.warn('[CTO] Failed to defer subtask due to dependency check:', e.message);
      return false;
    }
  }

  _formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  _formatLocalTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  startWebhookServer() {
    // Webhook server is optional - polling is the primary mechanism
    const webhookPort = config.webhook?.port || 3002;

    this.app.use(express.json());
    this.app.post('/webhook/task-assigned', async (req, res) => {
      const webhookData = req.body;
      const action = webhookData.action || 'task_assigned';
      
      console.log(`[Webhook] Received event: ${action} for task "${webhookData.title}"`);
      res.json({ success: true });

      // Handle Review Requests (Async Ping-Pong)
      if (action === 'review_requested' && this.cto) {
        console.log(`[Webhook] Triggering instant CTO review...`);
        const payload = await this.taskAPI.getRunnerPayload(webhookData.id);
        const fullTask = await this.taskAPI.getTask(webhookData.id);
        if (fullTask) {
          await this.cto.reviewTask(fullTask, payload);
        }
        return;
      }

      // Handle Clarification Requests
      if (action === 'comment_added' && this.cto) {
        const comments = await this.taskAPI.getComments(webhookData.id);
        const latestComment = comments[comments.length - 1];
        
        // If comment starts with "CTO," trigger clarification logic
        if (latestComment && latestComment.content.trim().toUpperCase().startsWith('CTO,')) {
          console.log(`[Webhook] CTO Clarification requested for task: ${webhookData.title}`);
          const payload = await this.taskAPI.getRunnerPayload(webhookData.id);
          await this.cto.handleClarification(webhookData.id, latestComment.content, payload);
        }
        return;
      }

      // Handle Standard Task Assignment (Execution)
      const payload = await this.taskAPI.getRunnerPayload(webhookData.id);
      
      // Sync Runner Brain before executing
      const projectInfo = await this.taskAPI.getProjectInfo(this.runnerToken, payload.project.id);
      await this.executor.syncRunnerBrain(projectInfo.allEmployees || [], projectInfo.teams || []);

      if (this.cto && this.cto.enabled) {
        // ... (CTO logic will be picked up by the next poll cycle or we can trigger it here)
        // For now, let's trigger a poll immediately to handle it uniformly
        this.pollForTasks(); 
      } else {
        this.executor.executeKanbanTask(
          payload.task,
          payload.history,
          payload.identity,
          payload.employees,
          payload.project
        );
      }
    });

    const server = this.app.listen(webhookPort)
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`⚠️  Webhook server port ${webhookPort} is busy - continuing with polling only`);
        } else {
          console.error('[Webhook] Server error:', err.message);
        }
      })
      .on('listening', () => {
        console.log(`🎣 Webhook server listening on port ${webhookPort}`);
      });
  }
}

module.exports = AgentRunner;

// Main execution when run directly
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');

  // Load config
  const configPath = path.join(__dirname, 'config.json');
  let config;

  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configData);
  } catch (e) {
    console.error('❌ Failed to load config.json');
    console.error('   Run: npx agent-runner connect -t <your-runner-token>');
    process.exit(1);
  }

  // Start runner
  const runner = new AgentRunner(config);
  runner.start();

  // Handle shutdown gracefully
  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    process.exit(0);
  });
}
