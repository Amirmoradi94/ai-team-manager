# Testing the Claude Task Scheduler

## Problem Identified

When the scheduler runs inside a Claude Code session (like this one), spawning `claude -p` hangs due to resource conflicts. Claude cannot reliably run nested instances of itself.

## Solution: Run Scheduler Independently

The scheduler must run **outside** any Claude Code session.

## Testing Steps

### 1. Stop This Claude Session's Scheduler

First, kill the scheduler that was started from within this Claude session:

```bash
cd ~/Desktop/projects/claude-task-scheduler
lsof -ti:3002 | xargs kill -9
```

### 2. Open a New Terminal (NOT in Claude Code)

Open a regular macOS Terminal app (⌘+Space → "Terminal")

### 3. Start the Scheduler

```bash
cd ~/Desktop/projects/claude-task-scheduler
node scheduler-api.js
```

You should see:
```
✅ Scheduler is now running!
🎣 [Webhook] Server listening on port 3002
```

### 4. Create a Test Task (from another terminal)

Open another terminal and run:

```bash
cd ~/Desktop/projects/claude-task-scheduler

# Create test task
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"claude@taskmanager.com","password":".PX0UQUBN67Nme32"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

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

### 5. Watch the Scheduler Terminal

You should see output like:

```
[Webhook] Received task assignment notification
[Claude] Starting headless Claude session with subagent support...
[Claude] Session initialized: task-2026-...
[Claude] Hello, world! Here are three fruits: apple, banana, orange.
[Claude] ✨ Execution complete
```

### 6. Check the Kanban Board

Open http://localhost:5173 (or 8081) and verify:
- Task moved from "todo" → "in-progress" → "for-review"
- Claude's response appears as a comment

## Expected Behavior

### Simple Tasks
For simple tasks like "Say hello world", Claude should handle it directly without spawning subagents:

```
[Claude] Starting headless Claude session...
[Claude] Hello, world! ...
[Claude] Subagents used: none
```

### Complex Tasks
For complex tasks like "Create a full-stack app", Claude should spawn subagents:

```
[Claude] Starting headless Claude session...
[Claude] 🤖 Spawning subagent: frontend-developer
[Claude] 🤖 Spawning subagent: backend-developer
[Claude] 🤖 Spawning subagent: QA-engineer
[Claude] ✨ Execution complete
[Claude] Subagents used: frontend-developer, backend-developer, QA-engineer
```

## Configuration

### Permission Mode
The executor uses `--permission-mode bypassPermissions` which eliminates the confirmation dialog.

Your `~/.claude/settings.json` has been updated to:
```json
{
  "permissions": {
    "defaultMode": "bypassPermissions"
  }
}
```

### Headless Mode
The executor uses `claude -p` with:
- `--output-format stream-json` - Real-time structured output
- `--verbose` - Detailed logging
- `--permission-mode bypassPermissions` - No dialogs
- Fresh session per task (no session pollution)

## Logs

Logs are saved to:
```
~/Desktop/projects/claude-task-scheduler/logs/
├── scheduler.log          # Scheduler main log
├── task-TIMESTAMP.log     # Individual task execution logs
```

Each task log contains:
- Prompt
- Text output
- Tools used
- **Subagents spawned** (if any)
- Session ID
- Cost, duration, token usage
- Raw stream JSON

## Troubleshooting

### Issue: `claude -p` hangs
**Cause:** Running inside a Claude Code session
**Fix:** Run scheduler in a separate terminal

### Issue: No subagents spawned for complex tasks
**Cause:** Task might be too simple, or Claude decided to handle it directly
**Fix:** Use more complex prompts like "Build a full-stack todo app with frontend, backend, and tests"

### Issue: Permission errors
**Cause:** bypassPermissions not working
**Fix:** Check `~/.claude/settings.json` has `"defaultMode": "bypassPermissions"`

### Issue: Webhook not received
**Cause:** Task manager server not sending webhooks
**Fix:** Check task manager server logs, verify webhook URL in database

## Success Criteria

✅ Scheduler runs without hanging
✅ Simple tasks complete successfully
✅ Complex tasks spawn appropriate subagents
✅ Kanban board updates automatically
✅ Logs show subagent activity
✅ Uses subscription authentication (not API key)

## Next Steps

Once testing confirms everything works:

1. **Run as background service** - Use PM2 or systemd to keep scheduler running
2. **Monitor logs** - Set up log rotation
3. **Add more complex test tasks** - Test multi-agent scenarios
4. **Configure alerts** - Get notified when tasks fail
