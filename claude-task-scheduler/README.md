# Claude Task Scheduler

An automated task execution system that integrates Claude Code's multi-agent system with a Kanban board task manager. When tasks are assigned to Claude on the Kanban board, this scheduler automatically executes them using Claude Code's headless mode with full subagent support.

## 🎯 Key Features

- ✅ **Webhook-based automation** - Receives webhooks when tasks assigned to Claude
- ✅ **Multi-agent orchestration** - Main Claude agent spawns specialized subagents (frontend, backend, QA, etc.)
- ✅ **Subscription-based** - Uses your Claude Pro/Max account (not API key)
- ✅ **Fresh sessions** - Each task gets its own temporary Claude Code session
- ✅ **Kanban integration** - Automatic status updates (todo → in-progress → for-review/done)
- ✅ **Real-time monitoring** - Structured JSON output with subagent tracking
- ✅ **Comprehensive logging** - Detailed logs with cost, duration, tools used, subagents spawned

## 🏗️ Architecture

```
Task Manager (Kanban) → Webhook → Scheduler → Claude Code (headless)
                                              ↓
                                    Main Agent spawns:
                                    - frontend-developer
                                    - backend-developer
                                    - QA-engineer
                                    - devops-engineer
                                    - ai-engineer
                                    etc.
```

## 📋 Requirements

- Node.js 18+
- Claude Code CLI (installed and authenticated with subscription)
- Task Manager API running on `localhost:3001`
- Claude Code settings configured with `bypassPermissions` mode

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd ~/Desktop/projects/claude-task-scheduler
npm install
```

### 2. Configure Settings

The scheduler uses `config.json` for configuration:

```json
{
  "taskManagerAPI": {
    "apiUrl": "http://localhost:3001/api",
    "email": "claude@taskmanager.com",
    "password": ".PX0UQUBN67Nme32"
  },
  "webhook": {
    "port": 3002,
    "secret": "claude-webhook-secret-2026"
  }
}
```

### 3. Verify Claude Code Settings

Ensure `~/.claude/settings.json` has:

```json
{
  "permissions": {
    "defaultMode": "bypassPermissions"
  }
}
```

This eliminates permission confirmation dialogs during headless execution.

### 4. Start the Scheduler

**IMPORTANT:** Run the scheduler in a **separate terminal** (NOT inside a Claude Code session):

```bash
cd ~/Desktop/projects/claude-task-scheduler
node scheduler-api.js
```

You should see:
```
✅ Scheduler is now running!
🎣 [Webhook] Server listening on port 3002
```

### 5. Create a Test Task

Open another terminal and create a task:

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"claude@taskmanager.com","password":".PX0UQUBN67Nme32"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Create task
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Test Task - Hello World",
    "description": "Say hello world in one sentence, then list 3 random fruits",
    "status": "todo",
    "priority": "high",
    "assignee_id": "vr6yycu4w"
  }'
```

### 6. Watch the Magic Happen

In the scheduler terminal, you'll see:

```
[Webhook] Received task assignment notification
[Claude] Starting headless Claude session with subagent support...
[Claude] Session initialized: task-2026-...
[Claude] Hello, world! Here are three fruits: apple, banana, orange.
[Claude] ✨ Execution complete
[Claude]    Cost: $0.02
[Claude]    Duration: 5.3s
[Claude]    Subagents used: none
```

For complex tasks, you'll see subagent activity:

```
[Claude] 🤖 Spawning subagent: frontend-developer
[Claude] 🤖 Spawning subagent: backend-developer
[Claude] ✨ Execution complete
[Claude]    Subagents used: frontend-developer, backend-developer
```

## 📁 Project Structure

