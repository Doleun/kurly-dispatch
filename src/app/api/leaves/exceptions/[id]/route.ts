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
import { driverLeaveExceptions } from "@/lib/db/schema";
import { leaveExceptionUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const id = Number((await params).id);
    if (Number.isNaN(id)) return badRequestResponse("잘못된 ID입니다.");

    await ensureDbReady();
    const [row] = await db
      .select()
      .from(driverLeaveExceptions)
      .where(eq(driverLeaveExceptions.id, id))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.role === "center_manager" && user.centerId !== row.centerId) {
      return forbiddenResponse();
    }

    await db.delete(driverLeaveExceptions).where(eq(driverLeaveExceptions.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const id = Number((await params).id);
    if (Number.isNaN(id)) return badRequestResponse("잘못된 ID입니다.");

    await ensureDbReady();
    const [row] = await db
      .select()
      .from(driverLeaveExceptions)
      .where(eq(driverLeaveExceptions.id, id))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.role === "center_manager" && user.centerId !== row.centerId) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const parsed = leaveExceptionUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(driverLeaveExceptions)
      .set({
        ...parsed.data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(driverLeaveExceptions.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
