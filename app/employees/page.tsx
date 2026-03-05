"use client";

import { useCallback, useEffect, useState } from "react";
import { Worker } from "@/types/schedule";

const EMPTY_FORM = { name: "", employeeNumber: "", subdepartment: "", position: "", active: true };

type FormData = typeof EMPTY_FORM;

export default function EmployeesPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("active");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/workers?all=true");
    const data = await res.json();
    setWorkers(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (w: Worker) => {
    setEditing(w);
    setForm({ name: w.name, employeeNumber: w.employeeNumber, subdepartment: w.subdepartment, position: w.position ?? "", active: w.active });
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.employeeNumber.trim() || !form.subdepartment.trim()) {
      setError("Nombre, número de empleado y subdepartamento son obligatorios.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = { ...form, position: form.position || null };
      let res: Response;
      if (editing) {
        res = await fetch(`/api/workers/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        res = await fetch("/api/workers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Error al guardar");
      }
      await loadWorkers();
      setModalOpen(false);
      showToast(editing ? "Empleado actualizado" : "Empleado creado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (w: Worker) => {
    try {
      const res = await fetch(`/api/workers/${w.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !w.active }) });
      if (!res.ok) throw new Error();
      await loadWorkers();
      showToast(w.active ? `${w.name} desactivado` : `${w.name} activado`);
    } catch {
      showToast("Error al cambiar estado", "error");
    }
  };

  const filtered = workers.filter((w) => {
    if (filterActive === "active") return w.active;
    if (filterActive === "inactive") return !w.active;
    return true;
  });

  const subdepartments = Array.from(new Set(workers.map((w) => w.subdepartment))).sort();

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-3 flex-wrap shadow-sm">
        <h1 className="text-base font-bold text-gray-800">Empleados</h1>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as typeof filterActive)}
          >
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
            <option value="all">Todos</option>
          </select>
          <button onClick={openNew} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700">
            + Nuevo empleado
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <p className="text-sm text-gray-400 mt-8 text-center">Cargando...</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">N.Emp</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Subdepartamento</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Cargo</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No hay empleados</td></tr>
                )}
                {filtered.map((w) => (
                  <tr key={w.id} className={`hover:bg-gray-50 ${!w.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{w.employeeNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{w.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{w.subdepartment}</td>
                    <td className="px-4 py-2.5 text-gray-500">{w.position ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${w.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {w.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(w)} className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-700">
                          Editar
                        </button>
                        <button
                          onClick={() => toggleActive(w)}
                          className={`text-xs px-2.5 py-1 rounded border font-medium ${w.active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
                        >
                          {w.active ? "Desactivar" : "Activar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
              {filtered.length} empleado(s) · {workers.filter((w) => w.active).length} activos en total
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{editing ? "Editar empleado" : "Nuevo empleado"}</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Número de empleado *</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.employeeNumber}
                  onChange={(e) => setForm((f) => ({ ...f, employeeNumber: e.target.value }))}
                  placeholder="Ej: 00123"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo *</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: María García López"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Subdepartamento *</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.subdepartment}
                  onChange={(e) => setForm((f) => ({ ...f, subdepartment: e.target.value }))}
                  list="subdept-list"
                  placeholder="Ej: Urgencias"
                />
                <datalist id="subdept-list">
                  {subdepartments.map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cargo (opcional)</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  placeholder="Ej: Enfermera"
                />
              </div>
              {editing && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active-check"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  <label htmlFor="active-check" className="text-sm text-gray-700">Empleado activo</label>
                </div>
              )}
              {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium">
                  {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear empleado"}
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
