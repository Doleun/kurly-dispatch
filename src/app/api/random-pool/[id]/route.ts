import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { forbiddenResponse, handleApiError, unauthorizedResponse } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { drivers, randomPoolMembers } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const memberId = Number((await params).id);
    if (Number.isNaN(memberId)) {
      return NextResponse.json({ error: "잘못된 ID입니다." }, { status: 400 });
    }

    await ensureDbReady();
    const [member] = await db
      .select()
      .from(randomPoolMembers)
      .where(eq(randomPoolMembers.id, memberId))
      .limit(1);

    if (!member) {
      return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 });
    }

    const [driver] = await db.select().from(drivers).where(eq(drivers.id, member.driverId)).limit(1);
    if (driver && user.role === "center_manager" && user.centerId !== driver.centerId) {
      return forbiddenResponse();
    }

    await db.delete(randomPoolMembers).where(eq(randomPoolMembers.id, memberId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
