# Complete Workflow Test - Claude Task Automation

This guide shows how to test the complete end-to-end automation workflow.

## Architecture

```
┌─────────────────────────────┐
│  Task Manager UI            │
│  (http://localhost:8081)    │
│  - Create task              │
│  - Assign to Claude         │
│  - Set schedule (NOW)       │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│  Task Manager API           │
│  (http://localhost:3001)    │
│  - Store task               │
│  - Update status            │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│  Claude Task Scheduler      │
│  (http://localhost:3002)    │
│  - Check for Claude tasks   │
│  - Every 30 minutes         │
│  - Or via webhook           │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│  Claude Code CLI            │
│  - Read task description    │
│  - Execute instructions     │
│  - Create/modify files      │
│  - Run commands             │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│  Logs & Results             │
│  - Execution output         │
│  - Task marked as "done"    │
│  - Summary reports          │
└─────────────────────────────┘
```

---

## 🚀 Step 1: Start Everything

### Terminal 1: Task Manager API
```bash
cd ~/Desktop/projects/task-manager/server
node index.js
# Should show: Server running on port 3001
```

### Terminal 2: Task Manager Frontend (Optional)
```bash
cd ~/Desktop/projects/task-manager
npm run dev
# Should show: http://localhost:8081
```

### Terminal 3: Claude Task Scheduler
```bash
cd ~/Desktop/projects/claude-task-scheduler
npm start
# Should show:
# ✅ Scheduler is now running!
# 🎣 Webhook Server listening on port 3002
```

---

## 🎯 Step 2: Create a Test Task

### Option A: Via UI (Recommended)

