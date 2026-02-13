# AI Team Manager Documentation

Welcome to the complete documentation for the AI Team Manager project. This documentation covers architecture, implementation guides, user guides, and reference materials.

## 📚 Documentation Structure

```
docs/
├── README.md                    # This file - documentation index
├── architecture/                # System architecture & design
├── implementation/              # Implementation guides & summaries
├── guides/                      # User & feature guides
└── reference/                   # Reference materials & historical docs
```

---

## 🏗️ Architecture

### [System Architecture](./architecture/SYSTEM_ARCHITECTURE.md)
**Complete system architecture and entity relationships**

- Entity relationship diagrams
- Database schema analysis
- Complete workflow examples
- Data storage locations (database vs filesystem)
- Hierarchical decision-making (CEO → CTO → Team Lead → Employees)
- Skill-based architecture
- Integration points

**Key Topics:**
- CEO, CTO, Projects, Teams, Team Leads, Employees, Skills, Tasks
- How entities interact and relate to each other
- Where data is stored (database vs ~/mycompany/)
- Complete workflow examples

### [Cascading Updates](./architecture/CASCADING_UPDATES.md)
**Complete update matrix for all entity relationships**

- What updates when an entity changes
- Project, Team, Employee, Task, Skill changes
- Automatic synchronization rules
- Implementation strategy

**Key Topics:**
- Project changes → Related entities
- Team changes → Members, skills, files
- Employee changes → Teams, profiles
- Task changes → CTO decisions, histories
- Skill changes → Employee profiles, team skills

---

## 🔧 Implementation

### [Cascading Updates Implementation](./implementation/CASCADING_UPDATES_IMPLEMENTATION.md)
**Implementation status and guide for cascading updates**

- What's been implemented
- What needs to be done
- Implementation patterns
- Testing checklist
- Rollout strategy

**Status:** Foundation complete, endpoints in progress

### [Implementation Summary](./implementation/IMPLEMENTATION_SUMMARY.md)
**Overall implementation summary and progress**

- Features implemented
- System components
- Integration status
- Known issues and todo items

### [Cleanup Summary](./implementation/CLEANUP_SUMMARY.md)
**Agent-runner package cleanup (code vs data separation)**

- Before and after structure
- What was removed/moved
- Benefits of clean separation
- Architecture decisions

---

## 📖 Guides

### [Skills System Guide](./guides/SKILLS_SYSTEM.md)
**Complete guide to the skills system**

- 590 skills from skills.sh
- Skill categories (Technical, Creative, Strategic, Operational, AI & Agents)
- OpenAI-based skill suggestion system
- How to use skills with employees
- How to add new skills
- Skill documentation (98 .md files)

**Key Features:**
- Automatic skill suggestions when hiring employees
- Comprehensive skill pool from skills.sh
- Skill documentation available offline
- Integration with OpenAI for intelligent suggestions

### [Context System Guide](./guides/CONTEXT_SYSTEM.md)
**mycompany/ context directory system**

- How context directory works
- What gets synced and when
- CTO's use of context
- Team lead's use of context
- File structure and organization

**Key Topics:**
- ~/mycompany/ directory structure
- Organization, projects, teams, employees, CTO data
- How context is used by AI agents
- Automatic synchronization

---

## 📋 Reference

### [Specialist to Employee Rename](./reference/SPECIALIST_TO_EMPLOYEE_RENAME.md)
**Historical reference: Renaming "specialists" to "employees"**

- Why the rename was done
- What was changed
- Files affected
- Migration guide

---

## 🚀 Quick Start

### For New Developers:

1. **Start with Architecture**:
   - Read [System Architecture](./architecture/SYSTEM_ARCHITECTURE.md) to understand the complete system
   - Understand how CEO, CTO, Teams, Employees, and Skills interact

2. **Understand Key Systems**:
   - [Skills System](./guides/SKILLS_SYSTEM.md) - How skills work
   - [Context System](./guides/CONTEXT_SYSTEM.md) - How mycompany/ directory works
   - [Cascading Updates](./architecture/CASCADING_UPDATES.md) - How data stays synchronized

