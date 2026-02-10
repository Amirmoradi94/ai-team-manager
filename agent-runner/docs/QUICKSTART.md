# Quick Start Guide

## Test the System (Without Real Kanban Board)

### 1. Test Kanban Checker (Mock Mode)

First, let's create a simple test HTML file to simulate a kanban board:

```bash
# This will be created for you - see test-kanban.html
```

Then test the checker:
```bash
npm run test:kanban
```

### 2. Test Claude Executor

```bash
npm run test:claude
```

This will send a simple prompt to Claude Code CLI.

### 3. Test Webhook Server

Start the scheduler:
```bash
npm start
```

In another terminal, send a test webhook:
```bash
./test-webhook.sh
```

Or manually:
```bash
curl -X POST http://localhost:3001/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret" \
  -d '{
    "title": "Test Task",
    "description": "This is a test task",
    "priority": "medium"
  }'
```

## Connect to Your Real Kanban Board

### Step 1: Update config.json

```json
{
  "kanban": {
    "url": "https://your-kanban-board.com",
    "username": "your-email@example.com",
    "password": "your-password"
  }
}
```

### Step 2: Update CSS Selectors

Open `kanban-checker.js` and update the `getAssignedTasks()` method:

1. Visit your kanban board
2. Right-click on a task card → Inspect
3. Note the CSS classes/attributes
4. Update the selectors in the code

Example for Trello:
```javascript
const taskElements = document.querySelectorAll('.list-card');
// Find cards assigned to you
```

Example for Jira:
```javascript
const taskElements = document.querySelectorAll('[data-test-id="issue.views.issue-base.foundation.summary.heading"]');
```

### Step 3: Test Login

```bash
node kanban-checker.js
```

Check the screenshot `kanban-board.png` to verify it logged in correctly.

## Scheduling Options

### Option A: Run Continuously with Scheduler

```bash
npm start
```

This runs:
- Periodic checks every 30 minutes
- Webhook server on port 3001
- Scheduled tasks (e.g., Tuesday 10 AM)

### Option B: One-time Cron Job

Add to crontab:
```bash
crontab -e
```

Add line:
```
*/30 * * * * cd /path/to/claude-task-scheduler && node kanban-checker.js
```

### Option C: PM2 (Recommended for Production)

```bash
npm install -g pm2
pm2 start scheduler.js --name claude-scheduler
pm2 logs claude-scheduler
pm2 monit
```

## Monitoring

Check logs:
```bash
ls -la logs/
tail -f logs/task-*.log
```

Check if scheduler is running:
```bash
curl http://localhost:3001/health
```

## Troubleshooting

**"Cannot find module 'playwright'"**
```bash
npm install
npx playwright install chromium
```

**"Login failed"**
- Check credentials in config.json
- Update login selectors in kanban-checker.js
- Run with headless: false to debug

**"Claude command not found"**
- Ensure Claude Code CLI is installed
- Check it's in your PATH: `which claude`

**Webhook not receiving**
- Check port 3001 is not in use: `lsof -i :3001`
- Test locally first before exposing externally
- Use ngrok for external webhooks: `ngrok http 3001`

## Next Steps

1. ✅ Test each component individually
2. ✅ Connect to your real kanban board
3. ✅ Customize task selectors
4. ✅ Run first scheduled check
5. ✅ Monitor logs
6. ✅ Set up notifications (email/Slack)
7. ✅ Deploy to production (PM2/Docker/systemd)

## Example Workflow

```
You assign task to "Claude" in Kanban
         ↓
Webhook fires → http://localhost:3001/webhook/task-assigned
         ↓
scheduler.js receives task
         ↓
claude-executor.js runs Claude Code
         ↓
Task completed, logs saved
         ↓
You receive notification
```

Enjoy your autonomous Claude assistant! 🤖
