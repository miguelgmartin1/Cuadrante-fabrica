import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const worker = await prisma.worker.update({ where: { id }, data: body });
    return NextResponse.json(worker);
  } catch (err) {
    console.error("PUT /api/workers/[id] error:", err);
    const msg = err instanceof Error && err.message.includes("Unique constraint")
      ? "Ya existe un empleado con ese número de empleado"
      : err instanceof Error ? err.message : "Error al actualizar empleado";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const worker = await prisma.worker.update({ where: { id }, data: body });
    return NextResponse.json(worker);
  } catch (err) {
    console.error("PATCH /api/workers/[id] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 400 });
  }
}
