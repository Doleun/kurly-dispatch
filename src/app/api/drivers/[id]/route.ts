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
import { drivers } from "@/lib/db/schema";
import { driverUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const driverId = Number((await params).id);
    if (Number.isNaN(driverId)) return badRequestResponse("잘못된 ID입니다.");

    await ensureDbReady();
    const [existing] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "기사를 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.role === "center_manager" && user.centerId !== existing.centerId) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const parsed = driverUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const accountType = data.accountType ?? existing.accountType;
    const defaultTimeSlot =
      data.defaultTimeSlot !== undefined ? data.defaultTimeSlot : existing.defaultTimeSlot;

    if (accountType !== "spare" && !defaultTimeSlot) {
      return badRequestResponse("일반 기사는 1차/2차를 선택하세요.");
    }

    const [updated] = await db
      .update(drivers)
      .set({
        centerId: data.centerId ?? existing.centerId,
        name: data.name ?? existing.name,
        kurlyId: data.kurlyId !== undefined ? data.kurlyId?.trim() || null : existing.kurlyId,
        kurlyAccountName:
          data.kurlyAccountName !== undefined
            ? data.kurlyAccountName?.trim() || null
            : existing.kurlyAccountName,
        accountType,
        defaultTimeSlot: accountType === "spare" ? defaultTimeSlot : defaultTimeSlot ?? "first",
        maxCapacity: data.maxCapacity !== undefined ? data.maxCapacity : existing.maxCapacity,
        capabilityNote:
          data.capabilityNote !== undefined ? data.capabilityNote : existing.capabilityNote,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(drivers.id, driverId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "이미 등록된 컬리 아이디입니다."
        : "기사 수정 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const driverId = Number((await params).id);
    if (Number.isNaN(driverId)) return badRequestResponse("잘못된 ID입니다.");

    await ensureDbReady();
    const [existing] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "기사를 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.role === "center_manager" && user.centerId !== existing.centerId) {
      return forbiddenResponse();
    }

    await db.delete(drivers).where(eq(drivers.id, driverId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
