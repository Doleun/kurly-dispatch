/** 세분화 코드 정렬: 가 → … → 하 */
const SUB_CODE_ORDER = [
  "가",
  "나",
  "다",
  "라",
  "마",
  "바",
  "사",
  "아",
  "자",
  "차",
  "카",
  "타",
  "파",
  "하",
];

function subCodeSortValue(suffix: string): number {
  if (!suffix) return 0;

  let value = 0;
  for (const char of suffix) {
    const index = SUB_CODE_ORDER.indexOf(char);
    value = value * 100 + (index >= 0 ? index + 1 : 50);
  }
  return value;
}

/** 구역번호 → 정렬용 숫자 (10-1 < 10-2 < 20-1 < 20-1가 < 20-1나) */
export function zoneCodeToSortOrder(code: string): number {
  const trimmed = code.trim();
  const match = trimmed.match(/^(\d+)-(\d+)(.*)$/);

  if (!match) {
    return 900_000_000 + trimmed.charCodeAt(0);
  }

  const block = Number.parseInt(match[1], 10);
  const num = Number.parseInt(match[2], 10);
  const suffix = match[3] ?? "";

  return block * 1_000_000 + num * 1_000 + subCodeSortValue(suffix);
}

export function compareZoneCodes(a: string, b: string): number {
  return zoneCodeToSortOrder(a) - zoneCodeToSortOrder(b);
}
