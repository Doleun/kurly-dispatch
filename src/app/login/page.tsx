"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      let data: { error?: string; ok?: boolean } = {};
      try {
        data = await res.json();
      } catch {
        throw new Error("서버 응답을 읽을 수 없습니다.");
      }

      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "로그인에 실패했습니다.");
        return;
      }

      // router.push 대신 전체 페이지 이동 — 쿠키 반영이 더 확실함
      window.location.assign("/");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("요청 시간이 초과되었습니다. dev 서버가 하나만 실행 중인지 확인하세요.");
      } else {
        setError(err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card p-8 shadow-xl">
        <p className="text-xs uppercase tracking-widest text-muted">Kurly Dispatch</p>
        <h1 className="mt-2 text-2xl font-semibold">택배 기사 관리</h1>
        <p className="mt-2 text-sm text-muted">관리자 계정으로 로그인하세요.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span>아이디</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={loading}
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 outline-none focus:border-accent disabled:opacity-60"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 outline-none focus:border-accent disabled:opacity-60"
            />
          </label>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          기본 계정: admin / admin123
        </p>
      </div>
    </div>
  );
}
