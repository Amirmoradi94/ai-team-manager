const fs = require('fs').promises;
const path = require('path');

/**
 * TaskHistoryManager - Strategic CTO Memory
 *
 * Remembers:
 * - Overall task outcomes (success/fail)
 * - High-level patterns (not technical details)
 * - Provider effectiveness for task types
 * - Epic completion rates
 * - Team performance trends
 *
 * Does NOT remember:
 * - Code-level details (that's for team leads)
 * - Technical implementation specifics
 * - Debugging information
 */

class TaskHistoryManager {
  constructor(brainDir) {
    this.brainDir = brainDir;
    // CTO history files (in cto/state/ directory, not runner_brain)
    this.historyFile = path.join(brainDir, 'TASK_HISTORY.md');
    this.summaryFile = path.join(brainDir, 'STRATEGIC_SUMMARY.json');

    // In-memory cache for fast lookups
    this.history = [];
    this.summary = {
      totalTasks: 0,
      successRate: 0,
      providerPerformance: {},
      taskTypePatterns: {},
      epicCompletionRate: 0,
      lastUpdated: null
    };
  }

  async loadState() {
    try {
      // Load summary (fast access)
      const summaryContent = await fs.readFile(this.summaryFile, 'utf-8');
      this.summary = JSON.parse(summaryContent);
    } catch (e) {
      // Initialize new summary
      this.summary = {
        totalTasks: 0,
        successRate: 0,
        providerPerformance: {
          claude: { total: 0, success: 0, avgRetries: 0 },
          gemini: { total: 0, success: 0, avgRetries: 0 },
          codex:  { total: 0, success: 0, avgRetries: 0 }
        },
        taskTypePatterns: {},
        epicCompletionRate: 0,
        lastUpdated: null
      };
    }

    try {
      // Load recent history (last 100 tasks for context)
      const historyContent = await fs.readFile(this.historyFile, 'utf-8');
      const lines = historyContent.split('\n');
      this.history = [];

      for (const line of lines) {
        if (line.startsWith('| ') && !line.includes('taskId')) {
          const parts = line.split('|').map(s => s.trim()).filter(Boolean);
          if (parts.length >= 6) {
            this.history.push({
              taskId: parts[0],
              title: parts[1],
              type: parts[2],
              provider: parts[3],
              outcome: parts[4],
              reason: parts[5],
              timestamp: parts[6] || new Date().toISOString()
            });
          }
        }
      }

      // Keep only last 100 for memory efficiency
      if (this.history.length > 100) {
        this.history = this.history.slice(-100);
      }
    } catch (e) {
      this.history = [];
    }
  }

  /**
   * Record a task outcome (called after task completion)
   * @param {object} outcome - { taskId, title, taskType, provider, success, reason, retries, complexity }
   */
  async recordOutcome(outcome) {
    const record = {
      taskId: outcome.taskId,
      title: this._truncateTitle(outcome.title),
      type: outcome.taskType || 'task',
      provider: outcome.provider,
      outcome: outcome.success ? 'success' : 'failed',
      reason: this._extractHighLevelReason(outcome.reason, outcome.success),
      timestamp: new Date().toISOString()
    };

    // Add to history
    this.history.push(record);

    // Update summary statistics
    this._updateSummary(outcome);

    // Persist immediately (async, non-blocking)
    setImmediate(() => this.persistState().catch(console.error));
  }

  /**
   * Record epic task split
   */
  async recordEpicSplit(task, subtaskCount) {
    await this.recordOutcome({
      taskId: task.id,
      title: task.title,
      taskType: 'epic',
      provider: 'cto',
      success: true,
      reason: `Split into ${subtaskCount} subtasks`,
      retries: 0,
      complexity: 'epic'
    });
  }

  /**
   * Get insights for decision making
   */
  getInsights() {
    return {
      // Provider effectiveness
      bestProvider: this._getBestProvider(),
      providerRankings: this._rankProviders(),

      // Task patterns
      successRate: this.summary.successRate,
      epicSuccess: this.summary.epicCompletionRate,

      // Recent trends
      recentFailures: this._getRecentFailures(5),
      commonFailureReasons: this._getTopFailureReasons(3)
    };
  }

