#!/usr/bin/env node

const { program } = require('commander');
const setup = require('../setup');
const AgentRunner = require('../agent-runner');
const fs = require('fs').promises;
const path = require('path');

program
  .name('agent-runner')
  .description('Local execution runner for AI Team Manager')
  .version('1.0.0');

program
  .command('connect')
  .description('Connect this machine to an AI Team Manager Project')
  .requiredOption('-t, --token <token>', 'Project Runner Token')
  .option('-u, --url <url>', 'Task Manager API URL', 'http://localhost:3001/api')
  .action(async (options) => {
    console.log(`🔌 Connecting to ${options.url}...`);
    
    // 1. Audit Environment
    await setup.checkAndInstallTools();

    // 2. Verify Token & Connection
    // (In a real app, we'd ping an endpoint to validate the token first)
    
    // 3. Save Configuration locally
    const configPath = path.join(__dirname, '../config.json');
    let currentConfig = {};
    try {
      const data = await fs.readFile(configPath, 'utf8');
      currentConfig = JSON.parse(data);
    } catch (e) {}

    currentConfig.taskManagerAPI = {
      apiUrl: options.url,
      // We don't need email/password for the runner anymore, just the project token
      // But our legacy API client expects it. For Phase 3, we'll keep using the token 
      // as a Bearer token in a special header or just adapt the client.
      projectToken: options.token
    };

    await fs.writeFile(configPath, JSON.stringify(currentConfig, null, 2));
    console.log('✅ Configuration saved.');

    // 4. Start the Runner
    console.log('🚀 Starting Agent Runner...');
    const runner = new AgentRunner();
    runner.start();
  });

program.parse();
