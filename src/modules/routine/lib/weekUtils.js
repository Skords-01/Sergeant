import { dateKeyFromDate, parseDateKey } from "./hubCalendarAggregate.js";

export { dateKeyFromDate, parseDateKey };

export function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfIsoWeek(d) {
  const x = new Date(d);
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  x.setHours(12, 0, 0, 0);
  return x;
}
