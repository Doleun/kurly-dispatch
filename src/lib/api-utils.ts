import { NextResponse } from "next/server";
import type { AuthUser } from "@/lib/center-access";

export function unauthorizedResponse() {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

export function forbiddenResponse(message = "접근 권한이 없습니다.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequestResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function parseCenterIdParam(value: string | null): number | null {
  if (!value) return null;
  const id = Number(value);
  return Number.isNaN(id) ? null : id;
}

export function assertCenterAccess(user: AuthUser, centerId: number) {
  if (user.role === "center_manager" && user.centerId !== centerId) {
    throw new Error("FORBIDDEN");
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error.message === "FORBIDDEN") return forbiddenResponse();
  }
  console.error(error);
  return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
}
