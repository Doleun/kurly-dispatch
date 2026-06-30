import { eq } from "drizzle-orm";
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
import { centerUpdateSchema } from "@/lib/validations";

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
    const [row] = await db.select().from(centers).where(eq(centers.id, centerId)).limit(1);
    if (!row) return NextResponse.json({ error: "센터를 찾을 수 없습니다." }, { status: 404 });

    return NextResponse.json(row);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();
    if (!isSuperAdmin(user)) return forbiddenResponse();

    const centerId = Number((await params).id);
    if (Number.isNaN(centerId)) return badRequestResponse("잘못된 센터 ID입니다.");

    await ensureDbReady();
    const body = await request.json();
    const parsed = centerUpdateSchema.safeParse(body);
    if (!parsed.success) return badRequestResponse("입력값을 확인하세요.");

    const data = parsed.data;
    const [updated] = await db
      .update(centers)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(centers.id, centerId))
      .returning();

    if (!updated) return NextResponse.json({ error: "센터를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();
    if (!isSuperAdmin(user)) return forbiddenResponse();

    const centerId = Number((await params).id);
    if (Number.isNaN(centerId)) return badRequestResponse("잘못된 센터 ID입니다.");

    await ensureDbReady();
    const [deleted] = await db
      .delete(centers)
      .where(eq(centers.id, centerId))
      .returning({ id: centers.id });

    if (!deleted) return NextResponse.json({ error: "센터를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
