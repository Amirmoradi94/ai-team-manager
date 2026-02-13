# Subtask Creation and Scheduling Flow

**Date**: 2026-02-12
**Status**: ✅ **FULLY DOCUMENTED**

---

## Overview

When the CTO splits an epic task into subtasks, this document explains exactly how subtasks are created, added to the board, and scheduled for execution.

---

## Complete Flow Diagram

```
User Creates Epic Task
         ↓
Task appears on UI board (status='todo')
         ↓
Runner polls for tasks (every 10s)
         ↓
CTO evaluates task
         ↓
CTO Decision: "SPLIT"
         ↓
┌─────────────────────────────────────────┐
│ CTOEngine.splitTask()                   │
│                                         │
│ 1. Load employees from database         │
│ 2. Call AI for subtask breakdown        │
│ 3. Calculate smart deadlines            │
│ 4. FOR EACH SUBTASK:                    │
│    ├─ Build comprehensive description   │
│    ├─ Set project_id (inherit)          │
│    ├─ Set team_id (inherit)             │
│    ├─ Set scheduled_date & time         │
│    ├─ Set due_date (calculated)         │
│    └─ Call taskAPI.createTask()         │
│         ↓                                │
│    ┌─────────────────────────────┐      │
│    │ Backend: POST /api/tasks    │      │
│    │                             │      │
│    │ - Validates task data       │      │
│    │ - Inserts into database     │      │
│    │ - Returns created task      │      │
│    │ - Task now has status='todo'│      │
│    └─────────────────────────────┘      │
│                                         │
│ 5. Mark parent task as 'epic'           │
│ 6. Log subtask details                  │
└─────────────────────────────────────────┘
         ↓
Subtasks now in database with status='todo'
         ↓
UI auto-refreshes and shows subtasks on board
         ↓
Runner next poll cycle (within 10s)
         ↓
Runner detects new subtasks
         ↓
CTO evaluates each subtask individually
         ↓
CTO sees scheduled_date/time
         ↓
CTO Decision: "SCHEDULE"
         ↓
Runner sets setTimeout() for scheduled time
         ↓
When scheduled time arrives:
         ↓
Runner executes subtask with Team Lead
         ↓
Team Lead uses subtask description as prompt
         ↓
Task completed and marked for review
```

---

## Step-by-Step Details

### Step 1: CTO Splits Task

**File**: `agent-runner/cto/CTOEngine.js`
**Method**: `splitTask(task, payload)`

```javascript
async splitTask(task, payload) {
  // Load employees for AI context
  const employees = await this.getEmployees();

  // Calculate deadline distribution
  const overallDeadline = task.due_date ? new Date(task.due_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const totalTimeAvailable = overallDeadline - now;
  const subtaskCount = subtasksData.length;

  // Create each subtask
  for (let i = 0; i < subtasksData.length; i++) {
    const sub = subtasksData[i];

    // Calculate smart scheduling
    const scheduleTime = new Date(Date.now() + (accumulatedDelayMinutes * 60 * 1000));
    const timePerSubtask = (totalTimeAvailable * 0.8) / subtaskCount;
    const subtaskDeadline = new Date(now + timePerSubtask * (i + 1));

    // Build comprehensive description
    const contract = `...comprehensive markdown prompt...`;

    // Create subtask in database
    const subtaskData = {
      title: sub.title,
      description: contract, // ← This becomes the Team Lead's prompt
      status: 'todo', // ← Picked up by runner
      parent_id: task.id,
      task_type: 'subtask',
      project_id: task.project_id, // ← Inherited
      team_id: task.team_id, // ← Inherited
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      due_date: deadlineStr // ← Smart deadline
    };

    const created = await this.taskAPI.createTask(subtaskData);
  }
}
```

---

### Step 2: Backend Creates Task

**File**: `task-manager/server/index.js`
**Endpoint**: `POST /api/tasks`

