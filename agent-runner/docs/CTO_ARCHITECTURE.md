# CTO Intelligence Layer - Architecture

## 1. Core Philosophy

The CTO is a **local intelligence layer** that sits between the Task Manager UI and the Agent Executor. It does NOT write code. It **plans, evaluates, verifies, retries, and reports**.

**Critical constraint:** All CLI tools (Claude Code, Gemini CLI, Codex CLI) are **subscription-based**, not API-key-based. Rate limits are per rolling window. The CTO itself consumes subscription messages for verification calls.

## 2. Subscription Plans & Resource Model

### Provider Plans

| Provider | Plan | Messages/5h | Messages/Day | Notes |
|----------|------|------------|-------------|-------|
| Claude | Pro | 45 | 216 | Sonnet default |
| Claude | Max 5x | 225 | 1,080 | Good for teams |
| Claude | Max 20x | 900 | 4,320 | Heavy usage |
| Gemini | Pro | 100 pro/day | 300 thinking/day | CTO default |
| Gemini | Ultra | 500 pro/day | 1,500 thinking/day | High throughput |
| Codex | Plus | 90/5h | - | Quick scripts |
| Codex | Pro | 900/5h | - | Heavy coding |

### Provider Intelligence Matrix

| Task Type | 1st Choice | 2nd Choice | 3rd Choice |
|-----------|-----------|-----------|-----------|
| research/planning/docs | gemini | claude-sonnet | codex |
| coding/debugging/api | claude-sonnet | codex | gemini |
| architecture/critical | claude-opus | gemini | claude-sonnet |
| scripting/quick | codex | claude-sonnet | gemini |
| general (default) | claude-sonnet | gemini | codex |

## 3. Session Lifecycle

```
Task arrives (status: todo)
  │
  ├─ CTO EVALUATE
  │   ├─ Classify complexity (local keyword matching, zero AI cost)
  │   ├─ Select provider (local logic, zero AI cost)
  │   ├─ Check resource availability
  │   └─ Decision: execute | split | defer | skip
  │
  ├─ IF SPLIT → create subtasks, mark parent as epic
  ├─ IF DEFER → log reason, skip this cycle
  ├─ IF EXECUTE:
  │   │
  │   ├─ ATTEMPT 1: Execute via Team Lead CLI session
  │   │   └─ CTO verifyCompletion() → 1 AI message (Gemini Pro)
  │   │       ├─ PASS → close session, report to UI, mark for-review
  │   │       └─ FAIL → extract what's missing
  │   │
  │   ├─ ATTEMPT 2 (retry 1): Re-prompt with feedback
  │   │   └─ CTO verifyCompletion() → 1 AI message
  │   │       ├─ PASS → close, report
  │   │       └─ FAIL → one more try
  │   │
  │   └─ ATTEMPT 3 (retry 2): Final attempt with stronger instructions
  │       └─ CTO verifyCompletion() → 1 AI message
  │           ├─ PASS → close, report
  │           └─ FAIL → ESCALATE to CEO (for-review with failure report)
  │
  └─ Record total resource usage
```

## 4. CTO Token Optimization

- Complexity analysis: **LOCAL** keyword matching (0 AI messages)
- Provider selection: **LOCAL** logic (0 AI messages)
- Verification: **1 AI message** per attempt (compact structured prompt)
- Total CTO overhead: **1-3 messages per task** (verify + possible retries)
- CTO tracks its own usage separately via `ResourceManager.trackCTOUsage()`

## 5. Context Overflow Prevention

- `_summarizeOutput(output, maxChars)` → Keeps last N chars intelligently
- `_truncateDescription(desc, maxChars)` → First paragraph + truncate
- Retry prompts never include full previous output, only summary (max 2000 chars)
- Verification prompts capped at ~4000 chars total

## 6. CEO Override Rules

1. CEO sets `identity.model_config.provider` on team lead → CTO respects it
2. If provider unavailable → CTO logs warning, falls back to ranked selection
3. If provider = 'auto' or unset → CTO classifies task and picks best available

## 7. Persistent State

- `team_lead/product_manager/RESOURCE_STATE.md` → Rolling window usage tracking
- `team_lead/product_manager/DECISION_LOG.md` → Audit trail of all CTO decisions
- Settings stored in DB `settings` table with key `cto_config`

## 8. File Structure

```
agent-runner/
├── cto/
│   ├── index.js              # Barrel export
│   ├── CTOEngine.js          # Central brain
│   ├── ResourceManager.js    # Subscription tracking
│   └── ProviderIntelligence.js # Task→provider mapping
```
