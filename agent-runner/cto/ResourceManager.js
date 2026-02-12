const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Subscription plan definitions
const PLANS = {
  claude: {
    none:    { per5h: 0,   perDay: 0    },
    pro:     { per5h: 45,  perDay: 216  },
    max5x:   { per5h: 225, perDay: 1080 },
    max20x:  { per5h: 900, perDay: 4320 }
  },
  gemini: {
    none:  { per5h: 0,        perDay: 0    },
    pro:   { per5h: Infinity, perDay: 100  },
    ultra: { per5h: Infinity, perDay: 500  }
  },
  codex: {
    none: { per5h: 0,   perDay: 0        },
    plus: { per5h: 90,  perDay: Infinity },
    pro:  { per5h: 900, perDay: Infinity }
  }
};

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

class ResourceManager {
  constructor(brainDir, subscriptions = {}) {
    this.brainDir = brainDir;
    // CTO state file (in cto/state/ directory, not runner_brain)
    this.stateFile = path.join(brainDir, 'RESOURCE_STATE.md');
    this.subscriptions = {
      claude: subscriptions.claude?.plan || 'max5x',
      gemini: subscriptions.gemini?.plan || 'ultra',
      codex:  subscriptions.codex?.plan  || 'plus'
    };
    // In-memory usage log: [{ provider, timestamp, messagesUsed, taskId, isCTO }]
    this.usageLog = [];
    // Active reservations
    this.reservations = new Map();
    this._nextReservationId = 1;
    // Real-time data from external monitors
    this.externalState = {
      claude: null,
      gemini: null,
      codex: null
    };
  }

  async checkExternalStatus() {
    console.log('[ResourceManager] Starting external status check...');
    
    // 1. Check Claude Authentication
    await this._checkClaudeAuth();
    
    // 2. Check Gemini Authentication
    await this._checkGeminiAuth();
    
    // 3. Check Codex Authentication
    await this._checkCodexAuth();
  }

