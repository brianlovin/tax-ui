import * as React from "react";

import { cn } from "../lib/cn";

interface CalendarProps {
  selected?: Date;
  onSelect: (date: Date) => void;
  className?: string;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function Calendar({ selected, onSelect, className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    selected ? new Date(selected.getFullYear(), selected.getMonth(), 1) : new Date(),
  );

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const isSelected = (date: Date) => {
    if (!selected) return false;
    return (
      date.getDate() === selected.getDate() &&
      date.getMonth() === selected.getMonth() &&
      date.getFullYear() === selected.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    return date.getTime() === today.getTime();
  };

  return (
    <div className={cn("p-3", className)}>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={goToPrevMonth}
          className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-bg-muted) hover:text-(--color-text)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-sm font-medium text-(--color-text)">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={goToNextMonth}
          className="rounded p-1 text-(--color-text-muted) hover:bg-(--color-bg-muted) hover:text-(--color-text)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {DAYS.map((day) => (
          <div
            key={day}
            className="flex h-6 w-8 items-center justify-center text-xs text-(--color-text-muted)"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => (
          <div key={i} className="h-8 w-8">
            {date && (
              <button
                onClick={() => onSelect(date)}
                className={cn(
                  "h-full w-full rounded-md text-sm transition-colors",
                  isSelected(date)
                    ? "bg-(--color-brand) text-white"
                    : isToday(date)
                      ? "bg-(--color-bg-muted) text-(--color-text)"
                      : "text-(--color-text) hover:bg-(--color-bg-muted)",
                )}
              >
                {date.getDate()}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
