import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 rounded-xl border border-teal-500/30 bg-slate-900/95 text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.45)]", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-semibold text-teal-100",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-slate-900/70 border border-teal-500/20 p-0 opacity-70 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-teal-200/70 rounded-md w-9 font-normal text-[0.75rem] uppercase tracking-widest",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-teal-500/20 [&:has([aria-selected])]:bg-teal-500/20 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal text-slate-100 aria-selected:opacity-100"),
        day_range_end: "day-range-end",
        day_selected:
          "bg-teal-500/80 text-slate-900 hover:bg-teal-500 hover:text-slate-900 focus:bg-teal-500 focus:text-slate-900",
        day_today: "ring-2 ring-teal-400 ring-inset font-semibold",
        day_outside:
          "day-outside text-teal-200/40 opacity-60 aria-selected:bg-teal-500/20 aria-selected:text-teal-100/60 aria-selected:opacity-60",
        day_disabled: "text-teal-200/30 opacity-40",
        day_range_middle: "aria-selected:bg-teal-500/30 aria-selected:text-teal-100",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
