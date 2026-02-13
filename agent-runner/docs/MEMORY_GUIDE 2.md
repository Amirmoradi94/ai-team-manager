# CTO Memory System - Strategic Task History

## Overview

The CTO now has **strategic memory** that remembers overall task outcomes without storing technical details. This allows the CTO to learn from experience and make better decisions over time.

## What CTO Remembers

### ✅ High-Level Strategic Data
- **Task outcomes**: Success or failure (not code details)
- **Provider performance**: Which providers work best for which task types
- **Success patterns**: Success rates by task type
- **Epic completion rates**: How well epic tasks are being split and completed
- **Failure reasons**: High-level reasons (not technical debugging info)

### ❌ What CTO Does NOT Remember
- Code-level implementation details (that's for team leads)
- Technical debugging information
- Specific file changes or commits
- API endpoints or database queries
- Individual lines of code

## Memory Storage

### Files Created
1. **`TASK_HISTORY.md`** - Human-readable task history (last 100 tasks)
2. **`STRATEGIC_SUMMARY.json`** - Fast-access summary statistics

### Location
```
agent-runner/team_lead/product_manager/
├── RESOURCE_STATE.md      # Resource usage (existing)
├── DECISION_LOG.md        # Decision audit (existing)
├── TASK_HISTORY.md        # Task outcomes (NEW)
└── STRATEGIC_SUMMARY.json # Summary stats (NEW)
```

## Data Structure

### Task History Entry
```javascript
{
  taskId: "task-123",
  title: "Implement user authentication",
  type: "task",              // task | epic | subtask
  provider: "claude",
  outcome: "success",        // success | failed
  reason: "Completed successfully", // High-level only
  timestamp: "2026-02-10T..."
}
```

### Strategic Summary
```json
{
  "totalTasks": 47,
  "successRate": 85.1,
  "providerPerformance": {
    "claude": {
      "total": 25,
      "success": 22,
      "avgRetries": 0.32
    },
    "gemini": {
      "total": 15,
      "success": 14,
      "avgRetries": 0.2
    },
    "codex": {
      "total": 7,
      "success": 6,
      "avgRetries": 0.14
    }
  },
  "taskTypePatterns": {
    "coding": {
      "total": 20,
      "success": 18,
      "successRate": 90,
      "bestProvider": "claude",
      "avgRetries": 0.25
    },
    "research": {
      "total": 10,
      "success": 9,
      "successRate": 90,
      "bestProvider": "gemini",
      "avgRetries": 0.1
    }
  },
  "epicCompletionRate": 100,
  "lastUpdated": "2026-02-10T..."
}
```

## How It Works

### 1. Task Evaluation (Before Execution)
```javascript
// CTO checks historical data
const decision = await cto.evaluate(task, payload);

// If history shows "gemini" works best for research tasks:
// decision = {
//   provider: "gemini",
//   reason: "Historical data: 90% success rate for research tasks (learned from history)"
// }
```

### 2. Task Execution (By Agent)
```javascript
// Agent executes the task
const result = await executor.execute(task, decision.provider);
```

### 3. Outcome Recording (After Execution)
```javascript
// Record what happened (high-level only)
await cto.recordTaskOutcome({
  taskId: task.id,
  title: task.title,
  taskType: task.task_type || 'task',
  provider: decision.provider,
  success: result.success,
  reason: result.success ? 'Completed successfully' : 'Task failed', // High-level only!
  retries: attemptNumber,
  complexity: decision.complexity?.level
});

// State is persisted automatically
```

## Integration with agent-runner.js

### Current Integration Points

The CTOEngine is already initialized in `agent-runner.js`:
```javascript
this.cto = config.cto?.enabled
  ? new CTOEngine(this.taskAPI, config.cto, path.join(__dirname, 'team_lead'))
  : null;
```

### Required Changes to `pollForTasks()`

Add outcome recording after task execution:

```javascript
// In pollForTasks() after task execution completes:

// BEFORE (current code):
if (verification.passed) {
  await this.taskAPI.updateTask(task.id, {
    status: 'for-review',
    execution_completed_at: new Date().toISOString()
  });
}

// AFTER (add recording):
if (verification.passed) {
  await this.taskAPI.updateTask(task.id, {
    status: 'for-review',
    execution_completed_at: new Date().toISOString()
  });

  // 🆕 Record successful outcome
  await this.cto.recordTaskOutcome({
    taskId: task.id,
    title: task.title,
    taskType: task.task_type || 'task',
    provider: decision.provider,
    success: true,
    reason: 'Completed successfully',
    retries: retryCount,
    complexity: decision.complexity?.level
  });
} else {
  // 🆕 Record failure
  await this.cto.recordTaskOutcome({
    taskId: task.id,
    title: task.title,
    taskType: task.task_type || 'task',
    provider: decision.provider,
    success: false,
    reason: verification.missing || 'Task failed',
    retries: retryCount,
    complexity: decision.complexity?.level
  });
}
```

## Strategic Insights API

### Get Insights
```javascript
const insights = cto.getHistoricalInsights();

console.log(insights);
// Output:
// {
//   bestProvider: 'claude',
//   providerRankings: [
//     { provider: 'gemini', successRate: 93.3, totalTasks: 15 },
//     { provider: 'claude', successRate: 88.0, totalTasks: 25 },
//     { provider: 'codex', successRate: 85.7, totalTasks: 7 }
//   ],
//   successRate: 89.4,
//   epicSuccess: 100,
//   recentFailures: [
//     { title: 'Complex refactoring', provider: 'codex', reason: 'High complexity' }
//   ],
//   commonFailureReasons: [
//     { reason: 'Task timeout', count: 2 },
//     { reason: 'High complexity', count: 1 }
//   ]
// }
```

### Get Task Type Context
```javascript
const context = cto.taskHistory.getTaskTypeContext('coding');

console.log(context);
// Output:
// {
//   known: true,
//   successRate: 90,
//   recommendedProvider: 'claude',
//   avgRetries: 0.25,
//   sampleSize: 20
// }
```

### Provider Recommendation (Used Automatically)
```javascript
// CTO uses this internally during evaluation
const rec = cto.taskHistory.recommendProvider('research', ['claude', 'gemini', 'codex']);

console.log(rec);
// Output:
// {
//   provider: 'gemini',
//   reason: 'Historical data: 90% success rate for research tasks',
//   confidence: 75
// }
```

## Learning Behavior

### Thresholds for Learning
- **Minimum samples**: 5 tasks of same type before learning kicks in
- **Confidence threshold**: 75% confidence required to override default selection
- **Provider switching**: Will stick with learned provider until success rate drops

### Example Learning Curve

**After 0 tasks:**
```
CTO uses default provider matrix (no history)
```

**After 5 coding tasks (4 succeeded with Claude, 1 failed with Codex):**
```
CTO learns: "Claude is 80% successful for coding tasks"
Still uses default matrix (not enough confidence)
```

**After 10 coding tasks (9 succeeded with Claude):**
```
CTO learns: "Claude is 90% successful for coding tasks"
Confidence: 70 (sample size 10)
Now recommends Claude for coding tasks with learned preference
```

**After 20 coding tasks (18 succeeded with Claude):**
```
CTO learns: "Claude is 90% successful for coding tasks"
Confidence: 80 (sample size 20)
Strongly recommends Claude, overriding CEO preference if needed
```

## High-Level Reason Extraction

The CTO automatically extracts high-level reasons from technical details:

### Success Cases
- Any success → "Completed successfully"
- Epic split → "Split into N subtasks"

### Failure Cases
Technical details are abstracted:
- `"Error: Connection timeout to database..."` → **"Task timeout"**
- `"Rate limit exceeded: 429 response..."` → **"Rate limit hit"**
- `"Incomplete implementation, missing tests..."` → **"Incomplete output"**
- `"TypeError: Cannot read property 'x'..."` → **"Execution error"**
- `"Task too complex, requires splitting..."` → **"High complexity"**

**Team leads** see the technical details. **CTO** only sees high-level patterns.

## Benefits

### 1. **Provider Learning**
CTO learns which providers work best for which task types over time.

### 2. **Reduced Trial-and-Error**
Avoids repeating failed provider choices for similar tasks.

### 3. **Improved Success Rates**
Historical data guides better decisions, leading to fewer failures.

### 4. **Pattern Recognition**
Identifies recurring failure reasons and can adjust strategy.

### 5. **Strategic Visibility**
CEO/user can see high-level trends without drowning in technical details.

## Memory Limits

To keep memory manageable:
- **Task history**: Last 100 tasks in memory
- **Full history**: Stored in markdown file (append-only, but human-readable)
- **Summary stats**: Aggregated, not individual task details
- **Auto-pruning**: No automatic pruning (human-readable file for debugging)

## Example TASK_HISTORY.md

```markdown
# Task History - Strategic Overview

> Last updated: 2026-02-10T15:30:00.000Z

## Summary Statistics

- **Total Tasks**: 47
- **Success Rate**: 89%
- **Epic Completion**: 100%

## Provider Performance

| Provider | Success Rate | Total Tasks | Avg Retries |
|----------|--------------|-------------|-------------|
| gemini   | 93%          | 15          | 0.2         |
| claude   | 88%          | 25          | 0.3         |
| codex    | 86%          | 7           | 0.1         |

## Recent Task History (Last 100)

| taskId  | title                     | type | provider | outcome | reason               | timestamp           |
|---------|---------------------------|------|----------|---------|----------------------|---------------------|
| task-45 | Implement user auth       | task | claude   | success | Completed successful | 2026-02-10T15:25:00 |
| task-44 | Research GraphQL best...  | task | gemini   | success | Completed successful | 2026-02-10T15:20:00 |
| task-43 | Fix login bug             | task | claude   | success | Completed successful | 2026-02-10T15:15:00 |
| task-42 | Complete system rewrite   | epic | cto      | success | Split into 5 subtasks| 2026-02-10T15:10:00 |
```

## Testing the Memory System

### Manual Test
```bash
# 1. Start agent-runner
node agent-runner.js

# 2. Create several tasks and execute them

# 3. Check the history
cat team_lead/product_manager/TASK_HISTORY.md

# 4. Check summary stats
cat team_lead/product_manager/STRATEGIC_SUMMARY.json

# 5. Watch CTO learn
tail -f logs/agent-runner.log | grep "learned from history"
```

### Verify Learning
After ~10 tasks of the same type, you should see:
```
[CTO] Selected gemini: Historical data: 90% success rate for research tasks (learned from history)
```

---

## Summary

**The CTO now has strategic memory that:**
✅ Learns provider effectiveness from actual outcomes
✅ Stores high-level results, not technical details
✅ Uses history to make better decisions
✅ Improves success rates over time
✅ Provides strategic visibility

**Without:**
❌ Storing code-level implementation details
❌ Overwhelming users with technical information
❌ Interfering with team lead responsibilities
❌ Creating massive memory files

**This is exactly what a real CTO does**: Track outcomes, learn patterns, make strategic decisions based on past experience!
