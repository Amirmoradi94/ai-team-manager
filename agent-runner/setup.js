const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class EnvironmentSetup {
  constructor() {
    this.requiredTools = [
      { 
        name: 'claude', 
        checkCmd: 'claude --version', 
        installCmd: 'npm install -g @anthropic-ai/claude-code' 
      },
      // Assuming these package names for the sake of the prototype
      { 
        name: 'gemini', 
        checkCmd: 'gemini --version', 
        installCmd: 'npm install -g @google/gemini-cli' 
      },
      { 
        name: 'codex', 
        checkCmd: 'codex --version', 
        installCmd: 'npm install -g @openai/codex-cli' 
      }
    ];
  }

  async checkAndInstallTools() {
    console.log('
🔍 Auditing local AI environment...');
    
    for (const tool of this.requiredTools) {
      process.stdout.write(`   - Checking ${tool.name}... `);
      
      try {
        await execAsync(tool.checkCmd);
        console.log('✅ Installed');
      } catch (e) {
        console.log('❌ Missing');
        await this.installTool(tool);
      }
    }
    
    console.log('
✨ Environment ready.
');
  }

  async installTool(tool) {
    console.log(`     📦 Auto-installing ${tool.name}... (this may take a moment)`);
    try {
      await execAsync(tool.installCmd);
      console.log(`     ✅ Successfully installed ${tool.name}`);
    } catch (error) {
      console.error(`     ⚠️ Failed to install ${tool.name}. Please install manually: ${tool.installCmd}`);
      // We don't throw here to allow partial setup
    }
  }

  /**
   * Inject dynamic configuration for specific tools before execution
   * e.g. Updating Claude's allowed_tools list based on the Specialist definition
   */
  async configureToolProfile(provider, identity, specialists) {
    if (provider === 'claude') {
      await this._configureClaude(identity, specialists);
    }
    // Add handlers for other providers
  }

  async _configureClaude(identity, specialists) {
    // Example: Create a temporary config file or update the global one
    // Ideally, we avoid touching global config to prevent conflicts
    // Instead, we might rely on the prompt to constrain behavior
    // But for "Tools", we might need to register them via config if they are custom MCP tools
    
    // For now, this is a placeholder for where that logic lives
    // console.log(`[Setup] Configured Claude profile for ${identity.name}`);
  }
}

module.exports = new EnvironmentSetup();
