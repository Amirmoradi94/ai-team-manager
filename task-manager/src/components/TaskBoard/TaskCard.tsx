import { Task, Priority } from '@/types/task';
import { Calendar, AlertCircle, Clock, FolderKanban, Users, Link2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDelete: (taskId: string) => void;
}

const priorityColors: Record<Priority, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-muted' },
  medium: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/30' },
  high: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  urgent: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' },
};

export function TaskCard({ task, onClick, onDelete }: TaskCardProps) {
  const priority = priorityColors[task.priority];
  const isLinked = !!task.parent_id;
  let ctoWarning: string | null = null;

  if (task.resource_metadata) {
    try {
      const metadata = JSON.parse(task.resource_metadata);
      if (metadata && metadata.cto_warning) {
        ctoWarning = metadata.cto_warning;
      }
    } catch {}
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      draggable
      onDragStart={handleDragStart}
      className="glass-card-hover p-4 text-left w-full group cursor-move"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-md border ${priority.bg} ${priority.text} ${priority.border}`}>
            {task.priority}
          </span>
          {isLinked && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-primary/10 text-primary border border-primary/30 flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              Epic
            </span>
          )}
          {ctoWarning && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-warning/15 text-warning border border-warning/40">
              CEO Attention
            </span>
          )}
          {task.failed_at && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-destructive/10 text-destructive border border-destructive/30 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Failed
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          aria-label={`Delete ${task.title}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
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

      {(task.project_name || task.team_name) && (
        <div className="flex flex-col gap-1.5 mb-4">
          {task.project_name && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderKanban className="w-3.5 h-3.5 text-primary" />
              <span className="truncate">{task.project_name}</span>
            </div>
          )}
          {task.team_name && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5 text-info" />
              <span className="truncate">{task.team_name}</span>
            </div>
          )}
        </div>
      )}

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
    </div>
  );
}
