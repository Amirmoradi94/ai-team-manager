import { Task } from '@/types/task';
import { CalendarHeader } from './CalendarHeader';
import { CalendarTimeSlot } from './CalendarTimeSlot';
import { format, startOfWeek, addDays, isSameDay, getHours } from 'date-fns';

interface WeeklyCalendarProps {
  currentWeek: Date;
  tasks: Task[];
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onTaskClick: (task: Task) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeeklyCalendar({
  currentWeek,
  tasks,
  onPreviousWeek,
  onNextWeek,
  onToday,
  onTaskClick,
  onSlotClick
}: WeeklyCalendarProps) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  const currentHour = getHours(today);

  const getTasksForSlot = (date: Date, hour: number) => {
    return tasks.filter((task) => {
      if (!task.scheduledDate || !task.scheduledTime) return false;
      const taskDate = new Date(task.scheduledDate);
      const taskHour = parseInt(task.scheduledTime.split(':')[0]);
      return isSameDay(taskDate, date) && taskHour === hour;
    });
  };

  return (
    <div className="glass-card p-6">
      <CalendarHeader
        currentWeek={currentWeek}
        onPreviousWeek={onPreviousWeek}
        onNextWeek={onNextWeek}
        onToday={onToday}
      />

      <div className="overflow-auto custom-scrollbar">
        <div className="min-w-[900px]">
          {/* Header Row */}
          <div className="grid grid-cols-8 sticky top-0 bg-background z-10">
            <div className="p-3 border-b border-r border-border font-medium text-sm text-muted-foreground">
              Time
            </div>
            {weekDays.map((day, index) => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={index}
                  className={`p-3 border-b border-r border-border text-center ${
                    isToday ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="text-xs text-muted-foreground mb-1">
                    {DAYS_OF_WEEK[index]}
                  </div>
                  <div
                    className={`text-sm font-medium ${
                      isToday ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Slots */}
          {HOURS.map((hour) => (
            <div key={hour} className="grid grid-cols-8">
              <div className="p-3 border-b border-r border-border text-xs text-muted-foreground font-medium">
                {format(new Date().setHours(hour, 0, 0, 0), 'h:mm a')}
              </div>
              {weekDays.map((day, dayIndex) => {
                const isToday = isSameDay(day, today);
                const isCurrentHour = hour === currentHour;
                const slotTasks = getTasksForSlot(day, hour);

                return (
                  <CalendarTimeSlot
                    key={dayIndex}
                    hour={hour}
                    date={day}
                    tasks={slotTasks}
                    isToday={isToday}
                    isCurrentHour={isCurrentHour}
                    onTaskClick={onTaskClick}
                    onSlotClick={onSlotClick}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
