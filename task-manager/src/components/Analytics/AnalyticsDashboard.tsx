import { Task } from '@/types/task';
import { PerformanceMetrics } from './PerformanceMetrics';
import { TaskDistribution } from './TaskDistribution';
import { TeamPerformance } from './TeamPerformance';

interface AnalyticsDashboardProps {
  tasks: Task[];
  teamMembers: any[];
}

export function AnalyticsDashboard({ tasks, teamMembers }: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Performance Metrics */}
      <PerformanceMetrics tasks={tasks} />

      {/* Task Distribution Charts */}
      <TaskDistribution tasks={tasks} />

      {/* Team Performance */}
      <TeamPerformance tasks={tasks} teamMembers={teamMembers} />
    </div>
  );
}
