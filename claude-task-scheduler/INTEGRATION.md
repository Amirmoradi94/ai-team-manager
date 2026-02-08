# Integration with Your Task Manager

This guide shows how to integrate the Claude Task Scheduler with your existing task-manager app.

## Architecture

```
┌─────────────────────────┐
│   Task Manager App      │
│   (React + Express)     │
│   Port: 3001            │
└──────────┬──────────────┘
           │
           │ REST API
           │ JWT Auth
           │
           ↓
┌─────────────────────────┐
│  Claude Task Scheduler  │
│  (Node.js)              │
│  Port: 3002             │
└──────────┬──────────────┘
           │
           ├──> Periodic Check (Every 30 min)
           ├──> Webhook Receiver
           └──> Scheduled Tasks (Tuesday 10 AM)

           ↓
┌─────────────────────────┐
│   Claude Code CLI       │
│   Executes Tasks        │
└─────────────────────────┘
```

## Setup Steps

### 1. Ensure Task Manager is Running

```bash
cd ~/Desktop/projects/task-manager

# Start the backend API
cd server
npm install
node index.js
# Should be running on http://localhost:3001

# In another terminal, start the frontend
cd ~/Desktop/projects/task-manager
npm install
npm run dev
# Should be running on http://localhost:8081
```

### 2. Configure Claude Scheduler

The config is already set up in `config.json`:

```json
{
  "taskManagerAPI": {
    "apiUrl": "http://localhost:3001/api",
    "email": "amir.94.eng@gmail.com",
    "password": "Admin@123",
    "claudeAssignee": "Claude"
  }
}
```

### 3. Create a "Claude" User (Optional)

You have two options:

**Option A: Use existing admin account** (current setup)
- The scheduler will login as you
- Assign tasks to yourself and Claude will execute them

**Option B: Create dedicated Claude user**
1. Login to your task manager at http://localhost:8081
2. Invite a new user: `claude@example.com`
3. Update `config.json` with Claude's credentials
4. Assign tasks to "Claude" user

### 4. Test the API Connection

```bash
cd ~/Desktop/projects/claude-task-scheduler
npm run test:api
```

This will:
- Login to your task manager
- Fetch all tasks
- Show tasks assigned to Claude
- Save tasks to `claude-tasks.json`

### 5. Start the Scheduler

```bash
npm start
```

This starts:
- ✅ Webhook server on port 3002
- ✅ Periodic checks every 30 minutes
- ✅ Scheduled tasks (Tuesday 10 AM)

## How It Works

### 1. Periodic Task Checks (Every 30 minutes)

The scheduler automatically:
1. Logs into your task manager API
2. Fetches all tasks
3. Filters tasks assigned to "Claude" (or your specified assignee)
4. Checks scheduled tasks for today
5. Executes tasks that are due
6. Updates task status in the database

### 2. Webhooks (Real-time)

You can add a webhook to your task manager to notify the scheduler immediately when a task is assigned:

```javascript
// In your task-manager server code, when a task is created/updated:
fetch('http://localhost:3002/webhook/task-assigned', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-webhook-secret': 'your-webhook-secret-change-this'
  },
  body: JSON.stringify(task)
});
```

### 3. Scheduled Execution

Tasks with `scheduled_date` and `scheduled_time` fields will execute at the specified time:

Example task:
```json
{
  "title": "Generate weekly report",
  "scheduled_date": "2026-02-10",
  "scheduled_time": "10:00",
  "assignee_id": "claude-user-id"
}
```

## Testing the Integration

### Test 1: Manual API Check

```bash
npm run test:api
```

Expected output:
```
[API] Logged in as: Amir Moradi (amir.94.eng@gmail.com)
[API] Fetched 5 task(s)
[API] Found 2 task(s) assigned to "Claude"

=== Tasks Assigned to Claude ===
1. Implement user authentication
   Status: todo
   Priority: high
   ...
```

### Test 2: Manual Trigger

```bash
curl http://localhost:3002/trigger/check
```

This manually triggers a task check.

### Test 3: Create a Test Task

1. Go to http://localhost:8081
2. Create a new task
3. Set title: "Test Claude Task"
4. Assign to yourself (or Claude user)
5. Set status: "todo"
6. Wait 30 minutes OR trigger manually

