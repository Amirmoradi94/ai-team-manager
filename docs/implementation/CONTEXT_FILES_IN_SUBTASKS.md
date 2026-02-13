# Context File Paths in Subtask Descriptions

**Date**: 2026-02-12
**Status**: ✅ **IMPLEMENTED**

---

## Overview

CTO now includes **full file paths** to all relevant context files in every subtask description, ensuring Team Leads have complete information before starting implementation.

---

## What Changed

### Before:
```markdown
# Implement Authentication API

Build secure REST API for user authentication.

Requirements:
- JWT tokens
- Password hashing
- Rate limiting
```

**Problem**: Team Lead doesn't know where to find:
- Project requirements
- Team capabilities
- Available employees
- Existing code patterns
- Previous outputs

---

### After:
```markdown
# Implement Authentication API

## 📚 Required Context Files

**IMPORTANT**: Read these files before starting implementation.

### Company Organization
- `/Users/amirmoradi94/mycompany/organization/OVERVIEW.md`
- `/Users/amirmoradi94/mycompany/organization/EMPLOYEES.md`
- `/Users/amirmoradi94/mycompany/organization/TEAMS.md`

### Project Context
- `/Users/amirmoradi94/mycompany/projects/taskflow_platform/OVERVIEW.md`
- `/Users/amirmoradi94/mycompany/projects/taskflow_platform/TEAMS.md`
- `/Users/amirmoradi94/mycompany/projects/taskflow_platform/TASKS.md`

### Team Context
- `/Users/amirmoradi94/mycompany/teams/backend_team/OVERVIEW.md`
- `/Users/amirmoradi94/mycompany/teams/backend_team/MEMBERS.md`

### Previous Outputs
- Check `tasks/build-auth-system` from "Design Database Schema"

### Code Repository
- `/Users/amirmoradi94/Desktop/Projects/taskflow`

### CTO Intelligence
- `/Users/amirmoradi94/mycompany/cto/SYSTEM_PROMPT.md`
- `/Users/amirmoradi94/mycompany/cto/RESOURCE_STATE.md`
- `/Users/amirmoradi94/mycompany/cto/TASK_HISTORY.md`

## 📋 Pre-Implementation Checklist

1. [ ] Read Company Context
2. [ ] Review Project Requirements
3. [ ] Check Team Information
4. [ ] Review Available Employees
5. [ ] Check Previous Outputs
6. [ ] Examine Existing Code
7. [ ] Verify Requirements

**ONLY AFTER** completing checklist, begin implementation.
```

**Result**: Team Lead knows **exactly what to read** before coding.

---

## File Path Categories

### 1. Company Organization Files

**Purpose**: Understand overall company structure and objectives

**Files Included**:
- `~/mycompany/organization/OVERVIEW.md`
  - Company mission and vision
  - Organizational structure
  - Strategic goals

- `~/mycompany/organization/EMPLOYEES.md`
  - Complete roster of employees
  - Each employee's role and capabilities
  - Skills and specializations

- `~/mycompany/organization/TEAMS.md`
  - All teams in the company
  - Team missions and responsibilities
  - Team leadership

**Why Important**: Team Lead understands who can help and how work aligns with company goals.

---

### 2. Employees Directory

**Purpose**: Find specialists and understand their capabilities

**Files Included**:
- `~/mycompany/employees/INDEX.md`
  - Quick reference of all employees
  - Links to individual profiles

- `~/mycompany/employees/{employee_name}.md`
  - Detailed employee profile
  - Skills and expertise
  - Tools and frameworks they know
  - Past projects and experience

**Example**:
```
~/mycompany/employees/backend_developer_node_js.md
~/mycompany/employees/security_specialist.md
~/mycompany/employees/qa_engineer.md
```

**Why Important**: Team Lead knows which employees to consult for specific expertise.

---

### 3. Project Context Files

**Purpose**: Understand project scope, goals, and constraints

**Files Included** (only if task belongs to a project):
- `~/mycompany/projects/{project_name}/OVERVIEW.md`
  - Project description and objectives
  - Timeline and milestones
  - Success criteria
  - Constraints and requirements

