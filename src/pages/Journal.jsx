import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { startSession } from "@/lib/sessionApi";
import UpgradePrompt from "@/components/billing/UpgradePrompt";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import JournalSessionCard from "@/components/journal/JournalSessionCard";
import JournalInsightCard from "@/components/journal/JournalInsightCard";
import JournalProgress from "@/components/journal/JournalProgress";
import { normalizeLang, t } from "@/lib/i18n";

export default function Journal() {
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [favUpdatingId, setFavUpdatingId] = useState(null);
  const lang = normalizeLang(appUser?.language || "ru");

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      setCurrentUser(u);
      const rows = await base44.entities.AppUser.filter({ email: u?.email });
      setAppUser(rows[0] || null);
    })();
  }, []);

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["journal-sessions", currentUser?.email],
    queryFn: () => base44.entities.Session.filter({ created_by: currentUser.email }, "-created_date", 100),
    enabled: !!currentUser?.email,
  });

  const { data: insights = [], isLoading: insightsLoading } = useQuery({
    queryKey: ["journal-insights", currentUser?.id],
    queryFn: () => base44.entities.Insight.filter({ created_by_id: currentUser.id }, "-created_date", 100),
    enabled: !!currentUser?.id,
  });

  const completedSessions = sessions.filter((s) => s.status === "completed");

  // Repeat a session: create a new active session in the same mode
  const handleRepeat = async (mode) => {
    const modeId = String(mode || "").trim();
    if (!modeId || !currentUser?.id) return;
    const result = await startSession(modeId);
    if (result.blocked) {
      setQuotaBlocked(true);
      return;
    }
    const session = result.session;
    if (appUser?.id) {
      await base44.entities.AppUser.update(appUser.id, { last_session_id: session.id }).catch(() => {});
    }
    navigate(`/session/${session.id}`);
  };

  const handleToggleFavorite = async (insight) => {
    setFavUpdatingId(insight.id);
    await base44.entities.Insight.update(insight.id, { is_favorite: !insight.is_favorite }).catch(() => {});
    await queryClient.invalidateQueries({ queryKey: ["journal-insights", currentUser?.id] });
    setFavUpdatingId(null);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-semibold mb-2">{t("journal_title", lang)}</h1>
        <p className="text-muted-foreground">{t("journal_subtitle", lang)}</p>
      </div>

      {/* Progress */}
      <section className="mb-10">
        <h2 className="font-serif text-xl font-semibold mb-4">{t("journal_progress", lang)}</h2>
        {sessionsLoading || insightsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <JournalProgress sessions={sessions} insightsCount={insights.length} lang={lang} />
        )}
      </section>

      {/* Recent sessions */}
      <section className="mb-10">
        <h2 className="font-serif text-xl font-semibold mb-4">{t("journal_recent_sessions", lang)}</h2>
        {sessionsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : completedSessions.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">{t("journal_no_sessions", lang)}</p>
        ) : (
          <div className="space-y-3">
            {completedSessions.map((session) => (
              <JournalSessionCard key={session.id} session={session} lang={lang} onRepeat={handleRepeat} />
            ))}
          </div>
        )}
      </section>

      {/* My insights */}
      <section>
        <h2 className="font-serif text-xl font-semibold mb-4">{t("journal_my_insights", lang)}</h2>
        {insightsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : insights.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">{t("journal_no_insights", lang)}</p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <JournalInsightCard
                key={insight.id}
                insight={insight}
                lang={lang}
                onToggleFavorite={handleToggleFavorite}
                isUpdating={favUpdatingId === insight.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}