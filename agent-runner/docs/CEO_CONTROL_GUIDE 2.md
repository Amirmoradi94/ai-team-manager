# 👔 CEO Control Guide - Managing the CTO

## Overview

As the CEO, you have **full control** over the CTO Intelligence Layer through multiple interfaces: UI Settings, API, and configuration files.

---

## 🎛️ 1. UI Control Panel (Recommended)

### Access:
1. Open Task Manager: `http://localhost:5173`
2. Go to **Settings** → **CTO Intelligence Layer**

### CEO Powers in UI:

#### 🔴 Enable/Disable CTO
- **Toggle**: On/Off switch at the top
- **Effect**: Instantly enable or disable CTO intelligence
- **Use Case**: Turn off CTO to use direct task assignment

#### 🧠 AI Decision Mode
- **Toggle**: "AI-Powered Decisions"
- **Options**:
  - ✅ **ON**: CTO uses Gemini 3 Pro / Claude Opus 4.5 / GPT-5.2 (~$0.003/task)
  - ❌ **OFF**: CTO uses keyword matching (free but basic)
- **Use Case**: Save costs during development, enable AI for production

#### 🤖 AI Model Selection
- **Choose CTO's Brain**:
  - **Gemini 3 Pro** ⭐ - Best balance (Recommended)
  - **Claude Opus 4.5** - Highest quality
  - **GPT-5.2** - Alternative
  - **Claude Sonnet 4.5** - Fast decisions
  - **Gemini 3 Pro** - Fastest (cheap)
  - **Claude Haiku 4.5** - Ultra fast
- **Use Case**: Choose based on task importance and budget

#### ⚡ Subscription Plans
Configure your actual subscription tiers for accurate rate limiting:

| Provider | Plans Available | Limits |
|----------|----------------|--------|
| **Claude** | Pro, Max 5x, Max 20x | 45-900 msgs/5h |
| **Gemini** | Pro, Ultra | 100-500 msgs/day |
| **Codex** | Plus, Pro | 90-900 msgs/5h |

**Why it matters**: CTO tracks usage and defers tasks when limits approach

#### 🎚️ Thresholds (Fine Control)

**Split Complexity Score** (10-100)
- Default: `45`
- Tasks scoring above this → Split into subtasks
- Lower = more splitting, Higher = fewer splits
- **Example**: Set to `30` for aggressive splitting, `60` for fewer splits

**Defer Usage %** (50-100)
- Default: `90%`
- When provider usage exceeds this → Defer tasks
- **Example**: Set to `80%` to defer earlier (safer), `95%` to use more capacity

**Max Retries** (0-5)
- Default: `2`
- Failed tasks retry this many times before CEO escalation
- **Example**: Set to `0` for no retries, `3` for more attempts

#### 📊 Performance Dashboard
Click **Refresh** to see:
- **Active Tasks**: Currently being processed
- **Success Rate**: % of tasks completed successfully
- **AI Decisions**: How many used AI vs rule-based
- **Avg Complexity**: Simple/Moderate/Complex/Epic
- **Resource Usage**: Remaining API capacity per provider

#### 💾 Save Settings
Click **"Save CTO Settings"** to:
- Persist to database
- Notify you to restart agent-runner
- Settings take effect on next polling cycle

---

## 🔧 2. API Control (Programmatic)

### Endpoints:

#### **GET** `/api/settings/cto`
Retrieve current CTO configuration

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/settings/cto
```

**Response:**
```json
{
  "enabled": true,
  "useAIForDecisions": true,
  "ctoProvider": "gemini-3-pro",
  "models": {
    "preferredModels": ["gemini-3-pro", "claude-opus-4.5", "gpt-5.2"]
  },
  "subscriptions": {
    "claude": { "plan": "max5x" },
    "gemini": { "plan": "ultra" }
  },
  "maxRetries": 2,
  "splitComplexityScore": 45,
  "deferWindowUsagePercent": 90
}
```

#### **PUT** `/api/settings/cto`
Update CTO configuration

```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "useAIForDecisions": true,
    "ctoProvider": "claude-opus-4.5",
    "maxRetries": 3
  }' \
  http://localhost:3001/api/settings/cto
```

#### **GET** `/api/runner/active-tasks`
Get tasks currently being processed by CTO

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/runner/active-tasks
```

---

## 📝 3. Configuration File Control

### File: `agent-runner/config.json`

