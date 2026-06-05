import React from "react";
import { Card } from "@/components/ui/card";
import { Star, MessageSquare, ThumbsUp, Languages, Layers } from "lucide-react";

const MODE_LABELS = {
  dream: "Сон",
  body: "Тело",
  conflict: "Конфликт",
  journaling: "Дневник",
};

export default function FeedbackSummary({ feedback }) {
  const total = feedback.length;
  const rated = feedback.filter((f) => typeof f.rating === "number");
  const avgRating = rated.length
    ? (rated.reduce((s, f) => s + f.rating, 0) / rated.length).toFixed(2)
    : "—";

  const yesCount = feedback.filter((f) => f.would_use_again === true).length;
  const noCount = feedback.filter((f) => f.would_use_again === false).length;

  const langCounts = feedback.reduce((acc, f) => {
    const l = f.language || "—";
    acc[l] = (acc[l] || 0) + 1;
    return acc;
  }, {});

  const modeCounts = feedback.reduce((acc, f) => {
    const m = f.mode_id || "—";
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});

  const Stat = ({ icon: Icon, label, value, sub }) => (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Stat icon={MessageSquare} label="Всего отзывов" value={total} />
      <Stat icon={Star} label="Средняя оценка" value={avgRating} sub={`${rated.length} с оценкой`} />
      <Stat icon={ThumbsUp} label="Попробует снова" value={`${yesCount} / ${noCount}`} sub="да / нет" />
      <Stat
        icon={Languages}
        label="Языки"
        value={
          <span className="text-base font-medium">
            {Object.entries(langCounts).map(([l, c]) => `${l.toUpperCase()}: ${c}`).join("  ") || "—"}
          </span>
        }
      />
      <Card className="p-4 col-span-2 md:col-span-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
          <Layers className="w-4 h-4" />
          По режимам
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(modeCounts).map(([m, c]) => (
            <span key={m} className="text-sm px-3 py-1 rounded-full bg-secondary text-secondary-foreground">
              {MODE_LABELS[m] || m}: {c}
            </span>
          ))}
          {Object.keys(modeCounts).length === 0 && <span className="text-sm text-muted-foreground">—</span>}
        </div>
      </Card>
    </div>
  );
}