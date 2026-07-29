import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Loader2 } from "lucide-react";
import { MODE_LABELS } from "@/lib/modeSteps";

const MODES = ["body", "dream", "conflict", "journaling"];

export default function AssignPracticeDialog({ therapistEmail, clientEmail, onAssigned }) {
  const [open, setOpen] = useState(false);
  const [modeId, setModeId] = useState("body");
  const [tema, setTema] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await base44.entities.Assignment.create({
        therapist_email: therapistEmail,
        client_email: clientEmail,
        mode_id: modeId,
        tema: tema.trim(),
        instructions: instructions.trim(),
        due_date: dueDate || undefined,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      setTema("");
      setInstructions("");
      setDueDate("");
      setOpen(false);
      onAssigned?.();
    } catch (e) {
      setError(e?.message || "No se pudo asignar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <ClipboardList className="w-4 h-4" />
          Asignar práctica
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar práctica</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Modo</Label>
            <Select value={modeId} onValueChange={setModeId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODE_LABELS[m]?.es || m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Tema</Label>
            <Input value={tema} onChange={(e) => setTema(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Instrucciones</Label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="mt-1" rows={3} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Fecha límite</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button onClick={submit} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            Asignar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}