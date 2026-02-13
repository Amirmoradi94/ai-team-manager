# AI Team Manager - Complete System Architecture & Relationships

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

                            ┌─────────────────┐
                            │   CEO (Human)   │
                            │  - Creates      │
                            │  - Oversees All │
                            └────────┬────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
            ┌───────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐
            │   PROJECTS   │  │    CTO     │  │   TEAMS    │
            │              │  │ (AI Agent) │  │            │
            └───────┬──────┘  └─────┬──────┘  └─────┬──────┘
                    │               │               │
                    │         Orchestrates      Leads│
                    │               │               │
         ┌──────────┼───────────────┼───────────────┼──────────┐
         │          │               │               │          │
    ┌────▼────┐┌───▼────┐     ┌────▼────┐     ┌───▼────┐┌───▼────┐
    │  TASKS  ││ TEAMS  │     │  TASKS  │     │TEAM_LEAD││EMPLOYEES│
    │         ││        │     │         │     │(AI Agent)││        │
    └────┬────┘└───┬────┘     └────┬────┘     └───┬────┘└───┬────┘
         │         │               │               │         │
    Assigned   Contains        Evaluates      Delegates   Have │
         │         │               │               │         │
         │    ┌────▼────┐          │          ┌────▼────┐    │
         │    │EMPLOYEES│          │          │EMPLOYEES│    │
         │    │         │          │          │(Sub-    │    │
         │    └────┬────┘          │          │Agents)  │    │
         │         │               │          └────┬────┘    │
         │         │               │               │         │
         │    ┌────▼────┐     ┌────▼────┐     ┌───▼────┐┌───▼────┐
         │    │ SKILLS  │     │RESOURCE │     │ SKILLS ││ SKILLS │
         └────►         │     │MANAGER  │     │        ││        │
              └─────────┘     └─────────┘     └────────┘└────────┘
```

## Core Entities & Relationships

### 1. **CEO (Human User)**
**Table**: `users` with `role = 'admin'` or `role = 'ceo'`

**Responsibilities**:
- Creates and manages projects
- Creates and manages teams
- Hires employees (AI agents)
- Assigns CTO to oversee operations
- Has full system access

**Relationships**:
- Creates → Projects (`projects.created_by → users.id`)
- Creates → Teams (indirectly)
- Hires → Employees (`specialists` table)
- Oversees → CTO

---

### 2. **CTO (AI Agent)**
**Table**: `users` with `role = 'cto'` and `is_ai = 1`

**Key Fields**:
```sql
- system_prompt: CTO's instructions and decision-making framework
- model_config: {"provider": "claude", "model": "claude-opus-4.6"}
- cto_resource_status: Current resource availability
```

**Responsibilities**:
- **Task Evaluation**: Analyzes incoming tasks for complexity
- **Epic Splitting**: Breaks down large tasks into subtasks
- **Resource Management**: Monitors API rate limits, costs
- **Task Assignment**: Decides which team/employee handles tasks
- **Deferral Logic**: Delays tasks when resources are constrained
- **Verification**: Validates task completion
- **Escalation**: Escalates to CEO after max retries (2)

**Decision Files** (stored in `~/mycompany/cto/`):
- `RESOURCE_STATE.md`: Current API usage, rate limits
- `STRATEGIC_SUMMARY.json`: High-level decisions
- `TASK_HISTORY.md`: Task assignment history
- `decisions/`: Individual decision logs

**Relationships**:
- Evaluates → Tasks (all incoming tasks)
- Assigns → Teams
- Assigns → Employees
- Monitors → Resources (via ResourceManager)
- Reports to → CEO

**Code Location**: `agent-runner/cto/CTOEngine.js`

---

### 3. **Projects**
**Table**: `projects`

**Key Fields**:
```sql
- id: Unique identifier
- name: Project name
- repository_path: Local code path
- global_rules: Project-specific constraints
- runner_token: Authentication for agent-runner
```

**Purpose**: Logical grouping of work, code repositories

**Relationships**:
- Created by → CEO (`projects.created_by → users.id`)
- Contains → Tasks (`tasks.project_id → projects.id`)
- Has → Teams (`teams.project_id → projects.id`)
- Has → Members (`project_members` join table → `users`)

**Example**:
```
Project: "beeblue marketing"
├── Repository: /Desktop/beeblue-marketing
├── Team: Digital Marketing team
└── Tasks: SEO optimization, content creation, etc.
```

---

### 4. **Teams**
**Table**: `teams`

**Key Fields**:
```sql
- id: Unique identifier
- name: Team name (e.g., "digital marketing")
- mission_statement: Team's purpose
- project_id: Associated project (optional)
- human_in_the_loop: Requires human approval?
```

**Purpose**: Organize employees by domain expertise

**Relationships**:
- Belongs to → Project (optional) (`teams.project_id → projects.id`)
- Has → Team Lead (1 AI agent) (`users.team_id → teams.id` + `is_team_lead = 1`)
- Has → Employees (many) (`team_specialists` join table)
- Receives → Tasks from CTO (`tasks.team_id → teams.id`)

**Team Lead**: Special AI agent that orchestrates the team
- Stored in: `users` table with `is_team_lead = 1`
- Has: `system_prompt` defining orchestration logic
- Delegates to: Team employees (sub-agents)

**Example**:
```
Team: "Digital Marketing"
├── Mission: "Business Growth Strategy"
├── Team Lead: Marketing Team Lead (AI)
├── Employees:
│   ├── SEO Specialist
│   ├── Content Marketing Specialist
│   ├── Growth Hacker
│   └── Market Research Analyst
└── Tasks: Assigned by CTO
```

**Team Data** (stored in `~/mycompany/teams/{team_name}/`):
- `TEAM.md`: Team overview, mission, members
- `LEAD.md`: Team lead configuration
- `MEMBERS.md`: Team member list
- `SKILLS.md`: Collective team skills
- `DECISIONS.md`: Team-level decisions
- `HISTORY.md`: Team activity log

---

### 5. **Team Lead (AI Agent)**
**Table**: `users` with `is_team_lead = 1` and `is_ai = 1`

**Key Fields**:
```sql
- system_prompt: Orchestration instructions
- model_config: AI model settings
- team_id: Which team they lead
```

**Responsibilities**:
- **Receives** tasks from CTO assigned to their team
- **Analyzes** task requirements
- **Delegates** to appropriate team employees (sub-agents)
- **Coordinates** multiple employees for complex tasks
- **Synthesizes** results from employees
- **Reports** completion back to CTO

**Orchestration Flow**:
```
1. CTO assigns task → Team Lead
2. Team Lead reads task requirements
3. Team Lead selects appropriate employees:
   - SEO task → SEO Specialist
   - Content task → Content Specialist
   - Complex task → Multiple specialists
