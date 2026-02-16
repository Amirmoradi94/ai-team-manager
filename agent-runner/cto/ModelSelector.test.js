const test = require('node:test');
const assert = require('node:assert');
const ModelSelector = require('./ModelSelector');

// Mock ResourceManager
const mockResourceManager = {
  checkAvailability: (provider) => {
    if (provider === 'claude') return { available: true, remaining5h: 10, remainingDay: 50 };
    if (provider === 'gemini') return { available: true, remaining5h: 100, remainingDay: 500 };
    if (provider === 'openai') return { available: false, reason: 'No credits' };
    return { available: false };
  }
};

test('ModelSelector initialization', (t) => {
  const selector = new ModelSelector(mockResourceManager);
  assert.ok(selector.preferredModels.length > 0);
});

test('ModelSelector selectModel for moderate task', (t) => {
  const selector = new ModelSelector(mockResourceManager);
  const selection = selector.selectModel('moderate');
  
  assert.ok(selection.model);
  assert.ok(selection.provider);
  // Based on mock, gemini or claude should be selected
  assert.ok(['gemini', 'claude'].includes(selection.provider));
});

test('ModelSelector selectModel for epic task (high capability)', (t) => {
  const selector = new ModelSelector(mockResourceManager);
  const selection = selector.selectModel('epic');
  
  // For epic, it should prefer high capability models
  // claude-opus-4-5-20251101 is highest in our mock (available)
  assert.strictEqual(selection.model, 'claude-opus-4-5-20251101');
  assert.strictEqual(selection.provider, 'claude');
});

test('ModelSelector handles unavailable providers', (t) => {
  const brokenResourceManager = {
    checkAvailability: () => ({ available: false })
  };
  const selector = new ModelSelector(brokenResourceManager);
  const selection = selector.selectModel('simple');
  
  assert.strictEqual(selection.model, null);
  assert.strictEqual(selection.error, true);
});
