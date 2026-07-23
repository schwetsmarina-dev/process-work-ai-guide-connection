import { t, getStoredLanguage } from "@/lib/i18n";
import { MODE_LABELS } from "@/lib/modeSteps";
import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, Stethoscope, AlertTriangle, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import ClientCard from "@/components/therapist/ClientCard";
import RiskEventCard from "@/components/therapist/RiskEventCard";

const MODE_LABELS = {
  body: "Работа с телом",
  dream: "Работа со сном",
  conflict: "Работа с конфликтом",
  journaling: "Свободное письмо",
};

export default function TherapistDashboard() {
  const lang = getStoredLanguage();
  const [selectedClientId, setSelectedClientId] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["therapistDashboard"],
    queryFn: async () => {
      const res = await base44.functions.invoke("therapistDashboard", {});
      return res.data;
    },
  });

  const clients = data?.clients || [];
  const sessions = data?.sessions || [];
  const flaggedRiskEvents = data?.flaggedRiskEvents || [];

  const clientNameById = useMemo(() => {
    const m = new Map();
    clients.forEach((c) => {
      m.set(c.id, c.name);
      if (c.email) m.set(c.email, c.name);
    });
    return m;
  }, [clients]);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  const clientSessions = useMemo(() => {
    if (!selectedClient) return [];
    return sessions.filter(
      (s) => s.user_id === selectedClient.id || s.created_by === selectedClient.email
    );
  }, [selectedClient, sessions]);

  const clientRisks = useMemo(() => {
    if (!selectedClient) return [];
    return flaggedRiskEvents.filter(
      (e) => e.user_id === selectedClient.id || e.created_by === selectedClient.email
    );
  }, [selectedClient, flaggedRiskEvents]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground text-sm">
        <Loader2 className="w-5 h-5 animate-spin" />
        {t("th_loading", lang)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 md:p-10 max-w-2xl mx-auto text-center">
        <p className="text-sm text-destructive mb-3">{t("th_load_error", lang)}</p>
        <button className="text-sm text-primary underline" onClick={() => refetch()}>
          {t("retry", lang)}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Stethoscope className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-semibold">{t("th_title", lang)}</h1>
          <p className="text-sm text-muted-foreground">
            {t("th_clients_consented", lang)} · {clients.length}
          </p>
        </div>
      </div>

      {/* Priority: all flagged risk events across clients, sorted by severity */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          {t("th_needs_review", lang)} ({flaggedRiskEvents.length})
        </h2>
        {flaggedRiskEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-border bg-card p-4">
            Нет событий, требующих проверки.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {flaggedRiskEvents.map((e) => (
              <RiskEventCard
                key={e.id}
                event={e}
                clientName={clientNameById.get(e.user_id) || clientNameById.get(e.created_by)}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid md:grid-cols-[320px_1fr] gap-6">
        {/* Client list */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold mb-2">{t("th_clients", lang)}</h2>
          {clients.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("th_no_clients", lang)}</p>
          )}
          {clients.map((c) => (
            <ClientCard
              key={c.id}
              client={c}
              active={c.id === selectedClientId}
              onClick={() => setSelectedClientId((prev) => (prev === c.id ? null : c.id))}
            />
          ))}
        </div>

        {/* Selected client detail */}
        <div>
          {!selectedClient ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {t("th_pick_client", lang)}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold">{selectedClient.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedClient.email}</p>
              </div>

              {clientRisks.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    {t("th_client_events", lang)} ({clientRisks.length})
                  </h4>
                  <div className="grid gap-3">
                    {clientRisks.map((e) => (
                      <RiskEventCard key={e.id} event={e} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  {t("th_sessions", lang)} ({clientSessions.length})
                </h4>
                {clientSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("th_no_sessions", lang)}</p>
                ) : (
                  <div className="space-y-2">
                    {clientSessions.map((s) => (
                      <Link
                        key={s.id}
                        to={`/session/${s.id}/summary`}
                        className="block rounded-xl border border-border bg-card p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">
                            {MODE_LABELS[s.mode_id] || s.mode_id}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {s.created_date
                              ? format(new Date(s.created_date), "d MMM yyyy")
                              : ""}
                          </span>
                        </div>
                        {s.summary && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                            {s.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {s.status === "completed"
                              ? t("th_status_completed", lang)
                              : s.status === "active"
                              ? t("th_status_active", lang)
                              : t("th_status_abandoned", lang)}
                          </span>
                          {s.risk_flag && (
                            <span className="text-xs text-destructive font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {t("th_risk", lang)}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}