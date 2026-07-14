import React from "react";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";

const SEVERITY_STYLE = {
  critical: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700", label: "Критично" },
  high: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700", label: "Высокая" },
  medium: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", label: "Средняя" },
  low: { bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-600", label: "Низкая" },
};

const RISK_TYPE_LABELS = {
  suicide_mention: "Упоминание суицида",
  self_harm: "Самоповреждение",
  violence: "Насилие",
  psychotic: "Психотические признаки",
  medical_emergency: "Мед. неотложность",
  other: "Другое",
};

export default function RiskEventCard({ event, clientName }) {
  const sev = SEVERITY_STYLE[event.severity] || SEVERITY_STYLE.low;
  return (
    <div className={`rounded-xl border ${sev.border} ${sev.bg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${sev.text} shrink-0`} />
          <span className={`text-xs font-semibold ${sev.text} uppercase tracking-wide`}>
            {sev.label}
          </span>
          <span className="text-xs text-muted-foreground">
            · {RISK_TYPE_LABELS[event.risk_type] || event.risk_type}
          </span>
        </div>
        {event.detected_at && (
          <span className="text-xs text-muted-foreground shrink-0">
            {format(new Date(event.detected_at), "d MMM yyyy, HH:mm")}
          </span>
        )}
      </div>

      {clientName && (
        <p className="text-xs font-medium text-foreground mt-2">{clientName}</p>
      )}

      {event.trigger_text && (
        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-3 italic">
          «{event.trigger_text}»
        </p>
      )}
    </div>
  );
}