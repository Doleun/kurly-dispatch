import type {
  Driver,
  DriverLeaveException,
  DriverWeeklyLeave,
  TimeSlot,
  Weekday,
} from "@/lib/db/schema";

/** 휴무표 CSV/API 공통 — 월=0 … 일=6 */
export const WEEKDAY_COLUMNS: { weekday: Weekday; short: string; shift: string }[] = [
  { weekday: 0, short: "월", shift: "월저녁~화새벽" },
  { weekday: 1, short: "화", shift: "화저녁~수새벽" },
  { weekday: 2, short: "수", shift: "수저녁~목새벽" },
  { weekday: 3, short: "목", shift: "목저녁~금새벽" },
  { weekday: 4, short: "금", shift: "금저녁~토새벽" },
  { weekday: 5, short: "토", shift: "토저녁~일새벽" },
  { weekday: 6, short: "일", shift: "일저녁~월새벽" },
];

/** CSV day block start column index → weekday */
export const CSV_DAY_COLUMN_STARTS: { start: number; weekday: Weekday }[] = [
  { start: 2, weekday: 0 },
  { start: 6, weekday: 1 },
  { start: 10, weekday: 2 },
  { start: 14, weekday: 3 },
  { start: 18, weekday: 4 },
  { start: 22, weekday: 5 },
  { start: 26, weekday: 6 },
];

export function weekdayFromDate(dateStr: string): Weekday {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const js = date.getDay();
  return (js === 0 ? 6 : js - 1) as Weekday;
}

export function weekdayLabel(weekday: Weekday): string {
  return WEEKDAY_COLUMNS.find((c) => c.weekday === weekday)?.short ?? String(weekday);
}

export type AttendanceStatus = "working" | "leave" | "excluded";

export function resolveAttendance(params: {
  driver: Pick<Driver, "id" | "accountType" | "defaultTimeSlot" | "isActive">;
  timeSlot: TimeSlot;
  date: string;
  weeklyLeaves: Pick<DriverWeeklyLeave, "driverId" | "timeSlot" | "weekday">[];
  exceptions: Pick<DriverLeaveException, "driverId" | "timeSlot" | "leaveDate" | "kind">[];
}): AttendanceStatus {
  const { driver, timeSlot, date, weeklyLeaves, exceptions } = params;

  if (!driver.isActive || driver.accountType === "spare") return "excluded";
  if (driver.defaultTimeSlot !== timeSlot) return "excluded";

  const exception = exceptions.find(
    (e) => e.driverId === driver.id && e.timeSlot === timeSlot && e.leaveDate === date,
  );
  if (exception?.kind === "work") return "working";
  if (exception?.kind === "leave") return "leave";

  const weekday = weekdayFromDate(date);
  const onWeeklyLeave = weeklyLeaves.some(
    (l) => l.driverId === driver.id && l.timeSlot === timeSlot && l.weekday === weekday,
  );
  return onWeeklyLeave ? "leave" : "working";
}

export function isDriverWorkingOnDate(
  driver: Pick<Driver, "id" | "accountType" | "defaultTimeSlot" | "isActive">,
  timeSlot: TimeSlot,
  date: string,
  weeklyLeaves: Pick<DriverWeeklyLeave, "driverId" | "timeSlot" | "weekday">[],
  exceptions: Pick<DriverLeaveException, "driverId" | "timeSlot" | "leaveDate" | "kind">[],
): boolean {
  return (
    resolveAttendance({ driver, timeSlot, date, weeklyLeaves, exceptions }) === "working"
  );
}
