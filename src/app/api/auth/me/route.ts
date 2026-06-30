import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";
import { getAuthUser } from "@/lib/center-access";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}
