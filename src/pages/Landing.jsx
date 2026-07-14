import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Heart, Moon, GitBranch, PenLine, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { normalizeLang, t, getStoredLanguage, setStoredLanguage } from "@/lib/i18n";

const heroRu = "https://media.base44.com/images/public/69ecbcec1c0f2de14e2fbc75/850646afd_.png";
const heroEs = "https://media.base44.com/images/public/69ecbcec1c0f2de14e2fbc75/d2cdae3ac_hero-es.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
  }),
};

export default function Landing() {
  const [lang, setLang] = useState(getStoredLanguage());

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me();
        if (!u?.email) return;
        const rows = await base44.entities.AppUser.filter({ email: u.email });
        const appUser = rows[0];
        if (appUser?.language) {
          // AppUser language is the source of truth once it exists
          setLang(normalizeLang(appUser.language));
        } else {
          // First login: sync stored visitor language onto AppUser
          const stored = getStoredLanguage();
          if (appUser?.id) {
            await base44.entities.AppUser.update(appUser.id, { language: stored });
          } else {
            const now = new Date().toISOString();
            await base44.entities.AppUser.create({
              email: u.email,
              name: u.full_name,
              language: stored,
              plan: "free",
              onboarding_completed: false,
              consent_given: false,
              created_at: now,
              last_seen_at: now,
            });
          }
          setLang(stored);
        }
      } catch {
        setLang(getStoredLanguage());
      }
    })();
  }, []);

  const handleLangSwitch = (value) => {
    setLang(value);
    setStoredLanguage(value);
  };

  const heroImage = lang === "es" ? heroEs : heroRu;

  const modes = [
    { icon: Heart, title: t("landing_body_title", lang), desc: t("landing_body_desc", lang) },
    { icon: Moon, title: t("landing_dream_title", lang), desc: t("landing_dream_desc", lang) },
    { icon: GitBranch, title: t("landing_conflict_title", lang), desc: t("landing_conflict_desc", lang) },
    { icon: PenLine, title: t("landing_journaling_title", lang), desc: t("landing_journaling_desc", lang) },
  ];

  const handleStart = () => {
    base44.auth.redirectToLogin("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Language switcher — visible to everyone */}
      <div className="absolute top-4 right-4 z-20 flex items-center rounded-full border border-border bg-card/80 backdrop-blur-sm overflow-hidden text-xs font-medium">
        <button
          onClick={() => handleLangSwitch("ru")}
          className={`px-3 py-1.5 transition-colors ${lang === "ru" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          RU
        </button>
        <button
          onClick={() => handleLangSwitch("es")}
          className={`px-3 py-1.5 transition-colors ${lang === "es" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          ES
        </button>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* layered gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-background to-background pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_20%,hsl(var(--primary)/0.08),transparent)] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 pt-12 pb-10 md:pt-20 md:pb-16 flex flex-col items-center">
          {/* Image hero — the image IS the headline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, ease: "easeIn" }}
            className="w-full relative"
            style={{ maxWidth: "1400px" }}
          >
            {/* soft glow behind image */}
            <div className="absolute inset-0 blur-3xl opacity-20 bg-primary/40 rounded-3xl scale-95" />
            <img
              src={heroImage}
              alt={lang === "es" ? "Process Work AI Guide — Español" : "Process Work AI Guide — Русский"}
              className="relative w-full h-auto rounded-2xl shadow-2xl shadow-primary/10 object-contain mx-auto"
            />
          </motion.div>

          {/* CTA button — kept exactly as before */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mt-10"
          >
            <Button
              size="lg"
              onClick={handleStart}
              className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
            >
              {t("start_session", lang)}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>

        {/* smooth fade into modes section */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-background pointer-events-none" />
      </section>

      {/* Modes */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {modes.map((mode, i) => (
            <motion.div
              key={mode.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className="group p-6 md:p-8 rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <mode.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-serif text-xl font-semibold mb-2">{mode.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{mode.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
          className="flex items-start gap-4 p-6 rounded-2xl bg-accent/50 border border-border"
        >
          <Shield className="w-6 h-6 text-primary mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold mb-1">{t("important", lang)}</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("landing_disclaimer_text", lang)}
            </p>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Process Work AI Guide</p>
        <p className="mt-2 font-mono text-xs text-amber-600 bg-amber-50 inline-block px-3 py-1 rounded-full border border-amber-200">
LANDING BUILD: language switcher active v2
        </p>
      </footer>
    </div>
  );
}