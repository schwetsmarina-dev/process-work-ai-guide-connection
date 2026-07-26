import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Heart, Moon, GitBranch, PenLine } from "lucide-react";
import { getStoredLanguage, t } from "@/lib/i18n";

export default function About() {
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
          <h1>About Talvira</h1>

          <p>
            Talvira is a guided self-reflection companion built around Process Work — a
            depth-oriented approach to understanding the signals your mind and body send you.
            Rather than giving quick advice, Talvira walks you step by step through structured
            sessions that help you notice, stay with, and make sense of what is happening
            inside you. It offers four distinct modes of exploration: working with body
            signals and physical sensations, unfolding the meaning of dreams, exploring inner
            and outer conflicts, and open-ended reflective journaling.
          </p>

          <p>
            The app is for anyone curious about their inner life who wants a calm, private,
            and structured space to explore it — people navigating stress, recurring dreams,
            unresolved tensions, or simply the desire to know themselves more deeply. It is
            available in Russian and Spanish, keeps a personal timeline of your sessions and
            insights, and helps you see patterns and progress over time. Talvira is a
            reflective tool, not a substitute for professional therapy or medical care.
          </p>

          <p>
            Talvira is built by a small independent team passionate about making the ideas of
            Process Work accessible, safe, and gentle to use in everyday life. We care deeply
            about privacy, transparency, and giving you full control over your own data. If
            you would like to learn more or get in touch, visit our{" "}
            <Link to="/contact">Contact page</Link>.
          </p>
        </article>

        <div className="mt-10 grid grid-cols-2 gap-4 not-prose">
          {[
            { icon: Heart, label: t("landing_body_title", lang) },
            { icon: Moon, label: t("landing_dream_title", lang) },
            { icon: GitBranch, label: t("landing_conflict_title", lang) },
            { icon: PenLine, label: t("landing_journaling_title", lang) },
          ].map((m) => (
            <div
              key={m.label}
              className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <m.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium">{m.label}</span>
            </div>
          ))}
        </div>

        <nav className="mt-12 pt-6 border-t border-border flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to="/about" className="font-medium text-foreground">About</Link>
          <Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
        </nav>
      </div>
    </div>
  );
}