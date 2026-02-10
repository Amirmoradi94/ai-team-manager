const cron = require('node-cron');
const express = require('express');
const path = require('path');
const TaskManagerAPI = require('./task-manager-api');
const AgentExecutor = require('./agent-executor');
const config = require('./config.json');
const { CTOEngine } = require('./cto');

class AgentRunner {
  constructor(runtimeConfig) {
    const activeConfig = runtimeConfig || config;
    this.taskAPI = new TaskManagerAPI(activeConfig.taskManagerAPI);
    this.executor = new AgentExecutor(this.taskAPI);
    this.app = express();
    this.scheduledJobs = new Map();
    this.isPolling = false;
    this.runnerToken = activeConfig.taskManagerAPI.projectToken || activeConfig.taskManagerAPI.runnerToken;

    // CTO Intelligence Layer with AI-powered decision-making
    this.cto = activeConfig.cto?.enabled
      ? new CTOEngine(
          this.taskAPI,
          activeConfig.cto,
          path.join(__dirname, 'team_lead'),
          this.executor  // Pass executor so CTO can use AI models
        )
      : null;
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

    // 4. Start Resource Refresh (every 10m) - Sync with cmonitor/gcloud
    if (this.cto) {
      console.log('[CTO] Starting periodic resource refresh (10m)...');
      setInterval(() => this.cto.refreshResourceStatus(), 10 * 60 * 1000);
      
      // Also sync settings from UI every 20s
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

    // 6. Start Webhook Server (optional fallback)
    console.log('[Debug] Starting webhook server...');
    this.startWebhookServer();

    console.log('\n✅ Runner is active and syncing all project environments.');
    console.log('Press Ctrl+C to stop\n');
  }

  async syncAllProjectEnvironments() {
    try {
      const projects = await this.taskAPI.getRunnerProjects(this.runnerToken);

      // First, sync Runner Brain (global intelligence) - ALWAYS, even without projects
      // Teams and specialists are global resources independent of projects
      const payload = await this.taskAPI.getProjectInfo(this.runnerToken, projects[0]?.id);
      await this.executor.syncRunnerBrain(payload.allSpecialists || [], payload.teams || []);

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
      // Get latest resource status if CTO is enabled
      const resourceStatus = this.cto ? this.cto.getResourceStatus() : null;
      
      // Send heartbeat to server to show as "Online" in UI
      await this.taskAPI.sendHeartbeat(this.runnerToken, resourceStatus);
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
        console.log(`\n[Runner] New task detected: ${task.title}`);
        console.log(`[Runner] Project: ${task.project_name || 'Unknown'}`);
        console.log(`[Runner] Switching to: ${task.project_repository_path || process.cwd()}`);

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

        // Sync Runner Brain before executing (ensures latest teams/specialists)
        const projectInfo = await this.taskAPI.getProjectInfo(this.runnerToken, payload.project.id);
        await this.executor.syncRunnerBrain(projectInfo.allSpecialists || [], projectInfo.teams || []);

        // ===== CTO INTELLIGENCE LAYER =====
        if (this.cto && this.cto.enabled) {
          const decision = await this.cto.evaluate(payload.task, payload);
          console.log(`[CTO] Decision: ${decision.action} | Reason: ${decision.reason}`);

          // SPLIT: Create subtasks, mark parent as epic, skip to next
          if (decision.action === 'split') {
            console.log(`[CTO] Splitting task "${task.title}" into subtasks...`);
            await this.cto.splitTask(payload.task, payload);
            await this.cto.persistState();
            continue;
          }

          // DEFER: Skip this task for now
          if (decision.action === 'defer') {
            console.log(`[CTO] Deferring task "${task.title}": ${decision.reason}`);
            await this.cto.persistState();
            continue;
          }

          // SKIP: Ignore this task
          if (decision.action === 'skip') {
            console.log(`[CTO] Skipping task "${task.title}": ${decision.reason}`);
            continue;
          }

          // EXECUTE: Run with CTO verification loop
          const reservationId = this.cto.reserveResources(decision.provider, decision.estimatedMessages || 12);
          let lastResult = null;
          let lastOutput = '';
          let passed = false;
          const maxAttempts = this.cto.maxRetries + 1;

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            console.log(`[CTO] Attempt ${attempt + 1}/${maxAttempts} for "${task.title}"`);

            // Build prompt (retry prompt if not first attempt)
            let result;
            if (attempt === 0) {
              result = await this.executor.executeKanbanTask(
                payload.task, payload.history, payload.identity, payload.specialists,
                payload.project, payload.team, projectInfo.allSpecialists
              );
            } else {
              // Re-prompt with retry context
              const verification = await this.cto.verifyCompletion(payload.task, lastResult);
              const retryPrompt = this.cto.buildRetryPrompt(
                payload.task, lastOutput, verification.missing, attempt
              );
              result = await this.executor.executeTask(retryPrompt, {
                provider: decision.provider,
                mode: 'cli',
                taskId: task.id,
                workDir: payload.project.repository_path || process.cwd()
              });
            }

            lastResult = result;
            lastOutput = result?.output || '';

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
              if (this.cto.taskHistory) {
                await this.cto.taskHistory.recordOutcome({
                  taskId: task.id,
                  title: task.title,
                  taskType: payload.task.task_type || 'task',
                  provider: decision.provider,
                  success: true,
                  reason: `Completed successfully on attempt ${attempt + 1}. Verification score: ${verification.score}/100`,
                  complexity: decision.complexity,
                  attempts: attempt + 1,
                  duration: result.duration
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
              console.log(`[CTO] Task ${task.id} completed on attempt ${attempt + 1}. Marked for review.`);
              break;
            }

            // If final attempt failed, don't retry
            if (attempt === maxAttempts - 1) {
              console.log(`[CTO] Task ${task.id} failed after ${maxAttempts} attempts. Escalating to CEO.`);
            }
          }

          // If all attempts failed, escalate
          if (!passed) {
            this.cto.releaseReservation(reservationId);
            this.cto.recordUsage(decision.provider, (decision.estimatedMessages || 5) * maxAttempts, task.id);

            // Record strategic outcome for CTO memory (high-level only)
            if (this.cto.taskHistory) {
              const verification = await this.cto.verifyCompletion(payload.task, lastResult);
              await this.cto.taskHistory.recordOutcome({
                taskId: task.id,
                title: task.title,
                taskType: payload.task.task_type || 'task',
                provider: decision.provider,
                success: false,
                reason: `Failed after ${maxAttempts} attempts. Missing: ${verification.missing || 'Unknown'}`,
                complexity: decision.complexity,
                attempts: maxAttempts,
                duration: lastResult?.duration
              });
            }

            await this.taskAPI.markTaskForReviewWithMetadata(task.id, {
              execution_time: lastResult?.duration,
              tokens_used: lastResult?.tokens_used,
              model_used: decision.provider,
              execution_started_at: new Date(Date.now() - (lastResult?.duration || 0)).toISOString(),
              execution_completed_at: new Date().toISOString(),
              completion_report: `**ESCALATED TO CEO** - Task failed after ${maxAttempts} attempts.\n\nLast output summary:\n${this.cto._summarizeOutput(lastOutput, 1000)}`
            });
            console.log(`[CTO] Task ${task.id} escalated to CEO (for-review with failure report)`);
          }

          await this.cto.persistState();
          continue;
        }

        // ===== FALLBACK: No CTO, execute directly (legacy behavior) =====
        const result = await this.executor.executeKanbanTask(
          payload.task, payload.history, payload.identity, payload.specialists,
          payload.project, payload.team, projectInfo.allSpecialists
        );

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

  startWebhookServer() {
    // Webhook server is optional - polling is the primary mechanism
    const webhookPort = config.webhook?.port || 3002;

    this.app.use(express.json());
    this.app.post('/webhook/task-assigned', async (req, res) => {
      const webhookData = req.body;
      console.log(`[Webhook] Immediate task received: ${webhookData.title}`);
      res.json({ success: true });

      const payload = await this.taskAPI.getRunnerPayload(webhookData.id);
      this.executor.executeKanbanTask(
        payload.task,
        payload.history,
        payload.identity,
        payload.specialists,
        payload.project
      );
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