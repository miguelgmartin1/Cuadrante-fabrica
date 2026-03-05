export interface Worker {
  id: string;
  name: string;
  employeeNumber: string;
  subdepartment: string;
  position?: string;
  active: boolean;
}

export interface ShiftCode {
  id: string;
  code: string;
  label: string;
  color: string;
  textColor: string;
  isWorkDay: boolean;
  hours?: number;
  sortOrder: number;
}

export interface ScheduleVersion {
  id: string;
  name: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
}

export interface Assignment {
  id: string;
  workerId: string;
  date: string;
  shiftCodeId: string;
  versionId: string;
  worker: Worker;
  shiftCode: ShiftCode;
}

// Row data for AG Grid: { workerId, workerName, subdept, [dateKey]: code, ... }
export interface GridRow {
  workerId: string;
  workerName: string;
  employeeNumber: string;
  subdepartment: string;
  [dateKey: string]: string;
}

export interface PendingChange {
  workerId: string;
  date: string;
  newCode: string;
  oldCode: string;
}
