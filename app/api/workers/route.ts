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
  const body = await request.json();
  const worker = await prisma.worker.create({ data: body });
  return NextResponse.json(worker, { status: 201 });
}
