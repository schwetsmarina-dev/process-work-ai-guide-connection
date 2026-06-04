import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TOTAL = 5;

export default function OnboardingShell({
  step,
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
  backLabel,
  children,
}) {
  const canGoBack = step > 0 && step < TOTAL - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Back button */}
      <div className="h-14 flex items-center px-4 shrink-0">
        {canGoBack && onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 flex flex-col items-center justify-center">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md mx-auto"
        >
          {children}
        </motion.div>
      </div>

      {/* Footer: button + dots */}
      <div className="shrink-0 px-6 pb-8 pt-4 flex flex-col items-center gap-6">
        <Button
          size="lg"
          onClick={onNext}
          disabled={nextDisabled}
          className="w-full max-w-md text-base py-6 rounded-xl"
        >
          {nextLabel}
        </Button>

        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? "w-6 bg-primary" : "w-2 bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}