# CTO AI Analysis Debugging Session

**Date**: 2026-02-12
**Session Duration**: ~2 hours
**Status**: ⚠️ **PARTIALLY RESOLVED** - CTO active, AI running, stream parsing issue remains

---

## Problem Statement

User wanted to test CTO task splitting performance:
- Create a complex task that should split into 3 subtasks
- CTO should analyze with AI (Claude/Gemini)
- CTO should create subtasks on board with proper scheduling
- No team lead execution needed - just observe CTO behavior

**Initial Issue**: CTO was NOT intercepting tasks at all - they went directly to team lead execution.

---

## Root Causes Discovered

### 1. CTO `enabled` Property Missing ❌

**Problem**: `agent-runner.js` checks `this.cto && this.cto.enabled` but CTOEngine never set the `enabled` property.

**Location**: `agent-runner/cto/CTOEngine.js`

**Fix Applied**:
```javascript
// In constructor (after line 37)
this.enabled = ctoConfig?.enabled !== false; // Default to true

// In updateSettings method (line 102)
if (settings.enabled !== undefined) this.enabled = settings.enabled;
```

**Impact**: CTO now properly intercepts tasks before execution ✅

---

### 2. Syntax Error in AIDecisionEngine.js ❌

**Problem**: Malformed XML tag accidentally inserted in code during file reading.

**Location**: `agent-runner/cto/AIDecisionEngine.js:342`

**Error**:
```javascript
const jsonMatch = output.match(/\{[\s\S]*\}/);< /antml:parameter>
</invoke>
```

**Fix Applied**:
```javascript
const jsonMatch = output.match(/\{[\s\S]*\}/);
```

**Impact**: Agent-runner could start without crashing ✅

---

### 3. Invalid Gemini Model Name ❌

**Problem**: Config used `gemini-3-pro` which doesn't exist in Google's API.

**Error Message**:
```
ModelNotFoundError: Requested entity was not found.
```

**Location**:
- `agent-runner/config.json`
- `task-manager/server/taskmanager.db` settings table

**Fix Applied**:
```json
{
  "ctoProvider": "gemini-3-pro",
  "models": {
    "preferredModels": [
      "gemini-3-pro",
      "claude-sonnet-4.5",
      "claude-opus-4.5",
      "gpt-4o"
    ]
  }
}
```

**Valid Gemini Models**:
- `gemini-3-pro` ✅
- `gemini-3-pro-exp`
- `gemini-3-pro-thinking-exp`
- `gemini-1.5-pro-latest`
- `gemini-1.5-flash`

**Impact**: Gemini can now be invoked without 404 errors ✅

---

### 4. Incorrect CLI Commands ❌

**Problem**: CLI flags were wrong for both Claude and Gemini.

**Location**: `agent-runner/agent-executor.js:301-313`

**Original (Incorrect)**:
```javascript
case 'gemini':
  providerCommand = `gemini --prompt "$(cat ${promptFile})"${modelFlag} --output-format stream-json --yolo`;
  break;
case 'claude':
  providerCommand = `unset ANTHROPIC_API_KEY && claude -p "$(cat ${promptFile})"${modelFlag} --permission-mode bypassPermissions --output-format stream-json --verbose`;
  break;
```

**Fixed (Correct)**:
```javascript
case 'gemini':
  providerCommand = `gemini --yolo -p "$(cat ${promptFile})"${modelFlag} --output-format stream-json`;
  break;
case 'claude':
  providerCommand = `claude -p --dangerously-skip-permissions${modelFlag} "$(cat ${promptFile})" --output-format stream-json`;
  break;
```

**Key Changes**:
- **Gemini**: Use `-p` instead of `--prompt`, move `--yolo` to front
- **Claude**: Use `--dangerously-skip-permissions` instead of `--permission-mode bypassPermissions`, removed `unset ANTHROPIC_API_KEY`