```json
{
  "cto": {
    "enabled": true,                    // CEO: Turn CTO on/off
    "useAIForDecisions": true,          // CEO: Enable AI reasoning
    "ctoProvider": "gemini-3-pro",      // CEO: Choose AI model

    "models": {
      "preferredModels": [              // CEO: Model priority order
        "gemini-3-pro",                 // Try this first
        "claude-opus-4.5",              // Then this
        "gpt-5.2",                      // Then this
        "claude-sonnet-4.5"
      ]
    },

    "subscriptions": {                  // CEO: Set actual subscription tiers
      "claude": { "plan": "max5x" },
      "gemini": { "plan": "ultra" },
      "codex": { "plan": "plus" }
    },

    "thresholds": {                     // CEO: Fine-tune behavior
      "splitComplexityScore": 45,       // When to split tasks
      "deferWindowUsagePercent": 90,    // When to defer (% of limit)
      "reserveBuffer": 5,               // Safety buffer
      "maxRetries": 2                   // Attempts before escalation
    },

    "preferences": {
      "maxConcurrentTasks": 1,          // CEO: Parallel task limit
      "logDecisions": true              // CEO: Enable decision logging
    }
  }
}
```

**After editing**: Restart agent-runner for changes to take effect

---

## 📋 4. Decision Logs (Monitoring)

### View CTO Decisions:
```bash
tail -f agent-runner/cto/decisions/DECISION_LOG.md
```

### What You'll See:
```markdown
## 2026-02-10T16:45:00Z - Task: Implement authentication [AI-POWERED] ✨
- **Action:** execute
- **Reason:** AI Analysis (gemini-3-pro): Well-defined task with clear requirements. JWT auth is a standard pattern with established best practices.
- **Confidence:** 85%
- **Provider:** claude (claude-sonnet-4.5)
- **Complexity:** moderate (score: 35)
- **Risk Factors:** Security sensitive, Requires testing
- **Decision Method:** AI-powered analysis
- **CEO Note:** Can override by changing task assignment
```

### Key Markers:
- `[AI-POWERED]` - Decision made by AI model
- `[RULE-BASED]` - Decision made by keyword matching
- `Action: split` - Task was split into subtasks
- `Action: defer` - Task was deferred (rate limit)
- `Action: execute` - Task assigned to provider
- `ESCALATED TO CEO` - Task failed all retries, needs CEO review

---

## 🎯 5. Override CTO Decisions

### Method 1: Task Assignment Override
In the UI, when creating/editing a task:
- Set **"Assign To"** field to specific person/agent
- CTO will respect CEO's direct assignment
- **Use Case**: "I want Claude specifically on this critical task"

### Method 2: Disable CTO Temporarily
In Settings:
- Toggle CTO **OFF**
- Create/assign task directly
- Toggle CTO back **ON**
- **Use Case**: One-off urgent task bypass

### Method 3: Change Task After CTO Decision
If CTO defers or splits:
- View task in Kanban
- Manually change status to "in-progress"
- Manually assign to provider
- **Use Case**: "I know we're rate-limited but this is urgent"

---

## 📊 6. CEO Dashboard Metrics

### Real-Time Monitoring:

**Resource Health:**
```
Claude Max 5x:  225/225 msgs (5h window)  ✅ Healthy
Gemini Ultra:   450/500 msgs (daily)      ⚠️  90% used
Codex Plus:     10/90 msgs (5h window)    ✅ Healthy
```

**CTO Performance:**
```
Total Tasks Evaluated: 150
AI-Powered Decisions:  142 (95%)
Rule-Based Decisions:  8 (5%)
Success Rate:          92%
Avg Task Complexity:   moderate
Split Rate:            12% (18 tasks)
Defer Rate:            3% (4 tasks)
```

**Provider Performance:**
```
Claude:  45 tasks, 95% success, avg 12 msgs/task
Gemini:  30 tasks, 90% success, avg 8 msgs/task
Codex:   15 tasks, 88% success, avg 15 msgs/task
```

---

## 🚨 7. CEO Escalations

### When CTO Escalates to You:

**Scenario 1: Task Failed All Retries**
- **CTO Action**: Marks task "for-review" with failure report
- **CEO Options**:
  1. Review logs and reassign with different approach
  2. Split task manually into smaller pieces
  3. Assign to human developer
  4. Close as "won't do"

