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
import { adminUserCreateSchema } from "@/lib/validations";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();
    if (!isSuperAdmin(user)) return forbiddenResponse();

    await ensureDbReady();
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        centerId: users.centerId,
        createdAt: users.createdAt,
      })
      .from(users);

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();
    if (!isSuperAdmin(user)) return forbiddenResponse();

    await ensureDbReady();
    const body = await request.json();
    const parsed = adminUserCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (data.role === "center_manager" && !data.centerId) {
      return badRequestResponse("센터 담당자는 센터를 지정해야 합니다.");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const [created] = await db
      .insert(users)
      .values({
        username: data.username,
        passwordHash,
        role: data.role,
        centerId: data.role === "center_manager" ? data.centerId! : null,
      })
      .returning({
        id: users.id,
        username: users.username,
        role: users.role,
        centerId: users.centerId,
        createdAt: users.createdAt,
      });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "이미 사용 중인 아이디입니다."
        : "계정 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
