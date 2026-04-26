import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertTriangle, Database } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function StatCard({ label, count, isLoading }) {
  return (
    <Card className="p-5 flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <p className="text-3xl font-serif font-bold">{count}</p>
      )}
    </Card>
  );
}

function Warning({ text }) {
  return (
    <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      {text}
    </div>
  );
}

function Ok({ text }) {
  return (
    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      {text}
    </div>
  );
}

export default function AdminDataStatus() {
  const { data: modes = [], isLoading: modesLoading } = useQuery({
    queryKey: ["admin-modes"],
    queryFn: () => base44.entities.Mode.list(),
  });

  const { data: steps = [], isLoading: stepsLoading } = useQuery({
    queryKey: ["admin-steps"],
    queryFn: () => base44.entities.ModeStep.list(),
  });

  const { data: terms = [], isLoading: termsLoading } = useQuery({
    queryKey: ["admin-terms"],
    queryFn: () => base44.entities.Term.list(),
  });

  const isLoading = modesLoading || stepsLoading || termsLoading;

  // Find rows with missing required fields
  const invalidSteps = steps.filter(
    (s) => !s.step_key || !s.mode_id || !s.step_number || !s.question
  );

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="flex items-center gap-3 mb-2">
        <Database className="w-6 h-6 text-primary" />
        <h1 className="font-serif text-3xl font-semibold">Статус данных</h1>
      </div>
      <p className="text-muted-foreground mb-8 text-sm">
        Состояние базы данных, необходимой для работы чат-бота
      </p>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Режимов (MODES)" count={modes.length} isLoading={modesLoading} />
        <StatCard label="Шагов (MODE_STEPS)" count={steps.length} isLoading={stepsLoading} />
        <StatCard label="Терминов (TERMS)" count={terms.length} isLoading={termsLoading} />
      </div>

      {/* Diagnostics */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
          Диагностика
        </h2>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Проверяем...
          </div>
        ) : (
          <>
            {steps.length === 0 && (
              <Warning text="⚠ Таблица MODE_STEPS пуста. Чат-бот не сможет вести сессии." />
            )}
            {steps.length > 0 && (
              <Ok text={`MODE_STEPS: ${steps.length} записей загружено.`} />
            )}

            {terms.length === 0 && (
              <Warning text="⚠ Таблица TERMS пуста. AI не будет использовать концепции Process Work." />
            )}
            {terms.length > 0 && (
              <Ok text={`TERMS: ${terms.length} терминов доступно для AI-контекста.`} />
            )}

            {modes.length === 0 && (
              <Warning text="⚠ Таблица MODES пуста. Не удастся выбрать режим." />
            )}
            {modes.length > 0 && (
              <Ok text={`MODES: ${modes.length} режимов активно.`} />
            )}

            {invalidSteps.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-3">
                  <AlertTriangle className="w-4 h-4" />
                  {invalidSteps.length} шагов с неполными данными:
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {invalidSteps.map((s) => (
                    <div
                      key={s.id}
                      className="text-xs font-mono bg-white rounded p-2 border border-amber-100 flex flex-wrap gap-2"
                    >
                      <span>id: {s.id}</span>
                      {!s.step_key && <Badge variant="destructive" className="text-[10px]">нет step_key</Badge>}
                      {!s.mode_id && <Badge variant="destructive" className="text-[10px]">нет mode_id</Badge>}
                      {!s.step_number && <Badge variant="destructive" className="text-[10px]">нет step_number</Badge>}
                      {!s.question && <Badge variant="destructive" className="text-[10px]">нет question</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {invalidSteps.length === 0 && steps.length > 0 && (
              <Ok text="Все записи MODE_STEPS содержат обязательные поля." />
            )}
          </>
        )}
      </div>
    </div>
  );
}