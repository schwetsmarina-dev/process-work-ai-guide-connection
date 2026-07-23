import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CsvUploader from "./CsvUploader";
import FieldMapper from "./FieldMapper";

// Auto-map: try to match db field name to csv header (case-insensitive, ignoring _ vs space)
function autoMap(dbFields, csvHeaders) {
  const normalize = (s) => s.toLowerCase().replace(/[_\s-]/g, "");
  const mapping = {};
  dbFields.forEach((field) => {
    const norm = normalize(field);
    const match = csvHeaders.find((h) => normalize(h) === norm);
    mapping[field] = match || "";
  });
  return mapping;
}

function applyMapping(rows, mapping) {
  return rows.map((row) => {
    const obj = {};
    Object.entries(mapping).forEach(([dbField, csvHeader]) => {
      if (csvHeader && row[csvHeader] !== undefined && row[csvHeader] !== "") {
        obj[dbField] = row[csvHeader];
      }
    });
    return obj;
  });
}

export default function ImportSection({ title, entityName, dbFields }) {
  const [parsed, setParsed] = useState({ headers: [], rows: [] });
  const [mapping, setMapping] = useState({});
  const [status, setStatus] = useState(null); // null | 'importing' | 'done' | 'error'
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (parsed.headers.length > 0) {
      setMapping(autoMap(dbFields, parsed.headers));
      setStatus(null);
      setResult(null);
    }
  }, [parsed.headers.join(",")]);

  const handleImport = async () => {
    setStatus("importing");
    setResult(null);
    const records = applyMapping(parsed.rows, mapping).filter((r) => Object.keys(r).length > 0);
    if (records.length === 0) {
      setStatus("error");
      setResult({ error: "No data to import after applying the mapping." });
      return;
    }
    try {
      await base44.entities[entityName].bulkCreate(records);
      setStatus("done");
      setResult({ count: records.length });
    } catch (e) {
      setStatus("error");
      setResult({ error: e.message || "Import failed" });
    }
  };

  const hasData = parsed.rows.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <h2 className="font-serif text-xl font-semibold">{title}</h2>

      <CsvUploader onParsed={setParsed} disabled={status === "importing"} />

      {hasData && (
        <>
          <p className="text-sm text-muted-foreground">
            Rows found: <span className="font-medium text-foreground">{parsed.rows.length}</span>
          </p>
          <FieldMapper
            dbFields={dbFields}
            csvHeaders={parsed.headers}
            mapping={mapping}
            onChange={setMapping}
          />
          <Button
            onClick={handleImport}
            disabled={status === "importing"}
            className="w-full sm:w-auto"
          >
            {status === "importing" ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Importing...</>
            ) : (
              "Import"
            )}
          </Button>
        </>
      )}

      {status === "done" && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle2 className="w-4 h-4" />
          Successfully imported {result.count} records
        </div>
      )}
      {status === "error" && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {result?.error}
        </div>
      )}
    </div>
  );
}