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
import { centers, zones } from "@/lib/db/schema";
import { parseZoneCode } from "@/lib/zone-code";
import { compareZoneCodes, zoneCodeToSortOrder } from "@/lib/zone-sort";
import { zoneCreateSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const requestedCenterId = parseCenterIdParam(searchParams.get("centerId"));
    const centerId = resolveCenterId(user, requestedCenterId);

    let rows = await db.select().from(zones);
    if (centerId) {
      if (user.role === "center_manager" && user.centerId !== centerId) {
        return forbiddenResponse();
      }
      rows = rows.filter((z) => z.centerId === centerId);
    } else if (user.role === "center_manager" && user.centerId) {
      rows = rows.filter((z) => z.centerId === user.centerId);
    }

    rows.sort((a, b) => {
      if (a.centerId !== b.centerId) return a.centerId - b.centerId;
      return compareZoneCodes(a.code, b.code);
    });

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
    const parsed = zoneCreateSchema.safeParse(body);

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

    const [center] = await db
      .select()
      .from(centers)
      .where(eq(centers.id, data.centerId))
      .limit(1);
    if (!center) return badRequestResponse("센터를 찾을 수 없습니다.");

    const code = data.code.trim();
    const { baseCode, subCode } = parseZoneCode(code);
    const sortOrder = zoneCodeToSortOrder(code);

    const [created] = await db
      .insert(zones)
      .values({
        centerId: data.centerId,
        baseCode,
        subCode,
        code,
        name: data.name ?? null,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
        sortOrder,
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "이미 존재하는 구역입니다."
        : "구역 등록 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