**Correct CLI Syntax**:
```bash
# For Claude CTO
claude -p --dangerously-skip-permissions --model claude-opus-4.5 "your prompt here"

# For Gemini CTO
gemini --yolo -p "your prompt" --model gemini-3-pro
```

**Impact**: CLI commands now execute properly ✅

---

### 5. Missing Model Definitions ❌

**Problem**: `ModelSelector.js` hardcoded model list didn't include newer models.

**Location**: `agent-runner/cto/ModelSelector.js:11-87`

**Models in List**:
- ✅ `gemini-3-pro`
- ❌ `gemini-3-pro-exp` (not in list)
- ✅ `claude-opus-4.5`
- ✅ `claude-sonnet-4.5`

**Resolution**: Used models already in the list (`gemini-3-pro`)

---

### 6. Split Threshold Too High (For Testing)

**Problem**: Fallback complexity score (40) was below split threshold (45), so tasks never split when AI failed.

**Location**:
- `agent-runner/config.json`
- Database settings

**Original**: `splitComplexityScore: 45`
**Testing Value**: `splitComplexityScore: 30`

**SQL Update**:
```sql
UPDATE settings
SET value = json_set(value, '$.splitComplexityScore', 30)
WHERE key = 'cto_config';
```

**Impact**: Fallback logic would trigger split if needed ✅

---

## Current System State

### ✅ Working Components:

1. **CTO Initialization**: `[CTO] Intelligence layer active`
2. **AI Model Available**: `[CTO] AI Decision Models available: gemini-3-pro`
3. **Task Interception**: `[Runner] New task detected` → `[CTO] Loaded 6 employees for context`
4. **AI Invocation**: `[CTO] Using gemini-3-pro for task analysis...`
5. **Gemini Execution**: CLI launches successfully with `--yolo -p` flags
6. **Output Generation**: Gemini produces streaming JSON deltas

### ⚠️ Remaining Issue:

**Stream Output Parsing Incomplete**

**Problem**: Gemini outputs JSON in streaming delta format:
```
{"delta":true,"content":"...approach is necessary.\",\n  \"complexity\": \"complex\"..."}
{"delta":true,"content":"...\"guidelines\": \"Use Node.js with Express.js..."}
{"delta":true,"content":"...\"roles\": [\"Frontend Developer\"]..."}
```

**Current Behavior**:
- `monitorOutputFile()` in `agent-executor.js` reads the stream
- Assembles text from deltas
- But final text output is incomplete/fragmented
- CTO's `_parseAIResponse()` fails to extract JSON
- Falls back to "No AI available for analysis"
- Task executes directly instead of splitting

**Evidence**:
```
[CTO] Decision: assign | Reason: No AI available for analysis. Assigned to Team Lead for execution.
```

**Log Analysis**:
```
=== TEXT OUTPUT ===
YOLO mode is enabled. All tool calls will be automatically approved.
...
02-12T23:18:41.445Z","role":"assistant","content":" approach is necessary.\",\n  \"complexity\": \"complex\"...
02-12T23:18:43.557Z","role":"assistant","content":"/authorization scheme details, caching strategy...
```

Output contains JSON fragments but not assembled into complete parseable JSON.

---

## Code Locations Reference

### Files Modified:

1. **`agent-runner/cto/CTOEngine.js`**
   - Line 38: Added `this.enabled` property
   - Line 102: Added enabled flag to `updateSettings()`

2. **`agent-runner/cto/AIDecisionEngine.js`**
   - Line 342: Removed malformed XML tag

3. **`agent-runner/agent-executor.js`**
   - Lines 301-313: Fixed CLI commands for Claude and Gemini

4. **`agent-runner/config.json`**
   - Line 30: Changed `ctoProvider` to `gemini-3-pro`
   - Lines 32-37: Updated preferred models list
   - Line 46: Changed `splitComplexityScore` from 45 to 30

5. **Database**: `task-manager/server/taskmanager.db`
   - Updated `settings` table `cto_config` value

### Key Methods to Review:

