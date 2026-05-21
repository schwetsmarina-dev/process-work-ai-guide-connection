import React from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, Heart, Moon, GitBranch, PenLine, ArrowRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const modes = [
  {
    icon: Heart,
    title: "Сигнал тела",
    desc: "Исследуйте телесные ощущения и скрытые послания",
  },
  {
    icon: Moon,
    title: "Работа со сном",
    desc: "Раскройте символы и образы ваших снов",
  },
  {
    icon: GitBranch,
    title: "Внутренний конфликт",
    desc: "Услышьте обе стороны внутреннего противоречия",
  },
  {
    icon: PenLine,
    title: "Дневник",
    desc: "Свободная рефлексия, следуя за сильнейшим сигналом",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" },
  }),
};

export default function Landing() {
  const handleStart = () => {
    base44.auth.redirectToLogin("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
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
            className="w-full max-w-3xl relative"
          >
            {/* soft glow behind image */}
            <div className="absolute inset-0 blur-3xl opacity-20 bg-primary/40 rounded-3xl scale-95" />
            <img
              src="https://media.base44.com/images/public/69ecbcec1c0f2de14e2fbc75/850646afd_.png"
              alt="Process Work AI Guide"
              className="relative w-full h-auto rounded-2xl shadow-2xl shadow-primary/10"
              style={{ objectFit: "contain" }}
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
              Начать сессию
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
            <h4 className="font-semibold mb-1">Важно</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Этот инструмент предназначен для самоисследования и саморефлексии.
              Он не заменяет профессиональную психологическую помощь, терапию,
              диагностику или лечение. Если вам нужна помощь — обратитесь к
              специалисту.
            </p>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Process Work AI Guide</p>
        <p className="mt-2 font-mono text-xs text-amber-600 bg-amber-50 inline-block px-3 py-1 rounded-full border border-amber-200">
          BUILD CHECK: 2026-05-14 fetchStep import fixed
        </p>
      </footer>
    </div>
  );
}