import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const versions = await prisma.scheduleVersion.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(versions);
}

export async function POST(request: Request) {
  const body = await request.json();
  const version = await prisma.scheduleVersion.create({
    data: {
      ...body,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    },
  });

  await prisma.auditLog.create({
    data: {
      versionId: version.id,
      action: "VERSION_CREATED",
      changedBy: body.createdBy ?? "usuario",
    },
  });

  return NextResponse.json(version, { status: 201 });
}
