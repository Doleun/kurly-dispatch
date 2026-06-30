import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { asc, eq } from "drizzle-orm";
import { AppShell, PageHeader } from "@/components/app-shell";
import { CenterPicker } from "@/components/center-picker";
import { getAuthUser } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { centers, drivers, zones } from "@/lib/db/schema";

type Props = { searchParams: Promise<{ centerId?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  await ensureDbReady();
  let centerRows = await db.select().from(centers).orderBy(asc(centers.name));
  if (user.role === "center_manager" && user.centerId) {
    centerRows = centerRows.filter((c) => c.id === user.centerId);
  }

  const params = await searchParams;
  const requestedId = params.centerId ? Number(params.centerId) : null;
  const filterCenterId =
    user.role === "center_manager"
      ? user.centerId
      : requestedId && centerRows.some((c) => c.id === requestedId)
        ? requestedId
        : (centerRows[0]?.id ?? null);

  const allZones = await db.select().from(zones).where(eq(zones.isActive, true));
  const allDrivers = await db.select().from(drivers).where(eq(drivers.isActive, true));

  const zoneCount = filterCenterId
    ? allZones.filter((z) => z.centerId === filterCenterId).length
    : allZones.length;

  const driverCount = filterCenterId
    ? allDrivers.filter((d) => d.centerId === filterCenterId).length
    : allDrivers.length;

  return (
    <AppShell user={user}>
      <PageHeader
        title="대시보드"
        description={
          user.role === "center_manager"
            ? `${user.centerName ?? "담당 센터"} 관리`
            : "센터·구역·기사·배차를 한곳에서 관리합니다."
        }
        action={
          user.role === "super_admin" ? (
            <Suspense fallback={null}>
              <CenterPicker centers={centerRows} />
            </Suspense>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="등록 구역" value={String(zoneCount)} hint="운영 중" />
        <StatCard label="기사" value={String(driverCount)} hint="운영 중" />
        <StatCard label="오늘 배차" value="-" hint="Phase 1d 예정" />
      </div>

      <section className="mt-6 rounded-2xl border border-card-border bg-card p-5">
        <h3 className="text-lg font-semibold">시작하기</h3>
        <ol className="mt-4 space-y-3 text-sm">
          <Step n={1} title="센터 확인" done={centerRows.length > 0}>
            <Link href="/centers" className="text-accent hover:underline">
              센터 · 관리자
            </Link>
            에서 대구/울산 설정을 확인하세요.
          </Step>
          <Step n={2} title="구역 등록" done={zoneCount > 0}>
            <Link href="/zones" className="text-accent hover:underline">
              구역 관리
            </Link>
            에서 센터별 구역을 등록하세요.
          </Step>
          <Step n={3} title="기사 등록" done={driverCount > 0}>
            <Link href="/drivers" className="text-accent hover:underline">
              기사 관리
            </Link>
            에서 실명·컬리 ID를 입력하세요.
          </Step>
          <Step n={4} title="기사 · 구역 · 랜덤" done={driverCount > 0}>
            <Link href="/drivers" className="text-accent hover:underline">
              기사 관리
            </Link>
            에서 기사·고정 구역·랜덤 후보를 함께 설정하세요.
          </Step>
        </ol>
      </section>
    </AppShell>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-card-border/70 px-4 py-3">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done ? "bg-success/20 text-success" : "bg-white/10 text-muted"
        }`}
      >
        {n}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-muted">{children}</p>
      </div>
    </li>
  );
}
