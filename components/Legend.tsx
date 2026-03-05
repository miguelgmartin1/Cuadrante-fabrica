"use client";

import { ShiftCode } from "@/types/schedule";

interface Props {
  shiftCodes: ShiftCode[];
}

export default function Legend({ shiftCodes }: Props) {
  return (
    <div className="flex flex-wrap gap-2 p-3 bg-white border border-gray-200 rounded-lg">
      <span className="text-xs font-semibold text-gray-500 self-center mr-1">LEYENDA:</span>
      {shiftCodes.map((sc) => (
        <div
          key={sc.code}
          className="flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium"
          style={{
            backgroundColor: sc.color,
            color: sc.textColor,
            borderColor: sc.color,
          }}
          title={`${sc.code} — ${sc.label}${sc.hours ? ` (${sc.hours}h)` : ""}`}
        >
          <span className="font-bold">{sc.code}</span>
          <span className="opacity-75 hidden sm:inline">— {sc.label}</span>
        </div>
      ))}
    </div>
  );
}
