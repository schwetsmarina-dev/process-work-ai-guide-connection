import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

// Adds `months` calendar months to today and returns the whole-day difference,
// so a 6-month grant lands on the correct calendar date (not months * 30).
function monthsToDays(months) {
  const now = new Date();
  const target = new Date(now);
  target.setMonth(target.getMonth() + Number(months));
  const diffMs = target.getTime() - now.getTime();
  return Math.round(diffMs / 86400000);
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return "бессрочно";
  return new Date(expiresAt).toLocaleDateString("ru-RU");
}

export default function AdminAccess() {
  const [email, setEmail] = useState("");
  const [months, setMonths] = useState(6);
  const [lifetime, setLifetime] = useState(false);
  const [note, setNote] = useState("Тестер");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [grants, setGrants] = useState([]);
  const [grantsLoading, setGrantsLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);

  const loadGrants = useCallback(async () => {
    setGrantsLoading(true);
    try {
      const rows = await base44.entities.Entitlement.filter({ source: "admin" });
      setGrants(rows || []);
    } catch (e) {
      console.error("[AdminAccess] load grants failed:", e?.message);
    } finally {
      setGrantsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGrants();
  }, [loadGrants]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Укажите email.");
      return;
    }
    setSubmitting(true);
    try {
      const days = lifetime ? null : monthsToDays(months);
      const res = await base44.functions.invoke("adminSetPlan", {
        email: cleanEmail,
        plan: "beta",
        days,
        note,
      });
      const data = res?.data || res;
      if (data?.error) {
        setError(data.error);
      } else {
        setResult({
          email: data.email || cleanEmail,
          expiry: formatExpiry(data.expiresAt),
        });
        setEmail("");
        await loadGrants();
      }
    } catch (err) {
      setError(err?.message || "Не удалось выдать доступ.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (revokeEmail) => {
    setRevoking(revokeEmail);
    try {
      await base44.functions.invoke("adminSetPlan", {
        email: revokeEmail,
        plan: "beta",
        revoke: true,
      });
      await loadGrants();
    } catch (err) {
      console.error("[AdminAccess] revoke failed:", err?.message);
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-semibold mb-2">Бета-доступ</h1>
        <p className="text-muted-foreground text-sm">
          Выдавайте доступ тестерам по email. Можно указать срок в месяцах или выдать доступ навсегда.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="months" className="text-sm">Срок (месяцев)</Label>
            <Input
              id="months"
              type="number"
              min={1}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              disabled={lifetime}
              className="mt-1.5 max-w-[160px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="lifetime"
              checked={lifetime}
              onCheckedChange={(v) => setLifetime(Boolean(v))}
            />
            <Label htmlFor="lifetime" className="text-sm font-normal cursor-pointer">
              Доступ навсегда (без срока окончания)
            </Label>
          </div>

          <div>
            <Label htmlFor="note" className="text-sm">Заметка</Label>
            <Input
              id="note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Выдать доступ
          </Button>

          {result && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Доступ выдан: <strong>{result.email}</strong> — до {result.expiry}
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </Card>

      <div>
        <h2 className="font-serif text-xl font-semibold mb-4">Кто уже имеет доступ</h2>
        {grantsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока никому не выдан доступ.</p>
        ) : (
          <Card className="divide-y divide-border">
            {grants.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{g.user_email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {g.plan} · {g.status} · до {formatExpiry(g.expires_at)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoking === g.user_email}
                  onClick={() => handleRevoke(g.user_email)}
                >
                  {revoking === g.user_email && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Отозвать
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}