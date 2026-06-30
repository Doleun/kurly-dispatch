import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/app-shell";
import { ZoneManager } from "@/components/zones/zone-manager";
import { getAuthUser } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { centers } from "@/lib/db/schema";

export default async function ZonesPage() {
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
          title="구역 관리"
          description="센터별 구역번호(20-1, 20-1가 등)를 등록·수정·삭제합니다."
        />
        <ZoneManager centers={centerRows} lockedCenterId={user.centerId} />
      </div>
    </AppShell>
  );
}
