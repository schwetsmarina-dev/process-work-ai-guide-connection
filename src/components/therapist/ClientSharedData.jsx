import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Brain, Loader2, MessageSquare, Sparkles, Lock, Network, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { MODE_LABELS } from "@/lib/modeSteps";
import ProcessGraph from "@/components/map/ProcessGraph";

export default function ClientSharedData({ clientEmail }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["therapistClientData", clientEmail],
    queryFn: async () => (await base44.functions.invoke("therapistClientData", { clientEmail }))?.data,
    enabled: !!clientEmail,
    retry: false,
  });

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="w-4 h-4 animate-spin" /> Cargando datos compartidos…</div>;
  if (isError || data?.consent === false) return <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground flex flex-col items-center gap-2"><Lock className="w-5 h-5" />Este cliente no ha autorizado el acceso a sus datos.</div>;

  const p = data?.permissions || {};
  const summaries = data?.summaries || [];
  const insights = data?.insights || [];
  const memory = data?.memory_profile || [];
  const risks = data?.risk_flags || [];

  return <div className="space-y-6">
    <ClientProcessMap clientEmail={clientEmail} enabled={p.process_map === true} />

    {p.memory_profile && <section>
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><Brain className="w-4 h-4 text-primary" />Mapa longitudinal compartido ({memory.length})</h4>
      {memory.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay hipótesis longitudinales compartibles.</p> : <div className="space-y-2">{memory.map((m) => <div key={m.id} className="rounded-xl border p-4"><div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-1"><span>{m.level}</span>{m.evidence_count > 1 && <span>{m.evidence_count} sesiones</span>}{m.trend && <span>{m.trend}</span>}{typeof m.confidence === "number" && <span>{Math.round(m.confidence * 100)}%</span>}{["confirmed","corrected"].includes(m.user_status) && <span className="text-primary font-medium">validado por el cliente</span>}</div><p className="text-sm">{m.value}</p></div>)}</div>}
    </section>}

    {p.summaries && <section>
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><MessageSquare className="w-4 h-4" />Resúmenes de sesión ({summaries.length})</h4>
      {summaries.length === 0 ? <p className="text-sm text-muted-foreground">Sin resúmenes compartidos aún.</p> : <div className="space-y-2">{summaries.map((s) => <div key={s.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><span className="text-sm font-medium">{MODE_LABELS[s.mode_id]?.es || s.mode_id}</span><span className="text-xs text-muted-foreground">{s.created_date ? format(new Date(s.created_date), "d MMM yyyy") : ""}</span></div><p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">{s.summary}</p></div>)}</div>}
    </section>}

    {p.insights && <section>
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-amber-500" />Insights ({insights.length})</h4>
      {insights.length === 0 ? <p className="text-sm text-muted-foreground">Sin insights compartidos aún.</p> : <div className="space-y-2">{insights.map((i) => <div key={i.id} className="rounded-xl border p-4"><p className="text-sm font-medium">{i.title}</p><p className="text-xs text-muted-foreground mt-1">{i.insight_text}</p></div>)}</div>}
    </section>}

    {p.risk_flags && <section>
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4 text-amber-600" />Señales de seguridad ({risks.length})</h4>
      {risks.length === 0 ? <p className="text-sm text-muted-foreground">No hay señales compartidas.</p> : <div className="space-y-2">{risks.map((r) => <div key={r.id} className="rounded-xl border p-3 text-sm"><span className="font-medium">{r.risk_type}</span><span className="text-muted-foreground"> · {r.severity} · {r.status}</span></div>)}</div>}
    </section>}
  </div>;
}

function ClientProcessMap({ clientEmail, enabled }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["therapistProcessMap", clientEmail, enabled],
    queryFn: async () => (await base44.functions.invoke("buildLifeProcessMap", { clientEmail }))?.data,
    enabled: !!clientEmail && enabled,
    retry: false,
  });

  if (!enabled) return null;
  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="w-4 h-4 animate-spin" /> Construyendo el mapa de proceso…</div>;
  if (isError) return <p className="text-sm text-muted-foreground">No se pudo cargar el mapa de proceso.</p>;
  const nodes = data?.nodes || []; const edges = data?.edges || [];
  return <section><h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><Network className="w-4 h-4 text-primary" />Mapa de proceso</h4>{nodes.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay suficientes datos.</p> : <ProcessGraph nodes={nodes} edges={edges} />}</section>;
}
