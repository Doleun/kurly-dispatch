import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value.includes("T") ? value : `${value} UTC`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}
