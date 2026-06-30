import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { forbiddenResponse, handleApiError, unauthorizedResponse } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { drivers, zoneMappings, zones } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const mappingId = Number((await params).id);
    if (Number.isNaN(mappingId)) {
      return NextResponse.json({ error: "잘못된 ID입니다." }, { status: 400 });
    }

    await ensureDbReady();
    const [mapping] = await db
      .select()
      .from(zoneMappings)
      .where(eq(zoneMappings.id, mappingId))
      .limit(1);

    if (!mapping) {
      return NextResponse.json({ error: "매핑을 찾을 수 없습니다." }, { status: 404 });
    }

    const [zone] = await db.select().from(zones).where(eq(zones.id, mapping.zoneId)).limit(1);
    if (zone && user.role === "center_manager" && user.centerId !== zone.centerId) {
      return forbiddenResponse();
    }

    await db.delete(zoneMappings).where(eq(zoneMappings.id, mappingId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
