import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { normalizeLang, t, getStoredLanguage } from "@/lib/i18n";

// Global footer with the three external legal links, shown on every page.
// Each link opens in a new tab; labels follow the current interface language.
const LEGAL_LINKS = [
  { labelKey: "footer_terms", href: "https://talvira.es/terminos-y-condiciones/" },
  { labelKey: "footer_privacy", href: "https://talvira.es/privacy-policy/" },
  { labelKey: "footer_legal_notice", href: "https://talvira.es/aviso-legal/" },
];

export default function LegalFooter() {
  // Start from the stored/visitor language, then upgrade to the AppUser's saved
  // preference once it loads (source of truth for logged-in users).
  const [lang, setLang] = useState(getStoredLanguage());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await base44.auth.me();
        if (!u?.email) return;
        const rows = await base44.entities.AppUser.filter({ email: u.email });
        if (!cancelled && rows[0]?.language) setLang(normalizeLang(rows[0].language));
      } catch {
        /* not logged in / public page — keep stored language */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="border-t border-border py-6 px-4">
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {LEGAL_LINKS.map((link) => (
          <a
            key={link.labelKey}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            {t(link.labelKey, lang)}
          </a>
        ))}
      </nav>
    </footer>
  );
}