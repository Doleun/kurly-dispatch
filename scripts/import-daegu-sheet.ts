import fs from "fs";
import path from "path";
import "./load-env";
import { and, eq } from "drizzle-orm";
import { db, ensureDbReady } from "../src/lib/db";
import {
  centers,
  driverIdBorrowRules,
  driverWeeklyLeaves,
  drivers,
  randomPoolMembers,
  zoneMappings,
  zones,
} from "../src/lib/db/schema";
import type { CoverageArea, EmploymentType, TimeSlot, Weekday } from "../src/lib/db/schema";
import { buildNameToKurlyIdMap } from "./daegu-kurly-ids";
import { CSV_DAY_COLUMN_STARTS } from "../src/lib/leave-utils";

const DEFAULT_CSV = path.join(
  process.env.USERPROFILE ?? "",
  "Downloads",
  "(주)태호물류 - 신양식_[서대구_컬리7월휴무표].csv",
);

type ParsedGroup = {
  coverageArea: CoverageArea;
  employmentType: EmploymentType;
};

type SheetLeave = {
  name: string;
  timeSlot: TimeSlot;
  weekday: Weekday;
  note: string | null;
};

type SheetDriver = {
  name: string;
  timeSlot: TimeSlot;
  group: ParsedGroup;
  borrowFromName: string | null;
  zoneCodes: Set<string>;
  hasRandom: boolean;
  maxCapacity: number;
};

function isLeaveStatusRow(name: string, status: string): boolean {
  if (!name.trim() || name === "배송자") return false;
  return status.trim() === "휴무";
}

function parseLeaveFromDayBlock(
  row: string[],
  start: number,
  weekday: Weekday,
  timeSlot: TimeSlot,
): SheetLeave | null {
  const c0 = (row[start] ?? "").trim();
  const c1 = (row[start + 1] ?? "").trim();
  const c2 = (row[start + 2] ?? "").trim();
  const c3 = (row[start + 3] ?? "").trim();

  // 상태 행: 배송자 칸 비움 → ID 칸에 이름, 구역 칸에 휴무, 역량 칸에 N일
  if (!c0 && isLeaveStatusRow(c1, c2)) {
    return { name: c1, timeSlot, weekday, note: c3 || null };
  }
  // 배송자 칸에 이름, ID 칸에 휴무 (드묾)
  if (isLeaveStatusRow(c0, c1)) {
    return { name: c0, timeSlot, weekday, note: c2 || null };
  }
  return null;
}

function parseLeaveRows(rows: string[][]): SheetLeave[] {
  const leaves: SheetLeave[] = [];
  let timeSlot: TimeSlot = "first";
  let currentGroup: ParsedGroup | null = null;

  for (const row of rows) {
    const slotCell = row[1]?.trim();
    if (slotCell === "1차") {
      timeSlot = "first";
      continue;
    }
    if (slotCell === "2차") {
      timeSlot = "second";
      continue;
    }

    const groupFromRow = parseGroupLabel(row[1] ?? "");
    if (groupFromRow) currentGroup = groupFromRow;

    if (!currentGroup) continue;
    if (row[1]?.includes("특이사항")) break;
    if (/^\d+명$/.test(row[2]?.trim() ?? "")) continue;

    for (const { start, weekday } of CSV_DAY_COLUMN_STARTS) {
      const parsed = parseLeaveFromDayBlock(row, start, weekday, timeSlot);
      if (parsed) leaves.push(parsed);
    }
  }

  return leaves;
}

const STATUS_WORDS = new Set(["출근", "휴무", "1일", "3일", "4일", "5일"]);

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }

  return rows;
}

function parseGroupLabel(raw: string): ParsedGroup | null {
  const text = raw.replace(/\s+/g, "");
  if (!text) return null;
  if (text.includes("대구") && text.includes("지입")) {
    return { coverageArea: "daegu", employmentType: "jiip" };
  }
  if (text.includes("대구") && text.includes("화성")) {
    return { coverageArea: "daegu", employmentType: "hwaseong" };
  }
  if (text.includes("구미") && text.includes("지입")) {
    return { coverageArea: "gumi", employmentType: "jiip" };
  }
  if (text.includes("구미") && text.includes("화성")) {
    return { coverageArea: "gumi", employmentType: "hwaseong" };
  }
  return null;
}