**`agent-executor.js`**:
- `executeTask()` (line 276): Builds and executes CLI commands
- `monitorOutputFile()` (line 339): Parses streaming JSON output ⚠️ **NEEDS FIX**

**`AIDecisionEngine.js`**:
- `analyzeTask()` (line 92): Calls AI for task analysis
- `_parseAIResponse()` (line 339): Extracts JSON from AI output

**`CTOEngine.js`**:
- `evaluate()` (line 188): Main decision-making entry point
- `splitTask()` (line 299): Creates subtasks from AI analysis

---

## Test Setup

### Test Task Created:

```sql
INSERT INTO tasks (
  id, title, description, status, priority, due_date,
  project_id, team_id, assignee_id, created_by, created_at
) VALUES (
  'task_cto_split_test',
  'Build Customer Analytics Dashboard System',
  'Create a comprehensive analytics dashboard for tracking Beeblue customer metrics. This is a COMPLEX multi-phase system:

PHASE 1 - BACKEND API: Build RESTful API endpoints with advanced filtering, aggregation, real-time processing. Must handle 10,000+ concurrent users. Include auth, rate limiting, caching.

PHASE 2 - FRONTEND DASHBOARD: React-based dashboard with interactive charts using D3.js/Chart.js. Responsive design for mobile/tablet. State management and lazy loading.

PHASE 3 - REAL-TIME SYSTEM: WebSocket connections for live updates, push notifications, collaborative features. Redis integration for caching and pub/sub messaging.

Requirements: CSV/PDF/Excel export, role-based access control, error handling, automated tests, CI/CD pipeline, full documentation.',
  'todo',
  'high',
  '2026-02-18',
  'zv485yba8',
  'q6toaxyp4',
  'rvhqgo9zj',
  (SELECT id FROM users WHERE email = 'amir94eng@gmail.com'),
  datetime('now')
);
```

### Monitoring Commands:

```bash
# Watch runner logs
tail -f /tmp/agent-runner-final-test.log

# Check CTO decision
cat ~/mycompany/cto/TASK_HISTORY.md

# Check task status
sqlite3 task-manager/server/taskmanager.db "
  SELECT id, title, status, task_type, parent_id
  FROM tasks
  WHERE id LIKE 'task_cto%' OR parent_id LIKE 'task_cto%'
  ORDER BY created_at
"

# Check subtasks count
sqlite3 task-manager/server/taskmanager.db "
  SELECT COUNT(*) FROM tasks WHERE parent_id = 'task_cto_split_test'
"
```

---

## Next Steps to Complete Fix

### Option 1: Fix Stream Parsing (Recommended)

**Goal**: Properly assemble Gemini's streaming deltas into complete JSON.

**File**: `agent-runner/agent-executor.js`

**Method**: `monitorOutputFile()` starting at line 339

**Current Logic**:
```javascript
for (const line of lines) {
  const event = JSON.parse(line);
  if (event.type === 'assistant' && event.message?.content) {
    for (const block of event.message.content) {
      if (block.type === 'text') textOutput += block.text;
    }
  }
}
```

**Issue**: Gemini stream format is different - it uses `delta:true` and `content` field directly.

**Proposed Fix**:
```javascript
for (const line of lines) {
  try {
    const event = JSON.parse(line);

    // Handle Claude format
    if (event.type === 'assistant' && event.message?.content) {
      for (const block of event.message.content) {
        if (block.type === 'text') textOutput += block.text;
      }
    }

    // Handle Gemini delta format
    if (event.delta && event.content) {
      textOutput += event.content;
    }

    // Handle Gemini role-based format
    if (event.role === 'assistant' && event.content) {
      textOutput += event.content;
    }
  } catch (e) {
    if (line.trim()) textOutput += line + '\n';
  }
}
```

### Option 2: Use Non-Streaming Mode for CTO

**Alternative**: Modify CTO analysis calls to use non-streaming output.

**Change CLI command**:
```javascript
// Instead of --output-format stream-json
gemini --yolo -p "prompt" --model gemini-3-pro --output-format json
```

