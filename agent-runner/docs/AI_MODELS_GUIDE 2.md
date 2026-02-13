# CTO AI Models - Configuration Guide

## Overview

The CTO now uses **actual AI models** for intelligent decision-making, not just keyword matching!

### AI Models Used by CTO

The CTO selects from these models based on availability and task complexity:

#### 🥇 **Primary Models** (High Capability)
1. **Gemini 3 Pro** (`gemini-3-pro`)
   - Provider: Google
   - Best for: Complex analysis, strategic decisions
   - Cost: $0.002 per 1K tokens
   - Context: 1M tokens

2. **Claude Opus 4.5** (`claude-opus-4.5`)
   - Provider: Anthropic
   - Best for: Highest quality decisions, critical tasks
   - Cost: $0.015 per 1K tokens
   - Context: 200K tokens

3. **GPT-5.2** (`gpt-5.2`)
   - Provider: OpenAI
   - Best for: Balanced performance
   - Cost: $0.010 per 1K tokens
   - Context: 128K tokens

#### 🥈 **Secondary Models** (Fast & Efficient)
4. **Claude Sonnet 4.5** (`claude-sonnet-4.5`)
   - Fast, high-quality decisions
   - Cost: $0.003 per 1K tokens

5. **Gemini 3 Pro** (`gemini-3-pro`)
   - Fastest response time
   - Cost: $0.001 per 1K tokens

6. **GPT-5.2 Mini** (`gpt-5.2-mini`)
   - Efficient for simple tasks
   - Cost: $0.002 per 1K tokens

7. **Claude Haiku 4.5** (`claude-haiku-4.5`)
   - Ultra-fast decisions
   - Cost: $0.0008 per 1K tokens

---

## Configuration

### config.json
```json
{
  "cto": {
    "enabled": true,
    "useAIForDecisions": true,
    "ctoProvider": "gemini-3-pro",
    "models": {
      "preferredModels": [
        "gemini-3-pro",
        "claude-opus-4.5",
        "gpt-5.2",
        "claude-sonnet-4.5",
        "gemini-3-pro"
      ]
    },
    "subscriptions": {
      "claude": { "plan": "max5x" },
      "gemini": { "plan": "ultra" },
      "codex": { "plan": "plus" }
    }
  }
}
```

### Key Settings

**`useAIForDecisions`** (boolean, default: `true`)
- `true`: CTO uses AI models (Gemini/Claude/GPT) for decisions
- `false`: CTO uses rule-based keyword matching (old behavior)

**`ctoProvider`** (string, default: `"gemini-3-pro"`)
- Preferred model for CTO decisions
- Options: `"gemini-3-pro"`, `"claude-opus-4.5"`, `"gpt-5.2"`, etc.

**`preferredModels`** (array)
- List of models in priority order
- CTO tries each until one is available

---

## How CTO Uses AI

### 1. Task Evaluation
```
Task arrives
    ↓
CTO selects best AI model (Gemini Pro, Claude Opus, or GPT-5.2)
    ↓
AI analyzes: complexity, clarity, scope, risks
    ↓
AI decides: EXECUTE, SPLIT, or DEFER
    ↓
Decision logged with AI reasoning
```

### 2. Model Selection Logic

**For Epic/Complex Tasks:**
```
Priority: Claude Opus 4.5 > GPT-5.2 > Gemini 3 Pro
(Highest capability models)
```

**For Simple Tasks:**
```
Priority: Claude Haiku > Gemini Flash > GPT-5.2 Mini
(Fast, efficient models)
```

**For Moderate Tasks:**
```
Priority: Gemini 3 Pro > Claude Opus > GPT-5.2 > Claude Sonnet
(User-defined preference order)
```

### 3. AI Decision Example

**Input:**
```
Task: "Implement user authentication with JWT"
Description: "Add login, logout, token refresh, password reset..."
```

