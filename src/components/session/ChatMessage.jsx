import React from "react";
import SaveInsightButton from "./SaveInsightButton";
import SpeakButton from "./SpeakButton";
import { motion } from "framer-motion";
import { Sparkles, User } from "lucide-react";

export default function ChatMessage({ message, sessionId, sourceMode, language }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 group ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
          isUser
            ? "bg-foreground/10"
            : isSystem
            ? "bg-destructive/10"
            : "bg-primary/10"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-foreground/60" />
        ) : (
          <Sparkles className={`w-4 h-4 ${isSystem ? "text-destructive" : "text-primary"}`} />
        )}
      </div>
      <div className="flex flex-col gap-1 max-w-[80%]">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-md"
              : isSystem
              ? "bg-destructive/10 text-foreground border border-destructive/20 rounded-tl-md"
              : "bg-accent text-foreground rounded-tl-md"
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        {isUser && sessionId && (
          <SaveInsightButton
            messageContent={message.content}
            sessionId={sessionId}
            sourceMode={sourceMode}
          />
        )}
        {isAssistant && (
          <SpeakButton text={message.content} language={language} />
        )}
      </div>
    </motion.div>
  );
}