const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const TaskHistoryManager = require('./TaskHistoryManager');

const TEMP_DIR = path.join(os.tmpdir(), 'cto-test-' + Date.now());

test('TaskHistoryManager recordOutcome and persistence', async (t) => {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  const manager = new TaskHistoryManager(TEMP_DIR);
  
  await manager.recordOutcome({
    taskId: '123',
    title: 'Test Task',
    taskType: 'task',
    provider: 'claude',
    success: true,
    reason: 'Completed successfully',
    complexity: { level: 'moderate', score: 35 },
    attempts: 1
  });
  
  assert.strictEqual(manager.summary.totalTasks, 1);
  assert.strictEqual(manager.summary.successRate, 100);
  
  await manager.persistState();
  
  // Create a new manager to load from the same directory
  const manager2 = new TaskHistoryManager(TEMP_DIR);
  await manager2.loadState();
  
  assert.strictEqual(manager2.summary.totalTasks, 1);
  assert.strictEqual(manager2.summary.successRate, 100);
  
  // Cleanup
  await fs.rm(TEMP_DIR, { recursive: true, force: true });
});

test('TaskHistoryManager getInsights', async (t) => {
  const manager = new TaskHistoryManager(TEMP_DIR);
  
  // 2 successes for claude
  await manager.recordOutcome({
    taskId: '1', title: 'Task 1', provider: 'claude', success: true, taskType: 'coding', retries: 0
  });
  await manager.recordOutcome({
    taskId: '2', title: 'Task 2', provider: 'claude', success: true, taskType: 'coding', retries: 0
  });
  
  // 1 failure for gemini
  await manager.recordOutcome({
    taskId: '3', title: 'Task 3', provider: 'gemini', success: false, taskType: 'coding', retries: 0
  });
  
  const insights = manager.getInsights();
  
  assert.strictEqual(insights.bestProvider, 'claude');
  assert.ok(insights.providerRankings.length >= 2);
  const claudeRank = insights.providerRankings.find(r => r.provider === 'claude');
  assert.strictEqual(claudeRank.successRate, 100);
});
