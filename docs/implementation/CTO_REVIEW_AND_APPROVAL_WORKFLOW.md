# CTO Review & Approval Workflow

**Date**: 2026-02-12
**Status**: ✅ **FULLY IMPLEMENTED**

---

## Overview

The CTO Intelligence Layer features a **complete review and approval workflow** that ensures:
1. ✅ Team lead outputs are verified against expected outcomes
2. ✅ Failed tasks are returned with detailed feedback
3. ✅ Sequential subtasks are blocked until previous ones are approved
4. ✅ Quality gates prevent cascading failures

---

## Complete Workflow

### 1. Task Execution by Team Lead

```
Team Lead (Claude/Gemini) → Executes Task → Produces Output
```

**What Happens**:
- Team lead receives task with clear objectives and expected outputs
- Executes the task using appropriate tools and context
- Generates completion report with deliverables

---

### 2. CTO Notification ✅

```
Task Status: in-progress → for-review
```

**Trigger**: When team lead finishes execution

**Code** (`agent-runner.js:326-335`):
```javascript
await this.taskAPI.markTaskForReviewWithMetadata(task.id, {
  execution_time: result.duration,
  tokens_used: result.tokens_used,
  files_modified: result.toolsUsed?.length || 0,
  model_used: decision.provider,
  execution_started_at: startTime,
  execution_completed_at: new Date().toISOString(),
  completion_report: completionReport
});

console.log(`[CTO] Task ${task.id} completed. Marked for review.`);
```

**Result**: Task appears in CTO's review queue

---

### 3. CTO Watcher Picks Up Task 🔍

```
CTO Watcher → Polls for-review tasks → Triggers Review
```

**Polling Logic** (`agent-runner.js:427-437`):
```javascript
const tasks = await this.taskAPI.getTasksByStatus(project.id, 'for-review');

for (const task of tasks) {
  // Only review subtasks or delegated tasks
  if (task.task_type !== 'subtask' && !task.parent_id) continue;

  console.log(`[CTO] Watcher: Reviewing task "${task.title}"...`);
  const payload = await this.taskAPI.getRunnerPayload(task.id);
  await this.cto.reviewTask(task, payload);
}
```

**Frequency**: Every polling cycle (typically every 10-30 seconds)

---

### 4. CTO Review Process 🧠

**Method**: `CTOEngine.reviewTask(task, payload)`

**Location**: `agent-runner/cto/CTOEngine.js:920-966`

#### Step 4.1: Extract Output
```javascript
const output = task.completion_report || '';

if (!output) {
  console.log(`[CTO] No completion report. Skipping.`);
  return;
}
```

#### Step 4.2: AI Verification
```javascript
const verification = await this.aiEngine.verifyCompletion(task, {
  output,
  success: true
});
```

**AI Analysis**:
- Compares output against task description
- Checks if expected deliverables are present
- Identifies missing requirements
- Assigns quality score (0-100)

**Verification Result**:
```json
{
  "passed": true/false,
  "score": 85,
  "missing": "List of missing requirements",
  "strengths": ["Well documented", "Tests included"],
  "concerns": ["Missing error handling"]
}
```

#### Step 4.3A: ✅ PASSED (Score >= 80)

```javascript
if (verification.passed && verification.score >= 80) {
  console.log(`[CTO] Task PASSED review (Score: ${verification.score})`);

  // Add positive comment
  await this.taskAPI.addComment(task.id,
    `**✅ CTO Review Passed (${verification.score}/100)**\n\n` +
    `${verification.strengths?.join('\n') || 'Output meets all criteria.'}`
  );

  // Mark as DONE
  await this.taskAPI.updateTask(task.id, {
    status: 'done'
  });
}
```

**Result**:
- ✅ Task moved to "Done" column
- ✅ Positive feedback comment added
- ✅ Next subtask (if any) can now start

#### Step 4.3B: ❌ FAILED (Score < 80)

```javascript
else {
  console.log(`[CTO] Task FAILED review (Score: ${verification.score})`);

  const feedback = `
**❌ CTO Review Failed (${verification.score}/100)**

**Feedback:**
${verification.missing}

**Concerns:**
${verification.concerns?.map(c => `- ${c}`).join('\n') || 'Requirements not fully met.'}