3. **Implementation Details**:
   - [Cascading Updates Implementation](./implementation/CASCADING_UPDATES_IMPLEMENTATION.md) - How to add sync calls
   - [Implementation Summary](./implementation/IMPLEMENTATION_SUMMARY.md) - What's been built

### For Users:

1. **Understanding the System**:
   - [System Architecture](./architecture/SYSTEM_ARCHITECTURE.md) - How everything fits together
   - See the workflow examples to understand how tasks flow through the system

2. **Using Skills**:
   - [Skills System Guide](./guides/SKILLS_SYSTEM.md) - How to use the 590-skill pool
   - Understand automatic skill suggestions

3. **Understanding Context**:
   - [Context System Guide](./guides/CONTEXT_SYSTEM.md) - What the mycompany/ directory is for

---

## 📊 Key Concepts

### Entity Hierarchy:
```
CEO (Human)
  ├─→ Creates PROJECTS
  ├─→ Creates TEAMS
  ├─→ Hires EMPLOYEES
  └─→ Oversees CTO
        ├─→ Evaluates TASKS
        ├─→ Manages RESOURCES
        ├─→ Assigns to TEAMS
        └─→ Routes to EMPLOYEES
              └─→ Have SKILLS (590 pool)
```

### Data Locations:
- **Database** (`taskmanager.db`): Users, projects, teams, tasks, employees, skills
- **Files** (`~/mycompany/`): CTO decisions, team data, employee templates, context
- **Code** (`agent-runner/`): CTO engine, team lead logic, skills pool

### Key Features:
1. **Hierarchical AI Decision Making**: CEO → CTO → Team Lead → Employees
2. **Skill-Based Architecture**: 590 skills from skills.sh
3. **Context-Aware AI**: All agents read from mycompany/ for context
4. **Cascading Updates**: Changes automatically propagate to related entities
5. **Separation of Concerns**: Code in package, data in mycompany/

---

## 🔄 System Workflow

### Example: "Create SEO-optimized blog post"

```
1. CEO creates task in project
2. CTO evaluates task
   - Checks complexity
   - Verifies resources available
   - Decides to assign to Digital Marketing team
3. Team Lead (AI agent) receives task
   - Analyzes requirements
   - Delegates to SEO Specialist and Content Specialist
4. Employees execute with their skills
   - SEO Specialist: Uses [seo-audit, schema-markup]
   - Content Specialist: Uses [copywriting, content-strategy]
5. Team Lead synthesizes results
6. CTO verifies completion
7. Task marked complete
```

---

## 📝 Documentation Standards

### When Adding New Documentation:

1. **Architecture docs** (`architecture/`):
   - System design decisions
   - Entity relationships
   - Data flow diagrams

2. **Implementation docs** (`implementation/`):
   - What was built
   - How it was implemented
   - Status tracking

3. **Guides** (`guides/`):
   - User-facing documentation
   - Feature guides
   - How-to tutorials

4. **Reference** (`reference/`):
   - Historical information
   - Migration guides
   - Deprecated features

### Naming Convention:
- Use UPPERCASE for major docs (e.g., `SYSTEM_ARCHITECTURE.md`)
- Use clear, descriptive names
- Include dates for time-sensitive docs
- Link between related documents

---

## 🤝 Contributing

When updating the system:

1. **Update relevant docs** in this folder
2. **Keep docs in sync** with code changes
3. **Add examples** for new features
4. **Update this README** if adding new doc categories

---

## 📞 Support

For questions or issues:
- Check the [System Architecture](./architecture/SYSTEM_ARCHITECTURE.md) for understanding
- Review [Implementation guides](./implementation/) for technical details
- See [Guides](./guides/) for feature usage

---

## 📅 Version History

- **2026-02-12**: Initial documentation structure created
  - System Architecture documented
  - Cascading Updates system designed
  - Skills System documented
  - Context System explained
  - Implementation guides added

---

**Last Updated**: 2026-02-12
**Documentation Version**: 1.0
**Project**: AI Team Manager
