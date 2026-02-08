#!/bin/bash

# Test webhook endpoint

curl -X POST http://localhost:3001/webhook/task-assigned \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-webhook-secret" \
  -d '{
    "title": "Implement user authentication",
    "description": "Add JWT-based authentication to the API with login and register endpoints",
    "priority": "high",
    "status": "todo",
    "dueDate": "2026-02-10",
    "id": "task-123"
  }'

echo ""