4. Team Lead calls sub-agents (employees)
5. Team Lead reviews outputs
6. Team Lead delivers integrated result
```

**Example**:
```
Team Lead: "Marketing Team Lead"
├── Model: Claude Opus 4.6
├── Team: Digital Marketing
├── Receives: "Create marketing campaign" from CTO
├── Delegates to:
│   ├── Market Research Analyst (research target audience)
│   ├── Content Specialist (create content)
│   └── SEO Specialist (optimize for search)
└── Delivers: Complete integrated campaign
```

**Code Location**: Runs via `agent-runner.js` when assigned tasks

---

### 6. **Employees (AI Specialists)**
**Table**: `specialists`

**Key Fields**:
```sql
- id: Unique identifier
- name: Employee name
- description: Role description
- system_prompt: Detailed instructions
- tools: JSON array of skill IDs
```

**Two Types**:

#### A) **Employee Templates** (Pool of 63)
- Stored in: `task-manager/src/data/employeeTemplates.ts`
- Categories: Planning, Building, Marketing, Sales, Operations
- Purpose: Reusable profiles for hiring
- Examples:
  - Frontend Developer
  - Backend Developer
  - SEO Specialist
  - Content Marketing Specialist
  - UI/UX Designer

#### B) **Hired Employees** (Active Instances)
- Stored in: `specialists` table
- Created from templates or custom
- Assigned to: Teams (via `team_specialists`)
- Have: Skills (via `specialist_tools`)

**Relationships**:
- Created by → CEO
- Assigned to → Teams (`team_specialists` join table)
- Called by → Team Lead (as sub-agents)
- Have → Skills (`specialist_tools` join table)
- Execute → Tasks (assigned by team lead)

**Example**:
```
Employee: "SEO Specialist"
├── Type: Template → Hired Instance
├── Team: Digital Marketing
├── Skills: [seo-audit, schema-markup, programmatic-seo]
├── System Prompt: "You are an SEO expert..."
└── Called by: Marketing Team Lead when SEO tasks arise
```

**Employee Data** (stored in `~/mycompany/employees/`):
- Individual `.md` files for each template
- Contains: Full system prompt, skills, guidelines

---

### 7. **Skills**
**Source**: `agent-runner/skills/pool.json` (590 skills from skills.sh)

**Structure**:
```json
{
  "id": "seo-audit",
  "label": "SEO Audit",
  "category": "Strategic",
  "description": "Optimize website for search engines..."
}
```

**Categories**:
- **Technical** (~200): React, TypeScript, Node.js, databases
- **Creative** (~150): UI/UX design, copywriting, graphics
- **Strategic** (~100): SEO, growth hacking, market research
- **Operational** (~100): Project management, analytics
- **AI & Agents** (~40): Brainstorming, debugging, testing

**Relationships**:
- Stored in → `tools` table (database)
- Assigned to → Employees (`specialist_tools` join table)
- Suggested by → OpenAI (when hiring employees)
- Used by → Employees (when executing tasks)

**Documentation** (stored in `agent-runner/skills/documentation/`):
- 98 `.md` files with detailed skill documentation
- Used by: CTO, Team Leads, Employees for reference

**Skill Assignment Flow**:
```
1. CEO creates new employee from template
2. OpenAI analyzes employee description
3. OpenAI suggests 5-8 relevant skills from 590-skill pool
4. Skills auto-selected in UI
5. CEO reviews and adjusts
6. Employee hired with selected skills
```

---

### 8. **Tasks**
**Table**: `tasks`

**Key Fields**:
```sql
- id: Unique identifier
- title, description: Task details
- status: pending/in_progress/completed/failed
- project_id: Which project
- team_id: Assigned team
- agent_id: Assigned employee
- assignee_id: Assigned user
- parent_id: For subtasks
- task_type: task/epic/subtask
- completion_report: Result documentation
- resource_metadata: CTO decision metadata
```

**Task Lifecycle**:
```
1. Created → CEO creates task in project
2. Evaluated → CTO analyzes complexity
   ├─ Simple task → Assign directly
   └─ Epic → Split into subtasks
