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
    await this.checkIn();

    // 2. Start Heartbeat Interval (every 30s)
    setInterval(() => this.checkIn(), 30000);

    // 3. Start Task Polling (every 10s)
    console.log('📡 Polling for tasks...');
    setInterval(() => this.pollForTasks(), 10000);

    // 4. Start Webhook Server (optional fallback)
    this.startWebhookServer();

    console.log('\n✅ Runner is active and waiting for tasks from all projects.');
    console.log('Press Ctrl+C to stop\n');
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
            process.chdir(task.project_repository_path);
          } catch (e) {
            console.error(`[Runner] Failed to change directory: ${e.message}`);
          }
        }

        const payload = await this.taskAPI.getRunnerPayload(task.id);
        await this.executor.executeKanbanTask(
          payload.task,
          payload.history,
          payload.identity,
          payload.specialists,
          payload.project
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