# Cascading Updates Implementation Status

## ✅ Completed

### 1. Documentation
- ✅ Created `CASCADING_UPDATES.md` - Complete update matrix
- ✅ Created `SYSTEM_ARCHITECTURE.md` - Full relationship analysis
- ✅ Created this implementation tracking document

### 2. Backend Infrastructure
- ✅ Created `task-manager/server/context-sync.js` - Context sync helper class
- ✅ Integrated context sync into server (`index.js`)
- ✅ Added sync calls to key endpoints:
  - POST `/api/employees` - Employee creation
  - DELETE `/api/employees/:id` - Employee deletion
  - POST `/api/teams` - Team creation

### 3. Context Manager
- ✅ Existing `agent-runner/context-manager.js` handles full syncs
- ✅ Script `agent-runner/scripts/sync-context.js` can be called manually
- ✅ Full sync happens every 2 minutes in agent-runner

## 🚧 In Progress / To Do

### High Priority Endpoints Need Sync Calls:

#### Teams
- ⏳ PUT `/api/teams/:id` - Team update
- ⏳ DELETE `/api/teams/:id` - Team deletion
- ⏳ POST `/api/teams/:id/specialists` - Assign employee to team
- ⏳ DELETE `/api/teams/:teamId/specialists/:specialistId` - Remove employee from team

#### Projects
- ⏳ POST `/api/projects` - Project creation
- ⏳ PUT `/api/projects/:id` - Project update
- ⏳ DELETE `/api/projects/:id` - Project deletion

#### Tasks
- ⏳ POST `/api/projects/:projectId/tasks` - Task creation
- ⏳ PUT `/api/tasks/:id` - Task update (status change)
- ⏳ DELETE `/api/tasks/:id` - Task deletion
- ⏳ POST `/api/tasks/:id/assign` - Task assignment

#### Users
- ⏳ POST `/api/auth/register` - User creation
- ⏳ PUT `/api/users/:id` - User update
- ⏳ DELETE `/api/users/:id` - User deletion

### Medium Priority:

#### Skills
- ⏳ POST `/api/specialists/:id/tools` - Assign skill to employee
- ⏳ DELETE `/api/specialists/:id/tools/:toolId` - Remove skill

#### CTO Decisions
- ⏳ POST `/api/cto/decisions` - Log CTO decision
- ⏳ POST `/api/cto/resource-update` - Update resource state

### Low Priority:

#### Comments
- ⏳ POST `/api/tasks/:id/comments` - Add comment (minor sync)

## Implementation Pattern

For each endpoint, add this pattern **after** successful database operation:

```javascript
// After successful DB operation
contextSync.syncAfterXxxChange(action, entityId, entityData).catch(err =>
  logger.error('Context sync failed:', err)
);
```

### Examples:

```javascript
// Employee creation
contextSync.syncAfterEmployeeChange('created', id, specialist).catch(err =>
  logger.error('Context sync failed:', err)
);

// Team deletion
contextSync.syncAfterTeamChange('deleted', teamId).catch(err =>
  logger.error('Context sync failed:', err)
);

// Task assignment
contextSync.syncAfterTaskChange('assigned', taskId, taskData).catch(err =>
  logger.error('Context sync failed:', err)
);
```

## How It Works

### Current Flow:

```
1. Frontend makes API request
   ↓
2. Backend validates and processes
   ↓
3. Database updated
   ↓
4. contextSync.syncAfterXxxChange() called (non-blocking)
   ↓
5. Response returned to frontend (fast!)
   ↓
6. Background: contextSync triggers agent-runner sync
   ↓
7. agent-runner executes `npm run sync-context`
   ↓
8. CompanyContextManager.fullSync() runs
   ↓
9. ~/mycompany/ markdown files updated
   ↓
10. CTO/Team Leads read updated context
```

### Key Features:

- **Non-blocking**: Sync happens in background, doesn't slow down API
- **Debounced**: Multiple rapid changes trigger one sync
- **Full sync**: Currently does full sync (safe but slower)
- **Error handling**: Sync failures logged but don't break API

## Future Optimizations

### Phase 1: Targeted Syncs (Performance)
Instead of full sync, update only affected files:

```javascript
// Instead of fullSync(), do:
await contextManager.updateTeamFiles(teamId);
await contextManager.updateOrganizationOverview();
```

Benefits:
- Faster syncs (only affected files)
- Reduce disk I/O
- Scale better with large datasets

