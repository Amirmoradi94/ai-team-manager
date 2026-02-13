/**
 * Context Sync Helper
 *
 * Triggers context manager updates when entities change.
 * Ensures mycompany/ directory stays synchronized with database.
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ContextSync {
  constructor() {
    this.syncInProgress = false;
    this.pendingSync = false;
  }

  /**
   * Trigger full context sync via agent-runner
   * Debounced to avoid excessive syncs
   */
  async triggerFullSync() {
    // If sync already in progress, mark that another sync is needed
    if (this.syncInProgress) {
      this.pendingSync = true;
      return;
    }

    try {
      this.syncInProgress = true;

      // Call agent-runner sync script
      const agentRunnerPath = require('path').join(__dirname, '../../agent-runner');
      await execAsync(`cd ${agentRunnerPath} && npm run sync-context`, {
        timeout: 30000
      });

      console.log('[ContextSync] Full context sync completed');

      // If another sync was requested, do it now
      if (this.pendingSync) {
        this.pendingSync = false;
        this.syncInProgress = false;
        await this.triggerFullSync();
      }
    } catch (error) {
      console.error('[ContextSync] Sync failed:', error.message);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync after project changes
   */
  async syncAfterProjectChange(action, projectId, projectData = null) {
    console.log(`[ContextSync] Project ${action}: ${projectId}`);

    // Trigger full sync for now
    // TODO: Implement targeted sync
    await this.triggerFullSync();
  }

  /**
   * Sync after team changes
   */
  async syncAfterTeamChange(action, teamId, teamData = null) {
    console.log(`[ContextSync] Team ${action}: ${teamId}`);

    // Trigger full sync
    await this.triggerFullSync();
  }

  /**
   * Sync after employee changes
   */
  async syncAfterEmployeeChange(action, employeeId, employeeData = null) {
    console.log(`[ContextSync] Employee ${action}: ${employeeId}`);

    // Trigger full sync
    await this.triggerFullSync();
  }

  /**
   * Sync after task changes
   */
  async syncAfterTaskChange(action, taskId, taskData = null) {
    console.log(`[ContextSync] Task ${action}: ${taskId}`);

    // Only sync for significant changes
    if (action === 'created' || action === 'assigned' || action === 'completed') {
      await this.triggerFullSync();
    }
  }

  /**
   * Sync after user changes
   */
  async syncAfterUserChange(action, userId, userData = null) {
    console.log(`[ContextSync] User ${action}: ${userId}`);

    // Trigger full sync
    await this.triggerFullSync();
  }

  /**
   * Sync after team member assignment
   */
  async syncAfterTeamMemberChange(teamId, employeeId, action) {
    console.log(`[ContextSync] Team member ${action}: team=${teamId}, employee=${employeeId}`);

    // Trigger full sync
    await this.triggerFullSync();
  }

  /**
   * Sync after skill assignment
   */
  async syncAfterSkillChange(employeeId, skillIds, action) {
    console.log(`[ContextSync] Skills ${action} for employee: ${employeeId}`);

    // Trigger full sync
    await this.triggerFullSync();
  }

  /**
   * Sync after CTO decision
   */
  async syncAfterCTODecision(taskId, decision) {
    console.log(`[ContextSync] CTO decision for task: ${taskId}`);

    // Trigger full sync
    await this.triggerFullSync();
  }
}

// Singleton instance
const contextSync = new ContextSync();

module.exports = contextSync;
