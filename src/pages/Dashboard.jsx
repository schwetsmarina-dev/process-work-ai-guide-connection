import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecentSessionCard from "@/components/dashboard/RecentSessionCard";
import ModeCardDB from "@/components/dashboard/ModeCardDB";
import { normalizeLang, t } from "@/lib/i18n";

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const lang = normalizeLang(currentUser?.language);

  useEffect(() => {
    base44.auth.me().then((u) => {
      console.log("CURRENT USER:", u?.id, u?.email);
      setCurrentUser(u);
    });
  }, []);

  // Load active modes from DB
  const { data: modes = [], isLoading: modesLoading } = useQuery({
    queryKey: ["modes-active"],
    queryFn: () => base44.entities.Mode.filter({ is_active: true }, "sort_order"),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["sessions", currentUser?.email],
    queryFn: () => base44.entities.Session.filter({ created_by: currentUser.email }, "-created_date", 10),
    enabled: !!currentUser?.email,
  });

  const activeSession = sessions.find((s) => s.status === "active");
  const recentSessions = sessions.filter((s) => s.status !== "active").slice(0, 5);

  const handleModeSelect = async (mode) => {
    const modeId = mode.mode_id;
    const stepKey = `${modeId}_1`;

    console.log("[SessionFlow] mode selected:", modeId, "looking up step_key:", stepKey);

    // Load all steps for mode — bulletproof check before creating session
    let allModeSteps = [];
    try {
      allModeSteps = await base44.entities.ModeStep.filter({ mode_id: modeId });
    } catch (e) {
      // Permissions issue — try listing all
      try {
        const all = await base44.entities.ModeStep.list("step_number", 500);
        allModeSteps = all.filter((s) => String(s.mode_id || "").trim() === modeId);
      } catch (e2) {
        console.error("[SessionFlow] Cannot read ModeStep:", e2.message);
      }
    }

    const firstStep =
      allModeSteps.find((s) => String(s.step_key || "").trim() === stepKey) ||
      allModeSteps.find((s) => Number(s.step_number) === 1) ||
      allModeSteps.find((s) => Number(s.step) === 1) ||
      allModeSteps.find((s) => String(s.step_key || "").endsWith("_1"));

    if (!firstStep) {
      const allSample = await base44.entities.ModeStep.list("step_number", 10).catch(() => []);
      const allModeIds = [...new Set(allSample.map((s) => s.mode_id).filter(Boolean))];
      const allKeys = allModeSteps.map((s) => s.step_key || `[no key, step_number=${s.step_number}]`).join(", ") || "(none)";
      console.error(
        `[SessionFlow] First step not found!\n  mode_id = ${modeId}\n  step_key = ${stepKey}\n  steps for mode = ${allKeys}\n  DB mode_ids = ${allModeIds.join(", ")}\n  ModeStep rows readable = ${allSample.length}`
      );
      alert(
        `Первый шаг не найден для режима «${modeId}».\n\n` +
        `step_key: ${stepKey}\n` +
        `Шаги для этого режима: ${allKeys}\n` +
        `Все mode_id в DB: ${allModeIds.join(", ") || "(пусто)"}\n` +
        `ModeStep записей, доступных пользователю: ${allSample.length}\n\n` +
        `→ Откройте /admin/status → «Test step lookup» для диагностики.\n` +
        `→ Или откройте /admin/import и загрузите mode_steps.csv.`
      );
      return;
    }

    const session = await base44.entities.Session.create({
      user_id: currentUser?.id,
      mode_id: modeId,
      mode: modeId,
      status: "active",
      current_step: 1,
      started_at: new Date().toISOString(),
    });

    console.log(
      "[SessionFlow] session created:",
      session.id,
      "mode_id:", session.mode_id,
      "step:", session.current_step,
      "user:", currentUser?.email
    );

    navigate(`/session/${session.id}`);
  };

  const isLoading = modesLoading || sessionsLoading;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl md:text-4xl font-semibold mb-2">
          {t("welcome", lang)}
        </h1>
        <p className="text-muted-foreground">
          {t("choose_direction", lang)}
        </p>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <div className="mb-8 p-5 rounded-2xl border-2 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary mb-1">{t("unfinished_session", lang)}</p>
              <p className="text-sm text-muted-foreground">
                {activeSession.mode_id || activeSession.mode}
              </p>
            </div>
            <Button onClick={() => navigate(`/session/${activeSession.id}`)}>
              {t("continue", lang)}
            </Button>
          </div>
        </div>
      )}

      {/* Mode selection */}
      {modesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : modes.length === 0 ? (
        <div className="flex items-start gap-3 p-5 rounded-2xl border border-amber-200 bg-amber-50 mb-8">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 text-sm">{t("modes_not_configured", lang)}</p>
            <p className="text-amber-700 text-xs mt-1">
              {t("modes_not_configured_text", lang)}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {modes.map((mode) => (
            <ModeCardDB key={mode.id} mode={mode} onClick={handleModeSelect} />
          ))}
        </div>
      )}

      {/* Recent sessions */}
      {sessionsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : recentSessions.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-semibold">{t("recent_sessions", lang)}</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
              {t("all_sessions", lang)}
            </Button>
          </div>
          <div className="space-y-2">
            {recentSessions.map((session) => (
              <RecentSessionCard key={session.id} session={session} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}