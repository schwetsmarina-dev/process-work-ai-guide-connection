import React, { useEffect, useState } from "react";
import { isAdmin as hasAdminRole } from "@/lib/roles";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertTriangle, MessageCircle, HeartPulse, Scale, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RecentSessionCard from "@/components/dashboard/RecentSessionCard";
import ModeCardDB from "@/components/dashboard/ModeCardDB";
import AdminPanel from "@/components/dashboard/AdminPanel";
import ExistingSessionDialog from "@/components/dashboard/ExistingSessionDialog";
import ContinueThemeDialog from "@/components/dashboard/ContinueThemeDialog";
import ConsistencyCalendar from "@/components/dashboard/ConsistencyCalendar";
import { normalizeLang, t } from "@/lib/i18n";
import { startSession } from "@/lib/sessionApi";
import { MODE_LABELS } from "@/lib/modeSteps";
import { listMessages } from "@/lib/messageApi";
import UpgradePrompt from "@/components/billing/UpgradePrompt";
import SuggestedPractices from "@/components/client/SuggestedPractices";

const UNAVAILABLE_SUMMARY_MARKERS = [
  "резюме недоступно",
  "сессия завершена. резюме недоступно",
  "summary unavailable",
  "resumen no disponible",
];

const EDGE_FIGURE_MARKERS = [
  "внутренний критик", "внутренняя критика", "внутренний цензор",
  "внутренний голос", "голос внутри", "запрещающая часть", "критикующая часть",
  "осуждающая часть", "контролирующая часть",
  "crítico interior", "crítica interior", "voz interior", "voz crítica",
  "parte que prohíbe", "parte crítica", "parte controladora",
];

const EDGE_FUNCTION_MARKERS = [
  "запрещает", "не разрешает", "не позволяет", "мешает", "останавливает",
  "удерживает", "не пускает", "критикует", "осуждает", "обесценивает",
  "нельзя", "стыдно", "не имею права", "не заслуживаю",
  "no me deja", "no me permite", "me impide", "me frena", "me critica", "me juzga",
];

function isUnavailableSummary(value) {
  const lower = String(value || "").trim().toLowerCase();
  return !!lower && UNAVAILABLE_SUMMARY_MARKERS.some((m) => lower.includes(m));
}

function textArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).join("; ") : "";
}

