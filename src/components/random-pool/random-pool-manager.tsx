"use client";

import { Suspense, useEffect, useState } from "react";
import { CenterPicker, useSelectedCenterId } from "@/components/center-picker";
import type { Center, Driver, RandomPoolMember } from "@/lib/db/schema";

const TIME_LABEL = { first: "1차", second: "2차" } as const;

function RandomPoolManagerInner({
  centers,
  lockedCenterId,
}: {
  centers: Center[];
  lockedCenterId?: number | null;
}) {
  const centerId = useSelectedCenterId(centers, lockedCenterId);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [members, setMembers] = useState<RandomPoolMember[]>([]);
  const [form, setForm] = useState({ driverId: "", timeSlot: "first" as "first" | "second" });
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!centerId) return;
    const [dRes, mRes] = await Promise.all([
      fetch(`/api/drivers?centerId=${centerId}`),
      fetch(`/api/random-pool?centerId=${centerId}`),
    ]);
    if (dRes.ok) setDrivers((await dRes.json()).filter((d: Driver) => d.accountType === "regular"));
    if (mRes.ok) setMembers(await mRes.json());
  }

  useEffect(() => {
    reload();
  }, [centerId]);

  function labelDriver(id: number) {
    return drivers.find((d) => d.id === id)?.name ?? `#${id}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!centerId) return;
    setError(null);
    const res = await fetch("/api/random-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centerId,
        driverId: Number(form.driverId),
        timeSlot: form.timeSlot,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "등록 실패");
      return;
    }
    setForm({ driverId: "", timeSlot: "first" });
    await reload();
  }

  return (
    <div className="space-y-4">
      <CenterPicker centers={centers} lockedCenterId={lockedCenterId} />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold">랜덤 후보군</h3>
          <p className="text-sm text-muted">미배정 구역 채울 때 선택 가능한 기사</p>
          <select
            required
            value={form.driverId}
            onChange={(e) => setForm((p) => ({ ...p, driverId: e.target.value }))}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">기사</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={form.timeSlot}
            onChange={(e) =>
              setForm((p) => ({ ...p, timeSlot: e.target.value as "first" | "second" }))
            }
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="first">1차</option>
            <option value="second">2차</option>
          </select>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm text-white">
            추가
          </button>
        </form>

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <ul className="space-y-2 text-sm">
            {members.map((m) => (
              <li key={m.id} className="flex justify-between border-b border-card-border/60 py-2">
                <span>
                  {labelDriver(m.driverId)} · {TIME_LABEL[m.timeSlot]}
                </span>
                <button
                  type="button"
                  className="text-danger"
                  onClick={async () => {
                    await fetch(`/api/random-pool/${m.id}`, { method: "DELETE" });
                    await reload();
                  }}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function RandomPoolManager({
  centers,
  lockedCenterId,
}: {
  centers: Center[];
  lockedCenterId?: number | null;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">불러오는 중...</p>}>
      <RandomPoolManagerInner centers={centers} lockedCenterId={lockedCenterId} />
    </Suspense>
  );
}
