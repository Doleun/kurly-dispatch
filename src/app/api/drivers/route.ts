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
import { drivers } from "@/lib/db/schema";
import { driverCreateSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const centerId = resolveCenterId(user, parseCenterIdParam(searchParams.get("centerId")));

    let rows = await db.select().from(drivers);
    if (centerId) {
      if (user.role === "center_manager" && user.centerId !== centerId) {
        return forbiddenResponse();
      }
      rows = rows.filter((d) => d.centerId === centerId);
    } else if (user.role === "center_manager" && user.centerId) {
      rows = rows.filter((d) => d.centerId === user.centerId);
    }

    rows.sort((a, b) => a.name.localeCompare(b.name, "ko"));
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
    const parsed = driverCreateSchema.safeParse(body);
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

    if (data.accountType !== "spare" && !data.defaultTimeSlot) {
      return badRequestResponse("일반 기사는 1차/2차를 선택하세요.");
    }

    const [created] = await db
      .insert(drivers)
      .values({
        centerId: data.centerId,
        name: data.name,
        kurlyId: data.kurlyId?.trim() || null,
        kurlyAccountName: data.kurlyAccountName?.trim() || null,
        accountType: data.accountType ?? "regular",
        defaultTimeSlot:
          data.accountType === "spare"
            ? data.defaultTimeSlot ?? null
            : (data.defaultTimeSlot ?? "first"),
        maxCapacity: data.maxCapacity ?? null,
        capabilityNote: data.capabilityNote ?? null,
        isActive: data.isActive ?? true,
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "이미 등록된 컬리 아이디입니다."
        : "기사 등록 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
