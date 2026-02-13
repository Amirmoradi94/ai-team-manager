/**
 * ModelSelector - Selects the best AI model for CTO decision-making
 *
 * CTO uses actual AI models (Gemini Pro, Claude Opus, GPT-5.2) for:
 * - Task evaluation
 * - Complexity analysis
 * - Provider selection
 * - Verification
 */

const MODELS = {
  // Gemini models
  gemini: {
    'gemini-3-pro': {
      name: 'gemini-3-pro',
      provider: 'gemini',
      contextWindow: 1000000,
      costPer1kTokens: 0.002,
      speed: 'fast',
      capability: 'high'
    }
  },

  // Claude models
  claude: {
    'claude-opus-4.5': {
      name: 'claude-opus-4.5',
      provider: 'claude',
      contextWindow: 200000,
      costPer1kTokens: 0.015,
      speed: 'medium',
      capability: 'highest'
    },
    'claude-sonnet-4.5': {
      name: 'claude-sonnet-4.5',
      provider: 'claude',
      contextWindow: 200000,
      costPer1kTokens: 0.003,
      speed: 'fast',
      capability: 'high'
    },
    'claude-haiku-4.5': {
      name: 'claude-haiku-4.5',
      provider: 'claude',
      contextWindow: 200000,
      costPer1kTokens: 0.0008,
      speed: 'fastest',
      capability: 'medium'
    }
  },

  // OpenAI GPT models
  openai: {
    'gpt-5.2': {
      name: 'gpt-5.2',
      provider: 'openai',
      contextWindow: 128000,
      costPer1kTokens: 0.010,
      speed: 'fast',
      capability: 'highest'
    },
    'gpt-5.2-mini': {
      name: 'gpt-5.2-mini',
      provider: 'openai',
      contextWindow: 128000,
      costPer1kTokens: 0.002,
      speed: 'fastest',
      capability: 'high'
    },
    'gpt-4o': {
      name: 'gpt-4o',
      provider: 'openai',
      contextWindow: 128000,
      costPer1kTokens: 0.005,
      speed: 'fast',
      capability: 'high'
    }
  }
};

class ModelSelector {
  constructor(resourceManager, config = {}) {
    this.resourceManager = resourceManager;
    this.config = config;

    // CTO preferred models (in priority order)
    this.preferredModels = config.preferredModels || [
      'gemini-3-pro',
      'claude-opus-4.5',
      'gpt-5.2',
      'claude-sonnet-4.5',
      'gpt-5.2-mini',
      'claude-haiku-4.5'
    ];
  }

  /**
   * Select best available model for CTO decision-making
   * @param {string} taskComplexity - simple | moderate | complex | epic
   * @returns {object} { model, provider, reason }
   */
  selectModel(taskComplexity = 'moderate') {
    // For complex/epic tasks, prefer highest capability models
    const highCapabilityModels = [
      'claude-opus-4.5',
      'gpt-5.2',
      'gemini-3-pro'
    ];

    // For simple tasks, prefer fast/cheap models
    const efficientModels = [
      'claude-haiku-4.5',
      'gpt-5.2-mini'
    ];

    let candidateModels;
    if (taskComplexity === 'epic' || taskComplexity === 'complex') {
      candidateModels = [...highCapabilityModels, ...this.preferredModels];
    } else if (taskComplexity === 'simple') {
      candidateModels = [...efficientModels, ...this.preferredModels];
    } else {
      candidateModels = this.preferredModels;
    }

    // Remove duplicates
    candidateModels = [...new Set(candidateModels)];

    // Try each model in order
    for (const modelName of candidateModels) {
      const modelInfo = this._getModelInfo(modelName);
      if (!modelInfo) continue;

      // Check if provider is available
      const status = this.resourceManager.checkAvailability(modelInfo.provider);
      if (status.available) {
        return {
          model: modelName,
          provider: modelInfo.provider,
          capability: modelInfo.capability,
          reason: `CTO selected ${modelName} for ${taskComplexity} task (${modelInfo.capability} capability, ${status.remaining5h} messages remaining)`,
          costPer1k: modelInfo.costPer1kTokens
        };
      }
    }

    // No model available
    return {
      model: null,
      provider: null,
      reason: 'All CTO models exhausted. Cannot make decision.',
      error: true
    };
  }

  /**
   * Get model information
   */
  _getModelInfo(modelName) {
    for (const [provider, models] of Object.entries(MODELS)) {
      if (models[modelName]) {
        return models[modelName];
      }
    }
    return null;
  }

  /**
   * Get all available models
   */
  getAvailableModels() {
    const available = [];
    for (const modelName of this.preferredModels) {
      const info = this._getModelInfo(modelName);
      if (info) {
        const status = this.resourceManager.checkAvailability(info.provider);
        if (status.available) {
          available.push({
            model: modelName,
            provider: info.provider,
            remaining: Math.min(status.remaining5h, status.remainingDay),
            capability: info.capability
          });
        }
      }
    }
    return available;
  }

  /**
   * Estimate cost for a decision
   */
  estimateCost(modelName, estimatedTokens = 1000) {
    const info = this._getModelInfo(modelName);
    if (!info) return 0;
    return (estimatedTokens / 1000) * info.costPer1kTokens;
  }
}

module.exports = ModelSelector;
