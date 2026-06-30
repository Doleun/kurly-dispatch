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
import { driverIdBorrowRules, drivers } from "@/lib/db/schema";
import { borrowRuleUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const ruleId = Number((await params).id);
    if (Number.isNaN(ruleId)) return badRequestResponse("잘못된 ID입니다.");

    await ensureDbReady();
    const [existing] = await db
      .select()
      .from(driverIdBorrowRules)
      .where(eq(driverIdBorrowRules.id, ruleId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "규칙을 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.role === "center_manager" && user.centerId !== existing.centerId) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const parsed = borrowRuleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const kurlyDriverId = data.kurlyDriverId ?? existing.kurlyDriverId;

    if (kurlyDriverId === existing.actualDriverId) {
      return badRequestResponse("실배송자와 빌릴 ID는 달라야 합니다.");
    }

    if (data.kurlyDriverId) {
      const [kurly] = await db
        .select()
        .from(drivers)
        .where(eq(drivers.id, data.kurlyDriverId))
        .limit(1);
      if (!kurly?.kurlyId) {
        return badRequestResponse("빌릴 ID는 컬리 아이디가 있는 기사여야 합니다.");
      }
    }

    const [updated] = await db
      .update(driverIdBorrowRules)
      .set({
        kurlyDriverId,
        note: data.note !== undefined ? data.note : existing.note,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(driverIdBorrowRules.id, ruleId))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const ruleId = Number((await params).id);
    if (Number.isNaN(ruleId)) return badRequestResponse("잘못된 ID입니다.");

    await ensureDbReady();
    const [existing] = await db
      .select()
      .from(driverIdBorrowRules)
      .where(eq(driverIdBorrowRules.id, ruleId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "규칙을 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.role === "center_manager" && user.centerId !== existing.centerId) {
      return forbiddenResponse();
    }

    await db.delete(driverIdBorrowRules).where(eq(driverIdBorrowRules.id, ruleId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
