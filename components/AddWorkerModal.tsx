"use client";

import { useEffect, useMemo, useState } from "react";
import { Worker } from "@/types/schedule";

interface Props {
  open: boolean;
  onClose: () => void;
  alreadyInGrid: Set<string>;
  onAdd: (workers: Worker[]) => void;
}

export default function AddWorkerModal({ open, onClose, alreadyInGrid, onAdd }: Props) {
  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/workers")
      .then((r) => r.json())
      .then((workers: Worker[]) => {
        setAllWorkers(workers);
        setLoading(false);
      });
    setSearch("");
    setSelected(new Set());
  }, [open]);

  const available = useMemo(
    () =>
      allWorkers.filter(
        (w) =>
          !alreadyInGrid.has(w.id) &&
          (search === "" ||
            w.name.toLowerCase().includes(search.toLowerCase()) ||
            w.subdepartment.toLowerCase().includes(search.toLowerCase()) ||
            w.employeeNumber.toLowerCase().includes(search.toLowerCase()))
      ),
    [allWorkers, alreadyInGrid, search]
  );

  // Group by subdepartment
  const grouped = useMemo(() => {
    const map: Record<string, Worker[]> = {};
    for (const w of available) {
      if (!map[w.subdepartment]) map[w.subdepartment] = [];
      map[w.subdepartment].push(w);
    }
    return map;
  }, [available]);

  const toggleWorker = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (workers: Worker[]) => {
    const ids = workers.map((w) => w.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(available.map((w) => w.id)));
  };

  const handleAdd = () => {
    const toAdd = allWorkers.filter((w) => selected.has(w.id));
    onAdd(toAdd);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-bold text-gray-800">Añadir trabajadores al cuadrante</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b">
          <input
            type="text"
            placeholder="Buscar por nombre, subdpto o nº empleado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {available.length} disponible(s) · {selected.size} seleccionado(s)
            </span>
            {available.length > 0 && (
              <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">
                Seleccionar todos
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading && <p className="text-sm text-gray-400 text-center py-8">Cargando...</p>}
          {!loading && available.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              {allWorkers.length === 0
                ? "No hay trabajadores en la base de datos"
                : "Todos los trabajadores ya están en el cuadrante"}
            </p>
          )}
          {!loading &&
            Object.entries(grouped).map(([subdept, workers]) => {
              const allGroupSelected = workers.every((w) => selected.has(w.id));
              return (
                <div key={subdept} className="mb-4">
                  <div
                    className="flex items-center gap-2 mb-1 cursor-pointer select-none"
                    onClick={() => toggleGroup(workers)}
                  >
                    <input
                      type="checkbox"
                      checked={allGroupSelected}
                      readOnly
                      className="cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      {subdept} ({workers.length})
                    </span>
                  </div>
                  <div className="space-y-1 pl-5">
                    {workers.map((w) => (
                      <label
                        key={w.id}
                        className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(w.id)}
                          onChange={() => toggleWorker(w.id)}
                          className="cursor-pointer"
                        />
                        <span className="text-sm text-gray-800 flex-1">{w.name}</span>
                        <span className="text-xs text-gray-400">{w.employeeNumber}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t">
          <button onClick={onClose} className="text-sm px-4 py-2 border rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={selected.size === 0}
            className="text-sm px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 font-medium"
          >
            Añadir {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
