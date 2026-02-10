const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

// Import utilities
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { sendInvitationEmail } = require('./utils/emailService');
const { cacheAPI, noCache } = require('./middleware/cache');

// Import validators
const { validateRegister, validateLogin, validateInvite } = require('./validators/authValidators');
const {
  validateCreateTask,
  validateUpdateTask,
  validateTaskId,
  validateScheduledQuery
} = require('./validators/taskValidators');

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

// Note: Can't use logger here as it may not be initialized yet
if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please copy .env.example to .env and configure it properly');
  process.exit(1);
}

if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
  console.warn('⚠️  WARNING: Using default JWT_SECRET. Change this in production!');
}

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10;
const MIN_PASSWORD_LENGTH = parseInt(process.env.MIN_PASSWORD_LENGTH) || 8;

// Middleware

// Compression
app.use(compression());

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
}));

// HTTPS Redirect (only in production)
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (corsOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth routes
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply general rate limiting to all routes
// DISABLED FOR DEVELOPMENT
// app.use(generalLimiter);

// Database Setup
const dbPath = path.resolve(__dirname, process.env.DB_PATH || 'taskmanager.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) logger.error('Error opening database', err);
  else logger.info('📅 Initialized database:', dbPath);
});

// Initialize Tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    status TEXT,
    priority TEXT,
    due_date TEXT,
    scheduled_date TEXT,
    scheduled_time TEXT,
    assignee_id TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(assignee_id) REFERENCES users(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`);

  // Create settings table for integration settings
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create comments table for task comments
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    content TEXT NOT NULL,
    is_system BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Add created_by column if it doesn't exist (for existing databases)
  db.run(`ALTER TABLE tasks ADD COLUMN created_by TEXT`, () => {});

  // Add scheduling columns if they don't exist (for existing databases)
  db.run(`ALTER TABLE tasks ADD COLUMN scheduled_date TEXT`, () => {});
  db.run(`ALTER TABLE tasks ADD COLUMN scheduled_time TEXT`, () => {});

  // Add role column to users if it doesn't exist (for existing databases)
  db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member'`, () => {});

  // Add avatar column to users if it doesn't exist (for existing databases)
  db.run(`ALTER TABLE users ADD COLUMN avatar TEXT`, () => {});

  // Add AI agent columns
  db.run(`ALTER TABLE users ADD COLUMN is_ai BOOLEAN DEFAULT 0`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN system_prompt TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN model_config TEXT`, () => {}); // JSON string for model settings

  // Add universal runner token columns to users
  db.run(`ALTER TABLE users ADD COLUMN runner_token TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN runner_last_seen DATETIME`, () => {});
db.run(`ALTER TABLE users ADD COLUMN cto_resource_status TEXT`, () => {}); // JSON string for resource limits

  // Create projects table
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    repository_path TEXT,
    global_rules TEXT, -- Project-specific rules/constraints
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`);

  // Create project members table
  db.run(`CREATE TABLE IF NOT EXISTS project_members (
    project_id TEXT,
    user_id TEXT,
    role TEXT DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  // Create specialists table (Sub-Agents)
  db.run(`CREATE TABLE IF NOT EXISTS specialists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT,
    tools TEXT, -- JSON string of allowed tools
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // --- NEW TEAM ARCHITECTURE ---

  // Create teams table
  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mission_statement TEXT,
    project_id TEXT,
    human_in_the_loop BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
  )`);

  // Link specialists to teams
  db.run(`CREATE TABLE IF NOT EXISTS team_specialists (
    team_id TEXT,
    specialist_id TEXT,
    PRIMARY KEY (team_id, specialist_id),
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY(specialist_id) REFERENCES specialists(id) ON DELETE CASCADE
  )`);

  // Link teams to projects (Many-to-Many)
  db.run(`CREATE TABLE IF NOT EXISTS project_teams (
    project_id TEXT,
    team_id TEXT,
    PRIMARY KEY (project_id, team_id),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE
  )`);

  // Add team columns to users (for Team Leads)
  db.run(`ALTER TABLE users ADD COLUMN team_id TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN is_team_lead BOOLEAN DEFAULT 0`, () => {});

  // Add team_id to tasks
  db.run(`ALTER TABLE tasks ADD COLUMN team_id TEXT`, () => {});

  // --- END NEW TEAM ARCHITECTURE ---

  // Add runner_token to projects
  db.run(`ALTER TABLE projects ADD COLUMN runner_token TEXT`, () => {});
  db.run(`ALTER TABLE projects ADD COLUMN last_seen DATETIME`, () => {});

  // Add project and agent links to tasks
  db.run(`ALTER TABLE tasks ADD COLUMN project_id TEXT`, () => {});
  db.run(`ALTER TABLE tasks ADD COLUMN agent_id TEXT`, () => {});

  // Add execution metadata columns to tasks
  db.run(`ALTER TABLE tasks ADD COLUMN execution_time INTEGER`, () => {}); // in milliseconds
  db.run(`ALTER TABLE tasks ADD COLUMN tokens_used INTEGER`, () => {});
  db.run(`ALTER TABLE tasks ADD COLUMN files_modified INTEGER`, () => {});
  db.run(`ALTER TABLE tasks ADD COLUMN model_used TEXT`, () => {});
  db.run(`ALTER TABLE tasks ADD COLUMN execution_started_at DATETIME`, () => {});
  db.run(`ALTER TABLE tasks ADD COLUMN execution_completed_at DATETIME`, () => {});
  db.run(`ALTER TABLE tasks ADD COLUMN failed_at DATETIME`, () => {}); // Track when task last failed

  // Initialize admin user
  const initializeAdmin = async () => {
    try {
      let adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
      const adminName = process.env.ADMIN_NAME || 'Admin';
      const adminPassword = process.env.ADMIN_PASSWORD;
      const adminAvatar = '/amir-profile.jpg'; // Amir's profile picture

      if (!adminEmail || !adminPassword) {
        logger.warn('⚠️  Admin credentials not set in .env. Skipping admin initialization.');
        return;
      }

      // Normalize email like in validators (Gmail removes dots)
      const emailParts = adminEmail.split('@');
      if (emailParts[1] === 'gmail.com') {
        adminEmail = emailParts[0].replace(/\./g, '') + '@gmail.com';
      }

      // Check if admin already exists
      const existingAdmin = await get('SELECT * FROM users WHERE email = ?', [adminEmail]);

      if (!existingAdmin) {
        // Create admin user
        const hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
        const id = Math.random().toString(36).substr(2, 9);

        await run(
          'INSERT INTO users (id, name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?, ?)',
          [id, adminName, adminEmail, hashedPassword, 'admin', adminAvatar]
        );

        logger.info('✅ Admin user created:', adminEmail);
      } else if (existingAdmin.role !== 'admin') {
        // Update existing user to admin
        await run('UPDATE users SET role = ?, avatar = ? WHERE email = ?', ['admin', adminAvatar, adminEmail]);
        logger.info('✅ User promoted to admin:', adminEmail);
      } else {
        // Update admin avatar
        await run('UPDATE users SET avatar = ? WHERE email = ?', [adminAvatar, adminEmail]);
        logger.info('✅ Admin user avatar updated:', adminEmail);
      }
    } catch (error) {
      logger.error('Failed to initialize admin user:', error);
    }
  };

  // Initialize Claude user with funny avatar
  const initializeClaude = async () => {
    try {
      const claudeEmail = 'claude@taskmanager.com';
      const claudeName = 'Claude';
      const claudePassword = '.PX0UQUBN67Nme32';
      const funnyAvatar = '/claude-profile.png'; // Updated profile picture

      // Check if Claude user exists
      const existingClaude = await get('SELECT * FROM users WHERE email = ?', [claudeEmail]);

      if (!existingClaude) {
        // Create Claude user
        const hashedPassword = await bcrypt.hash(claudePassword, BCRYPT_ROUNDS);
        const id = Math.random().toString(36).substr(2, 9);

        await run(
          'INSERT INTO users (id, name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?, ?)',
          [id, claudeName, claudeEmail, hashedPassword, 'member', funnyAvatar]
        );

        logger.info('✅ Claude user created:', claudeEmail);
      } else {
        // Update Claude user with funny avatar
        await run('UPDATE users SET avatar = ? WHERE email = ?', [funnyAvatar, claudeEmail]);
        logger.info('✅ Claude user avatar updated:', claudeEmail);
      }
    } catch (error) {
      logger.error('Failed to initialize Claude user:', error);
    }
  };

  // Run admin initialization after tables are created
  setTimeout(initializeAdmin, 1000);

  // Run Claude initialization after admin initialization
  setTimeout(initializeClaude, 1500);
});

// Helper: Run query
const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

// Helper: Get one
const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

// Helper: Get all
const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

// REMOVED: generateAITeamManifest function
// Projects now use runner-centralized intelligence
// All AI files are stored in ~/.agent_runner/, not in project folders
// Projects only get lightweight .ai_task_context/ created by agent-runner

// Helper function removed - kept comment for reference
async function generateAITeamManifest_DEPRECATED(project, user) {
  const fs = require('fs').promises;
  const path = require('path');
  const fsSync = require('fs');

  try {
    // Create agent_runner_internal/ main folder
    const agentRunnerDir = path.join(project.repository_path, 'agent_runner_internal');
    if (!fsSync.existsSync(agentRunnerDir)) {
      fsSync.mkdirSync(agentRunnerDir, { recursive: true });
    }

    // Create organized subfolders
    const configDir = path.join(agentRunnerDir, 'config');
    const logsDir = path.join(agentRunnerDir, 'logs');
    const historyDir = path.join(agentRunnerDir, 'history');

    if (!fsSync.existsSync(configDir)) fsSync.mkdirSync(configDir, { recursive: true });
    if (!fsSync.existsSync(logsDir)) fsSync.mkdirSync(logsDir, { recursive: true });
    if (!fsSync.existsSync(historyDir)) fsSync.mkdirSync(historyDir, { recursive: true });

    // Always ensure .gitignore exists in root
    const gitignorePath = path.join(agentRunnerDir, '.gitignore');
    if (!fsSync.existsSync(gitignorePath)) {
      const gitignoreContent = `# Agent Runner Internal Files
