import { Task, User } from '@/types/task';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, TrendingUp, CheckCircle2, Clock } from 'lucide-react';

interface TeamMemberStats {
  user: User;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  completionRate: number;
  avgCompletionTime?: number;
}

interface TeamPerformanceProps {
  tasks: Task[];
  teamMembers: any[];
}

export function TeamPerformance({ tasks, teamMembers }: TeamPerformanceProps) {
  const calculateMemberStats = (): TeamMemberStats[] => {
    return teamMembers.map(member => {
      const memberTasks = tasks.filter(t => t.assignee?.id === member.id);
      const completed = memberTasks.filter(t => t.status === 'done').length;
      const inProgress = memberTasks.filter(t => t.status === 'in-progress').length;
      const totalAssigned = memberTasks.length;
      const completionRate = totalAssigned > 0 ? (completed / totalAssigned) * 100 : 0;

      return {
        user: member,
        totalAssigned,
        completed,
        inProgress,
        completionRate
      };
    }).sort((a, b) => b.completionRate - a.completionRate);
  };

  const stats = calculateMemberStats();
  const topPerformer = stats[0];

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Team Performance</h3>
        <Trophy className="w-5 h-5 text-warning" />
      </div>

      <div className="space-y-4">
        {stats.map((stat, index) => {
          const isTopPerformer = index === 0 && stat.completionRate > 0;

          return (
            <div
              key={stat.user.id}
              className={`p-4 rounded-lg border transition-all ${
                isTopPerformer
                  ? 'border-warning/50 bg-warning/5'
                  : 'border-border bg-secondary/30'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={stat.user.avatar} alt={stat.user.name} />
                    <AvatarFallback className="bg-primary/10">
                      {stat.user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{stat.user.name}</span>
                      {isTopPerformer && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-warning/20 text-warning border border-warning/30">
                          Top Performer
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{stat.user.email}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-foreground">
                    {Math.round(stat.completionRate)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Completion Rate</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-2 rounded bg-background/50">
                  <div className="text-sm font-semibold text-foreground">{stat.totalAssigned}</div>
                  <div className="text-xs text-muted-foreground">Assigned</div>
                </div>
                <div className="text-center p-2 rounded bg-success/10">
                  <div className="text-sm font-semibold text-success">{stat.completed}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="text-center p-2 rounded bg-info/10">
                  <div className="text-sm font-semibold text-info">{stat.inProgress}</div>
                  <div className="text-xs text-muted-foreground">In Progress</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      isTopPerformer ? 'bg-warning' : 'bg-primary'
                    }`}
                    style={{ width: `${stat.completionRate}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {stats.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No team member data available
          </div>
        )}
      </div>
    </div>
  );
}
