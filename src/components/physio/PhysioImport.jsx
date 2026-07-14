import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Watch, Apple, Loader2, Info, Plus } from "lucide-react";

const METRIC_OPTIONS = [
  { value: "heart_rate", label: "Пульс (bpm)", unit: "bpm" },
  { value: "hrv", label: "ВСР / HRV (ms)", unit: "ms" },
  { value: "sleep_hours", label: "Сон (часы)", unit: "hours" },
  { value: "steps", label: "Шаги", unit: "steps" },
  { value: "respiratory_rate", label: "Частота дыхания", unit: "br/min" },
  { value: "stress", label: "Стресс (индекс)", unit: "" },
];

// OAuth integration stub: Apple HealthKit / Garmin Connect.
// Real OAuth is not available from a web app (see importPhysiologicalData notes).
// This component provides the working paths available today: manual entry + a
// clearly-labeled placeholder for provider connection.
export default function PhysioImport({ userId, onImported }) {
  const [metricType, setMetricType] = useState("heart_rate");
  const [value, setValue] = useState("");
  const [recordedAt, setRecordedAt] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!value || !recordedAt) return;
    setSaving(true);
    try {
      const opt = METRIC_OPTIONS.find((m) => m.value === metricType);
      await base44.entities.PhysiologicalData.create({
        user_id: userId,
        source: "other",
        metric_type: metricType,
        value: Number(value),
        unit: opt?.unit || "",
        recorded_at: new Date(recordedAt).toISOString(),
      });
      setValue("");
      onImported?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-primary" />
          Физиологические данные
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider connect stub */}
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/60 text-xs text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Прямое подключение Apple HealthKit и Garmin Connect требует нативного
              приложения или партнёрского OAuth-доступа и пока недоступно из
              веб-версии. Пока используйте ручной ввод или загрузку файла экспорта.
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled className="gap-2 flex-1">
              <Apple className="w-4 h-4" />
              Apple Health
            </Button>
            <Button variant="outline" size="sm" disabled className="gap-2 flex-1">
              <Watch className="w-4 h-4" />
              Garmin
            </Button>
          </div>
        </div>

        {/* Manual entry */}
        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-sm font-medium">Добавить показатель вручную</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Метрика</Label>
              <Select value={metricType} onValueChange={setMetricType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Значение</Label>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Время измерения</Label>
            <Input
              type="datetime-local"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
            />
          </div>
          <Button onClick={handleAdd} disabled={saving || !value} className="gap-2 w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Добавить
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}