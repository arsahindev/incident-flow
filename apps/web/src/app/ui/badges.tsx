import type { IncidentPriority, IncidentStatus } from "@/lib/types";

const priorityClasses: Record<IncidentPriority, string> = {
  low: "border-slate-600 bg-slate-700/40 text-slate-300",
  medium: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  high: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  critical: "border-red-500/30 bg-red-500/10 text-red-300",
};

const statusClasses: Record<IncidentStatus, string> = {
  open: "border-red-500/30 bg-red-500/10 text-red-300",
  acknowledged: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  resolved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

function label(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function PriorityBadge({ priority }: { priority: IncidentPriority }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityClasses[priority]}`}>
      {label(priority)}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses[status]}`}>
      {label(status)}
    </span>
  );
}
