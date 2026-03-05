"use client";

import { useState } from "react";
import { ScheduleVersion } from "@/types/schedule";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  versions: ScheduleVersion[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreateVersion: (data: { name: string; periodStart: string; periodEnd: string }) => void;
}

export default function VersionSelector({ versions, selectedId, onSelect, onCreateVersion }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const handleCreate = () => {
    if (!name || !periodStart || !periodEnd) return;
    onCreateVersion({ name, periodStart, periodEnd });
    setShowCreate(false);
    setName("");
    setPeriodStart("");
    setPeriodEnd("");
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700">Versión:</label>
      <select
        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
      >
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name} ({v.status})
          </option>
        ))}
      </select>
      <button
        onClick={() => setShowCreate(!showCreate)}
        className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        + Nueva versión
      </button>

      {showCreate && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-white shadow-xl border border-gray-200 rounded-lg p-4 w-80">
          <h3 className="font-semibold mb-3">Nueva versión</h3>
          <div className="space-y-2">
            <input
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Nombre (ej. Enero 2025)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex gap-2">
              <div>
                <label className="text-xs text-gray-500">Inicio</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Fin</label>
                <input
                  type="date"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCreate}
                className="flex-1 bg-blue-600 text-white rounded px-3 py-1 text-sm hover:bg-blue-700"
              >
                Crear
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 border rounded px-3 py-1 text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