function parseZoneList(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "랜덤" || STATUS_WORDS.has(trimmed)) return [];

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) return [parts[0]];

  const first = parts[0];
  const match = first.match(/^(\d+)-(\d+)$/);
  if (!match) return [trimmed];

  const block = match[1];
  const codes = [first];
  for (let i = 1; i < parts.length; i++) {
    const sub = parts[i];
    if (/^\d+$/.test(sub)) codes.push(`${block}-${sub}`);
    else if (/^\d+-\d+$/.test(sub)) codes.push(sub);
    else codes.push(sub);
  }
  return codes;
}

function isStatusRow(name: string, borrowId: string, zone: string): boolean {
  if (!name.trim()) return true;
  if (name === "배송자" || borrowId === "ID" || zone === "구역") return true;
  if (STATUS_WORDS.has(zone.trim()) || STATUS_WORDS.has(borrowId.trim())) return true;
  if (/^\d+일$/.test(zone.trim())) return true;
  return false;
}

function parseSpareAccounts(rows: string[][]): Map<string, TimeSlot | "both"> {
  const spare = new Map<string, TimeSlot | "both">();
  for (const row of rows) {
    for (const cell of row) {
      const m = cell.trim().match(/^(.+?)\((1(?:,2)?차|2차|1차)\)$/);
      if (!m) continue;
      const name = m[1].trim();
      const slotText = m[2];
      if (slotText.includes(",")) spare.set(name, "both");
      else if (slotText.startsWith("2")) spare.set(name, "second");
      else spare.set(name, "first");
    }
  }
  return spare;
}

