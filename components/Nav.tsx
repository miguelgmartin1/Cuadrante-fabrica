"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/schedule", label: "Cuadrante" },
  { href: "/employees", label: "Empleados" },
  { href: "/shift-codes", label: "Tipos de turno" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="bg-white border-b border-gray-200 px-4 h-11 flex items-center gap-1 shrink-0">
      <span className="font-bold text-gray-800 mr-4 text-sm">Planificación de Turnos</span>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            pathname.startsWith(l.href)
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
