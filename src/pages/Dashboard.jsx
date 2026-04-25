import React from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ModeCard from "@/components/dashboard/ModeCard";
import RecentSessionCard from "@/components/dashboard/RecentSessionCard";

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => base44.entities.Session.list("-created_date", 10),
  });

  const activeSession = sessions.find((s) => s.status === "active");
  const recentSessions = sessions.filter((s) => s.status !== "active").slice(0, 5);

  const handleModeSelect = async (mode) => {
    const session = await base44.entities.Session.create({ mode, status: "active", current_step: 0 });
    navigate(`/session/${session.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="mb-10">
        <h1 className="font-serif text-3xl md:text-4xl font-semibold mb-2">
          Добро пожаловать
        </h1>
        <p className="text-muted-foreground">
          Выберите направление для самоисследования
        </p>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <div className="mb-8 p-5 rounded-2xl border-2 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary mb-1">Незавершённая сессия</p>
              <p className="text-sm text-muted-foreground">
                {MODE_LABELS_RU[activeSession.mode] || activeSession.mode}
              </p>
            </div>
            <Button onClick={() => navigate(`/session/${activeSession.id}`)}>
              Продолжить
            </Button>
          </div>
        </div>
      )}

      {/* Mode selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
        {["body", "dream", "conflict", "journaling"].map((mode) => (
          <ModeCard key={mode} mode={mode} onClick={handleModeSelect} />
        ))}
      </div>

      {/* Recent sessions */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        recentSessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-xl font-semibold">Недавние сессии</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
                Все сессии
              </Button>
            </div>
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <RecentSessionCard key={session.id} session={session} />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

const MODE_LABELS_RU = {
  body: "Сигнал тела",
  dream: "Работа со сном",
  conflict: "Внутренний конфликт",
  journaling: "Дневник",
};