**Directive:**
Please address the issues above and resubmit for review.
  `.trim();

  // Add detailed feedback
  await this.taskAPI.addComment(task.id, feedback);

  // Move back to TODO
  await this.taskAPI.updateTask(task.id, {
    status: 'todo'
  });
}
```

**Result**:
- ❌ Task moved back to "To Do" column
- ❌ Detailed feedback comment added
- ❌ Team lead will pick it up and retry
- ❌ Next subtask remains blocked

---

### 5. Sequential Dependency Blocking 🚫

**The Rule**: Subtask N cannot start until Subtask N-1 is **approved** (status = `done`)

**Implementation**: `task-manager/server/index.js:1926-1976`

#### How It Works:

When runner polls for tasks, the backend filters out blocked subtasks:

```javascript
// ========== SEQUENTIAL DEPENDENCY BLOCKING ==========
const filteredTasks = [];

for (const task of tasks) {
  // Regular tasks: Always allowed
  if (!task.parent_id || task.task_type !== 'subtask') {
    filteredTasks.push(task);
    continue;
  }

  // Subtasks: Check previous sibling status
  const allSiblings = await all(`
    SELECT id, status, created_at
    FROM tasks
    WHERE parent_id = ?
    AND task_type = 'subtask'
    ORDER BY created_at ASC
  `, [task.parent_id]);

  // Find this subtask's position
  const taskIndex = allSiblings.findIndex(s => s.id === task.id);

  if (taskIndex === 0) {
    // First subtask - always allowed
    filteredTasks.push(task);
  } else {
    // Check previous subtask status
    const previousSubtask = allSiblings[taskIndex - 1];

    if (previousSubtask.status === 'done') {
      // ✅ Previous approved - proceed
      filteredTasks.push(task);
    } else {
      // ❌ Block this subtask
      console.log(`[CTO Blocker] Subtask "${task.title}" blocked. ` +
                  `Previous not approved (status: ${previousSubtask.status})`);
    }
  }
}

return filteredTasks;
```

**States That Block**:
- `todo` - Not started yet
- `in-progress` - Being worked on
- `for-review` - Waiting for CTO review
- `failed` - Failed execution

**Only "done" Unblocks** ✅

---

### 6. Team Lead Retry on Failure 🔄

When CTO marks task as `todo` with feedback:

1. **Runner polls and sees task is back in todo**
2. **Loads task with CTO feedback in comments**
3. **Re-executes with enhanced context**:
   ```markdown
   # Original Task Description
   ...

   ## ⚠️ Previous Attempt Failed

   **CTO Feedback:**
   - Missing error handling in API endpoints
   - Tests don't cover edge cases
   - Database migration missing rollback

   **Directive:**
   Address all concerns above before resubmitting.
   ```
4. **Team lead fixes issues and resubmits**
5. **CTO reviews again**

---

## Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│ Parent Task: "Build Authentication System"                   │
│ ├─ Subtask 1: Create Database Schema                        │
│ ├─ Subtask 2: Implement Backend API                         │
│ ├─ Subtask 3: Build Frontend UI                             │
│ └─ Subtask 4: Add Security & Encryption                     │
└──────────────────────────────────────────────────────────────┘

┌─────────────────┐
│ Subtask 1 Start │  ← First subtask, always allowed
└────────┬────────┘
         │
    ┌────▼─────────────┐
    │ Team Lead Executes│
    └────┬─────────────┘
         │
    ┌────▼──────────────┐
    │ Status: for-review │
    └────┬──────────────┘
         │
    ┌────▼───────────────┐
    │  CTO Reviews       │
    │  Verification: AI  │
    └────┬───────────────┘
         │
     ┌───▼───┐
     │ Score?│
     └┬────┬─┘
      │    │
   >=80│   │<80
      │    │
  ┌───▼┐  ┌▼──────────────────┐
  │PASS│  │ FAIL              │
  │    │  │ Status: todo      │
  │    │  │ Comment: Feedback │
  └┬───┘  └┬──────────────────┘
   │       │
   │       └──────┐
   │              │
   │         ┌────▼────────┐
   │         │ Team Retries│
   │         └────┬────────┘
   │              │
   │              └──────┐