**AI Analysis (using Gemini 3 Pro):**
```json
{
  "action": "EXECUTE",
  "complexity": "moderate",
  "reasoning": "Well-defined task with clear requirements. JWT auth is a standard pattern with established best practices. No need to split.",
  "recommendedProvider": "claude",
  "confidence": 85,
  "estimatedMessages": 15,
  "riskFactors": ["Security sensitive", "Requires testing"],
  "shouldSplit": false
}
```

**CTO Decision:**
```
Action: execute
Provider: claude (claude-sonnet-4.5)
Reason: AI Analysis (gemini-3-pro): Well-defined task with clear requirements...
Confidence: 85%
Method: AI-powered analysis ✨
```

---

## Cost Comparison

### AI-Powered CTO
| Operation | Model Used | Tokens | Cost |
|-----------|------------|--------|------|
| Task analysis | Gemini 3 Pro | ~1,000 | $0.002 |
| Verification | Claude Haiku | ~800 | $0.0006 |
| **Total per task** | - | ~1,800 | **~$0.003** |

### Rule-Based CTO (Old)
| Operation | AI Used | Cost |
|-----------|---------|------|
| Task analysis | None | $0.00 |
| Verification | None | $0.00 |
| **Total** | - | **$0.00** |

**Trade-off:** Pay ~$0.003 per task for intelligent AI decisions vs free keyword matching.

---

## Benefits of AI-Powered CTO

### ✅ **Intelligent Analysis**
- Understands context and nuance
- Detects hidden complexity
- Identifies risks and dependencies

### ✅ **Better Decisions**
- Strategic reasoning, not just keywords
- Adapts to unusual tasks
- Explains its thinking

### ✅ **Improved Accuracy**
- Reduces false positives (wrong complexity)
- Better split/execute/defer decisions
- Smarter provider selection

### ✅ **Learning from Context**
- Considers historical data
- Understands resource constraints
- Makes trade-off decisions

---

## Fallback Behavior

If no AI model is available:
```
[CTO] AI analysis unavailable, using fallback logic
```

CTO automatically falls back to rule-based keyword matching (zero cost).

---

## Integration with agent-runner.js

### Initialization
```javascript
const { CTOEngine } = require('./cto');
const AgentExecutor = require('./agent-executor');

// Initialize with executor so CTO can use AI
const executor = new AgentExecutor(this.taskAPI);
this.cto = new CTOEngine(
  this.taskAPI,
  config.cto,
  path.join(__dirname, 'team_lead'),
  executor  // ← Pass executor for AI decisions
);
```

### Usage
```javascript
// CTO automatically uses AI when available
const decision = await cto.evaluate(task, payload);

// Decision will include:
// - aiPowered: true (if AI was used)
// - reasoning from AI model
// - recommended model and provider
```

---

## Monitoring AI Usage

### Check Available Models
```javascript
const models = cto.modelSelector.getAvailableModels();
console.log('Available:', models.map(m => m.model));
```

### View Decision Logs
```bash
tail -f team_lead/product_manager/DECISION_LOG.md
```

Look for `[AI-POWERED]` marker:
```markdown
## 2026-02-10T16:30:00Z - Task: Implement auth [AI-POWERED]
- **Action:** execute
- **Reason:** AI Analysis (gemini-3-pro): Well-defined task...
- **Confidence:** 85%
- **Model:** claude-sonnet-4.5
- **Decision Method:** AI-powered analysis
```

---

## Model Verification

### Test Model Loading
```bash
cd agent-runner
node -e "
const {CTOEngine} = require('./cto');
const cto = new CTOEngine({}, {useAIForDecisions: true}, './team_lead');
console.log('Available models:', cto.modelSelector.getAvailableModels());
"
```

---

## Summary

**Old CTO (Rule-Based):**
- ❌ Keyword matching only
- ✅ Zero cost
- ❌ No reasoning
- ❌ Misses nuance

**New CTO (AI-Powered):**
- ✅ Uses Gemini Pro / Claude Opus / GPT-5.2
- ⚠️ ~$0.003 per task
- ✅ Intelligent reasoning
- ✅ Context-aware decisions
- ✅ Explains thinking
- ✅ Auto-fallback if no AI available

**The CTO is now truly intelligent!** 🧠✨
