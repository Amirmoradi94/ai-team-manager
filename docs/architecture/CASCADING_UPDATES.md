# Cascading Updates System

This document defines all automatic updates that should occur when entities change.

## Update Matrix

### 1. PROJECT Changes

#### When Project is **CREATED**:
- ✅ Create `mycompany/projects/{project}/` directory
- ✅ Generate `PROJECT.md`
- ✅ Update `mycompany/projects/INDEX.md`
- ✅ Update `mycompany/organization/OVERVIEW.md` (project count)

#### When Project is **UPDATED**:
- ✅ Update `mycompany/projects/{project}/PROJECT.md`
- ✅ Update `mycompany/projects/INDEX.md`
- ✅ If name changed: Rename directory
- ✅ If teams added: Update `TEAMS.md`

#### When Project is **DELETED**:
- ✅ Remove `mycompany/projects/{project}/` directory
- ✅ Update `mycompany/projects/INDEX.md`
- ✅ Update `mycompany/organization/OVERVIEW.md`
- ✅ Set `tasks.project_id = NULL` for all tasks
- ✅ Set `teams.project_id = NULL` for all teams

---

### 2. TEAM Changes

#### When Team is **CREATED**:
- ✅ Create `mycompany/teams/{team}/` directory
- ✅ Generate `TEAM.md`
- ✅ Generate `LEAD.md` (if team lead assigned)
- ✅ Generate `MEMBERS.md`
- ✅ Generate `SKILLS.md`
- ✅ Generate `DECISIONS.md`
- ✅ Generate `HISTORY.md`
- ✅ Update `mycompany/teams/INDEX.md`
- ✅ Update `mycompany/organization/OVERVIEW.md` (team count)
- ✅ If in project: Update project's `TEAMS.md`

#### When Team is **UPDATED**:
- ✅ Update `mycompany/teams/{team}/TEAM.md`
- ✅ Update `mycompany/teams/INDEX.md`
- ✅ If name changed: Rename directory
- ✅ If mission changed: Update `TEAM.md`
- ✅ If project changed:
  - Update old project's `TEAMS.md`
  - Update new project's `TEAMS.md`
  - Update team's `TEAM.md`

#### When Team is **DELETED**:
- ✅ Remove `mycompany/teams/{team}/` directory
- ✅ Update `mycompany/teams/INDEX.md`
- ✅ Update `mycompany/organization/OVERVIEW.md`
- ✅ If in project: Update project's `TEAMS.md`
- ✅ Set `users.team_id = NULL` for team lead
- ✅ Delete rows from `team_specialists`
- ✅ Set `tasks.team_id = NULL` for all tasks

---

### 3. TEAM LEAD Changes

#### When Team Lead is **ASSIGNED**:
- ✅ Update `users.team_id` and `users.is_team_lead = 1`
- ✅ Create/Update `mycompany/teams/{team}/LEAD.md`
- ✅ Update `mycompany/teams/{team}/TEAM.md`
- ✅ Update `mycompany/organization/EMPLOYEES.md`

#### When Team Lead is **CHANGED**:
- ✅ Set old lead's `is_team_lead = 0`
- ✅ Set new lead's `is_team_lead = 1` and `team_id`
- ✅ Update `mycompany/teams/{team}/LEAD.md`
- ✅ Update `mycompany/teams/{team}/TEAM.md`
- ✅ Update `mycompany/organization/EMPLOYEES.md`

#### When Team Lead is **REMOVED**:
- ✅ Set `is_team_lead = 0` and `team_id = NULL`
- ✅ Delete `mycompany/teams/{team}/LEAD.md`
- ✅ Update `mycompany/teams/{team}/TEAM.md`
- ✅ Update `mycompany/organization/EMPLOYEES.md`

---

### 4. EMPLOYEE Changes

#### When Employee is **HIRED** (Created):
- ✅ Insert into `specialists` table
- ✅ Create employee profile in `mycompany/employees/{employee}.md`
- ✅ Update `mycompany/organization/EMPLOYEES.md`
- ✅ Update `mycompany/organization/OVERVIEW.md` (employee count)

