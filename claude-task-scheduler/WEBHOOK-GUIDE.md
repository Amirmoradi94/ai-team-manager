# Webhook Integration Guide - Real-time Task Execution

The **webhook** method is **instant** - Claude executes tasks immediately when they're assigned, no waiting!

## 🎣 How Webhooks Work

```
Task Manager → POST to Webhook → Scheduler → Claude executes → Done!
(instant)
```

Instead of checking every 30 minutes, webhooks notify the scheduler **immediately** when a task is assigned.

---

## ✅ Setup

### 1. Ensure Webhook Server is Running

```bash
cd ~/Desktop/projects/claude-task-scheduler
npm start
```

You should see:
```
🎣 [Webhook] Server listening on port 3002
   POST http://localhost:3002/webhook/task-assigned
   Headers: x-webhook-secret: your-webhook-secret-change-this
```

### 2. Get Your Webhook URL

Your scheduler is now ready to receive webhooks at:
```
http://localhost:3002/webhook/task-assigned
```

---

## 🔧 Integration Options

### Option A: Manual Testing (Fastest)

```bash
curl -X POST http://localhost:3002/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{
    "id": "test-task-1",
    "title": "Create Hello World",
    "description": "Write a simple Python script that prints hello world and save to /tmp/hello.py",
    "status": "todo",
    "priority": "high",
    "assignee_name": "claude"
  }'
```

**Result:** Claude executes immediately! Check logs:
```bash
tail -f ~/Desktop/projects/claude-task-scheduler/logs/task-*.log
```

### Option B: Add to Task Manager Frontend

Modify the Task Manager to send webhooks when tasks are created/updated.

**In task-manager** (server/index.js):

```javascript
// When a task is created
app.post('/api/tasks', authenticateToken, validateCreateTask, async (req, res) => {
  const { title, description, assignee_id, priority } = req.body;

  // ... existing code ...

  // Send webhook to Claude Scheduler if assigned to Claude
  if (assignee_id) {
    const assignee = await get('SELECT * FROM users WHERE id = ?', [assignee_id]);
    if (assignee && assignee.name.toLowerCase() === 'claude') {
      try {
        await fetch('http://localhost:3002/webhook/task-assigned', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': 'your-webhook-secret-change-this'
          },
          body: JSON.stringify({
            id: newTask.id,
            title: newTask.title,
            description: newTask.description,
            status: newTask.status,
            priority: newTask.priority,
            assignee_name: assignee.name
          })
        });
      } catch (error) {
        console.error('Failed to send webhook:', error);
      }
    }
  }

  res.json(newTask);
});
```

---

## 🚀 Testing Workflows

### Workflow 1: Instant Execution via Webhook

**Steps:**

1. **Start scheduler** (Terminal 1)
   ```bash
   npm start
   ```

2. **Send task via webhook** (Terminal 2)
   ```bash
   curl -X POST http://localhost:3002/webhook/task-assigned \
     -H "Content-Type: application/json" \
     -H "x-webhook-secret: your-webhook-secret-change-this" \
     -d '{
       "id": "instant-task",
       "title": "Write JSON",
       "description": "Create a JSON file at /tmp/data.json with 3 sample users",
       "assignee_name": "claude",
       "priority": "high"
     }'
   ```

3. **Watch execution** (Terminal 3)
   ```bash
   tail -f logs/task-*.log
   ```

4. **Verify results**
   ```bash
   cat /tmp/data.json
   ```

---

### Workflow 2: Create Task via UI + Webhook Integration

**For this to work, you need to modify task-manager:**

1. **Create task in UI** - http://localhost:8081
   ```
   Title: Write Documentation
   Description: Create a README.md file explaining how webhooks work
   Assign to: Claude
   ```

2. **Webhook fires automatically**
   - Task Manager → Sends webhook → Scheduler → Claude executes

3. **Task completes** automatically

---

## 📋 Webhook Payload Format

When sending a task via webhook, use this format:

```json
{
  "id": "unique-task-id",
  "title": "Task Title",
  "description": "Task description with instructions",
  "status": "todo",
  "priority": "high",
  "due_date": "2026-02-15",
  "scheduled_date": "2026-02-06",
  "scheduled_time": "07:30",
  "assignee_name": "claude",
  "assignee_id": "vr6yycu4w"
}
```

**Required fields:**
- `id` - Unique identifier
- `title` - Task name
- `description` - Instructions for Claude
- `assignee_name` - Should be "claude" or match configured name

**Optional fields:**
- `status` - Default: "todo"
- `priority` - Default: "medium"
- `due_date` - Format: YYYY-MM-DD
- `scheduled_date` - Format: YYYY-MM-DD
- `scheduled_time` - Format: HH:MM

---

## 🔐 Security

### Webhook Secret

Always include the webhook secret header:
```bash
-H "x-webhook-secret: your-webhook-secret-change-this"
```

Change it in `config.json`:
```json
{
  "webhook": {
    "secret": "your-super-secret-key-change-this"
  }
}
```

### IP Whitelisting (Optional)

