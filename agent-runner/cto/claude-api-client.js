const Anthropic = require('@anthropic-ai/sdk');

class ClaudeApiClient {
  constructor(apiKey) {
    this.client = new Anthropic({ apiKey });
  }

  async completeJson({ model, system, prompt, maxTokens = 2048, thinking = null }) {
    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: prompt }],
      ...(thinking ? { thinking } : {})
    });

    const text = Array.isArray(response.content)
      ? response.content.map(c => c.text || '').join('')
      : response.content?.text || '';

    return {
      text: text.trim(),
      usage: response.usage || null,
      modelUsage: response.model_usage || response.modelUsage || null,
      raw: response
    };
  }
}

module.exports = ClaudeApiClient;
