import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { t } from "./i18n";

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(js|jsx|ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("Spanish UI coverage", () => {
  it("has a non-Russian Spanish value for every static t() key used by the UI", () => {
    const keys = new Set();
    for (const path of files("src")) {
      if (path.endsWith("i18n.test.js")) continue;
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/\bt\(\s*["']([^"']+)["']/g)) keys.add(match[1]);
    }
    const intentionalCyrillic = new Set(["language_russian"]);
    const missing = [...keys].filter((key) => {
      const value = t(key, "es");
      return value === key || (!intentionalCyrillic.has(key) && /[А-Яа-яЁё]/.test(value));
    });
    expect(missing).toEqual([]);
  });
});
