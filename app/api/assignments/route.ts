import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

// POST /api/assignments — bulk upsert (empty code = delete assignment)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { versionId, changes, changedBy = "usuario", action = "BULK_UPDATE" } = body;

    if (!versionId || !Array.isArray(changes)) {
      return NextResponse.json({ error: "versionId and changes required" }, { status: 400 });
    }

    const allCodes = await prisma.shiftCode.findMany();
    const codeByCode = Object.fromEntries(allCodes.map((c) => [c.code, c]));
    const codeById = Object.fromEntries(allCodes.map((c) => [c.id, c]));

    type Change = { workerId: string; date: string; shiftCodeId?: string; code?: string | null; oldCode?: string };

    // Separate upserts from deletes
    const upsertChanges = changes.filter((c: Change) => c.code && c.code !== "");
    const deleteChanges = changes.filter((c: Change) => !c.code || c.code === "");

    const ops: Prisma.PrismaPromise<unknown>[] = [];

    // Upserts
    for (const change of upsertChanges as Change[]) {
      const shiftCodeId = change.shiftCodeId ?? (change.code ? codeByCode[change.code]?.id : undefined);
      if (!shiftCodeId) {
        return NextResponse.json({ error: `Código desconocido: ${change.code}` }, { status: 400 });
      }
      ops.push(
        prisma.assignment.upsert({
          where: { workerId_date_versionId: { workerId: change.workerId, date: new Date(change.date), versionId } },
          update: { shiftCodeId },
          create: { workerId: change.workerId, date: new Date(change.date), shiftCodeId, versionId },
        })
      );
    }

    // Deletes (clear cell)
    for (const change of deleteChanges as Change[]) {
      ops.push(
        prisma.assignment.deleteMany({
          where: { workerId: change.workerId, date: new Date(change.date), versionId },
        })
      );
    }

    await prisma.$transaction(ops);

    // Audit log
    await prisma.auditLog.create({
      data: {
        versionId,
        action,
        changedBy,
        metadata: JSON.stringify({
          count: changes.length,
          upserted: upsertChanges.length,
          deleted: deleteChanges.length,
          changes: (changes as Change[]).map((c) => ({
            workerId: c.workerId,
            date: c.date,
            newCode: c.code ?? codeById[c.shiftCodeId ?? ""]?.code ?? "",
            oldCode: c.oldCode,
          })),
        }),
      },
    });

    return NextResponse.json({ updated: upsertChanges.length, deleted: deleteChanges.length });
  } catch (err) {
    console.error("POST /api/assignments error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