3. Assigned → CTO assigns to team or employee
4. Executed → Team lead delegates to employees
5. Verified → CTO checks completion report
6. Completed → Marked as done
   └─ Failed → Retry (max 2) → Escalate to CEO
```

**Task Types**:
- **Task**: Regular task
- **Epic**: Large task that needs splitting
- **Subtask**: Part of an epic

**Relationships**:
- Belongs to → Project (`tasks.project_id`)
- Assigned to → Team (`tasks.team_id`)
- Assigned to → Employee/Agent (`tasks.agent_id`)
- Evaluated by → CTO
- Executed by → Team Lead → Employees
- Has → Subtasks (`tasks.parent_id`)

---

## Complete Workflow Example

### Scenario: "Create SEO-optimized blog post"

```
1. CEO creates task:
   ├─ Project: "beeblue marketing"
   ├─ Title: "Write blog post about product features"
   └─ Priority: High

2. CTO receives task:
   ├─ Evaluates: Medium complexity
   ├─ Checks resources: API limits OK
   ├─ Decision: Assign to Digital Marketing team
   └─ Updates: RESOURCE_STATE.md, TASK_HISTORY.md

3. Task assigned to team:
   ├─ Team: Digital Marketing
   └─ Team Lead: Marketing Team Lead (AI)

4. Team Lead receives task:
   ├─ Analyzes: Needs SEO + content writing
   ├─ Delegates to employees:
   │   ├─ SEO Specialist: "Research keywords and SEO strategy"
   │   └─ Content Specialist: "Write engaging blog post"
   └─ Both employees execute in parallel

5. SEO Specialist executes:
   ├─ Uses skills: [seo-audit, schema-markup]
   ├─ Reads: agent-runner/skills/documentation/seo-audit.md
   ├─ Produces: Keyword research, meta tags
   └─ Returns results to Team Lead

6. Content Specialist executes:
   ├─ Uses skills: [copywriting, content-strategy]
   ├─ Reads skill documentation
   ├─ Produces: Blog post draft
   └─ Returns results to Team Lead

7. Team Lead synthesizes:
   ├─ Combines: SEO keywords + content
   ├─ Creates: Final SEO-optimized blog post
   └─ Generates: Completion report

8. CTO verifies:
   ├─ Reads: Completion report
   ├─ Validates: Task completed successfully
   └─ Marks: Task as completed

9. CEO reviews:
   └─ Sees completed task in dashboard
