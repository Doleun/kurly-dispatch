import "./load-env";
import { eq } from "drizzle-orm";
import { db, ensureDbReady } from "../src/lib/db";
import { centers, drivers } from "../src/lib/db/schema";

import { DAEGU_KURLY_IDS_RAW } from "./daegu-kurly-ids";

/** @deprecated use DAEGU_KURLY_IDS_RAW */
const RAW = DAEGU_KURLY_IDS_RAW;

function parseName(raw: string): string {
  return raw.trim().replace(/^DW/i, "");
}

async function seed() {
  await ensureDbReady();

  const [daegu] = await db.select().from(centers).where(eq(centers.name, "대구")).limit(1);
  if (!daegu) {
    console.error('센터 "대구"를 찾을 수 없습니다. npm run dev 로 DB 마이그레이션 후 다시 실행하세요.');
    process.exit(1);
  }

  const existing = await db.select().from(drivers).where(eq(drivers.centerId, daegu.id));
  const existingIds = new Set(existing.map((d) => d.kurlyId).filter(Boolean));

  let created = 0;
  let skipped = 0;

  for (const line of RAW.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [kurlyId, displayRaw] = trimmed.split(/\t+/);
    const name = parseName(displayRaw);
    if (!kurlyId || !name) continue;

    if (existingIds.has(kurlyId)) {
      skipped++;
      continue;
    }

    await db.insert(drivers).values({
      centerId: daegu.id,
      name,
      kurlyId,
      accountType: "regular",
      defaultTimeSlot: "first",
      isActive: true,
      updatedAt: new Date().toISOString(),
    });
    existingIds.add(kurlyId);
    created++;
  }

  console.log(`대구 기사 시드 완료: 추가 ${created}명, 건너뜀 ${skipped}명 (중복)`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
