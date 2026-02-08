const cron = require('node-cron');
const express = require('express');
const TaskManagerAPI = require('./task-manager-api');
const ClaudeExecutor = require('./claude-executor');
const config = require('./config.json');

class ClaudeTaskScheduler {
  constructor() {
    this.taskAPI = new TaskManagerAPI(config.taskManagerAPI);
    this.claudeExecutor = new ClaudeExecutor();
    this.app = express();
    this.scheduledJobs = new Map(); // Track scheduled tasks by ID
    this.isAuthenticated = false;

    // Setup CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-webhook-secret');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

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

      const webhookData = req.body;
      console.log(`[Webhook] Task: ${webhookData.title}`);
      console.log(`[Webhook] Assigned to: ${webhookData.assignee_name}`);

      // Check if task is assigned to Claude
      const assigneeName = (webhookData.assignee_name || '').toLowerCase();
      if (assigneeName !== 'claude') {
        console.log('[Webhook] Task not assigned to Claude, ignoring');
        return res.json({
          success: false,
          message: 'Task not assigned to Claude'
        });
      }

      // Respond immediately (non-blocking)
      res.json({
        success: true,
        message: 'Task received and will be processed',
        taskId: webhookData.id
      });

      // Fetch full task details from API and process in background
      try {
        const fullTask = await this.taskAPI.getTask(webhookData.id);
        this.processTask(fullTask);
      } catch (error) {
        console.error(`[Webhook] Error fetching task ${webhookData.id}:`, error);
      }
    });

    // Task deletion webhook endpoint
    this.app.post('/webhook/task-deleted', async (req, res) => {
      console.log('[Webhook] Received task deletion notification');

      // Verify webhook secret
      const receivedSecret = req.headers['x-webhook-secret'];
      if (receivedSecret !== config.webhook.secret) {
        console.error('[Webhook] Invalid secret');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id: taskId } = req.body;
      console.log(`[Webhook] Deleting task: ${taskId}`);

      // Remove scheduled job if exists
      if (this.scheduledJobs.has(taskId)) {
        this.scheduledJobs.get(taskId).stop();
        this.scheduledJobs.delete(taskId);
        console.log(`[Scheduler] Removed scheduled job for deleted task ${taskId}`);
      }

      res.json({
        success: true,
        message: 'Task deletion processed'
      });
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'running',
        authenticated: this.isAuthenticated,
        scheduledTasks: this.scheduledJobs.size,
        uptime: process.uptime()
      });
    });
  }

  async processTask(task) {
    try {
      // Ensure we're authenticated
      if (!this.isAuthenticated) {
        await this.taskAPI.login();
        this.isAuthenticated = true;
      }

      // Determine if task should run immediately or be scheduled
      if (this.isImmediateTask(task)) {
        console.log(`[Scheduler] Executing task immediately: ${task.title}`);
        await this.executeTask(task);
      } else {
        console.log(`[Scheduler] Scheduling task for later: ${task.title}`);
        this.scheduleFutureTask(task);
      }
    } catch (error) {
      console.error('[Scheduler] Error processing task:', error);
      this.sendNotification(`❌ Error processing task "${task.title}"`, { error: error.message });
    }
  }

  isImmediateTask(task) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // If no date/time specified, execute immediately
    if (!task.scheduled_date && !task.scheduled_time && !task.due_date) {
      return true;
    }

    // If has scheduled date and time, check if it's within the next 5 minutes
    if (task.scheduled_date && task.scheduled_time) {
      const scheduledDateTime = new Date(`${task.scheduled_date}T${task.scheduled_time}`);
      const timeDiff = scheduledDateTime - now;
      const fiveMinutes = 5 * 60 * 1000;

      // Execute if scheduled time is now or within next 5 minutes
      return timeDiff >= 0 && timeDiff <= fiveMinutes;
    }

    // If has only scheduled date (no time), check if it's today
    if (task.scheduled_date) {
      return task.scheduled_date === today;
    }

    // If has only due date, check if it's today or past
    if (task.due_date) {
      return task.due_date <= today;
    }

    // Default: execute immediately
    return true;
  }

  scheduleFutureTask(task) {
    const now = new Date();
    let scheduledDateTime;

    // Determine when to schedule the task
    if (task.scheduled_date && task.scheduled_time) {
      scheduledDateTime = new Date(`${task.scheduled_date}T${task.scheduled_time}`);
    } else if (task.scheduled_date) {
      // If only date, schedule for 9 AM on that date
      scheduledDateTime = new Date(`${task.scheduled_date}T09:00:00`);
    } else if (task.due_date) {
      // If only due date, schedule for 9 AM on that date
      scheduledDateTime = new Date(`${task.due_date}T09:00:00`);
    } else {
      // No date info, execute immediately
      console.log('[Scheduler] No schedule info, executing immediately');
      this.executeTask(task);
      return;
    }

    // Check if scheduled time is in the past
    if (scheduledDateTime <= now) {
      console.log('[Scheduler] Scheduled time is in the past, executing immediately');
      this.executeTask(task);
      return;
    }

    // Create cron expression from scheduled datetime
    const minute = scheduledDateTime.getMinutes();
    const hour = scheduledDateTime.getHours();
    const dayOfMonth = scheduledDateTime.getDate();
    const month = scheduledDateTime.getMonth() + 1;
    const cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} *`;

    console.log(`[Scheduler] Creating cron job: ${cronExpression} for task "${task.title}"`);
    console.log(`[Scheduler] Will execute at: ${scheduledDateTime.toISOString()}`);

    // Cancel existing job for this task if any
    if (this.scheduledJobs.has(task.id)) {
      this.scheduledJobs.get(task.id).stop();
      console.log(`[Scheduler] Cancelled existing job for task ${task.id}`);
    }

    // Create new cron job
    const job = cron.schedule(cronExpression, async () => {
      console.log(`\n[Scheduler] Executing scheduled task: ${task.title}`);
      await this.executeTask(task);

      // Remove job after execution
      this.scheduledJobs.delete(task.id);
    });

    this.scheduledJobs.set(task.id, job);
  }

  async executeTask(task) {
    const executionStartTime = new Date();

    try {
      // Mark task as in progress
      await this.taskAPI.markTaskInProgress(task.id);
      console.log(`[Scheduler] Marked task ${task.id} as in-progress`);

      // Fetch all comments for context (including previous work and change requests)
      let comments = [];
      try {
        comments = await this.taskAPI.getTaskComments(task.id);
        console.log(`[Scheduler] Fetched ${comments.length} comment(s) for task context`);
      } catch (commentError) {
        console.warn(`[Scheduler] Could not fetch comments:`, commentError.message);
      }

      // Execute the task with full context
      const result = await this.claudeExecutor.executeKanbanTask(task, comments);
      const executionEndTime = new Date();
      const executionTime = executionEndTime - executionStartTime; // in milliseconds

      // Mark task for review if successful (not done, requires human approval)
      if (result.success) {
        // Post success comment
        const successComment = `✅ **Task Completed**\n\n${result.output || 'Task completed successfully.'}`;

        try {
          await this.taskAPI.addComment(task.id, successComment, true);
          console.log(`[Scheduler] Posted success comment to task ${task.id}`);
        } catch (commentError) {
          console.error(`[Scheduler] Failed to post comment:`, commentError);
        }
        // Prepare execution metadata
        const metadata = {
          execution_time: executionTime,
          tokens_used: result.tokens_used || null,
          files_modified: result.files_modified || null,
          model_used: result.model_used || 'claude-sonnet-4.5',
          execution_started_at: executionStartTime.toISOString(),
          execution_completed_at: executionEndTime.toISOString()
        };

        await this.taskAPI.markTaskForReviewWithMetadata(task.id, metadata);
        console.log(`[Scheduler] Marked task ${task.id} as for-review with metadata`);
        this.sendNotification(`✅ Completed (For Review): ${task.title}`, result);
      } else {
        // Task execution failed - move back to todo and notify
        console.log(`[Scheduler] Task ${task.id} failed, moving back to todo`);

        const errorMessage = result.error || 'Claude Code execution failed with no error message';
        const errorComment = `❌ **Task Execution Failed**\n\n**Error:** ${errorMessage}\n\n@amir moradi - This task needs your attention. Please review the error and either:\n1. Modify the task description for clarity\n2. Re-assign if needed\n3. Try again when ready`;

        try {
          // Add error comment
          await this.taskAPI.addComment(task.id, errorComment, false);
          console.log(`[Scheduler] Posted error comment to task ${task.id}`);
        } catch (commentError) {
          console.error(`[Scheduler] Failed to post error comment:`, commentError);
        }

        try {
          // Mark task as failed (move back to todo with failed_at timestamp)
          await this.taskAPI.markTaskFailed(task.id);
          console.log(`[Scheduler] Marked task ${task.id} as failed and moved to todo`);
        } catch (failedError) {
          console.error(`[Scheduler] Failed to mark task as failed:`, failedError);
        }

        this.sendNotification(`❌ Failed (Moved to Todo): ${task.title}`, { error: errorMessage });
      }
    } catch (error) {
      console.error(`[Scheduler] Error executing task ${task.id}:`, error);
      this.sendNotification(`❌ Error: ${task.title}`, { error: error.message });

      // Mark task as failed on error
      try {
        const errorComment = `⚠️ **Unexpected Error During Execution**\n\n**Error:** ${error.message}\n\n@amir moradi - An unexpected error occurred while executing this task. Please review and try again.`;
        await this.taskAPI.addComment(task.id, errorComment, false);
        await this.taskAPI.markTaskFailed(task.id);
        console.log(`[Scheduler] Marked task ${task.id} as failed after exception`);
      } catch (recoveryError) {
        console.error(`[Scheduler] Failed to recover task:`, recoveryError);
      }
    }
  }

  scheduleRecurringTasks() {
    // Schedule recurring tasks from config (like weekly reports)
    if (config.schedule && config.schedule.specificTasks) {
      config.schedule.specificTasks.forEach(taskConfig => {
        console.log(`[Scheduler] Scheduling recurring task: ${taskConfig.name} (${taskConfig.cron})`);

        const job = cron.schedule(taskConfig.cron, async () => {
          console.log(`\n[Scheduler] Executing recurring task: ${taskConfig.name}`);
          await this.claudeExecutor.executeTask(taskConfig.description);
        });

        this.scheduledJobs.set(`recurring-${taskConfig.name}`, job);
      });
    }
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
      console.log(`   GET  http://localhost:${config.webhook.port}/health`);
      console.log(`   Headers: x-webhook-secret: ${config.webhook.secret}`);
    });
  }

  async start() {
    console.log('🤖 Claude Task Scheduler Starting...\n');

    try {
      // Login to task manager
      console.log('[Scheduler] Authenticating with Task Manager API...');
      await this.taskAPI.login();
      this.isAuthenticated = true;
      console.log('[Scheduler] ✓ Authenticated\n');

      // Schedule recurring tasks from config (optional)
      this.scheduleRecurringTasks();

      // Start webhook server
      this.startWebhookServer();

      console.log('\n✅ Scheduler is now running!');
      console.log('📌 Webhook-only mode: Tasks will be executed when webhooks are received');
      console.log('Press Ctrl+C to stop\n');
    } catch (error) {
      console.error('Failed to start scheduler:', error);
      throw error;
    }
  }

  stop() {
    console.log('\n[Scheduler] Stopping all jobs...');
    this.scheduledJobs.forEach((job, name) => {
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
