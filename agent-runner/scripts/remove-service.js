#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

const platform = os.platform();
const homeDir = os.homedir();

console.log('🔧 Removing Agent Runner service...');

if (platform === 'darwin') {
  const serviceName = 'com.ai-team.agent-runner';
  const plistPath = path.join(homeDir, 'Library', 'LaunchAgents', `${serviceName}.plist`);

  if (fs.existsSync(plistPath)) {
    try {
      // Unload the service
      spawnSync('launchctl', ['unload', plistPath], { stdio: 'ignore' });

      // Remove plist file
      fs.unlinkSync(plistPath);
      console.log('✅ Agent Runner service removed');
    } catch (error) {
      console.error('❌ Error removing service:', error.message);
    }
  } else {
    console.log('ℹ️  No service found to remove');
  }
} else {
  console.log('ℹ️  Service removal not needed on this platform');
}