- `~/mycompany/projects/{project_name}/TEAMS.md`
  - Teams assigned to this project
  - Each team's responsibilities
  - Contact information

- `~/mycompany/projects/{project_name}/TASKS.md`
  - All tasks in this project
  - Current progress
  - Dependencies between tasks

**Example**:
```
~/mycompany/projects/taskflow_platform/OVERVIEW.md
~/mycompany/projects/e_commerce_redesign/OVERVIEW.md
```

**Why Important**: Team Lead sees how their subtask fits into the larger project.

---

### 4. Team Context Files

**Purpose**: Understand team mission and member capabilities

**Files Included** (only if task assigned to a team):
- `~/mycompany/teams/{team_name}/OVERVIEW.md`
  - Team mission statement
  - Team structure
  - Working guidelines
  - Communication protocols

- `~/mycompany/teams/{team_name}/MEMBERS.md`
  - Team members and their roles
  - Individual responsibilities
  - Expertise areas

**Example**:
```
~/mycompany/teams/backend_team/OVERVIEW.md
~/mycompany/teams/frontend_team/OVERVIEW.md
~/mycompany/teams/devops_team/OVERVIEW.md
```

**Why Important**: Team Lead understands team conventions and can collaborate effectively.

---

### 5. Previous Subtask Outputs

**Purpose**: Understand dependencies and build on previous work

**Files Included** (only for subtask 2+):
- `tasks/{epic_name}/` directory
  - Outputs from previous subtasks
  - Code files
  - Documentation
  - Completion reports

**Example**:
```
tasks/build-auth-system/schema.sql
tasks/build-auth-system/user_model.js
tasks/build-auth-system/README.md
```

**Note**: Description mentions the previous subtask title for context.

**Why Important**: Team Lead doesn't duplicate work and understands dependencies.

---

### 6. Code Repository

**Purpose**: Find existing patterns and understand codebase structure

**Files Included** (only if project has a repository):
- Repository root directory path
- Suggestion to check README.md
- Suggestion to check CONTRIBUTING.md
- Instruction to find similar implementations

**Example**:
```
Repository: /Users/amirmoradi94/Desktop/Projects/taskflow
- Review existing code structure
- Check for similar implementations
- Look for README.md, CONTRIBUTING.md
```

**Why Important**: Team Lead follows existing patterns and code style.

---

### 7. CTO Intelligence

**Purpose**: Understand CTO decision-making and resource constraints

**Files Always Included**:
- `~/mycompany/cto/SYSTEM_PROMPT.md`
  - CTO's decision-making framework
  - Strategic priorities
  - Quality standards

- `~/mycompany/cto/RESOURCE_STATE.md`
  - Current API rate limits
  - Available resources
  - Cost constraints

- `~/mycompany/cto/TASK_HISTORY.md`
  - Historical task performance
  - Lessons learned
  - Best practices identified

**Why Important**: Team Lead understands constraints and strategic context.

---

## Implementation Details

### Code Location

**File**: `agent-runner/cto/CTOEngine.js`
**Method**: `splitTask(task, payload)`
**Lines**: ~350-450

### How It Works

```javascript
// Build paths dynamically based on task context
const companyDir = path.join(require('os').homedir(), 'mycompany');
const projectName = payload?.project?.name
  ? payload.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  : null;
const teamName = payload?.team?.name
  ? payload.team.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  : null;

// Include in description
const contract = `
## 📚 Required Context Files

### Company Organization
- \`${companyDir}/organization/OVERVIEW.md\`
- \`${companyDir}/organization/EMPLOYEES.md\`
- \`${companyDir}/organization/TEAMS.md\`

${projectName ? `
### Project Context
- \`${companyDir}/projects/${projectName}/OVERVIEW.md\`
- \`${companyDir}/projects/${projectName}/TEAMS.md\`
- \`${companyDir}/projects/${projectName}/TASKS.md\`
` : ''}

