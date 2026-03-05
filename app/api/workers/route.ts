import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subdepartment = searchParams.get("subdepartment");

  const all = searchParams.get("all") === "true";

  const workers = await prisma.worker.findMany({
    where: {
      ...(all ? {} : { active: true }),
      ...(subdepartment ? { subdepartment } : {}),
    },
    orderBy: [{ subdepartment: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(workers);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const worker = await prisma.worker.create({ data: body });
    return NextResponse.json(worker, { status: 201 });
  } catch (err) {
    console.error("POST /api/workers error:", err);
    const msg = err instanceof Error && err.message.includes("Unique constraint")
      ? "Ya existe un empleado con ese número de empleado"
      : err instanceof Error ? err.message : "Error al crear empleado";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
