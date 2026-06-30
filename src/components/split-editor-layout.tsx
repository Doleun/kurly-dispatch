import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 1080p fallback when flex chain unavailable */
export const EDITOR_PANEL_HEIGHT = "h-[calc(100vh-13rem)]";

type Props = {
  form: ReactNode;
  list: ReactNode;
  formWidth?: string;
  className?: string;
};

/** 왼쪽 등록 폼(고정) + 오른쪽 목록(독립 스크롤) */
export function SplitEditorLayout({
  form,
  list,
  formWidth = "w-[380px]",
  className,
}: Props) {
  return (
    <div className={cn("flex min-h-0 flex-1 gap-4", className)}>
      <aside
        className={cn(
          "flex shrink-0 flex-col overflow-hidden rounded-2xl border border-card-border bg-card",
          formWidth,
        )}
      >
        {form}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-card-border bg-card">
        {list}
      </div>
    </div>
  );
}

/** 목록 패널 내부 — 헤더 고정 + tbody 스크롤 */
export function ListPanel({
  title,
  hint,
  searchValue,
  onSearchChange,
  searchPlaceholder = "이름, ID, 구역번호…",
  children,
  className,
}: {
  title: string;
  hint?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col p-4", className)}>
      <div className="mb-3 shrink-0">
        <h3 className="font-semibold">{title}</h3>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
        {onSearchChange ? (
          <input
            type="search"
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="mt-2 w-full rounded-lg border border-card-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-accent"
          />
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-auto">{children}</div>
    </div>
  );
}

/** 테이블 헤더 sticky (목록 스크롤 시) */
export function stickyTableHeadClass() {
  return "sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--color-card-border)]";
}
