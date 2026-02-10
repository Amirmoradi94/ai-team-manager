# 🏗️ Code Organization - CTO vs Team Leads

## ⚠️ CRITICAL: Clear Separation

This document defines the **strict separation** between CTO Intelligence and Team Lead execution to avoid confusion and code mixing.

---

## 📊 Organization Chart

```
Company Structure:
├── 👔 CEO (User)
│   └── Controls everything via UI/API
│
├── 🧠 CTO (Intelligence Layer)
│   ├── Evaluates tasks (AI-powered)
│   ├── Splits epics into subtasks
│   ├── Manages resources (rate limits)
│   ├── Verifies completion
│   └── Makes strategic decisions
│
└── 👥 Team Leads (Execution Layer)
    ├── Frontend Developer
    ├── Backend Developer
    ├── DevOps Engineer
    ├── UI/UX Designer
    ├── Content Marketing Specialist
    └── ... (other specialists)
```

---

## 📁 Directory Structure

### ✅ CORRECT Organization:

```
agent-runner/
│
├── cto/                          ← 🧠 CTO ONLY (Intelligence)
│   ├── state/                    ← CTO state files (resources, history)
│   ├── decisions/                ← CTO decision logs
│   ├── __tests__/                ← CTO tests
│   ├── CTOEngine.js              ← Main CTO brain
│   ├── ResourceManager.js        ← Rate limit tracking
│   ├── ProviderIntelligence.js   ← Provider selection logic
│   ├── TaskHistoryManager.js     ← Strategic memory
│   ├── ModelSelector.js          ← AI model selection
│   ├── AIDecisionEngine.js       ← AI-powered decisions
│   ├── index.js                  ← Module exports
│   └── README.md                 ← CTO documentation
│
├── team_lead/                 ← 👥 TEAM LEADS ONLY (Execution)
│   ├── roles/                    ← Individual specialist definitions
│   │   ├── frontend_developer.md
│   │   ├── backend_developer.md
│   │   ├── ui_ux_designer.md
│   │   └── ...
│   │
│   └── teams/                    ← Team compositions
│       └── digital_marketing/
│           ├── LEAD.md           ← Team lead identity
│           └── IDENTITY.md       ← Team configuration
│
├── agent-executor.js             ← 👥 Executes tasks (Team Leads)
├── agent-runner.js               ← 🔄 Main loop (coordinates CTO + Execution)
├── task-manager-api.js           ← API client
└── config.json                   ← Configuration
```

---

## 🚫 Common Mistakes to AVOID

### ❌ WRONG:
```javascript
// CTO accessing team lead files
const teamLead = require('./team_lead/roles/frontend_developer');

// Team lead accessing CTO internals
const cto = require('./cto/CTOEngine');

// Mixing CTO state with team lead state
const stateFile = './team_lead/product_manager/CTO_STATE.md';
```

### ✅ CORRECT:
```javascript
// CTO uses its own directories
const ctoState = './cto/state/RESOURCE_STATE.md';
const ctoDecisions = './cto/decisions/DECISION_LOG.md';

// Team leads use team_lead
const teamLead = './team_lead/roles/frontend_developer.md';
const teamIdentity = './team_lead/teams/digital_marketing/LEAD.md';
```

---

## 🎯 Responsibilities

### 🧠 CTO (agent-runner/cto/)

**DOES**:
- ✅ Evaluate task complexity (AI-powered)
- ✅ Decide: EXECUTE / SPLIT / DEFER
- ✅ Manage provider resources (rate limits)
- ✅ Track task outcomes (strategic memory)
- ✅ Verify task completion
- ✅ Select best AI model
- ✅ Log decisions with reasoning

**DOES NOT**:
- ❌ Execute tasks (that's team leads' job)
- ❌ Write code (that's team leads' job)
- ❌ Access team lead files directly
- ❌ Store technical implementation details

