# AI Team Manager Architecture

## 1. Executive Summary
The AI Team Manager is a "Headless Agent Platform" that decouples **Identity** (the "Who") from **Execution** (the "Where"). It allows users to define AI team members with specific personas and skills in a web interface, assign them tasks, and have those tasks executed securely on local machines via a universal runner.

The system supports multiple AI providers (Claude, Gemini, OpenAI) and treats "Agent Identity" as a global, model-agnostic asset.

## 2. Core Concepts

### 2.1. The "Manager" vs. The "Runner"
*   **The Manager (Web App):** The Control Plane. A SaaS application where users manage projects, define agent identities, assign tasks, and review work. It holds the "Memory" and "State" of the entire system.
*   **The Runner (Local Scheduler):** The Data Plane. An NPM package installed on the user's physical machine. It connects to the Manager via WebSocket/API, pulls tasks, and executes them using local tools (Terminal, Git, File System).

### 2.2. Agent Hierarchy
To support complex orchestration, we distinguish between two types of agents:

1.  **Primary Agents ("Team Leads"):**
    *   **Role:** The assignable entity in the UI (e.g., "Tech Lead", "Product Manager").
    *   **Capabilities:** Planning, delegation, review, and high-level communication.
    *   **Implementation:** These run the main execution loop of the chosen provider (e.g., Claude Code main loop).
    *   **User Interaction:** Users assign tasks *directly* to Team Leads.

2.  **Specialist Sub-Agents ("The Tools"):**
    *   **Role:** Specialized personas invoked by Team Leads to perform concrete work.
    *   **Capabilities:** Deep, scoped domain knowledge (e.g., "React Expert", "SQL Optimizer").
    *   **Implementation:**
        *   *Claude:* Defined as `sub-agents`.
        *   *Gemini:* Defined as `Specialist` instructions.
        *   *OpenAI:* Injected as specialized system prompts.
    *   **User Interaction:** Users define these skills globally, but rarely assign tasks to them directly.

### 2.3. Global Persona Registry
Agent identities are stored in a **Model-Agnostic Schema**. This allows a "Frontend Expert" persona to be used by Claude today and Gemini tomorrow without reconfiguration.

**Schema Example:**
```json
{
  "id": "frontend-architect",
  "name": "Frontend Architect",
  "description": "Expert in React, Tailwind, and Performance",
  "system_prompt": "You are a strict Senior Frontend Dev. You prefer functional components and despise inline styles.",
  "tools_allowed": ["browser", "file_edit", "npm_install"],
  "rules": ["Always add accessibility labels", "Use TypeScript types"]
}
```

## 3. Data Architecture

### 3.1. Database Schema (SQLite/PostgreSQL)

#### `projects`
*   `id`: UUID
*   `name`: "E-commerce Platform"
*   `repository_path`: Local path on the runner machine (e.g., `/Users/amir/projects/shop`)
*   `runner_token`: Secret token for the local runner to authenticate.

#### `agents` (Primary Agents)
*   `id`: UUID
*   `name`: "Atlas (Tech Lead)"
*   `provider`: "claude" | "gemini" | "openai"
*   `model_config`: JSON (temperature, model version)
*   `project_id`: Link to a specific project (optional) or global.

#### `specialists` (Sub-Agents/Skills)
*   `id`: UUID
*   `name`: "Backend Pro"
*   `prompt_template`: The generic instruction set.
*   `tools`: List of capabilities.

#### `tasks`
*   `id`: UUID
*   `status`: "todo", "in-progress", "for-review", "done", "failed"
*   `assigned_agent_id`: FK to `agents`.
*   `context_history`: JSON blob of all previous execution logs and comments.

### 3.2. Memory Management
Memory is the bridge between the stateless AI execution and the persistent project lifecycle.

1.  **Task Context (Short-Term):**
    *   The **Lifecycle of a Task** is preserved until it reaches "Done".
    *   When a task is updated or retried, the *entire* history (user comments, previous error logs, file changes) is bundled and injected into the Runner's prompt.
    *   *Prompt Injection:* "You are continuing work on Task #123. Here is what happened in the last attempt..."

2.  **Project Context (Long-Term):**
    *   Global rules defined in `projects` (e.g., "Use Yarn") are automatically prepended to every session.

## 4. Execution Flow

1.  **Definition:** User creates a task: "Refactor Login component" and mentions "@FrontendPro".
2.  **Assignment:** User assigns the task to "Atlas (Team Lead)".
3.  **Polling:** The Local Runner (connected to the project) polls the API and finds the new task.
4.  **Context Construction:** The Runner builds the payload:
    *   **Identity:** Atlas's system prompt.
    *   **Specialists:** It sees "@FrontendPro" in the description and loads that specific Specialist schema into the context.
    *   **Task:** The user's instruction.
5.  **Execution:**
    *   Atlas analyzes the task.
    *   Atlas delegates the coding work to the "FrontendPro" sub-agent/persona.
    *   Runner executes local file changes.
6.  **Reporting:**
    *   Runner streams logs to the Web UI via WebSocket/API.
    *   Runner marks task as "For Review".
7.  **Feedback Loop:**
    *   User comments: "Fix the padding."
    *   Runner picks up the task again, *with the new comment added to the memory context*, and resumes work.

## 5. Security Model
*   **Sandboxing:** Agents default to `safe` mode (no internet access, restricted file paths).
*   **Human-in-the-Loop:** "Dangerous" tools (shell commands like `rm`, `git push`) require explicit user approval in the Web UI or Terminal.
*   **Secret Management:** API keys are stored locally in `.env` or encrypted in the database, never exposed in prompts.

## 6. Future Scalability
*   **Marketplace:** Users can export "Specialist" definitions (e.g., "The Python Migration Specialist") and share them.
*   **Cloud Runners:** Option to run agents in a cloud container instead of the local machine for fully autonomous operation.
