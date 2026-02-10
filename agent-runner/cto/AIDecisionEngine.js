/**
 * AIDecisionEngine - Uses actual AI models for CTO decision-making
 *
 * Leverages Gemini Pro, Claude Opus 4.5, or GPT-5.2 for:
 * - Intelligent task evaluation
 * - Complexity analysis with reasoning
 * - Strategic provider selection
 * - Smart verification
 */

class AIDecisionEngine {
  constructor(modelSelector, agentExecutor) {
    this.modelSelector = modelSelector;
    this.agentExecutor = agentExecutor;
  }

  /**
   * Use AI to analyze task complexity and recommend action
   * @param {object} task - { title, description }
   * @param {object} context - { availableProviders, resourceStatus, historicalData }
   * @returns {object} { action, reasoning, confidence, complexity }
   */
  async analyzeTask(task, context = {}) {
    const { title, description } = task;

    // Select best AI model for this analysis
    const modelSelection = this.modelSelector.selectModel('moderate');

    if (!modelSelection.model) {
      console.log('[CTO] No AI model available for decision-making. Falling back to rule-based.');
      return null; // Will use fallback logic
    }

    console.log(`[CTO] Using ${modelSelection.model} for task analysis...`);

    const prompt = `You are a CTO evaluating a software development task. Analyze this task and make a strategic decision.

**Task Title:** ${title}

**Task Description:**
${description || 'No description provided'}

**Context:**
- Available Providers: ${context.availableProviders?.join(', ') || 'claude, gemini, codex'}
- Resource Status: ${JSON.stringify(context.resourceStatus || {}).substring(0, 200)}
- Historical Success Rate: ${context.historicalData?.successRate || 'Unknown'}%

**Your role:**
Analyze the task and decide on ONE of these actions:
1. **EXECUTE** - Task is ready to execute by an agent
2. **SPLIT** - Task is too complex and should be broken into subtasks
3. **DEFER** - Not ready yet, defer to later (explain why)

**Analysis criteria:**
- Complexity: Is this simple, moderate, complex, or epic?
- Clarity: Are requirements clear enough to execute?
- Scope: Is it a single focused task or multiple tasks?
- Dependencies: Any blockers or prerequisites?
- Effort: Estimated time/difficulty?

Respond in JSON format:
{
  "action": "EXECUTE|SPLIT|DEFER",
  "complexity": "simple|moderate|complex|epic",
  "reasoning": "2-3 sentences explaining your decision",
  "recommendedProvider": "claude|gemini|codex",
  "confidence": 0-100,
  "estimatedMessages": 5-50,
  "riskFactors": ["list", "of", "risks"],
  "shouldSplit": true/false,
  "splitReason": "if shouldSplit is true, explain why"
}`;

    try {
      // Call AI model for analysis
      const result = await this.agentExecutor.execute({
        id: 'cto-analysis',
        title: 'CTO Task Analysis',
        description: prompt
      }, modelSelection.provider, modelSelection.model);

      if (!result.success || !result.output) {
        console.log('[CTO] AI analysis failed, falling back to rule-based');
        return null;
      }

      // Parse AI response
      const analysis = this._parseAIResponse(result.output);

      if (analysis) {
        console.log(`[CTO] AI Decision: ${analysis.action} (confidence: ${analysis.confidence}%)`);
        console.log(`[CTO] Reasoning: ${analysis.reasoning}`);

        // Record CTO usage
        this.modelSelector.resourceManager.trackCTOUsage(
          modelSelection.provider,
          result.messagesUsed || 1
        );
      }

      return analysis;

    } catch (error) {
      console.error('[CTO] AI analysis error:', error.message);
      return null; // Fallback to rule-based
    }
  }

  /**
   * Use AI to verify task completion
   */
  async verifyCompletion(task, result, modelName = null) {
    if (!result?.output || result.output.length < 10) {
      return { passed: false, missing: 'No output produced', score: 0 };
    }

    // Quick checks first (no AI needed)
    const hasReport = result.output.includes('---COMPLETION REPORT---');
    if (hasReport && result.output.length > 200) {
      return { passed: true, missing: '', score: 90 };
    }

    // Use AI for verification if output is ambiguous
    const modelSelection = modelName
      ? { model: modelName, provider: this._getProviderFromModel(modelName) }
      : this.modelSelector.selectModel('simple');

    if (!modelSelection.model) {
      // Fallback to simple heuristics
      if (result.success && result.output.length > 5000) {
        return { passed: true, missing: '', score: 75 };
      }
      return { passed: false, missing: 'Ambiguous output, no AI available', score: 40 };
    }

    console.log(`[CTO] Using ${modelSelection.model} for verification...`);

    const prompt = `You are a CTO verifying if a task was completed successfully.

**Original Task:** ${task.title}
**Description:** ${task.description?.substring(0, 500) || 'No description'}

**Agent Output:**
${result.output.substring(0, 10000)}

**Your job:**
Determine if the task was completed successfully and identify what's missing (if anything).

Respond in JSON format:
{
  "passed": true/false,
  "score": 0-100,
  "missing": "What's missing or incomplete (if passed=false)",
  "strengths": ["What", "was", "done", "well"],
  "concerns": ["Any", "issues", "or", "concerns"]
}`;

    try {
      const verificationResult = await this.agentExecutor.execute({
        id: 'cto-verification',
        title: 'CTO Verification',
        description: prompt
      }, modelSelection.provider, modelSelection.model);

      if (verificationResult.success && verificationResult.output) {
        const verification = this._parseAIResponse(verificationResult.output);

        if (verification) {
          console.log(`[CTO] Verification: ${verification.passed ? 'PASSED' : 'FAILED'} (score: ${verification.score})`);

          this.modelSelector.resourceManager.trackCTOUsage(
            modelSelection.provider,
            verificationResult.messagesUsed || 1
          );

          return verification;
        }
      }

      // Fallback
      return { passed: result.success, missing: '', score: 65 };

    } catch (error) {
      console.error('[CTO] Verification error:', error.message);
      return { passed: result.success, missing: '', score: 60 };
    }
  }

  /**
   * Parse AI JSON response
   */
  _parseAIResponse(output) {
    try {
      // Try to extract JSON from output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (error) {
      console.error('[CTO] Failed to parse AI response:', error.message);
      return null;
    }
  }

  _getProviderFromModel(modelName) {
    if (modelName.includes('gemini')) return 'gemini';
    if (modelName.includes('claude')) return 'claude';
    if (modelName.includes('gpt')) return 'openai';
    return 'claude';
  }
}

module.exports = AIDecisionEngine;
