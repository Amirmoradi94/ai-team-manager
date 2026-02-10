const fs = require('fs').promises;
const path = require('path');
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
      gemini: null
    };
  }

  async checkExternalStatus() {
    // 1. Check Claude via cusage (Main Stats)
    try {
      const { stdout: usageOut } = await execPromise('ccusage daily --json');
      const data = JSON.parse(usageOut);
      const today = new Date().toISOString().split('T')[0];
      const todayData = data.daily.find(d => d.date === today);
      
      if (todayData) {
        this.externalState.claudeStats = {
          tokens: todayData.totalTokens,
          cost: todayData.totalCost,
          updatedAt: Date.now()
        };
      }
    } catch (e) {
      // console.log('[ResourceManager] ccusage failed');
    }

    // 2. Check Claude via cmonitor (Safety Switch & Session Limits)
    try {
      const { stdout } = await execPromise('timeout 3 cmonitor --refresh-rate 1 --log-level INFO || true');
      
      const lines = stdout.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Messages Usage:')) {
          const dataLine = lines[i+1];
          const match = dataLine.match(/([\d.]+)%\s+(\d+)\s*\/\s*(\d+)/);
          if (match) {
            const used = parseInt(match[2]);
            const total = parseInt(match[3]);
            this.externalState.claude = {
              remaining5h: Math.max(0, total - used),
              remainingDay: Math.max(0, total - used),
              updatedAt: Date.now()
            };
            break;
          }
        }
      }

      if (stdout.includes('exceeded the maximum cost limit')) {
        this.externalState.claudePressure = 'high';
      } else {
        this.externalState.claudePressure = 'normal';
      }
    } catch (e) {
      // console.log('[ResourceManager] cmonitor sync error');
    }

    // 2. Check Gemini via gcloud or gemini-monitor
    try {
      // Placeholder for actual Gemini monitor command
      // Example: const { stdout } = await execPromise('gcloud alpha gemini quota list --format=json');
      // For now, we simulate or use a generic check if available
    } catch (e) {
      // console.log('[ResourceManager] Gemini monitor not available');
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
    } catch (e) {
      // No state file yet, start fresh
      this.usageLog = [];
      await this.checkExternalStatus();
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
      lines.push(`- 5h remaining: ${status.remaining5h}`);
      lines.push(`- Day remaining: ${status.remainingDay}`);
      lines.push(`- Window resets in: ${Math.round(status.windowResetIn / 60000)}min`);
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
    
    // Use external ground truth if fresh (< 15 mins)
    if (this.externalState[provider] && (now - this.externalState[provider].updatedAt < 15 * 60 * 1000)) {
      const ext = this.externalState[provider];
      const isOverBudget = provider === 'claude' && this.externalState.claudePressure === 'high';
      
      return {
        available: ext.remainingDay > 0 && !isOverBudget,
        remaining5h: ext.remaining5h,
        remainingDay: ext.remainingDay,
        windowResetIn: 0, // We don't have precise reset time from text parse yet
        reason: isOverBudget ? 'Cost limit exceeded' : (ext.remainingDay <= 0 ? 'No messages left' : ''),
        source: 'external'
      };
    }
    const reserved = this._getReserved(provider);

    // Use external monitor data if fresh (< 15 mins)
    const ext = this.externalState[provider];
    if (ext && (now - ext.updatedAt < 15 * 60 * 1000)) {
      const remaining5h = Math.max(0, ext.remaining5h - reserved);
      const remainingDay = Math.max(0, ext.remainingDay - reserved);
      const available = remaining5h > 0 && remainingDay > 0;
      
      return { 
        available, 
        remaining5h, 
        remainingDay, 
        windowResetIn: 0, // External monitor usually doesn't give precise reset time
        reason: available ? '' : 'External monitor reports limit reached',
        source: 'external'
      };
    }

    // Fallback to local tracking
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
