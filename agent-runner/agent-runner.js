const cron = require('node-cron');
const express = require('express');
const TaskManagerAPI = require('./task-manager-api');
const AgentExecutor = require('./agent-executor');
const config = require('./config.json');

class AgentRunner {
  constructor() {
    this.taskAPI = new TaskManagerAPI(config.taskManagerAPI);
    this.executor = new AgentExecutor(this.taskAPI);
    this.app = express();
    this.scheduledJobs = new Map();
    this.isPolling = false;
    this.projectToken = config.taskManagerAPI.projectToken;
  }

  /**
   * Start the runner loop
   */
  async start() {
    console.log('🤖 AI Team Agent Runner Starting...');
    console.log(`🔑 Project Token: ${this.projectToken.substring(0, 5)}...`);

    // 1. Initial Check-in (Heartbeat)
    await this.checkIn();

    // 2. Start Heartbeat Interval (every 30s)
    setInterval(() => this.checkIn(), 30000);

    // 3. Start Task Polling (every 10s)
    console.log('📡 Polling for tasks...');
    setInterval(() => this.pollForTasks(), 10000);

    // 4. Start Webhook Server (optional fallback)
    this.startWebhookServer();

    console.log('\n✅ Runner is active and waiting for tasks.');
    console.log('Press Ctrl+C to stop\n');
  }

  async checkIn() {
    try {
      // Send heartbeat to server to show as "Online" in UI
      await this.taskAPI.sendHeartbeat(this.projectToken);
      // console.log(`[Runner] Heartbeat sent at ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error('[Runner] Heartbeat failed. Check your connection or token.');
    }
  }

  async pollForTasks() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      // Fetch all tasks assigned to the project linked to this token
      // The API should filter tasks by the authenticated projectToken
      const tasks = await this.taskAPI.getAllTasks();
      const pendingTasks = tasks.filter(t => t.status === 'todo');

      for (const task of pendingTasks) {
        console.log(`\n[Runner] New task detected: ${task.title}`);
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

    this.app.listen(config.webhook?.port || 3002);
  }
}

module.exports = AgentRunner;