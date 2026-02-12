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
    const modelSelection = this.modelSelector.selectModel('high');

    if (!modelSelection.model) {
      console.log('[CTO] No AI model available for decision-making. Falling back to rule-based.');
      return null; // Will use fallback logic
    }

    console.log(`[CTO] Using ${modelSelection.model} for task analysis...`);

    const prompt = `
<cto_role>
You are the **Chief Technology Officer (CTO)** powered by an advanced reasoning engine (Claude Opus 4.5 / Gemini 3 Pro).
Your job is **STRATEGIC ARCHITECTURE & ORCHESTRATION**.

You do not write code. You design the solution and **DELEGATE** execution to your Team Lead.
You must use your **THINKING CAPABILITIES** to plan a robust, production-grade implementation.
</cto_role>

<task>
Title: ${title}
Description: ${description || 'No description provided'}
Project: ${task.project_name || 'Unknown'}
</task>

<context>
Available Providers: ${context.availableProviders?.join(', ') || 'claude, gemini, codex'}
Resources: ${JSON.stringify(context.resourceStatus || {}).substring(0, 200)}
History: ${JSON.stringify(context.historicalData)}
Available Specialists: ${JSON.stringify(context.specialists || [])}
</context>

<instructions>
1. **THINK FIRST**: Output a <thinking> block. Analyze the requirements, architecture, dependencies, and risks. Plan the sequence of operations.
2. **DESIGN THE CONTRACT**: For the Team Lead, you must define:
   - **Strategy**: How should they approach this?
   - **Subtasks**: If complex, break it down sequentially.
   - **Roles**: Which specialists (from context) are best suited?

3. **DECIDE**:
   - **EXECUTE**: If it's a single, cohesive unit of work.
   - **SPLIT**: If it requires distinct phases (e.g., "Design -> Backend -> Frontend").
   - **DEFER**: Only if resources are critical.
</instructions>

<output_format>
Return strictly JSON (after your thinking block):
{
  "action": "execute" | "split" | "defer",
  "reasoning": "Strategic justification...",
  "complexity": "simple" | "moderate" | "complex" | "epic",
  "interactionDepth": "one-shot" | "conversation",
  "confidence": number,
  "strategy_note": "High-level architectural guidance for the Team Lead",
  "subtasks": [ // REQUIRED if action is "split"
    {
      "title": "Clear Actionable Title",
      "objective": "What is the goal?",
      "inputs": "What data/files are needed? (e.g., Output of Task 1)",
      "guidelines": "Specific rules, constraints, or tech stack requirements",
      "expectedOutput": "Exact definition of done (e.g., 'schema.sql file with indexes')",
      "roles": ["List", "of", "relevant", "specialists"]
    }
  ]
}
</output_format>
    `.trim();

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
