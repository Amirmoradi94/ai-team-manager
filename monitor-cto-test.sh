#!/bin/bash
# Monitor CTO Task Split Test

DB_PATH="/Users/amirmoradi94/Desktop/Projects/ai-team-manager/task-manager/server/taskmanager.db"
LOG_FILE=$(ls -t /tmp/cto-test-*.log 2>/dev/null | head -1)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔍 CTO TASK SPLIT TEST - MONITORING DASHBOARD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check runner status
echo "📊 RUNNER STATUS:"
if ps aux | grep -q "[a]gent-executor.js"; then
    echo "  ✅ Agent Runner is RUNNING"
    RUNNER_PID=$(ps aux | grep "[a]gent-executor.js" | awk '{print $2}' | head -1)
    echo "  📍 PID: $RUNNER_PID"
    if [ -n "$LOG_FILE" ]; then
        echo "  📄 Log: $LOG_FILE"
    fi
else
    echo "  ❌ Agent Runner is NOT RUNNING"
    echo "  💡 Start it with: cd agent-runner && node agent-executor.js"
fi
echo ""

# Check CTO configuration
echo "🤖 CTO CONFIGURATION:"
CTO_ENABLED=$(sqlite3 "$DB_PATH" "SELECT json_extract(value, '$.enabled') FROM settings WHERE key='cto_config'")
CTO_PROVIDER=$(sqlite3 "$DB_PATH" "SELECT json_extract(value, '$.ctoProvider') FROM settings WHERE key='cto_config'")
USE_AI=$(sqlite3 "$DB_PATH" "SELECT json_extract(value, '$.useAIForDecisions') FROM settings WHERE key='cto_config'")
SPLIT_THRESHOLD=$(sqlite3 "$DB_PATH" "SELECT json_extract(value, '$.splitComplexityScore') FROM settings WHERE key='cto_config'")

echo "  Enabled: $CTO_ENABLED"
echo "  Provider: $CTO_PROVIDER"
echo "  Use AI: $USE_AI"
echo "  Split Threshold: $SPLIT_THRESHOLD"
echo ""

# Check test task
echo "📝 TEST TASK STATUS:"
sqlite3 "$DB_PATH" << 'EOF'
.mode column
.headers on
SELECT
  substr(id, 1, 20) as id,
  substr(title, 1, 40) as title,
  status,
  task_type,
  parent_id
FROM tasks
WHERE id LIKE 'cto_test_%' OR parent_id LIKE 'cto_test_%'
ORDER BY created_at;
EOF
echo ""

# Count subtasks
SUBTASK_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tasks WHERE parent_id LIKE 'cto_test_%'")
echo "  📊 Subtasks created: $SUBTASK_COUNT"
echo ""

# Check recent CTO logs
if [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ]; then
    echo "🔍 RECENT CTO ACTIVITY (last 20 lines):"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    tail -20 "$LOG_FILE" | grep -E "\[CTO\]|\[Runner\]|Decision:|split" --color=auto || tail -20 "$LOG_FILE"
    echo ""
fi

# Check CTO state files
echo "📂 CTO STATE FILES:"
if [ -f ~/mycompany/cto/TASK_HISTORY.md ]; then
    echo "  ✅ Task History exists"
    LAST_DECISION=$(tail -5 ~/mycompany/cto/TASK_HISTORY.md)
    if [ -n "$LAST_DECISION" ]; then
        echo "  Last decision:"
        echo "$LAST_DECISION" | sed 's/^/    /'
    fi
else
    echo "  ⚠️  Task History not found at ~/mycompany/cto/TASK_HISTORY.md"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  💡 COMMANDS:"
echo "    Watch logs:  tail -f $LOG_FILE"
echo "    Re-run test: bash monitor-cto-test.sh"
echo "    Check DB:    sqlite3 $DB_PATH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
