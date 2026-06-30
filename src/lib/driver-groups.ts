import type { CoverageArea, Driver, EmploymentType } from "@/lib/db/schema";

export const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: "jiip", label: "지입" },
  { value: "hwaseong", label: "화성(알바)" },
];

/** 센터명 → 휴무표 권역 옵션 (없으면 권역 구분 미사용) */
export const CENTER_COVERAGE_AREAS: Record<
  string,
  { value: CoverageArea; label: string }[]
> = {
  대구: [
    { value: "daegu", label: "대구" },
    { value: "gumi", label: "구미" },
  ],
  울산: [
    { value: "ulsan", label: "울산" },
    { value: "busan", label: "부산" },
  ],
};

export function coverageAreasForCenter(centerName: string | undefined) {
  if (!centerName) return null;
  return CENTER_COVERAGE_AREAS[centerName] ?? null;
}

export function employmentLabel(type: EmploymentType | null | undefined): string {
  if (!type) return "-";
  return EMPLOYMENT_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function coverageLabel(
  area: CoverageArea | null | undefined,
  centerName: string | undefined,
): string {
  if (!area) return "-";
  const options = coverageAreasForCenter(centerName);
  return options?.find((o) => o.value === area)?.label ?? area;
}

export function formatDriverGroupLabel(
  driver: Pick<Driver, "coverageArea" | "employmentType">,
  centerName: string | undefined,
): string {
  const parts = [
    coverageLabel(driver.coverageArea, centerName),
    employmentLabel(driver.employmentType),
  ].filter((p) => p !== "-");
  return parts.length > 0 ? parts.join(" · ") : "-";
}

export function isCoverageAreaValidForCenter(
  centerName: string,
  area: CoverageArea | null | undefined,
): boolean {
  if (!area) return true;
  const options = coverageAreasForCenter(centerName);
  if (!options) return false;
  return options.some((o) => o.value === area);
}
