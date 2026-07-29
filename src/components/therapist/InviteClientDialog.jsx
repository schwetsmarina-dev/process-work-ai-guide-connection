import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";

export default function InviteClientDialog({ therapistEmail, onInvited }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const clientEmail = email.trim().toLowerCase();
    if (!clientEmail) return;
    setSaving(true);
    setError("");
    try {
      await base44.entities.ClientLink.create({
        therapist_email: therapistEmail,
        client_email: clientEmail,
        status: "invited",
        consent_to_share: false,
        share_scope: "summaries",
        created_at: new Date().toISOString(),
      });
      setEmail("");
      setOpen(false);
      onInvited?.();
    } catch (e) {
      setError(e?.message || "No se pudo invitar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="w-4 h-4" />
          Invitar cliente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Email del cliente</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@ejemplo.com"
              className="mt-1"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            El cliente verá tus datos solo cuando active el consentimiento en sus ajustes.
          </p>
          <Button onClick={submit} disabled={saving || !email.trim()} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Enviar invitación
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}