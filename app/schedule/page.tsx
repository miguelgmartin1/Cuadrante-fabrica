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
  ValueGetterParams,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

import { format, eachDayOfInterval, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

import { ShiftCode, ScheduleVersion, GridRow, PendingChange, Worker } from "@/types/schedule";
import Legend from "@/components/Legend";
import VersionSelector from "@/components/VersionSelector";
import AddWorkerModal from "@/components/AddWorkerModal";

ModuleRegistry.registerModules([AllCommunityModule]);

const FIXED_FIELDS = new Set(["workerName", "employeeNumber", "subdepartment"]);
// horasAusencia is editable, so it's NOT in SUMMARY_FIELDS
const SUMMARY_FIELDS = new Set(["horasTeorDia", "horasTeorica", "pctAbsentismo"]);
const TOAST_DURATION = 3000;
const POLL_INTERVAL = 10_000; // 10 seconds

// Codes that count as worked (theoretical hours)
const WORKING_CODES = new Set(["M", "T", "N", "RM", "RT", "RN", "M-T", "R"]);

function calcHorasTeoricas(row: GridRow, days: string[]): number {
  return days.filter((d) => WORKING_CODES.has(row[d] as string)).length * 8;
}

function calcHorasAusencia(row: GridRow, days: string[]): number {
  return days.filter((d) => {
    const code = row[d] as string;
    return code && !WORKING_CODES.has(code) && code !== "D" && code !== "d";
  }).length * 8;
}

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [daysInRange, setDaysInRange] = useState<string[]>([]);
  const daysInRangeRef = useRef<string[]>([]);

  // Add worker modal
  const [addWorkerOpen, setAddWorkerOpen] = useState(false);
  const [manualWorkers, setManualWorkers] = useState<GridRow[]>([]);
  const workersInGrid = useMemo(() => new Set(rowData.map((r) => r.workerId)), [rowData]);

  const handleAddWorkers = useCallback((workers: Worker[]) => {
    const newRows: GridRow[] = workers.map((w) => ({
      workerId: w.id,
      workerName: w.name,
      employeeNumber: w.employeeNumber,
      subdepartment: w.subdepartment,
    }));
    setManualWorkers((prev) => {
      const existingIds = new Set(prev.map((r) => r.workerId));
      return [...prev, ...newRows.filter((r) => !existingIds.has(r.workerId))];
    });
    setRowData((prev) => {
      const existingIds = new Set(prev.map((r) => r.workerId));
      return [...prev, ...newRows.filter((r) => !existingIds.has(r.workerId))];
    });
    setSubdepartments((prev) => {
      const next = new Set(prev);
      workers.forEach((w) => next.add(w.subdepartment));
      return Array.from(next).sort();
    });
  }, []);

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

  const manualWorkersRef = useRef<GridRow[]>([]);
  manualWorkersRef.current = manualWorkers;

  const pendingChangesRef = useRef<PendingChange[]>([]);
  pendingChangesRef.current = pendingChanges;

  // Build row data from assignments response
  const buildRowData = useCallback(
    (assignments: { worker: Worker; shiftCode: ShiftCode; date: string }[]) => {
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
      // Re-apply any pending local changes on top of the fresh data
      for (const change of pendingChangesRef.current) {
        if (workerMap[change.workerId]) {
          workerMap[change.workerId][change.date] = change.newCode;
        }
      }
      // Re-add manually added workers not in result
      for (const mw of manualWorkersRef.current) {
        if (!workerMap[mw.workerId]) {
          workerMap[mw.workerId] = { ...mw };
          depts.add(mw.subdepartment);
        }
      }
      // Initialize horasAusencia for any row that doesn't have it yet
      const currentDays = daysInRangeRef.current;
      if (currentDays.length > 0) {
        for (const row of Object.values(workerMap)) {
          if (!row.horasAusencia) {
            row.horasAusencia = String(calcHorasAusencia(row, currentDays));
          }
        }
      }
      return { rows: Object.values(workerMap), depts: Array.from(depts).sort() };
    },
    []
  );

  const loadAssignments = useCallback(
    (versionId: string, from: string, to: string, subdept: string, silent = false) => {
      const params = new URLSearchParams({
        versionId,
        dateFrom: from,
        dateTo: to,
        ...(subdept ? { subdepartment: subdept } : {}),
      });
      fetch(`/api/assignments?${params}`)
        .then((r) => r.json())
        .then((assignments) => {
          const { rows, depts } = buildRowData(assignments);
          setSubdepartments(depts);
          setRowData(rows);
          if (!silent) setPendingChanges([]);
          setLastUpdated(new Date());
        });
    },
    [buildRowData]
  );

  useEffect(() => {
    if (!selectedVersionId) return;
    loadAssignments(selectedVersionId, dateFrom, dateTo, subdepartmentFilter);
  }, [selectedVersionId, dateFrom, dateTo, subdepartmentFilter, loadAssignments]);

  // Real-time collaboration: poll every POLL_INTERVAL when there are no pending changes
  const selectedVersionIdRef = useRef(selectedVersionId);
  selectedVersionIdRef.current = selectedVersionId;
  const dateFromRef = useRef(dateFrom);
  dateFromRef.current = dateFrom;
  const dateToRef = useRef(dateTo);
  dateToRef.current = dateTo;
  const subdeptFilterRef = useRef(subdepartmentFilter);
  subdeptFilterRef.current = subdepartmentFilter;

  useEffect(() => {
    const interval = setInterval(() => {
      if (!selectedVersionIdRef.current) return;
      // Only silent-poll if user has no pending changes
      if (pendingChangesRef.current.length > 0) return;
      loadAssignments(
        selectedVersionIdRef.current,
        dateFromRef.current,
        dateToRef.current,
        subdeptFilterRef.current,
        true
      );
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [loadAssignments]);

  // Pinned bottom (totals) row
  const pinnedBottomRowData = useMemo<GridRow[]>(() => {
    if (rowData.length === 0) return [];
    const totals: GridRow = {
      workerId: "__totals__",
      workerName: "TOTAL",
      employeeNumber: "",
      subdepartment: "",
    };
    // Sum all date keys
    for (const row of rowData) {
      for (const [key, value] of Object.entries(row)) {
        if (FIXED_FIELDS.has(key) || key === "workerId" || SUMMARY_FIELDS.has(key)) continue;
        if (value && value !== "") {
          // We just mark existence; actual totals are via valueGetter
          totals[key] = (totals[key] as string) || "";
        }
      }
    }
    return [totals];
  }, [rowData]);

  const buildColumns = useCallback(
    (from: string, to: string) => {
      const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
      const dayKeys = days.map((d) => format(d, "yyyy-MM-dd"));
      daysInRangeRef.current = dayKeys;
      setDaysInRange(dayKeys);

      const fixedCols: ColDef<GridRow>[] = [
        {
          field: "workerName",
          headerName: "TRABAJADOR",
          pinned: "left",
          width: 200,
          editable: false,
          lockPosition: true,
          cellStyle: (p) => {
            const isTotal = p.data?.workerId === "__totals__";
            return {
              fontWeight: "bold",
              fontSize: "12px",
              background: isTotal ? "#1e293b" : "white",
              color: isTotal ? "#fff" : "#111827",
            };
          },
        },
        {
          field: "employeeNumber",
          headerName: "N.Emp",
          pinned: "left",
          width: 75,
          editable: false,
          lockPosition: true,
          cellStyle: (p) => {
            const isTotal = p.data?.workerId === "__totals__";
            return {
              fontSize: "11px",
              color: isTotal ? "#fff" : "#666",
              background: isTotal ? "#1e293b" : "white",
            };
          },
        },
        {
          field: "subdepartment",
          headerName: "Subdpto.",
          pinned: "left",
          width: 110,
          editable: false,
          lockPosition: true,
          cellStyle: (p) => {
            const isTotal = p.data?.workerId === "__totals__";
            return {
              fontSize: "11px",
              background: isTotal ? "#1e293b" : "white",
              color: isTotal ? "#fff" : "#374151",
            };
          },
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
          editable: (p) => p.data?.workerId !== "__totals__",
          sortable: false,
          headerClass: isWeekend ? "weekend-header" : "",
          valueSetter: (params) => {
            if (params.data.workerId === "__totals__") return false;
            const raw = ((params.newValue ?? "") as string).trim().toUpperCase();
            if (raw && !codeMapRef.current[raw]) return false;
            params.data[dateKey] = raw;
            return true;
          },
          cellStyle: (params: CellClassParams<GridRow>) => {
            if (params.data?.workerId === "__totals__") {
              return {
                backgroundColor: "#1e293b",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "10px",
                textAlign: "center" as const,
                padding: "0",
              };
            }
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
              return { ...base, backgroundColor: sc.color, color: sc.textColor, fontWeight: "bold" };
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

      // Summary columns (pinned right)
      const summaryCols: ColDef<GridRow>[] = [
        {
          colId: "horasTeorDia",
          field: "horasTeorDia",
          headerName: "H.TEÓR/DÍA",
          pinned: "right",
          width: 80,
          editable: false,
          sortable: false,
          valueGetter: () => 8,
          cellStyle: (p) => ({
            textAlign: "center" as const,
            fontSize: "11px",
            fontWeight: "bold",
            background: p.data?.workerId === "__totals__" ? "#1e293b" : "#f8fafc",
            color: p.data?.workerId === "__totals__" ? "#fff" : "#334155",
            borderLeft: "2px solid #cbd5e1",
          }),
        },
        {
          colId: "horasTeorica",
          field: "horasTeorica",
          headerName: "HORAS TEÓRICAS",
          pinned: "right",
          width: 100,
          editable: false,
          sortable: false,
          valueGetter: (p: ValueGetterParams<GridRow>) => {
            if (!p.data) return 0;
            if (p.data.workerId === "__totals__") {
              // Sum all rows via the grid API - use raw data sum instead
              return null; // calculated separately via pinnedBottomRowData
            }
            return calcHorasTeoricas(p.data, dayKeys);
          },
          cellStyle: (p) => ({
            textAlign: "center" as const,
            fontSize: "11px",
            fontWeight: "bold",
            background: p.data?.workerId === "__totals__" ? "#1e293b" : "#f0fdf4",
            color: p.data?.workerId === "__totals__" ? "#fff" : "#166534",
          }),
        },
        {
          field: "horasAusencia",
          headerName: "HORAS AUSENCIA",
          pinned: "right",
          width: 105,
          editable: (p) => p.data?.workerId !== "__totals__",
          sortable: false,
          valueSetter: (params) => {
            if (params.data.workerId === "__totals__") return false;
            const val = parseFloat(params.newValue as string);
            if (isNaN(val) || val < 0) return false;
            params.data.horasAusencia = String(val);
            return true;
          },
          cellStyle: (p) => ({
            textAlign: "center" as const,
            fontSize: "11px",
            fontWeight: "bold",
            background: p.data?.workerId === "__totals__" ? "#1e293b" : "#fef9c3",
            color: p.data?.workerId === "__totals__" ? "#fff" : "#854d0e",
            cursor: p.data?.workerId !== "__totals__" ? "pointer" : "default",
          }),
        },
        {
          colId: "pctAbsentismo",
          field: "pctAbsentismo",
          headerName: "% ABSENTISMO",
          pinned: "right",
          width: 100,
          editable: false,
          sortable: false,
          valueGetter: (p: ValueGetterParams<GridRow>) => {
            if (!p.data || p.data.workerId === "__totals__") return null;
            const teoricas = calcHorasTeoricas(p.data, dayKeys);
            const ausencia = parseFloat((p.data.horasAusencia as string) || "0");
            if (teoricas === 0) return null;
            return ((ausencia / teoricas) * 100).toFixed(2) + "%";
          },
          cellStyle: (p) => {
            const val = p.value as string;
            const pct = val ? parseFloat(val) : 0;
            let bg = "#f0fdf4";
            let color = "#166534";
            if (pct > 10) { bg = "#fef2f2"; color = "#991b1b"; }
            else if (pct > 5) { bg = "#fff7ed"; color = "#9a3412"; }
            if (p.data?.workerId === "__totals__") { bg = "#1e293b"; color = "#fff"; }
            return { textAlign: "center" as const, fontSize: "11px", fontWeight: "bold", background: bg, color };
          },
        },
      ];

      setColDefs([...fixedCols, ...groupedCols, ...summaryCols]);
    },
    []
  );

  useEffect(() => {
    if (Object.keys(codeMap).length > 0) {
      buildColumns(dateFrom, dateTo);
    }
  }, [codeMap, buildColumns, dateFrom, dateTo]);

  // Compute pinned totals row dynamically
  const computedPinnedRow = useMemo<GridRow[]>(() => {
    if (rowData.length === 0 || daysInRange.length === 0) return [];
    const totalHorasTeorica = rowData.reduce((sum, row) => sum + calcHorasTeoricas(row, daysInRange), 0);
    const totalHorasAusencia = rowData.reduce(
      (sum, row) => sum + parseFloat((row.horasAusencia as string) || "0"),
      0
    );
    const totalPct = totalHorasTeorica > 0
      ? ((totalHorasAusencia / totalHorasTeorica) * 100).toFixed(2) + "%"
      : "0.00%";

    const totalsRow: GridRow = {
      workerId: "__totals__",
      workerName: `TOTAL (${rowData.length} empleados)`,
      employeeNumber: "",
      subdepartment: "",
      horasTeorDia: "8",
      horasTeorica: String(totalHorasTeorica),
      horasAusencia: String(totalHorasAusencia),
      pctAbsentismo: totalPct,
    };
    return [totalsRow];
  }, [rowData, daysInRange]);

  const onCellValueChanged = useCallback((e: CellValueChangedEvent<GridRow>) => {
    const field = e.colDef.field;
    if (!field || FIXED_FIELDS.has(field)) return;

    // HORAS AUSENCIA edit: update rowData so computedPinnedRow and pctAbsentismo refresh
    if (field === "horasAusencia") {
      const val = parseFloat(e.newValue as string);
      if (!isNaN(val) && val >= 0) {
        setRowData((prev) =>
          prev.map((r) =>
            r.workerId === e.data!.workerId ? { ...r, horasAusencia: String(val) } : r
          )
        );
        // Refresh pctAbsentismo for this row
        setTimeout(() => {
          gridRef.current?.api.refreshCells({ rowNodes: [e.node!], columns: ["pctAbsentismo"] });
        }, 0);
      }
      return; // not a DB-level change, don't add to pendingChanges
    }

    // Read-only summary fields
    if (SUMMARY_FIELDS.has(field)) return;

    // Day cell change
    const dateKey = field;
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
    if (!pendingChanges.length) return;
    setSaving(true);
    try {
      // Auto-create a default version if none exists
      let versionId = selectedVersionId;
      if (!versionId) {
        const vRes = await fetch("/api/versions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Cuadrante ${format(parseISO(dateFrom), "MMMM yyyy", { locale: es })}`,
            periodStart: dateFrom,
            periodEnd: dateTo,
            createdBy: "usuario",
          }),
        });
        if (!vRes.ok) throw new Error("No se pudo crear la versión");
        const newVer: ScheduleVersion = await vRes.json();
        setVersions((prev) => [newVer, ...prev]);
        setSelectedVersionId(newVer.id);
        versionId = newVer.id;
      }

      const total = pendingChanges.length;
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId,
          changes: pendingChanges.map((p) => ({
            workerId: p.workerId,
            date: p.date,
            code: p.newCode || null,
            oldCode: p.oldCode,
          })),
          action: "BULK_UPDATE",
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(async () => ({ error: await res.text() }));
        throw new Error(errData.error || "Error desconocido");
      }
      setPendingChanges([]);
      setManualWorkers([]);
      showToast(`✓ Guardado: ${total} cambio(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      showToast(`Error: ${msg}`, "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    if (!selectedVersionId) return;
    setManualWorkers([]);
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
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap shadow-sm relative z-10">
        <h1 className="text-lg font-bold text-gray-800">Planificacion de Turnos</h1>

        <div className="flex items-center gap-3 flex-wrap relative">
          <VersionSelector
            versions={versions}
            selectedId={selectedVersionId}
            onSelect={setSelectedVersionId}
            onCreateVersion={handleCreateVersion}
          />
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
          <button
            onClick={() => setAddWorkerOpen(true)}
            className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            + Añadir trabajador
          </button>
          {pendingChanges.length > 0 && (
            <span className="text-sm text-amber-600 font-medium">{pendingChanges.length} cambio(s) sin guardar</span>
          )}
          <button
            onClick={discardChanges}
            disabled={pendingChanges.length === 0}
            className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Descartar
          </button>
          <button
            onClick={saveChanges}
            disabled={saving || pendingChanges.length === 0}
            className="text-sm px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            {saving ? "Guardando..." : `Guardar${pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ""}`}
          </button>
          <button onClick={handleExport} className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50">
            Exportar Excel
          </button>
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Act: {format(lastUpdated, "HH:mm:ss")}
            </span>
          )}
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
            pinnedBottomRowData={computedPinnedRow}
          />
        </div>
      </div>

      {/* Help */}
      <div className="px-4 pb-2 text-xs text-gray-400 flex gap-4 flex-wrap">
        <span>Enter / doble clic: editar celda</span>
        <span>Ctrl+C / Ctrl+V: copiar/pegar</span>
        <span>Ctrl+Z / Ctrl+Y: deshacer/rehacer</span>
        <span>Checkbox: seleccion multiple de filas para aplicacion masiva</span>
        <span className="text-green-600 font-medium">Actualización automática cada 10s</span>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium z-50 ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}

      {/* Add Worker Modal */}
      <AddWorkerModal
        open={addWorkerOpen}
        onClose={() => setAddWorkerOpen(false)}
        alreadyInGrid={workersInGrid}
        onAdd={handleAddWorkers}
      />
    </div>
  );
}
