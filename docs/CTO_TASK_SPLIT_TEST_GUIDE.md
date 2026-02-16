# 🧪 CTO Task Split Feature - Test Guide

## ✅ What Was Fixed

Based on the troubleshooting session, we fixed:

1. **Gemini Stream Parsing** - Added support for Gemini's `{"delta":true,"content":"..."}` format in `agent-executor.js:370-381`
2. **CLI Commands** - Using correct syntax:
   - Claude: `claude -p --dangerously-skip-permissions --model <model> "prompt"`
   - Gemini: `gemini --yolo -p "prompt" --model <model>`
3. **CTO Configuration** - Enabled with `gemini-3-pro`, split threshold: 30

---

## 🎯 Test Objective

**Goal**: Verify CTO can analyze a complex task in BACKLOG and split it into subtasks that appear in TODO list.

**Expected Behavior**:
1. ✅ Task created in **BACKLOG** status
2. ✅ CTO intercepts task (not sent to team lead immediately)
3. ✅ CTO calls Gemini AI for analysis
4. ✅ Gemini returns JSON decision with complexity > 30
5. ✅ CTO decides to **SPLIT** the task
6. ✅ Parent task becomes an **EPIC** (status: `in-progress`, task_type: `epic`)
7. ✅ **3 subtasks created** in **TODO** status (task_type: `subtask`, parent_id: <epic_id>)
8. ✅ Subtasks have sequential scheduling
9. ✅ Decision logged in `~/mycompany/cto/TASK_HISTORY.md`

---

## 📝 Test Execution Steps

### Step 1: Start the Task Manager Backend

```bash
cd /Users/amirmoradi94/Desktop/Projects/ai-team-manager/task-manager
npm run dev
```

Keep this terminal open.

---

### Step 2: Start the Agent Runner with Logging

Open a **new terminal**:

```bash
cd /Users/amirmoradi94/Desktop/Projects/ai-team-manager/agent-runner

# Start runner with timestamped log file
LOG_FILE="/tmp/cto-test-$(date +%Y%m%d-%H%M%S).log"
echo "Starting runner, logs at: $LOG_FILE"
node agent-executor.js > "$LOG_FILE" 2>&1 &

# Save the PID
RUNNER_PID=$!
echo "Runner PID: $RUNNER_PID"

# Watch logs in real-time
tail -f "$LOG_FILE"
```

**Expected Output**:
```
[CTO] Intelligence layer active
[CTO] AI Decision Models available: gemini-3-pro
[Runner] Polling for tasks every 30 minutes...
```

---

### Step 3: Create Test Task in BACKLOG

Open a **third terminal**:

```bash
cd /Users/amirmoradi94/Desktop/Projects/ai-team-manager

# Create the test task
sqlite3 task-manager/server/taskmanager.db < test-cto-split.sql
```

**Expected Output**:
```
=== TASK CREATED ===
id                    title                                    status   task_type
--------------------  ---------------------------------------  -------  ----------
cto_test_1234567890   🧪 Build Real-Time E-Commerce Analytics Platform   backlog  task
```

---

### Step 4: Trigger CTO Analysis

The runner polls every 30 minutes by default. To test immediately, you have two options:

**Option A: Wait for scheduled poll** (up to 30 minutes)

**Option B: Manually change task to 'todo' to trigger immediate processing**

```bash
# Change task status to 'todo' which triggers immediate pickup
sqlite3 task-manager/server/taskmanager.db << 'EOF'
UPDATE tasks
SET status = 'todo'
WHERE id LIKE 'cto_test_%'
AND status = 'backlog';

SELECT 'Task moved to TODO:';
SELECT id, status FROM tasks WHERE id LIKE 'cto_test_%';
EOF
```

---

### Step 5: Monitor CTO Processing

In the terminal watching logs (Step 2), you should see:

