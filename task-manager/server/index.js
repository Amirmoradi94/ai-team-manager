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
  const { title, description, status, priority, due_date, assignee_id, scheduled_date, scheduled_time } = req.body;
  const id = Math.random().toString(36).substr(2, 9);
  const created_by = req.user.id;

  try {
    await run(
      `INSERT INTO tasks (id, title, description, status, priority, due_date, assignee_id, created_by, scheduled_date, scheduled_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description, status || 'todo', priority || 'medium', due_date, assignee_id, created_by, scheduled_date, scheduled_time]
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

// --- SETTINGS ROUTES ---

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
    const projects = await all('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
  const { name, description, repository_path, global_rules } = req.body;
  const id = Math.random().toString(36).substr(2, 9);
  const runner_token = Math.random().toString(36).substr(2, 15); // Simple token

  try {
    await run(
      'INSERT INTO projects (id, name, description, repository_path, global_rules, runner_token, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, description, repository_path, global_rules, runner_token, req.user.id]
    );
    const project = await get('SELECT * FROM projects WHERE id = ?', [id]);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- RUNNER (UNIVERSAL) ROUTES ---

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

// Runner heartbeat endpoint (called by agent-runner)
app.post('/api/runner/heartbeat', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Runner token required' });
  }

  try {
    const result = await run(
      'UPDATE users SET runner_last_seen = CURRENT_TIMESTAMP WHERE runner_token = ?',
      [token]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Invalid runner token' });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('Runner heartbeat failed:', err);
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
    // Find user by runner token
    const user = await get('SELECT id FROM users WHERE runner_token = ?', [token]);

    if (!user) {
      return res.status(404).json({ error: 'Invalid runner token' });
    }

    // Get all projects the user has access to
    const projects = await all(`
      SELECT p.* FROM projects p
      WHERE p.created_by = ?
      OR p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
    `, [user.id, user.id]);

    const projectIds = projects.map(p => p.id);

    if (projectIds.length === 0) {
      return res.json([]);
    }

    // Get all pending tasks for these projects with full context
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
    const agent = await get('SELECT name, system_prompt, model_config FROM users WHERE id = ? AND is_ai = 1', [task.agent_id || task.assignee_id]);
    
    // 3. Get Project details
    const project = await get('SELECT name, repository_path, runner_token, global_rules FROM projects WHERE id = ?', [task.project_id]);

    // 4. Get relevant specialists mentioned in task (simple regex for @Name)
    const mentions = task.description.match(/@(\w+)/g) || [];
    const specialistNames = mentions.map(m => m.substring(1));
    
    let specialists = [];
    if (specialistNames.length > 0) {
      const placeholders = specialistNames.map(() => '?').join(',');
      specialists = await all(`SELECT name, system_prompt, tools FROM specialists WHERE name IN (${placeholders})`, specialistNames);
    }

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
      project: project || { name: 'Default', repository_path: process.cwd() },
      specialists: specialists,
      history: comments
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log ingestion for runners
app.post('/api/runner/logs', async (req, res) => {
  const { taskId, chunk } = req.body;
  if (taskId && chunk) {
    // Broadcast log to the specific task room
    io.emit(`task-logs-${taskId}`, { chunk, timestamp: new Date().toISOString() });
  }
  res.sendStatus(200);
});

// Runner heartbeat
app.post('/api/runner/heartbeat', async (req, res) => {
  const { runnerToken } = req.body;
  if (runnerToken) {
    await run('UPDATE projects SET last_seen = CURRENT_TIMESTAMP WHERE runner_token = ?', [runnerToken]);
  }
  res.sendStatus(200);
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Error handling middleware - must be last
app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