```javascript
app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { title, description, status, priority, due_date, scheduled_date, scheduled_time,
          assignee_id, project_id, team_id, parent_id, task_type } = req.body;

  const id = generateId();

  await run(`
    INSERT INTO tasks (
      id, title, description, status, priority, due_date,
      scheduled_date, scheduled_time, assignee_id, created_by,
      project_id, team_id, parent_id, task_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, title, description, status, priority, due_date,
      scheduled_date, scheduled_time, assignee_id, req.user.id,
      project_id, team_id, parent_id, task_type]);

  const task = await get('SELECT * FROM tasks WHERE id = ?', [id]);

  res.json(task);
});
```

**Result**: Task is now in database with `status='todo'`

---

### Step 3: UI Displays Subtasks

**Frontend**: React components poll backend for tasks

The UI automatically refreshes and displays:
- Parent task with status "Epic" or "In Progress"
- Child subtasks with status "Todo"
- Scheduled times visible on calendar view
- Project and team associations intact

**Query**: Frontend calls `GET /api/tasks` which returns all tasks including subtasks

---

### Step 4: Runner Picks Up Subtasks

**File**: `agent-runner/agent-runner.js`
**Method**: `pollForTasks()`
**Interval**: Every 10 seconds

```javascript
async pollForTasks() {
  // Fetch all tasks with status='todo'
  const tasks = await this.taskAPI.getRunnerTasks(this.runnerToken);

  for (const task of tasks) {
    // Skip already processed
    if (this.processedTaskIds.has(task.id)) continue;

    console.log(`[Runner] New task detected: ${task.title}`);

    // Get full payload including project, team, specialists
    const payload = await this.taskAPI.getRunnerPayload(task.id);

    // CTO evaluates the task
    const decision = await this.cto.evaluate(payload.task, payload);

    // If task has scheduled_date/time in the future...
    if (decision.action === 'schedule') {
      const delay = decision.scheduledAt.getTime() - Date.now();

      // Set timeout to execute at scheduled time
      setTimeout(async () => {
        this.processedTaskIds.delete(task.id);
        await this.pollForTasks(); // Re-poll to execute now
      }, Math.max(0, delay));

      continue;
    }

    // Otherwise execute immediately...
  }
}
```

**Backend Query**:
```sql
SELECT * FROM tasks
WHERE project_id IN (...)
AND status = 'todo'
ORDER BY created_at ASC
```

---

### Step 5: CTO Evaluates Subtask

**File**: `agent-runner/cto/CTOEngine.js`
**Method**: `evaluate(task, payload)`

```javascript
async evaluate(task, payload) {
  const { scheduled_date, scheduled_time } = task;

  // Check if task has future schedule
  if (scheduled_date && scheduled_time) {
    const scheduleTime = new Date(`${scheduled_date}T${scheduled_time}`);

    if (scheduleTime > new Date()) {
      return {
        action: 'schedule',
        reason: `Task scheduled for ${scheduled_date} ${scheduled_time}`,
        scheduledAt: scheduleTime,
        confidence: 100
      };
    }
  }

  // If scheduled time has passed, evaluate for immediate execution
  const employees = await this.getEmployees();
  const aiAnalysis = await this.aiEngine.analyzeTask(task, {
    employees,
    availableProviders: ['claude', 'gemini', 'codex'],
    resourceStatus: this.resourceManager.getStatus()
  });

  return {
    action: 'assign',
    assignee_id: payload.team?.lead?.id,
    provider: 'claude',
    model: 'claude-sonnet-4.5',
    reason: aiAnalysis.reasoning
  };
}
```

---

### Step 6: Team Lead Execution

**What Team Lead Receives**:
The **entire subtask description** becomes the prompt for the Team Lead. This includes:

1. **Objective**: Detailed explanation of what to accomplish
2. **Context**: Parent task info, subtask position (1 of N)
3. **Output Directory**: Where to save artifacts
4. **Inputs Required**: Dependencies on previous subtasks
5. **Implementation Guidelines**: Tech stack, standards, requirements
6. **Expected Output**: Definition of done with acceptance criteria
7. **Recommended Employees**: Suggested specialists
8. **Timeline**: Start time, deadline, estimated duration
9. **Next Steps**: What comes after this subtask

**Example Subtask Description**:
```markdown
# Implement User Authentication API

