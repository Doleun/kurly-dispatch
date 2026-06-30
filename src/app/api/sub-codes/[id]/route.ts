import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { forbiddenResponse, handleApiError, unauthorizedResponse } from "@/lib/api-utils";
import { getAuthUser, isSuperAdmin } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { centerSubCodes } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();
    if (!isSuperAdmin(user)) return forbiddenResponse();

    const subCodeId = Number((await params).id);
    if (Number.isNaN(subCodeId)) {
      return NextResponse.json({ error: "잘못된 ID입니다." }, { status: 400 });
    }

    await ensureDbReady();
    const [deleted] = await db
      .delete(centerSubCodes)
      .where(eq(centerSubCodes.id, subCodeId))
      .returning({ id: centerSubCodes.id });

    if (!deleted) {
      return NextResponse.json({ error: "코드를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
