"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { CenterPicker, useSelectedCenterId } from "@/components/center-picker";
import type { Center, Driver, TimeSlot } from "@/lib/db/schema";
import { weekdayFromDate, weekdayLabel } from "@/lib/leave-utils";
import { cn } from "@/lib/utils";

const TIME_LABEL: Record<TimeSlot, string> = { first: "1차", second: "2차" };

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function AttendanceInner({
  centers,
  lockedCenterId,
}: {
  centers: Center[];
  lockedCenterId?: number | null;
}) {
  const centerId = useSelectedCenterId(centers, lockedCenterId);
  const [date, setDate] = useState(todayIso);
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("first");
  const [working, setWorking] = useState<Driver[]>([]);
  const [onLeave, setOnLeave] = useState<Driver[]>([]);
  const [counts, setCounts] = useState({ working: 0, onLeave: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centerId) return;
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/attendance?centerId=${centerId}&date=${date}&timeSlot=${timeSlot}`,
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "조회 실패");
      return;
    }
    setWorking(data.working ?? []);
    setOnLeave(data.onLeave ?? []);
    setCounts(data.counts ?? { working: 0, onLeave: 0, total: 0 });
  }, [centerId, date, timeSlot]);

  useEffect(() => {
    load();
  }, [load]);

  const weekday = weekdayFromDate(date);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <CenterPicker centers={centers} lockedCenterId={lockedCenterId} />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">날짜</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-card-border bg-background px-3 py-1.5"
          />
          <span className="text-muted">({weekdayLabel(weekday)}요일)</span>
        </label>
        <div className="flex gap-1">
          {(["first", "second"] as const).map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setTimeSlot(slot)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm",
                timeSlot === slot ? "bg-accent text-white" : "border border-card-border",
              )}
            >
              {TIME_LABEL[slot]}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid shrink-0 grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-card-border px-4 py-3">
          <p className="text-muted">출근</p>
          <p className="text-2xl font-semibold text-accent">{counts.working}</p>
        </div>
        <div className="rounded-lg border border-card-border px-4 py-3">
          <p className="text-muted">휴무</p>
          <p className="text-2xl font-semibold text-danger">{counts.onLeave}</p>
        </div>
        <div className="rounded-lg border border-card-border px-4 py-3">
          <p className="text-muted">대상 기사</p>
          <p className="text-2xl font-semibold">{counts.total}</p>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted">불러오는 중…</p> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col rounded-xl border border-card-border">
          <h3 className="shrink-0 border-b border-card-border px-4 py-2 font-semibold">
            출근 ({working.length})
          </h3>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {working.map((d) => (
              <li key={d.id} className="rounded-md px-2 py-1.5 hover:bg-white/5">
                {d.name}
              </li>
            ))}
            {working.length === 0 && !loading ? (
              <li className="px-2 py-4 text-center text-sm text-muted">없음</li>
            ) : null}
          </ul>
        </section>

        <section className="flex min-h-0 flex-col rounded-xl border border-card-border">
          <h3 className="shrink-0 border-b border-card-border px-4 py-2 font-semibold text-danger">
            휴무 ({onLeave.length})
          </h3>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {onLeave.map((d) => (
              <li key={d.id} className="rounded-md px-2 py-1.5 hover:bg-white/5">
                {d.name}
              </li>
            ))}
            {onLeave.length === 0 && !loading ? (
              <li className="px-2 py-4 text-center text-sm text-muted">없음</li>
            ) : null}
          </ul>
        </section>
      </div>

      <p className="shrink-0 text-xs text-muted">
        요일별 고정 휴무는 휴무표에서 설정합니다. 특정일 1일 휴무는 추후 예외 등록 UI에서 추가
        예정입니다.
      </p>
    </div>
  );
}

export function AttendanceView(props: { centers: Center[]; lockedCenterId?: number | null }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">로딩…</p>}>
      <AttendanceInner {...props} />
    </Suspense>
  );
}
