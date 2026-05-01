import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import RecentSessionCard from "@/components/dashboard/RecentSessionCard";
import ModeCardDB from "@/components/dashboard/ModeCardDB";

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);

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
    const session = await base44.entities.Session.create({
      mode_id: mode.mode_id,
      mode: mode.mode_id, // keep for legacy field
      status: "active",
      current_step: 1,
      started_at: new Date().toISOString(),
    });
    navigate(`/session/${session.id}`);
  };

  const isLoading = modesLoading || sessionsLoading;

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
                {activeSession.mode_id || activeSession.mode}
              </p>
            </div>
            <Button onClick={() => navigate(`/session/${activeSession.id}`)}>
              Продолжить
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
            <p className="font-medium text-amber-800 text-sm">Режимы не настроены</p>
            <p className="text-amber-700 text-xs mt-1">
              Загрузите данные в таблицу MODES через страницу «Импорт данных».
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
      ) : null}
    </div>
  );
}