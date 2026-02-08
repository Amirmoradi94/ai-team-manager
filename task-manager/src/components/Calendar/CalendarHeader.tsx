import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface CalendarHeaderProps {
  currentWeek: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

export function CalendarHeader({
  currentWeek,
  onPreviousWeek,
  onNextWeek,
  onToday
}: CalendarHeaderProps) {
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="text-xl font-semibold text-foreground">
          {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </h3>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="border-border hover:border-primary/50"
        >
          Today
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={onPreviousWeek}
            className="h-8 w-8 border-border hover:border-primary/50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onNextWeek}
            className="h-8 w-8 border-border hover:border-primary/50"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
