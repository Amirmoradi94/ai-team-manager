# Subtask Description Example

**Date**: 2026-02-12
**Purpose**: Show complete example of CTO-generated subtask description with all context file paths

---

## Complete Example

This is what a Team Lead receives when they pick up a subtask:

```markdown
# Implement User Authentication API

## 🎯 Objective

Build a secure REST API for user authentication including login, logout, and token refresh endpoints. Must support JWT tokens with 24-hour expiration and refresh tokens with 7-day expiration. Implement rate limiting, password hashing with bcrypt, and secure HTTP-only cookies.

## 🔗 Context

This is **Subtask 2 of 5** in the epic: "Build Complete Authentication System"

**Parent Task Description:**
Create a full-stack authentication system with backend API, frontend UI, database schema, session management, and comprehensive tests. Must be production-ready with security best practices, rate limiting, and proper error handling...

## 📂 Output Directory

`tasks/build-complete-auth-system` (Create if not exists)

**CRITICAL**: All artifacts (code, configs, docs) must be saved in this directory.

## 📚 Required Context Files

**IMPORTANT**: Read these files before starting implementation to understand the full context.

### Company Organization
- `/Users/amirmoradi94/mycompany/organization/OVERVIEW.md` - Company structure and objectives
- `/Users/amirmoradi94/mycompany/organization/EMPLOYEES.md` - All available employees and their roles
- `/Users/amirmoradi94/mycompany/organization/TEAMS.md` - Team structure and responsibilities

### Employees Directory
- `/Users/amirmoradi94/mycompany/employees/INDEX.md` - Quick reference of all employees
- `/Users/amirmoradi94/mycompany/employees/*.md` - Individual employee profiles and capabilities

### Project Context
- `/Users/amirmoradi94/mycompany/projects/taskflow_platform/OVERVIEW.md` - Project goals and requirements
- `/Users/amirmoradi94/mycompany/projects/taskflow_platform/TEAMS.md` - Teams working on this project
- `/Users/amirmoradi94/mycompany/projects/taskflow_platform/TASKS.md` - Related tasks and progress

### Team Context
- `/Users/amirmoradi94/mycompany/teams/backend_team/OVERVIEW.md` - Team mission and structure
- `/Users/amirmoradi94/mycompany/teams/backend_team/MEMBERS.md` - Team members and their roles

### Previous Subtask Outputs
- Check outputs in `tasks/build-complete-auth-system` from previous subtask: "Design Database Schema"
- Review completion report for dependencies and context

### Code Repository
- Repository: `/Users/amirmoradi94/Desktop/Projects/taskflow`
- Review existing code structure before making changes
- Check for similar implementations or patterns
- Look for README.md, CONTRIBUTING.md, or similar docs

### CTO Intelligence
- `/Users/amirmoradi94/mycompany/cto/SYSTEM_PROMPT.md` - CTO's decision-making framework
- `/Users/amirmoradi94/mycompany/cto/RESOURCE_STATE.md` - Current resource availability
- `/Users/amirmoradi94/mycompany/cto/TASK_HISTORY.md` - Historical task performance

**Action**: Use the `Read` tool to examine these files before starting implementation.

**Pro Tip**: Start by reading the project OVERVIEW.md and team OVERVIEW.md to understand the big picture, then drill down to specific employee capabilities and previous task outputs.

## 📥 Inputs Required

- Database schema from Subtask 1 (users table with hashed passwords)
- JWT secret key from environment variables (check `.env` file)
- Express.js server setup from existing codebase
- bcrypt library for password hashing
- jsonwebtoken library for JWT generation

**Dependencies**:
- Previous subtask must have created `users` table with columns: id, email, password_hash, created_at
- Environment variables: JWT_SECRET, JWT_EXPIRATION, REFRESH_TOKEN_EXPIRATION
- Node.js version 18+ with async/await support

## 📝 Implementation Guidelines

**Tech Stack:**
- Node.js with Express.js framework
- bcrypt for password hashing (cost factor: 12)
- jsonwebtoken for JWT token generation
- express-rate-limit for API rate limiting
- cookie-parser for HTTP-only cookies

**Security Requirements:**
- Rate limiting: Maximum 5 login attempts per minute per IP
- Password validation: Minimum 8 characters, must include uppercase, number, and special character
- Secure HTTP-only cookies for refresh tokens (prevents XSS)
- CORS configuration for frontend (allow credentials)
- Helmet.js for security headers
- Input sanitization to prevent SQL injection

**API Design:**
- RESTful endpoints with proper HTTP methods (POST for mutations)
- Standard HTTP status codes (200, 400, 401, 500)
- JSON response format with consistent structure
- Error responses with descriptive messages

**Code Quality:**
- Write clean, modular code with single responsibility principle
- Include comprehensive inline comments for complex logic
- Use async/await instead of callbacks
- Proper error handling with try-catch blocks
- Validation middleware for request bodies
- Separation of concerns: routes, controllers, services, models

**Testing:**
- Unit tests for each endpoint
- Test happy paths and error cases
- Mock database calls in tests
- Aim for 80%+ code coverage
- Use Jest or Mocha as test framework

**Additional Requirements:**
- Follow existing code style in the repository
- Use environment variables for secrets (never hardcode)
- Log authentication attempts for security monitoring
- Return user info (without password) on successful login

## 📤 Expected Output (Definition of Done)

**Files to Create:**

1. **`routes/auth.js`** (Authentication routes)
   - POST /api/auth/register
   - POST /api/auth/login
   - POST /api/auth/logout
   - POST /api/auth/refresh

2. **`middleware/authMiddleware.js`** (JWT verification)
   - verifyToken() - Validates JWT from request
   - requireAuth() - Protects routes requiring authentication

3. **`controllers/authController.js`** (Business logic)
   - registerUser() - Create new user with hashed password
   - loginUser() - Authenticate and return JWT
   - logoutUser() - Invalidate refresh token
   - refreshToken() - Generate new JWT from refresh token

4. **`services/tokenService.js`** (Token utilities)
   - generateAccessToken() - Create JWT
   - generateRefreshToken() - Create refresh token
   - verifyRefreshToken() - Validate refresh token

5. **`tests/auth.test.js`** (Unit tests)
   - Test successful registration
   - Test duplicate email rejection
   - Test successful login
   - Test invalid credentials
   - Test token refresh
   - Test rate limiting

**API Endpoints Specification:**

**POST /api/auth/register**
```json
Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}

Response (201):
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**POST /api/auth/login**
```json
Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response (200):
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}

Note: Refresh token set as HTTP-only cookie
```

**Acceptance Criteria:**

- [ ] All 4 endpoints implemented and working correctly
- [ ] JWT tokens generated with 24-hour expiration
- [ ] Refresh tokens generated with 7-day expiration
- [ ] Passwords hashed with bcrypt (cost factor 12)
- [ ] Rate limiting active (5 requests/minute)
- [ ] HTTP-only cookies for refresh tokens
- [ ] Proper error responses (400, 401, 500)
- [ ] Unit tests written and passing
- [ ] Code coverage ≥ 80%
- [ ] No hardcoded secrets (all in .env)
- [ ] Input validation on all endpoints
- [ ] Security headers configured
- [ ] CORS properly configured

## 👥 Recommended Employees

- **Backend Developer (Node.js)** - Primary implementer of API logic
- **Security Specialist** - Review authentication implementation and security measures
- **QA Engineer** - Verify test coverage and edge cases
- **DevOps Engineer** - Review environment variable setup

## ⏰ Timeline

- **Start Time**: 2026-02-12T14:30:00.000Z
- **Deadline**: 2026-02-13T18:30:00.000Z
- **Estimated Duration**: 120 minutes

**⚠️ Parent Task Deadline**: 2026-02-19T00:00:00.000Z
Ensure timely completion to stay on schedule.

## 📋 Pre-Implementation Checklist

Before writing any code, complete these steps in order:

1. **[ ] Read Company Context**
   - `/Users/amirmoradi94/mycompany/organization/OVERVIEW.md`
   - Understand company goals and structure

2. **[ ] Review Project Requirements**
   - `/Users/amirmoradi94/mycompany/projects/taskflow_platform/OVERVIEW.md`
   - Understand project scope and constraints

3. **[ ] Check Team Information**
   - `/Users/amirmoradi94/mycompany/teams/backend_team/OVERVIEW.md`
   - Know your team's mission and capabilities

4. **[ ] Review Available Employees**
   - `/Users/amirmoradi94/mycompany/organization/EMPLOYEES.md`
   - Identify specialists who can help

5. **[ ] Check Previous Subtask Outputs**
   - Review files in `tasks/build-complete-auth-system`
   - Understand dependencies and context

6. **[ ] Examine Existing Codebase**
   - `/Users/amirmoradi94/Desktop/Projects/taskflow`
   - Find similar patterns or implementations

7. **[ ] Verify Implementation Requirements**
   - Re-read the "Implementation Guidelines" section above
   - Ensure you understand acceptance criteria

**ONLY AFTER** completing this checklist, begin implementation.

## 🔄 Next Steps

After completing this subtask, the next task is: "Build Frontend Login UI"

---

*Generated by CTO Intelligence Layer*
*Epic: Build Complete Authentication System | Subtask 2/5 | Complexity: moderate*
```

---

## Key Features of This Description

### ✅ Fully Self-Contained

Team Lead receives **everything needed** without asking questions:
- Clear objective
- Complete context
- All file paths to review
- Technical requirements
- Acceptance criteria

### ✅ All Context File Paths Included

**Company Level**:
- Organization overview
- All employees list
- Team structure

**Project Level**:
- Project goals and requirements
- Teams working on project
- Related tasks

**Team Level**:
- Team mission and members
- Team capabilities

**Code Level**:
- Repository path
- Previous outputs
- Existing patterns

**CTO Intelligence**:
- Decision framework
- Resource status
- Task history

### ✅ Pre-Implementation Checklist

Forces Team Lead to **read context before coding**:
1. Company goals
2. Project requirements
3. Team information
4. Available employees
5. Previous outputs
6. Existing code
7. Verify understanding

### ✅ Comprehensive Technical Guidance

Includes:
- Tech stack specifications
- Security requirements
- API design principles
- Code quality standards
- Testing requirements
- File structure
- Acceptance criteria

---

## How Team Lead Uses This

### Step 1: Read Description (5 minutes)

Team Lead scans the entire description to understand:
- What needs to be built
- Why it's needed
- How it fits in the larger epic

### Step 2: Review Context Files (10-15 minutes)

Team Lead reads **all referenced files**:
```bash
# Company context
cat ~/mycompany/organization/OVERVIEW.md
cat ~/mycompany/organization/EMPLOYEES.md

# Project context
cat ~/mycompany/projects/taskflow_platform/OVERVIEW.md

# Team context
cat ~/mycompany/teams/backend_team/OVERVIEW.md

# Previous outputs
ls tasks/build-complete-auth-system/
cat tasks/build-complete-auth-system/schema.sql

# Existing code
cd /Users/amirmoradi94/Desktop/Projects/taskflow
find . -name "*auth*"
```

### Step 3: Plan Implementation (5 minutes)

Team Lead creates mental or written plan:
- Which files to create
- What functions to write
- How to structure tests
- What to verify before marking done

### Step 4: Implement (60-90 minutes)

Team Lead writes code, following:
- Guidelines from description
- Patterns from existing codebase
- Best practices from employee profiles

### Step 5: Verify Acceptance Criteria (10 minutes)

Team Lead checks off each criterion:
- [ ] All endpoints working
- [ ] Tests passing
- [ ] Security measures in place
- [ ] Code quality standards met

### Step 6: Submit for Review

Team Lead marks task as complete with confidence because all requirements are clear and met.

---

## Benefits

### For Team Lead:
- **No ambiguity** - Everything needed is provided
- **Faster execution** - No waiting for clarification
- **Better quality** - All requirements clear upfront
- **Context awareness** - Knows how work fits in bigger picture

### For CTO:
- **Fewer questions** - Team Lead has all information
- **Consistent output** - Clear acceptance criteria
- **Better delegation** - Can trust Team Lead to execute
- **Trackable progress** - Clear definition of done

### For Project:
- **Faster completion** - Less back-and-forth communication
- **Higher quality** - All context considered
- **Better integration** - Aware of other components
- **Documentation** - All decisions and context recorded

---

## Summary

**Before Enhancement**:
```markdown
# Implement Auth API

Build authentication endpoints.

Requirements:
- Login
- Register
- Logout
```

**After Enhancement**:
```markdown
# Implement User Authentication API

## 🎯 Objective (200 words of context)
## 🔗 Context (parent task, position in sequence)
## 📂 Output Directory (exact path)
## 📚 Required Context Files (15+ file paths)
## 📥 Inputs Required (dependencies)
## 📝 Implementation Guidelines (tech stack, security, quality)
## 📤 Expected Output (files, endpoints, acceptance criteria)
## 👥 Recommended Employees (specialists to consult)
## ⏰ Timeline (start, deadline, duration)
## 📋 Pre-Implementation Checklist (7 steps)
## 🔄 Next Steps (what comes after)
```

**Result**: Team Lead has **complete context** and can execute with **full confidence**.

---

**Last Updated**: 2026-02-12
**Status**: Production Ready
