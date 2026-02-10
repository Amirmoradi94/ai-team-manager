# Agent Runner - Background Service Setup

The Agent Runner automatically runs as a background service on your machine after installation.

## Installation

When you install the package via npm, it will automatically set up as a background service:

```bash
npm install -g @ai-team/runner
# or
npm install @ai-team/runner
```

The post-install script will:
- Create a system service (LaunchAgent on macOS, systemd on Linux, Windows Service on Windows)
- Start the service automatically
- Configure it to auto-start on login/boot

## Service Management

### macOS (LaunchAgent)

**Check if running:**
```bash
ps aux | grep agent-runner
```

**View logs:**
```bash
# Standard output
tail -f ~/.agent-runner/logs/agent-runner.log

# Errors
tail -f ~/.agent-runner/logs/agent-runner-error.log
```

**Stop service:**
```bash
launchctl unload ~/Library/LaunchAgents/com.ai-team.agent-runner.plist
```

**Start service:**
```bash
launchctl load ~/Library/LaunchAgents/com.ai-team.agent-runner.plist
```

**Restart service:**
```bash
launchctl unload ~/Library/LaunchAgents/com.ai-team.agent-runner.plist
launchctl load ~/Library/LaunchAgents/com.ai-team.agent-runner.plist
```

### Linux (systemd)

Coming soon...

### Windows

Coming soon...

## Uninstallation

When you uninstall the package, the service will be automatically removed:

```bash
npm uninstall -g @ai-team/runner
```

## Manual Setup

If automatic setup fails, you can manually run the setup script:

```bash
node scripts/setup-service.js
```

To manually remove the service:

```bash
node scripts/remove-service.js
```

## Troubleshooting

**Service not starting:**
1. Check the error log: `cat ~/.agent-runner/logs/agent-runner-error.log`
2. Verify Node.js path: `which node`
3. Manually restart: `launchctl unload` then `launchctl load`

**Service running but not syncing:**
1. Check the agent-runner configuration in the task-manager
2. Verify the API token is correct
3. Check network connectivity to the task-manager server

**Find service status:**
```bash
launchctl list | grep agent-runner
```
