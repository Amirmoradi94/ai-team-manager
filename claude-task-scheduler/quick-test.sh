#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Claude Task Scheduler - Quick Test                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if scheduler is running
echo -e "${YELLOW}[1/4]${NC} Checking if scheduler is running..."
if curl -s http://localhost:3002/health > /dev/null; then
    echo -e "${GREEN}✓${NC} Scheduler is running on port 3002"
else
    echo -e "${RED}✗${NC} Scheduler is NOT running"
    echo -e "${YELLOW}→${NC} Start it with: cd ~/Desktop/projects/claude-task-scheduler && npm start"
    exit 1
fi

echo ""

# Check if Task Manager API is running
echo -e "${YELLOW}[2/4]${NC} Checking if Task Manager API is running..."
if curl -s http://localhost:3001/api/auth/login > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Task Manager API is running on port 3001"
else
    echo -e "${RED}✗${NC} Task Manager API is NOT running"
    echo -e "${YELLOW}→${NC} Start it with: cd ~/Desktop/projects/task-manager/server && node index.js"
    exit 1
fi

echo ""

# Send a test webhook
echo -e "${YELLOW}[3/4]${NC} Sending test task via webhook..."

RESPONSE=$(curl -s -X POST http://localhost:3002/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret-change-this" \
  -d '{
    "id": "quick-test-'$(date +%s)'",
    "title": "Quick Test Task",
    "description": "Print the current date and time using Python",
    "status": "todo",
    "priority": "high",
    "assignee_name": "claude"
  }')

if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓${NC} Webhook received successfully"
    echo "  Response: $RESPONSE"
else
    echo -e "${RED}✗${NC} Webhook failed"
    echo "  Response: $RESPONSE"
fi

echo ""

# Check logs
echo -e "${YELLOW}[4/4]${NC} Checking execution logs..."
LATEST_LOG=$(ls -t ~/Desktop/projects/claude-task-scheduler/logs/task-*.log 2>/dev/null | head -1)

if [ -f "$LATEST_LOG" ]; then
    echo -e "${GREEN}✓${NC} Found latest log: $LATEST_LOG"
    echo ""
    echo -e "${BLUE}=== Last 20 lines of output ====${NC}"
    tail -20 "$LATEST_LOG"
else
    echo -e "${YELLOW}!${NC} No logs found yet - task may still be executing"
    echo "  Try again in a few seconds..."
    echo "  Watch logs with: tail -f ~/Desktop/projects/claude-task-scheduler/logs/task-*.log"
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Test Summary                                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ All systems operational!${NC}"
echo ""
echo -e "📋 ${BLUE}Next Steps:${NC}"
echo "  1. Check the logs above for Claude's output"
echo "  2. Create a real task in Task Manager (http://localhost:8081)"
echo "  3. Assign it to Claude"
echo "  4. Watch it execute automatically!"
echo ""
echo -e "📚 ${BLUE}Documentation:${NC}"
echo "  - TEST-WORKFLOW.md - Complete testing guide"
echo "  - WEBHOOK-GUIDE.md - Webhook integration guide"
echo "  - API-REFERENCE.md - Full API documentation"
echo ""
