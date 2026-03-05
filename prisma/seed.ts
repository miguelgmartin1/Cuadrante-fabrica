import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Seed shift codes
  const shiftCodes = [
    { code: "M", label: "Mañana", color: "#FFF9C4", textColor: "#000000", isWorkDay: true, hours: 8, sortOrder: 1 },
    { code: "T", label: "Tarde", color: "#FFF3E0", textColor: "#000000", isWorkDay: true, hours: 8, sortOrder: 2 },
    { code: "N", label: "Noche", color: "#E3F2FD", textColor: "#000000", isWorkDay: true, hours: 8, sortOrder: 3 },
    { code: "D", label: "Descanso", color: "#F3E5F5", textColor: "#6A1B9A", isWorkDay: false, hours: 0, sortOrder: 4 },
    { code: "R", label: "Recuperación", color: "#E8F5E9", textColor: "#1B5E20", isWorkDay: false, hours: 0, sortOrder: 5 },
    { code: "VAC", label: "Vacaciones", color: "#E0F7FA", textColor: "#006064", isWorkDay: false, hours: 0, sortOrder: 6 },
    { code: "IT", label: "Incapacidad Temporal", color: "#FCE4EC", textColor: "#880E4F", isWorkDay: false, hours: 0, sortOrder: 7 },
    { code: "L", label: "Libre", color: "#ECEFF1", textColor: "#37474F", isWorkDay: false, hours: 0, sortOrder: 8 },
    { code: "P", label: "Permiso", color: "#FFF8E1", textColor: "#FF6F00", isWorkDay: false, hours: 0, sortOrder: 9 },
    { code: "F", label: "Festivo", color: "#EDE7F6", textColor: "#4527A0", isWorkDay: false, hours: 0, sortOrder: 10 },
  ];

  for (const sc of shiftCodes) {
    await prisma.shiftCode.upsert({
      where: { code: sc.code },
      update: sc,
      create: sc,
    });
  }
  console.log("✅ Shift codes seeded");

  // Seed workers
  const workers = [
    { name: "Ana García López", employeeNumber: "EMP001", subdepartment: "Producción A", position: "Operaria" },
    { name: "Carlos Martínez Ruiz", employeeNumber: "EMP002", subdepartment: "Producción A", position: "Operario" },
    { name: "María Fernández Díaz", employeeNumber: "EMP003", subdepartment: "Producción B", position: "Operaria" },
    { name: "José López García", employeeNumber: "EMP004", subdepartment: "Producción B", position: "Operario" },
    { name: "Laura Sánchez Pérez", employeeNumber: "EMP005", subdepartment: "Mantenimiento", position: "Técnica" },
    { name: "Pedro González Romero", employeeNumber: "EMP006", subdepartment: "Mantenimiento", position: "Técnico" },
    { name: "Isabel Torres Moreno", employeeNumber: "EMP007", subdepartment: "Producción A", position: "Supervisora" },
    { name: "Antonio Ramírez Jiménez", employeeNumber: "EMP008", subdepartment: "Producción B", position: "Operario" },
    { name: "Carmen Álvarez Muñoz", employeeNumber: "EMP009", subdepartment: "Calidad", position: "Técnica" },
    { name: "Francisco Herrera Castillo", employeeNumber: "EMP010", subdepartment: "Calidad", position: "Técnico" },
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
  console.log("✅ Workers seeded");

  // Create a sample schedule version for current month
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const version = await prisma.scheduleVersion.upsert({
    where: { id: "seed-version-1" },
    update: {},
    create: {
      id: "seed-version-1",
      name: `Cuadrante ${periodStart.toLocaleString("es-ES", { month: "long", year: "numeric" })}`,
      description: "Versión inicial generada por seed",
      periodStart,
      periodEnd,
      status: "DRAFT",
      createdBy: "sistema",
    },
  });
  console.log("✅ Schedule version seeded");

  // Seed sample assignments
  const allCodes = await prisma.shiftCode.findMany();
  const codeMap = Object.fromEntries(allCodes.map((c) => [c.code, c.id]));

  const samplePattern = ["M", "M", "T", "T", "N", "N", "D", "D"];

  for (const worker of createdWorkers) {
    const days = [];
    let d = new Date(periodStart);
    let offset = createdWorkers.indexOf(worker);
    while (d <= periodEnd) {
      const code = samplePattern[(d.getDate() - 1 + offset) % samplePattern.length];
      days.push({ date: new Date(d), code });
      d.setDate(d.getDate() + 1);
    }

    for (const { date, code } of days) {
      const shiftCodeId = codeMap[code];
      if (!shiftCodeId) continue;
      await prisma.assignment.upsert({
        where: {
          workerId_date_versionId: {
            workerId: worker.id,
            date,
            versionId: version.id,
          },
        },
        update: { shiftCodeId },
        create: {
          workerId: worker.id,
          date,
          shiftCodeId,
          versionId: version.id,
        },
      });
    }
  }
  console.log("✅ Sample assignments seeded");

  // Audit log for version creation
  await prisma.auditLog.create({
    data: {
      versionId: version.id,
      action: "VERSION_CREATED",
      changedBy: "sistema",
      metadata: JSON.stringify({ source: "seed" }),
    },
  });

  console.log("🎉 Seed complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
