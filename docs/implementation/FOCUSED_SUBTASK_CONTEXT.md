# Focused Subtask Context - Context Window Optimized

**Date**: 2026-02-12
**Status**: ✅ **IMPLEMENTED**
**Philosophy**: Provide only directly relevant context, not everything

---

## Problem with Previous Approach

### ❌ What Was Wrong

Including **15+ file paths** in every subtask:
- Company organization files
- All employees list
- All teams list
- CTO intelligence files
- Complete project documentation
- Full code repository
- 7-step checklist

**Issues**:
1. **Context Window Waste** - Team Lead AI has limited context (100K-200K tokens)
2. **Information Overload** - Not everything is relevant to the specific task
3. **Slower Processing** - More files to read = more time
4. **Distraction** - Hard to focus on what matters

---

## ✅ New Focused Approach

### What We Include Now

**ONLY these 4 categories**:

#### 1. **Team Members Assigned**
Only employees assigned to THIS team, not all company employees.

```markdown
## 👥 Team Members Available

- **Backend Developer**: Expert in Node.js and Express
- **Security Specialist**: Authentication and authorization expert
- **QA Engineer**: Test automation and coverage

**Note**: You can call upon any of these team members for specialized tasks.
```

#### 2. **Direct Task Context**
Only files directly related to THIS task.

```markdown
## 📚 Relevant Context

**Project Overview**: Read `~/mycompany/projects/taskflow_platform/OVERVIEW.md` for project goals.

**Your Team**: Read `~/mycompany/teams/backend_team/OVERVIEW.md` for team mission.

**Previous Subtask**: Check `tasks/build-auth-system/` from "Design Database Schema" for dependencies.

**Codebase**: `/path/to/repository` - Review existing patterns before implementing.

**⚠️ Previous Attempt**: This task was attempted before. Check task comments for what went wrong.
```

#### 3. **Previous Subtask Output**
Only if this is subtask 2+, reference the previous subtask's output directory.

```markdown
**Previous Subtask Output**: Check `tasks/epic_name/` for outputs from "Previous Task Title"
```

#### 4. **Previous Attempts**
If this task failed before, mention it so Team Lead can learn from mistakes.

```markdown
**⚠️ Previous Attempt**: This task was attempted before. Check task comments/logs for what went wrong.
```

---

## What We DON'T Include Anymore

### ❌ Removed (Not Relevant)

1. **Company-wide organization files**
   - `~/mycompany/organization/OVERVIEW.md`
   - `~/mycompany/organization/EMPLOYEES.md`
   - `~/mycompany/organization/TEAMS.md`
   - **Why removed**: Too broad, not specific to this task

2. **All employees directory**
   - `~/mycompany/employees/INDEX.md`
   - `~/mycompany/employees/*.md`
   - **Why removed**: Only need THIS team's members, not all 50+ company employees

3. **CTO intelligence files**
   - `~/mycompany/cto/SYSTEM_PROMPT.md`
   - `~/mycompany/cto/RESOURCE_STATE.md`
   - `~/mycompany/cto/TASK_HISTORY.md`
   - **Why removed**: Not relevant to task execution

4. **All project documentation**
   - Projects list, teams list, all tasks list
   - **Why removed**: Only need THIS project's overview, not all projects

5. **7-step pre-implementation checklist**
   - **Why removed**: Bloat, Team Lead AI will read relevant files automatically

---

## Comparison

### Before (Unfocused)

