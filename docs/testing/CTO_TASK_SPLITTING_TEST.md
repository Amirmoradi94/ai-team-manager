# CTO Task Splitting Performance Test

**Date**: 2026-02-12
**Test Type**: CTO Intelligence - Task Splitting & Board Management
**Status**: 🧪 **READY TO TEST**

---

## Test Overview

**Objective**: Verify that CTO can:
1. ✅ Analyze a complex task
2. ✅ Split it into 3 subtasks
3. ✅ Place subtasks on the task board
4. ✅ Set correct scheduling and deadlines
5. ✅ Update mycompany MD files
6. ✅ Log all decisions

**Scope**: CTO behavior only (no team lead execution)

---

## Test Setup

### Current Environment

**Project**:
- ID: `zv485yba8`
- Name: "sample test sale beeblue"

**Team**:
- ID: `q6toaxyp4`
- Name: "sale beeblue"
- Mission: "Boost sales of Beeblue service by 25%"

**Team Lead**:
- ID: `rvhqgo9zj`
- Name: "johnyyy"
- Email: johnyyy_lead@taskmanager.com

**Test Task Created**:
- ID: `task_1770936997`
- Title: "Implement Customer Analytics Dashboard"
- Description: Complex 3-part task (Backend API + Frontend UI + WebSocket)
- Priority: High
- Deadline: 2026-02-15
- Status: `todo` (waiting for CTO)

---

## Step-by-Step Testing

### Step 1: Verify Task Creation ✅

```bash
# Check task exists
sqlite3 taskmanager.db "SELECT id, title, status, priority, due_date FROM tasks WHERE id = 'task_1770936997'"
```

**Expected Output**:
```
task_1770936997|Implement Customer Analytics Dashboard|todo|high|2026-02-15
```

---

### Step 2: Monitor CTO Pickup

**What Should Happen**:
1. Agent-runner polls for tasks (every ~10-30 seconds)
2. CTO evaluates task complexity
3. CTO decides to SPLIT (task is clearly complex)
4. CTO creates 3 subtasks
5. Parent task becomes `epic` with status `in-progress`

**Monitor in Real-Time**:

**Terminal 1** - Watch Database:
```bash
# Run this in loop to see changes
watch -n 2 "sqlite3 taskmanager.db \"SELECT id, substr(title, 1, 40) as title, status, task_type, parent_id FROM tasks WHERE id LIKE 'task_1770936997%' OR parent_id LIKE 'task_1770936997%' ORDER BY created_at ASC\""
```

**Terminal 2** - Watch CTO Logs:
```bash
# Check runner process logs
tail -f /tmp/agent-runner.log

# OR if logs go to stdout
ps aux | grep agent-runner  # Get PID
lsof -p <PID> | grep log    # Find log file location
```

---

### Step 3: Verify Subtasks Created

**After CTO Processing** (within 30-60 seconds):

```bash
# Check all tasks including subtasks
sqlite3 taskmanager.db "
SELECT
  id,
  substr(title, 1, 50) as title,
  status,
  task_type,
  parent_id,
  scheduled_date,
  scheduled_time,
  due_date
FROM tasks
WHERE id LIKE 'task_1770936997%' OR parent_id LIKE 'task_1770936997%'
ORDER BY created_at ASC
"
```

**Expected Output**:
```
task_1770936997|Implement Customer Analytics Dashboard|in-progress|epic||2026-02-15
<subtask_id_1>|Backend API Endpoints|todo|subtask|task_1770936997|2026-02-12|18:00|2026-02-13
<subtask_id_2>|Frontend React Components|todo|subtask|task_1770936997|2026-02-13|10:00|2026-02-14
<subtask_id_3>|WebSocket Real-time Updates|todo|subtask|task_1770936997|2026-02-14|14:00|2026-02-15
```

**Verify**:
- ✅ Parent status changed to `in-progress`
- ✅ Parent task_type changed to `epic`
- ✅ 3 subtasks created
- ✅ All subtasks have `task_type = 'subtask'`
- ✅ All subtasks have `parent_id = 'task_1770936997'`
- ✅ Subtasks scheduled sequentially
- ✅ Subtasks have calculated deadlines

