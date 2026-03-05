import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const codes = await prisma.shiftCode.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(codes);
}

export async function POST(request: Request) {
  const body = await request.json();
  const code = await prisma.shiftCode.create({ data: body });
  return NextResponse.json(code, { status: 201 });
}
