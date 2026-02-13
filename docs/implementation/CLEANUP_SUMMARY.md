# Agent-Runner Cleanup Summary

## Goal
Separate CODE (in agent-runner package) from DATA (in mycompany directory)

## Before Cleanup

```
agent-runner/ (npm package)
├── cto/
│   ├── CTOEngine.js           ✅ CODE
│   ├── ResourceManager.js      ✅ CODE
│   ├── state/                 ❌ DATA (runtime state)
│   │   ├── RESOURCE_STATE.md
│   │   ├── STRATEGIC_SUMMARY.json
│   │   └── TASK_HISTORY.md
│   └── decisions/             ❌ DATA (CTO decisions)
│
└── team_lead/                 ❌ DATA (team configurations)
    ├── roles/
    ├── teams/
    ├── skills/
    └── product_manager/
```

## After Cleanup

### agent-runner/ (npm package) - CODE ONLY ✅
```
agent-runner/
├── bin/                       # CLI scripts
├── cto/                       # CTO Intelligence Engine (CODE)
│   ├── CTOEngine.js
│   ├── ResourceManager.js
│   ├── AIDecisionEngine.js
│   ├── ModelSelector.js
│   ├── ProviderIntelligence.js
│   ├── TaskHistoryManager.js
│   └── index.js
├── docs/                      # Documentation
├── scripts/                   # Setup scripts
├── agent-runner.js            # Main runner
├── agent-executor.js          # Task executor
├── context-manager.js         # Manages mycompany/
├── package.json
└── config.json
```

### mycompany/ (created after install) - DATA ONLY ✅
```
mycompany/
├── cto/                       # CTO runtime data
│   ├── decisions/
│   │   └── README.md
│   ├── RESOURCE_STATE.md      # Current resource status
│   ├── STRATEGIC_SUMMARY.json # Strategic decisions
│   └── TASK_HISTORY.md        # Task history
│
├── teams/                     # All team data
│   ├── INDEX.md
│   └── digital_marketing/
│       ├── TEAM.md
│       ├── LEAD.md
│       ├── MEMBERS.md
│       └── SKILLS.md
│
├── organization/              # Company overview
│   ├── OVERVIEW.md
│   ├── EMPLOYEES.md
│   └── TOOLS.md
│
├── projects/                  # Project data
│   ├── INDEX.md
│   └── beeblue_marketing/
│
├── employees/                 # Employee templates
│   ├── frontend_developer.md
│   ├── backend_developer.md
│   └── ... (63 templates)
│
└── knowledge/                 # Shared knowledge base
```

## Changes Made

### 1. ✅ Removed Data from agent-runner
- ❌ Deleted `agent-runner/cto/state/`
- ❌ Deleted `agent-runner/cto/decisions/`
- ❌ Deleted `agent-runner/cto/__tests__/`
- ❌ Deleted `agent-runner/team_lead/` (entire directory)

### 2. ✅ Moved Data to mycompany
- ✅ Moved CTO state files → `mycompany/cto/`
- ✅ Created `mycompany/cto/decisions/` directory
- ✅ Team data already managed by context-manager → `mycompany/teams/`

### 3. ✅ Clean Structure
**agent-runner/** now contains ONLY:
- JavaScript code files
- Configuration
- Documentation
- Scripts

**mycompany/** now contains ALL:
- Runtime state
- Decisions
- Team configurations
- Project data
- Employee profiles

## Benefits

1. **Clear Separation**: Code vs Data
2. **Portable Package**: agent-runner contains no runtime data
3. **User Data Isolated**: All user/runtime data in mycompany/
4. **Git Clean**: No runtime data files in version control
5. **Multiple Installations**: Users can have multiple mycompany directories

## Next Steps

The code currently has references to old paths (`team_lead/`, `cto/state/`). These need to be updated to use `mycompany/` paths. This is handled by context-manager.js which already syncs everything to mycompany/.

The old `syncRunnerBrain()` function in agent-executor.js is now redundant since context-manager handles all syncing.

## Architecture

```
User's Computer
├── ~/.npm-global/lib/node_modules/@ai-team/runner/  # CODE
│   └── (clean package, no runtime data)
│
└── ~/mycompany/                                      # DATA
    └── (all runtime data, decisions, teams, etc.)
```

---

**Status**: ✅ Cleanup Complete
**Date**: 2026-02-12