**Scenario 2: All Providers Rate-Limited**
- **CTO Action**: Defers all tasks until capacity available
- **CEO Options**:
  1. Wait for rate limit reset (CTO will auto-resume)
  2. Upgrade subscription plan in Settings
  3. Manually override for urgent tasks
  4. Adjust `deferWindowUsagePercent` to use more capacity

**Scenario 3: Task Complexity Too High**
- **CTO Action**: Splits into subtasks
- **CEO Options**:
  1. Review subtasks and approve
  2. Merge subtasks if over-split
  3. Manually rewrite task with clearer requirements
  4. Adjust `splitComplexityScore` threshold

---

## 🎓 8. Best Practices

### ✅ DO:
- **Monitor decision logs weekly** - Understand CTO patterns
- **Adjust thresholds gradually** - Small changes, observe results
- **Use AI mode for production** - Better decisions worth $0.003
- **Set accurate subscription plans** - Prevents rate limit surprises
- **Review escalated tasks promptly** - Don't let them pile up
- **Trust CTO on routine tasks** - It learns from outcomes

### ❌ DON'T:
- **Don't disable CTO impulsively** - Give it time to learn
- **Don't set maxRetries too high** - Wastes resources on bad tasks
- **Don't ignore rate limits** - CTO is protecting you
- **Don't override every decision** - CTO can't learn if bypassed
- **Don't set splitScore too low** - Creates too many subtasks
- **Don't forget to save settings** - Changes won't apply otherwise

---

## 📈 9. Optimization Guide

### For Maximum Quality:
```json
{
  "useAIForDecisions": true,
  "ctoProvider": "claude-opus-4.5",
  "maxRetries": 3,
  "splitComplexityScore": 40
}
```
**Result**: Best decisions, more splits, more retries, higher cost

### For Maximum Speed:
```json
{
  "useAIForDecisions": true,
  "ctoProvider": "gemini-3-pro",
  "maxRetries": 1,
  "splitComplexityScore": 60
}
```
**Result**: Fast decisions, fewer splits, fewer retries, lower cost

### For Minimum Cost:
```json
{
  "useAIForDecisions": false,
  "maxRetries": 1,
  "splitComplexityScore": 70
}
```
**Result**: Free decisions (keyword matching), minimal retries, cost = $0

### For Balanced Production:
```json
{
  "useAIForDecisions": true,
  "ctoProvider": "gemini-3-pro",
  "maxRetries": 2,
  "splitComplexityScore": 45,
  "deferWindowUsagePercent": 90
}
```
**Result**: Intelligent decisions, reasonable retries, moderate cost (~$0.003/task)

---

## 🔐 10. Security & Permissions

### Who Can Control CTO?

**Full Control** (Admin/CEO):
- ✅ Enable/disable CTO
- ✅ Change AI models
- ✅ Adjust all thresholds
- ✅ View decision logs
- ✅ Override decisions

**Limited Control** (Team Lead):
- ✅ View performance metrics
- ✅ View decision logs
- ❌ Cannot change CTO settings
- ❌ Cannot override globally

**No Control** (Developer):
- ✅ See task assignments from CTO
- ❌ Cannot view CTO internals
- ❌ Cannot override decisions

---

## 📞 11. Troubleshooting

### Problem: CTO keeps deferring tasks
**Solution**: Lower `deferWindowUsagePercent` or upgrade subscriptions

### Problem: Too many task splits
**Solution**: Increase `splitComplexityScore` from 45 to 55+

### Problem: Tasks failing verification
**Solution**: Increase `maxRetries` or review task descriptions for clarity

### Problem: High AI costs
**Solution**: Switch to faster model (gemini-3-pro) or disable AI mode

### Problem: CTO not using AI
**Solution**: Check `useAIForDecisions: true` and restart agent-runner

---

## 🎉 Summary

**As CEO, you control**:
- ✅ CTO on/off switch
- ✅ AI decision mode toggle
- ✅ AI model selection (7 models available)
- ✅ Subscription plan settings
- ✅ Thresholds (split/defer/retry)
- ✅ Performance monitoring
- ✅ Decision log access
- ✅ Task override capabilities
- ✅ Escalation handling

**The CTO is your employee** - You set the rules, it executes! 👔

---

**Quick Access**:
- **UI Settings**: http://localhost:5173/settings
- **API Docs**: See `/api/settings/cto` endpoints
- **Decision Logs**: `agent-runner/team_lead/product_manager/DECISION_LOG.md`
- **Config File**: `agent-runner/config.json`
