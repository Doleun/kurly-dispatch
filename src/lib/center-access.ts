import { eq } from "drizzle-orm";
import { getSession, type SessionPayload } from "@/lib/auth";
import { db, ensureDbReady } from "@/lib/db";
import { centers, users, type UserRole } from "@/lib/db/schema";

export type AuthUser = SessionPayload & {
  role: UserRole;
  centerId: number | null;
  centerName: string | null;
};

export function canAccessCenter(user: AuthUser, centerId: number): boolean {
  if (user.role === "super_admin") return true;
  return user.centerId === centerId;
}

/** API/화면에서 사용할 센터 ID. center_manager는 본인 센터만. */
export function resolveCenterId(
  user: AuthUser,
  requestedCenterId?: number | null,
): number | null {
  if (user.role === "center_manager") {
    return user.centerId;
  }
  return requestedCenterId ?? null;
}

export function requireCenterAccess(user: AuthUser, centerId: number): boolean {
  return canAccessCenter(user, centerId);
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;

  await ensureDbReady();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return null;

  let centerName: string | null = null;
  if (user.centerId) {
    const [center] = await db
      .select({ name: centers.name })
      .from(centers)
      .where(eq(centers.id, user.centerId))
      .limit(1);
    centerName = center?.name ?? null;
  }

  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    centerId: user.centerId,
    centerName,
  };
}

export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export function isSuperAdmin(user: AuthUser): boolean {
  return user.role === "super_admin";
}