#### When Employee is **ASSIGNED TO TEAM**:
- ✅ Insert into `team_specialists` table
- ✅ Update `mycompany/teams/{team}/MEMBERS.md`
- ✅ Update `mycompany/teams/{team}/SKILLS.md` (add employee's skills)
- ✅ Update `mycompany/teams/{team}/TEAM.md`
- ✅ Update employee's profile

#### When Employee is **REMOVED FROM TEAM**:
- ✅ Delete from `team_specialists` table
- ✅ Update `mycompany/teams/{team}/MEMBERS.md`
- ✅ Update `mycompany/teams/{team}/SKILLS.md` (remove employee's skills)
- ✅ Update `mycompany/teams/{team}/TEAM.md`
- ✅ Update employee's profile

#### When Employee is **UPDATED** (skills/prompt changed):
- ✅ Update `specialists` table
- ✅ Update employee profile in `mycompany/employees/{employee}.md`
- ✅ If in team: Update team's `SKILLS.md`

#### When Employee is **DELETED**:
- ✅ Delete from `specialists` table (cascade to `team_specialists`, `specialist_tools`)
- ✅ Remove from `mycompany/employees/{employee}.md`
- ✅ Update `mycompany/organization/EMPLOYEES.md`
- ✅ Update `mycompany/organization/OVERVIEW.md`
- ✅ If in teams: Update all team `MEMBERS.md` and `SKILLS.md`
- ✅ Set `tasks.agent_id = NULL` for assigned tasks

---

### 5. SKILLS Changes

#### When Skill is **ASSIGNED TO EMPLOYEE**:
- ✅ Insert into `specialist_tools` table
- ✅ Update employee's `tools` field in `specialists`
- ✅ Update employee profile
- ✅ If in team: Update team's `SKILLS.md`

#### When Skill is **REMOVED FROM EMPLOYEE**:
- ✅ Delete from `specialist_tools` table
- ✅ Update employee's `tools` field
- ✅ Update employee profile
- ✅ If in team: Update team's `SKILLS.md`

---

### 6. TASK Changes

#### When Task is **CREATED**:
- ✅ Insert into `tasks` table
- ✅ Update project's `TASKS_HISTORY.md`
- ✅ Log to `mycompany/cto/TASK_HISTORY.md`

#### When Task is **ASSIGNED TO TEAM**:
- ✅ Set `tasks.team_id`
- ✅ Update team's `HISTORY.md`
- ✅ Update `mycompany/cto/TASK_HISTORY.md`
- ✅ Update CTO's `RESOURCE_STATE.md`

#### When Task is **ASSIGNED TO EMPLOYEE**:
- ✅ Set `tasks.agent_id`
- ✅ Update employee's task history
- ✅ Update team's `HISTORY.md`
- ✅ Update `mycompany/cto/TASK_HISTORY.md`

#### When Task STATUS CHANGES:
- ✅ Update `tasks.status`
- ✅ If completed: Update `completion_report`
- ✅ Update project's `TASKS_HISTORY.md`
- ✅ Update team's `HISTORY.md` (if assigned to team)
- ✅ Update `mycompany/cto/TASK_HISTORY.md`
- ✅ If failed: Update CTO's decision log

#### When Task is **DELETED**:
- ✅ Delete from `tasks` table (cascade to comments)
- ✅ Update project's `TASKS_HISTORY.md`
- ✅ If has subtasks: Delete all subtasks

---

### 7. CTO DECISIONS

#### When CTO **EVALUATES TASK**:
- ✅ Update `mycompany/cto/TASK_HISTORY.md`
- ✅ Update `mycompany/cto/RESOURCE_STATE.md`
- ✅ If decision made: Add to `mycompany/cto/decisions/{task_id}.md`
- ✅ Update `mycompany/cto/STRATEGIC_SUMMARY.json`

#### When CTO **SPLITS EPIC**:
- ✅ Create subtasks in `tasks` table
- ✅ Set `parent_id` and `task_type`
- ✅ Log decision to `mycompany/cto/decisions/`
- ✅ Update `TASK_HISTORY.md`

#### When CTO **DEFERS TASK**:
- ✅ Update task status
- ✅ Log to `mycompany/cto/RESOURCE_STATE.md`
- ✅ Update `TASK_HISTORY.md`

#### When CTO **ESCALATES TO CEO**:
- ✅ Set task status
- ✅ Create notification/comment
- ✅ Log to `mycompany/cto/decisions/`
- ✅ Update `STRATEGIC_SUMMARY.json`

---

### 8. USER Changes

#### When CEO/User is **CREATED**:
- ✅ Insert into `users` table
- ✅ Update `mycompany/organization/EMPLOYEES.md`
- ✅ Update `mycompany/organization/OVERVIEW.md`

#### When User is **UPDATED**:
- ✅ Update `users` table
- ✅ Update `mycompany/organization/EMPLOYEES.md`

#### When User is **DELETED**:
- ✅ Delete from `users` table
- ✅ Reassign their tasks
- ✅ Update `mycompany/organization/EMPLOYEES.md`
- ✅ Update `mycompany/organization/OVERVIEW.md`

---

## Implementation Strategy

### Phase 1: Database Triggers
Create SQL triggers for critical cascades:
- ON DELETE CASCADE (already exists via FOREIGN KEY)
- ON UPDATE triggers for status changes

### Phase 2: API Middleware
Add middleware to API endpoints:
```javascript
// After successful DB operation
await contextManager.syncAfterChange(entityType, action, entityId);
```

### Phase 3: Context Manager Methods
Add specific sync methods:
- `syncAfterProjectChange(action, projectId)`
- `syncAfterTeamChange(action, teamId)`
- `syncAfterEmployeeChange(action, employeeId)`
- `syncAfterTaskChange(action, taskId)`

### Phase 4: Real-time Updates
Use WebSocket/Socket.io to notify:
- Frontend for UI updates
- Agent-runner for context refresh

---

## Priority Order

### High Priority (Critical for consistency):
1. ✅ Employee ↔ Team ↔ Skills sync
2. ✅ Project ↔ Team ↔ Tasks sync
3. ✅ CTO decisions ↔ Task assignments
4. ✅ Organization overview statistics

### Medium Priority (Important for context):
5. ✅ Task history logs
6. ✅ Team activity history
7. ✅ Employee profiles

### Low Priority (Nice to have):
8. ✅ Decision logs
9. ✅ Strategic summaries

---

**Status**: Needs Implementation
**Next Steps**:
1. Create database triggers
2. Add API middleware
3. Extend context-manager
4. Test cascading updates
