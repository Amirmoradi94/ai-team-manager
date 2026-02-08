# 🤖 Claude Task Scheduler - Complete Guide

Your autonomous AI task execution system is ready! Here's everything you need to know.

---

## 📊 System Overview

```
Your Task Manager
    ↓
    └─→ Create Task + Assign to Claude
        ↓
        └─→ 2 Execution Modes:

        Mode 1: INSTANT (Webhook)
        ├─→ Send webhook to scheduler
        ├─→ Claude executes IMMEDIATELY
        └─→ Get results in seconds

        Mode 2: SCHEDULED (Cron)
        ├─→ Scheduler checks every 30 minutes
        ├─→ If task is for now, execute
        └─→ Automatic at specific times
```

---

## 🚀 Quick Start (2 Minutes)

### Step 1: Start Everything

**Terminal 1 - Task Manager API:**
```bash
cd ~/Desktop/projects/task-manager/server
node index.js
```

**Terminal 2 - Claude Scheduler:**
```bash
cd ~/Desktop/projects/claude-task-scheduler
npm start
```

**Terminal 3 - Watch Logs (Optional):**
```bash
cd ~/Desktop/projects/claude-task-scheduler
tail -f logs/task-*.log
```

### Step 2: Send Test Task (Instant)

```bash
curl -X POST http://localhost:3002/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{
    "id": "test-1",
    "title": "Write Python Code",
    "description": "Create a Python function that calculates factorial and save to /tmp/factorial.py",
    "assignee_name": "claude",
    "priority": "high"
  }'
```

### Step 3: View Results

Watch the scheduler logs (Terminal 3) - Claude will execute immediately!

```bash
tail -f ~/Desktop/projects/claude-task-scheduler/logs/task-*.log
```

---

## 🎯 Three Ways to Use

### Method 1: Webhook (Instant)

**Best for:** Ad-hoc tasks, testing, urgent work

**How:**
```bash
./quick-test.sh  # Run our pre-made test
```

**Or manually:**
```bash
curl -X POST http://localhost:3002/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{...task data...}'
```

**Speed:** < 1 second
**Latency:** Real-time

---

### Method 2: Scheduler (Periodic)

**Best for:** Recurring tasks, automation, scheduled work

**How:**
1. Create task in Task Manager UI
2. Assign to Claude
3. Set scheduled date/time
4. Scheduler checks every 30 minutes
5. If it's time, Claude executes

**Speed:** Within 30 minutes
**Latency:** Periodic

---

### Method 3: UI Integration (Future)

**Best for:** Full automation from Task Manager

Modify Task Manager to send webhooks when tasks are assigned:

```javascript
// task-manager/server/index.js
if (assignee && assignee.name === 'claude') {
  fetch('http://localhost:3002/webhook/task-assigned', {
    method: 'POST',
    headers: {
      'x-webhook-secret': 'your-webhook-secret-change-this'
    },
    body: JSON.stringify(task)
  });
}
```

---

## 📚 Task Examples

### Simple Task
```
Title: Hello World
Description: Write a Python script that prints "Hello Claude!"
```

### Data Task
```
Title: Create User Data
Description: Create a JSON file at /tmp/users.json with 3 sample users including id, name, email
```

### Code Generation
```
Title: React Counter Component
Description: Create a React component called Counter with increment/decrement buttons and state
```

### Documentation
```
Title: API Documentation
Description: Write API documentation for GET /users, POST /users, PUT /users/:id endpoints
```

### Complex Task
```
Title: Build Full API
Description:
Create a simple Express.js server with:
1. GET /api/hello - returns {message: "Hello"}
2. POST /api/data - accepts JSON and returns it
3. Proper error handling
4. Save to /tmp/server.js
```

---

## 🔄 Task Lifecycle

```
1. Create
   ├─→ In UI: http://localhost:8081
   └─→ Or via API/Webhook

2. Assign
   └─→ Assign to "Claude" user

3. Schedule
   ├─→ For now → executes immediately
   └─→ For later → scheduled execution

4. Detect
   ├─→ Webhook: Instant
   └─→ Scheduler: Every 30 minutes

5. Execute
   ├─→ Mark as "in-progress"
   ├─→ Run Claude Code CLI
   └─→ Capture output & logs

6. Complete
   ├─→ Mark as "done"
   ├─→ Save results to logs
   └─→ Notify (future)

7. View
   ├─→ Check logs
   ├─→ See task status changed
   └─→ View created files
```

---

## 🎪 Status Values

Claude uses correct status values:

| Status | Meaning |
|--------|---------|
| `backlog` | Task in backlog |
| `todo` | Task to do |
| `in-progress` | Claude is working on it |
| `done` | Task completed ✅ |

Claude automatically changes status:
- `todo` → `in-progress` (when starting)
- `in-progress` → `done` (when finished)

---

## 📋 API Operations

Claude can do all these operations:

### Task Management
```javascript
// Read
getAllTasks()
getAssignedTasks('Claude')
getScheduledTasks(startDate, endDate)

// Create
createTask({ title, description, priority, ... })

// Update
updateTask(taskId, { field: value })
updateTaskTitle(taskId, newTitle)
updateTaskDescription(taskId, newDesc)
updateTaskPriority(taskId, 'high')
updateTaskDueDate(taskId, '2026-02-15')
assignTask(taskId, userId)

// Status
markTaskTodo(taskId)
markTaskInProgress(taskId)
markTaskDone(taskId)

// Schedule
scheduleTask(taskId, '2026-02-15', '10:00')

// Delete
deleteTask(taskId)
```

