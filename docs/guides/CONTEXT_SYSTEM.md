# Company Context System - Living Documentation

## 🎯 Overview

The **Company Context System** is a living documentation framework that automatically tracks and maintains markdown files for **everything** in your organization:

- **Organization**: All employees, AI agents, employees, and tools
- **Projects**: Project details, teams, members, tasks, and decisions
- **Teams**: Team composition, missions, skills, and activity history
- **Employees**: Individual AI agent profiles and capabilities
- **Knowledge**: Decisions, best practices, patterns, and lessons learned
- **CTO**: Resource management and strategic oversight

## 📁 Directory Structure

When the `agent-runner` package is installed, a **`mycompany/`** directory is automatically created at:

```
~/mycompany/
```

### Complete Structure

```
mycompany/
├── README.md                          # Overview of the context system
│
├── organization/                      # Company-wide context
│   ├── OVERVIEW.md                    # Company statistics
│   ├── EMPLOYEES.md                   # All human employees
│   ├── AI_AGENTS.md                   # All AI agents/employees
│   └── TOOLS.md                       # Company arsenal (MCP, APIs, scripts)
│
├── projects/                          # All projects
│   ├── INDEX.md                       # List of all projects
│   └── <project-name>/
│       ├── PROJECT.md                 # Project details
│       ├── TEAMS.md                   # Teams assigned to this project
│       ├── MEMBERS.md                 # Project members
│       ├── TASKS_HISTORY.md           # Completed tasks with reports
│       ├── DECISIONS.md               # Key decisions made
│       └── AI_ACTIVITY.md             # AI work log
│
├── teams/                             # All teams
│   ├── INDEX.md                       # List of all teams
│   └── <team-name>/
│       ├── TEAM.md                    # Team details & mission
│       ├── MEMBERS.md                 # Team members (human + AI)
│       ├── SPECIALISTS.md             # AI employees in this team
│       ├── SKILLS.md                  # Team skills & capabilities
│       ├── DECISIONS.md               # Team decisions
│       └── HISTORY.md                 # Team activity history
│
├── employees/                       # All employees
│   ├── INDEX.md                       # List of all employees
│   └── <employee-name>.md           # Individual employee profile
│
├── knowledge/                         # Collective intelligence
│   ├── DECISIONS_LOG.md               # Global decision log
│   ├── BEST_PRACTICES.md              # Learned best practices
│   ├── ARCHITECTURE_PATTERNS.md       # Architectural decisions
│   └── LESSONS_LEARNED.md             # Post-mortem insights
│
└── cto/                               # CTO strategic oversight
    ├── RESOURCE_STATE.md              # Current resource state
    ├── STRATEGIC_SUMMARY.md           # CTO strategic overview
    └── TASK_HISTORY.md                # Task execution history
```

## 🔄 How It Works

### 1. **Automatic Initialization**

When you install `agent-runner`:

```bash
npm install -g @ai-team/runner
```

The postinstall script automatically:
1. Creates the `~/mycompany/` directory structure
2. Initializes all README and index files
3. Sets up the foundation for living documentation

### 2. **Continuous Synchronization**

The agent-runner performs **three levels of sync**:

#### A. **Initial Sync** (on startup)
- Fetches all organizational data
- Creates/updates all markdown files
- Ensures context is current

#### B. **Periodic Sync** (every 2 minutes)
- Monitors database for changes
- Updates affected markdown files
- Keeps context fresh

#### C. **Event-Based Sync** (on specific actions)
- **Task Completion** → Updates `TASKS_HISTORY.md` and `AI_ACTIVITY.md`
- **Team Member Added** → Updates `MEMBERS.md` for that team
- **Decision Made** → Appends to `DECISIONS.md`
- **Employee Created** → Creates employee profile

### 3. **What Gets Tracked**

| Event | What Happens | Files Updated |
|-------|-------------|---------------|
| **Employee joins team** | Team membership updated | `teams/<team-name>/MEMBERS.md` |
| **Task completed** | Task logged with completion report | `projects/<project>/TASKS_HISTORY.md` |
| **Project created** | Project directory and files created | `projects/<project>/PROJECT.md` |
| **Team created** | Team directory and files created | `teams/<team-name>/TEAM.md` |
| **Employee added** | Employee profile created | `employees/<name>.md` |
| **Decision made** | Decision logged | `projects/<project>/DECISIONS.md` |
| **Tool added** | Tool catalog updated | `organization/TOOLS.md` |

## 🛠️ Usage

### Manual Context Sync

You can manually trigger a full sync anytime:

```bash
npm run sync-context
```

This will:
1. Fetch all data from the task-manager database
2. Rebuild all markdown files
3. Ensure everything is up to date

### Viewing Context

Simply navigate to the `mycompany` directory:

```bash
cd ~/mycompany
cat README.md
```

Or open it in your favorite markdown viewer/editor.

### Using Context in AI Prompts

The CTO Intelligence Layer automatically reads these files when making decisions. You can also reference them in custom prompts:

```
Read ~/mycompany/teams/frontend_team/TEAM.md to understand the team composition
```

## 🎨 Dynamic Updates - Examples

### Example 1: Adding an Employee to a Team

**Before:**
```markdown
# Team Members - Frontend Team

## Current Members

*No members assigned yet.*
```

**Action:** Assign "Sarah" to Frontend Team in UI

**After (auto-updated):**
```markdown
# Team Members - Frontend Team

## Current Members

### Sarah Johnson
- **Email**: sarah@company.com
- **Role**: Developer
- **Type**: Human
- **Joined**: 2026-02-11T10:30:00Z

## Total Members: 1
```

### Example 2: Task Completion

