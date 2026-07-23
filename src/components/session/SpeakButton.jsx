import React, { useState, useEffect } from "react";
import { Volume2, Square } from "lucide-react";
import { t } from "@/lib/i18n";

const LANG_MAP = { ru: "ru-RU", es: "es-ES" };

// Speaks assistant text via the browser SpeechSynthesis API.
// Hidden entirely if the browser has no speechSynthesis support.
export default function SpeakButton({ text, language = "ru" }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  if (!supported || !text) return null;

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = LANG_MAP[language] || "ru-RU";
    utterance.lang = targetLang;

    const voices = synth.getVoices();
    const match = voices.find((v) => v.lang?.toLowerCase().startsWith(targetLang.slice(0, 2)));
    if (match) utterance.voice = match;

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    synth.speak(utterance);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={isSpeaking ? t("speak_stop", language) : t("speak_play", language)}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
    >
      {isSpeaking ? <Square className="w-3 h-3" /> : <Volume2 className="w-3.5 h-3.5" />}
      {isSpeaking ? t("speak_stop", language) : t("speak_play", language)}
    </button>
  );
}