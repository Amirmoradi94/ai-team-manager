import { Task } from '@/types/task';
import { CalendarTaskChip } from './CalendarTaskChip';

interface CalendarTimeSlotProps {
  hour: number;
  date: Date;
  tasks: Task[];
  isToday: boolean;
  isCurrentHour: boolean;
  onTaskClick: (task: Task) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

export function CalendarTimeSlot({
  hour,
  date,
  tasks,
  isToday,
  isCurrentHour,
  onTaskClick,
  onSlotClick
}: CalendarTimeSlotProps) {
  return (
    <div
      className={`min-h-[80px] p-2 border-b border-r border-border/50 hover:bg-accent/5 transition-colors cursor-pointer ${
        isToday ? 'bg-primary/5' : ''
      } ${isCurrentHour && isToday ? 'ring-1 ring-primary/30' : ''}`}
      onClick={() => onSlotClick(date, hour)}
    >
      <div className="space-y-1">
        {tasks.map((task) => (
          <CalendarTaskChip
            key={task.id}
            task={task}
            onClick={(e) => {
              e.stopPropagation();
              onTaskClick(task);
            }}
          />
        ))}
      </div>
    </div>
  );
}
