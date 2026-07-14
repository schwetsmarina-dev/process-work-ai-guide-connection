import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, Lightbulb } from "lucide-react";
import TimelineEvent from "@/components/timeline/TimelineEvent";
import InsightDetailModal from "@/components/insights/InsightDetailModal";

export default function Timeline() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedInsight, setSelectedInsight] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["timeline-sessions", currentUser?.email],
    queryFn: () => base44.entities.Session.filter({ created_by: currentUser.email }, "-created_date", 200),
    enabled: !!currentUser?.email,
  });

  const { data: insights = [], isLoading: loadingInsights } = useQuery({
    queryKey: ["timeline-insights", currentUser?.email],
    queryFn: () => base44.entities.Insight.filter({ created_by: currentUser.email }, "-created_date", 200),
    enabled: !!currentUser?.email,
  });

  const isLoading = loadingSessions || loadingInsights;

  const events = [
    ...sessions.map((s) => ({
      kind: "session",
      id: s.id,
      date: s.started_at || s.created_date,
      ended_at: s.ended_at,
      mode: s.mode_id || s.mode,
      summary: s.summary,
      raw: s,
    })),
    ...insights.map((i) => ({
      kind: "insight",
      id: i.id,
      date: i.created_at || i.created_date,
      title: i.title,
      importance: i.importance,
      raw: i,
    })),
  ]
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleClick = (event) => {
    if (event.kind === "session") {
      navigate(event.raw.status === "completed" ? `/session/${event.id}/summary` : `/session/${event.id}`);
    } else {
      setSelectedInsight(event.raw);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-semibold mb-2">Timeline личности</h1>
      <p className="text-muted-foreground mb-6">
        Хронология ваших сессий и инсайтов. Нажмите на точку, чтобы открыть её.
      </p>

      {/* Legend */}
      <div className="flex items-center gap-5 mb-8 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-primary" />
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-muted-foreground">Сессии</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-chart-3" />
          <Lightbulb className="w-3.5 h-3.5 text-chart-3" />
          <span className="text-muted-foreground">Инсайты</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Пока нет данных для шкалы</p>
        </div>
      ) : (
        <div className="relative">
          {/* Central vertical line */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2" />

          <div className="space-y-8">
            {events.map((event, idx) => (
              <TimelineEvent
                key={`${event.kind}-${event.id}`}
                event={event}
                side={idx % 2 === 0 ? "right" : "left"}
                onClick={() => handleClick(event)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedInsight && (
        <InsightDetailModal insight={selectedInsight} onClose={() => setSelectedInsight(null)} />
      )}
    </div>
  );
}