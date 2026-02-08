const fs = require('fs').promises;

class TaskManagerAPI {
  constructor(config) {
    this.config = config;
    this.token = null;
    this.currentUser = null;
  }

  // ========== AUTHENTICATION ==========

  /**
   * Login to the task manager API
   */
  async login() {
    console.log(`[API] Logging in to ${this.config.apiUrl}...`);

    try {
      const response = await fetch(`${this.config.apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.config.email,
          password: this.config.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Login failed: ${error.error || response.statusText}`);
      }

      const data = await response.json();
      this.token = data.token;
      this.currentUser = data.user;

      console.log(`[API] Logged in as: ${this.currentUser.name} (${this.currentUser.email})`);
      return data;
    } catch (error) {
      console.error('[API] Login error:', error.message);
      throw error;
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }

      const user = await response.json();
      this.currentUser = user;
      return user;
    } catch (error) {
      console.error('[API] Error fetching user:', error.message);
      throw error;
    }
  }

  // ========== TASKS - READ ==========

  /**
   * Get all tasks from the API
   */
  async getAllTasks() {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log('[API] Fetching all tasks...');

    try {
      const response = await fetch(`${this.config.apiUrl}/tasks`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }

      const tasks = await response.json();
      console.log(`[API] Fetched ${tasks.length} task(s)`);
      return tasks;
    } catch (error) {
      console.error('[API] Error fetching tasks:', error.message);
      throw error;
    }
  }

  /**
   * Get tasks assigned to a specific user (by name or email)
   */
  async getAssignedTasks(assignee = 'Claude') {
    const allTasks = await this.getAllTasks();

    const assignedTasks = allTasks.filter(task => {
      if (!task.assignee_name && !task.assignee_id) return false;

      const assigneeName = task.assignee_name?.toLowerCase() || '';
      const searchTerm = assignee.toLowerCase();

      return assigneeName.includes(searchTerm) ||
             assignee.includes('@') && task.assignee_id === assignee;
    });

    console.log(`[API] Found ${assignedTasks.length} task(s) assigned to "${assignee}"`);
    return assignedTasks;
  }

  /**
   * Get scheduled tasks for a date range
   */
  async getScheduledTasks(startDate, endDate) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Fetching scheduled tasks from ${startDate} to ${endDate}...`);

    try {
      const response = await fetch(
        `${this.config.apiUrl}/tasks/scheduled?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch scheduled tasks: ${response.statusText}`);
      }

      const tasks = await response.json();
      console.log(`[API] Found ${tasks.length} scheduled task(s)`);
      return tasks;
    } catch (error) {
      console.error('[API] Error fetching scheduled tasks:', error.message);
      throw error;
    }
  }

  /**
   * Get scheduled tasks for today
   */
  async getScheduledTasksForToday() {
    const today = new Date().toISOString().split('T')[0];
    return this.getScheduledTasks(today, today);
  }

  // ========== TASKS - CREATE ==========

  /**
   * Create a new task
   */
  async createTask(taskData) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Creating task: ${taskData.title}...`);

    try {
      const response = await fetch(`${this.config.apiUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create task: ${error.error || response.statusText}`);
      }

      const newTask = await response.json();
      console.log(`[API] Task created: ${newTask.id}`);
      return newTask;
    } catch (error) {
      console.error('[API] Error creating task:', error.message);
      throw error;
    }
  }

  // ========== TASKS - UPDATE ==========

  /**
   * Update a task (full update)
   */
  async updateTask(taskId, updates) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Updating task ${taskId}...`);

    try {
      const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update task: ${response.statusText}`);
      }

      const updatedTask = await response.json();
      console.log(`[API] Task ${taskId} updated successfully`);
      return updatedTask;
    } catch (error) {
      console.error('[API] Error updating task:', error.message);
      throw error;
    }
  }

  /**
   * Change task status (quick update)
   */
  async changeTaskStatus(taskId, status) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Changing task ${taskId} status to: ${status}`);

    try {
      const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}/move`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`Failed to change status: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[API] Status changed successfully`);
      return result;
    } catch (error) {
      console.error('[API] Error changing status:', error.message);
      throw error;
    }
  }

  /**
   * Schedule a task
   */
  async scheduleTask(taskId, scheduledDate, scheduledTime) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Scheduling task ${taskId} for ${scheduledDate} ${scheduledTime || ''}`);

    try {
      const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}/schedule`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to schedule task: ${response.statusText}`);
      }

      const updatedTask = await response.json();
      console.log(`[API] Task scheduled successfully`);
      return updatedTask;
    } catch (error) {
      console.error('[API] Error scheduling task:', error.message);
      throw error;
    }
  }

  /**
   * Mark a task as backlog
   */
  async markTaskBacklog(taskId) {
    return this.changeTaskStatus(taskId, 'backlog');
  }

  /**
   * Mark a task as todo
   */
  async markTaskTodo(taskId) {
    return this.changeTaskStatus(taskId, 'todo');
  }

  /**
   * Mark a task as in progress
   */
  async markTaskInProgress(taskId) {
    return this.changeTaskStatus(taskId, 'in-progress');
  }

  /**
   * Mark a task as for-review (ready for review)
   */
  async markTaskForReview(taskId) {
    return this.changeTaskStatus(taskId, 'for-review');
  }

  /**
   * Mark a task as for-review with execution metadata
   */
  async markTaskForReviewWithMetadata(taskId, metadata) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Marking task ${taskId} for review with metadata...`);

    try {
      const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'for-review',
          execution_time: metadata.execution_time,
          tokens_used: metadata.tokens_used,
          files_modified: metadata.files_modified,
          model_used: metadata.model_used,
          execution_started_at: metadata.execution_started_at,
          execution_completed_at: metadata.execution_completed_at
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark for review: ${response.statusText}`);
      }

      const updatedTask = await response.json();
      console.log(`[API] Task ${taskId} marked for review with metadata`);
      return updatedTask;
    } catch (error) {
      console.error('[API] Error marking for review:', error.message);
      throw error;
    }
  }

  /**
   * Mark a task as done (completed)
   */
  async markTaskDone(taskId) {
    return this.changeTaskStatus(taskId, 'done');
  }

  /**
   * @deprecated Use markTaskDone() instead
   */
  async markTaskCompleted(taskId) {
    console.warn('[API] Warning: markTaskCompleted() is deprecated. Use markTaskDone() instead.');
    return this.markTaskDone(taskId);
  }

  /**
   * Mark a task as failed and move to todo
   */
  async markTaskFailed(taskId) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Marking task ${taskId} as failed...`);

    try {
      const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'todo',
          failed_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to mark task as failed: ${response.statusText}`);
      }

      console.log(`[API] Task ${taskId} marked as failed`);
      return await response.json();
    } catch (error) {
      console.error(`[API] Error marking task as failed:`, error.message);
      throw error;
    }
  }

  /**
   * Update task title
   */
  async updateTaskTitle(taskId, title) {
    return this.updateTask(taskId, { title });
  }

  /**
   * Update task description
   */
  async updateTaskDescription(taskId, description) {
    return this.updateTask(taskId, { description });
  }

  /**
   * Update task priority
   */
  async updateTaskPriority(taskId, priority) {
    return this.updateTask(taskId, { priority });
  }

  /**
   * Update task due date
   */
  async updateTaskDueDate(taskId, dueDate) {
    return this.updateTask(taskId, { due_date: dueDate });
  }

  /**
   * Assign task to a user
   */
  async assignTask(taskId, assigneeId) {
    return this.updateTask(taskId, { assignee_id: assigneeId });
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Fetching task ${taskId}...`);

    try {
      const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch task: ${response.statusText}`);
      }

      const task = await response.json();
      console.log(`[API] Fetched task: ${task.title}`);
      return task;
    } catch (error) {
      console.error(`[API] Error fetching task:`, error);
      throw error;
    }
  }

  // ========== TASK COMMENTS ==========

  /**
   * Get comments for a task
   */
  async getTaskComments(taskId) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Fetching comments for task ${taskId}...`);

    try {
      const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}/comments`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.statusText}`);
      }

      const comments = await response.json();
      console.log(`[API] Fetched ${comments.length} comment(s)`);
      return comments;
    } catch (error) {
      console.error('[API] Error fetching comments:', error.message);
      throw error;
    }
  }

  /**
   * Add a comment to a task
   */
  async addComment(taskId, content, isSystem = false) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Adding comment to task ${taskId}...`);

    try {
      const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          is_system: isSystem
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add comment: ${response.statusText}`);
      }

      const comment = await response.json();
      console.log(`[API] Comment added successfully`);
      return comment;
    } catch (error) {
      console.error('[API] Error adding comment:', error.message);
      throw error;
    }
  }

  // ========== TASKS - DELETE ==========

  /**
   * Delete a task
   */
  async deleteTask(taskId) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Deleting task ${taskId}...`);

    try {
      const response = await fetch(`${this.config.apiUrl}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete task: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[API] Task ${taskId} deleted successfully`);
      return result;
    } catch (error) {
      console.error('[API] Error deleting task:', error.message);
      throw error;
    }
  }

  // ========== USERS ==========

  /**
   * Get all users
   */
  async getAllUsers() {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log('[API] Fetching all users...');

    try {
      const response = await fetch(`${this.config.apiUrl}/users`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      const users = await response.json();
      console.log(`[API] Fetched ${users.length} user(s)`);
      return users;
    } catch (error) {
      console.error('[API] Error fetching users:', error.message);
      throw error;
    }
  }

  /**
   * Invite a new user
   */
  async inviteUser(email) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Inviting user: ${email}...`);

    try {
      const response = await fetch(`${this.config.apiUrl}/users/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to invite user: ${error.error || response.statusText}`);
      }

      const result = await response.json();
      console.log(`[API] User invited: ${result.user.email}`);
      console.log(`[API] Login password: ${result.loginPassword}`);
      return result;
    } catch (error) {
      console.error('[API] Error inviting user:', error.message);
      throw error;
    }
  }

  /**
   * Delete a user (admin only)
   */
  async deleteUser(userId) {
    if (!this.token) {
      throw new Error('Not authenticated. Call login() first.');
    }

    console.log(`[API] Deleting user ${userId}...`);

    try {
      const response = await fetch(`${this.config.apiUrl}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete user: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[API] User ${userId} deleted successfully`);
      return result;
    } catch (error) {
      console.error('[API] Error deleting user:', error.message);
      throw error;
    }
  }

  // ========== UTILITIES ==========

  /**
   * Save tasks to a JSON file
   */
  async saveTasksToFile(tasks, filename = 'tasks.json') {
    await fs.writeFile(filename, JSON.stringify(tasks, null, 2));
    console.log(`[API] Tasks saved to ${filename}`);
  }

  /**
   * Save users to a JSON file
   */
  async saveUsersToFile(users, filename = 'users.json') {
    await fs.writeFile(filename, JSON.stringify(users, null, 2));
    console.log(`[API] Users saved to ${filename}`);
  }
}