function detectEdgeFigureText(text) {
  const raw = String(text || "").trim();
  const lower = raw.toLowerCase();
  if (!lower) return null;
  const direct = EDGE_FIGURE_MARKERS.some((m) => lower.includes(m));
  const functional = EDGE_FUNCTION_MARKERS.some((m) => lower.includes(m));
  if (!direct && !functional) return null;

  const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const hit = lines.find((line) => {
    const l = line.toLowerCase();
    return EDGE_FIGURE_MARKERS.some((m) => l.includes(m)) ||
      (EDGE_FUNCTION_MARKERS.some((m) => l.includes(m)) && (l.includes("голос") || l.includes("част") || l.includes("voz") || l.includes("parte")));
  });
  return (hit || raw).slice(0, 700);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [pendingMode, setPendingMode] = useState(null);
  const [existingActive, setExistingActive] = useState(null);
  const [lastCompletedForMode, setLastCompletedForMode] = useState(null);
  const lang = normalizeLang(appUser?.language);
  const [quotaBlockedMode, setQuotaBlockedMode] = useState(null);
  const [freeText, setFreeText] = useState("");
  const [routingSuggestion, setRoutingSuggestion] = useState(null);

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      setCurrentUser(u);
      const rows = await base44.entities.AppUser.filter({ email: u?.email });
      setAppUser(rows[0] || null);
    })();
  }, []);

  const { data: modes = [], isLoading: modesLoading } = useQuery({
    queryKey: ["modes-active"],
    queryFn: () => base44.entities.Mode.filter({ is_active: true }, "sort_order"),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["sessions", currentUser?.email],
    queryFn: () => base44.entities.Session.filter({ user_id: currentUser.id }, "-created_date", 10),
    enabled: !!currentUser?.id,
  });

  const { data: completedSessions = [] } = useQuery({
    queryKey: ["sessions-completed", currentUser?.email],
    queryFn: () =>
      base44.entities.Session.filter(
        { user_id: currentUser.id, status: "completed" },
        "-created_date",
        500
      ),
    enabled: !!currentUser?.email,
  });

  const isAdmin = hasAdminRole(currentUser);
  const activeSession = sessions.find((s) => s.status === "active");
  const recentSessions = sessions.filter((s) => s.status !== "active").slice(0, 5);

  const hasStoredContinuationMaterial = (session) => {
    if (!session) return false;
    const summary = String(session.summary || "").trim();
    const hasRealSummary = summary && !isUnavailableSummary(summary);
    return Boolean(
      hasRealSummary ||
      String(session.next_step_suggestion || "").trim() ||
      (Array.isArray(session.edge_signals) && session.edge_signals.some(Boolean)) ||
      (Array.isArray(session.primary_process) && session.primary_process.some(Boolean)) ||
      (Array.isArray(session.secondary_process) && session.secondary_process.some(Boolean))
    );
  };

  const enrichFromTranscript = async (session) => {
    try {
      const msgs = await listMessages(session.id);
      const transcript = (msgs || [])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
        .join("\n");
      if (!transcript.trim()) return null;

      const edgeFigure = detectEdgeFigureText(transcript);
      const lastUser = [...(msgs || [])].reverse().find((m) => m.role === "user")?.content || "";
      const lastAssistant = [...(msgs || [])].reverse().find((m) => m.role === "assistant")?.content || "";
      const fallbackPreview = lastUser || lastAssistant;

      if (edgeFigure) {
        return {
          ...session,
          _recovered_from_transcript: true,
          _continuation_preview: edgeFigure,
          _continuation_context:
            `ПРОДОЛЖЕНИЕ ЗАВЕРШЁННОЙ СЕССИИ. В предыдущей работе уже выявилась краевая фигура/функция: «${edgeFigure}». ` +
            `Это не новая тема и не новый сон. Не проси повторять материал и не возвращайся к картированию с нуля. ` +
            `Продолжай работу с этой фигурой: её голосом, запретом, функцией и тем, что она не допускает.\n\n` +
            `Фрагмент предыдущей сессии для контекста:\n${transcript.slice(-2400)}`,
        };
      }

      if (!hasStoredContinuationMaterial(session) && fallbackPreview) {
        return {
          ...session,
          _recovered_from_transcript: true,
          _continuation_preview: String(fallbackPreview).slice(0, 700),
          _continuation_context:
            `ПРОДОЛЖЕНИЕ ЗАВЕРШЁННОЙ СЕССИИ. Резюме в записи отсутствует, поэтому восстанови контекст по фрагменту диалога. ` +
            `Не начинай режим с нуля и не проси повторять уже сказанное.\n\n${transcript.slice(-2400)}`,
        };
      }
    } catch (e) {
      console.warn("[SessionFlow] transcript recovery failed for", session?.id, e?.message);
    }
    return null;
  };

  const findContinuationSession = async (modeId) => {
    try {
      const completedInMode = await base44.entities.Session.filter(
        { user_id: currentUser.id, status: "completed", mode_id: modeId },
        "-created_date",
        50
      );
      const rows = completedInMode || [];

      for (const candidate of rows.slice(0, 15)) {
        const storedEvidence = [
          isUnavailableSummary(candidate.summary) ? "" : candidate.summary,
          candidate.next_step_suggestion,
          textArray(candidate.edge_signals),
          textArray(candidate.primary_process),
          textArray(candidate.secondary_process),
        ].filter(Boolean).join("\n");

        const storedEdge = detectEdgeFigureText(storedEvidence);
        if (storedEdge) {
          return {
            ...candidate,
            _continuation_preview: storedEdge,
            _continuation_context: storedEvidence,
          };
        }

        const recovered = await enrichFromTranscript(candidate);
        if (recovered && detectEdgeFigureText(recovered._continuation_context || recovered._continuation_preview)) {
          return recovered;
        }
      }

      const stored = rows.find(hasStoredContinuationMaterial);
      if (stored) return stored;

      for (const candidate of rows.slice(0, 15)) {
        const recovered = await enrichFromTranscript(candidate);
        if (recovered) return recovered;
      }
      return null;
    } catch (e) {
      console.error("[SessionFlow] lookup of continuation session failed:", e?.message);
      return null;
    }
  };

  const offerContinuationOrCreate = async (mode) => {
    const previous = await findContinuationSession(mode.mode_id);
    if (previous) {
      setPendingMode(mode);
      setLastCompletedForMode(previous);
      return;
    }
    await createSession(mode);
  };

  const findMode = (kind) => modes.find((m) => String(m.mode_id || "").toLowerCase().includes(kind));

  const handleQuickStart = async (kind) => {
    const routes = {
      anxiety: { mode: "body", context: lang === "es" ? "Quiero empezar por lo que siento ahora. Hay ansiedad o tensión y necesito primero orientarme en la experiencia presente, sin interpretar ni diagnosticar." : "Я хочу начать с того, что чувствую сейчас. Есть тревога или напряжение; помоги сначала сориентироваться в текущем переживании, без интерпретаций и диагнозов." },
      situation: { mode: "journ", context: lang === "es" ? "Quiero contar una situación que acaba de ocurrir y entender qué me afectó más. Sigue la señal más viva y, si aparece un conflicto claro, explora las polaridades." : "Я хочу рассказать о ситуации, которая произошла, и понять, что задело меня сильнее всего. Следуй за самым живым сигналом; если проявится конфликт, исследуй полярности." },
      decision: { mode: "conflict", context: lang === "es" ? "Necesito tomar una decisión. Ayúdame a explorar las dos posiciones sin decidir por mí: sus señales, necesidades, polaridades y lo que aparece en el borde." : "Мне нужно принять решение. Помоги исследовать две позиции, не решая за меня: их сигналы, потребности, полярности и то, что появляется у края." },
      talk: { mode: "journ", context: lang === "es" ? "Quiero empezar hablando libremente de lo que me pasa. No necesito elegir una técnica; sigue la señal más significativa que aparezca y propón el siguiente paso con suavidad." : "Я хочу начать со свободного рассказа о том, что со мной происходит. Мне не нужно выбирать технику; следуй за наиболее значимым сигналом и мягко предложи следующий шаг." },
    };
    const route = routes[kind];
    const mode = findMode(route.mode);
    if (!mode) return;
    await createSession(mode, { carryOverContext: route.context });
  };

  const classifyFreeText = (text) => {
    const value = String(text || "").trim().toLowerCase();
    if (!value) return null;
    const groups = [
      { kind: "body", score: 0, words: ["тело", "телес", "боль", "напряж", "сердце", "живот", "дых", "тревог", "паник", "ansiedad", "cuerpo", "dolor", "tensión", "respirar", "respiración", "pecho"] },
      { kind: "dream", score: 0, words: ["сон", "снилось", "приснил", "кошмар", "sueño", "soñé", "pesadilla"] },
      { kind: "conflict", score: 0, words: ["решени", "выбор", "сомнева", "между", "конфликт", "ссор", "отношен", "не знаю как поступить", "decisión", "elegir", "duda", "conflicto", "discusión", "relación", "no sé qué hacer"] },
      { kind: "journ", score: 0, words: ["произош", "случил", "задел", "обид", "груст", "стыд", "зл", "хочу понять", "поговорить", "pasó", "ocurrió", "me afectó", "triste", "vergüenza", "rabia", "quiero entender", "hablar"] },
    ];
    for (const group of groups) {
      for (const word of group.words) if (value.includes(word)) group.score += 1;
    }
    groups.sort((a, b) => b.score - a.score);
    const best = groups[0];
    return best.score > 0 ? best.kind : "journ";
  };

  const suggestRouteFromText = () => {
    const modeKind = classifyFreeText(freeText);
    const mode = modeKind ? findMode(modeKind) : null;
    if (!mode) return;
    setRoutingSuggestion({ mode, text: freeText.trim() });
  };

  const startSuggestedRoute = async (mode = routingSuggestion?.mode) => {
    if (!mode || !routingSuggestion?.text) return;
    const context = lang === "es"
      ? `El usuario empezó describiendo libremente su situación: «${routingSuggestion.text}». Usa este texto como material inicial. La ruta fue sugerida por Talvira, pero no la presentes como diagnóstico ni como una clasificación definitiva.`
      : `Пользователь начал со свободного описания ситуации: «${routingSuggestion.text}». Используй этот текст как исходный материал. Маршрут предложен Talvira, но не представляй его как диагноз или окончательную классификацию.`;
    setRoutingSuggestion(null);
    setFreeText("");
    await createSession(mode, { carryOverContext: context });
  };

  const handleModeSelect = async (mode) => {
    const modeId = mode.mode_id;
    const existing = sessions.find((s) => s.status === "active" && (s.mode_id || s.mode) === modeId);
    if (existing) {
      console.log("[SessionFlow] existing active session found for mode:", modeId, "→", existing.id);
      setPendingMode(mode);
      setExistingActive(existing);
      return;
    }
    await offerContinuationOrCreate(mode);
  };

  const handleContinueTheme = async () => {
    const mode = pendingMode;
    const prev = lastCompletedForMode;
    setLastCompletedForMode(null);
    setPendingMode(null);
    if (!mode || !prev) return;

    const carrySource =
      prev._continuation_context ||
      prev.next_step_suggestion ||
      (!isUnavailableSummary(prev.summary) ? prev.summary : "") ||
      prev._continuation_preview ||
      "";

    const carryOverContext = carrySource
      ? `Пользователь возвращается к теме прошлой завершённой сессии. ${carrySource}`
      : "";

    await createSession(mode, { continuedFromSessionId: prev.id, carryOverContext });
  };

  const handleStartNewTheme = async () => {
    const mode = pendingMode;
    setLastCompletedForMode(null);
    setPendingMode(null);
    if (mode) await createSession(mode);
  };

  const handleContinueExisting = () => {
    if (existingActive) navigate(`/session/${existingActive.id}`);
    setExistingActive(null);
    setPendingMode(null);
  };

  const handleStartNew = async () => {
    const mode = pendingMode;
    if (existingActive) {
      await base44.entities.Session.update(existingActive.id, {
        status: "abandoned",
        ended_at: new Date().toISOString(),
      }).catch(() => {});
    }
    setExistingActive(null);
    setPendingMode(null);
    if (mode) await createSession(mode);
  };

  /**
   * @param {any} mode
   * @param {{ continuedFromSessionId?: any, carryOverContext?: any }} [options]
   */
  const createSession = async (mode, { continuedFromSessionId, carryOverContext } = {}) => {
    const modeId = mode.mode_id;
    const stepKey = `${modeId}_1`;

    console.log("[SessionFlow] mode selected:", modeId, "looking up step_key:", stepKey);

    let allModeSteps = [];
    try {
      allModeSteps = await base44.entities.ModeStep.filter({ mode_id: modeId });
    } catch (e) {
      try {
        const all = await base44.entities.ModeStep.list("step_number", 500);
        allModeSteps = all.filter((s) => String(s.mode_id || "").trim() === modeId);
      } catch (e2) {
        console.error("[SessionFlow] Cannot read ModeStep:", e2.message);
      }
    }

    const firstStep =
      allModeSteps.find((s) => String(s.step_key || "").trim() === stepKey) ||
      allModeSteps.find((s) => Number(s.step_number) === 1) ||
      allModeSteps.find((s) => Number(s.step) === 1) ||
      allModeSteps.find((s) => String(s.step_key || "").endsWith("_1"));

    if (!firstStep) {
      const allSample = await base44.entities.ModeStep.list("step_number", 10).catch(() => []);
      const allModeIds = [...new Set(allSample.map((s) => s.mode_id).filter(Boolean))];
      const allKeys = allModeSteps.map((s) => s.step_key || `[no key, step_number=${s.step_number}]`).join(", ") || "(none)";
      console.error(`[SessionFlow] First step not found! mode_id=${modeId} step_key=${stepKey}`);
      alert(
        `First step not found for mode "${modeId}".\n\n` +
        `step_key: ${stepKey}\n` +
        `Steps for this mode: ${allKeys}\n` +
        `All mode_id values in DB: ${allModeIds.join(", ") || "(empty)"}\n` +
        `ModeStep records visible to this user: ${allSample.length}`
      );
      return;
    }

    if (!currentUser?.id) {
      alert(t("profile_not_loaded", lang));
      return;
    }

    const result = await startSession(modeId, { continuedFromSessionId, carryOverContext });
    if (result.blocked) {
      setQuotaBlockedMode(modeId);
      return;
    }
    const session = result.session;

    if (appUser?.id) {
      await base44.entities.AppUser.update(appUser.id, { last_session_id: session.id }).catch(() => {});
    }

    navigate(`/session/${session.id}`);
  };

  const continuationPreview = lastCompletedForMode
    ? (
        lastCompletedForMode._continuation_preview ||
        lastCompletedForMode.next_step_suggestion ||
        (!isUnavailableSummary(lastCompletedForMode.summary) ? lastCompletedForMode.summary : "") ||
        textArray(lastCompletedForMode.edge_signals) ||
        textArray(lastCompletedForMode.secondary_process) ||
        textArray(lastCompletedForMode.primary_process)
      )
    : "";

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-semibold mb-2">{t("welcome", lang)}</h1>
        <p className="text-muted-foreground">{lang === "es" ? "¿Qué está pasando contigo ahora? Cuéntalo con tus palabras o elige por dónde empezar." : "Что с тобой происходит сейчас? Расскажи своими словами или выбери, с чего начать."}</p>
      </div>

      {modes.length > 0 && (
        <div className="mb-8 rounded-2xl border bg-card p-4 md:p-5">
          <Textarea
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={lang === "es" ? "Por ejemplo: «He discutido con mi pareja y no entiendo por qué me afectó tanto…»" : "Например: «Я поругалась с партнёром и не понимаю, почему меня это так задело…»"}
            className="min-h-[96px] resize-y rounded-xl"
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={suggestRouteFromText} disabled={!freeText.trim()}>
              {lang === "es" ? "Sugerir por dónde empezar" : "Предложить, с чего начать"}
            </Button>
          </div>
        </div>
      )}

      {modes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {[
            ["anxiety", HeartPulse, lang === "es" ? "Siento ansiedad" : "Мне тревожно"],
            ["situation", Sparkles, lang === "es" ? "Quiero entender una situación" : "Хочу разобрать ситуацию"],
            ["decision", Scale, lang === "es" ? "No puedo tomar una decisión" : "Не могу принять решение"],
            ["talk", MessageCircle, lang === "es" ? "Quiero simplemente hablar" : "Хочу просто поговорить"],
          ].map(([kind, Icon, label]) => (
            <Button key={kind} variant="outline" className="h-auto min-h-14 justify-start gap-3 rounded-2xl px-4 py-3 text-left whitespace-normal" onClick={() => handleQuickStart(kind)}>
              <Icon className="w-5 h-5 shrink-0 text-primary" />
              <span>{label}</span>
            </Button>
          ))}
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm font-medium">{lang === "es" ? "O elige directamente un modo de exploración" : "Или выбери направление исследования напрямую"}</p>
      </div>

      {isAdmin && <AdminPanel />}

      {quotaBlockedMode && (
        <div className="mb-6">
          <UpgradePrompt lang={lang} variant="quota" onDismiss={() => setQuotaBlockedMode(null)} />
        </div>
      )}

      <Dialog open={!!routingSuggestion} onOpenChange={(open) => { if (!open) setRoutingSuggestion(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "es" ? "Talvira sugiere empezar aquí" : "Talvira предлагает начать здесь"}</DialogTitle>
            <DialogDescription>
              {routingSuggestion ? (
                lang === "es"
                  ? `Por lo que has escrito, parece útil empezar con «${MODE_LABELS[routingSuggestion.mode.mode_id]?.es || routingSuggestion.mode.mode_name_ru || routingSuggestion.mode.mode_id}». Puedes aceptar esta ruta o elegir otra.`
                  : `По твоему описанию полезно начать с «${MODE_LABELS[routingSuggestion.mode.mode_id]?.ru || routingSuggestion.mode.mode_name_ru || routingSuggestion.mode.mode_id}». Можно принять этот маршрут или выбрать другой.`
              ) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {modes.map((mode) => (
              <Button
                key={mode.id}
                variant={routingSuggestion?.mode?.id === mode.id ? "default" : "outline"}
                className="h-auto min-h-12 whitespace-normal"
                onClick={() => setRoutingSuggestion((prev) => prev ? { ...prev, mode } : prev)}
              >
                {MODE_LABELS[mode.mode_id]?.[lang] || mode.mode_name_ru || mode.mode_id}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => startSuggestedRoute()}>{lang === "es" ? "Empezar" : "Начать"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExistingSessionDialog
        open={!!existingActive}
        onContinue={handleContinueExisting}
        onStartNew={handleStartNew}
        onOpenChange={(o) => { if (!o) { setExistingActive(null); setPendingMode(null); } }}
        lang={lang}
      />

      <ContinueThemeDialog
        open={!!lastCompletedForMode}
        summary={continuationPreview}
        onContinueTheme={handleContinueTheme}
        onStartNew={handleStartNewTheme}
        onOpenChange={(o) => { if (!o) { setLastCompletedForMode(null); setPendingMode(null); } }}
        lang={lang}
      />

      {activeSession && (
        <div className="mb-8 p-5 rounded-2xl border-2 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary mb-1">{t("unfinished_session", lang)}</p>
              <p className="text-sm text-muted-foreground">{activeSession.mode_id || activeSession.mode}</p>
            </div>
            <Button onClick={() => navigate(`/session/${activeSession.id}`)}>{t("continue", lang)}</Button>
          </div>
        </div>
      )}

      {modesLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : modes.length === 0 ? (
        <div className="flex items-start gap-3 p-5 rounded-2xl border border-amber-200 bg-amber-50 mb-8">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 text-sm">{t("modes_not_configured", lang)}</p>
            <p className="text-amber-700 text-xs mt-1">{t("modes_not_configured_text", lang)}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {modes.map((mode) => <ModeCardDB key={mode.id} mode={mode} onClick={handleModeSelect} lang={lang} />)}
        </div>
      )}

      {currentUser?.email && (
        <div className="mb-12"><SuggestedPractices clientEmail={currentUser.email} /></div>
      )}

      {completedSessions.length > 0 && <ConsistencyCalendar sessions={completedSessions} lang={lang} />}

      {sessionsLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : recentSessions.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl font-semibold">{t("recent_sessions", lang)}</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>{t("all_sessions", lang)}</Button>
          </div>
          <div className="space-y-2">
            {recentSessions.map((session) => <RecentSessionCard key={session.id} session={session} lang={lang} />)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
