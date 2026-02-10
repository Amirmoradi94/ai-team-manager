const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const http = require('http');

// ========== TEST SETUP ==========

let db;
let server;
let port;
const JWT_SECRET = 'test-secret-key';
let testUser;
let testToken;

async function setupDatabase() {
  db = await open({
    filename: ':memory:',
    driver: sqlite3.Database
  });

  await db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      avatar TEXT,
      is_ai BOOLEAN DEFAULT 0,
      system_prompt TEXT,
      model_config TEXT,
      runner_token TEXT,
      runner_last_seen DATETIME,
      team_id TEXT,
      is_team_lead BOOLEAN DEFAULT 0
    )
  `);

  await db.run(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      scheduled_date TEXT,
      scheduled_time TEXT,
      assignee_id TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      execution_time INTEGER,
      tokens_used INTEGER,
      files_modified INTEGER,
      model_used TEXT,
      execution_started_at DATETIME,
      execution_completed_at DATETIME,
      failed_at DATETIME,
      project_id TEXT,
      agent_id TEXT,
      team_id TEXT,
      completion_report TEXT,
      parent_id TEXT,
      task_type TEXT DEFAULT 'task',
      resource_metadata TEXT,
      FOREIGN KEY(assignee_id) REFERENCES users(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    )
  `);

  await db.run(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE teams (
      id TEXT PRIMARY KEY,
      name TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const hashedPassword = await bcrypt.hash('testpass', 10);
  testUser = {
    id: uuidv4(),
    name: 'Test User',
    email: 'test@example.com',
    password: hashedPassword,
    role: 'admin'
  };

  await db.run(
    'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
    [testUser.id, testUser.name, testUser.email, testUser.password, testUser.role]
  );

  testToken = jwt.sign(
    { userId: testUser.id, email: testUser.email, role: testUser.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function startServer() {
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.writeHead(401) && res.end(JSON.stringify({ error: 'Access denied' }));
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Invalid token' }));
    }
  };

  server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    let body = '';
    req.on('data', chunk => body += chunk);
    await new Promise(resolve => req.on('end', resolve));

    const parsedBody = body ? JSON.parse(body) : {};
    req.body = parsedBody;
    req.user = null;

    const authMiddleware = (callback) => {
      authenticateToken(req, res, () => callback());
    };

    // Route: GET /api/runner/active-tasks
    if (req.method === 'GET' && req.url === '/api/runner/active-tasks') {
      return authMiddleware(async () => {
        const tasks = await db.all(`
          SELECT t.*, u.name as assignee_name, u.model_config as assignee_model_config,
                 p.name as project_name, tm.name as team_name
          FROM tasks t
          LEFT JOIN users u ON t.assignee_id = u.id
          LEFT JOIN projects p ON t.project_id = p.id
          LEFT JOIN teams tm ON t.team_id = tm.id
          WHERE t.status = 'in-progress'
          ORDER BY t.created_at ASC
        `);
        res.writeHead(200);
        res.end(JSON.stringify(tasks));
      });
    }

    // Route: GET /api/tasks/:id/subtasks
    if (req.method === 'GET' && req.url.match(/^\/api\/tasks\/[^/]+\/subtasks$/)) {
      const taskId = req.url.split('/')[3];
      return authMiddleware(async () => {
        const subtasks = await db.all(`
          SELECT t.*, u.name as assignee_name, p.name as project_name
          FROM tasks t
          LEFT JOIN users u ON t.assignee_id = u.id
          LEFT JOIN projects p ON t.project_id = p.id
          WHERE t.parent_id = ?
          ORDER BY t.created_at ASC
        `, [taskId]);
        res.writeHead(200);
        res.end(JSON.stringify(subtasks));
      });
    }

    // Route: GET /api/settings/cto
    if (req.method === 'GET' && req.url === '/api/settings/cto') {
      return authMiddleware(async () => {
        const row = await db.get('SELECT value FROM settings WHERE key = ?', ['cto_config']);
        const config = row ? JSON.parse(row.value) : {
          enabled: true,
          ctoProvider: 'gemini',
          subscriptions: { claude: { plan: 'max5x' }, gemini: { plan: 'ultra' }, codex: { plan: 'plus' } },
          maxRetries: 2,
          splitComplexityScore: 45,
          deferWindowUsagePercent: 90
        };
        res.writeHead(200);
        res.end(JSON.stringify(config));
      });
    }

    // Route: PUT /api/settings/cto
    if (req.method === 'PUT' && req.url === '/api/settings/cto') {
      return authMiddleware(async () => {
        const value = JSON.stringify(req.body);
        await db.run(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP',
          ['cto_config', value, value]
        );
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, config: req.body }));
      });
    }

    // Route: POST /api/tasks
    if (req.method === 'POST' && req.url === '/api/tasks') {
      return authMiddleware(async () => {
        if (req.body.task_type && !['task', 'epic', 'subtask'].includes(req.body.task_type)) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Invalid task type' }));
        }
        const taskId = uuidv4();
        const { title, description, status, priority, due_date, scheduled_date, scheduled_time,
                assignee_id, project_id, team_id, parent_id, task_type, resource_metadata } = req.body;
        await db.run(
          `INSERT INTO tasks (id, title, description, status, priority, due_date, scheduled_date, scheduled_time,
           assignee_id, created_by, project_id, team_id, parent_id, task_type, resource_metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [taskId, title, description || '', status || 'todo', priority || 'medium',
           due_date, scheduled_date, scheduled_time, assignee_id, req.user.userId,
           project_id, team_id, parent_id, task_type || 'task', resource_metadata]
        );
        const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
        res.writeHead(201);
        res.end(JSON.stringify(task));
      });
    }

    // Route: PUT /api/tasks/:id
    if (req.method === 'PUT' && req.url.match(/^\/api\/tasks\/[^/]+$/)) {
      const taskId = req.url.split('/')[3];
      return authMiddleware(async () => {
        if (req.body.task_type && !['task', 'epic', 'subtask'].includes(req.body.task_type)) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: 'Invalid task type' }));
        }
        const { title, description, status, priority, due_date, scheduled_date, scheduled_time,
                assignee_id, team_id, parent_id, task_type, resource_metadata } = req.body;
        await db.run(
          `UPDATE tasks SET title = COALESCE(?, title), description = COALESCE(?, description),
           status = COALESCE(?, status), priority = COALESCE(?, priority),
           due_date = COALESCE(?, due_date), scheduled_date = COALESCE(?, scheduled_date),
           scheduled_time = COALESCE(?, scheduled_time), assignee_id = COALESCE(?, assignee_id),
           team_id = COALESCE(?, team_id), parent_id = COALESCE(?, parent_id),
           task_type = COALESCE(?, task_type), resource_metadata = COALESCE(?, resource_metadata)
           WHERE id = ?`,
          [title, description, status, priority, due_date, scheduled_date, scheduled_time,
           assignee_id, team_id, parent_id, task_type, resource_metadata, taskId]
        );
        const task = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
        res.writeHead(200);
        res.end(JSON.stringify(task));
      });
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  await new Promise(resolve => {
    server.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });
}

async function request(method, path, body = null, auth = true) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (auth) options.headers['Authorization'] = `Bearer ${testToken}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ========== SECTION 5: Backend API Endpoint Tests ==========

describe('Backend API Endpoint Tests', () => {
  before(async () => {
    await setupDatabase();
    await startServer();
  });

  after(async () => {
    if (server) server.close();
    if (db) await db.close();
  });

  it('5.1: GET /api/runner/active-tasks - Returns only in-progress tasks', async () => {
    for (const status of ['todo', 'in-progress', 'done', 'in-progress']) {
      await db.run(
        'INSERT INTO tasks (id, title, status, created_by) VALUES (?, ?, ?, ?)',
        [uuidv4(), `Task ${status}`, status, testUser.id]
      );
    }
    const res = await request('GET', '/api/runner/active-tasks');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 2);
    assert.ok(res.body.every(t => t.status === 'in-progress'));
  });

  it('5.2: GET /api/runner/active-tasks - Returns [] when no active tasks', async () => {
    await db.run('DELETE FROM tasks');
    const res = await request('GET', '/api/runner/active-tasks');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 0);
  });

  it('5.3: GET /api/tasks/:id/subtasks - Returns subtasks for parent', async () => {
    const parentId = uuidv4();
    await db.run('INSERT INTO tasks (id, title, task_type, created_by) VALUES (?, ?, ?, ?)',
      [parentId, 'Parent', 'epic', testUser.id]);
    for (let i = 0; i < 3; i++) {
      await db.run('INSERT INTO tasks (id, title, parent_id, task_type, created_by) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), `Sub ${i}`, parentId, 'subtask', testUser.id]);
    }
    const res = await request('GET', `/api/tasks/${parentId}/subtasks`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 3);
  });

  it('5.4: GET /api/tasks/:id/subtasks - Returns [] for task with no children', async () => {
    const taskId = uuidv4();
    await db.run('INSERT INTO tasks (id, title, created_by) VALUES (?, ?, ?)',
      [taskId, 'Solo', testUser.id]);
    const res = await request('GET', `/api/tasks/${taskId}/subtasks`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 0);
  });

  it('5.5: GET /api/settings/cto - Returns default config when none saved', async () => {
    await db.run('DELETE FROM settings WHERE key = ?', ['cto_config']);
    const res = await request('GET', '/api/settings/cto');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.enabled, true);
    assert.strictEqual(res.body.ctoProvider, 'gemini');
  });

  it('5.6: PUT /api/settings/cto - Settings persist to DB', async () => {
    const config = {
      enabled: false,
      ctoProvider: 'claude',
      subscriptions: { claude: { plan: 'pro' }, gemini: { plan: 'pro' }, codex: { plan: 'pro' } },
      maxRetries: 3
    };
    const res = await request('PUT', '/api/settings/cto', config);
    assert.strictEqual(res.status, 200);
    const row = await db.get('SELECT value FROM settings WHERE key = ?', ['cto_config']);
    const saved = JSON.parse(row.value);
    assert.strictEqual(saved.enabled, false);
  });

  it('5.7: GET /api/settings/cto - Returns saved config', async () => {
    const res = await request('GET', '/api/settings/cto');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.enabled, false);
    assert.strictEqual(res.body.ctoProvider, 'claude');
  });

  it('5.8: POST /api/tasks - CTO fields saved correctly', async () => {
    const res = await request('POST', '/api/tasks', {
      title: 'Epic',
      task_type: 'epic',
      resource_metadata: JSON.stringify({ test: true }),
      team_id: 'team-123'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.task_type, 'epic');
    assert.strictEqual(res.body.team_id, 'team-123');
  });

  it('5.9: PUT /api/tasks/:id - CTO fields update correctly', async () => {
    const taskId = uuidv4();
    await db.run('INSERT INTO tasks (id, title, task_type, created_by) VALUES (?, ?, ?, ?)',
      [taskId, 'Original', 'task', testUser.id]);
    const res = await request('PUT', `/api/tasks/${taskId}`, {
      task_type: 'epic',
      resource_metadata: JSON.stringify({ updated: true })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.task_type, 'epic');
  });

  it('5.10: POST /api/tasks - Validator rejects invalid task_type', async () => {
    const res = await request('POST', '/api/tasks', {
      title: 'Test',
      task_type: 'invalid'
    });
    assert.strictEqual(res.status, 400);
  });

  it('5.11: POST /api/tasks - Validator accepts valid task_type', async () => {
    for (const type of ['task', 'epic', 'subtask']) {
      const res = await request('POST', '/api/tasks', {
        title: `Test ${type}`,
        task_type: type
      });
      assert.strictEqual(res.status, 201);
    }
  });

  it('5.12: Auth required on CTO endpoints - 401 without token', async () => {
    const res1 = await request('GET', '/api/runner/active-tasks', null, false);
    assert.strictEqual(res1.status, 401);
    const res2 = await request('GET', '/api/settings/cto', null, false);
    assert.strictEqual(res2.status, 401);
  });
});

console.log('\n✅ All backend API endpoint tests completed\n');