logs/
*.log
*.tmp
.DS_Store
`;
      fsSync.writeFileSync(gitignorePath, gitignoreContent);
    }

    // AI_TEAM.md goes in the config/ subfolder
    const manifestPath = path.join(configDir, 'AI_TEAM.md');

    // Analyze project structure
    let projectStructure = '';
    let detectedTechnologies = [];

    try {
      const files = await fs.readdir(project.repository_path);

      // Detect technologies based on config files
      if (files.includes('package.json')) {
        detectedTechnologies.push('Node.js/JavaScript');
        try {
          const packageJson = JSON.parse(await fs.readFile(path.join(project.repository_path, 'package.json'), 'utf8'));
          if (packageJson.dependencies) {
            if (packageJson.dependencies.react) detectedTechnologies.push('React');
            if (packageJson.dependencies.vue) detectedTechnologies.push('Vue');
            if (packageJson.dependencies.next) detectedTechnologies.push('Next.js');
            if (packageJson.dependencies.express) detectedTechnologies.push('Express');
            if (packageJson.dependencies.vite) detectedTechnologies.push('Vite');
          }
        } catch (e) {}
      }
      if (files.includes('requirements.txt') || files.includes('setup.py')) detectedTechnologies.push('Python');
      if (files.includes('Gemfile')) detectedTechnologies.push('Ruby');
      if (files.includes('go.mod')) detectedTechnologies.push('Go');
      if (files.includes('Cargo.toml')) detectedTechnologies.push('Rust');
      if (files.includes('pom.xml')) detectedTechnologies.push('Java/Maven');
      if (files.includes('build.gradle')) detectedTechnologies.push('Java/Gradle');

      // Build structure overview
      projectStructure = '## Project Structure\n\n```\n';
      const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv'];

      for (const file of files.slice(0, 20)) { // Limit to first 20 items
        if (ignoreDirs.includes(file)) continue;
        const filePath = path.join(project.repository_path, file);
        const stat = fsSync.statSync(filePath);
        projectStructure += stat.isDirectory() ? `📁 ${file}/\n` : `📄 ${file}\n`;
      }

      if (files.length > 20) {
        projectStructure += `... and ${files.length - 20} more items\n`;
      }
      projectStructure += '```\n\n';
    } catch (e) {
      projectStructure = '_(Project structure analysis unavailable)_\n\n';
    }

    // Get AI agents
    const agents = await all('SELECT name, system_prompt FROM users WHERE is_ai = 1');

    // Generate manifest content
    let manifestContent = `# AI Team Manifest: ${project.name}\n\n`;
    manifestContent += `> Auto-generated on ${new Date().toLocaleString()}\n\n`;
    manifestContent += `## Project Overview\n\n`;
    manifestContent += `${project.description || 'No description provided.'}\n\n`;

    if (detectedTechnologies.length > 0) {
      manifestContent += `**Detected Technologies:** ${detectedTechnologies.join(', ')}\n\n`;
    }

    manifestContent += projectStructure;

    manifestContent += `## AI Team\n\n`;
    if (agents.length > 0) {
      agents.forEach(agent => {
        manifestContent += `### ${agent.name}\n`;
        manifestContent += `${agent.system_prompt}\n\n`;
      });
    } else {
      manifestContent += `_No AI agents configured yet. Add agents in the AI Team tab._\n\n`;
    }

    manifestContent += `## Global Project Rules\n\n`;
    manifestContent += `${project.global_rules || 'Follow best practices and write clean, maintainable code.'}\n\n`;

    manifestContent += `## Important Notes for AI Agents\n\n`;
    manifestContent += `- Always read this manifest before starting work on this project\n`;
    manifestContent += `- Follow the project structure and conventions shown above\n`;
    manifestContent += `- Respect the global rules at all times\n`;
    manifestContent += `- When making changes, ensure they align with the detected technologies\n`;
    manifestContent += `- Update this manifest if significant project changes occur\n\n`;

    manifestContent += `## Work Journal\n\n`;
    manifestContent += `_This section will be updated by AI agents as they complete tasks._\n\n`;
    manifestContent += `- **${new Date().toLocaleDateString()}**: Project initialized in AI Team Manager\n\n`;
    manifestContent += `---\n\n`;
    manifestContent += `> **Note:** This file is located in \`agent_runner_internal/config/\` directory.\n`;
    manifestContent += `> The \`agent_runner_internal/\` folder contains all agent-related files:\n`;
    manifestContent += `> - \`config/\` - Configuration and manifest files\n`;
    manifestContent += `> - \`logs/\` - Execution logs\n`;
    manifestContent += `> - \`history/\` - Task execution history\n`;

    // Write or update the manifest
    await fs.writeFile(manifestPath, manifestContent, 'utf8');
    logger.info(`✅ AI_TEAM.md generated for project: ${project.name} at ${manifestPath}`);

  } catch (error) {
    logger.error('Failed to generate AI_TEAM.md:', error);
  }
}

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Admin-only Middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// --- AUTH ROUTES ---

