import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Brain, Check, EyeOff, Loader2, Pencil, RotateCcw, Trash2, X } from "lucide-react";

const COPY = {
  ru: {
    title: "Память и моя процессуальная карта",
    hint: "Talvira хранит память в трёх слоях. Это изменяемые наблюдения и гипотезы, а не диагноз и не окончательное описание тебя.",
    on: "Память включена",
    off: "Память выключена",
    show: "Открыть мою карту",
    hide: "Скрыть карту",
    episodic: "Эпизодическая память",
    episodicHint: "Что происходило в конкретных сессиях.",
    semantic: "Семантическая память",
    semanticHint: "Темы и процессы, которые повторяются в нескольких сессиях.",
    dynamic: "Динамическая память",
    dynamicHint: "Как темы, ресурсы и процессы меняются со временем.",
    empty: "Здесь пока нет данных.",
    confirm: "Это верно",
    edit: "Исправить",
    exclude: "Не использовать",
    include: "Использовать снова",
    delete: "Удалить",
    save: "Сохранить",
    cancel: "Отмена",
    evidence: "сессий в основании",
    sessionBlocked: "Эта сессия больше не используется для памяти.",
    blockSession: "Не использовать эту сессию в памяти",
    reset: "Полностью сбросить память",
    resetHint: "Удалит всю сохранённую память без возможности восстановления. Старые сессии останутся в истории, но будут навсегда исключены из автоматического восстановления этой памяти. После сброса память будет выключена; её можно включить снова для новых сессий.",
    resetAsk: "Для окончательного сброса впиши СБРОСИТЬ:",
    resetWord: "СБРОСИТЬ",
    resetConfirm: "Сбросить безвозвратно",
    resetDone: "Память полностью сброшена. Старые сессии исключены из её восстановления.",
    error: "Не удалось изменить память. Попробуй ещё раз.",
    rejected: "Не используется ИИ",
    corrected: "Исправлено тобой",
    confirmed: "Подтверждено тобой",
  },
  es: {
    title: "Memoria y mi mapa de proceso",
    hint: "Talvira organiza la memoria en tres capas. Son observaciones e hipótesis revisables, no un diagnóstico ni una descripción definitiva de ti.",
    on: "Memoria activada",
    off: "Memoria desactivada",
    show: "Abrir mi mapa",
    hide: "Ocultar mapa",
    episodic: "Memoria episódica",
    episodicHint: "Lo que ocurrió en sesiones concretas.",
    semantic: "Memoria semántica",
    semanticHint: "Temas y procesos que aparecen en varias sesiones.",
    dynamic: "Memoria dinámica",
    dynamicHint: "Cómo cambian los temas, recursos y procesos con el tiempo.",
    empty: "Todavía no hay datos aquí.",
    confirm: "Esto es correcto",
    edit: "Corregir",
    exclude: "No usar",
    include: "Volver a usar",
    delete: "Eliminar",
    save: "Guardar",
    cancel: "Cancelar",
    evidence: "sesiones como base",
    sessionBlocked: "Esta sesión ya no se usa para la memoria.",
    blockSession: "No usar esta sesión en la memoria",
    reset: "Restablecer toda la memoria",
    resetHint: "Eliminará toda la memoria guardada de forma irreversible. Las sesiones antiguas permanecerán en tu historial, pero quedarán excluidas para que esta memoria no pueda reconstruirse automáticamente. Después del restablecimiento la memoria quedará desactivada; podrás volver a activarla para sesiones nuevas.",
    resetAsk: "Para confirmar, escribe BORRAR:",
    resetWord: "BORRAR",
    resetConfirm: "Restablecer de forma irreversible",
    resetDone: "La memoria se ha restablecido por completo. Las sesiones anteriores quedan excluidas de su reconstrucción.",
    error: "No se pudo modificar la memoria. Inténtalo de nuevo.",
    rejected: "No se usa por la IA",
    corrected: "Corregido por ti",
    confirmed: "Confirmado por ti",
  },
};

function statusLabel(item, tx) {
  if (item.excluded_from_ai || item.user_status === "rejected") return tx.rejected;
  if (item.user_status === "corrected") return tx.corrected;
  if (item.user_status === "confirmed") return tx.confirmed;
  return "";
}

