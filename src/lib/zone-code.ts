/** 구역 표시 코드 조합 */
export function buildZoneCode(baseCode: string, subCode?: string | null): string {
  const base = baseCode.trim();
  const sub = subCode?.trim();
  return sub ? `${base}${sub}` : base;
}

export function normalizeSubCode(subCode?: string | null): string {
  return subCode?.trim() ?? "";
}

/** 입력한 구역번호 하나(20-1 / 20-1가) → base + sub 분리 (DB·정렬용) */
export function parseZoneCode(code: string): { baseCode: string; subCode: string } {
  const trimmed = code.trim();
  const match = trimmed.match(/^(\d+-\d+)(.*)$/);
  if (match) {
    return { baseCode: match[1], subCode: match[2]?.trim() || "" };
  }
  return { baseCode: trimmed, subCode: "" };
}