---

### Step 4: Verify UI Behavior

**Open Task Manager UI**: `http://localhost:5173` (or your port)

**Navigate to**: Dashboard → Tasks

**Expected UI State**:

**Epic Task Card**:
```
┌─────────────────────────────────────────────┐
│ 📊 Implement Customer Analytics Dashboard  │
│                                             │
│ Status: In Progress                         │
│ Type: Epic                                  │
│ Priority: High                              │
│ Due: Feb 15, 2026                           │
│                                             │
│ Subtasks: 3/3 created                       │
│ └─ Backend API Endpoints (todo)            │
│ └─ Frontend React Components (todo)        │
│ └─ WebSocket Real-time Updates (todo)      │
└─────────────────────────────────────────────┘
```

**Subtask Cards** (3 separate cards):
```
┌──────────────────────────────────┐
│ 🔧 Backend API Endpoints         │
│ Status: To Do                    │
│ Scheduled: Feb 12, 6:00 PM       │
│ Due: Feb 13                      │
│ Parent: Customer Analytics...    │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 🎨 Frontend React Components     │
│ Status: To Do (BLOCKED)          │
│ Scheduled: Feb 13, 10:00 AM      │
│ Due: Feb 14                      │
│ Parent: Customer Analytics...    │
└──────────────────────────────────┘

┌──────────────────────────────────┐
│ 🔗 WebSocket Real-time Updates   │
│ Status: To Do (BLOCKED)          │
│ Scheduled: Feb 14, 2:00 PM       │
│ Due: Feb 15                      │
│ Parent: Customer Analytics...    │
└──────────────────────────────────┘
```

**Verify UI Elements**:
- ✅ Parent task shows as "Epic" with "In Progress" status
- ✅ Subtasks visible with sequential scheduling
- ✅ Subtasks 2 and 3 show as BLOCKED (previous not done)
- ✅ Clear parent-child relationship visible
- ✅ Deadlines distributed across 3 days

---

### Step 5: Analyze CTO Logs

**CTO Decision Log**:

```bash
# Check CTO state files
cat ~/mycompany/cto/TASK_HISTORY.md
```

**Expected Content**:
```markdown
# CTO Task History

## Recent Decisions

### Task: Implement Customer Analytics Dashboard
- **Decision**: SPLIT
- **Reasoning**: Task requires 3 distinct phases: Backend API development, Frontend UI implementation, and WebSocket integration. Each phase has different technical requirements and can be executed sequentially.
- **Complexity**: Complex (score: 75)
- **Confidence**: 92%
- **Subtasks Created**: 3
- **Strategy**: Sequential execution to ensure proper API foundation before UI and real-time features
- **Timestamp**: 2026-02-12T18:05:23Z
```

**CTO Resource State**:

```bash
cat ~/mycompany/cto/RESOURCE_STATE.md
```

**Expected Content**:
```markdown
# CTO Resource State

## Current Status
- **Claude Usage (5h)**: 15/100 messages
- **Gemini Usage (5h)**: 8/100 messages
- **Last Updated**: 2026-02-12T18:05:23Z

## Recent Activity
- ✅ Task split: "Implement Customer Analytics Dashboard" → 3 subtasks
- Provider used: claude-sonnet-4.5
- Messages consumed: 1 (analysis only, zero execution cost)
```

---

### Step 6: Verify mycompany MD Files

**Organization Overview**:

```bash
cat ~/mycompany/organization/OVERVIEW.md
```

**Should Include**:
- Updated task count
- Epic task listed in active work

**Team Overview**:

```bash
cat ~/mycompany/teams/sale_beeblue/OVERVIEW.md
```

**Should Show**:
- Team's active tasks
- Epic with subtasks

**Project Tasks**:

```bash
cat ~/mycompany/projects/sample_test_sale_beeblue/TASKS.md
```

