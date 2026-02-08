import { Task, Priority } from '@/types/task';
import { Calendar, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const priorityColors: Record<Priority, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-muted' },
  medium: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/30' },
  high: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  urgent: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' },
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const priority = priorityColors[task.priority];

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
      className="glass-card-hover p-4 text-left w-full group cursor-move"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-md border ${priority.bg} ${priority.text} ${priority.border}`}>
            {task.priority}
          </span>
          {task.failed_at && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-destructive/10 text-destructive border border-destructive/30 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Failed
            </span>
          )}
        </div>
      </div>

      <h4 className="font-medium text-foreground mb-2 group-hover:text-primary transition-colors">
        {task.title}
      </h4>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {task.description}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {task.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 text-xs rounded-md bg-secondary text-secondary-foreground"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          {task.dueDate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>Due: {format(new Date(task.dueDate.toString().includes('T') ? task.dueDate : `${task.dueDate}T00:00:00`), 'MMM d')}</span>
            </div>
          )}
          {task.scheduledDate && (
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>
                {format(new Date(task.scheduledDate.toString().includes('T') ? task.scheduledDate : `${task.scheduledDate}T00:00:00`), 'MMM d')}
                {task.scheduledTime && ` @ ${task.scheduledTime}`}
              </span>
            </div>
          )}
        </div>

        {task.assignee && (
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6 ring-2 ring-background">
              <AvatarImage src={task.assignee.avatar} alt={task.assignee.name} />
              <AvatarFallback className="text-xs bg-secondary">
                {task.assignee.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
          </div>
        )}
      </div>
    </button>
  );
}
