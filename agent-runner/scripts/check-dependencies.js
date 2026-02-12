const { execSync, spawn } = require('child_process');
const readline = require('readline');

const TOOLS = {
  claude: { cmd: 'claude', install: 'npm install -g @anthropic-ai/claude-code', name: 'Claude Code CLI' },
  gemini: { cmd: 'gemini', install: 'npm install -g @google/gemini-cli', name: 'Gemini CLI' },
  codex:  { cmd: 'codex',  install: 'npm install -g @openai/codex-cli', name: 'OpenAI Codex CLI' } // Example package name
};

function checkCommand(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function installTool(tool) {
  console.log(`
📦 Installing ${tool.name}...`);
  return new Promise((resolve, reject) => {
    // Determine the package manager (npm or yarn)
    const installCmd = tool.install;
    const child = spawn(installCmd, { shell: true, stdio: 'inherit' });
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${tool.name} installed successfully.`);
        resolve();
      } else {
        console.error(`❌ Failed to install ${tool.name}.`);
        resolve(); // Continue anyway
      }
    });
  });
}

async function main() {
  console.log('
⚠️  SECURITY WARNING ⚠️');
  console.log('================================================================');
  console.log('The Agent Runner executes AI-generated code on your local machine.');
  console.log('It has access to your file system and terminal.');
  console.log('You can restrict permissions (Read-Only vs Write) in the CTO Dashboard.');
  console.log('================================================================
');

  console.log('🔍 Checking for required AI CLI tools...');
  
  for (const key of Object.keys(TOOLS)) {
    const tool = TOOLS[key];
    if (!checkCommand(tool.cmd)) {
      const answer = await askQuestion(`❓ ${tool.name} is missing. Install it now? (y/n): `);
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        await installTool(tool);
      } else {
        console.log(`⏩ Skipping ${tool.name}. Note: Agent capabilities will be limited.`);
      }
    } else {
      console.log(`✅ ${tool.name} found.`);
    }
  }
  
  console.log('
✨ Dependency check complete.
');
}

main().catch(console.error);