### Phase 2: Real-time Updates (UX)
Use Socket.io to notify clients:

```javascript
// Server emits
io.emit('team:updated', { teamId, changes });

// Frontend listens
socket.on('team:updated', ({ teamId }) => {
  refetchTeamData(teamId);
});
```

Benefits:
- Frontend updates without refresh
- Better UX
- Immediate feedback

### Phase 3: Event Queue (Reliability)
Use event queue for sync operations:

```javascript
// Instead of direct sync
await eventQueue.enqueue('context:sync:team', { teamId });

// Worker processes queue
eventQueue.process('context:sync:team', async ({ teamId }) => {
  await contextManager.updateTeamFiles(teamId);
});
```

Benefits:
- Guaranteed execution
- Retry on failure
- Track sync history
- Handle bursts

## Testing Checklist

### Manual Testing:
- [ ] Create employee → Check `mycompany/organization/EMPLOYEES.md`
- [ ] Delete employee → Verify removed from all files
- [ ] Create team → Check `mycompany/teams/{name}/` created
- [ ] Assign employee to team → Check team's `MEMBERS.md` and `SKILLS.md`
- [ ] Remove employee from team → Verify removed from team files
- [ ] Create task → Check `mycompany/cto/TASK_HISTORY.md`
- [ ] Update team lead → Check `mycompany/teams/{name}/LEAD.md`
- [ ] Delete team → Verify directory removed

### Automated Testing:
```javascript
// Example test
test('employee creation triggers context sync', async () => {
  const employee = await createEmployee({ name: 'Test' });
  await sleep(5000); // Wait for sync
  const employeesFile = readFile('mycompany/organization/EMPLOYEES.md');
  expect(employeesFile).toContain('Test');
});
```

## Rollout Strategy

### Phase 1: High-Priority Endpoints (Week 1)
- Add sync to all employee endpoints
- Add sync to all team endpoints
- Add sync to task creation/assignment
- Test thoroughly

### Phase 2: Remaining Endpoints (Week 2)
- Add sync to project endpoints
- Add sync to user endpoints
- Add sync to skill assignment
- Test thoroughly

### Phase 3: Optimization (Week 3)
- Implement targeted syncs
- Add real-time updates
- Performance testing
- Load testing

### Phase 4: Event Queue (Week 4)
- Set up event queue system
- Migrate to queued syncs
- Add retry logic
- Monitoring & alerts

## Monitoring

### Metrics to Track:
- Sync execution time
- Sync success/failure rate
- Number of syncs per minute
- Context file size growth

### Alerts:
- Sync failures > 5% → Investigate
- Sync time > 10s → Optimize
- Context files > 50MB → Archive old data

## Database Triggers (Optional)

For critical cascades, can add SQL triggers:

```sql
-- Example: Auto-update team member count
CREATE TRIGGER update_team_count
AFTER INSERT ON team_specialists
BEGIN
  -- Could update a counter field
  -- Or trigger external script
END;
```

Benefits:
- Guaranteed execution at DB level
- Can't be bypassed
- Atomic with transaction

Drawbacks:
- Harder to debug
- Less flexible
- Tied to specific DB

## Quick Reference

### Add Sync to New Endpoint:

1. Import at top of file (already done):
```javascript
const contextSync = require('./context-sync');
```

2. After successful DB operation, add:
```javascript
contextSync.syncAfterXxxChange(action, id, data).catch(err =>
  logger.error('Context sync failed:', err)
);
```

3. Actions: `'created'`, `'updated'`, `'deleted'`, `'assigned'`, `'removed'`

4. Methods available:
   - `syncAfterProjectChange(action, projectId, data)`
   - `syncAfterTeamChange(action, teamId, data)`
   - `syncAfterEmployeeChange(action, employeeId, data)`
   - `syncAfterTaskChange(action, taskId, data)`
   - `syncAfterUserChange(action, userId, data)`
   - `syncAfterTeamMemberChange(teamId, employeeId, action)`
   - `syncAfterSkillChange(employeeId, skillIds, action)`
   - `syncAfterCTODecision(taskId, decision)`

## Next Steps

1. **Immediate**: Add sync calls to remaining high-priority endpoints
2. **This Week**: Complete all endpoint integrations
3. **Next Week**: Implement targeted syncs for performance
4. **Future**: Add real-time updates and event queue

---

**Status**: Foundation Complete, Endpoints In Progress
**Last Updated**: 2026-02-12
**Priority**: High - Ensures data consistency
