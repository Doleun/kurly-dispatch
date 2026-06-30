import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/app-shell";
import { AttendanceView } from "@/components/schedule/attendance-view";
import { getAuthUser } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { centers } from "@/lib/db/schema";

export default async function AttendancePage() {
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
          title="출근 현황"
          description="선택한 날짜·타임의 출근·휴무 기사를 확인합니다."
        />
        <AttendanceView centers={centerRows} lockedCenterId={user.centerId} />
      </div>
    </AppShell>
  );
}