**Expected Content**:
```markdown
# Project Tasks

## Active Epics

### Implement Customer Analytics Dashboard
- **Status**: In Progress (Epic)
- **Priority**: High
- **Deadline**: 2026-02-15
- **Subtasks**: 3/3 created, 0/3 completed
  1. ⏳ Backend API Endpoints (todo)
  2. 🔒 Frontend React Components (blocked)
  3. 🔒 WebSocket Real-time Updates (blocked)

- **CTO Strategy**: Sequential execution to ensure proper API foundation
- **Team**: sale beeblue
- **Team Lead**: johnyyy
```

---

### Step 7: Verify Sequential Blocking

**Test the Blocker**:

```bash
# Try to fetch tasks for runner (simulating team lead polling)
curl -X GET "http://localhost:3001/api/runner/tasks?token=<runner_token>" | jq '.[] | {id, title, task_type, status}'
```

**Expected**:
- ✅ Only Subtask 1 should be returned
- ✅ Subtasks 2 and 3 are FILTERED OUT (blocked)

**Verify in Database**:
```bash
sqlite3 taskmanager.db "
SELECT
  id,
  substr(title, 1, 40) as title,
  status,
  (SELECT status FROM tasks WHERE id = parent_id) as parent_status
FROM tasks
WHERE parent_id = 'task_1770936997'
ORDER BY created_at
"
```

**Expected**:
```
<sub1_id>|Backend API Endpoints|todo|in-progress
<sub2_id>|Frontend React Components|todo|in-progress
<sub3_id>|WebSocket Real-time Updates|todo|in-progress
```

All are `todo`, but only Sub1 will be returned by the API due to blocking logic.

---

## Performance Metrics

### CTO Performance

| Metric | Expected | Actual |
|--------|----------|--------|
| Analysis Time | < 5 seconds | ___ |
| Subtask Count | 3 | ___ |
| AI Messages Used | 1 (analysis only) | ___ |
| Scheduling Accuracy | Sequential | ___ |
| Deadline Distribution | Across 3 days | ___ |
| MD File Updates | All updated | ___ |
| Blocking Logic | Working | ___ |

### Quality Checks

- ✅ Subtask titles are clear and actionable
- ✅ Subtask descriptions include objectives, inputs, outputs
- ✅ Context file paths are included (focused, not comprehensive)
- ✅ Team members list included
- ✅ Timeline with start/deadline included
- ✅ Parent-child relationship established
- ✅ Sequential dependency enforced

---

## Troubleshooting

### Issue: Task Not Picked Up

**Check**:
```bash
# Is runner running?
ps aux | grep agent-runner

# Is runner connected to project?
sqlite3 taskmanager.db "SELECT runner_token FROM users WHERE email = 'amir94eng@gmail.com'"

# Is task visible to runner?
sqlite3 taskmanager.db "SELECT * FROM tasks WHERE id = 'task_1770936997'"
```

### Issue: Task Not Split

**Check CTO Decision**:
```bash
cat ~/mycompany/cto/TASK_HISTORY.md | grep -A 10 "Customer Analytics"
```

**Possible Reasons**:
- Task complexity score too low (< 45)
- Resource pressure too high (deferred instead)
- AI analysis failed (check error logs)

### Issue: Subtasks Missing

**Check Database**:
```bash
sqlite3 taskmanager.db "SELECT COUNT(*) FROM tasks WHERE parent_id = 'task_1770936997'"
```

**Should Return**: `3`

### Issue: Blocking Not Working

**Test**:
```bash
# Get subtask 2 ID
SUB2=$(sqlite3 taskmanager.db "SELECT id FROM tasks WHERE parent_id = 'task_1770936997' ORDER BY created_at LIMIT 1 OFFSET 1")

# Try to manually set it as assignable
sqlite3 taskmanager.db "SELECT id FROM tasks WHERE id = '$SUB2' AND status = 'todo'"

# It should exist, but API should filter it out
curl "http://localhost:3001/api/runner/tasks?token=<token>" | jq ".[] | select(.id == \"$SUB2\")"

# Should return empty (blocked)
```

---

## Success Criteria

### ✅ Pass Conditions:

1. **Task Split**:
   - ✅ Parent status: `in-progress`
   - ✅ Parent type: `epic`
   - ✅ 3 subtasks created