```

---

## Data Storage Locations

### Database (SQLite)
**Location**: `task-manager/server/taskmanager.db`

**Tables**:
- `users`: CEO, CTO, Team Leads, Human members
- `specialists`: Hired employees (AI)
- `teams`: Team configurations
- `projects`: Project definitions
- `tasks`: All tasks and subtasks
- `tools`: Skills pool
- `team_specialists`: Team ↔ Employee mapping
- `specialist_tools`: Employee ↔ Skills mapping
- `project_members`: Project ↔ User mapping
- `project_teams`: Project ↔ Team mapping

### File System (~/mycompany/)
**Location**: `/Users/amirmoradi94/mycompany/`

**Structure**:
```
mycompany/
├── organization/
│   ├── OVERVIEW.md         # Company overview
│   ├── EMPLOYEES.md        # All employees (human + AI)
│   └── TOOLS.md            # Available tools/skills
│
├── cto/
│   ├── RESOURCE_STATE.md   # Current resource status
│   ├── STRATEGIC_SUMMARY.json
│   ├── TASK_HISTORY.md     # Task assignment history
│   └── decisions/          # Individual decisions
│
├── teams/
│   ├── INDEX.md
│   └── {team_name}/
│       ├── TEAM.md         # Team overview
│       ├── LEAD.md         # Team lead config
│       ├── MEMBERS.md      # Team members
│       ├── SKILLS.md       # Team skills
│       ├── DECISIONS.md    # Team decisions
│       └── HISTORY.md      # Activity log
│
├── projects/
│   ├── INDEX.md
│   └── {project_name}/
│       ├── PROJECT.md      # Project details
│       ├── TEAMS.md        # Assigned teams
│       ├── MEMBERS.md      # Project members
│       └── TASKS_HISTORY.md
│
├── employees/
│   ├── frontend_developer.md
│   ├── seo_specialist.md
│   └── ... (63 templates)
│
└── knowledge/
    └── # Shared knowledge base
```

### Code (agent-runner package)
**Location**: `agent-runner/`

**Structure**:
```
agent-runner/
├── cto/                    # CTO Intelligence Engine (CODE)
│   ├── CTOEngine.js
│   ├── ResourceManager.js
│   ├── AIDecisionEngine.js
│   └── ...
│
├── skills/                 # Skills Pool (DATA)
│   ├── pool.json           # 590 skills metadata
│   └── documentation/      # 98 skill .md files
│
├── agent-runner.js         # Main runner
├── agent-executor.js       # Task executor
└── context-manager.js      # Manages mycompany/
```

---

## Key Design Patterns

### 1. **Hierarchical Decision Making**
```
CEO (Strategy)
  ↓
CTO (Resource Management + Task Routing)
  ↓
Team Lead (Task Delegation + Coordination)
  ↓
Employees (Task Execution)
```

### 2. **Separation of Concerns**
- **CEO**: Business strategy, high-level decisions
- **CTO**: Resource optimization, intelligent routing
- **Team Lead**: Domain orchestration, employee coordination
- **Employees**: Specialized execution

### 3. **Code vs Data Separation**
- **CODE**: agent-runner package (engines, logic)
- **DATA**: mycompany directory (decisions, state)

### 4. **Skill-Based Architecture**
- Employees defined by skills (not hardcoded abilities)
- Skills are reusable, composable
- New skills can be added without code changes

### 5. **Context-Aware AI**
- All AI agents read from mycompany/ for context
- Decisions logged for transparency
- History informs future decisions

---

## Integration Points

### 1. **Frontend (task-manager UI)**
- Displays: Projects, Teams, Employees, Tasks
- Creates: New entities via API
- Shows: Real-time status, CTO decisions

### 2. **Backend (task-manager server)**
- Stores: All entities in SQLite
- Provides: REST API for CRUD operations
- Authenticates: Users and runners

### 3. **Agent Runner**
- Polls: Backend for new tasks
- Executes: Tasks via Claude/Gemini/Codex
- Syncs: Context to mycompany/
- Reports: Completion back to backend

### 4. **CTO Engine**
- Intercepts: All tasks before execution
- Evaluates: Resource constraints
- Routes: Tasks to optimal handlers
- Monitors: System health

---

## Scaling Considerations

### Adding New Employees
1. Create template in `employeeTemplates.ts`
2. Define skills from 590-skill pool
3. Write system prompt
4. CEO hires from template
5. Assign to team
6. Employee ready for tasks

### Adding New Teams
1. CEO creates team with mission
2. Create team lead with orchestration prompt
3. Assign employees to team
4. Configure team skills
5. CTO routes tasks to team

### Adding New Skills
1. Add to `agent-runner/skills/pool.json`
2. Optionally add documentation `.md` file
3. Skills available for employee assignment
4. OpenAI automatically suggests for new hires

---

**Last Updated**: 2026-02-12
**System Version**: 1.0
