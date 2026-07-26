import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { getStoredLanguage, t } from "@/lib/i18n";

const CONTACT_EMAIL = "hello@talvira.app";

export default function Contact() {
  const lang = getStoredLanguage();

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

        <article className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:font-semibold prose-p:leading-relaxed">
          <h1>Contact Us</h1>
          <p>
            We would love to hear from you. Whether you have a question, feedback, a
            partnership idea, or need help with your account, reach out and we will get back
            to you as soon as we can.
          </p>
        </article>

        <div className="mt-8 p-6 rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email us at</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-lg font-medium text-primary hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <nav className="mt-12 pt-6 border-t border-border flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">About</Link>
          <Link to="/contact" className="font-medium text-foreground">Contact</Link>
        </nav>
      </div>
    </div>
  );
}