import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function FieldMapper({ dbFields, csvHeaders, mapping, onChange }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">Сопоставление полей</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {dbFields.map((field) => (
          <div key={field} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
            <span className="text-sm font-mono text-foreground min-w-[140px] truncate">{field}</span>
            <Select
              value={mapping[field] || "__skip__"}
              onValueChange={(val) => onChange({ ...mapping, [field]: val === "__skip__" ? "" : val })}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="— пропустить —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__skip__">— пропустить —</SelectItem>
                {csvHeaders.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}