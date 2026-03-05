import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/assignments?versionId=...&dateFrom=...&dateTo=...&subdepartment=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const versionId = searchParams.get("versionId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const subdepartment = searchParams.get("subdepartment");

  if (!versionId) {
    return NextResponse.json({ error: "versionId required" }, { status: 400 });
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      versionId,
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(subdepartment
        ? { worker: { subdepartment } }
        : {}),
    },
    include: {
      worker: true,
      shiftCode: true,
    },
    orderBy: [{ worker: { subdepartment: "asc" } }, { worker: { name: "asc" } }, { date: "asc" }],
  });

  return NextResponse.json(assignments);
}

// POST /api/assignments — bulk upsert
export async function POST(request: Request) {
  const body = await request.json();
  // body: { versionId, changes: [{workerId, date, shiftCodeId, oldCode?}], changedBy?, action? }
  const { versionId, changes, changedBy = "usuario", action = "BULK_UPDATE" } = body;

  if (!versionId || !Array.isArray(changes)) {
    return NextResponse.json({ error: "versionId and changes required" }, { status: 400 });
  }

  // Fetch shift code IDs by code string if needed
  const allCodes = await prisma.shiftCode.findMany();
  const codeByCode = Object.fromEntries(allCodes.map((c) => [c.code, c]));
  const codeById = Object.fromEntries(allCodes.map((c) => [c.id, c]));

  const results = await prisma.$transaction(
    changes.map((change: { workerId: string; date: string; shiftCodeId?: string; code?: string }) => {
      const shiftCodeId =
        change.shiftCodeId ??
        (change.code ? codeByCode[change.code]?.id : undefined);

      if (!shiftCodeId) throw new Error(`Unknown code: ${change.code}`);

      return prisma.assignment.upsert({
        where: {
          workerId_date_versionId: {
            workerId: change.workerId,
            date: new Date(change.date),
            versionId,
          },
        },
        update: { shiftCodeId },
        create: {
          workerId: change.workerId,
          date: new Date(change.date),
          shiftCodeId,
          versionId,
        },
      });
    })
  );

  // Audit log
  await prisma.auditLog.create({
    data: {
      versionId,
      action,
      changedBy,
      metadata: JSON.stringify({
        count: changes.length,
        changes: changes.map((c: { workerId: string; date: string; shiftCodeId?: string; code?: string; oldCode?: string }) => ({
          workerId: c.workerId,
          date: c.date,
          newCode: c.code ?? codeById[c.shiftCodeId ?? ""]?.code,
          oldCode: c.oldCode,
        })),
      }),
    },
  });

  return NextResponse.json({ updated: results.length });
}