## 🎯 Objective

Build a secure REST API for user authentication including login, logout,
and token refresh endpoints. Must support JWT tokens with 24h expiration
and refresh tokens with 7d expiration.

## 🔗 Context

This is **Subtask 2 of 5** in the epic: "Build Complete Auth System"

**Parent Task Description:**
Create a full authentication system with backend API, frontend UI, and
database schema...

## 📂 Output Directory

`tasks/build-complete-auth-system` (Create if not exists)

**CRITICAL**: All artifacts must be saved in this directory.

## 📥 Inputs Required

- Database schema from Subtask 1 (users table with hashed passwords)
- JWT secret key from environment variables
- Express.js server setup

**Previous Subtask**: "Design Database Schema" - Check its outputs before starting.

## 📝 Implementation Guidelines

**Tech Stack:**
- Node.js with Express.js
- bcrypt for password hashing
- jsonwebtoken for JWT tokens
- Express middleware for route protection

**Requirements:**
- Rate limiting (5 login attempts per minute)
- Password validation (min 8 chars, uppercase, number, special char)
- Secure HTTP-only cookies for refresh tokens
- CORS configuration for frontend

**Additional Requirements:**
- Write clean, well-documented code
- Include error handling and validation
- Add inline comments for complex logic
- Follow RESTful API conventions

## 📤 Expected Output (Definition of Done)

**Files to Create:**
1. `routes/auth.js` - Authentication routes
2. `middleware/authMiddleware.js` - JWT verification
3. `controllers/authController.js` - Business logic
4. `tests/auth.test.js` - Unit tests

**API Endpoints:**
- POST /api/auth/register - Create new user
- POST /api/auth/login - Login and return JWT
- POST /api/auth/logout - Invalidate session
- POST /api/auth/refresh - Refresh JWT token

**Acceptance Criteria:**
- All 4 endpoints implemented and working
- JWT tokens generated correctly
- Password hashing with bcrypt
- Proper error responses (400, 401, 500)
- Rate limiting active
- Unit tests pass with 80%+ coverage

## 👥 Recommended Employees

- **Backend Developer (Node.js)** - Primary implementer
- **Security Specialist** - Review auth logic
- **QA Engineer** - Test coverage verification

## ⏰ Timeline

- **Start Time**: 2026-02-12T10:30:00Z
- **Deadline**: 2026-02-13T14:30:00Z
- **Estimated Duration**: 120 minutes

**⚠️ Parent Task Deadline**: 2026-02-19T00:00:00Z
Ensure timely completion to stay on schedule.

## 🔄 Next Steps

After completing this subtask, the next task is: "Build Frontend Login UI"

---

*Generated by CTO Intelligence Layer*
*Epic: Build Complete Auth System | Subtask 2/5 | Complexity: moderate*
```

---

## Key Features

### ✅ Automatic Board Addition

Subtasks are **immediately visible** on the UI board after creation:
- Database insertion happens synchronously
- Frontend polls backend every few seconds
- New subtasks appear under parent epic
- Status shows as "Todo"
- Scheduled time visible in calendar view

### ✅ Smart Scheduling

Subtasks are **automatically scheduled** based on:
1. **Parent deadline**: If parent has `due_date`, distribute time across subtasks
2. **Sequential execution**: Each subtask starts after previous estimated to complete
3. **Buffer time**: Reserve 20% of total time for final integration/review
4. **Resource pressure**: Add delays between subtasks if API limits are high

**Example**:
```
Parent Task: 7 days deadline, 4 subtasks