// Registration disabled - invitation-only system
// DISABLED RATE LIMITER FOR DEVELOPMENT
app.post('/api/auth/register', /* authLimiter, */ (req, res) => {
  res.status(403).json({
    error: 'Registration is disabled. Please contact the administrator for an invitation.'
  });
});

// DISABLED RATE LIMITER FOR DEVELOPMENT
app.post('/api/auth/login', /* authLimiter, */ validateLogin, async (req, res) => {
  const { email, password } = req.body;

  try {
    logger.info('Login attempt', { email, service: 'task-manager-api' });

    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      logger.warn('User not found', { email, service: 'task-manager-api' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.info('User found, verifying password', { email: user.email, service: 'task-manager-api' });
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      logger.warn('Invalid password', { email, service: 'task-manager-api' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role || 'member' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'member'
      }
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', noCache, authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TASKS ROUTES ---

app.get('/api/tasks', authenticateToken, cacheAPI(60), async (req, res) => { // Cache for 1 minute
  try {
    const tasks = await all(`
      SELECT t.*,
             u.id as assignee_id,
             u.name as assignee_name,
             u.email as assignee_email,
             u.avatar as assignee_avatar,
             u.role as assignee_role,
             c.id as creator_id,
             c.name as creator_name,
             c.email as creator_email,
             c.avatar as creator_avatar,
             c.role as creator_role
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.created_by = c.id
      ORDER BY t.created_at DESC
    `);

    // Transform tasks to include user objects
    const transformedTasks = tasks.map(task => ({
      ...task,
      assignee: task.assignee_id ? {
        id: task.assignee_id,
        name: task.assignee_name,
        email: task.assignee_email,
        avatar: task.assignee_avatar || '👤',
        role: task.assignee_role
      } : null,
      createdBy: task.creator_id ? {
        id: task.creator_id,
        name: task.creator_name,
        email: task.creator_email,
        avatar: task.creator_avatar || '👤',
        role: task.creator_role
      } : null
    }));

    res.json(transformedTasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get scheduled tasks for calendar view (MUST come before /api/tasks/:id to avoid route collision)
app.get('/api/tasks/scheduled', authenticateToken, validateScheduledQuery, async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    const tasks = await all(`
      SELECT t.*,
             u.id as assignee_id,
             u.name as assignee_name,
             u.email as assignee_email,
             u.avatar as assignee_avatar,
             u.role as assignee_role,
             c.id as creator_id,
             c.name as creator_name,
             c.email as creator_email,
             c.avatar as creator_avatar,
             c.role as creator_role
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.scheduled_date IS NOT NULL
        AND t.scheduled_date >= ?
        AND t.scheduled_date <= ?
      ORDER BY t.scheduled_date, t.scheduled_time
    `, [start_date, end_date]);

    // Transform tasks to include user objects
    const transformedTasks = tasks.map(task => ({
      ...task,
      assignee: task.assignee_id ? {
        id: task.assignee_id,
        name: task.assignee_name,
        email: task.assignee_email,
        avatar: task.assignee_avatar || '👤',
        role: task.assignee_role
      } : null,
      createdBy: task.creator_id ? {
        id: task.creator_id,
        name: task.creator_name,
        email: task.creator_email,
        avatar: task.creator_avatar || '👤',
        role: task.creator_role
      } : null
    }));

    res.json(transformedTasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single task by ID
app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const task = await get(`
      SELECT t.*,
             u.id as assignee_id,
             u.name as assignee_name,
             u.email as assignee_email,
             u.avatar as assignee_avatar,
             u.role as assignee_role,
             c.id as creator_id,
             c.name as creator_name,
             c.email as creator_email,
             c.avatar as creator_avatar,
             c.role as creator_role
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Transform task to include user objects
    const transformedTask = {
      ...task,
      assignee: task.assignee_id ? {
        id: task.assignee_id,
        name: task.assignee_name,
        email: task.assignee_email,
        avatar: task.assignee_avatar || '👤',
        role: task.assignee_role
      } : null,
      createdBy: task.creator_id ? {
        id: task.creator_id,
        name: task.creator_name,
        email: task.creator_email,
        avatar: task.creator_avatar || '👤',
        role: task.creator_role
      } : null
    };

    res.json(transformedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', authenticateToken, validateCreateTask, async (req, res) => {
  const { title, description, status, priority, due_date, assignee_id, scheduled_date, scheduled_time, project_id, agent_id } = req.body;
  const id = Math.random().toString(36).substr(2, 9);
  const created_by = req.user.id;

  try {
    await run(
      `INSERT INTO tasks (id, title, description, status, priority, due_date, assignee_id, created_by, scheduled_date, scheduled_time, project_id, agent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description, status || 'todo', priority || 'medium', due_date, assignee_id, created_by, scheduled_date, scheduled_time, project_id, agent_id]
    );
    const newTask = await get(`
      SELECT t.*,
             u.id as assignee_id,
             u.name as assignee_name,
             u.email as assignee_email,
             u.avatar as assignee_avatar,
             u.role as assignee_role,
             c.id as creator_id,
             c.name as creator_name,
             c.email as creator_email,
             c.avatar as creator_avatar,
             c.role as creator_role
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.id = ?`, [id]);

    // Transform to include user objects
    const transformedTask = {
      ...newTask,
      assignee: newTask.assignee_id ? {
        id: newTask.assignee_id,
        name: newTask.assignee_name,
        email: newTask.assignee_email,
        avatar: newTask.assignee_avatar || '👤',
        role: newTask.assignee_role
      } : null,
      createdBy: newTask.creator_id ? {
        id: newTask.creator_id,
        name: newTask.creator_name,
        email: newTask.creator_email,
        avatar: newTask.creator_avatar || '👤',
        role: newTask.creator_role
      } : null
    };

    // Send webhook to Claude if assigned to Claude user
    if (assignee_id && newTask.assignee_name && newTask.assignee_name.toLowerCase() === 'claude') {
      sendClaudeWebhook(newTask).catch(err => {
        logger.error('Failed to send Claude webhook:', err);
      });
    }

    res.json(transformedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id', authenticateToken, validateUpdateTask, async (req, res) => {
  const {
    title, description, status, priority, due_date, assignee_id, scheduled_date, scheduled_time,
    execution_time, tokens_used, files_modified, model_used, execution_started_at, execution_completed_at
  } = req.body;
  const { id } = req.params;

  try {
    // Get old task to check if assignee or status changed
    const oldTask = await get(`
      SELECT t.*, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = ?`, [id]);

    // Dynamic update
    await run(
      `UPDATE tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        due_date = COALESCE(?, due_date),
        assignee_id = COALESCE(?, assignee_id),
        scheduled_date = COALESCE(?, scheduled_date),
        scheduled_time = COALESCE(?, scheduled_time),
        execution_time = COALESCE(?, execution_time),
        tokens_used = COALESCE(?, tokens_used),
        files_modified = COALESCE(?, files_modified),
        model_used = COALESCE(?, model_used),
        execution_started_at = COALESCE(?, execution_started_at),
        execution_completed_at = COALESCE(?, execution_completed_at)
       WHERE id = ?`,
      [title, description, status, priority, due_date, assignee_id, scheduled_date, scheduled_time,
       execution_time, tokens_used, files_modified, model_used, execution_started_at, execution_completed_at, id]
    );
    const updatedTask = await get(`
      SELECT t.*,
             u.id as assignee_id,
             u.name as assignee_name,
             u.email as assignee_email,
             u.avatar as assignee_avatar,
             u.role as assignee_role,
             c.id as creator_id,
             c.name as creator_name,
             c.email as creator_email,
             c.avatar as creator_avatar,
             c.role as creator_role
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.id = ?`, [id]);

    // Send webhook to Claude in these scenarios:
    const shouldSendWebhook = (
      updatedTask.assignee_name &&
      updatedTask.assignee_name.toLowerCase() === 'claude' &&
      (
        // Scenario 1: Task moved TO "todo" status
        (status === 'todo' && oldTask?.status !== 'todo') ||
        // Scenario 2: Task newly assigned to Claude
        (assignee_id && assignee_id !== oldTask?.assignee_id) ||
        // Scenario 3: Task info updated (title, description, etc.) while assigned to Claude
        (oldTask?.assignee_name?.toLowerCase() === 'claude' &&
         (title || description || priority || due_date || scheduled_date || scheduled_time))
      )
    );

    if (shouldSendWebhook) {
      const reason =
        (status === 'todo' && oldTask?.status !== 'todo') ? 'moved to todo' :
        (assignee_id && assignee_id !== oldTask?.assignee_id) ? 'assigned to Claude' :
        'task updated';
      logger.info(`[Webhook] Task ${id} ${reason}, notifying Claude`);
      sendClaudeWebhook(updatedTask).catch(err => {
        logger.error('Failed to send Claude webhook:', err);
      });
    }

    // Transform to include user objects
    const transformedTask = {
      ...updatedTask,
      assignee: updatedTask.assignee_id ? {
        id: updatedTask.assignee_id,
        name: updatedTask.assignee_name,
        email: updatedTask.assignee_email,
        avatar: updatedTask.assignee_avatar || '👤',
        role: updatedTask.assignee_role
      } : null,
      createdBy: updatedTask.creator_id ? {
        id: updatedTask.creator_id,
        name: updatedTask.creator_name,
        email: updatedTask.creator_email,
        avatar: updatedTask.creator_avatar || '👤',
        role: updatedTask.creator_role
      } : null
    };

    res.json(transformedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id/move', authenticateToken, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  try {
    await run('UPDATE tasks SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quick schedule endpoint
app.put('/api/tasks/:id/schedule', authenticateToken, async (req, res) => {
  const { scheduled_date, scheduled_time } = req.body;
  const { id } = req.params;

  try {
    await run('UPDATE tasks SET scheduled_date = ?, scheduled_time = ? WHERE id = ?', [scheduled_date, scheduled_time, id]);
    const updatedTask = await get(`
      SELECT t.*,
             u.id as assignee_id,
             u.name as assignee_name,
             u.email as assignee_email,
             u.avatar as assignee_avatar,
             u.role as assignee_role,
             c.id as creator_id,
             c.name as creator_name,
             c.email as creator_email,
             c.avatar as creator_avatar,
             c.role as creator_role
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.id = ?`, [id]);

    // Transform to include user objects
    const transformedTask = {
      ...updatedTask,
      assignee: updatedTask.assignee_id ? {
        id: updatedTask.assignee_id,
        name: updatedTask.assignee_name,
        email: updatedTask.assignee_email,
        avatar: updatedTask.assignee_avatar || '👤',
        role: updatedTask.assignee_role
      } : null,
      createdBy: updatedTask.creator_id ? {
        id: updatedTask.creator_id,
        name: updatedTask.creator_name,
        email: updatedTask.creator_email,
        avatar: updatedTask.creator_avatar || '👤',
        role: updatedTask.creator_role
      } : null
    };
    res.json(transformedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', authenticateToken, validateTaskId, async (req, res) => {
  try {
    const taskId = req.params.id;

    // Get task info before deletion to check if we need to notify scheduler
    const task = await get(`
      SELECT t.*, u.name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = ?`, [taskId]);

    // Delete the task
    await run('DELETE FROM tasks WHERE id = ?', [taskId]);

    // Notify scheduler to clean up any cron jobs if task was assigned to Claude
    if (task && task.assignee_name && task.assignee_name.toLowerCase() === 'claude') {
      sendTaskDeletionWebhook(taskId).catch(err => {
        logger.error('Failed to send deletion webhook:', err);
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- TASK COMMENTS ROUTES ---

// Get comments for a task
app.get('/api/tasks/:id/comments', authenticateToken, async (req, res) => {
  try {
    const comments = await all(
      'SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a comment to a task
app.post('/api/tasks/:id/comments', authenticateToken, async (req, res) => {
  const { content, is_system } = req.body;
  const { id: task_id } = req.params;

  try {
    const comment_id = Math.random().toString(36).substr(2, 9);
    const user = req.user;

    await run(
      `INSERT INTO comments (id, task_id, user_id, user_name, content, is_system)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [comment_id, task_id, user.id, user.name, content, is_system || 0]
    );

    const comment = await get('SELECT * FROM comments WHERE id = ?', [comment_id]);
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- USERS ROUTES ---

app.get('/api/users', authenticateToken, noCache, async (req, res) => {
  try {
    const users = await all('SELECT id, name, email, role, avatar, created_at FROM users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/invite', authenticateToken, validateInvite, async (req, res) => {
  const { email } = req.body;

  try {
    const existing = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const id = Math.random().toString(36).substr(2, 9);
    const name = email.split('@')[0];
    // Generate a secure login password
    const loginPassword = Math.random().toString(36).slice(-12).toUpperCase() + Math.random().toString(36).slice(-4);
    const hashedPassword = await bcrypt.hash(loginPassword, BCRYPT_ROUNDS);

    await run('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [id, name, email, hashedPassword, 'member']);

    // Return user details with generated password
    logger.info('User invited successfully:', { email, invitedBy: req.user.email });
    res.json({
      message: 'User created successfully',
      user: {
        id,
        name,
        email,
        role: 'member'
      },
      loginPassword: loginPassword,
    });
  } catch (err) {
    logger.error('Invite error:', err);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

app.patch('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  try {
    // Users can only update their own profile (unless admin)
    if (id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot update another user\'s profile' });
    }

    // Validate input
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check if email is already taken by another user
    const existing = await get('SELECT * FROM users WHERE email = ? AND id != ?', [email, id]);
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Update user
    await run('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, id]);

    // Get updated user
    const updatedUser = await get('SELECT id, name, email, role FROM users WHERE id = ?', [id]);

    logger.info('User profile updated:', { userId: id, updatedBy: req.user.email });
    res.json({
      success: true,
      user: updatedUser
    });
  } catch (err) {
    logger.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// --- CTO INTELLIGENCE ROUTES ---

// Get CTO configuration
app.get('/api/cto/config', authenticateToken, async (req, res) => {
  try {
    const row = await get('SELECT value FROM settings WHERE key = ?', ['cto_config']);
    const defaultConfig = {
      enabled: true,
      useAIForDecisions: true,
      ctoProvider: 'gemini-3-pro',
      strategy: 'balanced',
      autonomyLevel: 'full',
      activeProviders: ['claude', 'gemini', 'codex'],
      subscriptions: {
        claude: { plan: 'max5x' },
        gemini: { plan: 'ultra' },
        codex: { plan: 'plus' }
      },
      maxRetries: 2,
      splitComplexityScore: 45,
      deferWindowUsagePercent: 90
    };

    if (row) {
      const savedConfig = JSON.parse(row.value);
      // Merge with default and force core flags to true
      res.json({ 
        ...defaultConfig, 
        ...savedConfig,
        enabled: true,
        useAIForDecisions: true 
      });
    } else {
      res.json(defaultConfig);
    }
  } catch (err) {
    logger.error('Failed to fetch CTO settings:', err);
    res.status(500).json({ error: 'Failed to fetch CTO settings' });
  }
});

app.get('/api/cto/resource-status', authenticateToken, async (req, res) => {
  try {
    const user = await get('SELECT cto_resource_status FROM users WHERE id = ?', [req.user.id]);
    if (user?.cto_resource_status) {
      return res.json(JSON.parse(user.cto_resource_status));
    }
    res.json(null);
  } catch (err) {
    logger.error('Failed to fetch CTO resource status:', err);
    res.status(500).json({ error: 'Failed to fetch CTO resource status' });
  }
});

// Update CTO configuration
app.put('/api/cto/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const value = JSON.stringify(req.body);
    await run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
      ['cto_config', value, value]
    );
    res.json({ success: true, config: req.body });
  } catch (err) {
    logger.error('Failed to update CTO settings:', err);
    res.status(500).json({ error: 'Failed to update CTO settings' });
  }
});

app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const rows = await all('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (err) {
    logger.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.put('/api/settings/:key', authenticateToken, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  try {
    // Insert or update setting
    await run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
      [key, value, value]
    );

    logger.info('Setting updated:', { key, updatedBy: req.user.email });
    res.json({ success: true, key, value });
  } catch (err) {
    logger.error('Update setting error:', err);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Prevent deleting yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const user = await get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user's tasks first (cascade delete)
    await run('DELETE FROM tasks WHERE assignee_id = ? OR created_by = ?', [id, id]);

    // Delete user
    await run('DELETE FROM users WHERE id = ?', [id]);

    logger.info('User deleted:', { deletedUser: user.email, deletedBy: req.user.email });
    res.json({
      success: true,
      message: 'User deleted successfully',
      deletedUser: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (err) {
    logger.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// --- SETTINGS ROUTES ---

// Helper function to send webhook to Claude
async function sendClaudeWebhook(task) {
  try {
    // Get Claude webhook URL from settings
    const setting = await get('SELECT value FROM settings WHERE key = ?', ['claude_webhook_url']);
    const webhookSecret = await get('SELECT value FROM settings WHERE key = ?', ['claude_webhook_secret']);

    if (!setting || !setting.value) {
      logger.info('Claude webhook not configured, skipping notification');
      return;
    }

    const webhookUrl = setting.value.trim();
    const secret = webhookSecret?.value || 'your-webhook-secret-change-this';

    logger.info('Sending webhook to Claude:', { taskId: task.id, url: webhookUrl });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': secret
      },
      body: JSON.stringify({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        scheduled_date: task.scheduled_date,
        scheduled_time: task.scheduled_time,
        assignee_name: task.assignee_name,
        assignee_id: task.assignee_id,
        created_at: task.created_at
      })
    });

    if (response.ok) {
      logger.info('Claude webhook sent successfully:', { taskId: task.id });
    } else {
      logger.warn('Claude webhook failed:', {
        taskId: task.id,
        status: response.status,
        statusText: response.statusText
      });
    }
  } catch (error) {
    logger.error('Error sending Claude webhook:', error.message);
  }
}

async function sendTaskDeletionWebhook(taskId) {
  try {
    // Get Claude webhook URL from settings
    const setting = await get('SELECT value FROM settings WHERE key = ?', ['claude_webhook_url']);
    const webhookSecret = await get('SELECT value FROM settings WHERE key = ?', ['claude_webhook_secret']);

    if (!setting || !setting.value) {
      return;
    }

    const webhookUrl = setting.value.trim().replace('/task-assigned', '/task-deleted');
    const secret = webhookSecret?.value || 'your-webhook-secret-change-this';

    logger.info('Sending task deletion webhook to Claude:', { taskId });

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': secret
      },
      body: JSON.stringify({
        id: taskId,
        action: 'deleted'
      })
    });

    if (response.ok) {
      logger.info('Deletion webhook sent successfully:', { taskId });
    }
  } catch (error) {
    logger.error('Error sending deletion webhook:', error.message);
  }
}

// Get all settings
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await all('SELECT key, value, updated_at FROM settings');
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    res.json(settingsObj);
  } catch (err) {
    logger.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update a setting
app.put('/api/settings/:key', authenticateToken, requireAdmin, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  try {
    // Check if setting exists
    const existing = await get('SELECT * FROM settings WHERE key = ?', [key]);

    if (existing) {
      // Update existing setting
      await run(
        'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
        [value, key]
      );
    } else {
      // Insert new setting
      await run(
        'INSERT INTO settings (key, value) VALUES (?, ?)',
        [key, value]
      );
    }

    logger.info('Setting updated:', { key, updatedBy: req.user.email });
    res.json({
      success: true,
      key,
      value
    });
  } catch (err) {
    logger.error('Update setting error:', err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Delete a setting
app.delete('/api/settings/:key', authenticateToken, requireAdmin, async (req, res) => {
  const { key } = req.params;

  try {
    await run('DELETE FROM settings WHERE key = ?', [key]);
    logger.info('Setting deleted:', { key, deletedBy: req.user.email });
    res.json({ success: true });
  } catch (err) {
    logger.error('Delete setting error:', err);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

// --- PROJECTS ROUTES ---

app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    // Join with users to get the creator's runner_last_seen as a fallback
    const projects = await all(`
      SELECT p.*, u.runner_last_seen as creator_runner_last_seen
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      ORDER BY p.created_at DESC
    `);

    // Fetch teams for each project
    for (const project of projects) {
      const teams = await all(`
        SELECT t.*
        FROM teams t
        INNER JOIN project_teams pt ON t.id = pt.team_id
        WHERE pt.project_id = ?
      `, [project.id]);
      project.teams = teams;
    }

    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
  const { name, description, repository_path, global_rules, team_ids } = req.body;
  const id = Math.random().toString(36).substr(2, 9);
  const runner_token = Math.random().toString(36).substr(2, 15); // Simple token

  try {
    // Create project folder immediately if repository_path is provided
    if (repository_path) {
      const fs = require('fs');

      // Create the directory if it doesn't exist
      if (!fs.existsSync(repository_path)) {
        fs.mkdirSync(repository_path, { recursive: true });
        logger.info(`Created project directory: ${repository_path}`);
      }
    }

    // Create the project record
    await run(
      'INSERT INTO projects (id, name, description, repository_path, global_rules, runner_token, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, description, repository_path, global_rules, runner_token, req.user.id]
    );

    // Assign teams to project (many-to-many)
    if (team_ids && Array.isArray(team_ids) && team_ids.length > 0) {
      for (const team_id of team_ids) {
        await run(
          'INSERT INTO project_teams (project_id, team_id) VALUES (?, ?)',
          [id, team_id]
        );
      }
    }

    const project = await get('SELECT * FROM projects WHERE id = ?', [id]);
    logger.info(`Project created: ${name} with ${team_ids?.length || 0} teams. Agent-runner will create .ai_task_context/ on next sync.`);

    res.json(project);
  } catch (err) {
    logger.error('Failed to create project:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id', authenticateToken, async (req, res) => {
  const { name, description, repository_path, global_rules } = req.body;
  const { id } = req.params;

  try {
    // If repository_path is being updated, create folder
    if (repository_path) {
      const fs = require('fs');

      // Create the directory if it doesn't exist
      if (!fs.existsSync(repository_path)) {
        fs.mkdirSync(repository_path, { recursive: true });
        logger.info(`Created project directory: ${repository_path}`);
      }
    }

    await run(
      `UPDATE projects SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        repository_path = COALESCE(?, repository_path),
        global_rules = COALESCE(?, global_rules)
       WHERE id = ?`,
      [name, description, repository_path, global_rules, id]
    );
    const updated = await get('SELECT * FROM projects WHERE id = ?', [id]);
    logger.info(`Project updated: ${updated.name}. Agent-runner will sync .ai_task_context/ on next cycle.`);

    res.json(updated);
  } catch (err) {
    logger.error('Failed to update project:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Delete all tasks associated with this project
    await run('DELETE FROM tasks WHERE project_id = ?', [id]);

    // 2. Delete project-team assignments
    await run('DELETE FROM project_teams WHERE project_id = ?', [id]);

    // 3. Delete the project
    await run('DELETE FROM projects WHERE id = ?', [id]);

    res.json({ success: true, message: 'Project and associated tasks deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign team to project
app.post('/api/projects/:id/teams/:teamId', authenticateToken, async (req, res) => {
  const { id, teamId } = req.params;

  try {
    // Check if already assigned
    const existing = await get(
      'SELECT * FROM project_teams WHERE project_id = ? AND team_id = ?',
      [id, teamId]
    );

    if (existing) {
      return res.status(400).json({ error: 'Team already assigned to this project' });
    }

    await run(
      'INSERT INTO project_teams (project_id, team_id) VALUES (?, ?)',
      [id, teamId]
    );

    res.json({ success: true, message: 'Team assigned to project' });
  } catch (err) {
    logger.error('Failed to assign team to project:', err);
    res.status(500).json({ error: err.message });
  }
});

// Remove team from project
app.delete('/api/projects/:id/teams/:teamId', authenticateToken, async (req, res) => {
  const { id, teamId } = req.params;

  try {
    await run(
      'DELETE FROM project_teams WHERE project_id = ? AND team_id = ?',
      [id, teamId]
    );

    res.json({ success: true, message: 'Team removed from project' });
  } catch (err) {
    logger.error('Failed to remove team from project:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get teams assigned to a project
app.get('/api/projects/:id/teams', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const teams = await all(`
      SELECT t.*, pt.created_at as assigned_at
      FROM teams t
      INNER JOIN project_teams pt ON t.id = pt.team_id
      WHERE pt.project_id = ?
    `, [id]);

    res.json(teams);
  } catch (err) {
    logger.error('Failed to get project teams:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- RUNNER (UNIVERSAL) ROUTES ---

// Get active tasks (in-progress) for CTO dashboard
app.get('/api/runner/active-tasks', authenticateToken, async (req, res) => {
  try {
    const tasks = await all(`
      SELECT t.*, 
             u.name as assignee_name, 
             u.model_config as assignee_model_config,
             p.name as project_name, 
             tm.name as team_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN teams tm ON t.team_id = tm.id
      WHERE t.status = 'in-progress'
      ORDER BY t.created_at ASC
    `);
    res.json(tasks);
  } catch (err) {
    logger.error('Failed to fetch active tasks:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate runner token for the authenticated user
app.post('/api/runner/generate-token', authenticateToken, async (req, res) => {
  try {
    const runnerToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    await run(
      'UPDATE users SET runner_token = ? WHERE id = ?',
      [runnerToken, req.user.id]
    );

    res.json({
      token: runnerToken,
      message: 'Runner token generated successfully'
    });
  } catch (err) {
    logger.error('Failed to generate runner token:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get runner status for the authenticated user
app.get('/api/runner/status', authenticateToken, async (req, res) => {
  try {
    const user = await get(
      'SELECT runner_token, runner_last_seen FROM users WHERE id = ?',
      [req.user.id]
    );

    const isOnline = user?.runner_last_seen &&
                     (Date.now() - new Date(user.runner_last_seen).getTime() < 60000);

    res.json({
      hasToken: !!user?.runner_token,
      token: user?.runner_token,
      lastSeen: user?.runner_last_seen,
      isOnline
    });
  } catch (err) {
    logger.error('Failed to get runner status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get project info by runner token (for initial sync) - supports both project and user tokens
app.get('/api/runner/project', async (req, res) => {
  const { token, projectId } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    let project = null;
    let userId = null;

    if (projectId) {
      project = await get('SELECT * FROM projects WHERE id = ?', [projectId]);
    } else {
      // First, try to find project by project-specific token
      project = await get('SELECT * FROM projects WHERE runner_token = ?', [token]);

      // If not found, try to find user by user-level token and get their first project
      if (!project) {
        const user = await get('SELECT id FROM users WHERE runner_token = ?', [token]);
        if (user) {
          userId = user.id;
          project = await get(`
            SELECT * FROM projects WHERE created_by = ?
            OR id IN (SELECT project_id FROM project_members WHERE user_id = ?)
            LIMIT 1
          `, [userId, userId]);
        }
      }
    }

    // If still no project found, return a default template
    if (!project) {
      project = {
        name: 'Default Project',
        description: 'No project configured yet. Create a project in the UI.',
        repository_path: process.cwd(),
        global_rules: 'Follow best practices and write clean code.'
      };
    }
    
    // Get teams assigned to this project (many-to-many), enriched with their leads and specialists
    let teams = [];

    if (project && project.id) {
      const projectTeams = await all(`
        SELECT t.* FROM teams t
        INNER JOIN project_teams pt ON t.id = pt.team_id
        WHERE pt.project_id = ?
      `, [project.id]);

      teams = await Promise.all(projectTeams.map(async (t) => {
        const lead = await get('SELECT name, system_prompt, model_config FROM users WHERE team_id = ? AND is_team_lead = 1', [t.id]);
        const teamSpecs = await all(`
          SELECT s.name, s.description, s.system_prompt, s.tools
          FROM specialists s
          JOIN team_specialists ts ON s.id = ts.specialist_id
          WHERE ts.team_id = ?
        `, [t.id]);

        return {
          ...t,
          lead: lead || { name: 'Lead Agent', system_prompt: 'Primary project orchestrator.' },
          specialists: teamSpecs || []
        };
      }));
    }

    // Fetch all global specialists for the global directory
    const allSpecialists = await all('SELECT name, description, system_prompt, tools FROM specialists');

    res.json({
      project,
      teams: teams.length > 0 ? teams : [{ 
        name: 'General', 
        mission_statement: 'Global project execution.',
        lead: { name: 'Lead Agent', system_prompt: 'Primary project orchestrator.' },
        specialists: []
      }],
      allSpecialists
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get tasks for runner (includes full project context)
app.get('/api/runner/tasks', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Runner token required' });
  }

  try {
    // 1. First, check if this is a project-specific runner token
    const projectByToken = await get('SELECT id FROM projects WHERE runner_token = ?', [token]);
    
    if (projectByToken) {
      // Return tasks for this specific project
      const tasks = await all(`
        SELECT
          t.*,
          p.id as project_id,
          p.name as project_name,
          p.repository_path as project_repository_path,
          p.global_rules as project_global_rules,
          u.name as assignee_name,
          c.name as creator_name
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u ON t.assignee_id = u.id
        LEFT JOIN users c ON t.created_by = c.id
        WHERE t.project_id = ?
        AND t.status = 'todo'
        ORDER BY t.created_at ASC
      `, [projectByToken.id]);
      
      return res.json(tasks);
    }

    // 2. Fallback: check if this is a user-wide runner token
    const user = await get('SELECT id FROM users WHERE runner_token = ?', [token]);

    if (!user) {
      return res.status(404).json({ error: 'Invalid runner token' });
    }

    // Get all projects the user has access to
    const projects = await all(`
      SELECT p.id FROM projects p
      WHERE p.created_by = ?
      OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
    `, [user.id, user.id]);

    const projectIds = projects.map(p => p.id);

    if (projectIds.length === 0) {
      return res.json([]);
    }

    // Get all pending tasks for these projects
    const placeholders = projectIds.map(() => '?').join(',');
    const tasks = await all(`
      SELECT
        t.*,
        p.id as project_id,
        p.name as project_name,
        p.repository_path as project_repository_path,
        p.global_rules as project_global_rules,
        u.name as assignee_name,
        c.name as creator_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.project_id IN (${placeholders})
      AND t.status = 'todo'
      ORDER BY t.created_at ASC
    `, projectIds);

    res.json(tasks);
  } catch (err) {
    logger.error('Failed to fetch runner tasks:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get subtasks for a task
app.get('/api/tasks/:id/subtasks', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const subtasks = await all(`
      SELECT t.*, u.name as assignee_name, p.name as project_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.parent_id = ?
      ORDER BY t.created_at ASC
    `, [id]);
    res.json(subtasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- AI UTILS ROUTES ---

app.post('/api/ai/enhance', authenticateToken, async (req, res) => {
  const { text, type } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OpenAI API key not configured');
    return res.status(503).json({
      error: 'AI Enhancement is not configured. Please set OPENAI_API_KEY in .env file.'
    });
  }

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = type === 'mission'
      ? "You are a senior product strategist. Transform raw text into a professional, concise, and high-impact Team Mission Statement. Focus on strategic goals and measurable success."
      : "You are an expert prompt engineer. Transform raw text into a professional AI System Prompt. Define a clear persona, tone, technical expertise, and operational rules.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Enhance this text: "${text}"` }
      ],
      temperature: 0.7,
    });

    const enhanced = response.choices[0].message.content.trim();
    res.json({ enhanced });
  } catch (err) {
    logger.error('OpenAI Enhancement failed:', err);
    res.status(500).json({ error: 'AI Enhancement failed. Check OpenAI API key.' });
  }
});

// Test endpoint
app.get('/api/ai/test', (req, res) => {
  res.json({ message: 'AI routes are working!' });
});

app.post('/api/ai/recommendations', authenticateToken, async (req, res) => {
  const { goal, specialists } = req.body;
  if (!goal) return res.status(400).json({ error: 'Goal is required' });
  if (!specialists || !Array.isArray(specialists)) {
    return res.status(400).json({ error: 'Specialists array is required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OpenAI API key not configured');
    return res.status(503).json({
      error: 'AI Recommendations not configured. Please set OPENAI_API_KEY in .env file.'
    });
  }

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const specialistsList = specialists.map(s =>
      `${s.id}: ${s.name} - ${s.description} (Category: ${s.category})`
    ).join('\n');

    const systemPrompt = `You are an expert team composition strategist. Based on the user's goal, recommend the optimal specialists from the available list.

Analyze the goal and recommend 3-8 specialists that would work best together without role conflicts.

Return ONLY a JSON object (no markdown, no code blocks) with this structure:
{
  "recommendedIds": ["specialist-id-1", "specialist-id-2", ...],
  "reasoning": "Brief explanation of why these specialists work well together for this goal"
}`;

    const userPrompt = `Goal: ${goal}

Available Specialists:
${specialistsList}

Recommend the optimal team composition.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content.trim();

    let recommendations;
    try {
      recommendations = JSON.parse(content);
    } catch (parseErr) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response');
      }
    }

    res.json(recommendations);
  } catch (err) {
    logger.error('AI Recommendations failed:', err);
    res.status(500).json({ error: 'AI Recommendations failed. Please try again.' });
  }
});

// --- TEAMS ROUTES ---

app.get('/api/teams', authenticateToken, async (req, res) => {
  try {
    const teams = await all('SELECT * FROM teams ORDER BY created_at DESC');

    // Enrich teams with their Lead and Specialists
    const detailedTeams = await Promise.all(teams.map(async (team) => {
      // 1. Get Team Lead
      const lead = await get('SELECT * FROM users WHERE team_id = ? AND is_team_lead = 1', [team.id]);
      
      // 2. Get Specialists
      const specialists = await all(`
        SELECT s.* FROM specialists s
        JOIN team_specialists ts ON s.id = ts.specialist_id
        WHERE ts.team_id = ?
      `, [team.id]);

      // 3. Get Project Name
      const project = team.project_id ? await get('SELECT name FROM projects WHERE id = ?', [team.project_id]) : null;

      return {
        ...team,
        lead: lead || null,
        specialists: specialists || [],
        project_name: project ? project.name : null
      };
    }));

    res.json(detailedTeams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teams', authenticateToken, async (req, res) => {
  const { 
    name, 
    mission_statement, 
    project_id, 
    human_in_the_loop,
    lead, // { name, system_prompt, model_config }
    specialist_ids // Array of strings
  } = req.body;

  const teamId = Math.random().toString(36).substr(2, 9);

  try {
    // 1. Create Team
    await run(
      `INSERT INTO teams (id, name, mission_statement, project_id, human_in_the_loop) 
       VALUES (?, ?, ?, ?, ?)`,
      [teamId, name, mission_statement, project_id, human_in_the_loop ? 1 : 0]
    );

    // 2. Create/Assign Team Lead
    if (lead) {
      const leadId = Math.random().toString(36).substr(2, 9);
      const email = `${lead.name.toLowerCase().replace(/\s+/g, '.')}_lead@taskmanager.com`;
      const avatar = '/claude-profile.png'; // Default AI avatar

      // Check if this "user" already exists (by email/name) to avoid duplicates, or just create new
      // For simplicity, we create a new agent user for this specific team role
      await run(
        `INSERT INTO users (id, name, email, avatar, role, is_ai, system_prompt, model_config, team_id, is_team_lead) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          leadId, 
          lead.name, 
          email, 
          avatar, 
          'member', 
          1, // is_ai
          lead.system_prompt, 
          JSON.stringify(lead.model_config || { provider: 'claude', model: 'sonnet' }),
          teamId,
          1 // is_team_lead
        ]
      );
    }

    // 3. Link Specialists
    if (specialist_ids && Array.isArray(specialist_ids)) {
      for (const specId of specialist_ids) {
        await run(
          'INSERT INTO team_specialists (team_id, specialist_id) VALUES (?, ?)',
          [teamId, specId]
        );
      }
    }

    // Return the full team object
    const newTeam = await get('SELECT * FROM teams WHERE id = ?', [teamId]);
    // (Ideally we'd fetch the enriched object like in GET, but basic is fine for now)
    
    res.json(newTeam);
  } catch (err) {
    logger.error('Failed to create team:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/teams/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    mission_statement, 
    human_in_the_loop,
    lead, // { name, provider, system_prompt }
    specialist_ids 
  } = req.body;

  try {
    // 1. Update Team Details
    await run(
      `UPDATE teams SET 
        name = COALESCE(?, name),
        mission_statement = COALESCE(?, mission_statement),
        human_in_the_loop = COALESCE(?, human_in_the_loop)
       WHERE id = ?`,
      [name, mission_statement, human_in_the_loop ? 1 : 0, id]
    );

    // 2. Update Team Lead (User)
    if (lead) {
      await run(
        `UPDATE users SET 
          name = COALESCE(?, name),
          system_prompt = COALESCE(?, system_prompt),
          model_config = COALESCE(?, model_config)
         WHERE team_id = ? AND is_team_lead = 1`,
        [
          lead.name,
          lead.system_prompt,
          JSON.stringify({ provider: lead.provider || 'claude', model: 'sonnet' }),
          id
        ]
      );
    }

    // 3. Update Specialists (Unlink all, then Link new)
    if (specialist_ids && Array.isArray(specialist_ids)) {
      await run('DELETE FROM team_specialists WHERE team_id = ?', [id]);
      for (const specId of specialist_ids) {
        await run(
          'INSERT INTO team_specialists (team_id, specialist_id) VALUES (?, ?)',
          [id, specId]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to update team:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/teams/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Delete Team Lead (Agent)
    const leadResult = await db.run('DELETE FROM users WHERE team_id = ? AND is_team_lead = 1', [id]);
    logger.info(`Deleted ${leadResult.changes || 0} team lead(s) for team ${id}`);

    // 2. Unlink Specialists (Cascade handles this usually, but good to be safe)
    await run('DELETE FROM team_specialists WHERE team_id = ?', [id]);

    // 3. Delete Team
    await run('DELETE FROM teams WHERE id = ?', [id]);

    res.json({ success: true, message: 'Team deleted' });
  } catch (err) {
    logger.error('Failed to delete team:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- AGENTS (AI USERS) ROUTES ---

app.get('/api/agents', authenticateToken, async (req, res) => {
  try {
    const agents = await all('SELECT id, name, email, avatar, system_prompt, model_config, role FROM users WHERE is_ai = 1');
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/agents', authenticateToken, async (req, res) => {
  const { name, system_prompt, model_config, provider } = req.body;
  const id = Math.random().toString(36).substr(2, 9);
  const email = `${name.toLowerCase().replace(/\s+/g, '.')}_ai@taskmanager.com`;
  const avatar = '/claude-profile.png'; // Default AI avatar

  try {
    // Check if name already exists
    const existing = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Agent with this name already exists' });
    }

    await run(
      'INSERT INTO users (id, name, email, avatar, role, is_ai, system_prompt, model_config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, email, avatar, 'member', 1, system_prompt, JSON.stringify({ provider, ...model_config })]
    );
    
    const agent = await get('SELECT id, name, email, avatar, system_prompt, model_config FROM users WHERE id = ?', [id]);
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an agent
app.put('/api/agents/:id', authenticateToken, async (req, res) => {
  const { name, system_prompt, model_config, provider } = req.body;
  const { id } = req.params;

  try {
    // Check if agent exists
    const existingAgent = await get('SELECT * FROM users WHERE id = ? AND is_ai = 1', [id]);
    if (!existingAgent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Update agent
    await run(
      `UPDATE users SET
        name = COALESCE(?, name),
        system_prompt = COALESCE(?, system_prompt),
        model_config = COALESCE(?, model_config)
       WHERE id = ? AND is_ai = 1`,
      [
        name,
        system_prompt,
        model_config ? JSON.stringify({ provider, ...model_config }) : null,
        id
      ]
    );

    const updatedAgent = await get('SELECT id, name, email, avatar, system_prompt, model_config FROM users WHERE id = ?', [id]);
    res.json(updatedAgent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an agent
app.delete('/api/agents/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if agent exists
    const agent = await get('SELECT * FROM users WHERE id = ? AND is_ai = 1', [id]);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Delete agent
    await run('DELETE FROM users WHERE id = ? AND is_ai = 1', [id]);
    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SPECIALISTS (SUB-AGENTS) ROUTES ---

app.get('/api/specialists', authenticateToken, async (req, res) => {
  try {
    const specialists = await all('SELECT * FROM specialists ORDER BY name ASC');
    res.json(specialists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/specialists', authenticateToken, async (req, res) => {
  const { name, description, system_prompt, tools } = req.body;
  const id = Math.random().toString(36).substr(2, 9);

  try {
    await run(
      'INSERT INTO specialists (id, name, description, system_prompt, tools) VALUES (?, ?, ?, ?, ?)',
      [id, name, description, system_prompt, JSON.stringify(tools || [])]
    );
    const specialist = await get('SELECT * FROM specialists WHERE id = ?', [id]);
    res.json(specialist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  // --- RUNNER PAYLOAD ENDPOINT ---

app.get('/api/runner/task/:id', authenticateToken, async (req, res) => {
  const taskId = req.params.id;

  try {
    // 1. Get task details
    const task = await get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // 2. Get Agent (Identity) details
    let agent = null;
    let specialists = [];
    let team = null;

    if (task.team_id) {
      // If assigned to a team, get the Team Lead
      agent = await get('SELECT name, system_prompt, model_config FROM users WHERE team_id = ? AND is_team_lead = 1', [task.team_id]);
      
      // Get Team Details
      team = await get('SELECT name, mission_statement, human_in_the_loop FROM teams WHERE id = ?', [task.team_id]);

      // Get Team Specialists
      specialists = await all(`
        SELECT s.name, s.description, s.system_prompt, s.tools 
        FROM specialists s
        JOIN team_specialists ts ON s.id = ts.specialist_id
        WHERE ts.team_id = ?
      `, [task.team_id]);
    } else {
      // Fallback to direct agent assignment
      agent = await get('SELECT name, system_prompt, model_config FROM users WHERE id = ? AND is_ai = 1', [task.agent_id || task.assignee_id]);
      // For now, fallback to all specialists if not team-bound (or change to none)
      specialists = await all('SELECT name, description, system_prompt, tools FROM specialists');
    }
    
    // 3. Get Project details
    const project = await get('SELECT name, description, repository_path, runner_token, global_rules FROM projects WHERE id = ?', [task.project_id]);

    // 4. (Already fetched specialists above)

    // 5. Get task history (comments)
    const comments = await all('SELECT user_name, content, is_system, created_at FROM comments WHERE task_id = ? ORDER BY created_at ASC', [taskId]);

    res.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority
      },
      identity: agent || { name: 'Generic Agent', system_prompt: 'You are a helpful assistant.' },
      team: team || { name: 'General', mission_statement: 'Execute tasks.' },
      project: project || { name: 'Default', description: '', repository_path: process.cwd(), global_rules: '' },
      specialists: specialists,
      history: comments
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all projects for a runner (universal runner)
app.get('/api/runner/projects', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Runner token required' });
  }

  try {
    let projects = [];

    // First, try to find projects by project-specific token
    const projectByToken = await get('SELECT id FROM projects WHERE runner_token = ?', [token]);
    if (projectByToken) {
      projects = await all('SELECT * FROM projects WHERE id = ?', [projectByToken.id]);
    } else {
      // If not found, try to find user by user-level token and get all their projects
      const user = await get('SELECT id FROM users WHERE runner_token = ?', [token]);
      if (user) {
        projects = await all(`
          SELECT p.* FROM projects p
          WHERE p.created_by = ?
          OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
        `, [user.id, user.id]);
      }
    }

    res.json(projects);
  } catch (err) {
    logger.error('Failed to fetch runner projects:', err);
    res.status(500).json({ error: err.message });
  }
});

// Log ingestion for runners
app.post('/api/runner/logs', async (req, res) => {
  const { taskId, chunk } = req.body;
  if (taskId && chunk) {    // Broadcast log to the specific task room
    io.emit(`task-logs-${taskId}`, { chunk, timestamp: new Date().toISOString() });
  }
  res.sendStatus(200);
});

// Runner heartbeat - supports both project and user tokens
app.post('/api/runner/heartbeat', async (req, res) => {
  const { token, resourceStatus } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    // 1. Try updating user's last_seen (Universal Runner) and resource status
    let userResult;
    if (resourceStatus) {
      userResult = await run(
        'UPDATE users SET runner_last_seen = CURRENT_TIMESTAMP, cto_resource_status = ? WHERE runner_token = ?', 
        [JSON.stringify(resourceStatus), token]
      );
    } else {
      userResult = await run('UPDATE users SET runner_last_seen = CURRENT_TIMESTAMP WHERE runner_token = ?', [token]);
    }

    // 2. Also try updating project's last_seen (Project-specific Runner or legacy)
    const projectResult = await run('UPDATE projects SET last_seen = CURRENT_TIMESTAMP WHERE runner_token = ?', [token]);

    if (userResult.changes === 0 && projectResult.changes === 0) {
      // If neither was updated, log it but don't fail (might be an old token)
      logger.warn(`[Heartbeat] Unknown token received: ${token.substring(0, 5)}...`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Heartbeat] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Error handling middleware - must be last
app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
