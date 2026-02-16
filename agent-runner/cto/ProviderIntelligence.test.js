const test = require('node:test');
const assert = require('node:assert');
const ProviderIntelligence = require('./ProviderIntelligence');

const mockResourceManager = {
  checkAvailability: (provider) => {
    if (provider === 'claude') return { available: true };
    if (provider === 'gemini') return { available: true };
    if (provider === 'codex') return { available: false };
    return { available: false };
  }
};

test('ProviderIntelligence classifyTask', (t) => {
  const intel = new ProviderIntelligence(mockResourceManager);
  
  assert.strictEqual(intel.classifyTask('Fix a bug in the code'), 'debugging');
  assert.strictEqual(intel.classifyTask('Research new features'), 'research');
  assert.strictEqual(intel.classifyTask('Implement auth'), 'coding');
});

test('ProviderIntelligence selectProvider with CEO preference', (t) => {
  const intel = new ProviderIntelligence(mockResourceManager);
  const task = { title: 'New Task' };
  const identity = { model_config: JSON.stringify({ provider: 'gemini' }) };
  
  const selection = intel.selectProvider(task, identity);
  assert.strictEqual(selection.provider, 'gemini');
  assert.ok(selection.reason.includes('CEO preference'));
});

test('ProviderIntelligence selectProvider ranked fallback', (t) => {
  const intel = new ProviderIntelligence(mockResourceManager);
  // coding ranks: ['claude', 'codex', 'gemini']
  const task = { title: 'Implement feature' };
  
  const selection = intel.selectProvider(task);
  assert.strictEqual(selection.provider, 'claude');
});
