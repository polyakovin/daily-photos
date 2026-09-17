export type CalendarRangeFocus = 'month' | 'week' | 'year';

export function startOfCalendarPeriod(
  value: Date,
  focus: CalendarRangeFocus
): Date {
  if (focus === 'year') return new Date(value.getFullYear(), 0, 1);
  if (focus === 'month') return new Date(value.getFullYear(), value.getMonth(), 1);
  const first = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return first;
}

export function calendarMoveTarget(
  current: Date,
  focus: CalendarRangeFocus,
  amount: number,
  firstPhoto: Date,
  today: Date
): Date | null {
  const target = startOfCalendarPeriod(current, focus);
  if (focus === 'week') target.setDate(target.getDate() + amount * 7);
  if (focus === 'month') target.setMonth(target.getMonth() + amount);
  if (focus === 'year') target.setFullYear(target.getFullYear() + amount);

  const first = startOfCalendarPeriod(firstPhoto, focus).getTime();
  const last = startOfCalendarPeriod(today, focus).getTime();
  const timestamp = target.getTime();
  return timestamp >= first && timestamp <= last ? target : null;
}
