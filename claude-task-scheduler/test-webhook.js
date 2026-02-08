const http = require('http');
const config = require('./config.json');

/**
 * Webhook Testing Suite
 * Tests the webhook server functionality
 */

const WEBHOOK_URL = config.webhook.url;
const WEBHOOK_SECRET = config.webhook.secret;
const WEBHOOK_PORT = config.webhook.port;
const HEALTH_URL = `http://localhost:${WEBHOOK_PORT}/health`;

// Test data
const testTask = {
  id: 'task-test-webhook-001',
  title: 'Test Webhook',
  description: 'This is a test webhook from Task Manager settings.',
  priority: 'medium',
  status: 'todo',
  assignee_id: 'claude',
  assignee_name: 'Claude'
};

/**
 * Helper function to make HTTP requests
 */
function makeRequest(method, url, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Test 1: Check if webhook server is running (Health Check)
 */
async function testHealthCheck() {
  console.log('\n📋 Test 1: Health Check Endpoint');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Testing: GET ${HEALTH_URL}`);

  try {
    const response = await makeRequest('GET', HEALTH_URL);

    if (response.statusCode === 200) {
      console.log('✅ PASS: Webhook server is responding');
      console.log(`   Status: ${response.body.status}`);
      console.log(`   Authenticated: ${response.body.authenticated}`);
      console.log(`   Scheduled Jobs: ${response.body.scheduledJobs}`);
      console.log(`   Uptime: ${response.body.uptime}s`);
      return true;
    } else {
      console.log('❌ FAIL: Unexpected status code', response.statusCode);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
    console.log('   (Is the webhook server running? Run: npm start)');
    return false;
  }
}

/**
 * Test 2: Send webhook without secret (should fail)
 */
async function testWebhookWithoutSecret() {
  console.log('\n📋 Test 2: Webhook Without Secret (Should Reject)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Testing: POST ${WEBHOOK_URL} (without secret)`);

  try {
    const response = await makeRequest('POST', WEBHOOK_URL, testTask, {});

    if (response.statusCode === 401) {
      console.log('✅ PASS: Webhook correctly rejected request without secret');
      console.log(`   Response: ${response.body.error}`);
      return true;
    } else {
      console.log(`❌ FAIL: Expected 401, got ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Send webhook with correct secret (should succeed)
 */
async function testWebhookWithSecret() {
  console.log('\n📋 Test 3: Webhook With Correct Secret (Should Accept)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Testing: POST ${WEBHOOK_URL} (with secret)`);

  try {
    const response = await makeRequest('POST', WEBHOOK_URL, testTask, {
      'x-webhook-secret': WEBHOOK_SECRET,
    });

    if (response.statusCode === 200 && response.body.success) {
      console.log('✅ PASS: Webhook correctly accepted request with valid secret');
      console.log(`   Message: ${response.body.message}`);
      console.log(`   Task ID: ${response.body.taskId}`);
      return true;
    } else {
      console.log(`❌ FAIL: Expected success response, got:`, response);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Send webhook with wrong secret (should fail)
 */
async function testWebhookWithWrongSecret() {
  console.log('\n📋 Test 4: Webhook With Wrong Secret (Should Reject)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Testing: POST ${WEBHOOK_URL} (with wrong secret)`);

  try {
    const response = await makeRequest('POST', WEBHOOK_URL, testTask, {
      'x-webhook-secret': 'wrong-secret-12345',
    });

    if (response.statusCode === 401) {
      console.log('✅ PASS: Webhook correctly rejected request with wrong secret');
      console.log(`   Response: ${response.body.error}`);
      return true;
    } else {
      console.log(`❌ FAIL: Expected 401, got ${response.statusCode}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
    return false;
  }
}

/**
 * Test 5: Manual trigger endpoint
 */
async function testManualTrigger() {
  console.log('\n📋 Test 5: Manual Task Check Trigger');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const triggerUrl = `http://localhost:${WEBHOOK_PORT}/trigger/check`;
  console.log(`Testing: POST ${triggerUrl}`);

  try {
    const response = await makeRequest('POST', triggerUrl, {});

    if (response.statusCode === 200 && response.body.success) {
      console.log('✅ PASS: Manual trigger endpoint working');
      console.log(`   Message: ${response.body.message}`);
      return true;
    } else {
      console.log(`❌ FAIL: Expected success response`);
      return false;
    }
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     CLAUDE TASK SCHEDULER - WEBHOOK TEST SUITE         ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nConfiguration:`);
  console.log(`  Webhook URL: ${WEBHOOK_URL}`);
  console.log(`  Webhook Port: ${WEBHOOK_PORT}`);
  console.log(`  Webhook Secret: ${WEBHOOK_SECRET}`);

  const results = [];

  results.push({
    test: 'Health Check',
    passed: await testHealthCheck(),
  });

  results.push({
    test: 'Webhook Without Secret',
    passed: await testWebhookWithoutSecret(),
  });

  results.push({
    test: 'Webhook With Correct Secret',
    passed: await testWebhookWithSecret(),
  });

  results.push({
    test: 'Webhook With Wrong Secret',
    passed: await testWebhookWithWrongSecret(),
  });

  results.push({
    test: 'Manual Task Check Trigger',
    passed: await testManualTrigger(),
  });

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                        ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  results.forEach((result) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.test}`);
  });

  console.log(`\n${passed} / ${total} tests passed\n`);

  if (passed === total) {
    console.log('🎉 All tests passed! Webhook is working correctly.\n');
    return 0;
  } else {
    console.log('⚠️  Some tests failed. Please check the webhook server.\n');
    return 1;
  }
}

// Main execution
if (require.main === module) {
  runAllTests()
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      console.error('Test suite error:', error);
      process.exit(1);
    });
}

module.exports = { testHealthCheck, testWebhookWithSecret, testWebhookWithWrongSecret };
