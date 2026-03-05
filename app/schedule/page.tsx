"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  ColDef,
  ColGroupDef,
  GridReadyEvent,
  CellValueChangedEvent,
  CellClassParams,
  RowSelectionOptions,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

import { format, eachDayOfInterval, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

import { ShiftCode, ScheduleVersion, GridRow, PendingChange } from "@/types/schedule";
import Legend from "@/components/Legend";
import VersionSelector from "@/components/VersionSelector";

ModuleRegistry.registerModules([AllCommunityModule]);

const FIXED_FIELDS = new Set(["workerName", "employeeNumber", "subdepartment"]);
const TOAST_DURATION = 3000;

export default function SchedulePage() {
  const gridRef = useRef<AgGridReact<GridRow>>(null);
  const [rowData, setRowData] = useState<GridRow[]>([]);
  const [colDefs, setColDefs] = useState<(ColDef<GridRow> | ColGroupDef<GridRow>)[]>([]);
  const [shiftCodes, setShiftCodes] = useState<ShiftCode[]>([]);
  const [codeMap, setCodeMap] = useState<Record<string, ShiftCode>>({});
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [subdepartmentFilter, setSubdepartmentFilter] = useState<string>("");
  const [subdepartments, setSubdepartments] = useState<string[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Bulk apply state
  const [bulkCode, setBulkCode] = useState<string>("");
  const [bulkDateFrom, setBulkDateFrom] = useState<string>("");
  const [bulkDateTo, setBulkDateTo] = useState<string>("");

  const now = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(now), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(now), "yyyy-MM-dd"));

  const codeMapRef = useRef<Record<string, ShiftCode>>({});
  codeMapRef.current = codeMap;

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), TOAST_DURATION);
  }, []);

  // Load shift codes and versions
  useEffect(() => {
    Promise.all([
      fetch("/api/shift-codes").then((r) => r.json()),
      fetch("/api/versions").then((r) => r.json()),
    ]).then(([codes, vers]: [ShiftCode[], ScheduleVersion[]]) => {
      setShiftCodes(codes);
      const map: Record<string, ShiftCode> = {};
      codes.forEach((c) => (map[c.code] = c));
      setCodeMap(map);
      setVersions(vers);
      if (vers.length > 0) setSelectedVersionId(vers[0].id);
    });
  }, []);

  const loadAssignments = useCallback(
    (versionId: string, from: string, to: string, subdept: string) => {
      const params = new URLSearchParams({
        versionId,
        dateFrom: from,
        dateTo: to,
        ...(subdept ? { subdepartment: subdept } : {}),
      });
      fetch(`/api/assignments?${params}`)
        .then((r) => r.json())
        .then((assignments) => {
          const workerMap: Record<string, GridRow> = {};
          const depts = new Set<string>();
          for (const a of assignments) {
            const { worker, shiftCode, date } = a;
            depts.add(worker.subdepartment);
            if (!workerMap[worker.id]) {
              workerMap[worker.id] = {
                workerId: worker.id,
                workerName: worker.name,
                employeeNumber: worker.employeeNumber,
                subdepartment: worker.subdepartment,
              };
            }
            const dateKey = format(parseISO(date), "yyyy-MM-dd");
            workerMap[worker.id][dateKey] = shiftCode.code;
          }
          setSubdepartments(Array.from(depts).sort());
          setRowData(Object.values(workerMap));
          setPendingChanges([]);
        });
    },
    []
  );

  useEffect(() => {
    if (!selectedVersionId) return;
    loadAssignments(selectedVersionId, dateFrom, dateTo, subdepartmentFilter);
  }, [selectedVersionId, dateFrom, dateTo, subdepartmentFilter, loadAssignments]);

  const buildColumns = useCallback(
    (from: string, to: string) => {
      const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });

      const fixedCols: ColDef<GridRow>[] = [
        {
          field: "workerName",
          headerName: "TRABAJADOR",
          pinned: "left",
          width: 200,
          editable: false,
          lockPosition: true,
          cellStyle: { fontWeight: "600", fontSize: "12px" },
        },
        {
          field: "employeeNumber",
          headerName: "N.Emp",
          pinned: "left",
          width: 75,
          editable: false,
          lockPosition: true,
          cellStyle: { fontSize: "11px", color: "#666" },
        },
        {
          field: "subdepartment",
          headerName: "Subdpto.",
          pinned: "left",
          width: 110,
          editable: false,
          lockPosition: true,
          cellStyle: { fontSize: "11px" },
        },
      ];

      const monthGroups: Record<string, { label: string; cols: ColDef<GridRow>[] }> = {};

      for (const d of days) {
        const monthKey = format(d, "yyyy-MM");
        const monthLabel = format(d, "MMMM yyyy", { locale: es });
        const dateKey = format(d, "yyyy-MM-dd");
        const dow = d.getDay();
        const isWeekend = dow === 0 || dow === 6;

        const col: ColDef<GridRow> = {
          field: dateKey,
          headerName: format(d, "d"),
          width: 46,
          editable: true,
          sortable: false,
          headerClass: isWeekend ? "weekend-header" : "",
          valueSetter: (params) => {
            const raw = ((params.newValue ?? "") as string).trim().toUpperCase();
            if (raw && !codeMapRef.current[raw]) return false;
            params.data[dateKey] = raw;
            return true;
          },
          cellStyle: (params: CellClassParams<GridRow>) => {
            const code = params.value as string;
            const sc = codeMapRef.current[code];
            const base = {
              backgroundColor: isWeekend ? "#f5f5f5" : "white",
              color: "#000000",
              fontWeight: "normal",
              fontSize: "11px",
              textAlign: "center" as const,
              padding: "0",
              cursor: "pointer",
            };
            if (sc) {
              return {
                ...base,
                backgroundColor: sc.color,
                color: sc.textColor,
                fontWeight: "bold",
              };
            }
            return base;
          },
          tooltipValueGetter: (p) => {
            const sc = codeMapRef.current[p.value as string];
            return sc ? `${sc.code} — ${sc.label}${sc.hours ? ` (${sc.hours}h)` : ""}` : "";
          },
        };

        if (!monthGroups[monthKey]) {
          monthGroups[monthKey] = {
            label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
            cols: [],
          };
        }
        monthGroups[monthKey].cols.push(col);
      }

      const groupedCols: ColGroupDef<GridRow>[] = Object.values(monthGroups).map((mg) => ({
        headerName: mg.label,
        children: mg.cols,
        marryChildren: true,
      }));

      setColDefs([...fixedCols, ...groupedCols]);
    },
    []
  );

  useEffect(() => {
    if (Object.keys(codeMap).length > 0) {
      buildColumns(dateFrom, dateTo);
    }
  }, [codeMap, buildColumns, dateFrom, dateTo]);

  const onCellValueChanged = useCallback((e: CellValueChangedEvent<GridRow>) => {
    const dateKey = e.colDef.field;
    if (!dateKey || FIXED_FIELDS.has(dateKey)) return;
    const newCode = ((e.newValue as string) ?? "").toUpperCase();
    const oldCode = (e.oldValue as string) ?? "";
    if (newCode === oldCode) return;

    setPendingChanges((prev) => {
      const idx = prev.findIndex(
        (p) => p.workerId === e.data!.workerId && p.date === dateKey
      );
      const change: PendingChange = { workerId: e.data!.workerId, date: dateKey, newCode, oldCode };
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = change;
        return updated;
      }
      return [...prev, change];
    });
  }, []);

  const applyBulkCode = useCallback(() => {
    if (!bulkCode || !bulkDateFrom || !bulkDateTo) {
      showToast("Selecciona código y rango de fechas", "error");
      return;
    }
    const api = gridRef.current?.api;
    if (!api) return;

    const selectedRows = api.getSelectedRows() as GridRow[];
    if (selectedRows.length === 0) {
      showToast("Selecciona al menos una fila primero", "error");
      return;
    }

    const code = bulkCode.toUpperCase();
    if (!codeMapRef.current[code] && code !== "") {
      showToast(`Código desconocido: ${code}`, "error");
      return;
    }

    const days = eachDayOfInterval({
      start: parseISO(bulkDateFrom),
      end: parseISO(bulkDateTo),
    });

    const newChanges: PendingChange[] = [];

    api.forEachNode((node) => {
      if (!node.isSelected()) return;
      const data = node.data as GridRow;
      for (const d of days) {
        const dateKey = format(d, "yyyy-MM-dd");
        const oldCode = (data[dateKey] as string) ?? "";
        if (oldCode !== code) {
          node.setDataValue(dateKey, code);
          newChanges.push({ workerId: data.workerId, date: dateKey, newCode: code, oldCode });
        }
      }
    });

    if (newChanges.length === 0) {
      showToast("No hay cambios que aplicar");
      return;
    }

    setPendingChanges((prev) => {
      const map = new Map(prev.map((c) => [`${c.workerId}|${c.date}`, c]));
      for (const c of newChanges) map.set(`${c.workerId}|${c.date}`, c);
      return Array.from(map.values());
    });

    showToast(`${newChanges.length} celda(s) marcadas con "${code}"`);
  }, [bulkCode, bulkDateFrom, bulkDateTo, showToast]);

  const saveChanges = async () => {
    if (!pendingChanges.length || !selectedVersionId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: selectedVersionId,
          changes: pendingChanges.map((p) => ({
            workerId: p.workerId,
            date: p.date,
            code: p.newCode || null,
            oldCode: p.oldCode,
          })),
          action: "BULK_UPDATE",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPendingChanges([]);
      showToast(`Guardado: ${pendingChanges.length} cambio(s)`);
    } catch (err) {
      showToast("Error al guardar cambios", "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (!selectedVersionId) return;
    loadAssignments(selectedVersionId, dateFrom, dateTo, subdepartmentFilter);
    showToast("Cambios descartados");
  };

  const handleExport = () => {
    const params = new URLSearchParams({
      versionId: selectedVersionId,
      dateFrom,
      dateTo,
      ...(subdepartmentFilter ? { subdepartment: subdepartmentFilter } : {}),
    });
    window.location.href = `/api/export?${params}`;
  };

  const handleCreateVersion = async (data: { name: string; periodStart: string; periodEnd: string }) => {
    const res = await fetch("/api/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, createdBy: "usuario" }),
    });
    if (res.ok) {
      const newVer: ScheduleVersion = await res.json();
      setVersions((prev) => [newVer, ...prev]);
      setSelectedVersionId(newVer.id);
      showToast(`Version "${newVer.name}" creada`);
    }
  };

  const rowSelection = useMemo<RowSelectionOptions>(
    () => ({ mode: "multiRow", checkboxes: true, headerCheckbox: true }),
    []
  );

  const defaultColDef = useMemo<ColDef>(() => ({ resizable: true, suppressHeaderMenuButton: true }), []);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap shadow-sm relative z-10">
        <h1 className="text-lg font-bold text-gray-800">Planificacion de Turnos</h1>

        <div className="flex items-center gap-3 flex-wrap relative">
          {versions.length > 0 && (
            <VersionSelector
              versions={versions}
              selectedId={selectedVersionId}
              onSelect={setSelectedVersionId}
              onCreateVersion={handleCreateVersion}
            />
          )}
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded px-2 py-1 text-sm" />
            <label className="text-xs text-gray-500">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          </div>
          <select className="border rounded px-2 py-1 text-sm" value={subdepartmentFilter} onChange={(e) => setSubdepartmentFilter(e.target.value)}>
            <option value="">Todos los subdepartamentos</option>
            {subdepartments.map((sd) => (<option key={sd} value={sd}>{sd}</option>))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {pendingChanges.length > 0 && (
            <>
              <span className="text-sm text-amber-600 font-medium">{pendingChanges.length} cambio(s) sin guardar</span>
              <button onClick={discardChanges} className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">Descartar</button>
              <button onClick={saveChanges} disabled={saving} className="text-sm px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 font-medium">
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </>
          )}
          <button onClick={handleExport} className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">
            Exportar Excel
          </button>
        </div>
      </header>

      {/* Legend */}
      <div className="px-4 pt-2 pb-1">
        <Legend shiftCodes={shiftCodes} />
      </div>

      {/* Bulk apply toolbar */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 flex-wrap bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <span className="font-semibold text-gray-600 text-xs">APLICAR MASIVO:</span>
          <span className="text-xs text-gray-400">1. Selecciona filas con checkbox</span>
          <span className="text-xs text-gray-400">2. Elige codigo y rango</span>
          <select className="border rounded px-2 py-1 text-sm" value={bulkCode} onChange={(e) => setBulkCode(e.target.value)}>
            <option value="">Codigo...</option>
            {shiftCodes.map((sc) => (<option key={sc.code} value={sc.code}>{sc.code} — {sc.label}</option>))}
          </select>
          <span className="text-xs text-gray-500">del</span>
          <input type="date" value={bulkDateFrom} min={dateFrom} max={dateTo} onChange={(e) => setBulkDateFrom(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <span className="text-xs text-gray-500">al</span>
          <input type="date" value={bulkDateTo} min={dateFrom} max={dateTo} onChange={(e) => setBulkDateTo(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          <button onClick={applyBulkCode} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium">
            Aplicar
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 pb-2 overflow-hidden">
        <div className="ag-theme-alpine h-full w-full rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <AgGridReact<GridRow>
            ref={gridRef}
            rowData={rowData}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            onGridReady={(_p: GridReadyEvent) => {}}
            onCellValueChanged={onCellValueChanged}
            rowSelection={rowSelection}
            animateRows={false}
            undoRedoCellEditing={true}
            undoRedoCellEditingLimit={30}
            stopEditingWhenCellsLoseFocus={true}
            enterNavigatesVertically={true}
            enterNavigatesVerticallyAfterEdit={true}
            tooltipShowDelay={500}
            rowHeight={28}
            headerHeight={32}
            groupHeaderHeight={26}
            getRowId={(params) => params.data.workerId}
          />
        </div>
      </div>

      {/* Help */}
      <div className="px-4 pb-2 text-xs text-gray-400 flex gap-4 flex-wrap">
        <span>Enter / doble clic: editar celda</span>
        <span>Ctrl+C / Ctrl+V: copiar/pegar</span>
        <span>Ctrl+Z / Ctrl+Y: deshacer/rehacer</span>
        <span>Checkbox: seleccion multiple de filas para aplicacion masiva</span>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium z-50 ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
