# Task Manager API Reference

Complete API reference for Claude to interact with the Task Manager.

## Authentication

### Login
```javascript
await api.login();
```

### Get Current User
```javascript
const user = await api.getCurrentUser();
// Returns: { id, name, email, role }
```

---

## Tasks - Read Operations

### Get All Tasks
```javascript
const tasks = await api.getAllTasks();
// Returns: Array of all tasks
```

### Get Tasks Assigned to User
```javascript
const tasks = await api.getAssignedTasks('Claude');
// Returns: Array of tasks assigned to specified user
```

### Get Scheduled Tasks (Date Range)
```javascript
const tasks = await api.getScheduledTasks('2026-02-07', '2026-02-14');
// Returns: Tasks scheduled between the dates
```

### Get Today's Scheduled Tasks
```javascript
const tasks = await api.getScheduledTasksForToday();
// Returns: Tasks scheduled for today
```

---

## Tasks - Create Operations

### Create a New Task
```javascript
const newTask = await api.createTask({
  title: 'Implement feature X',
  description: 'Build the new authentication system',
  status: 'todo',           // 'todo' | 'in-progress' | 'done'
  priority: 'high',         // 'low' | 'medium' | 'high'
  due_date: '2026-02-15',   // YYYY-MM-DD (optional)
  assignee_id: 'user-id',   // User ID (optional)
  scheduled_date: '2026-02-10',  // YYYY-MM-DD (optional)
  scheduled_time: '10:00'   // HH:MM (optional)
});
```

---

## Tasks - Update Operations

### Update Task (Full Update)
```javascript
const updated = await api.updateTask('task-id', {
  title: 'New title',
  description: 'New description',
  status: 'in-progress',
  priority: 'high',
  due_date: '2026-02-20',
  assignee_id: 'user-id',
  scheduled_date: '2026-02-15',
  scheduled_time: '14:00'
});
```

### Change Task Status (Quick)
```javascript
await api.changeTaskStatus('task-id', 'in-progress');
// status: 'todo' | 'in-progress' | 'done'
```

### Convenience Status Methods
```javascript
await api.markTaskBacklog('task-id');
await api.markTaskTodo('task-id');
await api.markTaskInProgress('task-id');
await api.markTaskDone('task-id');  // Mark as completed
```

### Update Specific Fields
```javascript
await api.updateTaskTitle('task-id', 'New Title');
await api.updateTaskDescription('task-id', 'New description');
await api.updateTaskPriority('task-id', 'high');
await api.updateTaskDueDate('task-id', '2026-02-20');
await api.assignTask('task-id', 'user-id');
```

### Schedule a Task
```javascript
await api.scheduleTask('task-id', '2026-02-15', '10:00');
// Time is optional: scheduleTask('task-id', '2026-02-15')
```

---

## Tasks - Delete Operations

### Delete a Task
```javascript
await api.deleteTask('task-id');
```

---

## Users

### Get All Users
```javascript
const users = await api.getAllUsers();
// Returns: Array of { id, name, email, role, created_at }
```

### Invite a New User
```javascript
const result = await api.inviteUser('newuser@example.com');
// Returns: { user, loginPassword }
console.log('Password:', result.loginPassword);
```

### Delete a User (Admin Only)
```javascript
await api.deleteUser('user-id');
```

---

## Utilities

### Save Tasks to File
```javascript
await api.saveTasksToFile(tasks, 'tasks.json');
```

### Save Users to File
```javascript
await api.saveUsersToFile(users, 'users.json');
```

---

## Usage Examples

### Example 1: Complete Task Workflow
```javascript
const api = new TaskManagerAPI(config);
await api.login();

// Create a task
const task = await api.createTask({
  title: 'Build API integration',
  description: 'Integrate with payment gateway',
  priority: 'high',
  status: 'todo'
});

// Start working on it
await api.markTaskInProgress(task.id);

// Update progress
await api.updateTaskDescription(
  task.id,
  'Integration 50% complete - added authentication'
);

// Complete it
await api.markTaskDone(task.id);
```

### Example 2: Schedule Tasks for the Week
```javascript
const api = new TaskManagerAPI(config);
await api.login();

// Create scheduled tasks
await api.createTask({
  title: 'Daily standup report',
  scheduled_date: '2026-02-10',
  scheduled_time: '09:00',
  priority: 'medium'
});

await api.createTask({
  title: 'Weekly deployment',
  scheduled_date: '2026-02-14',
  scheduled_time: '17:00',
  priority: 'high'
});
```

### Example 3: Manage Team Tasks
```javascript
const api = new TaskManagerAPI(config);
await api.login();

// Get all users
const users = await api.getAllUsers();
const developer = users.find(u => u.name === 'Developer');

// Get all tasks
const tasks = await api.getAllTasks();

// Assign unassigned high-priority tasks
for (const task of tasks) {
  if (!task.assignee_id && task.priority === 'high') {
    await api.assignTask(task.id, developer.id);
    console.log(`Assigned "${task.title}" to ${developer.name}`);
  }
}
```

### Example 4: Daily Task Summary
```javascript
const api = new TaskManagerAPI(config);
await api.login();

// Get today's tasks
const todayTasks = await api.getScheduledTasksForToday();

// Get Claude's tasks
const myTasks = await api.getAssignedTasks('Claude');

// Filter by status
const pending = myTasks.filter(t => t.status !== 'done');
const completed = myTasks.filter(t => t.status === 'done');

console.log(`
📊 Daily Summary:
- Scheduled today: ${todayTasks.length}
- My pending tasks: ${pending.length}
- Completed today: ${completed.length}
`);
```

### Example 5: Automated Task Cleanup
```javascript
const api = new TaskManagerAPI(config);
await api.login();

const tasks = await api.getAllTasks();

// Delete completed tasks older than 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

for (const task of tasks) {
  if (task.status === 'done') {
    const createdDate = new Date(task.created_at);
    if (createdDate < thirtyDaysAgo) {
      await api.deleteTask(task.id);
      console.log(`Deleted old task: ${task.title}`);
    }
  }
}
```

---

## Task Object Structure

```javascript
{
  id: 'abc123',
  title: 'Task title',
  description: 'Task description',
  status: 'todo',              // 'todo' | 'in-progress' | 'done'
  priority: 'medium',          // 'low' | 'medium' | 'high'
  due_date: '2026-02-15',     // YYYY-MM-DD or null
  scheduled_date: '2026-02-10', // YYYY-MM-DD or null
  scheduled_time: '10:00',     // HH:MM or null
  assignee_id: 'user-id',      // User ID or null
  assignee_name: 'John Doe',   // User name or null
  created_by: 'creator-id',    // User ID
  creator_name: 'Admin',       // User name
  created_at: '2026-02-06 10:30:00'
}
```

## User Object Structure

```javascript
{
  id: 'user123',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'member',           // 'admin' | 'member'
  created_at: '2026-02-01 09:00:00'
}
```

---

## Error Handling

All methods throw errors that should be caught:

```javascript
try {
  await api.updateTask('invalid-id', { status: 'done' });
} catch (error) {
  console.error('Failed to update task:', error.message);
}
```

---

## Quick Reference

**Status Values:** `backlog`, `todo`, `in-progress`, `done`
**Priority Values:** `low`, `medium`, `high`
**Date Format:** `YYYY-MM-DD` (e.g., `2026-02-15`)
**Time Format:** `HH:MM` (e.g., `10:30`, `14:00`)
**User Roles:** `admin`, `member`

---

Now Claude has **full control** over the Task Manager! 🎉