┌──▼───────────────┐    │
│ Status: done     │◄───┘
│ ✅ Approved      │
└──┬───────────────┘
   │
   │ ┌──────────────────────────────────────┐
   └►│ Subtask 2 UNBLOCKED                 │
     │ (Previous subtask status = done)    │
     └──┬───────────────────────────────────┘
        │
   ┌────▼─────────────┐
   │ Subtask 2 Starts │
   └──────────────────┘
```

---

## Example: Real Scenario

### Epic: "Implement Payment System"

**Subtasks**:
1. Setup Stripe SDK
2. Create Payment Intent API
3. Build Checkout UI
4. Add Webhook Handler

---

#### Timeline:

**10:00 AM** - Subtask 1 starts (Setup Stripe SDK)
- Team Lead: Creates SDK wrapper, adds config
- **10:15 AM** - Completes, marks for review
- **10:16 AM** - CTO reviews: Score 85 ✅
- **Status**: Done

**10:17 AM** - Subtask 2 UNBLOCKED (Create Payment Intent API)
- Previous subtask approved ✅
- Team Lead: Implements API endpoint
- **10:45 AM** - Completes, marks for review
- **10:46 AM** - CTO reviews: Score 65 ❌
  - **Feedback**: "Missing error handling for failed charges"
  - **Status**: Moved to todo

**10:47 AM** - Subtask 3 BLOCKED (Build Checkout UI)
- Previous subtask not approved ❌
- Runner doesn't return this task
- Waits...

**10:50 AM** - Subtask 2 RETRY
- Team Lead sees CTO feedback
- Adds error handling
- **11:10 AM** - Resubmits for review
- **11:11 AM** - CTO reviews: Score 88 ✅
- **Status**: Done

**11:12 AM** - Subtask 3 UNBLOCKED (Build Checkout UI)
- Previous subtask NOW approved ✅
- Team Lead starts frontend work...

---

## Configuration

### Passing Score Threshold

**Current**: `score >= 80` passes

**Customize** in `CTOEngine.js:934`:
```javascript
if (verification.passed && verification.score >= 80) {
  // PASSED
}
```

### Review Frequency

**Watcher Interval**: Set in `agent-runner.js` polling cycle

**Default**: Every 10-30 seconds

---

## Benefits

### 1. Quality Gates ✅
- No cascading failures
- Each subtask validated before proceeding
- High-quality deliverables

### 2. Fast Feedback Loop 🔄
- Immediate CTO review after completion
- Detailed, actionable feedback
- Team lead retries with clear direction

### 3. Sequential Execution 📊
- Prevents race conditions
- Ensures proper dependencies
- Clean execution flow

### 4. Zero Manual Intervention 🤖
- Fully automated review process
- AI-powered quality checks
- Auto-blocking/unblocking of tasks

---

## Monitoring

### Logs

**CTO Review**:
```bash
[CTO] Watcher: Reviewing task "Create Payment Intent API"...
[CTO] Task FAILED review (Score: 65). Feedback provided.
[CTO Blocker] Subtask "Build Checkout UI" blocked. Previous not approved (status: todo)
```

**Successful Approval**:
```bash
[CTO] Task PASSED review (Score: 88)
[CTO] Subtask "Build Checkout UI" now unblocked
```

### Task Comments

**In UI**, each task shows:
- ✅ "CTO Review Passed (88/100)" - Strengths listed
- ❌ "CTO Review Failed (65/100)" - Detailed feedback

---

## Summary

✅ **CTO is notified** when team lead finishes
✅ **CTO reviews output** using AI verification
✅ **Compares against expected output** (description, objectives)
✅ **If mismatch**: Moves to todo, adds detailed feedback
✅ **Team lead retries** with CTO guidance
✅ **Next subtask blocked** until previous approved
✅ **Sequential execution** enforced at backend level
✅ **Fully automated** quality pipeline

**Result**: High-quality, sequential task execution with automated review and feedback loops! 🎯

---

**Last Updated**: 2026-02-12
**Status**: Production Ready
**Files Modified**:
- `agent-runner/cto/CTOEngine.js` (reviewTask method)
- `agent-runner/agent-runner.js` (watcher logic)
- `task-manager/server/index.js` (sequential blocking)
