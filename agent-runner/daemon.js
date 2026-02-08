#!/usr/bin/env node

/**
 * Daemon script for running agent-runner in background
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const AgentRunner = require('./agent-runner');

// Setup logging
const logFile = path.join(os.homedir(), '.agent-runner.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Redirect console to log file
console.log = (...args) => {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${args.join(' ')}\n`);
};

console.error = console.log;

// Load config
const configPath = path.join(__dirname, 'config.json');
let config;

try {
  const configData = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configData);
} catch (e) {
  console.error('Failed to load config:', e.message);
  process.exit(1);
}

// Start runner
console.log('=== Agent Runner Daemon Starting ===');
const runner = new AgentRunner(config);
runner.start();

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