In production, restrict webhooks to your Task Manager IP:

```javascript
// In scheduler-api.js
app.use((req, res, next) => {
  const allowedIPs = ['127.0.0.1', 'localhost', '192.168.1.100'];
  if (!allowedIPs.includes(req.ip)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});
```

---

## 📊 Webhook Response

When you send a webhook, you get back:

```json
{
  "success": true,
  "message": "Task received and processed",
  "logFile": "logs/task-2026-02-06T07-15-23.log"
}
```

Or on error:
```json
{
  "error": "Invalid secret"
}
```

---

## 🧪 Complete Testing Examples

### Example 1: Create Python Script

```bash
curl -X POST http://localhost:3002/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{
    "id": "python-task-001",
    "title": "Create Python Script",
    "description": "Create a Python script at /tmp/math_operations.py with functions for add, subtract, multiply, divide. Include docstrings and test each function.",
    "priority": "high",
    "assignee_name": "claude"
  }'
```

### Example 2: Generate Documentation

```bash
curl -X POST http://localhost:3002/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{
    "id": "doc-task-001",
    "title": "API Documentation",
    "description": "Generate API documentation for a REST API with endpoints: GET /users, POST /users, PUT /users/:id, DELETE /users/:id. Include authentication, request/response examples, and error codes. Save to /tmp/API_DOCS.md",
    "priority": "medium",
    "assignee_name": "claude"
  }'
```

### Example 3: Data Processing

```bash
curl -X POST http://localhost:3002/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{
    "id": "data-task-001",
    "title": "Process User Data",
    "description": "Create a JSON file at /tmp/users.json with 5 sample users. Each user should have: id (number), name (string), email (string), age (number), created_at (ISO date). Then create a CSV version at /tmp/users.csv",
    "priority": "high",
    "assignee_name": "claude"
  }'
```

### Example 4: Complex Task with Multiple Steps

```bash
curl -X POST http://localhost:3002/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{
    "id": "complex-task-001",
    "title": "Build React Component",
    "description": "Create a React component called Counter in /tmp/Counter.jsx with these features:\n1. Display current count\n2. Button to increment\n3. Button to decrement\n4. Button to reset to 0\n5. Show count history\n6. Include TypeScript types\n7. Include JSDoc comments\n8. Add example usage",
    "priority": "high",
    "assignee_name": "claude"
  }'
```

---

## 📈 Webhook Flow Diagram

```
┌────────────────────┐
│  Send Webhook      │
│  POST to :3002     │
└─────────┬──────────┘
          │
          ↓
┌────────────────────┐
│  Validate Secret   │
│  Check headers     │
└─────────┬──────────┘
          │
          ↓
┌────────────────────┐
│  Mark In-Progress  │
│  Update API        │
└─────────┬──────────┘
          │
          ↓
┌────────────────────┐
│  Execute Task      │
│  Run Claude CLI    │
└─────────┬──────────┘
          │
          ↓
┌────────────────────┐
│  Capture Output    │
│  Save to logs      │
└─────────┬──────────┘
          │
          ↓
┌────────────────────┐
│  Mark Done         │
│  Update API        │
└─────────┬──────────┘
          │
          ↓
┌────────────────────┐
│  Return Response   │
│  Success + logFile │
└────────────────────┘
```

---

## ⚡ Webhook vs Scheduler Comparison

| Feature | Webhook | Scheduler |
|---------|---------|-----------|
| **Speed** | Instant (< 1 sec) | 30 minutes later |
| **Real-time** | ✅ Yes | ❌ No |
| **Automation** | Manual triggers | Automatic |
| **Use case** | Ad-hoc tasks | Recurring tasks |
| **Setup** | Send HTTP request | Just runs |
| **Best for** | Testing | Production |

---

## 🎯 Recommended Testing Flow

**For fastest results:**

1. **Start scheduler**
   ```bash
   npm start
   ```

2. **Send task via webhook** (instant)
   ```bash
   curl -X POST http://localhost:3002/webhook/task-assigned \
     -H "Content-Type: application/json" \
     -H "x-webhook-secret: your-webhook-secret-change-this" \
     -d '{ ... task data ... }'
   ```

3. **Watch logs** (real-time)
   ```bash
   tail -f logs/task-*.log
   ```

4. **Verify results** (immediately)
   ```bash
   cat /tmp/[created_file]
   ```

---

## 🚀 Production Integration

To fully integrate webhooks into Task Manager:

1. **Add webhook sender** to task creation in task-manager/server/index.js
2. **Use environment variable** for webhook URL:
   ```bash
   CLAUDE_SCHEDULER_WEBHOOK=http://localhost:3002/webhook/task-assigned
   ```
3. **Send on task assignment** to Claude user
4. **Handle failures** gracefully (log but don't block)
5. **Use HTTPS** in production

---

## 📞 Support

Having issues?

- **Check webhook port:** `lsof -i :3002`
- **Verify secret:** Must match config.json
- **Check logs:** `tail -f logs/task-*.log`
- **Test health:** `curl http://localhost:3002/health`

Happy automating! 🎉
