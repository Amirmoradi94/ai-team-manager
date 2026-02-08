const cron = require('node-cron');
const express = require('express');
const KanbanChecker = require('./kanban-checker');
const ClaudeExecutor = require('./claude-executor');
const config = require('./config.json');

class ClaudeTaskScheduler {
  constructor() {
    this.kanbanChecker = new KanbanChecker(config.kanban);
    this.claudeExecutor = new ClaudeExecutor();
    this.app = express();
    this.scheduledJobs = [];

    // Setup webhook receiver
    this.app.use(express.json());
    this.setupWebhookEndpoint();
  }

  setupWebhookEndpoint() {
    this.app.post('/webhook/task-assigned', async (req, res) => {
      console.log('[Webhook] Received task assignment notification');

      // Verify webhook secret
      const receivedSecret = req.headers['x-webhook-secret'];
      if (receivedSecret !== config.webhook.secret) {
        console.error('[Webhook] Invalid secret');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const task = req.body;
      console.log(`[Webhook] Task: ${task.title}`);

      try {
        // Execute the task immediately
        const result = await this.claudeExecutor.executeKanbanTask(task);

        res.json({
          success: true,
          message: 'Task received and queued',
          logFile: result.logFile
        });

        // Send notification
        this.sendNotification(`Task "${task.title}" completed`, result);
      } catch (error) {
        console.error('[Webhook] Error processing task:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'running',
        scheduledJobs: this.scheduledJobs.length,
        uptime: process.uptime()
      });
    });
  }

  async checkKanbanAndExecute() {
    console.log('\n=== Scheduled Kanban Check ===');
    console.log(new Date().toISOString());

    try {
      await this.kanbanChecker.initialize();
      await this.kanbanChecker.login();

      const tasks = await this.kanbanChecker.getAssignedTasks();

      if (tasks.length > 0) {
        console.log(`\n[Scheduler] Found ${tasks.length} task(s) to execute`);

        for (const task of tasks) {
          console.log(`\n[Scheduler] Processing: ${task.title}`);

          // Check if task should be executed now based on due date/schedule
          if (this.shouldExecuteNow(task)) {
            const result = await this.claudeExecutor.executeKanbanTask(task);
            this.sendNotification(`Completed: ${task.title}`, result);
          } else {
            console.log(`[Scheduler] Task scheduled for later: ${task.dueDate}`);
          }
        }
      } else {
        console.log('[Scheduler] No tasks assigned to Claude');
      }

      await this.kanbanChecker.close();
    } catch (error) {
      console.error('[Scheduler] Error during check:', error.message);
    }
  }

  shouldExecuteNow(task) {
    // Simple logic - can be enhanced with more sophisticated scheduling
    if (!task.dueDate) return true; // No due date = execute now

    const dueDate = new Date(task.dueDate);
    const now = new Date();

    // Execute if due date is today or past
    return dueDate <= now;
  }

  schedulePeriodicChecks() {
    console.log(`[Scheduler] Setting up periodic check: ${config.schedule.checkInterval}`);

    const job = cron.schedule(config.schedule.checkInterval, () => {
      this.checkKanbanAndExecute();
    });

    this.scheduledJobs.push({ name: 'periodic-check', job });
  }

  scheduleSpecificTasks() {
    config.schedule.specificTasks.forEach(taskConfig => {
      console.log(`[Scheduler] Scheduling: ${taskConfig.name} (${taskConfig.cron})`);

      const job = cron.schedule(taskConfig.cron, () => {
        console.log(`\n[Scheduler] Executing scheduled task: ${taskConfig.name}`);
        this.claudeExecutor.executeTask(taskConfig.description);
      });

      this.scheduledJobs.push({ name: taskConfig.name, job });
    });
  }

  sendNotification(subject, details) {
    console.log(`\n📧 [Notification] ${subject}`);
    console.log(JSON.stringify(details, null, 2));

    // Here you could integrate with email, Slack, Discord, etc.
    // Example: nodemailer, @slack/web-api, etc.
  }

  startWebhookServer() {
    this.app.listen(config.webhook.port, () => {
      console.log(`\n🎣 [Webhook] Server listening on port ${config.webhook.port}`);
      console.log(`   POST http://localhost:${config.webhook.port}/webhook/task-assigned`);
      console.log(`   Headers: x-webhook-secret: ${config.webhook.secret}`);
    });
  }

  async start() {
    console.log('🤖 Claude Task Scheduler Starting...\n');

    // Schedule periodic kanban checks
    this.schedulePeriodicChecks();

    // Schedule specific tasks
    this.scheduleSpecificTasks();

    // Start webhook server
    this.startWebhookServer();

    // Do an immediate check on startup
    console.log('[Scheduler] Running initial check...');
    await this.checkKanbanAndExecute();

    console.log('\n✅ Scheduler is now running!');
    console.log('Press Ctrl+C to stop\n');
  }

  stop() {
    console.log('\n[Scheduler] Stopping all jobs...');
    this.scheduledJobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`  Stopped: ${name}`);
    });
    process.exit(0);
  }
}

// Main execution
if (require.main === module) {
  const scheduler = new ClaudeTaskScheduler();

  scheduler.start().catch(error => {
    console.error('Failed to start scheduler:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => scheduler.stop());
  process.on('SIGTERM', () => scheduler.stop());
}

module.exports = ClaudeTaskScheduler;
