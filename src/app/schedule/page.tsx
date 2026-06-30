import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/app-shell";
import { LeaveScheduleManager } from "@/components/schedule/leave-schedule-manager";
import { getAuthUser } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { centers } from "@/lib/db/schema";

export default async function SchedulePage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  await ensureDbReady();
  let centerRows = await db.select().from(centers).orderBy(asc(centers.name));
  if (user.role === "center_manager" && user.centerId) {
    centerRows = centerRows.filter((c) => c.id === user.centerId);
  }

  return (
    <AppShell user={user}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader
          title="휴무표"
          description="요일별 고정 휴무를 등록합니다. 센터·권역 데이터만 다르고 화면은 공통입니다."
        />
        <LeaveScheduleManager centers={centerRows} lockedCenterId={user.centerId} />
      </div>
    </AppShell>
  );
}