**Pros**: Simpler parsing
**Cons**: No real-time progress visibility

---

## Verification Checklist

After implementing the fix, verify:

- [ ] CTO intercepts task: `[CTO] Loaded 6 employees for context`
- [ ] AI analysis runs: `[CTO] Using gemini-3-pro for task analysis...`
- [ ] Gemini completes: Check log file has complete JSON
- [ ] CTO parses output: `[CTO] AI Decision: split (confidence: 95%)`
- [ ] CTO decision logged: `[CTO] Decision: split | Reason: Task requires 3 distinct phases...`
- [ ] Subtasks created: `[CTO] Splitting task "..." into subtasks...`
- [ ] Parent marked epic: `status='in-progress', task_type='epic'`
- [ ] 3 subtasks in DB: `SELECT COUNT(*) FROM tasks WHERE parent_id='task_cto_split_test'` returns 3
- [ ] Subtasks sequential: Each has scheduled_date/time and blocks next
- [ ] Task history updated: `~/mycompany/cto/TASK_HISTORY.md` shows decision
- [ ] Resource state updated: `~/mycompany/cto/RESOURCE_STATE.md` shows usage

---

## Key Learnings

### 1. CTO Requires Explicit `enabled` Flag

The `this.cto` object existing is not enough - it must have `enabled: true` property.

### 2. Model Names Must Match Exactly

Hardcoded model lists in `ModelSelector.js` must include any model referenced in config.

### 3. CLI Syntax is Provider-Specific

Each provider (Claude, Gemini, Codex) has different flag ordering and naming:
- Claude: `-p --dangerously-skip-permissions --model <model> "prompt"`
- Gemini: `--yolo -p "prompt" --model <model>`

### 4. Stream Format Varies by Provider

Gemini's stream-json format uses `delta:true` + `content` fields, while Claude uses `type:'assistant'` + `message.content[]` arrays.

### 5. Fallback Logic Exists

When AI analysis fails, CTO falls back to simple assignment with complexity score of 40.

---

## Useful Resources

### CTO Architecture Documentation

- **Overview**: `docs/implementation/CTO_REVIEW_AND_APPROVAL_WORKFLOW.md`
- **Attachment Intelligence**: `docs/implementation/CTO_ATTACHMENT_INTELLIGENCE.md`
- **Testing Guide**: `docs/testing/CTO_TASK_SPLITTING_TEST.md`

### Key Configuration Files

- **Agent Runner Config**: `agent-runner/config.json`
- **Database Settings**: `task-manager/server/taskmanager.db` → `settings` table
- **CTO State**: `~/mycompany/cto/` directory

### Logs Locations

- **Runner Logs**: `/tmp/agent-runner-*.log`
- **CLI Execution Logs**: `agent-runner/logs/task-*.log`
- **CLI Output Streams**: `agent-runner/logs/gemini-task-*.jsonl`

---

## Session Timeline

1. **Initial test failed**: Task went directly to execution, no CTO interception
2. **Discovered**: `this.cto.enabled` was undefined
3. **Fixed**: Added enabled property to CTOEngine
4. **Discovered**: Syntax error in AIDecisionEngine.js (XML tag)
5. **Fixed**: Removed malformed code
6. **Discovered**: `gemini-3-pro` model doesn't exist
7. **Fixed**: Changed to `gemini-3-pro`
8. **Discovered**: CLI commands had wrong flags
9. **Fixed**: Updated to correct Claude/Gemini syntax
10. **Verified**: CTO now intercepts tasks and invokes AI ✅
11. **Discovered**: Gemini stream output not being parsed correctly ⚠️
12. **Status**: CTO active, AI running, awaiting stream parsing fix

---

**Last Updated**: 2026-02-12
**Next Action**: Implement Gemini stream delta parsing in `monitorOutputFile()`
**Expected Outcome**: CTO successfully splits complex tasks into 3 subtasks with proper scheduling
