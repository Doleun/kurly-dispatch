"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { CenterPicker, useSelectedCenterId } from "@/components/center-picker";
import type { Center, Driver, DriverWeeklyLeave, TimeSlot } from "@/lib/db/schema";
import {
  coverageAreasForCenter,
  EMPLOYMENT_OPTIONS,
  formatDriverGroupLabel,
} from "@/lib/driver-groups";
import { WEEKDAY_COLUMNS } from "@/lib/leave-utils";
import { cn } from "@/lib/utils";

const TIME_LABEL: Record<TimeSlot, string> = { first: "1차", second: "2차" };

type LeaveKey = `${number}:${number}`;

function leaveKey(driverId: number, weekday: number): LeaveKey {
  return `${driverId}:${weekday}`;
}

function groupDrivers(
  drivers: Driver[],
  centerName: string | undefined,
  timeSlot: TimeSlot,
): { label: string; drivers: Driver[] }[] {
  const regular = drivers.filter(
    (d) => d.accountType === "regular" && d.defaultTimeSlot === timeSlot && d.isActive,
  );
  regular.sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const coverageOptions = coverageAreasForCenter(centerName);
  if (!coverageOptions) {
    return [{ label: "전체", drivers: regular }];
  }

  const buckets = new Map<string, Driver[]>();
  for (const d of regular) {
    const label = formatDriverGroupLabel(d, centerName);
    const list = buckets.get(label) ?? [];
    list.push(d);
    buckets.set(label, list);
  }

  const orderLabels: string[] = [];
  for (const cov of coverageOptions) {
    for (const emp of EMPLOYMENT_OPTIONS) {
      orderLabels.push(`${cov.label} · ${emp.label}`);
    }
  }

  const groups: { label: string; drivers: Driver[] }[] = [];
  for (const label of orderLabels) {
    const list = buckets.get(label);
    if (list?.length) groups.push({ label, drivers: list });
  }
  const other = [...buckets.entries()].filter(([l]) => !orderLabels.includes(l));
  for (const [label, list] of other) {
    if (list.length) groups.push({ label, drivers: list });
  }

  return groups;
}

function LeaveScheduleInner({
  centers,
  lockedCenterId,
}: {
  centers: Center[];
  lockedCenterId?: number | null;
}) {
  const centerId = useSelectedCenterId(centers, lockedCenterId);
  const center = centers.find((c) => c.id === centerId);

  const [timeSlot, setTimeSlot] = useState<TimeSlot>("first");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [leaveSet, setLeaveSet] = useState<Set<LeaveKey>>(new Set());
  const [leaveNotes, setLeaveNotes] = useState<Map<LeaveKey, string>>(new Map());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    if (!centerId) return;
    setError(null);
    const [driversRes, leavesRes] = await Promise.all([
      fetch(`/api/drivers?centerId=${centerId}`),
      fetch(`/api/leaves/weekly?centerId=${centerId}&timeSlot=${timeSlot}`),
    ]);
    const driversData = await driversRes.json();
    const leavesData = await leavesRes.json();
    if (!driversRes.ok) {
      setError(typeof driversData.error === "string" ? driversData.error : "기사 로드 실패");
      return;
    }
    if (!leavesRes.ok) {
      setError(typeof leavesData.error === "string" ? leavesData.error : "휴무 로드 실패");
      return;
    }

    setDrivers(driversData);
    const nextSet = new Set<LeaveKey>();
    const nextNotes = new Map<LeaveKey, string>();
    for (const leaf of leavesData as DriverWeeklyLeave[]) {
      const key = leaveKey(leaf.driverId, leaf.weekday);
      nextSet.add(key);
      if (leaf.note) nextNotes.set(key, leaf.note);
    }
    setLeaveSet(nextSet);
    setLeaveNotes(nextNotes);
    setDirty(false);
  }, [centerId, timeSlot]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groups = useMemo(
    () => groupDrivers(drivers, center?.name, timeSlot),
    [drivers, center?.name, timeSlot],
  );

  function toggleLeave(driverId: number, weekday: number) {
    const key = leaveKey(driverId, weekday);
    setLeaveSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setDirty(true);
  }

  async function save() {
    if (!centerId) return;
    setSaving(true);
    setError(null);
    const leaves = [...leaveSet].map((key) => {
      const [driverId, weekday] = key.split(":").map(Number);
      return {
        driverId,
        weekday,
        note: leaveNotes.get(key) ?? null,
      };
    });

    const res = await fetch("/api/leaves/weekly", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centerId, timeSlot, leaves }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "저장 실패");
      return;
    }
    setDirty(false);
    await loadData();
  }

  const q = search.trim().toLowerCase();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <CenterPicker centers={centers} lockedCenterId={lockedCenterId} />
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
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="ml-auto rounded-lg bg-accent px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {saving ? "저장 중…" : dirty ? "휴무 저장" : "저장됨"}
        </button>
      </div>

      {error ? <p className="shrink-0 text-sm text-danger">{error}</p> : null}

      <p className="shrink-0 text-xs text-muted">
        셀 클릭으로 요일별 고정 휴무를 토글합니다. 비어 있으면 해당 요일 출근입니다.
      </p>

      <input
        placeholder="기사 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-xs shrink-0 rounded-lg border border-card-border bg-background px-3 py-1.5 text-sm"
      />

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-card-border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-card-border">
              <th className="px-3 py-2 text-left font-medium">기사</th>
              {WEEKDAY_COLUMNS.map((col) => (
                <th key={col.weekday} className="px-2 py-2 text-center font-medium">
                  <div>{col.short}</div>
                  <div className="text-[10px] font-normal text-muted">{col.shift}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.label}>
                <tr className="bg-background/60">
                  <td
                    colSpan={WEEKDAY_COLUMNS.length + 1}
                    className="px-3 py-1.5 text-xs font-semibold text-muted"
                  >
                    {group.label}
                  </td>
                </tr>
                {group.drivers
                  .filter((d) => !q || d.name.toLowerCase().includes(q))
                  .map((driver) => (
                    <tr key={driver.id} className="border-b border-card-border/60 hover:bg-white/5">
                      <td className="whitespace-nowrap px-3 py-1.5">{driver.name}</td>
                      {WEEKDAY_COLUMNS.map((col) => {
                        const key = leaveKey(driver.id, col.weekday);
                        const onLeave = leaveSet.has(key);
                        const note = leaveNotes.get(key);
                        return (
                          <td key={col.weekday} className="px-1 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => toggleLeave(driver.id, col.weekday)}
                              title={note ? `휴무 (${note})` : onLeave ? "휴무" : "출근"}
                              className={cn(
                                "h-8 w-full rounded-md text-xs transition",
                                onLeave
                                  ? "bg-danger/20 text-danger hover:bg-danger/30"
                                  : "hover:bg-white/10 text-muted/40",
                              )}
                            >
                              {onLeave ? (note ? `휴·${note}` : "휴") : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LeaveScheduleManager(props: {
  centers: Center[];
  lockedCenterId?: number | null;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">로딩…</p>}>
      <LeaveScheduleInner {...props} />
    </Suspense>
  );
}