  /**
   * Get strategic context for a task type
   */
  getTaskTypeContext(taskType) {
    const pattern = this.summary.taskTypePatterns[taskType];
    if (!pattern) {
      return { known: false };
    }

    return {
      known: true,
      successRate: pattern.successRate,
      recommendedProvider: pattern.bestProvider,
      avgRetries: pattern.avgRetries,
      sampleSize: pattern.total
    };
  }

  /**
   * Get provider recommendation based on history
   */
  recommendProvider(taskType, candidates) {
    const context = this.getTaskTypeContext(taskType);

    if (context.known && context.sampleSize >= 5) {
      // Learned preference
      if (candidates.includes(context.recommendedProvider)) {
        return {
          provider: context.recommendedProvider,
          reason: `Historical data: ${Math.round(context.successRate)}% success rate for ${taskType} tasks`,
          confidence: Math.min(95, 60 + context.sampleSize)
        };
      }
    }

    // Fallback to best overall provider
    const best = this._getBestProvider();
    if (candidates.includes(best)) {
      return {
        provider: best,
        reason: `Best overall performer: ${Math.round(this.summary.providerPerformance[best].success / this.summary.providerPerformance[best].total * 100)}% success rate`,
        confidence: 70
      };
    }

    return null;
  }

  async persistState() {
    const dir = path.dirname(this.historyFile);
    await fs.mkdir(dir, { recursive: true });

    // Persist summary (JSON for fast loading)
    this.summary.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.summaryFile, JSON.stringify(this.summary, null, 2));

    // Persist history (Markdown for human readability)
    const lines = [
      '# Task History - Strategic Overview',
      '',
      `> Last updated: ${new Date().toISOString()}`,
      '',
      '## Summary Statistics',
      '',
      `- **Total Tasks**: ${this.summary.totalTasks}`,
      `- **Success Rate**: ${Math.round(this.summary.successRate)}%`,
      `- **Epic Completion**: ${Math.round(this.summary.epicCompletionRate)}%`,
      '',
      '## Provider Performance',
      '',
      '| Provider | Success Rate | Total Tasks | Avg Retries |',
      '|----------|--------------|-------------|-------------|'
    ];

    for (const [provider, stats] of Object.entries(this.summary.providerPerformance)) {
      if (stats.total > 0) {
        const successRate = Math.round((stats.success / stats.total) * 100);
        const avgRetries = (stats.avgRetries / stats.total).toFixed(1);
        lines.push(`| ${provider} | ${successRate}% | ${stats.total} | ${avgRetries} |`);
      }
    }

    lines.push('', '## Recent Task History (Last 100)', '');
    lines.push('| taskId | title | type | provider | outcome | reason | timestamp |');
    lines.push('|--------|-------|------|----------|---------|--------|-----------|');

    for (const record of this.history.slice(-100)) {
      lines.push(
        `| ${record.taskId} | ${record.title} | ${record.type} | ${record.provider} | ${record.outcome} | ${record.reason} | ${record.timestamp} |`
      );
    }