${teamName ? `
### Team Context
- \`${companyDir}/teams/${teamName}/OVERVIEW.md\`
- \`${companyDir}/teams/${teamName}/MEMBERS.md\`
` : ''}

...
`;
```

### Conditional Inclusion

File paths are **conditionally included** based on context:

| Context | Condition | Files Included |
|---------|-----------|----------------|
| Company | Always | OVERVIEW.md, EMPLOYEES.md, TEAMS.md |
| Project | If task.project_id exists | Project OVERVIEW, TEAMS, TASKS |
| Team | If task.team_id exists | Team OVERVIEW, MEMBERS |
| Previous Output | If subtask index > 0 | Previous subtask directory |
| Repository | If project.repository_path | Repository path |
| CTO | Always | SYSTEM_PROMPT, RESOURCE_STATE, TASK_HISTORY |

---

## Pre-Implementation Checklist

### Checklist Structure

Every subtask includes a **numbered checklist** that Team Lead must complete before coding:

```markdown
## 📋 Pre-Implementation Checklist

Before writing any code, complete these steps in order:

1. **[ ] Read Company Context**
   - `/path/to/organization/OVERVIEW.md`
   - Understand company goals and structure

2. **[ ] Review Project Requirements**
   - `/path/to/projects/PROJECT/OVERVIEW.md`
   - Understand project scope and constraints

3. **[ ] Check Team Information**
   - `/path/to/teams/TEAM/OVERVIEW.md`
   - Know your team's mission and capabilities

4. **[ ] Review Available Employees**
   - `/path/to/organization/EMPLOYEES.md`
   - Identify specialists who can help

5. **[ ] Check Previous Subtask Outputs**
   - Review files in `tasks/EPIC_NAME/`
   - Understand dependencies and context

6. **[ ] Examine Existing Codebase**
   - `/path/to/repository`
   - Find similar patterns or implementations

7. **[ ] Verify Implementation Requirements**
   - Re-read the "Implementation Guidelines" section above
   - Ensure you understand acceptance criteria

**ONLY AFTER** completing this checklist, begin implementation.
```

### Why Checklist?

1. **Forces preparation** - Can't skip to coding
2. **Ensures context** - All information considered
3. **Reduces errors** - Less likely to miss requirements
4. **Improves quality** - Better understanding leads to better code

---

## Team Lead Workflow

### Step 1: Receive Subtask
Team Lead picks up subtask from board and reads description.

### Step 2: Follow Checklist
Team Lead goes through checklist in order:

```bash
# 1. Read Company Context
cat ~/mycompany/organization/OVERVIEW.md

# 2. Review Project Requirements
cat ~/mycompany/projects/taskflow_platform/OVERVIEW.md

# 3. Check Team Information
cat ~/mycompany/teams/backend_team/OVERVIEW.md

# 4. Review Available Employees
cat ~/mycompany/organization/EMPLOYEES.md

# 5. Check Previous Outputs
ls tasks/build-auth-system/
cat tasks/build-auth-system/completion-report.md

# 6. Examine Existing Code
cd /Users/amirmoradi94/Desktop/Projects/taskflow
find . -name "*auth*"
cat src/middleware/auth.js

# 7. Verify Requirements
# Re-read implementation guidelines in description
```

### Step 3: Plan Implementation
With full context, Team Lead creates implementation plan.

### Step 4: Execute
Team Lead writes code, following patterns from context.

### Step 5: Verify
Team Lead checks acceptance criteria before submitting.

---

## Benefits

### ✅ No Context Searching

**Before**: Team Lead had to ask "Where are the requirements?" or search for files
**After**: All file paths explicitly provided

### ✅ Complete Context

**Before**: Team Lead might miss important information
**After**: Forced to read all relevant files via checklist

### ✅ Better Quality

**Before**: Implementation might not align with company/project/team standards
**After**: Team Lead follows established patterns and conventions

### ✅ Faster Execution

**Before**: Time wasted finding files and asking questions
**After**: Straight to implementation with full context

### ✅ Fewer Mistakes

**Before**: Missing dependencies or requirements
**After**: All dependencies explicitly listed

