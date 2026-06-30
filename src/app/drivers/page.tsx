import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/app-shell";
import { DriverManager } from "@/components/drivers/driver-manager";
import { getAuthUser } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { centers } from "@/lib/db/schema";

export default async function DriversPage() {
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
          title="기사 관리"
          description="기사 정보, 고정 구역, 랜덤 후보, 기본 ID 매칭을 한곳에서 관리합니다."
        />
        <DriverManager centers={centerRows} lockedCenterId={user.centerId} />
      </div>
    </AppShell>
  );
}
