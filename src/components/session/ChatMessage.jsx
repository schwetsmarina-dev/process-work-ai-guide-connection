import React from "react";
import { motion } from "framer-motion";
import { Sparkles, User } from "lucide-react";

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
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
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-md"
            : isSystem
            ? "bg-destructive/10 text-foreground border border-destructive/20 rounded-tl-md"
            : "bg-accent text-foreground rounded-tl-md"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </motion.div>
  );
}