### Test 4: Webhook Test

```bash
curl -X POST http://localhost:3002/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{
    "id": "test-123",
    "title": "Test webhook task",
    "description": "This task was sent via webhook",
    "status": "todo",
    "priority": "high",
    "assignee_name": "Claude"
  }'
```

## Task Execution Flow

When a task is found:

1. **Mark as In Progress**
   ```
   PUT /api/tasks/:id
   { "status": "in-progress" }
   ```

2. **Execute via Claude Code**
   ```
   Claude Code CLI receives:
   "Task: Implement user authentication
    Description: Add JWT auth to the API
    Priority: high

    Please complete this task."
   ```

3. **Mark as Completed** (if successful)
   ```
   PUT /api/tasks/:id
   { "status": "completed" }
   ```

4. **Log Results**
   - Saved to `logs/task-{timestamp}.log`
   - Contains full Claude output

## Monitoring

### Check Scheduler Status

```bash
curl http://localhost:3002/health
```

Response:
```json
{
  "status": "running",
  "authenticated": true,
  "scheduledJobs": 2,
  "uptime": 3600
}
```

### View Logs

```bash
cd ~/Desktop/projects/claude-task-scheduler
ls -la logs/
tail -f logs/task-*.log
```

## Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start scheduler
pm2 start scheduler-api.js --name claude-scheduler

# View logs
pm2 logs claude-scheduler

# Monitor
pm2 monit

# Auto-restart on system reboot
pm2 startup
pm2 save
```

### Using systemd (Linux)

Create `/etc/systemd/system/claude-scheduler.service`:

```ini
[Unit]
Description=Claude Task Scheduler
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/claude-task-scheduler
ExecStart=/usr/bin/node scheduler-api.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable claude-scheduler
sudo systemctl start claude-scheduler
sudo systemctl status claude-scheduler
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3002
CMD ["node", "scheduler-api.js"]
```

Build and run:
```bash
docker build -t claude-scheduler .
docker run -d --name scheduler \
  --network host \
  -v $(pwd)/logs:/app/logs \
  claude-scheduler
```

## Customization

### Change Check Interval

Edit `config.json`:
```json
{
  "schedule": {
    "checkInterval": "*/15 * * * *"  // Every 15 minutes
  }
}
```

### Add Scheduled Tasks

```json
{
  "schedule": {
    "specificTasks": [
      {
        "name": "Daily Backup",
        "cron": "0 2 * * *",  // 2 AM daily
        "description": "Create database backup"
      },
      {
        "name": "Weekly Report",
        "cron": "0 9 * * 1",  // Monday 9 AM
        "description": "Generate weekly report"
      }
    ]
  }
}
```

### Change Assignee Name

If you want to assign tasks to a different user:

```json
{
  "taskManagerAPI": {
    "claudeAssignee": "AI Assistant"  // or "Bot" or any name
  }
}
```

## Troubleshooting

**"Login failed"**
- Check credentials in `config.json`
- Ensure task manager is running on port 3001
- Check `~/Desktop/projects/task-manager/server/.env`

**"No tasks found"**
- Create tasks in the task manager UI
- Assign them to the configured user
- Check assignee_name matches `claudeAssignee` in config

**"Port 3002 already in use"**
- Change webhook port in `config.json`
- Or stop other service: `lsof -i :3002`

**"Claude Code not found"**
- Ensure Claude Code CLI is installed
- Check it's in PATH: `which claude`
- Update command in `claude-executor.js` if needed

## Next Steps

- [ ] Add webhook integration to task manager
- [ ] Set up email notifications
- [ ] Configure Slack integration
- [ ] Add task priority queue
- [ ] Implement retry logic
- [ ] Create monitoring dashboard

## API Reference

All endpoints on `http://localhost:3002`:

**POST /webhook/task-assigned**
- Headers: `x-webhook-secret: your-secret`
- Body: Task object
- Response: `{ success: true, logFile: "..." }`

**POST /trigger/check**
- Manually trigger task check
- Response: `{ success: true }`

**GET /health**
- Check scheduler status
- Response: `{ status: "running", authenticated: true, ... }`

Happy automating! 🤖
