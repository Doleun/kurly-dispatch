"use client";

import { Suspense, useEffect, useState } from "react";
import { CenterPicker, useSelectedCenterId } from "@/components/center-picker";
import type { Center, Driver, Zone, ZoneMapping } from "@/lib/db/schema";

const TIME_LABEL = { first: "1차", second: "2차" } as const;

function ZoneMappingManagerInner({
  centers,
  lockedCenterId,
}: {
  centers: Center[];
  lockedCenterId?: number | null;
}) {
  const centerId = useSelectedCenterId(centers, lockedCenterId);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [mappings, setMappings] = useState<ZoneMapping[]>([]);
  const [form, setForm] = useState({ driverId: "", zoneId: "", timeSlot: "first" as "first" | "second" });
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!centerId) return;
    const [dRes, zRes, mRes] = await Promise.all([
      fetch(`/api/drivers?centerId=${centerId}`),
      fetch(`/api/zones?centerId=${centerId}`),
      fetch(`/api/zone-mappings?centerId=${centerId}`),
    ]);
    if (dRes.ok) setDrivers((await dRes.json()).filter((d: Driver) => d.accountType === "regular"));
    if (zRes.ok) setZones(await zRes.json());
    if (mRes.ok) setMappings(await mRes.json());
  }

  useEffect(() => {
    reload();
  }, [centerId]);

  function labelDriver(id: number) {
    return drivers.find((d) => d.id === id)?.name ?? `#${id}`;
  }

  function labelZone(id: number) {
    return zones.find((z) => z.id === id)?.code ?? `#${id}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!centerId) return;
    setError(null);
    const res = await fetch("/api/zone-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centerId,
        driverId: Number(form.driverId),
        zoneId: Number(form.zoneId),
        timeSlot: form.timeSlot,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "저장 실패");
      return;
    }
    setForm({ driverId: "", zoneId: "", timeSlot: "first" });
    await reload();
  }

  return (
    <div className="space-y-4">
      <CenterPicker centers={centers} lockedCenterId={lockedCenterId} />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold">고정 구역 매핑</h3>
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
            required
            value={form.zoneId}
            onChange={(e) => setForm((p) => ({ ...p, zoneId: e.target.value }))}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">구역</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.code}
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
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted">
                <th className="py-2">기사</th>
                <th className="py-2">구역</th>
                <th className="py-2">타임</th>
                <th className="py-2">작업</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id} className="border-b border-card-border/60">
                  <td className="py-2">{labelDriver(m.driverId)}</td>
                  <td className="py-2">{labelZone(m.zoneId)}</td>
                  <td className="py-2">{TIME_LABEL[m.timeSlot]}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="text-danger"
                      onClick={async () => {
                        await fetch(`/api/zone-mappings/${m.id}`, { method: "DELETE" });
                        await reload();
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ZoneMappingManager({
  centers,
  lockedCenterId,
}: {
  centers: Center[];
  lockedCenterId?: number | null;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">불러오는 중...</p>}>
      <ZoneMappingManagerInner centers={centers} lockedCenterId={lockedCenterId} />
    </Suspense>
  );
}
