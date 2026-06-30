"use client";

import { Suspense, useEffect, useState } from "react";
import type { Center } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type AdminUser = {
  id: number;
  username: string;
  role: "super_admin" | "center_manager";
  centerId: number | null;
};

function CenterManagerInner({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [centers, setCenters] = useState<Center[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [centerName, setCenterName] = useState("");
  const [userForm, setUserForm] = useState({
    username: "",
    password: "",
    role: "center_manager" as "super_admin" | "center_manager",
    centerId: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/centers");
      if (!res.ok) throw new Error("센터 목록을 불러오지 못했습니다.");
      setCenters(await res.json());

      if (isSuperAdmin) {
        const userRes = await fetch("/api/admin-users");
        if (userRes.ok) setAdminUsers(await userRes.json());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function addCenter() {
    if (!centerName.trim()) return;
    setError(null);
    const res = await fetch("/api/centers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: centerName.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "등록 실패");
    setCenterName("");
    await reload();
  }

  async function createAdminUser() {
    setError(null);
    const res = await fetch("/api/admin-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: userForm.username,
        password: userForm.password,
        role: userForm.role,
        centerId: userForm.role === "center_manager" ? Number(userForm.centerId) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "계정 생성 실패");
    setUserForm({ username: "", password: "", role: "center_manager", centerId: "" });
    await reload();
  }

  if (loading) return <p className="text-sm text-muted">불러오는 중...</p>;

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="rounded-2xl border border-card-border bg-card p-5">
        <h3 className="text-lg font-semibold">센터</h3>
        <p className="mt-1 text-sm text-muted">
          대구·울산처럼 구역·기사를 나누는 단위입니다. ID 매칭 방식은 센터마다 고정되지 않고, 배차
          때마다 바꿀 수 있습니다.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {centers.map((center) => (
            <li
              key={center.id}
              className="rounded-lg border border-card-border px-3 py-2 text-sm font-medium"
            >
              {center.name}
            </li>
          ))}
        </ul>
        {isSuperAdmin && (
          <div className="mt-4 flex gap-2">
            <input
              placeholder="새 센터명"
              value={centerName}
              onChange={(e) => setCenterName(e.target.value)}
              className="rounded-lg border border-card-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => addCenter().catch((e) => setError(e.message))}
              className="rounded-lg bg-accent px-4 py-2 text-sm text-white"
            >
              센터 추가
            </button>
          </div>
        )}
      </section>

      {isSuperAdmin && (
        <section className="rounded-2xl border border-card-border bg-card p-5">
          <h3 className="font-semibold">관리자 계정</h3>
          <p className="mt-1 text-sm text-muted">통합 관리자 또는 센터 담당자 계정을 추가합니다.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <input
              placeholder="아이디"
              value={userForm.username}
              onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))}
              className="rounded-lg border border-card-border px-3 py-2 text-sm"
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={userForm.password}
              onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))}
              className="rounded-lg border border-card-border px-3 py-2 text-sm"
            />
            <select
              value={userForm.role}
              onChange={(e) =>
                setUserForm((p) => ({
                  ...p,
                  role: e.target.value as "super_admin" | "center_manager",
                }))
              }
              className="rounded-lg border border-card-border px-3 py-2 text-sm"
            >
              <option value="center_manager">센터 담당자</option>
              <option value="super_admin">통합 관리자</option>
            </select>
            {userForm.role === "center_manager" ? (
              <select
                value={userForm.centerId}
                onChange={(e) => setUserForm((p) => ({ ...p, centerId: e.target.value }))}
                className="rounded-lg border border-card-border px-3 py-2 text-sm"
              >
                <option value="">센터 선택</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              onClick={() => createAdminUser().catch((e) => setError(e.message))}
              className={cn("rounded-lg bg-accent px-3 py-2 text-sm text-white md:col-span-2 md:w-fit")}
            >
              계정 추가
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {adminUsers.map((u) => (
              <li key={u.id}>{u.username}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function CenterManager({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">불러오는 중...</p>}>
      <CenterManagerInner isSuperAdmin={isSuperAdmin} />
    </Suspense>
  );
}
