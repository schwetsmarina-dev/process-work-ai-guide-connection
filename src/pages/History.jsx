import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { t, getStoredLanguage } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import RecentSessionCard from "@/components/dashboard/RecentSessionCard";
import RegenerateSummaryButton, { needsRegenerate } from "@/components/history/RegenerateSummaryButton";

export default function History() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: sessions = [], isLoading, refetch } = useQuery({
    queryKey: ["sessions-all", currentUser?.email],
    queryFn: () => base44.entities.Session.filter({ created_by: currentUser.email }, "-created_date", 50),
    enabled: !!currentUser?.email,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-semibold mb-2">{t("history_title", lang)}</h1>
      <p className="text-muted-foreground mb-8">{t("history_subtitle", lang)}</p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">{t("history_empty", lang)}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="space-y-2">
              <RecentSessionCard session={session} />
              {session.status === "completed" && needsRegenerate(session) && (
                <div className="flex justify-end px-1">
                  <RegenerateSummaryButton session={session} onUpdated={refetch} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}