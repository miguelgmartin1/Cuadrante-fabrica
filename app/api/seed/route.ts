import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/seed  — seeds the database if empty
// Protected by SEED_SECRET env var (set it in Vercel dashboard)
export async function POST(req: Request) {
  const secret = process.env.SEED_SECRET;
  if (secret) {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("secret") !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Check if already seeded
  const count = await prisma.worker.count();
  if (count > 0) {
    return NextResponse.json({ message: "Ya hay datos. No se ha vuelto a sembrar.", workers: count });
  }

  // Seed shift codes
  const shiftCodes = [
    { code: "M",   label: "Mañana",               color: "#FFF9C4", textColor: "#000000", isWorkDay: true,  hours: 8, sortOrder: 1  },
    { code: "T",   label: "Tarde",                color: "#FFF3E0", textColor: "#000000", isWorkDay: true,  hours: 8, sortOrder: 2  },
    { code: "N",   label: "Noche",                color: "#E3F2FD", textColor: "#000000", isWorkDay: true,  hours: 8, sortOrder: 3  },
    { code: "D",   label: "Descanso",             color: "#F3E5F5", textColor: "#6A1B9A", isWorkDay: false, hours: 0, sortOrder: 4  },
    { code: "R",   label: "Recuperación",         color: "#E8F5E9", textColor: "#1B5E20", isWorkDay: false, hours: 0, sortOrder: 5  },
    { code: "VAC", label: "Vacaciones",           color: "#E0F7FA", textColor: "#006064", isWorkDay: false, hours: 0, sortOrder: 6  },
    { code: "IT",  label: "Incapacidad Temporal", color: "#FCE4EC", textColor: "#880E4F", isWorkDay: false, hours: 0, sortOrder: 7  },
    { code: "L",   label: "Libre",                color: "#ECEFF1", textColor: "#37474F", isWorkDay: false, hours: 0, sortOrder: 8  },
    { code: "P",   label: "Permiso",              color: "#FFF8E1", textColor: "#FF6F00", isWorkDay: false, hours: 0, sortOrder: 9  },
    { code: "F",   label: "Festivo",              color: "#EDE7F6", textColor: "#4527A0", isWorkDay: false, hours: 0, sortOrder: 10 },
  ];

  for (const sc of shiftCodes) {
    await prisma.shiftCode.upsert({ where: { code: sc.code }, update: sc, create: sc });
  }

  // Seed workers
  const workers = [
    { name: "Ana García López",         employeeNumber: "EMP001", subdepartment: "Producción A",  position: "Operaria"    },
    { name: "Carlos Martínez Ruiz",     employeeNumber: "EMP002", subdepartment: "Producción A",  position: "Operario"    },
    { name: "María Fernández Díaz",     employeeNumber: "EMP003", subdepartment: "Producción B",  position: "Operaria"    },
    { name: "José López García",        employeeNumber: "EMP004", subdepartment: "Producción B",  position: "Operario"    },
    { name: "Laura Sánchez Pérez",      employeeNumber: "EMP005", subdepartment: "Mantenimiento", position: "Técnica"     },
    { name: "Pedro González Romero",    employeeNumber: "EMP006", subdepartment: "Mantenimiento", position: "Técnico"     },
    { name: "Isabel Torres Moreno",     employeeNumber: "EMP007", subdepartment: "Producción A",  position: "Supervisora" },
    { name: "Antonio Ramírez Jiménez",  employeeNumber: "EMP008", subdepartment: "Producción B",  position: "Operario"    },
    { name: "Carmen Álvarez Muñoz",     employeeNumber: "EMP009", subdepartment: "Calidad",       position: "Técnica"     },
    { name: "Francisco Herrera Castillo", employeeNumber: "EMP010", subdepartment: "Calidad",     position: "Técnico"     },
  ];

  const createdWorkers = [];
  for (const w of workers) {
    const worker = await prisma.worker.upsert({
      where: { employeeNumber: w.employeeNumber },
      update: w,
      create: w,
    });
    createdWorkers.push(worker);
  }

  // Create schedule version for current month
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const version = await prisma.scheduleVersion.upsert({
    where: { id: "seed-version-1" },
    update: {},
    create: {
      id: "seed-version-1",
      name: `Cuadrante ${periodStart.toLocaleString("es-ES", { month: "long", year: "numeric" })}`,
      description: "Versión inicial",
      periodStart,
      periodEnd,
      status: "DRAFT",
      createdBy: "sistema",
    },
  });

  // Seed sample assignments
  const allCodes = await prisma.shiftCode.findMany();
  const codeMap = Object.fromEntries(allCodes.map((c) => [c.code, c.id]));
  const pattern = ["M", "M", "T", "T", "N", "N", "D", "D"];

  for (let wi = 0; wi < createdWorkers.length; wi++) {
    const worker = createdWorkers[wi];
    const d = new Date(periodStart);
    while (d <= periodEnd) {
      const code = pattern[(d.getDate() - 1 + wi) % pattern.length];
      const shiftCodeId = codeMap[code];
      if (shiftCodeId) {
        await prisma.assignment.upsert({
          where: { workerId_date_versionId: { workerId: worker.id, date: new Date(d), versionId: version.id } },
          update: { shiftCodeId },
          create: { workerId: worker.id, date: new Date(d), shiftCodeId, versionId: version.id },
        });
      }
      d.setDate(d.getDate() + 1);
    }
  }

  await prisma.auditLog.create({
    data: { versionId: version.id, action: "VERSION_CREATED", changedBy: "sistema", metadata: JSON.stringify({ source: "api-seed" }) },
  });

  return NextResponse.json({ message: "Base de datos inicializada con datos de ejemplo.", workers: createdWorkers.length });
}
