import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Loader2, Play } from "lucide-react";
import { format } from "date-fns";
import { MODE_LABELS } from "@/lib/modeSteps";
import { startSession } from "@/lib/sessionApi";
import { normalizeLang } from "@/lib/i18n";
import PersonalProcessPracticeCard from "@/components/client/PersonalProcessPracticeCard";
import EdgeProgramOfferCard from "@/components/client/EdgeProgramOfferCard";
import useEntitlement from "@/hooks/useEntitlement";
import { FEATURES } from "@/lib/entitlement";

// Key used to remember which Assignment a session was started for, so the
// summary page can mark it done once the session completes.
export const PENDING_ASSIGNMENT_KEY = "talvira_pending_assignment";

export default function SuggestedPractices({ clientEmail }) {
  const navigate = useNavigate();
  const [startingId, setStartingId] = useState(null);

  const { data: authUser = null } = useQuery({
    queryKey: ["suggested-practices-auth-user", clientEmail],
    queryFn: () => base44.auth.me(),
    enabled: !!clientEmail,
    staleTime: 5 * 60_000,
  });

  const { data: appUsers = [] } = useQuery({
    queryKey: ["suggested-practices-app-user", clientEmail],
    queryFn: () => base44.entities.AppUser.filter({ email: clientEmail }),
    enabled: !!clientEmail,
    staleTime: 5 * 60_000,
  });
  const lang = normalizeLang(appUsers[0]?.language);
  const { can } = useEntitlement();
  const canUsePersonalPractice = can(FEATURES.PRACTICE);

  const { data: completedSessions = [] } = useQuery({
    queryKey: ["suggested-practices-completed", authUser?.id],
    queryFn: () => base44.entities.Session.filter(
      { user_id: authUser.id, status: "completed" },
      "-created_date",
      20,
    ),
    enabled: !!authUser?.id,
    staleTime: 60_000,
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["clientAssignments", clientEmail],
    queryFn: () =>
      base44.entities.Assignment.filter(
        { client_email: clientEmail, status: "pending" },
        "-created_at",
        50,
      ),
    enabled: !!clientEmail,
  });

  const startPractice = async (assignment) => {
    setStartingId(assignment.id);
    try {
      const result = await startSession(assignment.mode_id);
      if (result.blocked) {
        navigate("/dashboard");
        return;
      }
      sessionStorage.setItem(
        PENDING_ASSIGNMENT_KEY,
        JSON.stringify({ assignmentId: assignment.id, sessionId: result.session.id }),
      );
      navigate(`/session/${result.session.id}`);
    } catch (e) {
      console.error("[SuggestedPractices] could not start:", e?.message);
      setStartingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {authUser?.id && canUsePersonalPractice === true && (
        <>
          <PersonalProcessPracticeCard
            userId={authUser.id}
            user={{ ...authUser, name: appUsers[0]?.name || authUser?.full_name || authUser?.name || "" }}
            lang={lang}
            completedSessions={completedSessions}
          />
          <EdgeProgramOfferCard lang={lang} enabled={completedSessions.length >= 5} />
        </>
      )}

      {!isLoading && assignments.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">
              {lang === "ru" ? "Практики от специалиста" : lang === "en" ? "Practices from your practitioner" : "Prácticas sugeridas"}
            </h3>
          </div>
          <div className="space-y-3">
            {assignments.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {MODE_LABELS[a.mode_id]?.[lang] || MODE_LABELS[a.mode_id]?.es || a.mode_id}
                    {a.tema ? ` · ${a.tema}` : ""}
                  </span>
                  {a.due_date && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(a.due_date), "d MMM yyyy")}
                    </span>
                  )}
                </div>
                {a.instructions && <p className="text-xs text-muted-foreground mt-1">{a.instructions}</p>}
                <Button
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={() => startPractice(a)}
                  disabled={startingId === a.id}
                >
                  {startingId === a.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {lang === "ru" ? "Начать сессию" : lang === "en" ? "Start session" : "Empezar sesión"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
