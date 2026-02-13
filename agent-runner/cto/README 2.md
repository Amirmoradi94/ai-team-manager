# CTO Intelligence Layer

## Overview
The CTO Intelligence Layer provides zero-cost resource management, task evaluation, and provider selection for the AI Team Manager.

## Directory Structure
```
agent-runner/cto/
├── index.js                    # Main export
├── CTOEngine.js                # CTO decision engine (400 lines)
├── ResourceManager.js          # Resource tracking (230 lines)
├── ProviderIntelligence.js     # Provider selection (140 lines)
├── __tests__/                  # Test directory
│   ├── cto.test.js            # 87 comprehensive tests
│   └── TEST_RESULTS.md        # Test results documentation
└── README.md                   # This file
```

## Components

### 1. **CTOEngine** (`CTOEngine.js`)
Main orchestrator that evaluates tasks and makes decisions.

**Key Methods:**
- `evaluate(task, payload)` - Decide: execute, split, or defer
- `splitTask(task, payload)` - Split epic tasks into subtasks
- `verifyCompletion(task, result)` - Verify task completion
- `buildRetryPrompt(task, output, missing, attempt)` - Build retry prompts
- `loadState()` / `persistState()` - State management

**Decision Logic:**
```
1. Analyze complexity (simple/moderate/complex/epic)
2. Detect numbered steps for splitting
3. Select provider (CEO preference → CTO ranking)
4. Check resource pressure
5. Decide: execute | split | defer
```

### 2. **ResourceManager** (`ResourceManager.js`)
Tracks resource usage across providers with rate limit enforcement.

**Key Methods:**
- `checkAvailability(provider)` - Check if provider is available
- `reserve(provider, messages)` - Reserve capacity
- `record(provider, messages, taskId, isCTO)` - Record usage
- `release(reservationId)` - Release reservation
- `getStatus()` - Get all provider statuses
- `getBestAvailable(candidates)` - Find best available provider

**Subscription Plans:**
```javascript
Claude:  pro (45/5h, 216/day), max5x (225/5h, 1080/day), max20x (900/5h, 4320/day)
Gemini:  pro (∞/5h, 100/day), ultra (∞/5h, 500/day)
Codex:   plus (90/5h, ∞/day), pro (900/5h, ∞/day)
```

### 3. **ProviderIntelligence** (`ProviderIntelligence.js`)
Maps task types to optimal providers using local keyword matching.

**Key Methods:**
- `classifyTask(title, description)` - Classify task type
- `selectProvider(task, identity)` - Select best provider

**Provider Matrix:**
```
Coding:       claude → codex → gemini
Research:     gemini → claude → codex
Debugging:    claude → codex → gemini
Scripting:    codex → claude → gemini
Architecture: claude → gemini → claude
```

## Memory & State

### Resource State (`team_lead/product_manager/RESOURCE_STATE.md`)
- Usage log (last 24 hours)
- Provider availability
- Active reservations
- Subscription plans

**Example:**
```markdown
## Usage Log (last 24h)
| provider | timestamp | messagesUsed | taskId | isCTO |
|----------|-----------|--------------|--------|-------|
| claude   | 2026-02-10T14:30:00Z | 12 | task-123 | false |
| gemini   | 2026-02-10T14:45:00Z | 3  | cto-internal | true |
```

### Decision Log (`team_lead/product_manager/DECISION_LOG.md`)
Permanent audit trail of all CTO decisions.

**Example:**
```markdown
## 2026-02-10T14:30:00Z - Task: Implement user authentication
- **Action:** execute
- **Reason:** CTO selected: claude for coding task (ranked #1)
- **Confidence:** 85%
- **Provider:** claude
- **Complexity:** moderate (score: 32)
```

## Usage in agent-runner.js