```
[Runner] New task detected: cto_test_1234567890
[CTO] Evaluating task: 🧪 Build Real-Time E-Commerce Analytics Platform
[CTO] Loaded 6 employees for context
[CTO] Using gemini-3-pro for task analysis...
[CTO] AI command: gemini --yolo -p "..." --model gemini-3-pro
```

Then Gemini will analyze (may take 10-30 seconds):

```
[CTO] AI analysis complete
[CTO] AI Decision: split (confidence: 95%)
[CTO] Decision: split | Reason: Task requires 3 distinct phases with specialized skills
[CTO] Splitting task "🧪 Build Real-Time..." into subtasks...
[CTO] Created 3 subtasks
[CTO] Marked parent task as epic
```

---

### Step 6: Verify Results

Run the monitoring script:

```bash
cd /Users/amirmoradi94/Desktop/Projects/ai-team-manager
bash monitor-cto-test.sh
```

**Expected Output**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔍 CTO TASK SPLIT TEST - MONITORING DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 RUNNER STATUS:
  ✅ Agent Runner is RUNNING
  📍 PID: 12345

🤖 CTO CONFIGURATION:
  Enabled: 1
  Provider: gemini-3-pro
  Use AI: 1
  Split Threshold: 30

📝 TEST TASK STATUS:
id                    title                                    status        task_type  parent_id
--------------------  ---------------------------------------  ------------  ---------  --------------------
cto_test_1234567890   🧪 Build Real-Time E-Commerce Analytics Platform   in-progress   epic
cto_test_1234567890_1 Phase 1: Data Pipeline & API            todo          subtask    cto_test_1234567890
cto_test_1234567890_2 Phase 2: Frontend Dashboard             todo          subtask    cto_test_1234567890
cto_test_1234567890_3 Phase 3: Advanced Features              todo          subtask    cto_test_1234567890

  📊 Subtasks created: 3
```

---

### Step 7: Verify in Task Manager UI

1. Open browser: http://localhost:5173 (or wherever task-manager frontend runs)
2. Navigate to **Projects** or **Tasks** view
3. You should see:
   - **Epic task** (with 🔵 epic badge): "Build Real-Time E-Commerce Analytics Platform" (status: in-progress)
   - **3 subtasks** in TODO list:
     - Phase 1: Data Pipeline & API
     - Phase 2: Frontend Dashboard
     - Phase 3: Advanced Features

---

## 🔍 Verification Checklist

- [ ] **CTO Intercepted Task**: Log shows `[CTO] Evaluating task`
- [ ] **AI Analysis Ran**: Log shows `[CTO] Using gemini-3-pro`
- [ ] **Gemini Responded**: Stream parsing captured JSON output
- [ ] **Split Decision Made**: Log shows `[CTO] Decision: split`
- [ ] **Parent Became Epic**: Task type changed to `epic`, status: `in-progress`
- [ ] **3 Subtasks Created**: Database shows 3 subtasks with correct parent_id
- [ ] **Subtasks in TODO**: All subtasks have status = `todo`
- [ ] **Sequential Scheduling**: Each subtask has scheduled_date/time
- [ ] **History Logged**: `~/mycompany/cto/TASK_HISTORY.md` contains decision
- [ ] **UI Shows Correctly**: Epic and subtasks visible in frontend

---

## 🐛 Troubleshooting

### Issue: CTO Not Intercepting Task

**Symptom**: Task goes directly to execution, no `[CTO] Evaluating` log

**Check**:
```bash
sqlite3 task-manager/server/taskmanager.db "SELECT json_extract(value, '$.enabled') FROM settings WHERE key='cto_config'"
```

**Fix**: Should return `1`. If not:
```bash
sqlite3 task-manager/server/taskmanager.db "UPDATE settings SET value = json_set(value, '$.enabled', 1) WHERE key='cto_config'"
```

Then restart runner.

---

### Issue: "No AI available for analysis"

**Symptom**: Log shows `[CTO] Decision: assign | Reason: No AI available`

**Possible Causes**:
1. **Gemini API key not set**: Check `~/.config/gemini/config.json`
2. **Stream parsing failed**: Check log for Gemini errors
3. **JSON extraction failed**: Gemini output not properly formatted

**Debug**:
```bash
# Check if Gemini CLI works
gemini --yolo -p "Say hello" --model gemini-3-pro