---

## Example Scenarios

### Scenario 1: Backend API Task

**Context**:
- Project: "E-commerce Platform"
- Team: "Backend Team"
- Subtask 3 of 5
- Has previous outputs

**Files Included**:
- ✅ Company organization (3 files)
- ✅ Project context (3 files)
- ✅ Team context (2 files)
- ✅ Previous outputs (directory)
- ✅ Code repository (path)
- ✅ CTO intelligence (3 files)
- ✅ Employee directory (index + profiles)

**Total**: ~15+ file references

---

### Scenario 2: Standalone Task

**Context**:
- No project assignment
- No team assignment
- Single task (not part of epic)

**Files Included**:
- ✅ Company organization (3 files)
- ✅ CTO intelligence (3 files)
- ✅ Employee directory (index + profiles)
- ❌ Project context (no project)
- ❌ Team context (no team)
- ❌ Previous outputs (not a subtask)
- ❌ Repository (no project)

**Total**: ~7 file references

---

### Scenario 3: First Subtask of Epic

**Context**:
- Project: "Mobile App"
- Team: "iOS Team"
- Subtask 1 of 4
- No previous outputs yet

**Files Included**:
- ✅ Company organization (3 files)
- ✅ Project context (3 files)
- ✅ Team context (2 files)
- ✅ Code repository (path)
- ✅ CTO intelligence (3 files)
- ✅ Employee directory (index + profiles)
- ❌ Previous outputs (first subtask)

**Total**: ~14 file references

---

## Testing

### How to Verify

1. **Create an epic task** with multiple subtasks
2. **Wait for CTO to split** the task
3. **Read a subtask description**:
   ```bash
   # Get subtask from database
   sqlite3 ~/Desktop/Projects/ai-team-manager/task-manager/server/taskmanager.db \
     "SELECT description FROM tasks WHERE task_type='subtask' LIMIT 1"
   ```
4. **Check for file paths**:
   - Should see `~/mycompany/organization/...`
   - Should see project paths if project assigned
   - Should see team paths if team assigned
   - Should see checklist with 7 steps

### Expected Output

```markdown
## 📚 Required Context Files

**IMPORTANT**: Read these files before starting...

### Company Organization
- `/Users/amirmoradi94/mycompany/organization/OVERVIEW.md` ✅
- `/Users/amirmoradi94/mycompany/organization/EMPLOYEES.md` ✅
- `/Users/amirmoradi94/mycompany/organization/TEAMS.md` ✅

### Project Context
- `/Users/amirmoradi94/mycompany/projects/PROJECT_NAME/...` ✅

### Team Context
- `/Users/amirmoradi94/mycompany/teams/TEAM_NAME/...` ✅

...more files...

## 📋 Pre-Implementation Checklist

1. [ ] Read Company Context ✅
2. [ ] Review Project Requirements ✅
...
```

---

## Summary

### What's New

✅ **All subtask descriptions now include**:
- Full paths to company organization files
- Full paths to project context files
- Full paths to team context files
- Full paths to employee profiles
- Full paths to previous subtask outputs
- Full paths to code repository
- Full paths to CTO intelligence files

✅ **Pre-implementation checklist**:
- 7-step ordered checklist
- Forces Team Lead to read context before coding
- Ensures no important files are missed

✅ **Contextual inclusion**:
- Only includes relevant file paths based on task context
- Skips project files if no project
- Skips team files if no team
- Skips previous outputs if first subtask

---

## Files Modified

- ✅ `agent-runner/cto/CTOEngine.js` - Enhanced subtask description generation
- ✅ `~/mycompany/cto/SYSTEM_PROMPT.md` - Updated to emphasize comprehensive descriptions
- ✅ `docs/implementation/SUBTASK_DESCRIPTION_EXAMPLE.md` - Complete example
- ✅ `docs/implementation/CONTEXT_FILES_IN_SUBTASKS.md` - This document

---

**Status**: ✅ Production Ready
**Last Updated**: 2026-02-12
**Services Restarted**: Required to apply changes