2. **Subtask Quality**:
   - ✅ Clear, actionable titles
   - ✅ Detailed descriptions with objectives
   - ✅ Sequential scheduling (time gaps)
   - ✅ Distributed deadlines

3. **UI Display**:
   - ✅ Epic card shows subtask count
   - ✅ Subtasks visible as separate cards
   - ✅ Blocked status shown for Sub2, Sub3
   - ✅ Parent-child relationship clear

4. **Blocking Logic**:
   - ✅ Only Sub1 available to runner
   - ✅ Sub2, Sub3 filtered from API response

5. **Record Keeping**:
   - ✅ CTO decision logged in TASK_HISTORY.md
   - ✅ Resource usage tracked in RESOURCE_STATE.md
   - ✅ Team overview updated
   - ✅ Project tasks file updated

### ❌ Fail Conditions:

- Task not picked up after 2 minutes
- Subtasks not created
- Incorrect subtask count (not 3)
- No sequential scheduling
- Blocking logic not working
- MD files not updated

---

## Clean Up After Test

```bash
# Delete test task and subtasks
sqlite3 taskmanager.db "DELETE FROM tasks WHERE id LIKE 'task_1770936997%' OR parent_id LIKE 'task_1770936997%'"

# Verify cleanup
sqlite3 taskmanager.db "SELECT COUNT(*) FROM tasks WHERE id LIKE 'task_1770936997%' OR parent_id LIKE 'task_1770936997%'"

# Should return: 0
```

---

## Quick Test Script

Save as `test_cto_split.sh`:

```bash
#!/bin/bash

echo "🧪 CTO Task Splitting Test"
echo "=========================="
echo ""

# Step 1: Verify task exists
echo "1️⃣ Checking task exists..."
TASK_COUNT=$(sqlite3 taskmanager.db "SELECT COUNT(*) FROM tasks WHERE id = 'task_1770936997'")
if [ "$TASK_COUNT" -eq "1" ]; then
  echo "✅ Task exists"
else
  echo "❌ Task not found"
  exit 1
fi

# Step 2: Wait for CTO processing
echo ""
echo "2️⃣ Waiting for CTO to process (30 seconds)..."
sleep 30

# Step 3: Check for subtasks
echo ""
echo "3️⃣ Checking for subtasks..."
SUBTASK_COUNT=$(sqlite3 taskmanager.db "SELECT COUNT(*) FROM tasks WHERE parent_id = 'task_1770936997'")
echo "Subtasks found: $SUBTASK_COUNT"

if [ "$SUBTASK_COUNT" -eq "3" ]; then
  echo "✅ Correct number of subtasks created"
else
  echo "❌ Expected 3 subtasks, found $SUBTASK_COUNT"
fi

# Step 4: Check parent task type
echo ""
echo "4️⃣ Checking parent task status..."
PARENT_TYPE=$(sqlite3 taskmanager.db "SELECT task_type FROM tasks WHERE id = 'task_1770936997'")
PARENT_STATUS=$(sqlite3 taskmanager.db "SELECT status FROM tasks WHERE id = 'task_1770936997'")

echo "Parent type: $PARENT_TYPE (expected: epic)"
echo "Parent status: $PARENT_STATUS (expected: in-progress)"

# Step 5: Show subtasks
echo ""
echo "5️⃣ Subtask details:"
sqlite3 taskmanager.db "SELECT substr(title, 1, 50), status, scheduled_date, scheduled_time FROM tasks WHERE parent_id = 'task_1770936997' ORDER BY created_at"

# Step 6: Check CTO logs
echo ""
echo "6️⃣ CTO Decision Log:"
if [ -f ~/mycompany/cto/TASK_HISTORY.md ]; then
  cat ~/mycompany/cto/TASK_HISTORY.md | tail -20
else
  echo "⚠️ CTO log file not found"
fi

echo ""
echo "=========================="
echo "Test complete!"
```

Make executable and run:
```bash
chmod +x test_cto_split.sh
./test_cto_split.sh
```

---

**Last Updated**: 2026-02-12
**Status**: Ready to Execute
**Estimated Test Duration**: 2-3 minutes
