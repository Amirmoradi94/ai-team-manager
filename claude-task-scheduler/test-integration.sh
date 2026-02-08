#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Claude Task Scheduler - Integration Test             ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo ""

# Test 1: Check if task manager is running
echo -e "${YELLOW}[Test 1]${NC} Checking if Task Manager API is running..."
if curl -s http://localhost:3001/api/auth/login > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Task Manager API is running on port 3001"
else
    echo -e "${RED}✗${NC} Task Manager API is NOT running"
    echo -e "${YELLOW}→${NC} Please start it with:"
    echo -e "   cd ~/Desktop/projects/task-manager/server"
    echo -e "   node index.js"
    exit 1
fi

echo ""

# Test 2: Test API connection
echo -e "${YELLOW}[Test 2]${NC} Testing API connection and authentication..."
node task-manager-api.js > /tmp/test-api.log 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Successfully connected to Task Manager API"

    # Show tasks
    if [ -f claude-tasks.json ]; then
        TASK_COUNT=$(cat claude-tasks.json | grep -c '"id"')
        echo -e "${GREEN}✓${NC} Found ${TASK_COUNT} task(s) assigned to Claude"
        echo ""
        echo -e "${BLUE}Tasks:${NC}"
        cat claude-tasks.json | grep -E '"title"|"status"|"priority"' | sed 's/^/  /'
    fi
else
    echo -e "${RED}✗${NC} Failed to connect to API"
    echo -e "${YELLOW}→${NC} Check logs: cat /tmp/test-api.log"
    exit 1
fi

echo ""

# Test 3: Check if webhook port is available
echo -e "${YELLOW}[Test 3]${NC} Checking if webhook port (3002) is available..."
if ! lsof -i :3002 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Port 3002 is available"
else
    echo -e "${RED}✗${NC} Port 3002 is already in use"
    echo -e "${YELLOW}→${NC} Stop the process or change webhook port in config.json"
    exit 1
fi

echo ""

# Test 4: Check if Claude Code is installed
echo -e "${YELLOW}[Test 4]${NC} Checking if Claude Code CLI is installed..."
if command -v claude &> /dev/null; then
    CLAUDE_VERSION=$(claude --version 2>&1 || echo "unknown")
    echo -e "${GREEN}✓${NC} Claude Code CLI is installed (${CLAUDE_VERSION})"
else
    echo -e "${YELLOW}!${NC} Claude Code CLI not found in PATH"
    echo -e "${YELLOW}→${NC} Task execution will fail unless Claude Code is installed"
    echo -e "${YELLOW}→${NC} You can still test the task fetching functionality"
fi

echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Integration Test Summary                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}All tests passed!${NC} You can now:"
echo ""
echo -e "${YELLOW}1.${NC} Start the scheduler:"
echo -e "   ${BLUE}npm start${NC}"
echo ""
echo -e "${YELLOW}2.${NC} Create a test task in the Task Manager:"
echo -e "   - Visit http://localhost:8081"
echo -e "   - Create a new task"
echo -e "   - Assign to yourself (or Claude user)"
echo -e "   - The scheduler will pick it up in ~30 min"
echo ""
echo -e "${YELLOW}3.${NC} Or trigger a manual check:"
echo -e "   ${BLUE}curl http://localhost:3002/trigger/check${NC}"
echo ""
echo -e "${YELLOW}4.${NC} Monitor the scheduler:"
echo -e "   ${BLUE}curl http://localhost:3002/health${NC}"
echo ""
echo -e "${YELLOW}5.${NC} View logs:"
echo -e "   ${BLUE}tail -f logs/task-*.log${NC}"
echo ""
