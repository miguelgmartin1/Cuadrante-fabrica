# Shift Planner — Cuadrante de Turnos

App web para planificación de turnos, sustituto del Excel de cuadrantes.
Grid tipo Excel con edición inline, selección múltiple, aplicación masiva y exportación a Excel.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Prisma 5** + PostgreSQL
- **AG Grid Community 35** — grid virtualizado, editable, copiar/pegar, deshacer
- **ExcelJS** — exportación con colores y layout fiel al Excel original
- **Tailwind CSS 4**

## Modelo de datos

| Tabla | Descripcion |
|-------|-------------|
| `Worker` | Operarios con número de empleado y subdepartamento |
| `ShiftCode` | Codigos de turno (M, T, N, D, VAC...) con color |
| `ScheduleVersion` | Versiones del cuadrante (DRAFT / PUBLISHED / ARCHIVED) |
| `Assignment` | Asignacion de codigo a operario en fecha+version (unique) |
| `AuditLog` | Registro de todos los cambios |

## Puesta en marcha

### Requisitos

- Node.js 18+
- PostgreSQL 14+

### 1. Instalar dependencias

```bash
cd shift-planner
npm install
```

### 2. Configurar base de datos

```bash
cp .env.example .env
# Editar .env:
# DATABASE_URL="postgresql://usuario:password@localhost:5432/shift_planner"
```

### 3. Aplicar migraciones

```bash
# Opcion A: con historial de migraciones (produccion)
npm run db:migrate

# Opcion B: sincronizacion directa (desarrollo rapido)
npm run db:push
```

### 4. Cargar datos de ejemplo

```bash
npm run db:seed
```

Crea 10 codigos de turno, 10 operarios en 4 subdepartamentos y un cuadrante del mes actual.

### 5. Arrancar

```bash
npm run dev
# Abrir http://localhost:3000  →  redirige a /schedule
```

---

## Uso de la aplicacion

### Edicion de celdas

| Accion | Como hacerlo |
|--------|-------------|
| Editar una celda | Doble clic o Enter/F2 sobre la celda |
| Confirmar edicion | Enter (avanza abajo) o Tab (avanza derecha) |
| Introducir codigo | Escribir directamente el codigo (M, T, N, VAC...) |
| Borrar contenido | Delete o Backspace en la celda |
| Copiar/Pegar | Ctrl+C y Ctrl+V (celda o rango) |
| Deshacer/Rehacer | Ctrl+Z / Ctrl+Y (hasta 30 pasos) |

### Aplicacion masiva

1. Seleccionar operarios con los **checkboxes** de la primera columna
2. En la barra "APLICAR MASIVO": elegir codigo y rango de fechas
3. Pulsar **Aplicar** — las celdas se marcan como pendientes
4. Pulsar **Guardar** para persistir en BD

### Exportar a Excel

El .xlsx generado incluye:
- Layout: TRABAJADOR | N.Empleado | Subdepartamento | dia1 | dia2 | ...
- Agrupacion de columnas por mes
- Colores de fondo identicos a los de la app
- Hoja de leyenda con todos los codigos

---

## Codigos de turno por defecto

| Codigo | Descripcion | Horas |
|--------|-------------|-------|
| M | Manana | 8h |
| T | Tarde | 8h |
| N | Noche | 8h |
| D | Descanso | — |
| R | Recuperacion | — |
| VAC | Vacaciones | — |
| IT | Incapacidad Temporal | — |
| L | Libre | — |
| P | Permiso | — |
| F | Festivo | — |

---

## Scripts

```bash
npm run dev          # Desarrollo (http://localhost:3000)
npm run build        # Build de produccion
npm run start        # Produccion
npm run db:migrate   # Migracion Prisma
npm run db:push      # Sync schema (sin migracion)
npm run db:seed      # Datos de ejemplo
npm run db:studio    # Prisma Studio (GUI BD)
```

## Estructura

```
shift-planner/
├── app/
│   ├── api/
│   │   ├── assignments/route.ts   # GET + POST bulk upsert
│   │   ├── export/route.ts        # Descarga .xlsx
│   │   ├── shift-codes/route.ts
│   │   ├── versions/route.ts
│   │   └── workers/route.ts
│   └── schedule/page.tsx          # Pagina principal
├── components/
│   ├── Legend.tsx
│   └── VersionSelector.tsx
├── lib/prisma.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── types/schedule.ts
```
