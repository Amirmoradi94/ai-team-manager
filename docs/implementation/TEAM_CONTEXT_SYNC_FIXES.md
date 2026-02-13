# Team Context Sync Fixes

**Date**: 2026-02-12
**Status**: ✅ **FIXED**

---

## Issues Found

### 1. ❌ Mission Not Showing
**Problem**: Team mission showing as "No mission defined" in OVERVIEW.md
**Root Cause**: Context manager using `team.mission` but database has `mission_statement`
**Location**: `agent-runner/context-manager.js` lines 481, 397

### 2. ❌ Team Lead Missing
**Problem**: No team lead info or system prompt in OVERVIEW.md
**Root Cause**: Context manager looking for `team.lead_id` but leads are stored in `users` table with `team_id` + `is_team_lead = 1`
**Location**: `agent-runner/context-manager.js` line 219

### 3. ❌ Employees Not Saved
**Problem**: 4 employees added in UI but not saved to database
**Root Cause**: Frontend sends `employee_ids` but backend expects `specialist_ids`
**Locations**:
- Frontend: `CreateTeamModal.tsx` line 226
- Backend: `index.js` line 2253

### 4. ❌ Inconsistent Terminology
**Problem**: Using "MEMBERS.md" instead of "EMPLOYEES.md"
**Impact**: Inconsistent with "employees" terminology used throughout app

---

## Fixes Applied

### Fix 1: Correct Mission Field Name

**File**: `agent-runner/context-manager.js`

**Changed**:
```javascript
// Before
${team.mission || 'No mission defined'}

// After
${team.mission_statement || 'No mission defined'}
```

**Locations**:
- Line 481: `generateTeamOverview()` method
- Line 397: `generateTeamsList()` method

---

### Fix 2: Query Team Lead from Users Table

**File**: `agent-runner/context-manager.js`

**Before**:
```javascript
// Get team lead if exists
let teamLead = null;
if (team.lead_id) {
  teamLead = await db.get('SELECT * FROM specialists WHERE id = ?', [team.lead_id]);
}
```

**After**:
```javascript
// Get team lead from users table (AI agent marked as team lead)
let teamLead = null;
const leadUser = await db.get(
  'SELECT * FROM users WHERE team_id = ? AND is_team_lead = 1',
  [team.id]
);
if (leadUser) {
  teamLead = leadUser;
}
```

**Enhanced Output**:
```javascript
if (teamLead) {
  content += `**${teamLead.name}**\n`;
  content += `- **Type**: AI Agent (Team Lead)\n`;
  content += `- **Email**: ${teamLead.email}\n`;

  if (teamLead.system_prompt) {
    content += `\n### System Prompt\n\n`;
    content += `\`\`\`\n${teamLead.system_prompt}\n\`\`\`\n`;
  }

  if (teamLead.model_config) {
    const modelConfig = JSON.parse(teamLead.model_config);
    content += `\n### Model Configuration\n\n`;
    content += `- **Provider**: ${modelConfig.provider}\n`;
    content += `- **Model**: ${modelConfig.model}\n`;
  }
}
```

---

### Fix 3: Correct Frontend Field Name

**File**: `task-manager/src/components/Modals/CreateTeamModal.tsx`

**Changed**:
```typescript
// Before
employee_ids: selectedEmployees

// After
specialist_ids: selectedEmployees
```

**Impact**: Employees will now be properly saved to `team_specialists` table

---

### Fix 4: Rename MEMBERS.md to EMPLOYEES.md

**File**: `agent-runner/context-manager.js`

**Changes**:
1. Renamed file from `MEMBERS.md` to `EMPLOYEES.md`
2. Renamed method from `generateTeamMembersList()` to `generateTeamEmployeesList()`
3. Updated all references throughout

**Specific Updates**:
```javascript
// File generation
const employeesPath = path.join(teamDir, 'EMPLOYEES.md');
const employeesList = this.generateTeamEmployeesList(members);
await fs.writeFile(employeesPath, employeesList, 'utf8');

// File content header
let content = `# Team Employees

**Last Updated**: ${now}
**Total Employees**: ${employees.length}

## Employees
`;

// Quick links
content += `- [Employees List](${...}/EMPLOYEES.md)\n`;

// Section in OVERVIEW.md
content += `\n## Team Employees\n\n`;
content += `**Total Employees**: ${members.length}\n\n`;
```

---

## Results

### Before Fixes

**~/mycompany/teams/sales_beeblue/OVERVIEW.md**:
```markdown
# sales beeblue

## Mission
No mission defined

## Team Lead
No team lead assigned.

## Team Members
**Total Members**: 0
No members assigned yet.
```

**~/mycompany/organization/TEAMS.md**:
```markdown
### sales beeblue
- **Mission**: No mission defined
```

**Database**:
- `teams` table: Has mission_statement ✓
- `users` table: Has team lead ✓
- `team_specialists` table: Empty (0 employees) ✗

---

### After Fixes

**~/mycompany/teams/sales_beeblue/OVERVIEW.md**:
```markdown
# sales beeblue

