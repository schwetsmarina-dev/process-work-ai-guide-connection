import React, { useMemo } from "react";
import {
  startOfWeek,
  addDays,
  subWeeks,
  format,
  isSameDay,
  isToday,
} from "date-fns";
import { CalendarCheck } from "lucide-react";
import { t } from "@/lib/i18n";

const WEEKS = 12;

export default function ConsistencyCalendar({ sessions = [], lang = "ru" }) {
  // Days (date-only) with at least one completed session
  const completedDays = useMemo(() => {
    return sessions
      .filter((s) => s.status === "completed")
      .map((s) => new Date(s.ended_at || s.updated_date || s.created_date))
      .filter((d) => !isNaN(d.getTime()));
  }, [sessions]);

  // Build a grid of WEEKS columns x 7 rows, ending on the current week
  const grid = useMemo(() => {
    const start = startOfWeek(subWeeks(new Date(), WEEKS - 1), { weekStartsOn: 1 });
    const columns = [];
    for (let w = 0; w < WEEKS; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const day = addDays(start, w * 7 + d);
        col.push(day);
      }
      columns.push(col);
    }
    return columns;
  }, []);

  const isCompleted = (day) => completedDays.some((d) => isSameDay(d, day));
  const completedCount = completedDays.length;

  const dayLabels =
    lang === "es"
      ? ["L", "M", "X", "J", "V", "S", "D"]
      : ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  return (
    <div className="mb-12 p-5 rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 mb-1">
        <CalendarCheck className="w-5 h-5 text-primary" />
        <h2 className="font-serif text-xl font-semibold">
          {t("consistency_title", lang)}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        {t("consistency_subtitle", lang)}
      </p>

      <div className="flex gap-2">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-1 pr-1">
          {dayLabels.map((d) => (
            <div
              key={d}
              className="h-4 text-[10px] leading-4 text-muted-foreground text-right w-6"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Weeks grid */}
        <div className="flex gap-1 overflow-x-auto">
          {grid.map((col, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {col.map((day, di) => {
                const future = day > new Date();
                const done = isCompleted(day);
                return (
                  <div
                    key={di}
                    title={format(day, "PP")}
                    className={[
                      "h-4 w-4 rounded-sm",
                      future
                        ? "bg-transparent"
                        : done
                        ? "bg-primary"
                        : "bg-muted",
                      isToday(day) ? "ring-1 ring-primary ring-offset-1" : "",
                    ].join(" ")}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        {t("consistency_count", lang).replace("{count}", completedCount)}
      </p>
    </div>
  );
}