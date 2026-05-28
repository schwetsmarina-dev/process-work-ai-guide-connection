import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";

const PRO_FEATURES = [
  "Больше сессий в месяц",
  "Расширенная память процессов",
  "PDF-отчёты сессий",
  "Полная история процессов",
  "Приоритетный доступ к новым функциям",
];

export default function UpgradeModal({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle className="font-serif text-xl">Лимит бесплатного плана</DialogTitle>
          </div>
        </DialogHeader>

        <p className="text-muted-foreground text-sm leading-relaxed">
          Вы достигли лимита бесплатного плана.
        </p>

        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold mb-3">Что даёт Pro:</p>
          <ul className="space-y-2">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="w-4 h-4 text-primary shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Закрыть
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Узнать о Pro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}