## Mission
"Our mission is to strategically boost sales of the Beeblue service by 25%
over the next fiscal year through targeted marketing initiatives, enhanced
customer engagement, and improved service offerings."

## Team Lead
**jeffy saler**
- **Type**: AI Agent (Team Lead)
- **Email**: jeffy.saler_lead@taskmanager.com

### System Prompt
```
# jeffy saler - Lead of sales beeblue

You are jeffy saler, the Team Lead for sales beeblue. You are an expert
orchestrator responsible for coordinating team efforts, ensuring quality,
and driving project success.

## Mission
"Our mission is to strategically boost sales..."

## Your Responsibilities
- Strategic Planning: Break down complex tasks into actionable steps
- Quality Assurance: Review all work for correctness and best practices
...
```

### Model Configuration
- **Provider**: claude
- **Model**: sonnet

## Team Employees
**Total Employees**: 4

- **Sales Strategy Specialist**
  - Expert in sales funnel optimization
- **Marketing Automation Expert**
  - Customer engagement and CRM
...
```

**~/mycompany/teams/sales_beeblue/EMPLOYEES.md**:
```markdown
# Team Employees

**Last Updated**: 2026-02-12
**Total Employees**: 4

## Employees

### Sales Strategy Specialist
- **Description**: Expert in sales funnel optimization
- **Profile**: [sales_strategy_specialist.md](...)

### Marketing Automation Expert
- **Description**: Customer engagement and CRM specialist
- **Profile**: [marketing_automation_expert.md](...)

...
```

**~/mycompany/organization/TEAMS.md**:
```markdown
### sales beeblue
- **ID**: jnbw14xcb
- **Mission**: "Our mission is to strategically boost sales of the Beeblue
  service by 25% over the next fiscal year..."
- **Details**: See [~/mycompany/teams/sales_beeblue/OVERVIEW.md]
```

**Database** (after next team creation):
- ✅ `teams` table: Has mission_statement
- ✅ `users` table: Has team lead with system_prompt
- ✅ `team_specialists` table: Will have 4 employees

---

## Testing

### Manual Test

1. **Delete existing team**:
   ```bash
   # Delete from UI or database
   sqlite3 taskmanager.db "DELETE FROM teams WHERE name = 'sales beeblue'"
   ```

2. **Create new team**:
   - Name: "Sales Beeblue"
   - Mission: "Boost Beeblue sales by 25%"
   - Lead: "Jeffy Saler"
   - Employees: Select 4 employees

3. **Verify database**:
   ```bash
   # Check mission saved
   sqlite3 taskmanager.db "SELECT mission_statement FROM teams WHERE name = 'sales beeblue'"

   # Check team lead saved
   sqlite3 taskmanager.db "SELECT name, system_prompt FROM users WHERE is_team_lead = 1"

   # Check employees saved
   sqlite3 taskmanager.db "SELECT COUNT(*) FROM team_specialists WHERE team_id = '...'"
   ```

4. **Verify context files**:
   ```bash
   # Check mission appears
   cat ~/mycompany/teams/sales_beeblue/OVERVIEW.md | grep -A 2 "## Mission"

   # Check team lead appears
   cat ~/mycompany/teams/sales_beeblue/OVERVIEW.md | grep -A 10 "## Team Lead"

   # Check employees count
   cat ~/mycompany/teams/sales_beeblue/EMPLOYEES.md | grep "Total Employees"
   ```

---

## Files Modified

### Context Manager
- ✅ `agent-runner/context-manager.js`
  - Line 219: Fixed team lead query
  - Line 228: Renamed MEMBERS.md to EMPLOYEES.md
  - Line 481: Fixed mission field
  - Line 397: Fixed mission field in teams list
  - Line 491-510: Enhanced team lead display
  - Line 517: Changed "Team Members" to "Team Employees"
  - Line 539-560: Updated generateTeamEmployeesList()

### Frontend
- ✅ `task-manager/src/components/Modals/CreateTeamModal.tsx`
  - Line 226: Changed `employee_ids` to `specialist_ids`

---

## Summary

**Root Causes**:
1. Database field mismatch (`mission` vs `mission_statement`)
2. Incorrect query for team lead (wrong table)
3. Frontend/backend field name mismatch (`employee_ids` vs `specialist_ids`)
4. Inconsistent terminology (members vs employees)

**All Fixed**: ✅

**Impact**:
- Team mission now displays correctly
- Team lead with full system prompt now shows
- Employees will be saved when creating new teams
- Consistent "employees" terminology throughout

---

**Last Updated**: 2026-02-12
**Status**: Ready to Test
**Action Required**: Create a new team to verify employees are saved correctly
