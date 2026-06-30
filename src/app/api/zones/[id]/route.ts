import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  badRequestResponse,
  forbiddenResponse,
  handleApiError,
  unauthorizedResponse,
} from "@/lib/api-utils";
import { getAuthUser } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { zones } from "@/lib/db/schema";
import { parseZoneCode } from "@/lib/zone-code";
import { zoneCodeToSortOrder } from "@/lib/zone-sort";
import { zoneUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  await ensureDbReady();
  const zoneId = Number((await params).id);

  if (Number.isNaN(zoneId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const [row] = await db.select().from(zones).where(eq(zones.id, zoneId)).limit(1);
  if (!row) {
    return NextResponse.json({ error: "구역을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const zoneId = Number((await params).id);
    if (Number.isNaN(zoneId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [existing] = await db.select().from(zones).where(eq(zones.id, zoneId)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "구역을 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.role === "center_manager" && user.centerId !== existing.centerId) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const parsed = zoneUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const centerId = data.centerId ?? existing.centerId;

    if (user.role === "center_manager" && user.centerId !== centerId) {
      return forbiddenResponse();
    }

    const code = (data.code ?? existing.code).trim();
    const { baseCode, subCode } = parseZoneCode(code);
    const sortOrder = zoneCodeToSortOrder(code);

    const [updated] = await db
      .update(zones)
      .set({
        centerId,
        baseCode,
        subCode,
        code,
        name: data.name !== undefined ? data.name : existing.name,
        description: data.description !== undefined ? data.description : existing.description,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        sortOrder,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(zones.id, zoneId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "이미 존재하는 구역입니다."
        : "구역 수정 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const zoneId = Number((await params).id);
    if (Number.isNaN(zoneId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const [existing] = await db.select().from(zones).where(eq(zones.id, zoneId)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "구역을 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.role === "center_manager" && user.centerId !== existing.centerId) {
      return forbiddenResponse();
    }

    const [deleted] = await db
      .delete(zones)
      .where(eq(zones.id, zoneId))
      .returning({ id: zones.id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
