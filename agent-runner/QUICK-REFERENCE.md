# Quick Reference Card

## 🚀 Start Everything

```bash
# Terminal 1: Scheduler
cd ~/Desktop/projects/claude-task-scheduler
npm start

# Terminal 2: Test (optional)
./quick-test.sh

# Terminal 3: Watch logs (optional)
tail -f logs/task-*.log
```

## 🎯 Send Task via Webhook

```bash
curl -X POST http://localhost:3002/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{
    "id": "task-1",
    "title": "Your Task Title",
    "description": "Instructions for Claude",
    "assignee_name": "claude",
    "priority": "high"
  }'
```

## 📊 Check Status

```bash
# Health check
curl http://localhost:3002/health

# Get tasks
npm run test:api

# Check logs
tail -f logs/task-*.log
```

## ⚙️ Configuration

**File:** `config.json`

```json
{
  "taskManagerAPI": {
    "email": "claude@taskmanager.com",
    "password": ".PX0UQUBN67Nme32"
  },
  "schedule": {
    "checkInterval": "*/30 * * * *"
  },
  "webhook": {
    "port": 3002,
    "secret": "your-webhook-secret-change-this"
  }
}
```

## 📚 Available Commands

```bash
npm start              # Start scheduler
npm run test:api       # Test API connection
npm run test:server    # Start test kanban (if using that)
npm run test:claude    # Test Claude executor
./quick-test.sh        # Run quick test
./test-integration.sh  # Full integration test
```

## 📖 Documentation

- `COMPLETE-GUIDE.md` - Everything
- `WEBHOOK-GUIDE.md` - Webhook integration
- `TEST-WORKFLOW.md` - Testing guide
- `API-REFERENCE.md` - API docs
- `INTEGRATION.md` - Task Manager integration

## 🔄 Task Status Values

| Status | When | Claude Does |
|--------|------|-------------|
| `todo` | Created | Waiting for execution |
| `in-progress` | During work | Claude is working |
| `done` | After work | Task completed ✅ |
| `backlog` | Not needed | In backlog |

## 🎯 Task Properties

```javascript
{
  "id": "unique-id",
  "title": "Task name",
  "description": "Instructions for Claude",
  "status": "todo",               // todo, in-progress, done, backlog
  "priority": "high",             // low, medium, high
  "due_date": "2026-02-15",       // YYYY-MM-DD
  "scheduled_date": "2026-02-06", // YYYY-MM-DD
  "scheduled_time": "10:00",      // HH:MM
  "assignee_name": "claude"
}
```

## ⏰ Cron Schedule Examples

```
*/30 * * * *    Every 30 minutes
*/15 * * * *    Every 15 minutes
0 * * * *       Every hour
0 9 * * *       Daily at 9 AM
0 0 * * 1       Monday at midnight
0 10 * * 2      Tuesday at 10 AM
0 0 1 * *       Monthly on 1st
```

## 🔐 Security

- Change webhook secret in `config.json`
- Never commit credentials to git
- Use HTTPS in production
- Whitelist webhook IP addresses

## 🐛 Quick Troubleshooting

| Problem | Fix |
|---------|-----|
| Scheduler not responding | `npm start` in correct folder |
| Webhook failing | Check secret header matches config |
| Task not executing | Check scheduled_time is "now" |
| Logs not showing | Check `logs/` directory exists |
| API auth fails | Verify email/password in config.json |
| Claude Code not found | Install Claude Code CLI |

## 📋 Ports Used

| Port | Service | URL |
|------|---------|-----|
| 3001 | Task Manager API | http://localhost:3001 |
| 3002 | Scheduler Webhook | http://localhost:3002 |
| 8081 | Task Manager UI | http://localhost:8081 |
| 5173 | Vite Dev Server | http://localhost:5173 |

## 📁 Project Structure

```
claude-task-scheduler/
├── scheduler-api.js          Main scheduler
├── task-manager-api.js       API client
├── claude-executor.js        Claude CLI wrapper
├── config.json               Configuration
├── quick-test.sh            Quick test script
├── logs/                     Execution logs
└── *.md                      Documentation
```

## 🎉 One-Liner Testing

```bash
cd ~/Desktop/projects/claude-task-scheduler && npm start &\
sleep 2 && ./quick-test.sh
```

## 💡 Tips

**Watch logs live:**
```bash
tail -f logs/task-*.log
```

**Manual trigger check:**
```bash
curl http://localhost:3002/trigger/check
```

**Test API:**
```bash
npm run test:api
```

**Check health:**
```bash
curl http://localhost:3002/health | jq
```

## 🚀 Three Ways to Execute

1. **Webhook** (instant)
   ```bash
   curl -X POST http://localhost:3002/webhook/task-assigned ...
   ```

2. **Scheduler** (periodic, 30 min)
   ```bash
   Create task with scheduled_date and scheduled_time
   ```

3. **Manual trigger**
   ```bash
   curl http://localhost:3002/trigger/check
   ```

---

**Need help?** Read the documentation files or check logs!
