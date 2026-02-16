const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const CTOEngine = require('./CTOEngine');

test('CTOEngine initialization', async (t) => {
  const mockTaskAPI = {};
  const mockConfig = {
    enabled: true,
    strategy: 'balanced',
    ctoProvider: 'gemini-3-pro'
  };
  const teamLeadDir = path.join(__dirname, '..', 'team_lead');
  
  const cto = new CTOEngine(mockTaskAPI, mockConfig, teamLeadDir);
  
  assert.strictEqual(cto.enabled, true);
  assert.strictEqual(cto.strategy, 'balanced');
  assert.strictEqual(cto.ctoProvider, 'gemini-3-pro');
});

test('CTOEngine updateSettings', async (t) => {
  const cto = new CTOEngine({}, { enabled: true }, './team_lead');
  
  cto.updateSettings({
    enabled: false,
    strategy: 'aggressive',
    ctoProvider: 'claude-opus-4-5-20251101'
  });
  
  assert.strictEqual(cto.enabled, false);
  assert.strictEqual(cto.strategy, 'aggressive');
  assert.strictEqual(cto.ctoProvider, 'claude-opus-4-5-20251101');
  assert.strictEqual(cto.maxRetries, 3); // aggressive strategy
});

test('CTOEngine _inferDeadline', async (t) => {
  const cto = new CTOEngine({}, {}, './team_lead');
  
  const urgentDeadline = cto._inferDeadline('urgent');
  const now = new Date();
  const diffHours = (urgentDeadline - now) / (1000 * 60 * 60);
  
  assert.ok(diffHours > 23 && diffHours <= 25, 'Urgent deadline should be ~24 hours');
  
  const lowDeadline = cto._inferDeadline('low');
  const lowDiffDays = (lowDeadline - now) / (1000 * 60 * 60 * 24);
  assert.ok(lowDiffDays > 6 && lowDiffDays <= 8, 'Low deadline should be ~7 days');
});
