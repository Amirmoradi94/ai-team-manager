import { Task } from '@/types/task';
import { TrendingUp, TrendingDown, Target, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface PerformanceMetricsProps {
  tasks: Task[];
}

export function PerformanceMetrics({ tasks }: PerformanceMetricsProps) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const todoTasks = tasks.filter(t => t.status === 'todo').length;
  const backlogTasks = tasks.filter(t => t.status === 'backlog').length;

  const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length;
  const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'done').length;

  const overallCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const activeTasksRate = totalTasks > 0 ? ((inProgressTasks + todoTasks) / totalTasks) * 100 : 0;

  const tasksWithAssignee = tasks.filter(t => t.assignee).length;
  const assignmentRate = totalTasks > 0 ? (tasksWithAssignee / totalTasks) * 100 : 0;

  const metrics = [
    {
      title: 'Total Tasks',
      value: totalTasks,
      icon: Target,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      trend: null,
    },
    {
      title: 'Completed',
      value: completedTasks,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
      subtitle: `${Math.round(overallCompletionRate)}% completion rate`,
      trend: overallCompletionRate >= 50 ? 'up' : 'down',
    },
    {
      title: 'In Progress',
      value: inProgressTasks,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      subtitle: `${todoTasks} in todo`,
    },
    {
      title: 'High Priority',
      value: urgentTasks + highPriorityTasks,
      icon: AlertCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      subtitle: `${urgentTasks} urgent`,
      trend: urgentTasks > 0 ? 'down' : null,
    },
  ];

  const kpis = [
    {
      label: 'Completion Rate',
      value: `${Math.round(overallCompletionRate)}%`,
      isGood: overallCompletionRate >= 60,
    },
    {
      label: 'Active Tasks',
      value: `${Math.round(activeTasksRate)}%`,
      isGood: activeTasksRate <= 70,
    },
    {
      label: 'Assignment Rate',
      value: `${Math.round(assignmentRate)}%`,
      isGood: assignmentRate >= 70,
    },
    {
      label: 'Backlog',
      value: backlogTasks,
      isGood: backlogTasks <= 10,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.title}
              className="rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-teal-900/20 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-teal-500/20">
                  <Icon className="w-6 h-6 text-teal-200" />
                </div>
                {metric.trend && (
                  <div className={`flex items-center gap-1 ${
                    metric.trend === 'up' ? 'text-success' : 'text-destructive'
                  }`}>
                    {metric.trend === 'up' ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                )}
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">{metric.value}</div>
              <div className="text-xs uppercase tracking-widest text-teal-200/70 mb-1">{metric.title}</div>
              {metric.subtitle && (
                <div className="text-xs text-muted-foreground">{metric.subtitle}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* KPI Cards */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-teal-900/20 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
        <h3 className="text-lg font-semibold text-foreground mb-4">Key Performance Indicators</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="text-center p-4 rounded-xl border border-teal-500/20 bg-slate-900/60">
              <div className={`text-2xl font-bold mb-1 ${
                kpi.isGood ? 'text-success' : 'text-warning'
              }`}>
                {kpi.value}
              </div>
              <div className="text-xs uppercase tracking-widest text-teal-200/70">{kpi.label}</div>
              <div className={`mt-2 w-2 h-2 rounded-full mx-auto ${
                kpi.isGood ? 'bg-success' : 'bg-warning'
              }`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
