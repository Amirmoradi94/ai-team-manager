const cron = require('node-cron');
const express = require('express');
const TaskManagerAPI = require('./task-manager-api');
const AgentExecutor = require('./agent-executor');
const config = require('./config.json');

class AgentRunner {
  constructor(runtimeConfig) {
    const activeConfig = runtimeConfig || config;
    this.taskAPI = new TaskManagerAPI(activeConfig.taskManagerAPI);
    this.executor = new AgentExecutor(this.taskAPI);
    this.app = express();
    this.scheduledJobs = new Map();
    this.isPolling = false;
    this.runnerToken = activeConfig.taskManagerAPI.projectToken || activeConfig.taskManagerAPI.runnerToken;
  }

  /**
   * Start the runner loop
   */
  async start() {
    console.log('🤖 Universal Agent Runner Starting...');
    console.log(`🔑 User Token: ${this.runnerToken.substring(0, 5)}...`);
    console.log('📁 Monitoring all your projects');

    // 1. Initial Check-in (Heartbeat)
    console.log('[Debug] Sending initial heartbeat...');
    await this.checkIn();
    console.log('[Debug] Initial heartbeat complete');

    // 3. Start Heartbeat Interval (every 30s)
    console.log('[Debug] Starting heartbeat interval...');
    setInterval(() => this.checkIn(), 30000);

    // 4. Start Environment Sync (every 20s)
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
      // Send heartbeat to server to show as "Online" in UI
      await this.taskAPI.sendHeartbeat(this.runnerToken);
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

        await this.executor.executeKanbanTask(
          payload.task,
          payload.history,
          payload.identity,
          payload.specialists,
          payload.project,
          payload.team,  // Pass team object
          projectInfo.allSpecialists  // Pass all specialists
        );
      }
    } catch (error) {
      // console.error('[Runner] Polling error:', error.message);
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