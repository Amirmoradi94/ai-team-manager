import { Task, Priority } from '@/types/task';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface CalendarTaskChipProps {
  task: Task;
  onClick: () => void;
}

const priorityColors: Record<Priority, { bg: string; border: string }> = {
  low: { bg: 'bg-muted/80', border: 'border-l-muted' },
  medium: { bg: 'bg-info/20', border: 'border-l-info' },
  high: { bg: 'bg-warning/20', border: 'border-l-warning' },
  urgent: { bg: 'bg-destructive/20', border: 'border-l-destructive' },
};

export function CalendarTaskChip({ task, onClick }: CalendarTaskChipProps) {
  const priority = priorityColors[task.priority];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1 mb-1 rounded border-l-4 ${priority.bg} ${priority.border} hover:brightness-110 transition-all text-xs group`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
          {task.title}
        </span>
        {task.assignee && (
          <Avatar className="w-4 h-4 ring-1 ring-background flex-shrink-0">
            <AvatarImage src={task.assignee.avatar} alt={task.assignee.name} />
            <AvatarFallback className="text-[8px] bg-secondary">
              {task.assignee.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      {task.scheduledTime && (
        <div className="text-[10px] text-muted-foreground mt-0.5">
          {task.scheduledTime}
        </div>
      )}
    </button>
  );
}
