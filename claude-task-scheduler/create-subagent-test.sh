#!/bin/bash
set -e

echo "Creating Subagent Access Test Task..."
echo ""

# Get authentication token
echo "Logging in..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"claude@taskmanager.com","password":".PX0UQUBN67Nme32"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Error: Failed to get authentication token"
  exit 1
fi

echo "Logged in successfully"
echo ""

# Create the task
echo "Creating task..."
RESPONSE=$(curl -s -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Subagent Access Test",
    "description": "IMPORTANT: First, please confirm whether you have access to the Task tool for spawning subagents. List which subagent types are available to you (e.g., frontend-developer, backend-developer, QA-engineer, etc.).\n\nThen, to demonstrate subagent functionality, please create a simple Hello World program using TWO different subagents:\n1. Use backend-developer subagent to create a Node.js hello world function\n2. Use QA-engineer subagent to write a test for that function\n\nThis is a test to verify you can actually spawn and use subagents via the Task tool.",
    "status": "todo",
    "priority": "high",
    "assignee_id": "vr6yycu4w"
  }')

echo "Task created!"
echo ""
echo "$RESPONSE" | jq '{id, title, status, priority}'
echo ""
echo "✅ Task created successfully!"
echo "📺 Watch for a new Terminal window to open where Claude will execute this task"
echo "🤖 You should see subagents being spawned (backend-developer, QA-engineer)"