**Files Used**:
- `cto/state/RESOURCE_STATE.md` - Resource usage tracking
- `cto/state/TASK_HISTORY.md` - Historical outcomes
- `cto/decisions/DECISION_LOG.md` - Decision reasoning
- `cto/decisions/SPLIT_HISTORY.md` - Epic splitting history

---

### 👥 Team Leads (agent-runner/team_lead/)

**DOES**:
- ✅ Execute tasks assigned by CTO
- ✅ Write/modify code
- ✅ Run tests and validation
- ✅ Generate completion reports
- ✅ Follow role-specific guidelines

**DOES NOT**:
- ❌ Make strategic decisions (that's CTO's job)
- ❌ Manage rate limits (that's CTO's job)
- ❌ Split tasks (that's CTO's job)
- ❌ Access CTO state files

**Files Used**:
- `team_lead/roles/*.md` - Role definitions
- `team_lead/teams/*/LEAD.md` - Team lead identity
- `team_lead/teams/*/IDENTITY.md` - Team configuration

---

## 🔄 Interaction Flow

```
1. Task Created
   ↓
2. 🧠 CTO Evaluates
   ├─→ DEFER (rate limit) → Skip for now
   ├─→ SPLIT (too complex) → Create subtasks
   └─→ EXECUTE → Continue
       ↓
3. 🧠 CTO Selects Provider
   ├─→ Best: Claude / Gemini / Codex
   └─→ Reserves resources
       ↓
4. 👥 Team Lead Executes
   ├─→ AgentExecutor runs task
   └─→ Uses role-specific guidelines
       ↓
5. 🧠 CTO Verifies
   ├─→ Checks completion report
   └─→ Decides: PASS / RETRY / ESCALATE
       ↓
6. 🧠 CTO Records Outcome
   ├─→ Updates task history
   ├─→ Releases resources
   └─→ Logs decision
```

---

## 📝 File Naming Conventions

### CTO Files (cto/):
- `CTOEngine.js` - Main orchestrator
- `ResourceManager.js` - Resource tracking
- `TaskHistoryManager.js` - Strategic memory
- `DECISION_LOG.md` - Decision reasoning
- `RESOURCE_STATE.md` - Current resource status
- `TASK_HISTORY.md` - Historical outcomes

### Team Lead Files (team_lead/):
- `roles/*.md` - Specialist definitions
- `teams/*/LEAD.md` - Team lead identity
- `teams/*/IDENTITY.md` - Team configuration
- `teams/*/CONTEXT.md` - Team-specific context

---

## 🔍 How to Verify Separation

### Check CTO Isolation:
```bash
# CTO should NOT import from team_lead
grep -r "team_lead" agent-runner/cto/
# Should return: NO RESULTS (except comments/docs)
```

### Check Team Lead Isolation:
```bash
# Team leads should NOT import CTO modules
grep -r "require.*cto" agent-runner/team_lead/
# Should return: NO RESULTS
```

### Check File Locations:
```bash
# CTO state files should be in cto/
find agent-runner/cto/state -name "*.md"

# Team lead files should be in team_lead/
find agent-runner/team_lead -name "*.md"
```

---

## 🎓 Training for Developers

### When Adding CTO Features:
1. ✅ Put code in `agent-runner/cto/`
2. ✅ Store state in `cto/state/`
3. ✅ Log decisions in `cto/decisions/`
4. ✅ Export from `cto/index.js`
5. ✅ Document in `cto/README.md`
6. ❌ DO NOT touch `team_lead/`

### When Adding Team Lead Features:
1. ✅ Put definitions in `team_lead/roles/`
2. ✅ Put team config in `team_lead/teams/`
3. ✅ Update `agent-executor.js` for execution logic
4. ❌ DO NOT touch `cto/`

---

## 📦 Module Exports

