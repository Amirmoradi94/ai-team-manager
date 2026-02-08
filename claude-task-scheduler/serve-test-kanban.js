const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve the test kanban HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-kanban.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎯 Test Kanban Board running at http://localhost:${PORT}`);
  console.log(`\nCredentials for testing:`);
  console.log(`  Email: claude@example.com`);
  console.log(`  Password: password123`);
  console.log(`\nTo test the kanban-checker, run in another terminal:`);
  console.log(`  npm run test:kanban\n`);
  console.log(`Press Ctrl+C to stop\n`);
});