### User Management
```javascript
// Read
getAllUsers()
getCurrentUser()

// Create
inviteUser('email@example.com')

// Delete
deleteUser(userId)
```

---

## 🧪 Complete Testing Flow

### Flow 1: Webhook (Instant)

```bash
# Terminal 1: Start scheduler
cd ~/Desktop/projects/claude-task-scheduler
npm start

# Terminal 2: Send task (immediately)
./quick-test.sh

# Terminal 3: Watch results (in real-time)
tail -f logs/task-*.log
```

**Result:** Claude executes instantly! ⚡

---

### Flow 2: Scheduled (Periodic)

```bash
# Terminal 1: Start scheduler
npm start

# Visit UI and create task
http://localhost:8081
→ Create task
→ Assign to Claude
→ Set scheduled_time to now

# Terminal 2: Trigger check (or wait 30 min)
curl http://localhost:3002/trigger/check

# Terminal 3: Watch logs
tail -f logs/task-*.log
```

**Result:** Task executes at scheduled time 📅

---

### Flow 3: Full UI Integration (Future)

```
http://localhost:8081
  ↓
Create Task + Assign Claude
  ↓
Webhook fires automatically
  ↓
Scheduler receives it
  ↓
Claude executes immediately
  ↓
Task status: done
  ↓
View results in Task Manager
```

---

## 📊 Configuration

Everything in `config.json`:

```json
{
  "taskManagerAPI": {
    "apiUrl": "http://localhost:3001/api",
    "email": "claude@taskmanager.com",
    "password": ".PX0UQUBN67Nme32",
    "claudeAssignee": "Claude"
  },
  "schedule": {
    "checkInterval": "*/30 * * * *"  // Every 30 minutes
  },
  "webhook": {
    "port": 3002,
    "secret": "your-webhook-secret-change-this"
  }
}
```

---

## 🔍 Monitoring

### Check Scheduler Status
```bash
curl http://localhost:3002/health
# Returns: status, authenticated, scheduledJobs, uptime
```

### View Latest Logs
```bash
tail -f ~/Desktop/projects/claude-task-scheduler/logs/task-*.log
```

### Check Task Status
```bash
npm run test:api
# Shows all Claude's tasks and their status
```

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Scheduler not running | `npm start` in claude-task-scheduler folder |
| Task not detected | Check scheduled_time (must be now ±5 min) |
| Webhook fails | Verify secret in header matches config.json |
| Claude not executing | Check if Claude Code CLI is installed (`which claude`) |
| No logs generated | Check logs folder exists: `ls logs/` |
| API authentication fails | Verify email/password in config.json |

---

## 📚 Documentation Files

1. **START-HERE.md** - Quick start guide
2. **INTEGRATION.md** - Full integration with Task Manager
3. **API-REFERENCE.md** - Complete API documentation
4. **TEST-WORKFLOW.md** - Detailed testing guide
5. **WEBHOOK-GUIDE.md** - Webhook integration guide
6. **COMPLETE-GUIDE.md** - This file

---

## 🎯 Success Checklist

- [ ] Scheduler running (`npm start`)
- [ ] Task Manager API running on port 3001
- [ ] Can login as Claude user (`npm run test:api`)
- [ ] Webhook server listening on port 3002
- [ ] Can send test webhook (`./quick-test.sh`)
- [ ] Claude executes tasks (check logs)
- [ ] Task status changes to "done"
- [ ] Files are created (if applicable)

---

## 🚀 Next Steps

### Immediate
1. Run `./quick-test.sh` to verify everything works
2. Create real tasks in Task Manager UI
3. Watch Claude execute them

### Short Term
1. Add webhook integration to Task Manager (see WEBHOOK-GUIDE.md)
2. Create more complex tasks
3. Set up recurring schedules

### Long Term
1. Deploy to production (PM2/Docker/systemd)
2. Add email notifications
3. Create monitoring dashboard
4. Set up Slack integration
5. Build task management UI improvements

---

## 💡 Pro Tips

**Tip 1: Use Webhooks for Testing**
```bash
./quick-test.sh  # Fastest way to test
```

**Tip 2: Watch Logs in Real-Time**
```bash
tail -f logs/task-*.log
```

**Tip 3: Trigger Manual Checks**
```bash
curl http://localhost:3002/trigger/check
```

**Tip 4: Get Current Task List**
```bash
npm run test:api
```

**Tip 5: Test with Simple Tasks First**
```
Title: Hello World
Description: Print "Hello from Claude!"
```

---

## 🔐 Security

- Change webhook secret in config.json
- Use environment variables for credentials (production)
- Restrict webhook to localhost or whitelisted IPs
- Use HTTPS in production
- Change default passwords

---

## 📞 Support

**Can't get it working?**

1. Check if both servers are running (3001 + 3002)
2. Verify credentials in config.json
3. Check logs: `tail -f logs/task-*.log`
4. Run health check: `curl http://localhost:3002/health`
5. Test API: `npm run test:api`

---

## 🎉 You're All Set!

Your autonomous AI assistant is ready to:

✅ Check task assignments automatically
✅ Execute tasks based on descriptions
✅ Update task status
✅ Create files and run code
✅ Work on schedules or webhooks
✅ Log all execution results

**Start using it now:**

```bash
cd ~/Desktop/projects/claude-task-scheduler
npm start
```

Then run:
```bash
./quick-test.sh
```

Enjoy your autonomous Claude! 🤖✨
