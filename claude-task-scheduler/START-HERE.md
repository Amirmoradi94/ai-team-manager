# 🚀 Quick Start - Claude Task Scheduler

## What This Does

Automatically checks your Task Manager app for tasks assigned to Claude and executes them using Claude Code CLI.

## ⚡ Fast Setup (3 Steps)

### 1. Ensure Task Manager is Running

```bash
# Terminal 1: Start Task Manager API
cd ~/Desktop/projects/task-manager/server
node index.js
```

The API should be running on **http://localhost:3001**

### 2. Test the Integration

```bash
cd ~/Desktop/projects/claude-task-scheduler
./test-integration.sh
```

This will verify:
- ✅ Task Manager API is accessible
- ✅ Can login and fetch tasks
- ✅ Webhook port is available
- ✅ Claude Code CLI is installed

### 3. Start the Scheduler

```bash
npm start
```

That's it! The scheduler is now:
- 🔄 Checking for tasks every 30 minutes
- 🎣 Listening for webhooks on port 3002
- 📅 Running scheduled tasks (e.g., Tuesday 10 AM)

## 🧪 Create a Test Task

1. Visit **http://localhost:8081**
2. Login with: `amir.94.eng@gmail.com` / `Admin@123`
3. Create a new task
4. Assign it to yourself
5. Wait ~30 minutes OR trigger manually:

```bash
curl http://localhost:3002/trigger/check
```

## 📊 Monitor Status

```bash
# Check if scheduler is running
curl http://localhost:3002/health

# View task execution logs
tail -f logs/task-*.log

# See what tasks Claude found
cat claude-tasks.json
```

## 🎯 How It Works

```
Your Task Manager (Port 3001)
         ↓
    REST API Call (Every 30 min)
         ↓
Claude Task Scheduler (Port 3002)
         ↓
   Fetch Tasks Assigned to "Claude"
         ↓
    Execute via Claude Code CLI
         ↓
   Update Task Status (completed)
         ↓
    Save Logs & Notify
```

## 📚 Documentation

- **INTEGRATION.md** - Full integration guide with your Task Manager
- **README.md** - Complete documentation
- **QUICKSTART.md** - Detailed testing instructions

## ⚙️ Configuration

Edit `config.json`:

```json
{
  "taskManagerAPI": {
    "apiUrl": "http://localhost:3001/api",
    "email": "your-email@example.com",
    "password": "your-password",
    "claudeAssignee": "Claude"  // Name to filter tasks by
  },
  "schedule": {
    "checkInterval": "*/30 * * * *"  // Every 30 minutes
  }
}
```

## 🔧 Common Commands

```bash
# Start scheduler (API mode - recommended)
npm start

# Test API connection
npm run test:api

# Start with Playwright browser automation (alternative)
npm run start:playwright

# Run integration tests
./test-integration.sh
```

## ❓ Troubleshooting

**Scheduler can't connect to Task Manager**
```bash
# Check if API is running
curl http://localhost:3001/api/auth/login

# Check credentials in config.json
```

**No tasks found**
```bash
# Test API directly
npm run test:api

# Create a task in the UI and assign it to yourself
```

**Claude Code not found**
```bash
# Check if installed
which claude

# The scheduler will still fetch tasks, but can't execute them
```

## 🎉 Next Steps

Once the scheduler is running:

1. **Create Tasks** - Assign tasks to Claude in your Task Manager
2. **Set Schedules** - Use `scheduled_date` and `scheduled_time` fields
3. **Monitor Logs** - Check `logs/` folder for execution results
4. **Deploy** - Use PM2, Docker, or systemd for production

---

**Need help?** Check the detailed guides:
- `INTEGRATION.md` - Integration with your Task Manager
- `README.md` - Complete features and configuration
- `QUICKSTART.md` - Step-by-step testing guide

Happy automating! 🤖