### CTO Exports (cto/index.js):
```javascript
module.exports = {
  CTOEngine,           // Main CTO brain
  ResourceManager,     // Resource tracking
  ProviderIntelligence,// Provider selection
  TaskHistoryManager,  // Strategic memory
  ModelSelector,       // AI model selection
  AIDecisionEngine     // AI-powered decisions
};
```

### Team Lead Access:
```javascript
// Import team lead definitions (NOT CTO!)
const teamLead = fs.readFileSync('./team_lead/roles/frontend_developer.md');
const teamIdentity = fs.readFileSync('./team_lead/teams/digital_marketing/LEAD.md');
```

---

## 🧪 Testing Separation

### CTO Tests (cto/__tests__/):
```javascript
// Test CTO in isolation
const { CTOEngine } = require('../index');

test('CTO evaluates task', async () => {
  const cto = new CTOEngine(mockAPI, config, 'cto/state');
  const decision = await cto.evaluate(task);
  expect(decision.action).toBe('execute');
});
```

### Integration Tests:
```javascript
// Test CTO + Team Lead interaction
test('CTO assigns task to team lead', async () => {
  const cto = new CTOEngine(mockAPI, config);
  const executor = new AgentExecutor(mockAPI);

  // CTO decides
  const decision = await cto.evaluate(task);

  // Team lead executes
  const result = await executor.executeTask(task, decision.provider);

  // CTO verifies
  const verification = await cto.verifyCompletion(task, result);
});
```

---

## 🚨 Red Flags (Code Smells)

These indicate mixing of concerns:

❌ **CTO accessing team lead files**:
```javascript
const teamLead = require('./team_lead/roles/frontend_developer');
```

❌ **Team lead importing CTO modules**:
```javascript
const { CTOEngine } = require('./cto');
```

❌ **CTO state in team_lead**:
```javascript
const stateFile = './team_lead/product_manager/CTO_STATE.md';
```

❌ **Team lead decisions in CTO**:
```javascript
// In CTOEngine.js
const shouldUseTailwind = task.includes('styling'); // Too specific!
```

---

## ✅ Best Practices

### 1. **Single Responsibility**
- CTO = Strategy & Management
- Team Leads = Execution & Implementation

### 2. **Clear Boundaries**
- CTO never executes code
- Team Leads never make strategic decisions

### 3. **Separate Storage**
- CTO: `cto/state/` and `cto/decisions/`
- Team Leads: `team_lead/roles/` and `team_lead/teams/`

### 4. **Communication via API**
- CTO → Team Lead: Via AgentExecutor
- Team Lead → CTO: Via completion reports

### 5. **No Direct Dependencies**
- CTO modules don't import team_lead
- team_lead files don't import CTO

---

## 📚 Documentation Links

- **CTO Architecture**: `agent-runner/docs/CTO_ARCHITECTURE.md`
- **CTO Control Guide**: `agent-runner/docs/CEO_CONTROL_GUIDE.md`
- **AI Models Guide**: `agent-runner/docs/AI_MODELS_GUIDE.md`
- **Team Leads Guide**: `agent-runner/docs/TEAM_LEADS_GUIDE.md` (TODO)

---

## 🎯 Summary

| Aspect | CTO (cto/) | Team Leads (team_lead/) |
|--------|-----------|---------------------------|
| **Role** | Intelligence & Strategy | Execution & Implementation |
| **Directory** | `agent-runner/cto/` | `agent-runner/team_lead/` |
| **State** | `cto/state/` | N/A (stateless) |
| **Logs** | `cto/decisions/` | N/A |
| **Decides** | Which/When/Who | N/A |
| **Executes** | Never | Always |
| **Imports** | No team_lead | No cto modules |
| **Tests** | `cto/__tests__/` | Integration tests |

---

**GOLDEN RULE**: If you're unsure whether something belongs to CTO or Team Leads, ask:
- **"Is this about DECIDING?"** → CTO
- **"Is this about DOING?"** → Team Lead

---

**Last Updated**: 2026-02-10
**Version**: 1.0.0
