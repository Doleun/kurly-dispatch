import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import type { AuthUser } from "@/lib/center-access";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "대시보드" },
  { href: "/centers", label: "센터 · 관리자" },
  { href: "/zones", label: "구역 관리" },
  { href: "/drivers", label: "기사 관리" },
  { href: "/attendance", label: "출근 현황", disabled: true },
  { href: "/dispatch", label: "배차 관리", disabled: true },
];

export async function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: AuthUser;
}) {
  if (!user) redirect("/login");

  const roleLabel =
    user.role === "super_admin" ? "통합 관리자" : `${user.centerName ?? "센터"} 담당`;

  return (
    <div className="min-h-screen lg:flex lg:h-screen lg:overflow-hidden">
      <aside className="border-b border-card-border bg-card lg:h-full lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="px-6 py-5">
          <p className="text-xs uppercase tracking-widest text-muted">Kurly Dispatch</p>
          <h1 className="text-lg font-semibold">택배 기사 관리</h1>
        </div>
        <nav className="space-y-1 px-3 pb-4 lg:pb-6">
          {navItems.map((item) =>
            item.disabled ? (
              <span
                key={item.href}
                className="flex items-center rounded-lg px-3 py-2 text-sm text-muted/60"
              >
                {item.label}
                <span className="ml-auto text-xs">준비중</span>
              </span>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center rounded-lg px-3 py-2 text-sm transition hover:bg-white/5"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="border-t border-card-border px-6 py-4">
          <p className="text-sm font-medium">{user.username}</p>
          <p className="text-xs text-muted">{roleLabel}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 lg:px-6 lg:py-4">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
