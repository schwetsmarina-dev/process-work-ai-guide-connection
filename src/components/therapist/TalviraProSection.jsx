import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, Briefcase } from "lucide-react";
import { format } from "date-fns";
import { MODE_LABELS } from "@/lib/modeSteps";
import InviteClientDialog from "./InviteClientDialog";
import AssignPracticeDialog from "./AssignPracticeDialog";
import ClientSharedData from "./ClientSharedData";

const STATUS_LABEL = { invited: "Invitado", active: "Activo", paused: "En pausa" };

export default function TalviraProSection({ therapistEmail }) {
  const [selectedEmail, setSelectedEmail] = useState(null);

  const { data: links = [], isLoading, refetch } = useQuery({
    queryKey: ["clientLinks", therapistEmail],
    queryFn: () => base44.entities.ClientLink.filter({ therapist_email: therapistEmail }, "-created_at", 200),
    enabled: !!therapistEmail,
  });

  const { data: assignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ["therapistAssignments", therapistEmail],
    queryFn: () => base44.entities.Assignment.filter({ therapist_email: therapistEmail }, "-created_at", 200),
    enabled: !!therapistEmail,
  });

  const selected = links.find((l) => l.client_email === selectedEmail) || null;
  const selectedAssignments = assignments.filter((a) => a.client_email === selectedEmail);

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-primary" />
          Talvira Pro · Clientes vinculados ({links.length})
        </h2>
        <InviteClientDialog therapistEmail={therapistEmail} onInvited={refetch} />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando clientes…
        </div>
      ) : links.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-border bg-card p-4">
          Aún no has invitado a ningún cliente. Usa «Invitar cliente» para empezar.
        </p>
      ) : (
        <div className="grid md:grid-cols-[320px_1fr] gap-6">
          <div className="space-y-2">
            {links.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedEmail((prev) => (prev === l.client_email ? null : l.client_email))}
                className={`w-full text-left rounded-xl border p-4 transition-colors ${
                  selectedEmail === l.client_email
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{l.client_email}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    {STATUS_LABEL[l.status] || l.status}
                  </span>
                  <span className={`text-xs ${l.consent_to_share ? "text-green-600" : "text-muted-foreground"}`}>
                    {l.consent_to_share ? "Comparte datos" : "Sin consentimiento"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div>
            {!selected ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                Selecciona un cliente para ver sus datos compartidos y asignarle prácticas.
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-sm">{selected.client_email}</h3>
                    <p className="text-xs text-muted-foreground">
                      {STATUS_LABEL[selected.status] || selected.status}
                    </p>
                  </div>
                  <AssignPracticeDialog
                    therapistEmail={therapistEmail}
                    clientEmail={selected.client_email}
                    onAssigned={refetchAssignments}
                  />
                </div>

                {selectedAssignments.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Prácticas asignadas ({selectedAssignments.length})</h4>
                    <div className="space-y-2">
                      {selectedAssignments.map((a) => (
                        <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium">
                              {MODE_LABELS[a.mode_id]?.es || a.mode_id}
                              {a.tema ? ` · ${a.tema}` : ""}
                            </span>
                            <span
                              className={`text-xs shrink-0 ${
                                a.status === "done" ? "text-green-600" : "text-muted-foreground"
                              }`}
                            >
                              {a.status === "done" ? "Completada" : "Pendiente"}
                            </span>
                          </div>
                          {a.instructions && (
                            <p className="text-xs text-muted-foreground mt-1">{a.instructions}</p>
                          )}
                          {a.due_date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Fecha límite: {format(new Date(a.due_date), "d MMM yyyy")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <ClientSharedData clientEmail={selected.client_email} />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}