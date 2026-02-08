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
  .description('Connect this machine to an AI Team Manager Project (runs in foreground)')
  .requiredOption('-t, --token <token>', 'Project Runner Token')
  .option('-u, --url <url>', 'Task Manager API URL', 'http://localhost:3001/api')
  .action(async (options) => {
    console.log(`🔌 Connecting to ${options.url}...`);

    // 1. Audit Environment
    await setup.checkAndInstallTools();

    // 2. Save Configuration locally
    const configPath = path.join(__dirname, '../config.json');
    let currentConfig = {};
    try {
      const data = await fs.readFile(configPath, 'utf8');
      currentConfig = JSON.parse(data);
    } catch (e) {}

    currentConfig.taskManagerAPI = {
      apiUrl: options.url,
      runnerToken: options.token,
      projectToken: options.token
    };

    await fs.writeFile(configPath, JSON.stringify(currentConfig, null, 2));
    console.log('✅ Configuration saved.');

    // 4. Start the Runner
    console.log('🚀 Starting Agent Runner...');
    const runner = new AgentRunner(currentConfig);
    runner.start();
  });

program
  .command('start')
  .description('Start the agent runner in background (daemon mode)')
  .requiredOption('-t, --token <token>', 'Runner Token')
  .option('-u, --url <url>', 'Task Manager API URL', 'http://localhost:3001/api')
  .action(async (options) => {
    const { spawn } = require('child_process');
    const os = require('os');

    console.log('🚀 Starting Agent Runner in background...');

    // 1. Audit Environment
    await setup.checkAndInstallTools();

    // 2. Save Configuration
    const configPath = path.join(__dirname, '../config.json');
    let currentConfig = {};
    try {
      const data = await fs.readFile(configPath, 'utf8');
      currentConfig = JSON.parse(data);
    } catch (e) {}

    currentConfig.taskManagerAPI = {
      apiUrl: options.url,
      runnerToken: options.token,
      projectToken: options.token
    };

    await fs.writeFile(configPath, JSON.stringify(currentConfig, null, 2));

    // 3. Start in background
    const logFile = path.join(os.homedir(), '.agent-runner.log');
    const pidFile = path.join(os.homedir(), '.agent-runner.pid');

    const child = spawn('node', [path.join(__dirname, '../daemon.js')], {
      detached: true,
      stdio: 'ignore'
    });

    child.unref();

    await fs.writeFile(pidFile, child.pid.toString());

    console.log('✅ Agent Runner started in background');
    console.log(`📋 PID: ${child.pid}`);
    console.log(`📝 Logs: ${logFile}`);
    console.log('');
    console.log('Commands:');
    console.log('  - Stop:   npx agent-runner stop');
    console.log('  - Status: npx agent-runner status');
    console.log('  - Logs:   tail -f ~/.agent-runner.log');

    process.exit(0);
  });

program
  .command('stop')
  .description('Stop the background agent runner')
  .action(async () => {
    const os = require('os');
    const pidFile = path.join(os.homedir(), '.agent-runner.pid');

    try {
      const pid = await fs.readFile(pidFile, 'utf8');
      process.kill(parseInt(pid), 'SIGTERM');
      await fs.unlink(pidFile);
      console.log('✅ Agent Runner stopped');
    } catch (e) {
      console.log('❌ No running agent runner found');
    }
  });

program
  .command('status')
  .description('Check agent runner status')
  .action(async () => {
    const os = require('os');
    const pidFile = path.join(os.homedir(), '.agent-runner.pid');

    try {
      const pid = await fs.readFile(pidFile, 'utf8');
      // Check if process is running
      try {
        process.kill(parseInt(pid), 0);
        console.log('✅ Agent Runner is running');
        console.log(`📋 PID: ${pid}`);
      } catch (e) {
        await fs.unlink(pidFile);
        console.log('❌ Agent Runner is not running (stale PID file removed)');
      }
    } catch (e) {
      console.log('❌ Agent Runner is not running');
    }
  });

program.parse();
