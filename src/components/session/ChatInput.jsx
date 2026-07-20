import React, { useState, useEffect } from "react";
import { SendHorizontal, Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import useSpeechRecognition from "@/hooks/useSpeechRecognition";

export default function ChatInput({ onSend, isLoading, disabled, seedText = "", seedNonce = 0 }) {
  const [text, setText] = useState("");

  // When the parent bumps seedNonce (e.g. after "step back"), load the returned
  // text back into the box so the user can correct it and resend.
  useEffect(() => {
    if (seedNonce > 0) setText(seedText || "");
  }, [seedNonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const { isSupported, isListening, toggle } = useSpeechRecognition({
    lang: "ru-RU",
    onResult: (transcript) => {
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || isLoading || disabled) return;
    onSend(text.trim());
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Ответьте на предложение выше..." : "Напишите здесь..."}
        className="min-h-[44px] max-h-32 resize-none rounded-xl border-border bg-card text-sm"
        rows={1}
        disabled={disabled}
      />
      {isSupported && (
        <Button
          type="button"
          size="icon"
          variant={isListening ? "default" : "outline"}
          onClick={toggle}
          disabled={disabled}
          title={isListening ? "Остановить запись" : "Говорите"}
          className={`rounded-xl h-11 w-11 shrink-0 ${isListening ? "animate-pulse" : ""}`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
      )}
      <Button
        type="submit"
        size="icon"
        disabled={!text.trim() || isLoading || disabled}
        className="rounded-xl h-11 w-11 shrink-0"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <SendHorizontal className="w-4 h-4" />
        )}
      </Button>
    </form>
  );
}
