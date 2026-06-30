"use client";

import { Suspense, useEffect, useState } from "react";
import { CenterPicker, useSelectedCenterId } from "@/components/center-picker";
import { ListPanel, SplitEditorLayout, stickyTableHeadClass } from "@/components/split-editor-layout";
import type {
  Center,
  CoverageArea,
  Driver,
  DriverIdBorrowRule,
  EmploymentType,
  RandomPoolMember,
  TimeSlot,
  Zone,
  ZoneMapping,
} from "@/lib/db/schema";
import {
  coverageAreasForCenter,
  EMPLOYMENT_OPTIONS,
  formatDriverGroupLabel,
} from "@/lib/driver-groups";
import { cn } from "@/lib/utils";

const TIME_LABEL: Record<TimeSlot, string> = { first: "1차", second: "2차" };

const fieldClass =
  "w-full rounded-lg border border-card-border bg-background px-2.5 py-1.5 text-sm";

type AssignmentForm = {
  random: boolean;
  zoneIds: number[];
};

const emptyAssignment: AssignmentForm = { random: false, zoneIds: [] };

function formatZoneLabel(
  driver: Driver,
  mappings: ZoneMapping[],
  pool: RandomPoolMember[],
  zoneMap: Map<number, string>,
): string {
  if (driver.accountType === "spare") return "-";
  const slot = driver.defaultTimeSlot ?? "first";
  if (pool.some((p) => p.driverId === driver.id && p.timeSlot === slot)) {
    return "랜덤";
  }
  const codes = mappings
    .filter((m) => m.driverId === driver.id && m.timeSlot === slot)
    .map((m) => zoneMap.get(m.zoneId))
    .filter(Boolean) as string[];
  return codes.length > 0 ? codes.join(", ") : "-";
}

function buildAssignmentFromData(
  driver: Driver,
  mappings: ZoneMapping[],
  pool: RandomPoolMember[],
): AssignmentForm {
  const slot = driver.defaultTimeSlot ?? "first";
  if (pool.some((p) => p.driverId === driver.id && p.timeSlot === slot)) {
    return { random: true, zoneIds: [] };
  }
  return {
    random: false,
    zoneIds: mappings
      .filter((m) => m.driverId === driver.id && m.timeSlot === slot)
      .map((m) => m.zoneId),
  };
}

