import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Link2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import PhysioImport from "./PhysioImport";

const METRIC_LABELS = {
  heart_rate: "Пульс",
  hrv: "ВСР",
  sleep_hours: "Сон",
  steps: "Шаги",
  respiratory_rate: "Дыхание",
  stress: "Стресс",
};

// Pairs the body-mode session's signals with physiological data recorded in the
// same period (±12h window around the session). Body mode only.
export default function BodySignalMatch({ session, userId }) {
  const [physioData, setPhysioData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const signals = session?.signals || [];

  // Session period window: ±12h around start/end.
  const start = session?.started_at || session?.created_date;
  const end = session?.ended_at || session?.created_date;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const rows = await base44.entities.PhysiologicalData.filter({ user_id: userId });
      const from = new Date(new Date(start).getTime() - 12 * 3600 * 1000);
      const to = new Date(new Date(end).getTime() + 12 * 3600 * 1000);
      const inWindow = rows.filter((r) => {
        const t = new Date(r.recorded_at).getTime();
        return t >= from.getTime() && t <= to.getTime();
      });
      inWindow.sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      setPhysioData(inWindow);
    } finally {
      setLoading(false);
    }
  }, [userId, start, end]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Телесные сигналы и физиология</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowImport((v) => !v)}>
          {showImport ? "Скрыть" : "Добавить данные"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Сопоставь телесные сигналы этой сессии с физиологическими данными за тот же
        период (±12 часов).
      </p>

      {/* Session signals */}
      {signals.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {signals.map((s, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {s}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          В этой сессии не отмечены телесные сигналы.
        </p>
      )}

      {/* Physiological data in the same window */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Физиология за период сессии
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : physioData.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Нет физиологических данных за этот период. Добавь их, чтобы сопоставить с сигналами.
          </p>
        ) : (
          <ul className="space-y-2">
            {physioData.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-muted/50"
              >
                <span className="font-medium">
                  {METRIC_LABELS[d.metric_type] || d.metric_type}
                </span>
                <span className="text-muted-foreground">
                  {d.value}
                  {d.unit ? ` ${d.unit}` : ""}
                  <span className="ml-2 text-xs opacity-70">
                    {format(new Date(d.recorded_at), "d MMM HH:mm")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showImport && (
        <div className="pt-2">
          <PhysioImport
            userId={userId}
            onImported={() => {
              load();
            }}
          />
        </div>
      )}
    </Card>
  );
}