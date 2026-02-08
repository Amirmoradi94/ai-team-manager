# Webhook UI Integration - Complete Guide

The Task Manager now has a **built-in Settings UI** for configuring Claude webhook integration!

## 🎉 What's New

### Backend Changes
✅ **Settings Table** - Stores Claude webhook URL and secret
✅ **Settings API** - GET/PUT/DELETE endpoints for settings
✅ **Automatic Webhooks** - Tasks assigned to Claude trigger webhooks automatically
✅ **Security** - Webhook secret authentication

### Frontend Changes
✅ **Integration Settings UI** - Beautiful settings panel in Settings tab
✅ **Webhook Configuration** - Enter URL and secret directly in UI
✅ **Test Button** - Test webhook connection without creating tasks
✅ **Save Indicator** - Visual feedback when settings are saved

---

## 🚀 How to Use

### Step 1: Start Claude Scheduler

```bash
cd ~/Desktop/projects/claude-task-scheduler
npm start
```

The scheduler will be listening on:
```
http://localhost:3002/webhook/task-assigned
```

### Step 2: Configure in Task Manager UI

1. **Open Task Manager** - http://localhost:8081
2. **Login** as admin (amir.94.eng@gmail.com)
3. **Go to Settings** tab
4. **Scroll to "Claude Integration"** section (bottom right)
5. **Enter Webhook URL:**
   ```
   http://localhost:3002/webhook/task-assigned
   ```
6. **Enter Webhook Secret** (optional):
   ```
   your-webhook-secret-change-this
   ```
7. **Click "Save Settings"** ✅
8. **Click "Test Webhook"** to verify connection

### Step 3: Create and Assign Task

1. **Go to Tasks** (main page)
2. **Click "New Task"** or **"+"** button
3. **Fill in task details:**
   ```
   Title: Test Claude Webhook
   Description: Write a Python function that prints "Hello from webhook!"
   Priority: High
   Assign to: Claude
   ```
4. **Click "Save"**

### Step 4: Watch Magic Happen! ✨

The moment you assign the task to Claude:

1. **Webhook fires automatically** 🎣
2. **Claude scheduler receives it** 📨
3. **Task executes immediately** ⚡
4. **Status updates to "done"** ✅
5. **Logs are saved** 📝

Check Claude scheduler terminal to see:
```
[Webhook] Received task assignment notification
[Webhook] Task: Test Claude Webhook
[API] Changing task status to: in-progress
[Claude Output] Creating Python function...
[API] Task completed successfully
```

---

## 📊 Architecture

```
┌──────────────────────────┐
│  Task Manager UI         │
│  (Settings Tab)          │
│  - Enter webhook URL     │
│  - Save to database      │
└────────────┬─────────────┘
             │
             ↓
┌──────────────────────────┐
│  Settings API            │
│  PUT /api/settings/:key  │
│  - claude_webhook_url    │
│  - claude_webhook_secret │
└────────────┬─────────────┘
             │
             ↓
┌──────────────────────────┐
│  Database (SQLite)       │
│  settings table          │
│  - key                   │
│  - value                 │
│  - updated_at            │
└────────────┬─────────────┘
             │
             ↓ (When task assigned to Claude)
┌──────────────────────────┐
│  POST /api/tasks         │
│  - Check assignee name   │
│  - If "Claude" → webhook │
└────────────┬─────────────┘
             │
             ↓
┌──────────────────────────┐
│  sendClaudeWebhook()     │
│  - Get URL from settings │
│  - Send POST request     │
│  - Include secret header │
└────────────┬─────────────┘
             │
             ↓
┌──────────────────────────┐
│  Claude Scheduler        │
│  http://localhost:3002   │
│  /webhook/task-assigned  │
│  - Validates secret      │
│  - Marks in-progress     │
│  - Executes task         │
│  - Marks done            │
└──────────────────────────┘
```

---

## 🔧 Technical Details

### Backend API Endpoints

#### Get Settings
```http
GET /api/settings
Authorization: Bearer {token}

Response:
{
  "claude_webhook_url": "http://localhost:3002/webhook/task-assigned",
  "claude_webhook_secret": "your-webhook-secret"
}
```

#### Update Setting
```http
PUT /api/settings/{key}
Authorization: Bearer {token}
Content-Type: application/json

{
  "value": "http://localhost:3002/webhook/task-assigned"
}

Response:
{
  "success": true,
  "key": "claude_webhook_url",
  "value": "http://localhost:3002/webhook/task-assigned"
}
```

#### Delete Setting
```http
DELETE /api/settings/{key}
Authorization: Bearer {token}

Response:
{
  "success": true
}
```

### Webhook Sending Logic

**When does it fire?**
- ✅ Creating a new task assigned to Claude
- ✅ Updating a task to assign it to Claude (when assignee changes)

**What data is sent?**
```javascript
{
  id: "task-id",
  title: "Task title",
  description: "Task description",
  status: "todo",
  priority: "high",
  due_date: "2026-02-15",
  scheduled_date: "2026-02-10",
  scheduled_time: "10:00",
  assignee_name: "claude",
  assignee_id: "user-id",
  created_at: "2026-02-06 10:30:00"
}
```

**What headers are sent?**
```
Content-Type: application/json
x-webhook-secret: {secret from settings}
```

---

## 🎨 UI Components

### Integration Settings Card

**Location:** Settings Tab → Right Column → Bottom

**Features:**
- 📝 Webhook URL input field
- 🔒 Webhook secret password field (masked)
- 💾 Save button with success indicator
- 🧪 Test webhook button
- ℹ️ Help text and instructions
- 💡 Quick tips

