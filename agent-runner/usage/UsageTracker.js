const crypto = require('crypto');

class UsageTracker {
  constructor(taskAPI) {
    this.taskAPI = taskAPI;
  }

  _id() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return crypto.randomBytes(16).toString('hex');
  }

  async recordEvent(event) {
    if (!this.taskAPI || !event) return;
    try {
      await this.taskAPI.recordUsageEvent(event);
    } catch (err) {
      console.warn('[UsageTracker] Failed to record usage event:', err.message);
    }
  }

  buildClaudeUsageEvent(task, actorType, provider, model, usage, modelUsage, usageRaw, messageId = null, stepId = null) {
    if (!usage && !modelUsage && !usageRaw) return null;
    const normalized = usage || {};
    return {
      id: this._id(),
      task_id: task?.id || null,
      project_id: task?.project_id || null,
      team_id: task?.team_id || null,
      actor_type: actorType || null,
      provider: provider || 'claude',
      model: model || null,
      total_cost_usd: typeof normalized.total_cost_usd === 'number'
        ? normalized.total_cost_usd
        : (typeof normalized.cost_usd === 'number' ? normalized.cost_usd : null),
      input_tokens: Number.isFinite(normalized.input_tokens) ? normalized.input_tokens : null,
      output_tokens: Number.isFinite(normalized.output_tokens) ? normalized.output_tokens : null,
      cache_creation_input_tokens: Number.isFinite(normalized.cache_creation_input_tokens)
        ? normalized.cache_creation_input_tokens
        : null,
      cache_read_input_tokens: Number.isFinite(normalized.cache_read_input_tokens)
        ? normalized.cache_read_input_tokens
        : null,
      web_search_requests: Number.isFinite(normalized.web_search_requests) ? normalized.web_search_requests : null,
      service_tier: normalized.service_tier || null,
      message_id: messageId,
      step_id: stepId,
      usage_raw: {
        usage: normalized,
        modelUsage: modelUsage || null,
        raw: usageRaw || null
      }
    };
  }

  buildOpenAIUsageEvent(task, actorType, provider, model, usage, usageRaw) {
    if (!usage && !usageRaw) return null;
    const inputTokens = Number.isFinite(usage?.prompt_tokens)
      ? usage.prompt_tokens
      : (Number.isFinite(usage?.input_tokens) ? usage.input_tokens : null);
    const outputTokens = Number.isFinite(usage?.completion_tokens)
      ? usage.completion_tokens
      : (Number.isFinite(usage?.output_tokens) ? usage.output_tokens : null);
    return {
      id: this._id(),
      task_id: task?.id || null,
      project_id: task?.project_id || null,
      team_id: task?.team_id || null,
      actor_type: actorType || null,
      provider: provider || 'openai',
      model: model || null,
      total_cost_usd: null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      web_search_requests: null,
      service_tier: null,
      message_id: null,
      step_id: null,
      usage_raw: usageRaw || usage || null
    };
  }

  buildExecutionUsageEvent(task, actorType, provider, model, result) {
    if (!result) return null;
    return {
      id: this._id(),
      task_id: task?.id || null,
      project_id: task?.project_id || null,
      team_id: task?.team_id || null,
      actor_type: actorType || null,
      provider: provider || null,
      model: model || null,
      total_cost_usd: typeof result.cost === 'number' ? result.cost : null,
      input_tokens: null,
      output_tokens: Number.isFinite(result.tokens_used) ? result.tokens_used : null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      web_search_requests: null,
      service_tier: null,
      message_id: result.sessionId || null,
      step_id: null,
      usage_raw: {
        tokens_used: result.tokens_used || null,
        duration: result.duration || null,
        tools_used: result.toolsUsed || null
      }
    };
  }
}

module.exports = UsageTracker;
