import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/i18n";

const LABELS = {
  ru: {
    insight: "Осознание", insights: "Осознание",
    theme: "Тема", themes: "Тема",
    pattern: "Паттерн", patterns: "Паттерн", detected_pattern: "Замеченный паттерн",
    body_signal: "Телесный сигнал", body_signals: "Телесные сигналы",
    edge: "Край", edge_figure: "Краевая фигура", primary_process: "Первичный процесс", secondary_process: "Вторичный процесс",
    resource: "Ресурс", resources: "Ресурсы", progress: "Продвижение", change: "Изменение",
    other: "Наблюдение",
  },
  es: {
    insight: "Descubrimiento", insights: "Descubrimiento",
    theme: "Tema", themes: "Tema",
    pattern: "Patrón", patterns: "Patrón", detected_pattern: "Patrón observado",
    body_signal: "Señal corporal", body_signals: "Señales corporales",
    edge: "Borde", edge_figure: "Figura del borde", primary_process: "Proceso primario", secondary_process: "Proceso secundario",
    resource: "Recurso", resources: "Recursos", progress: "Avance", change: "Cambio",
    other: "Observación",
  },
};

const COPY = {
  ru: {
    empty: "Пока нет сохранённых наблюдений.",
    error: "Не удалось загрузить наблюдения. Обнови страницу, чтобы попробовать ещё раз.",
    hint: "Наблюдения из твоих сессий. Их можно подтвердить, исправить или исключить в настройках памяти.",
    confirmed: "Подтверждено тобой", corrected: "Исправлено тобой", excluded: "Не используется ИИ",
  },
  es: {
    empty: "Todavía no hay observaciones guardadas.",
    error: "No se pudieron cargar las observaciones. Actualiza la página para volver a intentarlo.",
    hint: "Observaciones de tus sesiones. Puedes confirmarlas, corregirlas o excluirlas en los ajustes de memoria.",
    confirmed: "Confirmado por ti", corrected: "Corregido por ti", excluded: "No se usa por la IA",
  },
};

function observationText(memory) {
  // Canonical content wins, including user edits. Legacy values are read only
  // when the canonical field is absent; never resurrect a cleared value.
  const value = memory.memory_value ?? memory.value;
  return typeof value === "string" ? value.trim() : "";
}

export default function KeyObservations({ memories = [], lang = "es", error = false }) {
  const labels = LABELS[lang] || LABELS.es;
  const copy = COPY[lang] || COPY.es;
  const visible = memories.filter(memory => memory && memory.is_active !== false && memory.user_status !== "rejected" && observationText(memory)).slice(0, 10);

  return (
    <Card className="p-6" data-testid="key-observations">
      <h3 className="font-semibold text-sm mb-2">{t("key_observations", lang)}</h3>
      {error ? (
        <p role="alert" className="text-sm text-muted-foreground">{copy.error}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-4">{copy.hint}</p>
          <ul className="space-y-4">
            {visible.map(memory => {
              const label = [memory.memory_type, memory.memory_key, memory.category].map(key => labels[key]).find(value => typeof value === "string") || labels.other;
              const status = memory.excluded_from_ai ? copy.excluded : ["confirmed", "corrected"].includes(memory.user_status) ? copy[memory.user_status] : "";
              return (
                <li key={memory.id} className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{label}</Badge>
                    {status && <span className="text-xs text-muted-foreground">{status}</span>}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{observationText(memory)}</p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
