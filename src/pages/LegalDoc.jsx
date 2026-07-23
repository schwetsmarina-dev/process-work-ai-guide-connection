import React from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowLeft } from "lucide-react";
import { getStoredLanguage, t } from "@/lib/i18n";
import { LEGAL_DOCS, getLegalDoc } from "@/content/legal";

// Slug → document key. Slugs are Spanish because the service operates in
// Spain and these URLs are what regulators, payment providers and the landing
// page will link to; they must not change when the interface language does.
const SLUG_TO_KEY = {
  privacidad: "privacy",
  terminos: "terms",
  "aviso-legal": "notice",
};

/**
 * Public legal document page.
 *
 * Deliberately NOT behind authentication: GDPR art. 13 requires the person to
 * be able to read this BEFORE handing over any data, and the landing page and
 * payment provider need a stable public URL.
 */
export default function LegalDoc() {
  const location = useLocation();
  const lang = getStoredLanguage();
  // Routes are registered with literal paths rather than a :slug param so that
  // each document has its own stable, linkable URL.
  const slug = location.pathname.replace(/^\/+|\/+$/g, "");
  const docKey = SLUG_TO_KEY[slug];

  if (!docKey) return <Navigate to="/" replace />;

  const markdown = getLegalDoc(docKey, lang);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("notfound_home", lang)}
        </Link>

        <article
          className="prose prose-slate max-w-none
                     prose-headings:font-serif prose-headings:font-semibold
                     prose-h1:text-3xl prose-h1:mb-6
                     prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
                     prose-p:leading-relaxed prose-li:leading-relaxed
                     prose-table:text-sm"
        >
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </article>

        <nav className="mt-12 pt-6 border-t border-border flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {Object.entries(LEGAL_DOCS).map(([key, doc]) => (
            <Link
              key={key}
              to={`/${doc.slug}`}
              className={
                key === docKey
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground transition-colors"
              }
            >
              {t(`legal_${key}`, lang)}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