function MemoryItem({ item, tx, busy, onConfirm, onEdit, onToggleUse, onDelete, onBlockSession }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.memory_value || "");
  const status = statusLabel(item, tx);
  const sourceSession = item.memory_level === "episodic" && item.source_session_id;

  return (
    <div className={`rounded-xl border p-3 ${item.excluded_from_ai || item.user_status === "rejected" ? "opacity-60 bg-muted/20" : "bg-card"}`}>
      {editing ? (
        <div className="space-y-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full min-h-20 rounded-lg border bg-background p-2 text-sm" />
          <div className="flex gap-2">
            <Button size="sm" onClick={async () => { await onEdit(item, draft); setEditing(false); }} disabled={busy || !draft.trim()}>{tx.save}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(item.memory_value || ""); setEditing(false); }}>{tx.cancel}</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed">{item.memory_value}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
            <span>{item.memory_type || item.memory_key}</span>
            {Number(item.evidence_count || 0) > 1 && <span>{item.evidence_count} {tx.evidence}</span>}
            {item.trend && <span>{item.trend}</span>}
            {typeof item.confidence === "number" && <span>{Math.round(item.confidence * 100)}%</span>}
            {status && <span className="font-medium text-primary">{status}</span>}
          </div>
          <div className="flex flex-wrap gap-1 mt-3">
            {!item.excluded_from_ai && item.user_status !== "rejected" && item.user_status !== "confirmed" && (
              <Button size="sm" variant="ghost" onClick={() => onConfirm(item)} disabled={busy} className="h-8 text-xs"><Check className="w-3.5 h-3.5 mr-1" />{tx.confirm}</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={busy} className="h-8 text-xs"><Pencil className="w-3.5 h-3.5 mr-1" />{tx.edit}</Button>
            <Button size="sm" variant="ghost" onClick={() => onToggleUse(item)} disabled={busy} className="h-8 text-xs"><EyeOff className="w-3.5 h-3.5 mr-1" />{item.excluded_from_ai || item.user_status === "rejected" ? tx.include : tx.exclude}</Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(item)} disabled={busy} className="h-8 text-xs text-destructive"><Trash2 className="w-3.5 h-3.5 mr-1" />{tx.delete}</Button>
            {sourceSession && !item.excluded_from_ai && (
              <Button size="sm" variant="ghost" onClick={() => onBlockSession(item.source_session_id)} disabled={busy} className="h-8 text-xs"><X className="w-3.5 h-3.5 mr-1" />{tx.blockSession}</Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function MemoryControlPanel({ user, appUser, lang = "es" }) {
  const tx = COPY[lang] || COPY.es;
  const [enabled, setEnabled] = useState(appUser?.memory_enabled !== false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => setEnabled(appUser?.memory_enabled !== false), [appUser?.memory_enabled]);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const rows = await base44.entities.UserMemory.filter({ user_id: user.id }, "-updated_at", 500);
      setItems(rows || []);
    } catch { alert(tx.error); }
    finally { setLoading(false); }
  };

  const toggleOpen = async () => {
    if (open) return setOpen(false);
    await load();
    setOpen(true);
  };

  const toggleEnabled = async () => {
    if (!appUser?.id) return;
    setBusyId("toggle");
    try {
      const next = !enabled;
      await base44.entities.AppUser.update(appUser.id, { memory_enabled: next });
      setEnabled(next);
    } catch { alert(tx.error); }
    finally { setBusyId(""); }
  };

  const patch = async (item, changes) => {
    setBusyId(item.id);
    try {
      await base44.entities.UserMemory.update(item.id, { ...changes, updated_at: new Date().toISOString() });
      setItems((prev) => prev.map((m) => m.id === item.id ? { ...m, ...changes } : m));
    } catch { alert(tx.error); }
    finally { setBusyId(""); }
  };

  const confirmItem = (item) => patch(item, { user_status: "confirmed", excluded_from_ai: false, is_active: true });
  const editItem = (item, value) => patch(item, {
    memory_value: value.trim(),
    original_value: item.original_value || item.memory_value,
    user_status: "corrected",
    excluded_from_ai: false,
    is_active: true,
  });
  const toggleUse = (item) => {
    const excluded = item.excluded_from_ai || item.user_status === "rejected";
    return patch(item, excluded
      ? { excluded_from_ai: false, user_status: item.user_status === "rejected" ? "unreviewed" : item.user_status, is_active: true }
      : { excluded_from_ai: true, user_status: "rejected", is_active: true });
  };
  const deleteItem = async (item) => {
    setBusyId(item.id);
    try {
      await base44.entities.UserMemory.delete(item.id);
      setItems((prev) => prev.filter((m) => m.id !== item.id));
    } catch { alert(tx.error); }
    finally { setBusyId(""); }
  };

  const blockSession = async (sessionId) => {
    setBusyId(`session:${sessionId}`);
    try {
      await base44.entities.Session.update(sessionId, {
        memory_excluded: true,
        memory_excluded_at: new Date().toISOString(),
        memory_exclusion_reason: "user_excluded",
      });
      const related = items.filter((m) => m.source_session_id === sessionId);
      for (const row of related) {
        await base44.entities.UserMemory.update(row.id, { excluded_from_ai: true, is_active: false, updated_at: new Date().toISOString() });
      }
      await base44.functions.invoke("rebuildMemoryProfile", {}).catch(() => {});
      await load();
    } catch { alert(tx.error); }
    finally { setBusyId(""); }
  };

  const groups = useMemo(() => ({
    episodic: items.filter((m) => !m.memory_level || m.memory_level === "episodic"),
    semantic: items.filter((m) => m.memory_level === "semantic" && m.is_active !== false),
    dynamic: items.filter((m) => m.memory_level === "dynamic" && m.is_active !== false),
  }), [items]);

  const sections = [
    ["semantic", tx.semantic, tx.semanticHint],
    ["dynamic", tx.dynamic, tx.dynamicHint],
    ["episodic", tx.episodic, tx.episodicHint],
  ];

  const doReset = async () => {
    if (resetText.trim().toUpperCase() !== tx.resetWord) return;
    setResetting(true);
    try {
      await base44.functions.invoke("resetMyMemory", { confirm: "RESET_MEMORY" });
      setItems([]);
      setEnabled(false);
      setOpen(true);
      setResetDone(true);
      setResetOpen(false);
      setResetText("");
    } catch { alert(tx.error); }
    finally { setResetting(false); }
  };

  return (
    <div className="py-5 border-t border-border">
      <div className="flex items-center gap-2 mb-1"><Brain className="w-4 h-4 text-primary" /><p className="text-sm font-medium">{tx.title}</p></div>
      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{tx.hint}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={toggleEnabled} disabled={!appUser?.id || busyId === "toggle"}>{busyId === "toggle" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{enabled ? tx.on : tx.off}</Button>
        <Button variant="ghost" onClick={toggleOpen} disabled={!user?.id || loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{open ? tx.hide : tx.show}</Button>
      </div>

      {open && <div className="mt-5 space-y-6">
        {sections.map(([key, title, hint]) => <section key={key}>
          <h4 className="text-sm font-semibold">{title}</h4><p className="text-xs text-muted-foreground mb-2">{hint}</p>
          <div className="space-y-2">{groups[key].length === 0 ? <p className="text-xs text-muted-foreground border rounded-lg p-3">{tx.empty}</p> : groups[key].map((item) => <MemoryItem key={item.id} item={item} tx={tx} busy={busyId === item.id || busyId === `session:${item.source_session_id}`} onConfirm={confirmItem} onEdit={editItem} onToggleUse={toggleUse} onDelete={deleteItem} onBlockSession={blockSession} />)}</div>
        </section>)}
      </div>}

      <div className="mt-5 pt-4 border-t border-destructive/15">
        {!resetOpen ? <><Button variant="ghost" className="text-destructive px-0" onClick={() => setResetOpen(true)}><RotateCcw className="w-4 h-4 mr-2" />{tx.reset}</Button><p className="text-xs text-muted-foreground max-w-xl">{tx.resetHint}</p></> : <div className="space-y-2"><p className="text-xs text-destructive font-medium">{tx.resetHint}</p><label className="text-xs text-muted-foreground block">{tx.resetAsk}</label><input value={resetText} onChange={(e) => setResetText(e.target.value)} className="h-10 rounded-lg border bg-background px-3 text-sm w-full max-w-xs" placeholder={tx.resetWord} /><div className="flex gap-2"><Button onClick={doReset} disabled={resetting || resetText.trim().toUpperCase() !== tx.resetWord} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{resetting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{tx.resetConfirm}</Button><Button variant="ghost" disabled={resetting} onClick={() => { setResetOpen(false); setResetText(""); }}>{tx.cancel}</Button></div></div>}
        {resetDone && <p className="text-xs text-primary mt-2">{tx.resetDone}</p>}
      </div>
    </div>
  );
}
