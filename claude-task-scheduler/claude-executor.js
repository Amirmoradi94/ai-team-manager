const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ClaudeExecutor {
  constructor(workDir = process.cwd()) {
    this.workDir = workDir;
    this.logsDir = path.join(workDir, 'logs');
  }

  async ensureLogsDir() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  /**
   * Execute a Claude Code task by opening a NEW Terminal window.
   * This creates true process isolation - the new Terminal is independent
   * from this Claude Code session, so nested Claude instances work perfectly.
   *
   * @param {string} prompt - The task prompt for Claude
   * @param {object} options - Execution options
   * @returns {Promise<{success: boolean, output: string, sessionId?: string, error?: string}>}
   */
  async executeTask(prompt, options = {}) {
    await this.ensureLogsDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionName = `claude-task-${timestamp}`;
    const outputFile = path.join(this.logsDir, `${sessionName}-output.jsonl`);
    const logFile = path.join(this.logsDir, `task-${timestamp}.log`);
    const promptFile = path.join(this.logsDir, `${sessionName}-prompt.txt`);
    const wrapperScript = path.join(this.logsDir, `${sessionName}-wrapper.sh`);

    console.log(`[Claude] Opening new Terminal window for task execution...`);
    console.log(`[Claude] Task: "${prompt.substring(0, 80)}..."`);
    console.log(`[Claude] Log: ${logFile}`);

    try {
      // Save prompt to file
      await fs.writeFile(promptFile, prompt);

      // Create wrapper script that runs claude and captures output
      const scriptContent = `#!/bin/bash
set -e

# IMPORTANT: Unset ANTHROPIC_API_KEY to use subscription instead of API mode
unset ANTHROPIC_API_KEY

cd /Users/amirmoradi94/Desktop/projects

# Run claude -p with output redirected to file (headless mode)
claude -p "$(cat ${promptFile})" \\
  --permission-mode bypassPermissions \\
  --output-format stream-json \\
  --verbose \\
  --add-dir /Users/amirmoradi94/Desktop \\
  --add-dir /Users/amirmoradi94/Desktop/projects \\
  > ${outputFile} 2>&1

exit $?
`;

      await fs.writeFile(wrapperScript, scriptContent);
      await fs.chmod(wrapperScript, '755');

      // Run script directly in background (headless mode)
      console.log(`[Claude] Launching task execution (headless)...`);
      await execAsync(`bash ${wrapperScript} > /dev/null 2>&1 &`);

      // Give the script time to start
      await this.sleep(500);

      console.log(`[Claude] Monitoring execution in background...`);
      console.log(`[Claude] Output will be saved to: ${logFile}`);

      // Monitor the output file for completion
      const result = await this.monitorOutputFile(outputFile, logFile, promptFile);

      // Cleanup temporary files
      try {
        await fs.unlink(wrapperScript);
        await fs.unlink(promptFile);
      } catch (e) {
        // Ignore cleanup errors
      }

      return result;

    } catch (error) {
      console.error(`[Claude] Error executing task:`, error.message);
      throw error;
    }
  }

  /**
   * Monitor the output file created by the Terminal window
   */
  async monitorOutputFile(outputFile, logFile, promptFile) {
    const maxWaitTime = 600000; // 10 minutes
    const checkInterval = 3000; // Check every 3 seconds
    const inactivityThreshold = 45000; // 45 seconds of no change = done
    const minRunTime = 15000; // Don't declare complete before 15s

    let lastSize = 0;
    let lastChangeTime = Date.now();
    const startTime = Date.now();

    let textOutput = '';
    let sessionId = null;
    let costUsd = null;
    let durationMs = null;
    let numTurns = null;
    let toolsUsed = [];
    let subagentsSpawned = [];

    while (Date.now() - startTime < maxWaitTime) {
      await this.sleep(checkInterval);

      try {
        const stats = await fs.stat(outputFile);
        const currentSize = stats.size;

        if (currentSize > lastSize) {
          // Read new content
          const fullContent = await fs.readFile(outputFile, 'utf-8');
          const newContent = fullContent.slice(lastSize);
          lastSize = currentSize;
          lastChangeTime = Date.now();

          // Parse stream-json output
          const lines = newContent.split('\n').filter(l => l.trim());
          for (const line of lines) {
            try {
              const event = JSON.parse(line);

              // System init event
              if (event.type === 'system' && event.subtype === 'init') {
                sessionId = event.session_id;
                console.log(`[Claude] Session initialized: ${sessionId}`);
              }

              // Assistant message - extract text
              if (event.type === 'assistant' && event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === 'text' && block.text) {
                    textOutput += block.text;
                    const snippet = block.text.replace(/\n/g, ' ').substring(0, 150);
                    if (snippet.trim()) {
                      console.log(`[Claude] ${snippet}`);
                    }
                  }
                  if (block.type === 'tool_use') {
                    const toolName = block.name || 'unknown';
                    toolsUsed.push(toolName);
                    if (toolName === 'Task') {
                      const subagentType = block.input?.subagent_type || 'unknown';
                      subagentsSpawned.push(subagentType);
                      console.log(`[Claude] 🤖 Spawning subagent: ${subagentType}`);
                    } else {
                      console.log(`[Claude] 🔧 Using tool: ${toolName}`);
                    }
                  }
                }
              }

              // Final result
              if (event.type === 'result') {
                if (event.result) textOutput = event.result;
                costUsd = event.cost_usd || event.total_cost_usd || null;
                durationMs = event.duration_ms || null;
                numTurns = event.num_turns || null;
                console.log(`[Claude] ✨ Execution complete`);
                console.log(`[Claude]    Cost: $${costUsd || 'N/A'}`);
                console.log(`[Claude]    Duration: ${durationMs ? (durationMs / 1000).toFixed(1) + 's' : 'N/A'}`);
                console.log(`[Claude]    Subagents: ${subagentsSpawned.length > 0 ? subagentsSpawned.join(', ') : 'none'}`);
              }
            } catch (e) {
              // Not JSON, might be debug output or plain text
              if (!line.includes('Debugger') && line.trim()) {
                textOutput += line + '\n';
              }
            }
          }
        } else if (
          Date.now() - lastChangeTime > inactivityThreshold &&
          Date.now() - startTime > minRunTime
        ) {
          console.log(`[Claude] No activity for ${inactivityThreshold / 1000}s, execution complete`);
          break;
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File doesn't exist yet, keep waiting
          continue;
        }
        console.error(`[Claude] Monitor error:`, error.message);
      }
    }

    // Read prompt
    let prompt = '';
    try {
      prompt = await fs.readFile(promptFile, 'utf-8');
    } catch (e) {
      // Ignore
    }

    // Save comprehensive log
    await fs.writeFile(logFile,
      `=== PROMPT ===\n${prompt}\n\n` +
      `=== TEXT OUTPUT ===\n${textOutput}\n\n` +
      `=== TOOLS USED ===\n${toolsUsed.join(', ') || 'None'}\n\n` +
      `=== SUBAGENTS SPAWNED ===\n${subagentsSpawned.join(', ') || 'None'}\n\n` +
      `=== SESSION ID ===\n${sessionId || 'N/A'}\n\n` +
      `=== COST ===\n$${costUsd || 'N/A'}\n` +
      `=== DURATION ===\n${durationMs ? (durationMs / 1000).toFixed(1) + 's' : 'N/A'}\n` +
      `=== TURNS ===\n${numTurns || 'N/A'}\n`
    );

    // Cleanup output file
    try {
      await fs.unlink(outputFile);
    } catch (e) {
      // Ignore
    }

    // Determine success
    if (textOutput.trim().length > 10) {
      console.log(`[Claude] ✅ Task completed successfully`);
      return {
        success: true,
        output: textOutput.trim(),
        logFile,
        sessionId,
        tokens_used: numTurns,
        cost: costUsd,
        duration: durationMs,
        toolsUsed,
        subagentsSpawned
      };
    } else {
      console.error(`[Claude] ❌ Task produced insufficient output`);
      return {
        success: false,
        output: textOutput.trim(),
        error: 'Task produced insufficient output',
        logFile,
        sessionId,
        tokens_used: numTurns,
        cost: costUsd
      };
    }
  }

  /**
   * Execute a task based on kanban task data
   */
  async executeKanbanTask(task, comments = []) {
    let conversationHistory = '';

    if (comments && comments.length > 0) {
      conversationHistory = '\n\n## Previous Work & Comments:\n';
      comments.forEach((comment, index) => {
        const commentType = comment.is_system ? 'Claude (previous work)' : `User: ${comment.user_name}`;
        conversationHistory += `\n### Comment ${index + 1} - ${commentType}:\n${comment.content}\n`;
      });
      conversationHistory += '\n---\n';
    }

    const userComments = comments.filter(c => !c.is_system);
    const latestUserComment = userComments.length > 0 ? userComments[userComments.length - 1] : null;

    const prompt = `
Task from Kanban Board:
Title: ${task.title}
Description: ${task.description}
Priority: ${task.priority}
Status: ${task.status}
${task.dueDate ? `Due Date: ${task.dueDate}` : ''}
${conversationHistory}
${latestUserComment ? `\n## NEW CHANGE REQUEST:\n${latestUserComment.content}\n\nPlease address this new request while taking into account any previous work shown above.` : '\nPlease analyze this task and complete it. You have access to the Task tool for spawning specialized subagents (frontend-developer, backend-developer, uiux-designer, QA-engineer, devops-engineer, ai-engineer, etc.) if needed.\n\nFor complex tasks, consider using subagents to delegate specialized work. For simple tasks, handle them directly.'}
    `.trim();

    return this.executeTask(prompt);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI usage
if (require.main === module) {
  const executor = new ClaudeExecutor();
  const testPrompt = process.argv[2] || "Say hello and tell me the current date";

  executor.executeTask(testPrompt)
    .then(result => {
      console.log('\n=== Result ===');
      console.log('Success:', result.success);
      console.log('Output length:', result.output?.length);
      console.log('Session ID:', result.sessionId);
      console.log('Subagents:', result.subagentsSpawned);
      console.log('Log file:', result.logFile);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = ClaudeExecutor;
