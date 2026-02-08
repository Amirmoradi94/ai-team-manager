import { motion } from 'framer-motion';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { Task } from '@/types/task';

interface StatsCardsProps {
  tasks: Task[];
}

export function StatsCards({ tasks }: StatsCardsProps) {
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const urgentTasks = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const stats = [
    {
      label: 'Completed',
      value: completedTasks,
      icon: CheckCircle2,
      color: 'from-success/20 to-success/5',
      iconColor: 'text-success',
    },
    {
      label: 'In Progress',
      value: inProgressTasks,
      icon: Clock,
      color: 'from-warning/20 to-warning/5',
      iconColor: 'text-warning',
    },
    {
      label: 'High Priority',
      value: urgentTasks,
      icon: AlertTriangle,
      color: 'from-destructive/20 to-destructive/5',
      iconColor: 'text-destructive',
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      icon: TrendingUp,
      color: 'from-primary/20 to-primary/5',
      iconColor: 'text-primary',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="glass-card p-5 relative overflow-hidden group"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
          
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </div>
            <div className={`p-2 rounded-lg bg-secondary ${stat.iconColor}`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
