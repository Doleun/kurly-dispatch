import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  badRequestResponse,
  forbiddenResponse,
  handleApiError,
  unauthorizedResponse,
} from "@/lib/api-utils";
import { getAuthUser, isSuperAdmin } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { centerSubCodes } from "@/lib/db/schema";
import { subCodeCreateSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const centerId = Number((await params).id);
    if (Number.isNaN(centerId)) return badRequestResponse("잘못된 센터 ID입니다.");
    if (user.role === "center_manager" && user.centerId !== centerId) {
      return forbiddenResponse();
    }

    await ensureDbReady();
    const rows = await db
      .select()
      .from(centerSubCodes)
      .where(eq(centerSubCodes.centerId, centerId))
      .orderBy(asc(centerSubCodes.sortOrder), asc(centerSubCodes.label));

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();
    if (!isSuperAdmin(user)) return forbiddenResponse();

    const centerId = Number((await params).id);
    if (Number.isNaN(centerId)) return badRequestResponse("잘못된 센터 ID입니다.");

    await ensureDbReady();
    const body = await request.json();
    const parsed = subCodeCreateSchema.safeParse(body);
    if (!parsed.success) return badRequestResponse("입력값을 확인하세요.");

    const data = parsed.data;
    const existing = await db
      .select()
      .from(centerSubCodes)
      .where(eq(centerSubCodes.centerId, centerId));

    const [created] = await db
      .insert(centerSubCodes)
      .values({
        centerId,
        label: data.label,
        sortOrder: data.sortOrder ?? existing.length + 1,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "이미 등록된 세분화 코드입니다."
        : undefined;
    if (message) return badRequestResponse(message);
    return handleApiError(error);
  }
}