```
claude-task-scheduler/
├── scheduler-api.js          # Main scheduler (webhook server + task executor)
├── claude-executor.js        # Claude Code headless executor
├── task-manager-api.js       # API client for task manager
├── config.json               # Configuration
├── logs/                     # Execution logs
│   ├── scheduler.log         # Scheduler activity
│   └── task-*.log            # Individual task logs
├── README.md                 # This file
└── TESTING.md                # Detailed testing guide
```

## 🔧 How It Works

### 1. Webhook Reception

When a task is assigned to Claude (user ID: `vr6yycu4w`) and moved to "todo" status, the task manager sends a webhook to the scheduler.

### 2. Task Execution

The scheduler:
1. Fetches full task details and comments
2. Changes task status to "in-progress"
3. Builds a comprehensive prompt with task context
4. Launches `claude -p` (headless mode) with:
   - `--permission-mode bypassPermissions` - No dialogs
   - `--output-format stream-json` - Structured real-time output
   - `--verbose` - Detailed logging
   - Fresh session per task

### 3. Multi-Agent Orchestration

The main Claude agent:
- Analyzes the task
- Decides if subagents are needed
- Spawns specialized subagents via Task tool:
  - `frontend-developer` - UI/UX implementation
  - `backend-developer` - API/database work
  - `QA-engineer` - Testing
  - `devops-engineer` - Deployment
  - `ai-engineer` - AI feature integration
  - etc.
- Aggregates results
- Returns final output

### 4. Status Updates

Upon completion:
- ✅ Success → Move to "for-review" with Claude's response as comment
- ❌ Failure → Move back to "todo" with error details

## 📊 Logging

Each task execution generates a detailed log in `logs/task-TIMESTAMP.log`:

```
=== PROMPT ===
Task from Kanban Board:
Title: Build Todo App
Description: Create a full-stack todo app...

=== TEXT OUTPUT ===
I'll create a full-stack todo app using React and Node.js...

=== TOOLS USED ===
Bash, Write, Edit, Task

=== SUBAGENTS SPAWNED ===
frontend-developer, backend-developer, QA-engineer

=== SESSION ID ===
task-2026-02-07T22-25-34-284Z

=== COST ===
$0.45

=== DURATION ===
45.2s

=== TURNS ===
12
```

## 🐛 Troubleshooting

### Issue: `claude -p` hangs

**Cause:** Running inside a Claude Code session (resource conflict)

**Solution:** Run scheduler in a separate terminal, NOT inside Claude Code

### Issue: No subagents spawned

**Cause:** Task is simple enough that main agent handles directly

**Expected:** Simple tasks (e.g., "say hello") don't need subagents. Complex tasks (e.g., "build full-stack app") will spawn subagents.

### Issue: Permission errors

**Cause:** `bypassPermissions` not configured

**Solution:** Verify `~/.claude/settings.json` has `"defaultMode": "bypassPermissions"`

### Issue: Webhook not received

**Cause:** Task manager not configured to send webhooks, or webhook URL incorrect

**Solution:** Check task manager webhook settings in database

## 📈 Performance

- **Simple tasks:** ~5-15 seconds
- **Complex tasks with subagents:** ~30-120 seconds
- **Cost:** Varies by task complexity ($0.01-$1.00 typical)

## 🚦 Production Deployment

Use PM2 for process management:

```bash
# Install PM2
npm install -g pm2

# Start scheduler with PM2
pm2 start scheduler-api.js --name claude-scheduler

# Auto-restart on system boot
pm2 startup
pm2 save

# View logs
pm2 logs claude-scheduler

# Restart
pm2 restart claude-scheduler
```

## 📚 Resources

- [Claude Code Documentation](https://code.claude.com/docs)
- [Subagents Guide](https://code.claude.com/docs/en/sub-agents)
- [Headless Mode](https://code.claude.com/docs/en/headless)
- [Task Tool Guide](https://dev.to/bhaidar/the-task-tool-claude-codes-agent-orchestration-system-4bf2)

## 📝 License

MIT

---

Built with Claude Code's multi-agent system and headless automation capabilities.