# Check last Gemini output file
ls -lt agent-runner/logs/gemini-*.jsonl | head -1
cat <that-file>
```

---

### Issue: Task Not Splitting Despite High Complexity

**Symptom**: AI returns complexity > 30 but CTO assigns instead of splitting

**Check split threshold**:
```bash
sqlite3 task-manager/server/taskmanager.db "SELECT json_extract(value, '$.splitComplexityScore') FROM settings WHERE key='cto_config'"
```

**Lower threshold for testing**:
```bash
sqlite3 task-manager/server/taskmanager.db "UPDATE settings SET value = json_set(value, '$.splitComplexityScore', 20) WHERE key='cto_config'"
```

Restart runner.

---

### Issue: Subtasks Not Showing in UI

**Symptom**: Database has subtasks but frontend doesn't show them

**Check**:
1. Frontend query might filter by status
2. Parent task needs to be marked as `epic`
3. Clear browser cache and refresh

**Verify in DB**:
```bash
sqlite3 task-manager/server/taskmanager.db << 'EOF'
SELECT id, title, status, task_type, parent_id
FROM tasks
WHERE parent_id LIKE 'cto_test_%'
OR id LIKE 'cto_test_%';
EOF
```

---

## 📊 Success Criteria

✅ **PASS** if:
- CTO intercepted task from backlog
- AI analysis completed successfully
- Split decision made based on complexity > 30
- Parent task converted to epic
- 3 subtasks created in todo status
- All events logged correctly

❌ **FAIL** if:
- Task went directly to execution without CTO evaluation
- AI analysis failed or returned "no AI available"
- Task was assigned instead of split despite high complexity
- Subtasks not created or created incorrectly

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `agent-runner/agent-executor.js:370-381` | Gemini stream parsing (FIXED) |
| `agent-runner/cto/CTOEngine.js` | Main CTO decision logic |
| `agent-runner/cto/AIDecisionEngine.js` | AI analysis interface |
| `agent-runner/config.json` | CTO configuration |
| `~/mycompany/cto/TASK_HISTORY.md` | Decision log |
| `~/mycompany/cto/RESOURCE_STATE.md` | Resource usage tracking |

---

## 🎓 Understanding the Flow

```
1. Task created in BACKLOG
   ↓
2. Runner polls and detects task
   ↓
3. CTOEngine.evaluate() called
   ↓
4. Checks if task needs AI analysis (useAIForDecisions=true)
   ↓
5. AIDecisionEngine.analyzeTask() calls Gemini
   ↓
6. Gemini streams JSON response with complexity score
   ↓
7. Stream parser assembles complete JSON
   ↓
8. CTOEngine parses decision:
   - If complexity < 30 → ASSIGN
   - If complexity >= 30 → SPLIT
   ↓
9. If SPLIT:
   - CTOEngine.splitTask() creates subtasks
   - Parent task → epic
   - Subtasks → todo
   ↓
10. Decision logged to TASK_HISTORY.md
```

---

## 📞 Quick Reference

**Start Everything**:
```bash
# Terminal 1: Backend
cd task-manager && npm run dev

# Terminal 2: Runner
cd agent-runner && node agent-executor.js > /tmp/cto-test.log 2>&1 &

# Terminal 3: Monitor
tail -f /tmp/cto-test.log
```

**Create Test Task**:
```bash
sqlite3 task-manager/server/taskmanager.db < test-cto-split.sql
```

**Check Status**:
```bash
bash monitor-cto-test.sh
```

**Clean Up Test**:
```bash
sqlite3 task-manager/server/taskmanager.db "DELETE FROM tasks WHERE id LIKE 'cto_test_%'"
```

---

**Last Updated**: 2026-02-13
**Status**: Ready for testing ✅
**Expected Duration**: 2-5 minutes per test
