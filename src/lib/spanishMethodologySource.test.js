import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const esPath = path.join(root, "base44/functions/generateEdgeProgramDay/methodology.es.ts");
const sourcePath = path.join(root, "base44/functions/generateEdgeProgramDay/methodology.ts");

const read = (p) => fs.readFileSync(p, "utf8");
const dayRows = (text) => [...text.matchAll(/\bd\((\d+),(\d+),"([^"]+)"/g)].map((m) => ({
  day: Number(m[1]),
  week: Number(m[2]),
  key: m[3],
}));

describe("Spanish 28-day methodology source", () => {
  it("contains a complete independent 28-day Spanish methodology", () => {
    const text = read(esPath);
    const rows = dayRows(text);
    expect(rows).toHaveLength(28);
    expect(new Set(rows.map((x) => x.day)).size).toBe(28);
    expect(rows[0].day).toBe(1);
    expect(rows[27].day).toBe(28);
    expect(text).toContain("RETURN_TO_SELF_ENGINE_RULES_ES");
    expect(text).toContain("RETURN_TO_SELF_DAYS_ES");
  });

  it("has exactly the same day numbers, weeks and methodology keys as the source version", () => {
    expect(dayRows(read(esPath))).toEqual(dayRows(read(sourcePath)));
  });

  it("does not contain Cyrillic in the Spanish methodology source", () => {
    expect(read(esPath)).not.toMatch(/[А-Яа-яЁё]/);
  });
});
