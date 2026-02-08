const fs = require('fs').promises;

class TaskManagerAPI {
  constructor(config) {
    this.config = config;
    this.token = null;
    this.currentUser = null;
  }

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
   * @param {string} assignee - Name or email of the assignee (e.g., "Claude", "claude@example.com")
   */
  async getAssignedTasks(assignee = 'Claude') {
    const allTasks = await this.getAllTasks();

    // Filter tasks assigned to the specified user
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
   * Get scheduled tasks for today
   */
  async getScheduledTasksForToday() {
    const allTasks = await this.getAllTasks();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const scheduledTasks = allTasks.filter(task => {
      return task.scheduled_date === today;
    });

    console.log(`[API] Found ${scheduledTasks.length} task(s) scheduled for today`);
    return scheduledTasks;
  }

  /**
   * Update a task status
   * @param {string} taskId - Task ID
   * @param {object} updates - Fields to update (status, description, etc.)
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
   * Mark a task as in progress
   */
  async markTaskInProgress(taskId) {
    return this.updateTask(taskId, { status: 'in-progress' });
  }

  /**
   * Mark a task as completed
   */
  async markTaskCompleted(taskId) {
    return this.updateTask(taskId, { status: 'completed' });
  }

  /**
   * Save tasks to a JSON file
   */
  async saveTasksToFile(tasks, filename = 'tasks.json') {
    await fs.writeFile(filename, JSON.stringify(tasks, null, 2));
    console.log(`[API] Tasks saved to ${filename}`);
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
}

// CLI usage
if (require.main === module) {
  const config = require('./config.json').taskManagerAPI;

  (async () => {
    const api = new TaskManagerAPI(config);

    try {
      // Login
      await api.login();

      // Get current user
      const user = await api.getCurrentUser();
      console.log('\n=== Current User ===');
      console.log(`Name: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);

      // Get all tasks
      const allTasks = await api.getAllTasks();
      console.log(`\n=== All Tasks (${allTasks.length}) ===`);

      // Get tasks assigned to Claude
      const claudeTasks = await api.getAssignedTasks('Claude');
      console.log('\n=== Tasks Assigned to Claude ===');

      if (claudeTasks.length === 0) {
        console.log('No tasks assigned to Claude');
      } else {
        claudeTasks.forEach((task, i) => {
          console.log(`\n${i + 1}. ${task.title}`);
          console.log(`   ID: ${task.id}`);
          console.log(`   Status: ${task.status}`);
          console.log(`   Priority: ${task.priority}`);
          console.log(`   Assignee: ${task.assignee_name || 'Unassigned'}`);
          if (task.due_date) console.log(`   Due: ${task.due_date}`);
          if (task.scheduled_date) console.log(`   Scheduled: ${task.scheduled_date} ${task.scheduled_time || ''}`);
          if (task.description) console.log(`   Description: ${task.description.substring(0, 100)}...`);
        });

        // Save to file
        await api.saveTasksToFile(claudeTasks, 'claude-tasks.json');
      }

      // Get today's scheduled tasks
      const todayTasks = await api.getScheduledTasksForToday();
      if (todayTasks.length > 0) {
        console.log(`\n=== Scheduled for Today (${todayTasks.length}) ===`);
        todayTasks.forEach((task, i) => {
          console.log(`${i + 1}. ${task.title} at ${task.scheduled_time || 'anytime'}`);
        });
      }

    } catch (error) {
      console.error('[API] Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = TaskManagerAPI;