  /**
   * Check Claude CLI authentication status
   */
  async _checkClaudeAuth() {
    try {
      // 1. Direct File Check (~/.claude.json) - Highest Reliability
      try {
        const homeDir = os.homedir();
        const claudeConfigPath = path.join(homeDir, '.claude.json');
        const configData = await fs.readFile(claudeConfigPath, 'utf-8');
        const config = JSON.parse(configData);
        
        if (config.hasAvailableSubscription === false) {
          console.log('[ResourceManager] Claude Subscription: NOT AVAILABLE (detected in .claude.json)');
          this.externalState.claudeAuth = { needsAuth: true, reason: 'Subscription required', updatedAt: Date.now() };
          this.externalState.claude = { remaining5h: 0, remainingDay: 0, updatedAt: Date.now() };
          return; // Exit early, no need to run CLI
        }
      } catch (fileError) {
        // File not found or unreadable, continue to CLI check
      }

      // 2. CLI Check (Fallback)
      // Try a simple, quick command to test authentication
      // Using --version or help to check if authenticated
      const { stdout, stderr } = await execPromise('claude --version', { timeout: 5000 });
      const output = (stdout + stderr).toLowerCase();
      
      // Check for authentication errors
      if (output.includes('401') || 
          output.includes('unauthorized') || 
          output.includes('not authenticated') ||
          output.includes('please log in') ||
          output.includes('login') ||
          output.includes('session expired') ||
          output.includes('reauthenticate')) {
        this.externalState.claudeAuth = { needsAuth: true, reason: 'Claude not authenticated', updatedAt: Date.now() };
      } else {
        // Claude is authenticated - now try to get usage info via cmonitor
        this.externalState.claudeAuth = { needsAuth: false, updatedAt: Date.now() };
        
        try {
          const { stdout: monitorOut } = await execPromise('cmonitor --refresh-rate 1 --log-level INFO', { timeout: 5000 });
          const lines = monitorOut.split('\n');
          let synced = false;
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Messages Usage:')) {
              const dataLine = lines[i+1];
              if (dataLine) {
                const match = dataLine.match(/([\d.]+)%\s+(\d+)\s*\/\s*(\d+)/);
                if (match) {
                  const used = parseInt(match[2]);
                  const total = parseInt(match[3]);
                  this.externalState.claude = {
                    remaining5h: Math.max(0, total - used),
                    remainingDay: Math.max(0, total - used),
                    updatedAt: Date.now()
                  };
                  synced = true;
                  break;
                }
              }
            }
          }
          
          if (!synced) throw new Error('Could not parse cmonitor output');
          
        } catch (monitorError) {
          // Fallback to default pro values if cmonitor fails
          this.externalState.claude = {
            remaining5h: 45,
            remainingDay: 216,
            updatedAt: Date.now()
          };
        }
      }
    } catch (error) {
      const errorMsg = error.message.toLowerCase();
      
      // Check if it's an authentication issue
      if (errorMsg.includes('401') || 
          errorMsg.includes('unauthorized') ||
          errorMsg.includes('not authenticated') ||
          errorMsg.includes('login') ||
          errorMsg.includes('session') ||
          errorMsg.includes('reauth')) {
        this.externalState.claudeAuth = { needsAuth: true, reason: 'Claude session expired or not logged in', updatedAt: Date.now() };
      } else if (errorMsg.includes('not found') || errorMsg.includes('command not found')) {
        this.externalState.claudeAuth = { needsAuth: true, reason: 'Claude CLI not installed', updatedAt: Date.now() };
      } else {
        // Unknown error - assume auth issue to prompt user
        this.externalState.claudeAuth = { needsAuth: true, reason: 'Unable to verify Claude authentication', updatedAt: Date.now() };
      }
      this.externalState.claude = { remaining5h: 0, remainingDay: 0, updatedAt: Date.now() };
    }
  }

  /**
   * Check Gemini CLI authentication status
   */
  async _checkGeminiAuth() {
    try {
      // Try gemini --version to check if authenticated
      const { stdout, stderr } = await execPromise('gemini --version', { timeout: 5000 });
      const output = (stdout + stderr).toLowerCase();
      
      // Gemini version command works, but we need to check if authenticated for actual usage
      // Try a simple prompt to test authentication
      try {
        const { stdout: testOut, stderr: testErr } = await execPromise(
          'echo "test" | gemini -p "respond with only the word OK"',
          { timeout: 8000, maxBuffer: 1024 }
        );
        const testOutput = (testOut + testErr).toLowerCase();
        
        if (testOutput.includes('ok') || 
            (!testOutput.includes('401') && !testOutput.includes('unauthorized') && !testOutput.includes('error'))) {
          // Gemini is working - set default healthy status
          // Gemini CLI doesn't expose usage limits directly, so we assume healthy
          this.externalState.geminiAuth = { needsAuth: false, updatedAt: Date.now() };
          this.externalState.gemini = {
            remaining5h: 1000, // Infinite for practical purposes
            remainingDay: 500, // Ultra plan daily limit
            updatedAt: Date.now()
          };
        } else if (testOutput.includes('401') || 
                   testOutput.includes('unauthorized') || 
                   testOutput.includes('not authenticated') ||
                   testOutput.includes('authentication') ||
                   testOutput.includes('please log in') ||
                   testOutput.includes('login')) {
          this.externalState.geminiAuth = { needsAuth: true, reason: 'Gemini not authenticated', updatedAt: Date.now() };
          this.externalState.gemini = { remaining5h: 0, remainingDay: 0, updatedAt: Date.now() };
        }
      } catch (testError) {
        const testErrorMsg = testError.message.toLowerCase();
        if (testErrorMsg.includes('401') || 
            testErrorMsg.includes('unauthorized') ||
            testErrorMsg.includes('not authenticated') ||
            testErrorMsg.includes('authentication') ||
            testErrorMsg.includes('login') ||
            testErrorMsg.includes('session')) {
          this.externalState.geminiAuth = { needsAuth: true, reason: 'Gemini session expired or not logged in', updatedAt: Date.now() };
        } else if (testErrorMsg.includes('not found') || testErrorMsg.includes('command not found')) {
          this.externalState.geminiAuth = { needsAuth: true, reason: 'Gemini CLI not installed', updatedAt: Date.now() };
        } else {
          // Other errors - might be rate limit or temporary, assume healthy
          this.externalState.geminiAuth = { needsAuth: false, updatedAt: Date.now() };
          this.externalState.gemini = {
            remaining5h: 1000,
            remainingDay: 500,
            updatedAt: Date.now()
          };
        }
      }
    } catch (error) {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('401') || 
          errorMsg.includes('unauthorized') ||
          errorMsg.includes('not authenticated') ||
          errorMsg.includes('authentication') ||
          errorMsg.includes('login') ||
          errorMsg.includes('session')) {
        this.externalState.geminiAuth = { needsAuth: true, reason: 'Gemini session expired or not logged in', updatedAt: Date.now() };
      } else if (errorMsg.includes('not found') || errorMsg.includes('command not found')) {
        this.externalState.geminiAuth = { needsAuth: true, reason: 'Gemini CLI not installed', updatedAt: Date.now() };
      } else {
        // Unknown error - assume healthy but log warning
        this.externalState.geminiAuth = { needsAuth: false, updatedAt: Date.now() };
        this.externalState.gemini = {
          remaining5h: 1000,
          remainingDay: 500,
          updatedAt: Date.now()
        };
      }
      this.externalState.gemini = { remaining5h: 0, remainingDay: 0, updatedAt: Date.now() };
    }
  }

  /**
   * Check Codex CLI authentication status
   */
  async _checkCodexAuth() {
    try {
      // Try a simple command to check if Codex is available and authenticated
      // Codex CLI might be 'codex' or part of OpenAI CLI
      const { stdout, stderr } = await execPromise('which codex 2>/dev/null || echo "not-found"', { timeout: 3000 });
      
      if (stdout.includes('not-found')) {
        this.externalState.codexAuth = { needsAuth: true, reason: 'Codex CLI not installed', updatedAt: Date.now() };
        this.externalState.codex = { remaining5h: 0, remainingDay: 0, updatedAt: Date.now() };
        return;
      }

      // Try to execute a simple test
      const { stdout: testOut, stderr: testErr } = await execPromise('codex --version 2>&1', { timeout: 3000 });
      const output = (testOut + testErr).toLowerCase();
      
      if (output.includes('401') || 
          output.includes('unauthorized') ||
          output.includes('not authenticated') ||
          output.includes('authentication') ||
          output.includes('login')) {
        this.externalState.codexAuth = { needsAuth: true, reason: 'Codex not authenticated', updatedAt: Date.now() };
      } else {
        this.externalState.codexAuth = { needsAuth: false, updatedAt: Date.now() };
        // Set default values for Codex
        this.externalState.codex = {
          remaining5h: 90,
          remainingDay: Infinity,
          updatedAt: Date.now()
        };
      }
    } catch (error) {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('401') || 
          errorMsg.includes('unauthorized') ||
          errorMsg.includes('not authenticated') ||
          errorMsg.includes('authentication') ||
          errorMsg.includes('login') ||
          errorMsg.includes('session')) {
        this.externalState.codexAuth = { needsAuth: true, reason: 'Codex session expired or not logged in', updatedAt: Date.now() };
      } else if (errorMsg.includes('not found') || errorMsg.includes('command not found')) {
        this.externalState.codexAuth = { needsAuth: true, reason: 'Codex CLI not installed', updatedAt: Date.now() };
      } else {
        // Other errors - assume needs auth to prompt user
        this.externalState.codexAuth = { needsAuth: true, reason: 'Unable to verify Codex status', updatedAt: Date.now() };
      }
      this.externalState.codex = { remaining5h: 0, remainingDay: 0, updatedAt: Date.now() };
    }
  }

  updateSubscriptions(subscriptions) {
    if (subscriptions.claude?.plan) this.subscriptions.claude = subscriptions.claude.plan;
    if (subscriptions.gemini?.plan) this.subscriptions.gemini = subscriptions.gemini.plan;
    if (subscriptions.codex?.plan)  this.subscriptions.codex  = subscriptions.codex.plan;
  }

  async loadState() {
    try {
      const content = await fs.readFile(this.stateFile, 'utf-8');
      const lines = content.split('\n');
      this.usageLog = [];

      let inTable = false;
      for (const line of lines) {
        if (line.startsWith('| provider')) { inTable = true; continue; }
        if (line.startsWith('|---')) continue;
        if (inTable && line.startsWith('|')) {
          const parts = line.split('|').map(s => s.trim()).filter(Boolean);
          if (parts.length >= 5) {
            this.usageLog.push({
              provider: parts[0],
              timestamp: new Date(parts[1]).getTime(),
              messagesUsed: parseInt(parts[2]) || 0,
              taskId: parts[3] || '',
              isCTO: parts[4] === 'true'
            });
          }
        }
      }
      this._pruneOldEntries();
      await this.checkExternalStatus();
      await this.persistState(); // Persist immediately after first check
    } catch (e) {
      // No state file yet, start fresh
      this.usageLog = [];
      await this.checkExternalStatus();
      await this.persistState();
    }
  }

  async persistState() {
    this._pruneOldEntries();

    const lines = [
      '# Resource State',
      '',
      `> Last updated: ${new Date().toISOString()}`,
      '',
      '## Subscriptions',
      '',
      `- Claude: ${this.subscriptions.claude}`,
      `- Gemini: ${this.subscriptions.gemini}`,
      `- Codex: ${this.subscriptions.codex}`,
      '',
      '## Usage Log (last 24h)',
      '',
      '| provider | timestamp | messagesUsed | taskId | isCTO |',
      '|----------|-----------|-------------|--------|-------|'
    ];

    for (const entry of this.usageLog) {
      lines.push(`| ${entry.provider} | ${new Date(entry.timestamp).toISOString()} | ${entry.messagesUsed} | ${entry.taskId} | ${entry.isCTO} |`);
    }

    lines.push('', '## Current Status', '');
    for (const provider of ['claude', 'gemini', 'codex']) {
      const status = this.checkAvailability(provider);
      lines.push(`### ${provider} (${this.subscriptions[provider]})`);
      lines.push(`- Available: ${status.available}`);
      lines.push(`- 5h remaining: ${status.remaining5h || 0}`);
      lines.push(`- Day remaining: ${status.remainingDay || 0}`);
      lines.push(`- Window resets in: ${Math.round((status.windowResetIn || 0) / 60000)}min`);
      lines.push('');
    }

    const dir = path.dirname(this.stateFile);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.stateFile, lines.join('\n'));
  }

  checkAvailability(provider) {
    const plan = this._getPlan(provider);
    if (!plan) {
      return { available: false, remaining5h: 0, remainingDay: 0, windowResetIn: 0, reason: `Unknown provider: ${provider}` };
    }

    const now = Date.now();
    
    // 1. Check for Auth issues (Highest Priority)
    const authState = this.externalState[`${provider}Auth`];
    if (authState?.needsAuth) {
      return {
        available: false,
        needsAuth: true,
        remaining5h: 0,
        remainingDay: 0,
        windowResetIn: 0,
        reason: 'Authentication required',
        source: 'external'
      };
    }

    const reserved = this._getReserved(provider);

    // 2. Use external ground truth if fresh (< 15 mins)
    const ext = this.externalState[provider];
    if (ext && (now - ext.updatedAt < 15 * 60 * 1000)) {
      const isOverBudget = provider === 'claude' && this.externalState.claudePressure === 'high';
      
      const remaining5h = Math.max(0, (ext.remaining5h || 0) - reserved);
      const remainingDay = Math.max(0, (ext.remainingDay || 0) - reserved);
      
      // FOR CLAUDE: Availability is based on CLI/Auth, not session limits (as requested)
      // FOR OTHERS: Standard limit-based availability
      const available = provider === 'claude' 
        ? true 
        : (remaining5h > 0 && remainingDay > 0 && !isOverBudget);

      return {
        available,
        remaining5h,
        remainingDay,
        windowResetIn: 0, 
        reason: isOverBudget ? 'Cost limit exceeded' : (available ? '' : 'External monitor reports limit reached'),
        source: 'external'
      };
    }

    // 3. Fallback to local tracking
    const used5h = this._getUsage(provider, now - FIVE_HOURS_MS, now);
    const usedDay = this._getUsage(provider, now - ONE_DAY_MS, now);

    const remaining5h = Math.max(0, plan.per5h - used5h - reserved);
    const remainingDay = Math.max(0, plan.perDay - usedDay - reserved);
    const available = remaining5h > 0 && remainingDay > 0;

    // Calculate window reset time
    const oldest5h = this._getOldestInWindow(provider, now - FIVE_HOURS_MS, now);
    const windowResetIn = oldest5h ? (oldest5h + FIVE_HOURS_MS - now) : 0;

    let reason = '';
    if (!available) {
      if (remaining5h <= 0) reason = `5h window exhausted (used ${used5h}/${plan.per5h})`;
      else reason = `Daily limit exhausted (used ${usedDay}/${plan.perDay})`;
    }

    return { available, remaining5h, remainingDay, windowResetIn, reason, source: 'local' };
  }

  reserve(provider, estimatedMessages) {
    const id = `res_${this._nextReservationId++}`;
    this.reservations.set(id, { provider, messages: estimatedMessages, timestamp: Date.now() });
    return id;
  }

  record(provider, actualMessages, taskId = '', isCTO = false) {
    this.usageLog.push({
      provider,
      timestamp: Date.now(),
      messagesUsed: actualMessages,
      taskId,
      isCTO
    });
  }

  release(reservationId) {
    this.reservations.delete(reservationId);
  }

  trackCTOUsage(provider, messages) {
    this.record(provider, messages, 'cto-internal', true);
  }

  getStatus() {
    const status = {};
    for (const provider of ['claude', 'gemini', 'codex']) {
      status[provider] = {
        plan: this.subscriptions[provider],
        ...this.checkAvailability(provider)
      };
    }
    return status;
  }

  getBestAvailable(candidates) {
    let best = null;
    let bestHeadroom = -1;

    for (const provider of candidates) {
      const status = this.checkAvailability(provider);
      if (!status.available) continue;
      const headroom = Math.min(status.remaining5h, status.remainingDay);
      if (headroom > bestHeadroom) {
        bestHeadroom = headroom;
        best = provider;
      }
    }

    return best;
  }

  // Private helpers

  _getPlan(provider) {
    const planName = this.subscriptions[provider];
    return PLANS[provider]?.[planName] || null;
  }

  _getUsage(provider, from, to) {
    return this.usageLog
      .filter(e => e.provider === provider && e.timestamp >= from && e.timestamp <= to)
      .reduce((sum, e) => sum + e.messagesUsed, 0);
  }

  _getReserved(provider) {
    let total = 0;
    for (const [, res] of this.reservations) {
      if (res.provider === provider) total += res.messages;
    }
    return total;
  }

  _getOldestInWindow(provider, from, to) {
    const entries = this.usageLog.filter(e => e.provider === provider && e.timestamp >= from && e.timestamp <= to);
    if (entries.length === 0) return null;
    return Math.min(...entries.map(e => e.timestamp));
  }

  _pruneOldEntries() {
    const cutoff = Date.now() - ONE_DAY_MS;
    this.usageLog = this.usageLog.filter(e => e.timestamp >= cutoff);
  }
}

module.exports = ResourceManager;
