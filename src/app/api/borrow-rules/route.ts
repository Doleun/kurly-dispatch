import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  badRequestResponse,
  forbiddenResponse,
  handleApiError,
  parseCenterIdParam,
  unauthorizedResponse,
} from "@/lib/api-utils";
import { getAuthUser, resolveCenterId } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { driverIdBorrowRules, drivers } from "@/lib/db/schema";
import { borrowRuleCreateSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const centerId = resolveCenterId(user, parseCenterIdParam(searchParams.get("centerId")));

    let rows = await db.select().from(driverIdBorrowRules);
    if (centerId) {
      if (user.role === "center_manager" && user.centerId !== centerId) {
        return forbiddenResponse();
      }
      rows = rows.filter((r) => r.centerId === centerId);
    } else if (user.role === "center_manager" && user.centerId) {
      rows = rows.filter((r) => r.centerId === user.centerId);
    }

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const body = await request.json();
    const parsed = borrowRuleCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (user.role === "center_manager" && user.centerId !== data.centerId) {
      return forbiddenResponse();
    }

    if (data.actualDriverId === data.kurlyDriverId) {
      return badRequestResponse("실배송자와 빌릴 ID는 달라야 합니다.");
    }

    const [actual] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.id, data.actualDriverId))
      .limit(1);
    const [kurly] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.id, data.kurlyDriverId))
      .limit(1);

    if (!actual || !kurly) return badRequestResponse("기사를 찾을 수 없습니다.");
    if (actual.centerId !== data.centerId || kurly.centerId !== data.centerId) {
      return badRequestResponse("같은 센터 기사만 연결할 수 있습니다.");
    }
    if (kurly.kurlyId === null || kurly.kurlyId === "") {
      return badRequestResponse("빌릴 ID는 컬리 아이디가 있는 기사여야 합니다.");
    }

    const [created] = await db
      .insert(driverIdBorrowRules)
      .values({
        centerId: data.centerId,
        actualDriverId: data.actualDriverId,
        kurlyDriverId: data.kurlyDriverId,
        note: data.note ?? null,
        isActive: data.isActive ?? true,
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "이 실배송자에 대한 규칙이 이미 있습니다."
        : "규칙 저장 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
