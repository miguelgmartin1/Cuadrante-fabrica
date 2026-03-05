"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ShiftCode } from "@/types/schedule";

interface Props {
  value: string;
  shiftCodes: ShiftCode[];
  onValueChange: (val: string) => void;
  stopEditing: () => void;
}

// AG Grid custom cell editor
const ShiftCodeEditor = forwardRef<unknown, Props>(
  ({ value, shiftCodes, onValueChange, stopEditing }, ref) => {
    const [selected, setSelected] = useState(value ?? "");
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      getValue: () => selected,
      isCancelBeforeStart: () => false,
      isCancelAfterEnd: () => false,
    }));

    useEffect(() => {
      containerRef.current?.focus();
    }, []);

    const pick = (code: string) => {
      setSelected(code);
      onValueChange(code);
      stopEditing();
    };

    return (
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Escape") stopEditing();
          // quick keyboard shortcut: type the code directly
          const match = shiftCodes.find(
            (sc) => sc.code.toLowerCase() === e.key.toLowerCase()
          );
          if (match) pick(match.code);
        }}
        className="absolute z-50 bg-white border border-gray-300 shadow-lg rounded p-1 grid grid-cols-3 gap-1 min-w-[200px]"
        style={{ top: 0, left: 0 }}
      >
        {shiftCodes.map((sc) => (
          <button
            key={sc.code}
            onClick={() => pick(sc.code)}
            title={sc.label}
            className="text-xs font-bold px-2 py-1 rounded border hover:opacity-80 transition-opacity cursor-pointer"
            style={{
              backgroundColor: sc.color,
              color: sc.textColor,
              borderColor: sc.color,
            }}
          >
            {sc.code}
          </button>
        ))}
        <button
          onClick={() => pick("")}
          className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 col-span-3"
        >
          Borrar
        </button>
      </div>
    );
  }
);

ShiftCodeEditor.displayName = "ShiftCodeEditor";
export default ShiftCodeEditor;
