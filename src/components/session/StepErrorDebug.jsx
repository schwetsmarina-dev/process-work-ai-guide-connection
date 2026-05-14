import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchStep } from "@/lib/sessionAI";

export default function StepErrorDebug({ session, stepDebugInfo, navigate, onGreetingCreated }) {
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [recovering, setRecovering] = useState(false);

  const modeId = session?.mode_id || session?.mode || "dream";
  const stepNum = session?.current_step || 1;

  const handleTestFetchStep = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const step = await fetchStep(modeId, stepNum);
      if (step) {
        setTestResult({
          found: true,
          step_key: step.step_key || step._stepKey || "(no key)",
          question_preview: (step.question || "").substring(0, 100),
          step,
        });
      } else {
        setTestResult({ found: false, error: "fetchStep returned null" });
      }
    } catch (e) {
      setTestResult({ found: false, error: e?.message || String(e) });
    }
    setTesting(false);
  };

  const handleUseFoundStep = async () => {
    if (!testResult?.found || !testResult.step) return;
    setRecovering(true);
    try {
      const { base44 } = await import("@/api/base44Client");
      const greeting = `Давай начнём.\n\n${testResult.step.question}`;
      await base44.entities.Message.create({
        session_id: session.id,
        mode_id: modeId,
        step_number: stepNum,
        role: "assistant",
        content: greeting,
        created_at: new Date().toISOString(),
      });
      if (onGreetingCreated) onGreetingCreated();
    } catch (e) {
      alert("Ошибка: " + (e?.message || String(e)));
    }
    setRecovering(false);
  };

  return (
    <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3">
      {/* Build marker */}
      <div className="font-mono text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1 inline-block">
        SESSIONCHAT BUILD: fetchStep diagnostics active
      </div>

      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
        <p className="text-sm font-semibold text-destructive">Шаг не найден (MODE_STEPS)</p>
      </div>

      {stepDebugInfo ? (
        <pre className="text-xs bg-black/5 rounded-lg p-3 font-mono whitespace-pre-wrap text-foreground/80 overflow-x-auto leading-relaxed">
{`modeId         = "${stepDebugInfo.modeId}"
stepNum        = ${stepDebugInfo.stepNum}
stepKey        = "${stepDebugInfo.stepKey}"
totalStepsInDb = ${stepDebugInfo.totalStepsInDb ?? "?"}
allModeIds     = [${stepDebugInfo.allModeIds?.join(", ") || "empty"}]

availableKeys for this mode (${stepDebugInfo.availableKeys?.length ?? 0}):
${stepDebugInfo.availableKeys?.length > 0
  ? stepDebugInfo.availableKeys.join("\n")
  : "  (none — mode not found in MODE_STEPS)"}

DB sample (first 10):
${stepDebugInfo.sampleRows?.join("\n") || "  (empty)"}`}
        </pre>
      ) : (
        <div className="text-xs font-mono bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
          stepDebugInfo is empty — fetchStep failed before diagnostics
          <br />
          session.mode_id = &quot;{session?.mode_id}&quot; | session.current_step = {session?.current_step}
        </div>
      )}

      {/* Live fetchStep test */}
      <div className="space-y-2">
        <Button
          size="sm"
          variant="outline"
          className="border-violet-200 text-violet-700 hover:bg-violet-50"
          disabled={testing}
          onClick={handleTestFetchStep}
        >
          {testing ? "Testing…" : "Test fetchStep(\"dream\", 1) now"}
        </Button>

        {testResult && (
          <div className={`text-xs font-mono rounded-lg px-3 py-2 border ${testResult.found ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            {testResult.found ? (
              <>
                ✅ FOUND<br />
                step_key: {testResult.step_key}<br />
                question: &quot;{testResult.question_preview}…&quot;
              </>
            ) : (
              <>
                ❌ NOT FOUND<br />
                error: {testResult.error}
              </>
            )}
          </div>
        )}

        {testResult?.found && (
          <Button
            size="sm"
            variant="default"
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={recovering}
            onClick={handleUseFoundStep}
          >
            {recovering ? "Создаём приветствие…" : "Use found step and continue"}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Откройте /admin/import и загрузите mode_steps.csv.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => navigate("/dashboard")}>На главную</Button>
        <Button size="sm" variant="outline" onClick={() => navigate("/admin/status")}>Статус данных</Button>
      </div>
    </div>
  );
}