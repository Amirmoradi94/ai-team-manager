const { chromium } = require('playwright');
const fs = require('fs').promises;

class KanbanChecker {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    this.page = await this.browser.newPage();
  }

  async login() {
    console.log(`[Kanban] Navigating to ${this.config.url}...`);
    await this.page.goto(this.config.url);

    // Adjust selectors based on your actual kanban board
    await this.page.fill('input[name="email"], input[type="email"]', this.config.username);
    await this.page.fill('input[name="password"], input[type="password"]', this.config.password);
    await this.page.click('button[type="submit"], button:has-text("Login")');

    // Wait for navigation after login
    await this.page.waitForLoadState('networkidle');
    console.log('[Kanban] Logged in successfully');
  }

  async getAssignedTasks() {
    console.log('[Kanban] Fetching assigned tasks...');

    // Example selectors - adjust based on your kanban board structure
    const tasks = await this.page.evaluate(() => {
      // This is a generic example - customize for your specific kanban board
      const taskElements = document.querySelectorAll('.task-card, .kanban-task, [data-task]');
      const assignedTasks = [];

      taskElements.forEach((task) => {
        const assignee = task.querySelector('.assignee, .assigned-to')?.textContent || '';

        // Check if assigned to Claude/AI
        if (assignee.toLowerCase().includes('claude') ||
            assignee.toLowerCase().includes('ai') ||
            task.classList.contains('assigned-to-claude')) {

          assignedTasks.push({
            title: task.querySelector('.task-title, h3, .title')?.textContent?.trim() || 'Untitled',
            description: task.querySelector('.task-description, .description, p')?.textContent?.trim() || '',
            priority: task.querySelector('.priority')?.textContent?.trim() || 'normal',
            dueDate: task.querySelector('.due-date')?.textContent?.trim() || null,
            status: task.closest('.column, .status')?.querySelector('.column-title')?.textContent?.trim() || 'todo',
            id: task.getAttribute('data-task-id') || task.id || null
          });
        }
      });

      return assignedTasks;
    });

    console.log(`[Kanban] Found ${tasks.length} assigned task(s)`);
    return tasks;
  }

  async takeScreenshot(filename = 'kanban-board.png') {
    await this.page.screenshot({
      path: filename,
      fullPage: true
    });
    console.log(`[Kanban] Screenshot saved: ${filename}`);
  }

  async saveTasksToFile(tasks, filename = 'tasks.json') {
    await fs.writeFile(filename, JSON.stringify(tasks, null, 2));
    console.log(`[Kanban] Tasks saved to ${filename}`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('[Kanban] Browser closed');
    }
  }
}

// CLI usage
if (require.main === module) {
  const config = require('./config.json').kanban;

  (async () => {
    const checker = new KanbanChecker(config);

    try {
      await checker.initialize();
      await checker.login();
      await checker.takeScreenshot();

      const tasks = await checker.getAssignedTasks();
      await checker.saveTasksToFile(tasks);

      console.log('\n=== Assigned Tasks ===');
      tasks.forEach((task, i) => {
        console.log(`\n${i + 1}. ${task.title}`);
        console.log(`   Status: ${task.status}`);
        console.log(`   Priority: ${task.priority}`);
        if (task.dueDate) console.log(`   Due: ${task.dueDate}`);
      });

    } catch (error) {
      console.error('[Kanban] Error:', error.message);
      process.exit(1);
    } finally {
      await checker.close();
    }
  })();
}

module.exports = KanbanChecker;