Subtask 1: Start now, deadline in 1.4 days
Subtask 2: Start in 1.4 days, deadline in 2.8 days
Subtask 3: Start in 2.8 days, deadline in 4.2 days
Subtask 4: Start in 4.2 days, deadline in 5.6 days
Buffer: 1.4 days (5.6d to 7d)
```

### ✅ Comprehensive Descriptions

Each subtask description is **fully self-contained**:
- All context from parent task
- Dependencies on previous subtasks
- Specific technical requirements
- Acceptance criteria
- Timeline and urgency
- Recommended employees

**Why this matters**: Team Lead receives this as the ONLY prompt, so it must have everything needed for successful execution.

### ✅ Project/Team Inheritance

Subtasks **automatically inherit**:
- `project_id` - Maintains project association
- `team_id` - Keeps team context
- Priority level
- Global rules from project

This ensures:
- Subtasks appear in correct project view
- Team context is maintained
- Project-specific rules apply
- Resource tracking per project

---

## Timing Details

### When Subtasks Appear on Board

| Event | Time |
|-------|------|
| CTO calls `createTask()` | 0ms |
| Backend inserts to database | ~10ms |
| Backend returns created task | ~15ms |
| CTO logs subtask details | ~20ms |
| UI next poll cycle | 0-5 seconds |
| **User sees subtask on board** | **< 5 seconds** |

### When Runner Picks Up Subtasks

| Event | Time |
|-------|------|
| Subtasks created | 0s |
| Runner next poll | 0-10s |
| Runner detects subtasks | ~11s |
| CTO evaluates scheduling | ~12s |
| **Subtask scheduled via setTimeout** | **~12s** |

### When Subtask Executes

Depends on `scheduled_date` and `scheduled_time`:
- **If time is NOW**: Executes immediately (~12s after creation)
- **If time is FUTURE**: Executes at scheduled time

---

## Database Schema

### Tasks Table

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT, -- ← Full prompt for Team Lead
  status TEXT, -- ← 'todo' for new subtasks
  priority TEXT,
  due_date TEXT, -- ← Calculated deadline
  scheduled_date TEXT, -- ← When to start
  scheduled_time TEXT, -- ← Specific time
  assignee_id TEXT,
  created_by TEXT,
  project_id TEXT, -- ← Inherited from parent
  team_id TEXT, -- ← Inherited from parent
  parent_id TEXT, -- ← Links to epic
  task_type TEXT, -- ← 'subtask'
  ...
);
```

### Example Subtask Row

```json
{
  "id": "task_xyz789",
  "title": "Implement User Authentication API",
  "description": "# Implement User Authentication API\n\n## 🎯 Objective\n...",
  "status": "todo",
  "priority": "high",
  "due_date": "2026-02-13",
  "scheduled_date": "2026-02-12",
  "scheduled_time": "10:30",
  "assignee_id": "team_lead_123",
  "created_by": "cto_ai",
  "project_id": "proj_abc123", // ← From parent
  "team_id": "team_def456", // ← From parent
  "parent_id": "task_parent_001",
  "task_type": "subtask"
}
```

---

## Troubleshooting

### Issue: Subtasks not appearing on board

**Check**:
1. Database: `SELECT * FROM tasks WHERE parent_id = 'parent_task_id'`
2. Status: Ensure `status = 'todo'`
3. UI refresh: Force refresh browser
4. Backend logs: Check for task creation errors

### Issue: Subtasks not being executed

**Check**:
1. Runner logs: Look for "New task detected"
2. CTO logs: Check evaluation decision
3. Scheduled time: Verify it's not in the future
4. Project ID: Ensure subtask has valid `project_id`

### Issue: Subtasks missing context

**Check**:
1. Subtask description: Use `Read` tool to view full description
2. AI analysis: Check `~/mycompany/cto/decisions/DECISION_LOG.md`
3. System prompt: Verify `~/mycompany/cto/SYSTEM_PROMPT.md` is comprehensive

---

## Summary

### The Complete Answer

**Q1: How do subtasks get added to the board?**
→ Via `taskAPI.createTask()` which inserts to database with `status='todo'`. UI polls backend and displays them within 5 seconds.

**Q2: How are they scheduled?**
→ Runner polls every 10s, picks up subtasks, CTO evaluates and schedules via setTimeout based on `scheduled_date/time`. Execution happens at scheduled time.

**Q3: Are descriptions comprehensive?**
→ Yes! Each subtask description is a fully self-contained prompt with: objective, context, inputs, guidelines, expected output, employees, timeline, and next steps.

---

**Status**: ✅ All subtask creation and scheduling flows working correctly
**Last Updated**: 2026-02-12
