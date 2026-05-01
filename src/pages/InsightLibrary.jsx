import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, BookOpen, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import InsightCard from "@/components/insights/InsightCard";
import InsightDetailModal from "@/components/insights/InsightDetailModal";

const MODES = ["body", "dream", "conflict", "journaling"];
const IMPORTANCE_OPTS = [1, 2, 3];
const IMPORTANCE_LABELS = { 1: "1 — наблюдение", 2: "2 — значимое", 3: "3 — ключевое" };

export default function InsightLibrary() {
  const [search, setSearch] = useState("");
  const [filterFav, setFilterFav] = useState(false);
  const [filterMode, setFilterMode] = useState(null);
  const [filterImportance, setFilterImportance] = useState(null);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ["insights", currentUser?.email],
    queryFn: () => base44.entities.Insight.filter({ created_by: currentUser.email }, "-created_date", 100),
    enabled: !!currentUser?.email,
  });

  const visible = insights.filter((ins) => {
    if (ins.is_archived) return false;
    if (filterFav && !ins.is_favorite) return false;
    if (filterMode && ins.source_mode !== filterMode) return false;
    if (filterImportance && ins.importance !== filterImportance) return false;
    if (search) {
      const q = search.toLowerCase();
      const searchIn = `${ins.title} ${ins.insight_text} ${ins.tags || ""} ${ins.state_keywords || ""}`.toLowerCase();
      if (!searchIn.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-semibold">Библиотека инсайтов</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Место, где сохраняются важные внутренние открытия из твоих сессий.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию, тексту, тегам..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          size="sm"
          variant={filterFav ? "default" : "outline"}
          onClick={() => setFilterFav((v) => !v)}
          className="gap-1.5"
        >
          <Star className={`w-3.5 h-3.5 ${filterFav ? "fill-primary-foreground" : ""}`} />
          Избранные
        </Button>

        {MODES.map((m) => (
          <Button
            key={m}
            size="sm"
            variant={filterMode === m ? "default" : "outline"}
            onClick={() => setFilterMode(filterMode === m ? null : m)}
          >
            {m}
          </Button>
        ))}

        <div className="w-px bg-border mx-1 self-stretch" />

        {IMPORTANCE_OPTS.map((i) => (
          <Button
            key={i}
            size="sm"
            variant={filterImportance === i ? "default" : "outline"}
            onClick={() => setFilterImportance(filterImportance === i ? null : i)}
          >
            {IMPORTANCE_LABELS[i]}
          </Button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {insights.length === 0
              ? "Пока здесь нет инсайтов. Заверши сессию или сохрани важную мысль из диалога."
              : "Нет инсайтов по выбранным фильтрам."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-4">{visible.length} инсайтов</p>
          <div className="grid gap-3">
            {visible.map((ins) => (
              <InsightCard key={ins.id} insight={ins} onClick={setSelectedInsight} />
            ))}
          </div>
        </>
      )}

      {/* Detail modal */}
      {selectedInsight && (
        <InsightDetailModal
          insight={selectedInsight}
          onClose={() => setSelectedInsight(null)}
        />
      )}
    </div>
  );
}