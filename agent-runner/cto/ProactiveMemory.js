const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class ProactiveMemory {
  constructor(rootDir, assetsDir) {
    this.rootDir = rootDir;
    this.assetsDir = assetsDir;
    this.memoryDir = path.join(rootDir, 'memory');
    this.sessionStateFile = path.join(rootDir, 'SESSION-STATE.md');
    this.workingBufferFile = path.join(this.memoryDir, 'working-buffer.md');
  }

  async ensureStructure() {
    await fs.mkdir(this.rootDir, { recursive: true });
    await fs.mkdir(this.memoryDir, { recursive: true });

    const assetFiles = [
      'AGENTS.md',
      'HEARTBEAT.md',
      'MEMORY.md',
      'ONBOARDING.md',
      'SOUL.md',
      'TOOLS.md',
      'USER.md'
    ];

    for (const file of assetFiles) {
      const dest = path.join(this.rootDir, file);
      if (!fsSync.existsSync(dest)) {
        const src = path.join(this.assetsDir, file);
        if (fsSync.existsSync(src)) {
          await fs.copyFile(src, dest);
        } else {
          await fs.writeFile(dest, `# ${file}\n\n`, 'utf8');
        }
      }
    }

    if (!fsSync.existsSync(this.sessionStateFile)) {
      await fs.writeFile(this.sessionStateFile, '# SESSION-STATE.md\n\n**Status:** ACTIVE\n\n', 'utf8');
    }

    if (!fsSync.existsSync(this.workingBufferFile)) {
      await fs.writeFile(this.workingBufferFile, '# Working Buffer (Danger Zone Log)\n**Status:** ACTIVE\n**Started:** ' + new Date().toISOString() + '\n\n---\n', 'utf8');
    }
  }

  async appendDailyLog(entry) {
    const date = new Date();
    const fileName = `${date.toISOString().split('T')[0]}.md`;
    const dailyFile = path.join(this.memoryDir, fileName);
    const timestamp = date.toISOString();

    let existing = '';
    if (fsSync.existsSync(dailyFile)) {
      existing = await fs.readFile(dailyFile, 'utf8');
    } else {
      existing = `# Daily Log - ${fileName}\n\n`;
    }

    const block = `\n## ${timestamp}\n${entry.trim()}\n`;
    await fs.writeFile(dailyFile, existing + block, 'utf8');
  }

  async updateSessionState(lines) {
    await this.ensureStructure();
    const timestamp = new Date().toISOString();
    let existing = await fs.readFile(this.sessionStateFile, 'utf8');
    existing += `\n## ${timestamp}\n${lines.trim()}\n`;
    await fs.writeFile(this.sessionStateFile, existing, 'utf8');
  }

  async writeHeartbeat(report) {
    await this.ensureStructure();
    const file = path.join(this.rootDir, 'HEARTBEAT.md');
    const timestamp = new Date().toISOString();
    let existing = await fs.readFile(file, 'utf8');
    existing += `\n\n## Heartbeat @ ${timestamp}\n${report.trim()}\n`;
    await fs.writeFile(file, existing, 'utf8');
    await this.appendDailyLog(`**Heartbeat**\n${report.trim()}`);
  }

  async recordDecision(task, decision) {
    const summaryLines = [
      `**Task:** ${task.title} (${task.id})`,
      `**Action:** ${decision.action}`,
      decision.reason ? `**Reason:** ${decision.reason}` : null,
      decision.critical_decision ? `**Critical:** ${decision.critical_reason || 'yes'}` : null
    ].filter(Boolean).join('\n');
    await this.updateSessionState(summaryLines);
    await this.appendDailyLog(`**Decision**\n${summaryLines}`);
  }

  async recordOutcome(outcome) {
    const summaryLines = [
      `**Outcome:** ${outcome.success ? 'success' : 'failed'}`,
      `**Task:** ${outcome.title} (${outcome.taskId})`,
      `**Provider:** ${outcome.provider}`,
      outcome.reason ? `**Reason:** ${outcome.reason}` : null
    ].filter(Boolean).join('\n');
    await this.appendDailyLog(`**Outcome**\n${summaryLines}`);
  }
}

module.exports = ProactiveMemory;