**Validation:**
- URL must be provided to save
- Test button disabled if no URL
- Loading states during save/test
- Toast notifications for feedback

---

## 🔐 Security

### Webhook Secret

The webhook secret is:
1. **Stored in database** - `settings` table
2. **Sent in header** - `x-webhook-secret`
3. **Validated by scheduler** - Must match config.json

### Admin Only

- ⚠️ Only admin users can update settings
- Regular users can view but not modify
- Protected by `requireAdmin` middleware

### Best Practices

```
✅ Change default secret
✅ Use HTTPS in production
✅ Don't share webhook URL publicly
✅ Whitelist IPs if possible
✅ Monitor webhook logs
```

---

## 🧪 Testing

### Test 1: Configure Settings

```bash
# 1. Visit Settings
http://localhost:8081 → Settings tab

# 2. Scroll to "Claude Integration"

# 3. Enter URL and secret

# 4. Click "Save Settings"

# 5. Should see: "Settings saved" toast ✅
```

### Test 2: Test Webhook

```bash
# 1. After saving settings

# 2. Click "Test Webhook" button

# 3. Check Claude scheduler terminal:
[Webhook] Received task assignment notification
[Webhook] Task: Test Webhook

# 4. Should see: "Webhook test successful" toast ✅
```

### Test 3: Create Task

```bash
# 1. Go to main Tasks page

# 2. Create new task

# 3. Assign to Claude

# 4. Save

# 5. Watch scheduler terminal - webhook fires! ⚡

# 6. Task executes immediately

# 7. Status changes to "done" ✅
```

---

## 📁 Files Changed

### Backend
```
server/index.js
  ├─ Added settings table
  ├─ Added sendClaudeWebhook() function
  ├─ Added GET /api/settings
  ├─ Added PUT /api/settings/:key
  ├─ Added DELETE /api/settings/:key
  ├─ Modified POST /api/tasks (webhook on create)
  └─ Modified PUT /api/tasks/:id (webhook on update)
```

### Frontend
```
src/components/Settings/
  ├─ IntegrationSettings.tsx (NEW)
  └─ SettingsPage.tsx (MODIFIED)
```

---

## 🎯 Workflow Examples

### Example 1: Quick Task

```
1. Settings configured ✅
2. Create task "Write hello.py"
3. Assign to Claude
4. Save
   ↓
5. Webhook fires (< 1 sec)
6. Claude creates hello.py
7. Task marked done
8. View in logs/
```

### Example 2: Scheduled Task

```
1. Settings configured ✅
2. Create task "Daily report"
3. Scheduled: Tomorrow 9 AM
4. Assign to Claude
5. Save
   ↓
6. Webhook fires immediately
7. Scheduler queues for 9 AM tomorrow
8. Executes at 9 AM
9. Report generated
```

### Example 3: Update Assignment

```
1. Task exists (assigned to John)
2. Change assignee to Claude
3. Save
   ↓
4. Webhook fires
5. Claude picks it up
6. Executes immediately
7. John sees it's done
```

---

## 🐛 Troubleshooting

### Webhook Not Firing

**Check:**
```bash
# 1. Is Claude scheduler running?
curl http://localhost:3002/health

# 2. Is webhook URL saved?
# Go to Settings → Claude Integration
# Should show the URL you entered

# 3. Check database
cd ~/Desktop/projects/task-manager/server
sqlite3 taskmanager.db "SELECT * FROM settings;"

# 4. Check logs
# Task Manager server logs should show:
Sending webhook to Claude: { taskId: 'xxx', url: 'http://...' }
```

### Webhook Test Fails

```bash
# 1. Ensure scheduler is running
cd ~/Desktop/projects/claude-task-scheduler
npm start

# 2. Check URL is correct
# Should be: http://localhost:3002/webhook/task-assigned

# 3. Check secret matches
# Task Manager settings = Claude scheduler config.json

# 4. Try manual curl
curl -X POST http://localhost:3002/webhook/task-assigned \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{"id":"test","title":"Test"}'
```

### Settings Not Saving

```bash
# 1. Are you logged in as admin?
# Only admin can change settings

# 2. Check browser console for errors
# F12 → Console tab

# 3. Check server logs
# Should show: "Setting updated: { key: 'claude_webhook_url' }"

# 4. Try direct API call
curl -X PUT http://localhost:3001/api/settings/claude_webhook_url \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"value":"http://localhost:3002/webhook/task-assigned"}'
```

---

## 🎉 Success Indicators

You'll know it's working when:

✅ **Settings save** with "Settings saved" toast
✅ **Test webhook** shows "Webhook test successful"
✅ **Task creation** triggers webhook immediately
✅ **Scheduler logs** show task received
✅ **Task status** changes to "done" automatically
✅ **Logs folder** contains execution output

---

## 📈 Next Steps

1. ✅ **Configure settings** in UI
2. ✅ **Test webhook** connection
3. ✅ **Create test task** assigned to Claude
4. ✅ **Verify execution** in logs
5. 🚀 **Use in production!**

---

## 🎯 Quick Reference

**Settings Location:** Settings Tab → Claude Integration (bottom right)

**Default Webhook URL:** `http://localhost:3002/webhook/task-assigned`

**Default Secret:** `your-webhook-secret-change-this`

**Database Table:** `settings`

**API Endpoints:** `/api/settings`, `/api/settings/:key`

**Files:** `server/index.js`, `IntegrationSettings.tsx`

---

Enjoy your fully integrated webhook automation! 🎊
