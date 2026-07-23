import React, { useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";

export default function CsvUploader({ onParsed, disabled }) {
  const inputRef = useRef();
  const [fileName, setFileName] = useState(null);

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) => {
      // Handle quoted fields with commas inside
      const cols = [];
      let inQuote = false;
      let cur = "";
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      cols.push(cur.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
      return obj;
    });
    return { headers, rows };
  };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseCsv(e.target.result);
      onParsed(result);
    };
    reader.readAsText(file, "utf-8");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 transition-colors cursor-pointer bg-muted/30"
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
        disabled={disabled}
      />
      {fileName ? (
        <div className="flex items-center justify-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          <span className="text-sm font-medium">{fileName}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setFileName(null); onParsed({ headers: [], rows: [] }); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Drop a CSV here or <span className="text-primary font-medium">click to choose a file</span></p>
        </div>
      )}
    </div>
  );
}