function parseScheduleRows(rows: string[][]): SheetDriver[] {
  const byKey = new Map<string, SheetDriver>();
  let timeSlot: TimeSlot = "first";
  let currentGroup: ParsedGroup | null = null;
  const dayStarts = [2, 6, 10, 14, 18, 22, 26];

  for (const row of rows) {
    const slotCell = row[1]?.trim();
    if (slotCell === "1차") {
      timeSlot = "first";
      continue;
    }
    if (slotCell === "2차") {
      timeSlot = "second";
      continue;
    }

    const groupFromRow = parseGroupLabel(row[1] ?? "");
    if (groupFromRow) currentGroup = groupFromRow;

    if (!currentGroup) continue;
    if (row[1]?.includes("특이사항")) break;
    if (/^\d+명$/.test(row[2]?.trim() ?? "")) continue;

    for (const start of dayStarts) {
      const name = (row[start] ?? "").trim();
      const borrowId = (row[start + 1] ?? "").trim();
      const zone = (row[start + 2] ?? "").trim();
      const capaRaw = (row[start + 3] ?? "").trim();

      if (isStatusRow(name, borrowId, zone)) continue;

      const key = `${name}::${timeSlot}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          name,
          timeSlot,
          group: currentGroup,
          borrowFromName: null,
          zoneCodes: new Set(),
          hasRandom: false,
          maxCapacity: 0,
        };
        byKey.set(key, entry);
      }

      if (borrowId && !STATUS_WORDS.has(borrowId)) {
        if (entry.borrowFromName && entry.borrowFromName !== borrowId) {
          console.warn(
            `  ⚠ ${name}(${timeSlot}): ID 빌림 대상 불일치 (${entry.borrowFromName} vs ${borrowId})`,
          );
        } else {
          entry.borrowFromName = borrowId;
        }
      }

      if (zone === "랜덤") {
        entry.hasRandom = true;
      } else {
        for (const code of parseZoneList(zone)) entry.zoneCodes.add(code);
      }

      const capa = Number(capaRaw);
      if (!Number.isNaN(capa) && capa > entry.maxCapacity) entry.maxCapacity = capa;
    }
  }

  return [...byKey.values()];
}

function splitZoneCode(code: string): { baseCode: string; subCode: string; code: string } {
  const idx = code.indexOf("-");
  if (idx === -1) return { baseCode: code, subCode: "", code };
  return {
    baseCode: code.slice(0, idx),
    subCode: code.slice(idx + 1),
    code,
  };
}

async function ensureZone(centerId: number, code: string, zoneIdByCode: Map<string, number>) {
  const cached = zoneIdByCode.get(code);
  if (cached) return cached;

  const [existing] = await db
    .select({ id: zones.id })
    .from(zones)
    .where(and(eq(zones.centerId, centerId), eq(zones.code, code)))
    .limit(1);

  if (existing) {
    zoneIdByCode.set(code, existing.id);
    return existing.id;
  }

  const parts = splitZoneCode(code);
  const [inserted] = await db
    .insert(zones)
    .values({
      centerId,
      baseCode: parts.baseCode,
      subCode: parts.subCode,
      code: parts.code,
      isActive: true,
      updatedAt: new Date().toISOString(),
    })
    .returning({ id: zones.id });

  zoneIdByCode.set(code, inserted.id);
  return inserted.id;
}

async function main() {
  const csvArg = process.argv[2];
  const csvPath = csvArg ? path.resolve(csvArg) : DEFAULT_CSV;

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV 파일을 찾을 수 없습니다: ${csvPath}`);
    process.exit(1);
  }

  await ensureDbReady();

  const [daegu] = await db.select().from(centers).where(eq(centers.name, "대구")).limit(1);
  if (!daegu) {
    console.error('센터 "대구"를 찾을 수 없습니다.');
    process.exit(1);
  }

  const text = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  const sheetDrivers = parseScheduleRows(rows);
  const sheetLeaves = parseLeaveRows(rows);
  const spareAccounts = parseSpareAccounts(rows);
  const nameToKurlyId = buildNameToKurlyIdMap();

  const existingDrivers = await db.select().from(drivers).where(eq(drivers.centerId, daegu.id));
  const driverByName = new Map(existingDrivers.map((d) => [d.name, d]));

  let driversCreated = 0;
  let driversUpdated = 0;

  for (const sheet of sheetDrivers) {
    let driver = driverByName.get(sheet.name);
    const kurlyId = sheet.borrowFromName ? null : (nameToKurlyId.get(sheet.name) ?? null);

    if (!driver) {
      const [created] = await db
        .insert(drivers)
        .values({
          centerId: daegu.id,
          name: sheet.name,
          kurlyId,
          accountType: "regular",
          defaultTimeSlot: sheet.timeSlot,
          coverageArea: sheet.group.coverageArea,
          employmentType: sheet.group.employmentType,
          maxCapacity: sheet.maxCapacity || null,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .returning();
      driverByName.set(sheet.name, created);
      driversCreated++;
    } else {
      await db
        .update(drivers)
        .set({
          kurlyId: sheet.borrowFromName ? null : (driver.kurlyId ?? kurlyId),
          defaultTimeSlot: sheet.timeSlot,
          coverageArea: sheet.group.coverageArea,
          employmentType: sheet.group.employmentType,
          maxCapacity: sheet.maxCapacity || driver.maxCapacity,
          accountType: "regular",
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(drivers.id, driver.id));
      driversUpdated++;
    }
  }

  for (const [name, slot] of spareAccounts) {
    const driver = driverByName.get(name);
    const kurlyId = nameToKurlyId.get(name) ?? null;
    const defaultTimeSlot: TimeSlot | null = slot === "both" ? null : slot;

    if (!driver) {
      const [created] = await db
        .insert(drivers)
        .values({
          centerId: daegu.id,
          name,
          kurlyId,
          accountType: "spare",
          defaultTimeSlot,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .returning();
      driverByName.set(name, created);
      driversCreated++;
    } else {
      await db
        .update(drivers)
        .set({
          accountType: "spare",
          kurlyId: driver.kurlyId ?? kurlyId,
          defaultTimeSlot,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(drivers.id, driver.id));
      driversUpdated++;
    }
  }

  const allDrivers = await db.select().from(drivers).where(eq(drivers.centerId, daegu.id));
  for (const d of allDrivers) driverByName.set(d.name, d);

  let borrowCreated = 0;
  let borrowSkipped = 0;

  for (const sheet of sheetDrivers) {
    if (!sheet.borrowFromName) continue;
    const actual = driverByName.get(sheet.name);
    const kurlyOwner = driverByName.get(sheet.borrowFromName);
    if (!actual || !kurlyOwner) {
      console.warn(`  ⚠ 빌림 ID 소유자 없음: ${sheet.name} → ${sheet.borrowFromName}`);
      continue;
    }

    const [existing] = await db
      .select()
      .from(driverIdBorrowRules)
      .where(
        and(
          eq(driverIdBorrowRules.centerId, daegu.id),
          eq(driverIdBorrowRules.actualDriverId, actual.id),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.kurlyDriverId !== kurlyOwner.id) {
        await db
          .update(driverIdBorrowRules)
          .set({
            kurlyDriverId: kurlyOwner.id,
            isActive: true,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(driverIdBorrowRules.id, existing.id));
        borrowCreated++;
      } else {
        borrowSkipped++;
      }
    } else {
      await db.insert(driverIdBorrowRules).values({
        centerId: daegu.id,
        actualDriverId: actual.id,
        kurlyDriverId: kurlyOwner.id,
        isActive: true,
        updatedAt: new Date().toISOString(),
      });
      borrowCreated++;
    }
  }

  const centerZones = await db.select().from(zones).where(eq(zones.centerId, daegu.id));
  const zoneIdByCode = new Map(centerZones.map((z) => [z.code, z.id]));

  for (const sheet of sheetDrivers) {
    const driver = driverByName.get(sheet.name);
    if (!driver || driver.accountType === "spare") continue;

    await db.delete(zoneMappings).where(eq(zoneMappings.driverId, driver.id));
    await db.delete(randomPoolMembers).where(eq(randomPoolMembers.driverId, driver.id));

    const useRandom = sheet.hasRandom && sheet.zoneCodes.size === 0;
    if (useRandom) {
      await db.insert(randomPoolMembers).values({
        driverId: driver.id,
        timeSlot: sheet.timeSlot,
      });
      continue;
    }

    if (sheet.hasRandom && sheet.zoneCodes.size > 0) {
      console.warn(
        `  ⚠ ${sheet.name}(${sheet.timeSlot}): 요일별 랜덤/고정 혼합 → 고정 ${[...sheet.zoneCodes].join(", ")}`,
      );
    }

    for (const code of sheet.zoneCodes) {
      const zoneId = await ensureZone(daegu.id, code, zoneIdByCode);
      await db.insert(zoneMappings).values({
        driverId: driver.id,
        zoneId,
        timeSlot: sheet.timeSlot,
      });
    }
  }

  let leavesImported = 0;
  for (const slot of ["first", "second"] as const) {
    await db
      .delete(driverWeeklyLeaves)
      .where(
        and(
          eq(driverWeeklyLeaves.centerId, daegu.id),
          eq(driverWeeklyLeaves.timeSlot, slot),
        ),
      );
  }

  const now = new Date().toISOString();
  for (const leaf of sheetLeaves) {
    const driver = driverByName.get(leaf.name);
    if (!driver || driver.accountType === "spare") {
      console.warn(`  ⚠ 휴무 import skip: ${leaf.name} (기사 없음)`);
      continue;
    }
    await db.insert(driverWeeklyLeaves).values({
      centerId: daegu.id,
      driverId: driver.id,
      timeSlot: leaf.timeSlot,
      weekday: leaf.weekday,
      note: leaf.note,
      updatedAt: now,
    });
    leavesImported++;
  }

  const missingKurlyId = sheetDrivers.filter(
    (s) => !s.borrowFromName && !nameToKurlyId.has(s.name),
  );

  console.log("\n=== 서대구 7월 휴무표 import 완료 ===");
  console.log(`CSV: ${csvPath}`);
  console.log(
    `휴무표 기사: ${sheetDrivers.length}명 (1차 ${sheetDrivers.filter((s) => s.timeSlot === "first").length}, 2차 ${sheetDrivers.filter((s) => s.timeSlot === "second").length})`,
  );
  console.log(`기사 생성 ${driversCreated}, 갱신 ${driversUpdated}`);
  console.log(`ID 빌림 규칙 추가/갱신 ${borrowCreated}, 기존 ${borrowSkipped}`);
  console.log(`예비 ID ${spareAccounts.size}명`);
  console.log(`요일별 휴무 ${leavesImported}건 (CSV ${sheetLeaves.length}건)`);

  if (missingKurlyId.length) {
    console.log("\n본인 ID 목록에 없는 기사 (kurly_id 없음):");
    for (const s of missingKurlyId) console.log(`  - ${s.name} (${s.timeSlot})`);
  }

  console.log("\n요일별 휴무:");
  for (const leaf of sheetLeaves) {
    const day = ["월", "화", "수", "목", "금", "토", "일"][leaf.weekday];
    console.log(
      `  - ${leaf.name} (${leaf.timeSlot === "first" ? "1차" : "2차"}) ${day}요일${leaf.note ? ` · ${leaf.note}` : ""}`,
    );
  }

  console.log("\nID 빌림:");
  for (const s of sheetDrivers.filter((x) => x.borrowFromName)) {
    console.log(`  - ${s.name} → ${s.borrowFromName}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
