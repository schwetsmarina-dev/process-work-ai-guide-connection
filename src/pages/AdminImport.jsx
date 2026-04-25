import React from "react";
import ImportSection from "@/components/admin/ImportSection";

const MODE_STEP_FIELDS = [
  "mode_id", "step_number", "step_key", "goal", "question",
  "response_type", "save_to_memory_key", "is_required",
  "next_step_on_answer", "next_step_on_skip", "related_term_ids",
  "facilitator_hint", "possible_mode_shift", "pending_mode"
];

const TERM_FIELDS = [
  "term_id", "term", "category", "is_cross_cutting", "primary_mode_id",
  "mode_ids", "short_definition", "practical_application",
  "related_terms", "search_tags", "source", "source_sheet", "aliases", "notes"
];

const MODE_FIELDS = [
  "mode_id", "mode_name_ru", "mode_name_en", "description",
  "start_message", "sort_order", "is_active"
];

export default function AdminImport() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-semibold mb-2">Импорт данных</h1>
        <p className="text-muted-foreground text-sm">
          Загружайте CSV-файлы для заполнения справочников. Поля сопоставляются автоматически по названию.
        </p>
      </div>

      <ImportSection
        title="Шаги режимов (MODE_STEPS)"
        entityName="ModeStep"
        dbFields={MODE_STEP_FIELDS}
      />

      <ImportSection
        title="Глоссарий (TERMS)"
        entityName="Term"
        dbFields={TERM_FIELDS}
      />

      <ImportSection
        title="Режимы (MODES)"
        entityName="Mode"
        dbFields={MODE_FIELDS}
      />
    </div>
  );
}