function DriverManagerInner({
  centers,
  lockedCenterId,
}: {
  centers: Center[];
  lockedCenterId?: number | null;
}) {
  const centerId = useSelectedCenterId(centers, lockedCenterId);
  const center = centers.find((c) => c.id === centerId);
  const coverageOptions = coverageAreasForCenter(center?.name);
  const [tab, setTab] = useState<"drivers" | "borrow">("drivers");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [mappings, setMappings] = useState<ZoneMapping[]>([]);
  const [pool, setPool] = useState<RandomPoolMember[]>([]);
  const [rules, setRules] = useState<DriverIdBorrowRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    kurlyId: "",
    accountType: "regular" as "regular" | "spare",
    defaultTimeSlot: "first" as TimeSlot,
    coverageArea: "" as CoverageArea | "",
    employmentType: "" as EmploymentType | "",
    maxCapacity: "",
    isActive: true,
  });
  const [assignment, setAssignment] = useState<AssignmentForm>(emptyAssignment);
  const [ruleForm, setRuleForm] = useState({ actualDriverId: "", kurlyDriverId: "" });
  const [listSearch, setListSearch] = useState("");

  const zoneMap = new Map(zones.map((z) => [z.id, z.code]));

  async function loadAll() {
    if (!centerId) return;
    const [dRes, zRes, mRes, pRes, rRes] = await Promise.all([
      fetch(`/api/drivers?centerId=${centerId}`),
      fetch(`/api/zones?centerId=${centerId}`),
      fetch(`/api/zone-mappings?centerId=${centerId}`),
      fetch(`/api/random-pool?centerId=${centerId}`),
      fetch(`/api/borrow-rules?centerId=${centerId}`),
    ]);
    if (dRes.ok) setDrivers(await dRes.json());
    if (zRes.ok) setZones(await zRes.json());
    if (mRes.ok) setMappings(await mRes.json());
    if (pRes.ok) setPool(await pRes.json());
    if (rRes.ok) setRules(await rRes.json());
  }

  useEffect(() => {
    loadAll();
  }, [centerId]);

  useEffect(() => {
    setListSearch("");
  }, [centerId]);

  function driverName(id: number) {
    return drivers.find((d) => d.id === id)?.name ?? `#${id}`;
  }

  function defaultKurlyLabel(driver: Driver): string {
    if (driver.kurlyId) return driver.kurlyId;
    const rule = rules.find((r) => r.actualDriverId === driver.id && r.isActive);
    if (rule) {
      const owner = drivers.find((d) => d.id === rule.kurlyDriverId);
      return owner?.kurlyId ? `${owner.name} ID` : "-";
    }
    return "-";
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      name: "",
      kurlyId: "",
      accountType: "regular",
      defaultTimeSlot: "first",
      coverageArea: "",
      employmentType: "",
      maxCapacity: "",
      isActive: true,
    });
    setAssignment(emptyAssignment);
    setError(null);
  }

  function startEdit(driver: Driver) {
    setEditingId(driver.id);
    setForm({
      name: driver.name,
      kurlyId: driver.kurlyId ?? "",
      accountType: driver.accountType,
      defaultTimeSlot: driver.defaultTimeSlot ?? "first",
      coverageArea: driver.coverageArea ?? "",
      employmentType: driver.employmentType ?? "",
      maxCapacity: driver.maxCapacity ? String(driver.maxCapacity) : "",
      isActive: driver.isActive,
    });
    setAssignment(buildAssignmentFromData(driver, mappings, pool));
  }

  function toggleZone(zoneId: number) {
    if (assignment.random) return;
    setAssignment((prev) => ({
      random: false,
      zoneIds: prev.zoneIds.includes(zoneId)
        ? prev.zoneIds.filter((id) => id !== zoneId)
        : [...prev.zoneIds, zoneId],
    }));
  }

  async function saveAssignments(driverId: number) {
    if (!centerId || form.accountType === "spare") return;
    const res = await fetch(`/api/drivers/${driverId}/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centerId, ...assignment }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "구역 배정 저장 실패");
    }
  }

  async function handleDelete(driver: Driver) {
    if (!confirm(`기사 "${driver.name}"을(를) 삭제할까요?`)) return;
    const res = await fetch(`/api/drivers/${driver.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "삭제 실패");
      return;
    }
    if (editingId === driver.id) resetForm();
    await loadAll();
  }

  async function saveDriver(e: React.FormEvent) {
    e.preventDefault();
    if (!centerId) return;
    setSaving(true);
    setError(null);

    const payload = {
      centerId,
      name: form.name.trim(),
      kurlyId: form.kurlyId.trim() || null,
      accountType: form.accountType,
      defaultTimeSlot: form.accountType === "spare" ? null : form.defaultTimeSlot,
      coverageArea: form.coverageArea || null,
      employmentType: form.employmentType || null,
      maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : null,
      isActive: form.isActive,
    };

    try {
      const res = await fetch(editingId ? `/api/drivers/${editingId}` : "/api/drivers", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "저장 실패");
      }

      const driverId = editingId ?? data.id;
      if (form.accountType === "regular") {
        await saveAssignments(driverId);
      }

      resetForm();
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    if (!centerId) return;
    const res = await fetch("/api/borrow-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centerId,
        actualDriverId: Number(ruleForm.actualDriverId),
        kurlyDriverId: Number(ruleForm.kurlyDriverId),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "규칙 저장 실패");
      return;
    }
    setRuleForm({ actualDriverId: "", kurlyDriverId: "" });
    await loadAll();
  }

  const searchQuery = listSearch.trim().toLowerCase();
  const filteredDrivers = drivers.filter((d) => {
    if (!searchQuery) return true;
    const zoneLabel = formatZoneLabel(d, mappings, pool, zoneMap);
    const kurlyLabel = defaultKurlyLabel(d);
    const timeLabel =
      d.accountType === "spare" || !d.defaultTimeSlot ? "" : TIME_LABEL[d.defaultTimeSlot];
    const groupLabel = formatDriverGroupLabel(d, center?.name);
    return [d.name, d.kurlyId, kurlyLabel, zoneLabel, timeLabel, groupLabel, d.accountType === "spare" ? "예비" : ""]
      .filter(Boolean)
      .some((s) => s!.toLowerCase().includes(searchQuery));
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <CenterPicker centers={centers} lockedCenterId={lockedCenterId} />

      <div className="flex shrink-0 gap-2">
        {(["drivers", "borrow"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              tab === key ? "bg-accent text-white" : "border border-card-border",
            )}
          >
            {key === "drivers" ? "기사 · 구역" : "기본 ID 매칭"}
          </button>
        ))}
      </div>

      {error ? <p className="shrink-0 text-sm text-danger">{error}</p> : null}

      {tab === "drivers" ? (
        <SplitEditorLayout
          form={
            <form onSubmit={saveDriver} className="flex h-full min-h-0 flex-col gap-2 p-4">
              <div className="flex shrink-0 items-center justify-between gap-2">
                <h3 className="font-semibold">{editingId ? "기사 수정" : "기사 등록"}</h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="shrink-0 rounded-lg border border-accent/50 px-2 py-0.5 text-xs text-accent hover:bg-accent/10"
                >
                  + 신규 등록
                </button>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-2">
                <input
                  required
                  placeholder="실명"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className={cn(fieldClass, "col-span-2")}
                />
                <select
                  value={form.accountType}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, accountType: e.target.value as "regular" | "spare" }))
                  }
                  className={fieldClass}
                >
                  <option value="regular">일반</option>
                  <option value="spare">예비 ID</option>
                </select>
                <select
                  value={form.defaultTimeSlot}
                  disabled={form.accountType === "spare"}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, defaultTimeSlot: e.target.value as TimeSlot }))
                  }
                  className={fieldClass}
                >
                  <option value="first">1차 기사</option>
                  <option value="second">2차 기사</option>
                </select>
                <input
                  placeholder="컬리 아이디 (본인 ID)"
                  value={form.kurlyId}
                  onChange={(e) => setForm((p) => ({ ...p, kurlyId: e.target.value }))}
                  className={cn(fieldClass, "col-span-2")}
                />
                {coverageOptions ? (
                  <select
                    value={form.coverageArea}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        coverageArea: e.target.value as CoverageArea | "",
                      }))
                    }
                    className={fieldClass}
                  >
                    <option value="">권역 (선택)</option>
                    {coverageOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                <select
                  value={form.employmentType}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      employmentType: e.target.value as EmploymentType | "",
                    }))
                  }
                  className={cn(fieldClass, !coverageOptions && "col-span-2")}
                >
                  <option value="">고용형 (선택)</option>
                  {EMPLOYMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {form.accountType === "regular" && (
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-card-border/70 p-2">
                  <label className="mb-2 flex shrink-0 items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={assignment.random}
                      onChange={(e) =>
                        setAssignment(
                          e.target.checked
                            ? { random: true, zoneIds: [] }
                            : { random: false, zoneIds: [] },
                        )
                      }
                    />
                    랜덤 후보 (고정 구역 없음)
                  </label>
                  {!assignment.random && (
                    <>
                      <p className="mb-1 shrink-0 text-xs text-muted">고정 구역 (복수 선택)</p>
                      <div className="min-h-0 flex-1 overflow-y-auto rounded border border-card-border/50 bg-background/50 p-1.5">
                        {zones.length === 0 ? (
                          <p className="p-1 text-xs text-muted">구역을 먼저 등록하세요.</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-0.5 text-xs xl:grid-cols-4">
                            {zones.map((zone) => (
                              <label
                                key={zone.id}
                                className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:bg-white/5"
                              >
                                <input
                                  type="checkbox"
                                  checked={assignment.zoneIds.includes(zone.id)}
                                  onChange={() => toggleZone(zone.id)}
                                />
                                <span className="truncate">{zone.code}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="shrink-0 space-y-2">
                <input
                  placeholder="최대 처리량"
                  value={form.maxCapacity}
                  onChange={(e) => setForm((p) => ({ ...p, maxCapacity: e.target.value }))}
                  className={fieldClass}
                />
                <p className="text-[11px] leading-tight text-muted">
                  2차→1차 지원 등 당일 변경은 배차(Phase 1d)에서 처리합니다.
                </p>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-accent px-4 py-1.5 text-sm text-white disabled:opacity-60"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            </form>
          }
          list={
            <ListPanel
              title="기사 목록"
              hint={
                searchQuery
                  ? `${filteredDrivers.length} / ${drivers.length}명 · 목록 클릭 → 수정`
                  : `총 ${drivers.length}명 · 목록 클릭 → 수정 · 삭제만 버튼`
              }
              searchValue={listSearch}
              onSearchChange={setListSearch}
              searchPlaceholder="이름, 컬리 ID, 구역…"
            >
              {filteredDrivers.length === 0 ? (
                <p className="py-4 text-sm text-muted">
                  {searchQuery ? "검색 결과가 없습니다." : "등록된 기사가 없습니다."}
                </p>
              ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={cn("border-b text-left text-muted", stickyTableHeadClass())}>
                    <th className="py-1.5 pr-3">이름</th>
                    <th className="py-1.5 pr-3">그룹</th>
                    <th className="py-1.5 pr-3">타임</th>
                    <th className="py-1.5 pr-3">컬리 ID</th>
                    <th className="py-1.5 pr-3">구역</th>
                    <th className="py-1.5">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => startEdit(d)}
                      className={cn(
                        "cursor-pointer border-b border-card-border/60 transition hover:bg-white/5",
                        editingId === d.id && "bg-accent/10",
                      )}
                    >
                      <td className="py-1.5 pr-3 font-medium">
                        {d.name}
                        {d.accountType === "spare" ? (
                          <span className="ml-1 text-xs text-muted">(예비)</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-3 text-xs text-muted">
                        {formatDriverGroupLabel(d, center?.name)}
                      </td>
                      <td className="py-1.5 pr-3">
                        {d.accountType === "spare" || !d.defaultTimeSlot
                          ? "-"
                          : TIME_LABEL[d.defaultTimeSlot]}
                      </td>
                      <td className="py-1.5 pr-3 text-muted">{defaultKurlyLabel(d)}</td>
                      <td className="py-1.5 pr-3">{formatZoneLabel(d, mappings, pool, zoneMap)}</td>
                      <td className="py-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(d);
                          }}
                          className="text-danger hover:underline"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </ListPanel>
          }
        />
      ) : (
        <SplitEditorLayout
          formWidth="w-[340px]"
          form={
            <form onSubmit={saveRule} className="flex h-full flex-col gap-3 p-4">
              <h3 className="font-semibold">기본 ID 매칭</h3>
              <p className="text-xs text-muted">
                컬리 ID 없는 기사의 기본 빌림 ID. 배차 때 그날 바꿀 수 있습니다.
              </p>
              <select
                required
                value={ruleForm.actualDriverId}
                onChange={(e) => setRuleForm((p) => ({ ...p, actualDriverId: e.target.value }))}
                className={fieldClass}
              >
                <option value="">실배송자 (ID 없음)</option>
                {drivers
                  .filter((d) => !d.kurlyId && d.accountType === "regular")
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
              <select
                required
                value={ruleForm.kurlyDriverId}
                onChange={(e) => setRuleForm((p) => ({ ...p, kurlyDriverId: e.target.value }))}
                className={fieldClass}
              >
                <option value="">빌릴 ID</option>
                {drivers
                  .filter((d) => d.kurlyId)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.kurlyId})
                    </option>
                  ))}
              </select>
              <button type="submit" className="rounded-lg bg-accent px-4 py-1.5 text-sm text-white">
                추가
              </button>
            </form>
          }
          list={
            <ListPanel title="매칭 규칙 목록">
              <ul className="space-y-1 text-sm">
                {rules.map((r) => (
                  <li key={r.id} className="flex justify-between border-b border-card-border/60 py-1.5">
                    <span>
                      {driverName(r.actualDriverId)} → {driverName(r.kurlyDriverId)}
                    </span>
                    <button
                      type="button"
                      className="text-danger hover:underline"
                      onClick={async () => {
                        await fetch(`/api/borrow-rules/${r.id}`, { method: "DELETE" });
                        await loadAll();
                      }}
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            </ListPanel>
          }
        />
      )}
    </div>
  );
}

export function DriverManager({
  centers,
  lockedCenterId,
}: {
  centers: Center[];
  lockedCenterId?: number | null;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">불러오는 중...</p>}>
      <DriverManagerInner centers={centers} lockedCenterId={lockedCenterId} />
    </Suspense>
  );
}
