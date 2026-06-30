import { AppShell, PageHeader } from "@/components/app-shell";
import { CenterManager } from "@/components/centers/center-manager";
import { getAuthUser, isSuperAdmin } from "@/lib/center-access";
import { redirect } from "next/navigation";

export default async function CentersPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return (
    <AppShell user={user}>
      <PageHeader
        title="센터 · 관리자"
        description="센터 설정과 관리자 계정을 관리합니다."
      />
      <CenterManager isSuperAdmin={isSuperAdmin(user)} />
    </AppShell>
  );
}