1. **Visit** http://localhost:8081
2. **Login** with your credentials (Amir's account works)
3. **Create a new task** with these details:
   ```
   Title: Test Claude Execution
   Description: Write a simple Python function that adds two numbers and save it to /tmp/test_add.py
   Priority: High
   Status: Todo
   ```
4. **Assign to:** Claude
5. **Schedule:**
   - Date: Today (2026-02-06)
   - Time: Current time (e.g., 07:15 if it's 7:15 AM now)
6. **Click Save**

### Option B: Via API (For Testing)

```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Claude Execution",
    "description": "Write a simple Python function that adds two numbers and save it to /tmp/test_add.py",
    "priority": "high",
    "status": "todo",
    "assignee_id": "vr6yycu4w",
    "scheduled_date": "2026-02-06",
    "scheduled_time": "07:15"
  }'
```

---

## 📋 Task Description Examples

Here are good task descriptions that Claude can execute:

### Example 1: File Creation
```
Create a Python script at /tmp/hello.py that prints "Hello from Claude!"
Then run it and show the output.
```

### Example 2: Code Generation
```
Write a JavaScript function called `fibonacci` that calculates the nth Fibonacci number.
Save it to /tmp/fibonacci.js and test it with n=10.
```

### Example 3: Data Processing
```
Create a JSON file at /tmp/data.json with sample user data:
- 3 users with id, name, email, created_at
- Format it nicely
- Show the content
```

### Example 4: Documentation
```
Write comprehensive documentation for a React component called "Button".
Include:
- Props (children, onClick, disabled, variant)
- Usage examples
- Best practices
Save to /tmp/Button.md
```

### Example 5: Complex Task
```
Create a Node.js script that:
1. Creates a simple Express server on port 8080
2. Has a GET endpoint /api/hello that returns {message: "Hello from Claude"}
3. Has a POST endpoint /api/echo that returns what you send
4. Save the script to /tmp/server.js
5. Include installation instructions
```

---

## ⏰ Step 3: Wait for Execution

### What Happens Automatically:

1. **Scheduler checks** every 30 minutes
   - Or immediately if within 5 minutes of scheduled time

2. **Task is detected**
   ```
   [Scheduler] Found 1 task(s) to process
   [Scheduler] Processing: Test Claude Execution
   ```

3. **Status updated** to `in-progress`
   ```
   [API] Changing task status to: in-progress
   ```

4. **Claude Code executes**
   ```
   [Claude Output] Creating Python function...
   [Claude Output] Saving to /tmp/test_add.py...
   [Claude Output] Function successfully created!
   ```

5. **Status updated** to `done`
   ```
   [API] Changing task status to: done
   ```

### Faster Testing Option:

Instead of waiting 30 minutes, trigger immediately:

```bash
curl http://localhost:3002/trigger/check
```

This will:
- Check for tasks right now
- Execute any tasks scheduled for now
- Show results in the scheduler logs

---

## 📊 Step 4: View Results

### Check Scheduler Logs

```bash
# Watch live logs
tail -f ~/Desktop/projects/claude-task-scheduler/logs/task-*.log

# View latest execution
cat ~/Desktop/projects/claude-task-scheduler/logs/task-*.log | tail -50
```

### Check Task Status

Visit http://localhost:8081 and see the task status changed to "done".

### Check Task in API

```bash
curl http://localhost:3001/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" | jq '.[] | select(.title=="Test Claude Execution")'
```

### View Created Files

If Claude created a file:
```bash
cat /tmp/test_add.py
cat /tmp/hello.py
cat /tmp/fibonacci.js
```

---

## 🔍 Detailed Example Walkthrough

### Task: "Write a Python function that adds two numbers"

**What happens:**

1. **Task Created** in Task Manager
   ```json
   {
     "title": "Test Claude Execution",
     "description": "Write a simple Python function that adds two numbers and save it to /tmp/test_add.py",
     "scheduled_time": "07:15",
     "assignee_name": "claude",
     "status": "todo"
   }
   ```

2. **Scheduler Detects** it's time to execute
   ```
   Current time: 07:16
   Scheduled time: 07:15
   ✅ Time to execute!
   ```

3. **Task marked as in-progress**
   ```
   PUT /api/tasks/abc123 { status: "in-progress" }
   ```

4. **Claude Code runs** with this prompt:
   ```
   Task: Test Claude Execution
   Description: Write a simple Python function that adds two numbers and save it to /tmp/test_add.py

   Please complete this task.
   ```

5. **Claude writes and saves**
   ```python
   # Claude creates /tmp/test_add.py
   def add(a, b):
       """Add two numbers"""
       return a + b

   # Test it
   result = add(5, 3)
   print(f"5 + 3 = {result}")
   ```

6. **Logs captured**
   ```
   logs/task-2026-02-06T07-16-00.log
   - Claude's output
   - File created
   - Execution time
   ```

7. **Task marked as done**
   ```
   PUT /api/tasks/abc123 { status: "done" }
   ```

8. **UI updates** to show completed task

---

## ✅ Checklist for Testing

- [ ] Task Manager API running (port 3001)
- [ ] Claude Task Scheduler running (port 3002)
- [ ] Created a test task in Task Manager
- [ ] Assigned task to Claude
- [ ] Set scheduled date/time to today + current time
- [ ] Triggered scheduler with `curl http://localhost:3002/trigger/check`
- [ ] Checked scheduler logs
- [ ] Task status changed to "done"
- [ ] Created files exist (if applicable)

---

## 🐛 Troubleshooting

### Task not executing

**Check:**
1. Is scheduler running?
   ```bash
   curl http://localhost:3002/health
   # Should show: authenticated: true
   ```

2. Is Claude logged in?
   ```bash
   npm run test:api
   # Should show: Logged in as: claude
   ```

3. Is the scheduled time correct?
   - Task scheduled_time must be within ±5 minutes of current time
   - Or use manual trigger: `curl http://localhost:3002/trigger/check`

### Claude Code not found
```bash
which claude
# If not found, Claude Code CLI not installed
# Task will be detected but execution will fail
```

### Task shows wrong status
```bash
# Refresh in UI
# Or check API directly
curl http://localhost:3001/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Logs not showing
```bash
# Check if logs directory exists
ls -la ~/Desktop/projects/claude-task-scheduler/logs/

# If empty, check scheduler status
curl http://localhost:3002/health
```

---

## 🚀 Advanced: Webhook Testing

Instead of waiting for scheduler checks, use webhooks for instant notifications:

```bash
# Create and send task via webhook
curl -X POST http://localhost:3002/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{
    "id": "webhook-test-123",
    "title": "Webhook Test Task",
    "description": "Create a file at /tmp/webhook-test.txt with content: Hello from webhook!",
    "status": "todo",
    "priority": "high",
    "assignee_name": "claude",
    "scheduled_date": "2026-02-06",
    "scheduled_time": "07:20"
  }'
```

Scheduler will:
- Receive webhook
- Mark task as in-progress
- Execute immediately
- Mark as done
- Return logs in response

---

## 📈 Success Indicators

You'll know it's working when:

1. ✅ **Scheduler logs show:**
   ```
   [Scheduler] Found 1 task(s) to process
   [Scheduler] Processing: Your Task Title
   [Claude Output] Task execution...
   ```

2. ✅ **Task status changes from `todo` → `in-progress` → `done`**

3. ✅ **Files are created** (if task creates files)

4. ✅ **Commands are executed** (if task runs commands)

5. ✅ **Logs are saved** to `logs/task-*.log`

---

## 🎯 Next Steps After Testing

1. **Create more complex tasks** with multiple steps
2. **Schedule recurring tasks** for specific times
3. **Monitor execution** via logs and dashboards
4. **Set up notifications** (email, Slack, etc.)
5. **Deploy to production** (PM2, Docker, etc.)

Happy testing! 🎉
