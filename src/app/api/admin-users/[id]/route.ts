import bcrypt from "bcryptjs";
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
import { users } from "@/lib/db/schema";
import { adminUserUpdateSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();
    if (!isSuperAdmin(user)) return forbiddenResponse();

    const userId = Number((await params).id);
    if (Number.isNaN(userId)) return badRequestResponse("잘못된 ID입니다.");

    await ensureDbReady();
    const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = adminUserUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const role = data.role ?? existing.role;
    const centerId =
      role === "center_manager"
        ? (data.centerId ?? existing.centerId)
        : null;

    if (role === "center_manager" && !centerId) {
      return badRequestResponse("센터 담당자는 센터를 지정해야 합니다.");
    }

    const update: Partial<typeof users.$inferInsert> = {
      role,
      centerId,
    };
    if (data.password) {
      update.passwordHash = await bcrypt.hash(data.password, 10);
    }

    const [updated] = await db
      .update(users)
      .set(update)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        centerId: users.centerId,
        createdAt: users.createdAt,
      });

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

    const userId = Number((await params).id);
    if (Number.isNaN(userId)) return badRequestResponse("잘못된 ID입니다.");
    if (userId === user.userId) {
      return badRequestResponse("본인 계정은 삭제할 수 없습니다.");
    }

    await ensureDbReady();
    await db.delete(users).where(eq(users.id, userId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
