import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { format, eachDayOfInterval } from "date-fns";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get("versionId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const subdepartment = searchParams.get("subdepartment");

  if (!versionId) {
    return NextResponse.json({ error: "versionId required" }, { status: 400 });
  }

  const version = await prisma.scheduleVersion.findUnique({ where: { id: versionId } });
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  const from = dateFrom ? new Date(dateFrom) : version.periodStart;
  const to = dateTo ? new Date(dateTo) : version.periodEnd;

  const assignments = await prisma.assignment.findMany({
    where: {
      versionId,
      date: { gte: from, lte: to },
      ...(subdepartment ? { worker: { subdepartment } } : {}),
    },
    include: { worker: true, shiftCode: true },
    orderBy: [
      { worker: { subdepartment: "asc" } },
      { worker: { name: "asc" } },
      { date: "asc" },
    ],
  });

  const allCodes = await prisma.shiftCode.findMany();

  // Build lookup: workerId -> date -> code
  const lookup: Record<string, Record<string, { code: string; color: string; textColor: string }>> = {};
  for (const a of assignments) {
    if (!lookup[a.workerId]) lookup[a.workerId] = {};
    const dateKey = format(a.date, "yyyy-MM-dd");
    lookup[a.workerId][dateKey] = {
      code: a.shiftCode.code,
      color: a.shiftCode.color.replace("#", ""),
      textColor: a.shiftCode.textColor.replace("#", ""),
    };
  }

  // Unique workers in order
  const seenWorkers = new Map<string, { id: string; name: string; subdepartment: string }>();
  for (const a of assignments) {
    if (!seenWorkers.has(a.workerId)) {
      seenWorkers.set(a.workerId, {
        id: a.worker.id,
        name: a.worker.name,
        subdepartment: a.worker.subdepartment,
      });
    }
  }
  const workers = Array.from(seenWorkers.values());

  const days = eachDayOfInterval({ start: from, end: to });

  // Build Excel
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ShiftPlanner";
  const sheet = workbook.addWorksheet(version.name.slice(0, 31), {
    views: [{ state: "frozen", xSplit: 3, ySplit: 2 }],
  });

  // Header row 1: month groups
  const headerRow1: (string | null)[] = ["TRABAJADOR", "N. Empleado", "Subdepartamento"];
  const monthGroups: { month: string; count: number }[] = [];
  for (const d of days) {
    const m = format(d, "MMMM yyyy");
    if (monthGroups.length === 0 || monthGroups[monthGroups.length - 1].month !== m) {
      monthGroups.push({ month: m, count: 1 });
    } else {
      monthGroups[monthGroups.length - 1].count++;
    }
    headerRow1.push(null);
  }

  const row1 = sheet.addRow(headerRow1);
  row1.height = 20;
  // Merge month headers
  let colOffset = 4;
  for (const mg of monthGroups) {
    if (mg.count > 1) {
      sheet.mergeCells(1, colOffset, 1, colOffset + mg.count - 1);
    }
    const cell = sheet.getCell(1, colOffset);
    cell.value = mg.month.charAt(0).toUpperCase() + mg.month.slice(1);
    cell.alignment = { horizontal: "center" };
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4BC" } };
    colOffset += mg.count;
  }

  // Header row 2: column labels
  const headerRow2: string[] = ["TRABAJADOR", "N. Empleado", "Subdepartamento"];
  for (const d of days) {
    headerRow2.push(format(d, "d"));
  }
  const row2 = sheet.addRow(headerRow2);
  row2.height = 20;
  row2.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB8CCE4" } };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Sub-header: day of week
  const headerRow3: string[] = ["", "", ""];
  for (const d of days) {
    headerRow3.push(format(d, "EEE").toUpperCase());
  }
  const row3 = sheet.addRow(headerRow3);
  row3.height = 16;
  row3.eachCell((cell) => {
    cell.font = { bold: false, size: 8 };
    cell.alignment = { horizontal: "center" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
  });

  // Data rows
  for (const worker of workers) {
    const rowData: (string | null)[] = [worker.name, "", worker.subdepartment];
    for (const d of days) {
      const dateKey = format(d, "yyyy-MM-dd");
      rowData.push(lookup[worker.id]?.[dateKey]?.code ?? "");
    }
    const dataRow = sheet.addRow(rowData);
    dataRow.height = 18;

    // Style worker name columns
    dataRow.getCell(1).font = { bold: false };
    dataRow.getCell(3).font = { size: 9 };

    // Color cells
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      const dateKey = format(d, "yyyy-MM-dd");
      const info = lookup[worker.id]?.[dateKey];
      const cell = dataRow.getCell(4 + i);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { bold: true, size: 9, color: { argb: "FF" + (info?.textColor ?? "000000") } };
      if (info) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF" + info.color },
        };
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      };

      // Highlight weekends
      const dow = d.getDay();
      if ((dow === 0 || dow === 6) && !info) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
      }
    }
  }

  // Legend sheet
  const legendSheet = workbook.addWorksheet("Leyenda");
  legendSheet.addRow(["Código", "Descripción", "Horas", "¿Día laboral?"]);
  legendSheet.getRow(1).font = { bold: true };
  for (const sc of allCodes) {
    const r = legendSheet.addRow([sc.code, sc.label, sc.hours ?? 0, sc.isWorkDay ? "Sí" : "No"]);
    r.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF" + sc.color.replace("#", "") },
    };
    r.getCell(1).font = { color: { argb: "FF" + sc.textColor.replace("#", "") } };
  }

  // Column widths
  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 16;
  for (let i = 4; i <= 3 + days.length; i++) {
    sheet.getColumn(i).width = 5;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `cuadrante_${format(from, "yyyyMMdd")}_${format(to, "yyyyMMdd")}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