// CLI usage demo
if (require.main === module) {
  const config = require('./config.json').taskManagerAPI;

  (async () => {
    const api = new TaskManagerAPI(config);

    try {
      // Login
      await api.login();

      console.log('\n=== AVAILABLE OPERATIONS ===\n');

      // 1. Get all tasks
      const tasks = await api.getAllTasks();
      console.log(`✓ Get all tasks (${tasks.length})`);

      // 2. Get assigned tasks
      const claudeTasks = await api.getAssignedTasks('Claude');
      console.log(`✓ Get Claude's tasks (${claudeTasks.length})`);

      // 3. Get all users
      const users = await api.getAllUsers();
      console.log(`✓ Get all users (${users.length})`);

      if (claudeTasks.length > 0) {
        const task = claudeTasks[0];
        console.log(`\n=== DEMO: Managing Task "${task.title}" ===\n`);

        // Change status
        await api.markTaskInProgress(task.id);
        console.log(`✓ Changed status to: in-progress`);

        // Update description
        await api.updateTaskDescription(task.id, task.description + ' [Updated by Claude]');
        console.log(`✓ Updated description`);

        // Change priority
        await api.updateTaskPriority(task.id, 'high');
        console.log(`✓ Changed priority to: high`);

        // Mark as done
        await api.markTaskDone(task.id);
        console.log(`✓ Marked as done`);

        console.log('\n✅ All operations successful!');
      }

      // Save to files
      await api.saveTasksToFile(tasks, 'all-tasks.json');
      await api.saveUsersToFile(users, 'all-users.json');

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = TaskManagerAPI;