    await fs.writeFile(this.historyFile, lines.join('\n'));
  }

  // ========== PRIVATE HELPERS ==========

  _updateSummary(outcome) {
    // Total tasks
    this.summary.totalTasks++;

    // Provider performance
    const provider = outcome.provider;
    if (!this.summary.providerPerformance[provider]) {
      this.summary.providerPerformance[provider] = { total: 0, success: 0, avgRetries: 0 };
    }
    this.summary.providerPerformance[provider].total++;
    if (outcome.success) this.summary.providerPerformance[provider].success++;
    this.summary.providerPerformance[provider].avgRetries += outcome.retries || 0;

    // Task type patterns
    const taskType = this._classifyTaskType(outcome.title);
    if (!this.summary.taskTypePatterns[taskType]) {
      this.summary.taskTypePatterns[taskType] = {
        total: 0,
        success: 0,
        bestProvider: provider,
        avgRetries: 0
      };
    }
    const pattern = this.summary.taskTypePatterns[taskType];
    pattern.total++;
    if (outcome.success) pattern.success++;
    pattern.avgRetries += outcome.retries || 0;
    pattern.successRate = (pattern.success / pattern.total) * 100;

    // Update best provider for this task type
    this._updateBestProvider(taskType, provider, outcome.success);

    // Overall success rate
    const totalSuccess = Object.values(this.summary.providerPerformance)
      .reduce((sum, p) => sum + p.success, 0);
    this.summary.successRate = (totalSuccess / this.summary.totalTasks) * 100;

    // Epic completion rate
    const epics = this.history.filter(h => h.type === 'epic');
    if (epics.length > 0) {
      const epicSuccess = epics.filter(e => e.outcome === 'success').length;
      this.summary.epicCompletionRate = (epicSuccess / epics.length) * 100;
    }
  }

  _classifyTaskType(title) {
    const lower = title.toLowerCase();
    if (lower.includes('fix') || lower.includes('bug')) return 'debugging';
    if (lower.includes('implement') || lower.includes('build')) return 'coding';
    if (lower.includes('research') || lower.includes('analyze')) return 'research';
    if (lower.includes('refactor') || lower.includes('redesign')) return 'architecture';
    if (lower.includes('document') || lower.includes('readme')) return 'docs';
    return 'general';
  }

  _updateBestProvider(taskType, provider, success) {
    if (!success) return;

    const pattern = this.summary.taskTypePatterns[taskType];
    // Track provider success for this task type
    if (!pattern.providerStats) pattern.providerStats = {};
    if (!pattern.providerStats[provider]) {
      pattern.providerStats[provider] = { total: 0, success: 0 };
    }
    pattern.providerStats[provider].total++;
    if (success) pattern.providerStats[provider].success++;

    // Update best provider
    let bestProvider = pattern.bestProvider;
    let bestRate = 0;
    for (const [p, stats] of Object.entries(pattern.providerStats)) {
      const rate = stats.success / stats.total;
      if (rate > bestRate && stats.total >= 3) { // Need at least 3 samples
        bestRate = rate;
        bestProvider = p;
      }
    }
    pattern.bestProvider = bestProvider;
  }

  _getBestProvider() {
    let best = 'claude';
    let bestRate = 0;
    for (const [provider, stats] of Object.entries(this.summary.providerPerformance)) {
      if (stats.total === 0) continue;
      const rate = stats.success / stats.total;
      if (rate > bestRate) {
        bestRate = rate;
        best = provider;
      }
    }
    return best;
  }

  _rankProviders() {
    const providers = Object.entries(this.summary.providerPerformance)
      .filter(([, stats]) => stats.total > 0)
      .map(([provider, stats]) => ({
        provider,
        successRate: (stats.success / stats.total) * 100,
        totalTasks: stats.total
      }))
      .sort((a, b) => b.successRate - a.successRate);

    return providers;
  }

  _getRecentFailures(count) {
    return this.history
      .filter(h => h.outcome === 'failed')
      .slice(-count)
      .map(h => ({
        title: h.title,
        provider: h.provider,
        reason: h.reason
      }));
  }

  _getTopFailureReasons(count) {
    const reasons = {};
    this.history
      .filter(h => h.outcome === 'failed')
      .forEach(h => {
        reasons[h.reason] = (reasons[h.reason] || 0) + 1;
      });

    return Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([reason, count]) => ({ reason, count }));
  }

  _truncateTitle(title) {
    if (!title) return '(no title)';
    return title.length > 50 ? title.substring(0, 47) + '...' : title;
  }

  _extractHighLevelReason(reason, success) {
    if (success) {
      if (reason?.includes('Split into')) return reason;
      return 'Completed successfully';
    }

    // Extract high-level failure reasons (not technical details)
    if (!reason) return 'Unknown failure';

    const lower = reason.toLowerCase();
    if (lower.includes('timeout') || lower.includes('time out')) return 'Task timeout';
    if (lower.includes('rate limit') || lower.includes('exhausted')) return 'Rate limit hit';
    if (lower.includes('incomplete') || lower.includes('missing')) return 'Incomplete output';
    if (lower.includes('error') || lower.includes('failed')) return 'Execution error';
    if (lower.includes('complexity')) return 'High complexity';

    // Generic fallback
    return 'Task failed';
  }
}

module.exports = TaskHistoryManager;
