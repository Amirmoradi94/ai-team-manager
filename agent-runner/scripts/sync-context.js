#!/usr/bin/env node

/**
 * Context Sync Script
 *
 * Synchronizes the task-manager database with the ~/mycompany/ directory.
 * Called automatically by the backend when entities change, or manually via:
 *   npm run sync-context
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { promisify } = require('util');
const CompanyContextManager = require('../context-manager');

// Database helper wrapper
class DatabaseWrapper {
  constructor(dbPath) {
    this.db = new sqlite3.Database(dbPath);
    this.db.configure('busyTimeout', 5000); // 5 second timeout for busy database
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

async function main() {
  console.log('========================================');
  console.log('  Context Sync Script');
  console.log('========================================\n');

  try {
    // Find database
    const dbPath = path.join(__dirname, '../../task-manager/server/taskmanager.db');
    console.log(`[Sync] Database: ${dbPath}`);

    // Connect to database
    const db = new DatabaseWrapper(dbPath);
    console.log('[Sync] Database connected\n');

    // Initialize context manager
    const contextManager = new CompanyContextManager();

    // Perform full sync
    await contextManager.syncAll(db);

    // Close database
    await db.close();
    console.log('\n[Sync] Database connection closed');

    console.log('\n========================================');
    console.log('  ✓ Sync completed successfully!');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('  ✗ Sync failed!');
    console.error('========================================\n');
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = main;
