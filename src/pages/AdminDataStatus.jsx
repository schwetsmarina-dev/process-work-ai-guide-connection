import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, AlertTriangle, Database, Trash2, Wrench, RefreshCw, GitMerge, FlaskConical } from "lucide-react";
import { fetchStep } from "@/lib/sessionAI";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const EXPECTED_MODES = ["body", "dream", "conflict", "journaling"];

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
    <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{text}</span>
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
  const queryClient = useQueryClient();
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState(null);
  const [patching, setPatching] = useState(false);
  const [patchResult, setPatchResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState(null);

  const { data: modes = [], isLoading: modesLoading } = useQuery({
    queryKey: ["admin-modes"],
    queryFn: () => base44.entities.Mode.list("sort_order", 200),
  });

  // Fetch ALL steps — up to 500
  const { data: steps = [], isLoading: stepsLoading, refetch: refetchSteps } = useQuery({
    queryKey: ["admin-steps"],
    queryFn: () => base44.entities.ModeStep.list("step_number", 500),
  });

  const { data: terms = [], isLoading: termsLoading } = useQuery({
    queryKey: ["admin-terms"],
    queryFn: () => base44.entities.Term.list("created_date", 500),
  });

  const isLoading = modesLoading || stepsLoading || termsLoading;

  // ── Per-mode diagnostics ─────────────────────────────────────────────────
  const stepsByMode = {};
  for (const mode of EXPECTED_MODES) {
    stepsByMode[mode] = steps.filter((s) => s.mode_id === mode);
  }

  // Unique mode_ids in DB (including unexpected ones)
  const dbModeIds = [...new Set(steps.map((s) => s.mode_id).filter(Boolean))];

  // ── Repair step_key ──────────────────────────────────────────────────────
  const handleRepairStepKeys = async () => {
    setRepairing(true);
    setRepairResult(null);
    const broken = steps.filter((s) => !s.step_key && (s.mode_id || s.step_number));
    let fixed = 0;
    let failed = 0;
    for (const row of broken) {
      const computedKey = `${row.mode_id}_${row.step_number || row.step || "?"}`;
      try {
        await base44.entities.ModeStep.update(row.id, { step_key: computedKey });
        fixed++;
      } catch {
        failed++;
      }
    }
    await refetchSteps();
    await queryClient.invalidateQueries({ queryKey: ["admin-steps"] });
    setRepairResult({ fixed, failed, total: broken.length });
    setRepairing(false);
  };

  // ── Clear all reference data ─────────────────────────────────────────────
  const handleClearReferenceData = async () => {
    setClearing(true);
    setCleared(false);
    const [allModes, allSteps, allTerms] = await Promise.all([
      base44.entities.Mode.list("-created_date", 500),
      base44.entities.ModeStep.list("-created_date", 500),
      base44.entities.Term.list("-created_date", 500),
    ]);
    await Promise.all([
      ...allModes.map((r) => base44.entities.Mode.delete(r.id)),
      ...allSteps.map((r) => base44.entities.ModeStep.delete(r.id)),
      ...allTerms.map((r) => base44.entities.Term.delete(r.id)),
    ]);
    await queryClient.invalidateQueries({ queryKey: ["admin-modes"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-steps"] });
    await queryClient.invalidateQueries({ queryKey: ["admin-terms"] });
    await queryClient.invalidateQueries({ queryKey: ["modes-active"] });
    setClearing(false);
    setCleared(true);
  };

  // Duplicate step_key detection
  const stepKeyCount = {};
  for (const s of steps) {
    if (s.step_key) stepKeyCount[s.step_key] = (stepKeyCount[s.step_key] || 0) + 1;
  }
  const duplicateStepKeys = Object.entries(stepKeyCount)
    .filter(([, count]) => count > 1)
    .map(([key]) => key);

  const brokenSteps = steps.filter((s) => !s.step_key);
  const firstStepsMissing = EXPECTED_MODES.filter((mode) => {
    const first = steps.find((s) => s.step_key === `${mode}_1`);
    return !first;
  });

  // Check if process_mapping steps are present
  const mappingStepsMissing = EXPECTED_MODES.filter((mode) => {
    const s = steps.find((s) => s.step_key === `${mode}_1`);
    return !s || !s.goal?.includes("process mapping");
  });

  const handleTestStepLookup = async () => {
    setTesting(true);
    setTestResults(null);
    const results = {};
    for (const mode of EXPECTED_MODES) {
      try {
        const step = await fetchStep(mode, 1);
        results[mode] = step
          ? { found: true, step_key: step.step_key || step._stepKey, question_preview: (step.question || "").substring(0, 60) }
          : { found: false };
      } catch (e) {
        results[mode] = { found: false, error: e.message };
      }
    }
    setTestResults(results);
    setTesting(false);
  };

  const handlePatchProcessMapping = async () => {
    setPatching(true);
    setPatchResult(null);
    try {
      const res = await base44.functions.invoke("patchProcessMappingSteps", {});
      await queryClient.invalidateQueries({ queryKey: ["admin-steps"] });
      await refetchSteps();
      setPatchResult({ success: true, report: res.data?.report });
    } catch (e) {
      setPatchResult({ success: false, error: e.message });
    }
    setPatching(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-primary" />
          <h1 className="font-serif text-3xl font-semibold">Статус данных</h1>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={repairing || stepsLoading}
            onClick={handleRepairStepKeys}
          >
            {repairing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wrench className="w-4 h-4 mr-2" />}
            Repair step keys
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={testing || stepsLoading}
            onClick={handleTestStepLookup}
            className="border-violet-200 text-violet-700 hover:bg-violet-50"
          >
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-2" />}
            Test step lookup
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={patching || stepsLoading}
            onClick={handlePatchProcessMapping}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            {patching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GitMerge className="w-4 h-4 mr-2" />}
            Patch process mapping
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["admin-modes"] });
              queryClient.invalidateQueries({ queryKey: ["admin-steps"] });
              queryClient.invalidateQueries({ queryKey: ["admin-terms"] });
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Обновить
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={clearing}>
                {clearing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Очистить справочники
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Очистить справочные таблицы?</AlertDialogTitle>
                <AlertDialogDescription>
                  Будут удалены все записи из <strong>MODES</strong>, <strong>MODE_STEPS</strong> и <strong>TERMS</strong>.<br /><br />
                  Сессии, сообщения, пользователи и память — не затрагиваются.<br /><br />
                  После очистки загрузите файлы заново через «Импорт данных».
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearReferenceData} className="bg-destructive hover:bg-destructive/90">
                  Да, удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <p className="text-muted-foreground mb-8 text-sm">
        Состояние базы данных · то, что видит публичное приложение
      </p>

      {/* Notifications */}
      {cleared && <Ok text="Справочные таблицы очищены. Загрузите данные через «Импорт данных»." />}
      {patchResult && (
        <div className="mt-3">
          {patchResult.success
            ? <Ok text={`Process mapping patch applied. ${Object.entries(patchResult.report || {}).map(([m, r]) => `${m}: ${r.skipped ? "skipped" : r.inserted ? `shifted ${r.shifted}, inserted _1` : "error"}`).join(" | ")}`} />
            : <Warning text={`Patch failed: ${patchResult.error}`} />
          }
        </div>
      )}
      {repairResult && (
        <div className="mt-3">
          {repairResult.total === 0
            ? <Ok text="Все step_key уже заполнены — ничего не исправлено." />
            : <Ok text={`Исправлено step_key: ${repairResult.fixed} из ${repairResult.total}. Ошибок: ${repairResult.failed}.`} />
          }
        </div>
      )}
      {testResults && (
        <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-violet-700 flex items-center gap-2">
            <FlaskConical className="w-4 h-4" /> Test public step lookup — fetchStep(mode, 1)
          </p>
          {EXPECTED_MODES.map((mode) => {
            const r = testResults[mode];
            return (
              <div key={mode} className={`flex items-start gap-3 text-sm rounded-md px-3 py-2 ${r?.found ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                {r?.found
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
                  : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />}
                <div>
                  <span className="font-mono font-semibold">{mode}_1</span>
                  {r?.found
                    ? <span className="ml-2 text-green-700">FOUND — step_key: {r.step_key} | "{r.question_preview}…"</span>
                    : <span className="ml-2 text-red-700">NOT FOUND{r?.error ? ` — ${r.error}` : ""}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Counts */}
      <div className="grid grid-cols-3 gap-4 my-8">
        <StatCard label="Режимов (MODES)" count={modes.length} isLoading={modesLoading} />
        <StatCard label="Шагов (MODE_STEPS)" count={steps.length} isLoading={stepsLoading} />
        <StatCard label="Терминов (TERMS)" count={terms.length} isLoading={termsLoading} />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Загружаем...
        </div>
      ) : (
        <div className="space-y-6">

          {/* Duplicate step_keys warning */}
          {duplicateStepKeys.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <AlertTriangle className="w-4 h-4" />
                {duplicateStepKeys.length} дублирующихся step_key — могут сломать сессии:
              </div>
              <div className="text-xs font-mono text-red-600 ml-6 flex flex-wrap gap-1 mt-1">
                {duplicateStepKeys.map((k) => (
                  <span key={k} className="bg-red-100 border border-red-200 rounded px-2 py-0.5">{k} ×{stepKeyCount[k]}</span>
                ))}
              </div>
              <p className="text-xs text-red-600 ml-6">Нажмите «Patch process mapping» — дубликаты будут удалены автоматически.</p>
            </div>
          )}

          {/* Process mapping steps status */}
          {mappingStepsMissing.length > 0 && steps.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                <GitMerge className="w-4 h-4" />
                Отсутствуют шаги картирования процесса (process_mapping):
              </div>
              <div className="text-xs font-mono text-blue-600 ml-6 flex flex-wrap gap-1 mt-1">
                {mappingStepsMissing.map((m) => (
                  <span key={m} className="bg-blue-100 border border-blue-200 rounded px-2 py-0.5">{m}_1 (process mapping)</span>
                ))}
              </div>
              <p className="text-xs text-blue-600 ml-6">Нажмите «Patch process mapping» чтобы добавить их и сдвинуть существующие шаги.</p>
            </div>
          )}

          {mappingStepsMissing.length === 0 && steps.length > 0 && (
            <Ok text="Все шаги картирования процесса (process_mapping) установлены на позиции _1." />
          )}

          {/* Critical: missing first steps */}
          {steps.length === 0 && (
            <Warning text="⛔ Таблица MODE_STEPS ПУСТА. Публичное приложение не сможет вести сессии. Импортируйте mode_steps.csv." />
          )}

          {firstStepsMissing.length > 0 && steps.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <AlertTriangle className="w-4 h-4" />
                Отсутствуют первые шаги — сессии заблокированы:
              </div>
              {firstStepsMissing.map((mode) => (
                <p key={mode} className="text-sm font-mono text-red-700 ml-6">✗ Missing: {mode}_1</p>
              ))}
              <p className="text-xs text-red-600 ml-6">
                DB mode_ids: {dbModeIds.join(", ") || "(пусто)"}
              </p>
            </div>
          )}

          {firstStepsMissing.length === 0 && steps.length > 0 && (
            <Ok text={`Все первые шаги (${EXPECTED_MODES.map((m) => m + "_1").join(", ")}) найдены.`} />
          )}

          {brokenSteps.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                <AlertTriangle className="w-4 h-4" />
                {brokenSteps.length} записей без step_key — нажмите «Repair step keys»
              </div>
              <div className="text-xs font-mono text-amber-600 ml-6 space-y-0.5">
                {brokenSteps.slice(0, 5).map((s) => (
                  <p key={s.id}>id={s.id} mode_id={s.mode_id} step_number={s.step_number}</p>
                ))}
                {brokenSteps.length > 5 && <p>...и ещё {brokenSteps.length - 5}</p>}
              </div>
            </div>
          )}

          {/* Per-mode step breakdown */}
          <div>
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
              Шаги по режимам
            </h2>
            <div className="space-y-4">
              {EXPECTED_MODES.map((mode) => {
                const modeSteps = stepsByMode[mode];
                const hasFirst = modeSteps.some((s) => s.step_key === `${mode}_1`);
                const sortedKeys = modeSteps
                  .map((s) => s.step_key || `[no key, step_number=${s.step_number}]`)
                  .sort();

                return (
                  <Card key={mode} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">{mode}</span>
                        <Badge variant={modeSteps.length > 0 ? "secondary" : "destructive"} className="text-xs">
                          {modeSteps.length} шагов
                        </Badge>
                        {!hasFirst && modeSteps.length > 0 && (
                          <Badge variant="destructive" className="text-xs">нет {mode}_1</Badge>
                        )}
                        {!hasFirst && modeSteps.length === 0 && (
                          <Badge variant="destructive" className="text-xs">нет данных</Badge>
                        )}
                        {hasFirst && (
                          <Badge className="text-xs bg-green-100 text-green-700 border-green-200">✓ {mode}_1</Badge>
                        )}
                      </div>
                    </div>
                    {sortedKeys.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {sortedKeys.map((key) => (
                          <span
                            key={key}
                            className={`text-xs font-mono px-2 py-0.5 rounded ${
                              key === `${mode}_1`
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {key}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-red-600">⛔ Нет шагов для этого режима. Импортируйте mode_steps.csv.</p>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Unexpected mode_ids in DB */}
          {dbModeIds.some((id) => !EXPECTED_MODES.includes(id)) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-700 mb-1">
                Обнаружены неожиданные mode_id в MODE_STEPS:
              </p>
              <p className="text-xs font-mono text-amber-600">
                {dbModeIds.filter((id) => !EXPECTED_MODES.includes(id)).join(", ")}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Ожидаются: {EXPECTED_MODES.join(", ")}. Проверьте колонку mode_id в CSV.
              </p>
            </div>
          )}

          {/* Terms status */}
          {terms.length === 0
            ? <Warning text="Таблица TERMS пуста. AI не будет использовать концепции Process Work." />
            : <Ok text={`TERMS: ${terms.length} терминов доступно.`} />
          }

          {/* Modes status */}
          {modes.length === 0
            ? <Warning text="Таблица MODES пуста. Dashboard не покажет режимы." />
            : <Ok text={`MODES: ${modes.length} режимов: ${modes.map((m) => m.mode_id).join(", ")}`} />
          }
        </div>
      )}
    </div>
  );
}