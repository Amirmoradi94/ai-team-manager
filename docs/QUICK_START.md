# Quick Start Guide

## 🎯 What is AI Team Manager?

AI Team Manager is a sophisticated system for managing projects, teams, and AI employees with:
- **Hierarchical AI Decision Making**: CEO → CTO → Team Lead → Employees
- **590 Skills from skills.sh**: Comprehensive skill pool for AI employees
- **Context-Aware AI**: All AI agents read from ~/mycompany/ for decisions
- **Automatic Updates**: Changes cascade through all related entities

---

## 📖 Essential Reading (5 Minutes)

### 1. **Understand the System** (2 min)
Read: [System Architecture - Key Concepts section](./architecture/SYSTEM_ARCHITECTURE.md#core-entities--relationships)

**You'll learn:**
- The 8 core entities (CEO, CTO, Projects, Teams, Team Lead, Employees, Skills, Tasks)
- How they relate to each other
- Where data is stored

### 2. **Understand Skills** (2 min)
Read: [Skills System Guide - Overview](./guides/SKILLS_SYSTEM.md#skills-pool)

**You'll learn:**
- 590 skills available
- 5 categories (Technical, Creative, Strategic, Operational, AI & Agents)
- How skills are auto-suggested when hiring employees

### 3. **Understand Context** (1 min)
Read: [Context System Guide - Structure](./guides/CONTEXT_SYSTEM.md)

**You'll learn:**
- What ~/mycompany/ directory is for
- How AI agents use it for context
- What gets synchronized

---

## 🚀 Getting Started as Developer

### Prerequisites
```bash
# Install dependencies
cd task-manager && npm install
cd ../agent-runner && npm install
```

### 1. Start the Backend Server
```bash
cd task-manager/server
node index.js
# Server runs on http://localhost:3001
```

### 2. Start the Frontend
```bash
cd task-manager
npm run dev
# Frontend runs on http://localhost:5173
```

### 3. Start Agent Runner (Optional)
```bash
cd agent-runner
npm start
# Connects to backend, executes tasks
```

### 4. Access the Application
- Frontend: http://localhost:5173
- Login with your credentials
- Start creating projects, teams, and employees!

---

## 🏗️ Project Structure

```
ai-team-manager/
├── docs/                        # 📚 All documentation (you are here!)
├── task-manager/               # 🎨 Frontend + Backend
│   ├── src/                    # React frontend
│   ├── server/                 # Express backend + SQLite
│   └── server/taskmanager.db   # Database
│
├── agent-runner/               # 🤖 AI Agent Executor
│   ├── cto/                    # CTO Intelligence Engine
│   ├── skills/                 # 590 skills + docs
│   ├── context-manager.js      # Manages ~/mycompany/
│   └── agent-runner.js         # Main runner
│
└── ~/mycompany/                # 📁 Runtime Data (created after install)
    ├── organization/           # Company overview
    ├── cto/                    # CTO decisions & state
    ├── teams/                  # Team configurations
    ├── projects/               # Project data
    └── employees/              # Employee templates
```

---

## 💡 Common Tasks

### Create a New Employee
1. Go to Arsenal page
2. Click "Add Employee"
3. Select template or create custom
4. **AI automatically suggests skills** based on description
5. Review and hire

### Create a New Team
1. Go to Teams section
2. Click "Create Team"
3. Enter name and mission
4. Assign team lead (AI agent that orchestrates)
5. Assign employees to team

### Create a Project
1. Go to Projects section
2. Click "Create Project"
3. Enter details and repository path
4. Assign teams to project

### Create a Task
1. Go to project
2. Click "Add Task"
3. Enter details
4. **CTO automatically evaluates** the task
5. CTO assigns to appropriate team/employee

---

## 🔧 Making Code Changes

### Adding New Feature
1. **Read**: [Cascading Updates Implementation](./implementation/CASCADING_UPDATES_IMPLEMENTATION.md)
2. Make your changes
3. Add sync calls if entities change:
```javascript
contextSync.syncAfterXxxChange(action, id, data).catch(err =>
  logger.error('Context sync failed:', err)
);
```

### Adding New Endpoint
1. Add route in `task-manager/server/index.js`
2. Add sync call after DB changes
3. Test that mycompany/ files update

### Adding New Skill
1. Add to `agent-runner/skills/pool.json`
2. Optionally add documentation to `agent-runner/skills/documentation/`
3. Skill automatically available for assignment

---

## 🐛 Troubleshooting

### Frontend Error: "employees.map is not a function"
**Solution**: Restart backend server
```bash
cd task-manager/server
# Kill existing: lsof -ti:3001 | xargs kill -9
node index.js
```

### mycompany/ Not Created
**Solution**: Run sync manually
```bash
cd agent-runner
npm run sync-context
```

### Skills Not Suggesting
**Solution**: Check OpenAI API key in `.env`
```bash
# In task-manager/server/.env
OPENAI_API_KEY=your_key_here
```

### Context Not Updating
**Solution**: Trigger manual sync
```bash
cd agent-runner
npm run sync-context
```

---

## 📚 Deep Dive Topics

### Understanding CTO Intelligence
- **Read**: [System Architecture - CTO Section](./architecture/SYSTEM_ARCHITECTURE.md#2-cto-ai-agent)
- **Code**: `agent-runner/cto/CTOEngine.js`

**Key Concepts:**
- Task evaluation and routing
- Resource management
- Epic splitting
- Deferral logic
- Verification

### Understanding Team Leads
- **Read**: [System Architecture - Team Lead Section](./architecture/SYSTEM_ARCHITECTURE.md#5-team-lead-ai-agent)

**Key Concepts:**
- Orchestration of team employees
- Task delegation
- Result synthesis
- How team leads differ from regular employees

### Understanding Cascading Updates
- **Read**: [Cascading Updates](./architecture/CASCADING_UPDATES.md)
- **Implementation**: [Cascading Updates Implementation](./implementation/CASCADING_UPDATES_IMPLEMENTATION.md)

**Key Concepts:**
- What updates when entities change
- How sync is triggered
- Performance considerations

---

## 🎓 Learning Path

### Beginner (Day 1)
1. Read this Quick Start
2. Set up local environment
3. Create a test project, team, and employee
4. Assign a task and watch CTO handle it

### Intermediate (Week 1)
1. Read System Architecture
2. Understand the database schema
3. Explore mycompany/ directory
4. Read CTO and Team Lead code

### Advanced (Week 2+)
1. Read all implementation docs
2. Add new features
3. Implement missing sync calls
4. Optimize performance

---

## 🔗 Important Links

### Documentation
- [System Architecture](./architecture/SYSTEM_ARCHITECTURE.md) - **Most Important**
- [Cascading Updates](./architecture/CASCADING_UPDATES.md)
- [Skills System](./guides/SKILLS_SYSTEM.md)
- [Implementation Status](./implementation/CASCADING_UPDATES_IMPLEMENTATION.md)

### Code
- Frontend: `task-manager/src/`
- Backend: `task-manager/server/`
- Agent Runner: `agent-runner/`
- CTO Engine: `agent-runner/cto/`

### Key Files
- Database Schema: `task-manager/server/index.js` (search "CREATE TABLE")
- Context Manager: `agent-runner/context-manager.js`
- Skills Pool: `agent-runner/skills/pool.json`
- Employee Templates: `task-manager/src/data/employeeTemplates.ts`

---

## 💬 Need Help?

1. **Check the docs** - Most answers are in [System Architecture](./architecture/SYSTEM_ARCHITECTURE.md)
2. **Search the code** - Use grep/search to find examples
3. **Check implementation status** - See what's done vs todo
4. **Test locally** - Experiment in development environment

---

## ✅ Next Steps

After reading this guide:

1. ✅ Set up your local environment
2. ✅ Read [System Architecture](./architecture/SYSTEM_ARCHITECTURE.md)
3. ✅ Explore the application UI
4. ✅ Create test data (project, team, employee, task)
5. ✅ Watch how CTO makes decisions
6. ✅ Read the code to understand implementation
7. ✅ Start building!

---

**Welcome to AI Team Manager!** 🚀

**Last Updated**: 2026-02-12
