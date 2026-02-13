-- CTO Task Split Test
-- This creates a complex task in BACKLOG that should trigger CTO split decision

-- First, get required IDs
.mode line
SELECT 'User ID: ' || id FROM users WHERE email = 'amir94eng@gmail.com' LIMIT 1;
SELECT 'Project ID: ' || id FROM projects LIMIT 1;
SELECT 'Team ID: ' || id FROM teams LIMIT 1;

-- Create test task in BACKLOG
INSERT INTO tasks (
  id,
  title,
  description,
  status,
  priority,
  due_date,
  task_type,
  created_by,
  project_id,
  team_id,
  created_at
) VALUES (
  'cto_test_' || strftime('%s', 'now'),
  '🧪 Build Real-Time E-Commerce Analytics Platform',
  'COMPLEX MULTI-PHASE PROJECT - Build a comprehensive real-time analytics system for an e-commerce platform that handles high-traffic loads and provides actionable insights.

PHASE 1 - DATA PIPELINE & API:
- Design and implement RESTful API with Node.js/Express
- Create database schema (PostgreSQL) with indexing strategy
- Build data aggregation engine for sales, traffic, conversion metrics
- Implement rate limiting, caching (Redis), and authentication (JWT)
- Handle 50,000+ concurrent users with horizontal scaling
- Real-time data streaming with WebSocket support

PHASE 2 - FRONTEND DASHBOARD:
- Build responsive React dashboard with TypeScript
- Implement interactive data visualization (Chart.js, D3.js, Recharts)
- Create customizable widgets with drag-and-drop layout
- Real-time updates via WebSocket connections
- Mobile-responsive design (tablet/phone optimization)
- State management with Redux or Zustand
- Lazy loading and code splitting for performance

PHASE 3 - ADVANCED FEATURES:
- Predictive analytics using ML models (trend forecasting)
- Automated anomaly detection and alerts
- Export functionality (PDF, CSV, Excel) with custom reports
- Role-based access control (Admin, Manager, Viewer)
- Multi-tenant support with data isolation
- Comprehensive error handling and logging
- Full test coverage (unit, integration, E2E)
- CI/CD pipeline setup (GitHub Actions/Jenkins)
- Complete technical documentation

DELIVERABLES:
✓ Fully functional API with 20+ endpoints
✓ Interactive dashboard with 15+ chart types
✓ Real-time notification system
✓ Admin panel for configuration
✓ Automated test suite (90%+ coverage)
✓ Deployment scripts and documentation
✓ Performance benchmarks and optimization report

TECHNICAL REQUIREMENTS:
- Stack: Node.js, Express, PostgreSQL, Redis, React, TypeScript
- Testing: Jest, React Testing Library, Cypress
- Deployment: Docker, Kubernetes, AWS/GCP
- Monitoring: Prometheus, Grafana
- Security: OWASP compliance, input validation, SQL injection prevention',
  'backlog',
  'high',
  date('now', '+14 days'),
  'task',
  (SELECT id FROM users WHERE email = 'amir94eng@gmail.com' LIMIT 1),
  (SELECT id FROM projects LIMIT 1),
  (SELECT id FROM teams LIMIT 1),
  datetime('now')
);

-- Verify task was created
SELECT '=== TASK CREATED ===' as message;
SELECT id, title, status, task_type FROM tasks WHERE id LIKE 'cto_test_%' ORDER BY created_at DESC LIMIT 1;
