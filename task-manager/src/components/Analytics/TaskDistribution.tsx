import { Task } from '@/types/task';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface TaskDistributionProps {
  tasks: Task[];
}

const STATUS_COLORS = {
  backlog: '#64748b',
  todo: '#3b82f6',
  'in-progress': '#f59e0b',
  done: '#10b981',
};

const PRIORITY_COLORS = {
  low: '#64748b',
  medium: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
};

export function TaskDistribution({ tasks }: TaskDistributionProps) {
  const statusData = [
    { name: 'Backlog', value: tasks.filter(t => t.status === 'backlog').length, color: STATUS_COLORS.backlog },
    { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: STATUS_COLORS.todo },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in-progress').length, color: STATUS_COLORS['in-progress'] },
    { name: 'Done', value: tasks.filter(t => t.status === 'done').length, color: STATUS_COLORS.done },
  ];

  const priorityData = [
    { name: 'Low', value: tasks.filter(t => t.priority === 'low').length, color: PRIORITY_COLORS.low },
    { name: 'Medium', value: tasks.filter(t => t.priority === 'medium').length, color: PRIORITY_COLORS.medium },
    { name: 'High', value: tasks.filter(t => t.priority === 'high').length, color: PRIORITY_COLORS.high },
    { name: 'Urgent', value: tasks.filter(t => t.priority === 'urgent').length, color: PRIORITY_COLORS.urgent },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-teal-500/30 bg-slate-900/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <p className="text-sm font-medium text-foreground">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} tasks ({Math.round((payload[0].value / tasks.length) * 100)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Status Distribution */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-teal-900/20 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
        <h3 className="text-lg font-semibold text-foreground mb-4">Tasks by Status</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {statusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {statusData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">{item.name}: {item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Priority Distribution */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-teal-900/20 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.25)]">
        <h3 className="text-lg font-semibold text-foreground mb-4">Tasks by Priority</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={priorityData}>
            <XAxis dataKey="name" stroke="#7dd3fc" style={{ fontSize: '12px' }} />
            <YAxis stroke="#7dd3fc" style={{ fontSize: '12px' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {priorityData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {priorityData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-muted-foreground">{item.name}: {item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
