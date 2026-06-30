"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Center } from "@/lib/db/schema";

type Props = {
  centers: Center[];
  lockedCenterId?: number | null;
  label?: string;
};

export function CenterPicker({ centers, lockedCenterId, label = "센터" }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (centers.length === 0) return null;

  const fromUrl = Number(searchParams.get("centerId"));
  const selectedId =
    lockedCenterId ??
    (Number.isNaN(fromUrl) ? centers[0].id : fromUrl || centers[0].id);

  function handleChange(nextId: number) {
    if (lockedCenterId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("centerId", String(nextId));
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <select
        value={selectedId}
        disabled={Boolean(lockedCenterId)}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="rounded-lg border border-card-border bg-background px-3 py-2 outline-none focus:border-accent disabled:opacity-70"
      >
        {centers.map((center) => (
          <option key={center.id} value={center.id}>
            {center.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function useSelectedCenterId(centers: Center[], lockedCenterId?: number | null) {
  const searchParams = useSearchParams();
  const fromUrl = Number(searchParams.get("centerId"));
  if (lockedCenterId) return lockedCenterId;
  if (!Number.isNaN(fromUrl) && fromUrl > 0) return fromUrl;
  return centers[0]?.id ?? null;
}
