"use client";

import { useCallback, useEffect, useState } from "react";
import { ShiftCode } from "@/types/schedule";

const EMPTY_FORM = {
  code: "",
  label: "",
  color: "#ffffff",
  textColor: "#000000",
  isWorkDay: true,
  hours: "",
  sortOrder: "0",
};

type FormData = typeof EMPTY_FORM;

export default function ShiftCodesPage() {
  const [codes, setCodes] = useState<ShiftCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftCode | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadCodes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/shift-codes");
    const data = await res.json();
    setCodes(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (sc: ShiftCode) => {
    setEditing(sc);
    setForm({
      code: sc.code,
      label: sc.label,
      color: sc.color,
      textColor: sc.textColor,
      isWorkDay: sc.isWorkDay,
      hours: sc.hours != null ? String(sc.hours) : "",
      sortOrder: String(sc.sortOrder),
    });
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.label.trim()) {
      setError("Código y etiqueta son obligatorios.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        code: form.code.trim().toUpperCase(),
        label: form.label.trim(),
        color: form.color,
        textColor: form.textColor,
        isWorkDay: form.isWorkDay,
        hours: form.hours !== "" ? parseFloat(form.hours) : null,
        sortOrder: parseInt(form.sortOrder) || 0,
      };
      let res: Response;
      if (editing) {
        res = await fetch(`/api/shift-codes/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        res = await fetch("/api/shift-codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error al guardar");
      }
      await loadCodes();
      setModalOpen(false);
      showToast(editing ? "Código actualizado" : "Código creado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-3 shadow-sm">
        <h1 className="text-base font-bold text-gray-800">Tipos de turno</h1>
        <button onClick={openNew} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700">
          + Nuevo código
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <p className="text-sm text-gray-400 mt-8 text-center">Cargando...</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Vista previa</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Código</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Etiqueta</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Horas</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Día laboral</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Orden</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {codes.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">No hay códigos de turno</td></tr>
                )}
                {codes.map((sc) => (
                  <tr key={sc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center justify-center w-10 h-7 rounded font-bold text-sm"
                        style={{ backgroundColor: sc.color, color: sc.textColor }}
                      >
                        {sc.code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-gray-800">{sc.code}</td>
                    <td className="px-4 py-2.5 text-gray-700">{sc.label}</td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{sc.hours != null ? `${sc.hours}h` : "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sc.isWorkDay ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {sc.isWorkDay ? "Sí" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{sc.sortOrder}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => openEdit(sc)} className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-700">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
              {codes.length} código(s)
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{editing ? "Editar código" : "Nuevo código de turno"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Código * (ej: M, T, N)</label>
                  <input
                    className="w-full border rounded px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="M"
                    maxLength={6}
                    disabled={!!editing}
                  />
                  {editing && <p className="text-xs text-gray-400 mt-0.5">El código no se puede cambiar</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Orden</label>
                  <input
                    type="number"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Etiqueta *</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Ej: Mañana, Tarde, Noche, Descanso..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Color de fondo</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-12 border rounded cursor-pointer"
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    />
                    <input
                      className="flex-1 border rounded px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.color}
                      onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Color de texto</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-12 border rounded cursor-pointer"
                      value={form.textColor}
                      onChange={(e) => setForm((f) => ({ ...f, textColor: e.target.value }))}
                    />
                    <input
                      className="flex-1 border rounded px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={form.textColor}
                      onChange={(e) => setForm((f) => ({ ...f, textColor: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Vista previa:</span>
                <span
                  className="inline-flex items-center justify-center w-12 h-8 rounded font-bold text-sm"
                  style={{ backgroundColor: form.color, color: form.textColor }}
                >
                  {form.code || "??"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Horas (opcional)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.hours}
                    onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                    placeholder="Ej: 7.5"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isWorkDay}
                      onChange={(e) => setForm((f) => ({ ...f, isWorkDay: e.target.checked }))}
                      className="accent-blue-600 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">Es día laboral</span>
                  </label>
                </div>
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium">
                  {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear código"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium z-50 ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
