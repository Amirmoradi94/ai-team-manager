// Provider Intelligence: Maps task types to optimal providers.
// All logic is LOCAL - zero AI messages consumed.

const PROVIDER_MATRIX = {
  research:     ['gemini', 'claude', 'codex'],
  planning:     ['gemini', 'claude', 'codex'],
  docs:         ['gemini', 'claude', 'codex'],
  documentation:['gemini', 'claude', 'codex'],
  coding:       ['claude', 'codex', 'gemini'],
  debugging:    ['claude', 'codex', 'gemini'],
  api:          ['claude', 'codex', 'gemini'],
  bugfix:       ['claude', 'codex', 'gemini'],
  architecture: ['claude', 'gemini', 'claude'],
  critical:     ['claude', 'gemini', 'claude'],
  design:       ['claude', 'gemini', 'claude'],
  scripting:    ['codex', 'claude', 'gemini'],
  quick:        ['codex', 'claude', 'gemini'],
  automation:   ['codex', 'claude', 'gemini'],
  general:      ['claude', 'gemini', 'codex']
};

// Keywords to classify task types
const TASK_TYPE_KEYWORDS = {
  research:     ['research', 'analyze', 'investigate', 'study', 'review', 'audit', 'explore'],
  planning:     ['plan', 'roadmap', 'strategy', 'outline', 'scope', 'proposal', 'spec'],
  docs:         ['document', 'readme', 'docs', 'wiki', 'guide', 'manual', 'write up'],
  coding:       ['implement', 'build', 'create', 'develop', 'code', 'feature', 'add'],
  debugging:    ['fix', 'bug', 'debug', 'error', 'issue', 'broken', 'crash', 'failing'],
  api:          ['api', 'endpoint', 'rest', 'graphql', 'webhook', 'integration'],
  architecture: ['architect', 'refactor', 'restructure', 'migrate', 'redesign', 'overhaul'],
  critical:     ['critical', 'urgent', 'security', 'vulnerability', 'production', 'hotfix'],
  scripting:    ['script', 'automate', 'cron', 'cli', 'tool', 'utility', 'helper'],
  quick:        ['simple', 'quick', 'minor', 'tweak', 'update', 'change', 'rename']
};

class ProviderIntelligence {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
  }

  /**
   * Classify a task by analyzing title + description keywords.
   * Returns the best matching task type.
   */
  classifyTask(title, description = '') {
    const text = `${title} ${description}`.toLowerCase();
    let bestType = 'general';
    let bestScore = 0;

    for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    return bestType;
  }

  /**
   * Select the best provider for a task.
   * Respects CEO preference, falls back to CTO's ranked selection.
   *
   * @param {object} task - { title, description }
   * @param {object} identity - Team lead identity with model_config
   * @returns {{ provider: string, model: string, reason: string }}
   */
  selectProvider(task, identity = {}) {
    // 1. Check CEO preference (set on team lead's model_config)
    let ceoProvider = null;
    try {
      const config = typeof identity.model_config === 'string'
        ? JSON.parse(identity.model_config)
        : identity.model_config;
      if (config?.provider && config.provider !== 'auto') {
        ceoProvider = config.provider;
      }
    } catch (e) { /* ignore parse errors */ }

    // 2. If CEO explicitly set a provider, try to use it
    if (ceoProvider) {
      const status = this.resourceManager.checkAvailability(ceoProvider);
      if (status.available) {
        return {
          provider: ceoProvider,
          model: this._getModel(ceoProvider),
          reason: `CEO preference: ${ceoProvider} (available)`
        };
      }
      // CEO's choice unavailable, fall through to CTO selection
      console.log(`[CTO] CEO preferred ${ceoProvider} is unavailable: ${status.reason}. Falling back.`);
    }

    // 3. CTO ranked selection based on task classification
    const taskType = this.classifyTask(task.title, task.description);
    const ranked = PROVIDER_MATRIX[taskType] || PROVIDER_MATRIX.general;

    for (const provider of ranked) {
      const status = this.resourceManager.checkAvailability(provider);
      if (status.available) {
        return {
          provider,
          model: this._getModel(provider),
          reason: `CTO selected: ${provider} for ${taskType} task (ranked #${ranked.indexOf(provider) + 1})`
        };
      }
    }

    // 4. Last resort: find any available provider
    const fallback = this.resourceManager.getBestAvailable(['claude', 'gemini', 'codex']);
    if (fallback) {
      return {
        provider: fallback,
        model: this._getModel(fallback),
        reason: `Fallback: all ranked providers exhausted, using ${fallback}`
      };
    }

    // 5. Nothing available
    return {
      provider: null,
      model: null,
      reason: 'All providers exhausted. Deferring task.'
    };
  }

  _getModel(provider) {
    switch (provider) {
      case 'claude': return 'sonnet';
      case 'gemini': return 'pro';
      case 'codex':  return 'default';
      default: return 'default';
    }
  }
}

module.exports = ProviderIntelligence;
