import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare } from "lucide-react";
import FeedbackSummary from "@/components/admin/FeedbackSummary";
import FeedbackCard from "@/components/admin/FeedbackCard";

export default function AdminFeedback() {
  const navigate = useNavigate();
  const [language, setLanguage] = React.useState("all");
  const [rating, setRating] = React.useState("all");
  const [wouldUseAgain, setWouldUseAgain] = React.useState("all");
  const [modeId, setModeId] = React.useState("all");

  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: () => base44.entities.SessionFeedback.list("-created_date", 500),
  });

  React.useEffect(() => {
    if (!isLoading) {
      const rated = feedback.filter((f) => typeof f.rating === "number");
      const avg = rated.length ? rated.reduce((s, f) => s + f.rating, 0) / rated.length : 0;
      console.log("[ADMIN_FEEDBACK_LOADED]", { count: feedback.length, averageRating: Number(avg.toFixed(2)) });
    }
  }, [isLoading, feedback]);

  const filtered = useMemo(() => {
    return feedback.filter((f) => {
      if (language !== "all" && f.language !== language) return false;
      if (rating !== "all" && f.rating !== Number(rating)) return false;
      if (wouldUseAgain === "yes" && f.would_use_again !== true) return false;
      if (wouldUseAgain === "no" && f.would_use_again !== false) return false;
      if (modeId !== "all" && f.mode_id !== modeId) return false;
      return true;
    });
  }, [feedback, language, rating, wouldUseAgain, modeId]);

  const FilterSelect = ({ value, onChange, options, placeholder }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-serif font-semibold">Отзывы beta-тестеров</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Загрузка…
        </div>
      ) : (
        <>
          <FeedbackSummary feedback={feedback} />

          <div className="flex flex-wrap gap-2 mb-5">
            <FilterSelect
              value={language}
              onChange={setLanguage}
              placeholder="Язык"
              options={[
                { value: "all", label: "Все языки" },
                { value: "ru", label: "RU" },
                { value: "es", label: "ES" },
              ]}
            />
            <FilterSelect
              value={rating}
              onChange={setRating}
              placeholder="Оценка"
              options={[
                { value: "all", label: "Все оценки" },
                ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} ★` })),
              ]}
            />
            <FilterSelect
              value={wouldUseAgain}
              onChange={setWouldUseAgain}
              placeholder="Повторно"
              options={[
                { value: "all", label: "Повторно: все" },
                { value: "yes", label: "Да" },
                { value: "no", label: "Нет" },
              ]}
            />
            <FilterSelect
              value={modeId}
              onChange={setModeId}
              placeholder="Режим"
              options={[
                { value: "all", label: "Все режимы" },
                { value: "dream", label: "Сон" },
                { value: "body", label: "Тело" },
                { value: "conflict", label: "Конфликт" },
                { value: "journaling", label: "Дневник" },
              ]}
            />
          </div>

          <div className="text-sm text-muted-foreground mb-3">
            Показано: {filtered.length} из {feedback.length}
          </div>

          <div className="space-y-3">
            {filtered.map((item) => (
              <FeedbackCard
                key={item.id}
                item={item}
                onOpenSession={(sid) =>
                  navigate(
                    `/session/${sid}/summary?from=feedback` +
                    `&fe=${encodeURIComponent(item.user_email || "")}` +
                    `&fc=${encodeURIComponent(item.created_at || item.created_date || "")}`
                  )
                }
              />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground text-sm">
                Отзывов не найдено
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}