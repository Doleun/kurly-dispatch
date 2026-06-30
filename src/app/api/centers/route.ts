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
import { centers } from "@/lib/db/schema";
import { centerCreateSchema } from "@/lib/validations";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const rows = await db
      .select()
      .from(centers)
      .orderBy(asc(centers.name));

    const filtered =
      user.role === "center_manager" && user.centerId
        ? rows.filter((c) => c.id === user.centerId)
        : rows;

    return NextResponse.json(filtered);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();
    if (!isSuperAdmin(user)) return forbiddenResponse("통합 관리자만 센터를 등록할 수 있습니다.");

    await ensureDbReady();
    const body = await request.json();
    const parsed = centerCreateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequestResponse("입력값을 확인하세요.");
    }

    const data = parsed.data;
    const [created] = await db
      .insert(centers)
      .values({
        name: data.name,
        isActive: data.isActive ?? true,
        updatedAt: new Date().toISOString(),
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
