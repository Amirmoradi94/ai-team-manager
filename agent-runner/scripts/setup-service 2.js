#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const os = require('os');

const platform = os.platform();
const homeDir = os.homedir();
const packageDir = __dirname.replace('/scripts', '');

// Detect node path
const nodePathResult = spawnSync('which', ['node']);
const nodePath = nodePathResult.stdout.toString().trim() || '/usr/local/bin/node';

console.log('🔧 Setting up Agent Runner as a background service...');
console.log(`📍 Node path: ${nodePath}`);

if (platform === 'darwin') {
  // macOS - Use LaunchAgent
  const serviceName = 'com.ai-team.agent-runner';
  const plistPath = path.join(homeDir, 'Library', 'LaunchAgents', `${serviceName}.plist`);
  const logDir = path.join(homeDir, '.agent-runner', 'logs');

  // Create log directory
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${serviceName}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${packageDir}/agent-runner.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${logDir}/agent-runner.log</string>
    <key>StandardErrorPath</key>
    <string>${logDir}/agent-runner-error.log</string>
    <key>WorkingDirectory</key>
    <string>${packageDir}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>`;

  try {
    // Write plist file
    fs.writeFileSync(plistPath, plistContent);
    console.log(`✅ Created LaunchAgent at: ${plistPath}`);

    // Unload existing service if running
    spawnSync('launchctl', ['unload', plistPath], { stdio: 'ignore' });

    // Load the service
    const result = spawnSync('launchctl', ['load', plistPath]);

    if (result.status === 0) {
      console.log('✅ Agent Runner service loaded and started');
      console.log(`📝 Logs available at: ${logDir}`);
      console.log('');
      console.log('Service will automatically start on login.');
      console.log('');
      console.log('To manage the service:');
      console.log(`  Stop:  launchctl unload ${plistPath}`);
      console.log(`  Start: launchctl load ${plistPath}`);
    } else {
      console.error('❌ Error loading service:', result.stderr?.toString());
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error setting up service:', error.message);
    process.exit(1);
  }

} else if (platform === 'linux') {
  // Linux - Use systemd
  console.log('⚠️  Linux systemd setup not yet implemented.');
  console.log('You can manually run: npm start');

} else if (platform === 'win32') {
  // Windows - Use node-windows or similar
  console.log('⚠️  Windows service setup not yet implemented.');
  console.log('You can manually run: npm start');

} else {
  console.log(`⚠️  Platform ${platform} not supported for automatic service setup.`);
  console.log('You can manually run: npm start');
}
