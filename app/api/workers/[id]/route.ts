import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const worker = await prisma.worker.update({ where: { id }, data: body });
  return NextResponse.json(worker);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const worker = await prisma.worker.update({ where: { id }, data: body });
  return NextResponse.json(worker);
}