**Before:**
```markdown
# Task History - E-commerce Platform

## Completed Tasks

*No tasks completed yet.*
```

**Action:** AI completes "Add payment gateway"

**After (auto-updated):**
```markdown
# Task History - E-commerce Platform

## Completed Tasks

## Add payment gateway

- **Date**: 2026-02-11T14:22:00Z
- **Status**: for-review
- **Assigned To**: Frontend Team
- **Team**: frontend_team
- **Execution Time**: 45000ms
- **Model Used**: claude-opus-4.5

### Completion Report

Successfully integrated Stripe payment gateway:
- Added Stripe SDK
- Created checkout flow
- Implemented webhook handlers
- Added error handling and validation

_CTO: Passed on attempt 1/3 (score: 95)_

---
```

### Example 3: Decision Logging

You can programmatically log decisions:

```javascript
await contextManager.logDecision('e-commerce-platform', {
  title: 'Switch to TypeScript',
  context: 'Team discussed type safety concerns',
  decision: 'Migrate codebase to TypeScript over 2 sprints',
  rationale: 'Reduce runtime errors and improve developer experience',
  made_by: 'CTO'
});
```

Results in:
```markdown
## Switch to TypeScript

- **Date**: 2026-02-11T15:00:00Z
- **Context**: Team discussed type safety concerns
- **Decision**: Migrate codebase to TypeScript over 2 sprints
- **Rationale**: Reduce runtime errors and improve developer experience
- **Made By**: CTO

---
```

## 🧠 CTO Intelligence Integration

The CTO reads these files to make informed decisions:

1. **Resource Allocation**: Reads `RESOURCE_STATE.md` to check availability
2. **Task Splitting**: Reviews `TASK_HISTORY.md` to learn from past patterns
3. **Team Selection**: Checks `teams/*/TEAM.md` to assign appropriate teams
4. **Skill Matching**: Reviews `employees/` to find the right expertise
5. **Decision Context**: Reads `DECISIONS_LOG.md` to avoid repeating mistakes

## 🔧 Customization

### Change Base Directory

By default, `mycompany/` is created in the user's home directory. To change:

```javascript
const contextManager = new CompanyContextManager('/custom/path/mycompany');
```

### Add Custom Fields

The context manager is extensible. You can add custom sync methods:

```javascript
async updateCustomMetric(projectName, metric) {
  // Your custom logic
}
```

## 📊 Benefits

### For the CTO Intelligence Layer
- **Full Context**: Knows about all projects, teams, and members
- **Historical Patterns**: Learns from past successes and failures
- **Informed Decisions**: Makes better choices with complete information
- **Avoid Repetition**: Doesn't repeat past mistakes

### For Humans
- **Transparency**: See what AI agents are doing
- **Auditability**: Track all decisions and changes
- **Documentation**: Auto-generated, always up-to-date docs
- **Knowledge Base**: Organizational memory that never forgets

### For AI Agents
- **Situational Awareness**: Understand team structure and context
- **Skill Discovery**: Know what tools and employees are available
- **Continuity**: Pick up where others left off
- **Collaboration**: Coordinate with other agents effectively

## 🚀 Advanced Features

### Logging Patterns

The system automatically detects and logs:
- **Task patterns**: Similar tasks completed before
- **Success patterns**: What worked well
- **Failure patterns**: What to avoid
- **Resource patterns**: Which models work best for which tasks

### Team Dynamics

Tracks:
- Who works well together
- Which employees are most effective on which teams
- Team velocity and success rates
- Skill gaps and opportunities

### Knowledge Accumulation

Over time, the system builds:
- **Best Practices**: From successful task completions
- **Anti-Patterns**: From failed attempts
- **Architecture Decisions**: Why things were built certain ways
- **Lessons Learned**: What to do differently next time

## 🔒 Security & Privacy

- **Local Storage**: All context files are stored locally at `~/mycompany/`
- **No Cloud**: Nothing is sent to external services
- **Version Control**: You can `.gitignore` sensitive parts
- **Access Control**: Only accessible to the user running agent-runner

## 📝 Example Workflow

1. **Install agent-runner**: `npm install -g @ai-team/runner`
2. **Context initialized**: `~/mycompany/` created automatically
3. **Connect runner**: `agent-runner connect -t <token>`
4. **Initial sync**: All data fetched and files created
5. **Create project**: Project folder appears in `mycompany/projects/`
6. **Add team**: Team folder appears in `mycompany/teams/`
7. **Complete task**: Task logged in `TASKS_HISTORY.md`
8. **CTO learns**: Future decisions informed by history

## 🎯 Next Steps

1. **Install the package**: Get `agent-runner` set up
2. **Check the context**: Navigate to `~/mycompany/` and explore
3. **Watch it evolve**: See files update as you use the system
4. **Reference in prompts**: Use context files in your AI interactions
5. **Customize**: Extend with your own tracking needs

---

## 🤝 Integration Points

### In agent-runner.js
```javascript
// Context manager initialized
this.contextManager = new CompanyContextManager();

// Synced every 2 minutes
setInterval(() => this.syncCompanyContext(), 2 * 60 * 1000);

// Task completion logged
await this.contextManager.logTaskCompletion(projectName, task, report);
```

### In task-manager API
```javascript
// Endpoints available for data fetching
GET /api/users              // All users
GET /api/employees        // All employees
GET /api/teams              // All teams
GET /api/projects           // All projects
GET /api/tools              // All tools
```

### Manual Sync Script
```bash
npm run sync-context
```

---

**The Company Context System ensures your CTO Intelligence Layer has complete, current awareness of your entire organization - automatically, always.**