```markdown
# Implement Auth API

## 📚 Required Context Files

### Company Organization
- `/Users/.../mycompany/organization/OVERVIEW.md` ← Not needed
- `/Users/.../mycompany/organization/EMPLOYEES.md` ← Not needed
- `/Users/.../mycompany/organization/TEAMS.md` ← Not needed

### Employees Directory
- `/Users/.../mycompany/employees/INDEX.md` ← Not needed
- `/Users/.../mycompany/employees/*.md` ← Not needed

### Project Context
- `/Users/.../mycompany/projects/PROJECT/OVERVIEW.md` ✓ (Keep)
- `/Users/.../mycompany/projects/PROJECT/TEAMS.md` ← Not needed
- `/Users/.../mycompany/projects/PROJECT/TASKS.md` ← Not needed

### Team Context
- `/Users/.../mycompany/teams/TEAM/OVERVIEW.md` ✓ (Keep)
- `/Users/.../mycompany/teams/TEAM/MEMBERS.md` ← Use embedded list

### Previous Outputs
- Check `tasks/epic_name/` ✓ (Keep)

### Code Repository
- `/Users/.../repository` ✓ (Keep)

### CTO Intelligence
- `/Users/.../mycompany/cto/SYSTEM_PROMPT.md` ← Not needed
- `/Users/.../mycompany/cto/RESOURCE_STATE.md` ← Not needed
- `/Users/.../mycompany/cto/TASK_HISTORY.md` ← Not needed

## 📋 Pre-Implementation Checklist

1. [ ] Read Company Context ← Not needed
2. [ ] Review Project Requirements ✓ (Keep)
3. [ ] Check Team Information ✓ (Keep)
4. [ ] Review Available Employees ← Already in description
5. [ ] Check Previous Outputs ✓ (Keep)
6. [ ] Examine Codebase ✓ (Keep)
7. [ ] Verify Requirements ← Obvious

**Total**: 15+ file paths, 7 checklist items
```

### After (Focused)

```markdown
# Implement Auth API

## 📚 Relevant Context

**Project Overview**: Read `~/mycompany/projects/taskflow/OVERVIEW.md` for goals.

**Your Team**: Read `~/mycompany/teams/backend_team/OVERVIEW.md` for mission.

**Previous Subtask**: Check `tasks/build-auth/` from "Design Schema" for dependencies.

**Codebase**: `/path/to/repository` - Review existing patterns.

**Action**: Read relevant context files above before implementing.

## 👥 Team Members Available

- **Backend Developer**: Expert in Node.js and Express
- **Security Specialist**: Authentication expert
- **QA Engineer**: Test automation

**Note**: Call upon any team member for specialized tasks.

**Total**: 4 file paths, team members inline
```

---

## Context Window Savings

### Tokens Used

**Before**:
- 15 file paths × 80 tokens each = **1,200 tokens**
- 7 checklist items × 100 tokens each = **700 tokens**
- Explanatory text = **500 tokens**
- **Total overhead: ~2,400 tokens**

**After**:
- 4 file paths × 80 tokens each = **320 tokens**
- Team members inline = **150 tokens**
- Explanatory text = **100 tokens**
- **Total overhead: ~570 tokens**

**Savings: ~1,830 tokens (76% reduction)**

This means Team Lead can focus more context on:
- Understanding the actual requirements
- Thinking through the implementation
- Handling edge cases
- Writing better code

---

## Implementation Details

### What's Included (Conditionally)

| Context | Condition | Example |
|---------|-----------|---------|
| **Project Overview** | If `task.project_id` exists | `~/mycompany/projects/taskflow/OVERVIEW.md` |
| **Team Overview** | If `task.team_id` exists | `~/mycompany/teams/backend_team/OVERVIEW.md` |
| **Team Members** | If team has specialists | Inline list with names + descriptions |
| **Previous Subtask** | If subtask index > 0 | `tasks/epic_name/` directory |
| **Repository** | If project has repo path | `/path/to/repository` |
| **Previous Attempt** | If `task.failed_at` exists | Warning message with reference to comments |

### Team Members (Inline)

Instead of pointing to 50 employee files, we **inline** the team members:

```javascript
const teamMembers = payload?.team?.specialists || [];
const teamMembersList = teamMembers.length > 0
  ? teamMembers.map(emp => `- **${emp.name}**: ${emp.description || 'No description'}`).join('\n')
  : '_No specific employees assigned to this team_';
```

**Result**: Team Lead sees 3-6 relevant employees, not all 50 company employees.

---

## Example Subtask Description

### Complete Example

```markdown
# Implement User Authentication API

## 🎯 Objective

Build secure REST API for user authentication including login, logout,
and token refresh endpoints. Must support JWT tokens with 24-hour
expiration and refresh tokens with 7-day expiration.

## 🔗 Context

This is **Subtask 2 of 5** in the epic: "Build Complete Auth System"

**Parent Task Description:**
Create a full-stack authentication system with backend API, frontend UI,
database schema, session management, and comprehensive tests...

## 📂 Output Directory

`tasks/build-complete-auth-system` (Create if not exists)

**CRITICAL**: All artifacts must be saved in this directory.

## 📚 Relevant Context

**Project Overview**: Read `~/mycompany/projects/taskflow_platform/OVERVIEW.md`
for project goals and requirements.

**Your Team**: Read `~/mycompany/teams/backend_team/OVERVIEW.md` for team
mission and working guidelines.

**Previous Subtask**: Check outputs in `tasks/build-complete-auth-system`
from "Design Database Schema" for dependencies.

**Codebase**: `/Users/amirmoradi94/Desktop/Projects/taskflow` - Review
existing patterns before implementing.

**Action**: Read the relevant context files above using the `Read` tool
before implementing.

## 👥 Team Members Available

- **Backend Developer**: Expert in Node.js, Express.js, and REST API design
- **Security Specialist**: Authentication and authorization expert, JWT specialist
- **QA Engineer**: Test automation and API testing expert

**Note**: You can call upon any of these team members for specialized tasks.

## 📥 Inputs Required

- Database schema from previous subtask (users table with hashed passwords)
- JWT secret key from environment variables
- Express.js server setup from existing codebase

**Previous Subtask Output**: Check `tasks/build-complete-auth-system` for
outputs from "Design Database Schema"

## 📝 Implementation Guidelines

**Tech Stack:**
- Node.js with Express.js
- bcrypt for password hashing
- jsonwebtoken for JWT tokens
- express-rate-limit for API rate limiting

**Security Requirements:**
- Rate limiting: 5 login attempts per minute
- Password validation: Min 8 chars, uppercase, number, special char
- HTTP-only cookies for refresh tokens
- CORS configuration

**Code Quality:**
- Clean, modular code
- Comprehensive error handling
- Input validation
- Unit tests with 80%+ coverage

## 📤 Expected Output

**Files to Create:**
1. `routes/auth.js` - Authentication routes
2. `middleware/authMiddleware.js` - JWT verification
3. `controllers/authController.js` - Business logic
4. `tests/auth.test.js` - Unit tests

**Acceptance Criteria:**
- All 4 endpoints working
- JWT tokens generated correctly
- Password hashing with bcrypt
- Rate limiting active
- Unit tests passing

## ⏰ Timeline

- **Start Time**: 2026-02-12T14:30:00Z
- **Deadline**: 2026-02-13T18:30:00Z
- **Estimated Duration**: 120 minutes

**⚠️ Parent Deadline**: 2026-02-19T00:00:00Z - Stay on schedule!

## 🔄 Next Steps

After completion, next subtask: "Build Frontend Login UI"

---

*Generated by CTO Intelligence Layer*
*Epic: Build Complete Auth System | Subtask 2/5 | Complexity: moderate*
```

---

## Benefits

### ✅ Context Window Efficiency

- **76% reduction** in context overhead
- More tokens for actual implementation thinking
- Faster AI processing (fewer files to read)

### ✅ Laser Focus

- Only see what's directly relevant
- No distraction from company-wide files
- Clear signal-to-noise ratio

### ✅ Faster Execution

- Less reading required
- Quicker to understand what matters
- Immediate action on relevant context

### ✅ Team-Centric

- See your team members, not all employees
- Understand your team's mission
- Know who to collaborate with

---

## Summary

### What Changed

**Removed (Not Relevant)**:
- ❌ Company organization files (15+ paths)
- ❌ All employees directory
- ❌ CTO intelligence files
- ❌ Complete project documentation
- ❌ 7-step checklist

**Kept (Directly Relevant)**:
- ✅ Project OVERVIEW only
- ✅ Team OVERVIEW only
- ✅ Team members (inline, not files)
- ✅ Previous subtask output directory
- ✅ Repository path
- ✅ Previous attempt warning

### Result

**Before**: 15+ file paths, 2,400 token overhead
**After**: 4 file paths, 570 token overhead
**Savings**: 76% context window reduction

---

**Your Team Leads now receive focused, relevant context without information overload!** 🎯

---

**Last Updated**: 2026-02-12
**Status**: Production Ready
**Philosophy**: Less is more - provide only what's needed
