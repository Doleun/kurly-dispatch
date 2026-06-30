"use client";

import { Suspense, useEffect, useState } from "react";
import { CenterPicker, useSelectedCenterId } from "@/components/center-picker";
import { ListPanel, SplitEditorLayout, stickyTableHeadClass } from "@/components/split-editor-layout";
import type { Center, Zone } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type FormState = {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  code: "",
  name: "",
  description: "",
  isActive: true,
};

function ZoneManagerInner({
  centers,
  lockedCenterId,
}: {
  centers: Center[];
  lockedCenterId?: number | null;
}) {
  const centerId = useSelectedCenterId(centers, lockedCenterId);
  const center = centers.find((c) => c.id === centerId);

  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [listSearch, setListSearch] = useState("");

  async function loadZones() {
    if (!centerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/zones?centerId=${centerId}`);
      if (!res.ok) throw new Error("구역 목록을 불러오지 못했습니다.");
      setZones(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadZones();
  }, [centerId]);

  useEffect(() => {
    setListSearch("");
  }, [centerId]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function startEdit(zone: Zone) {
    setEditingId(zone.id);
    setForm({
      code: zone.code,
      name: zone.name ?? "",
      description: zone.description ?? "",
      isActive: zone.isActive,
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!centerId) return;
    setSaving(true);
    setError(null);

    const payload = {
      centerId,
      code: form.code.trim(),
      name: form.name.trim() || null,
      description: form.description.trim() || null,
      isActive: form.isActive,
    };

    try {
      const res = await fetch(editingId ? `/api/zones/${editingId}` : "/api/zones", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "저장 실패");
      }
      resetForm();
      await loadZones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, code: string) {
    if (!confirm(`구역 "${code}"을(를) 삭제할까요?`)) return;
    const res = await fetch(`/api/zones/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(typeof data.error === "string" ? data.error : "삭제 실패");
      return;
    }
    if (editingId === id) resetForm();
    await loadZones();
  }

  const searchQuery = listSearch.trim().toLowerCase();
  const filteredZones = zones.filter((zone) => {
    if (!searchQuery) return true;
    return [zone.code, zone.name].filter(Boolean).some((s) => s!.toLowerCase().includes(searchQuery));
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <CenterPicker centers={centers} lockedCenterId={lockedCenterId} />

      <SplitEditorLayout
        formWidth="w-[320px]"
        form={
          <section className="flex h-full flex-col p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{editingId ? "구역 수정" : "구역 등록"}</h3>
              <button
                type="button"
                onClick={resetForm}
                className="shrink-0 rounded-lg border border-accent/50 px-2 py-0.5 text-xs text-accent hover:bg-accent/10"
              >
                + 신규 등록
              </button>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {center?.name} · 20-1 또는 20-1가처럼 한 줄로 입력
            </p>

            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <label className="block space-y-1 text-sm">
                <span>구역번호 *</span>
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="20-1 또는 20-1가"
                  className="w-full rounded-lg border border-card-border bg-background px-2.5 py-1.5 text-sm"
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span>표시 이름</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-card-border bg-background px-2.5 py-1.5 text-sm"
                />
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                운영 중
              </label>

              {error ? <p className="text-sm text-danger">{error}</p> : null}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-accent px-4 py-1.5 text-sm text-white disabled:opacity-60"
                >
                  {saving ? "저장 중..." : editingId ? "저장" : "등록"}
                </button>
              </div>
            </form>
          </section>
        }
        list={
          <ListPanel
            title="구역 목록"
            hint={
              searchQuery
                ? `${filteredZones.length} / ${zones.length}개 · 목록 클릭 → 수정`
                : `총 ${zones.length}개 · 목록 클릭 → 수정`
            }
            searchValue={listSearch}
            onSearchChange={setListSearch}
            searchPlaceholder="구역번호, 이름…"
          >
            {loading ? (
              <p className="text-sm text-muted">불러오는 중...</p>
            ) : zones.length === 0 ? (
              <p className="text-sm text-muted">등록된 구역이 없습니다.</p>
            ) : filteredZones.length === 0 ? (
              <p className="text-sm text-muted">검색 결과가 없습니다.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={cn("border-b border-card-border text-left text-muted", stickyTableHeadClass())}>
                    <th className="px-2 py-1.5">구역번호</th>
                    <th className="px-2 py-1.5">이름</th>
                    <th className="px-2 py-1.5">상태</th>
                    <th className="px-2 py-1.5">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredZones.map((zone) => (
                    <tr
                      key={zone.id}
                      onClick={() => startEdit(zone)}
                      className={cn(
                        "cursor-pointer border-b border-card-border/60 transition hover:bg-white/5",
                        editingId === zone.id && "bg-accent/10",
                      )}
                    >
                      <td className="px-2 py-2 font-medium">{zone.code}</td>
                      <td className="px-2 py-2 text-muted">{zone.name || "-"}</td>
                      <td className="px-2 py-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            zone.isActive ? "bg-success/15 text-success" : "bg-white/10 text-muted",
                          )}
                        >
                          {zone.isActive ? "운영" : "중지"}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(zone.id, zone.code);
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
    </div>
  );
}

export function ZoneManager({
  centers,
  lockedCenterId,
}: {
  centers: Center[];
  lockedCenterId?: number | null;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">불러오는 중...</p>}>
      <ZoneManagerInner centers={centers} lockedCenterId={lockedCenterId} />
    </Suspense>
  );
}