```javascript
const { CTOEngine } = require('./cto');

// Initialize CTO
this.cto = config.cto?.enabled
  ? new CTOEngine(this.taskAPI, config.cto, path.join(__dirname, 'team_lead'))
  : null;

// Load state on startup
await this.cto.loadState();

// Evaluate task
const decision = await this.cto.evaluate(task, payload);

if (decision.action === 'split') {
  await this.cto.splitTask(task, payload);
} else if (decision.action === 'defer') {
  // Skip task, reschedule for later
} else {
  // Execute task
  const resId = this.cto.reserveResources(decision.provider, decision.estimatedMessages);
  // ... execute ...
  this.cto.recordUsage(decision.provider, actualMessages, task.id);
  this.cto.releaseReservation(resId);
}

// Persist state
await this.cto.persistState();
```

## Configuration (config.json)

```json
{
  "cto": {
    "enabled": true,
    "ctoProvider": "gemini",
    "subscriptions": {
      "claude": { "plan": "max5x" },
      "gemini": { "plan": "ultra" },
      "codex": { "plan": "plus" }
    },
    "thresholds": {
      "maxRetries": 2,
      "splitComplexityScore": 45,
      "deferWindowUsagePercent": 90
    }
  }
}
```

## Zero AI Cost Features

✅ **Task Classification**: Keyword matching (no AI)
✅ **Complexity Analysis**: Pattern matching (no AI)
✅ **Provider Selection**: Matrix lookup (no AI)
✅ **Resource Tracking**: Math calculations (no AI)
✅ **Verification with Reports**: String detection (no AI)

**Only uses AI for:**
- Actual task execution by agents
- Optional verification (when no completion report present)

## Testing

Run tests:
```bash
cd agent-runner
node --test cto/__tests__/cto.test.js
```

See `__tests__/TEST_RESULTS.md` for detailed test coverage.

## Files Created by CTO

### At Runtime
- `team_lead/product_manager/RESOURCE_STATE.md` - Resource usage state
- `team_lead/product_manager/DECISION_LOG.md` - Decision audit log

### During Testing
- `cto/__tests__/cto.test.js` - 87 comprehensive tests
- `cto/__tests__/TEST_RESULTS.md` - Test documentation

## Integration Points

### Input
- Task from task manager (title, description, priority, etc.)
- Team lead identity (for CEO preference)
- Payload (project, team info)

### Output
- Decision: `{ action: 'execute'|'split'|'defer', provider, model, reason, confidence }`
- Subtasks (if split action)
- Resource reservations and usage records

### State Files
- Reads/writes to `team_lead/product_manager/`
- State persists across runner restarts

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     CTOEngine                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ evaluate() → execute | split | defer             │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                               │
│         ┌───────────────┴───────────────┐              │
│         ▼                               ▼              │
│  ┌─────────────────┐          ┌──────────────────┐    │
│  │ ResourceManager │          │ ProviderIntel    │    │
│  │  - Track usage  │          │  - Classify task │    │
│  │  - Check limits │          │  - Select best   │    │
│  │  - Reserve/     │          │    provider      │    │
│  │    Release      │          │                  │    │
│  └─────────────────┘          └──────────────────┘    │
│         │                               │              │
│         ▼                               ▼              │
│  ┌───────────────────────────────────────────────┐    │
│  │     State Files (team_lead/product_mgr/)   │    │
│  │  - RESOURCE_STATE.md (24h rolling window)     │    │
│  │  - DECISION_LOG.md (permanent audit trail)    │    │
│  └───────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Performance

- **Evaluation**: <1ms (all local)
- **State load**: ~10ms (file I/O)
- **State persist**: ~15ms (file I/O)
- **Total overhead per task**: ~25ms

**Zero latency** added to task execution - evaluation happens before execution starts.

## Future Enhancements

See conversation history for memory enhancement proposals:
- Task outcome tracking
- Provider performance learning
- User preference memory
- Complexity calibration

---

**Status**: ✅ Production-ready - All 87 tests passing
