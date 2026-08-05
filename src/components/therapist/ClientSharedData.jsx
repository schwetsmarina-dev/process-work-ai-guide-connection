import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquare, Sparkles, Lock, Network } from "lucide-react";
import { format } from "date-fns";
import { MODE_LABELS } from "@/lib/modeSteps";
import ProcessGraph from "@/components/map/ProcessGraph";

// Read-only view of a client's shared summaries + insights.
// The backend enforces consent; if consent is off we simply render nothing
// beyond a short notice.
export default function ClientSharedData({ clientEmail }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["therapistClientData", clientEmail],
    queryFn: async () => {
      const res = await base44.functions.invoke("therapistClientData", { clientEmail });
      return res?.data ?? res;
    },
    enabled: !!clientEmail,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos compartidos…
      </div>
    );
  }

  if (isError || data?.consent === false) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
        <Lock className="w-5 h-5 text-muted-foreground/60" />
        Este cliente aún no ha activado el consentimiento para compartir sus datos.
      </div>
    );
  }

  const summaries = data?.summaries || [];
  const insights = data?.insights || [];

  return (
    <div className="space-y-5">
      <ClientProcessMap clientEmail={clientEmail} scope={data?.scope} />
      {(data?.scope === "summaries" || data?.scope === "both") && (
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            Resúmenes de sesión ({summaries.length})
          </h4>
          {summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin resúmenes compartidos aún.</p>
          ) : (
            <div className="space-y-2">
              {summaries.map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{MODE_LABELS[s.mode_id]?.es || s.mode_id}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {s.created_date ? format(new Date(s.created_date), "d MMM yyyy") : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">{s.summary}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(data?.scope === "insights" || data?.scope === "both") && (
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Insights recientes ({insights.length})
          </h4>
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin insights compartidos aún.</p>
          ) : (
            <div className="space-y-2">
              {insights.map((i) => (
                <div key={i.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-medium">{i.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{i.insight_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Full process map (themes, signals, edges/edge-moments, risk markers) for a
// linked client. Requires share_scope === 'both' on the ClientLink — the map
// merges session + insight + risk data, so it only unlocks under the
// broadest consent tier the client can grant. The backend (buildLifeProcessMap)
// enforces this independently; this gate is just so the section doesn't
// render an empty/error graph when the scope doesn't cover it.
function ClientProcessMap({ clientEmail, scope }) {
  const enabled = !!clientEmail && scope === "both";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["therapistProcessMap", clientEmail],
    queryFn: async () => {
      const res = await base44.functions.invoke("buildLifeProcessMap", { clientEmail });
      return res?.data ?? res;
    },
    enabled,
    retry: false,
  });

  if (!enabled) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
        <Network className="w-5 h-5 text-muted-foreground/60" />
        El mapa completo de proceso (temas, señales, bordes, riesgos) solo se muestra cuando el cliente comparte con el nivel «ambos» (resumenes + insights).
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Construyendo el mapa de proceso…
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground">No se pudo cargar el mapa de proceso.</p>
    );
  }

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];

  return (
    <div>
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
        <Network className="w-4 h-4 text-primary" />
        Mapa de proceso
      </h4>
      {nodes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay suficientes sesiones para construir el mapa.</p>
      ) : (
        <ProcessGraph nodes={nodes} edges={edges} />
      )}
    </div>
  );
}