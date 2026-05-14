import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Loader2, ChevronRight, CheckCircle2, AlertCircle, Clock, Zap } from "lucide-react";

function ToolCall({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const name = (toolCall?.name || "function").split(".").reverse().join(" ");
  const status = toolCall?.status || "pending";

  const statusMap = {
    pending: { icon: Clock, color: "text-slate-400" },
    running: { icon: Loader2, color: "text-muted-foreground", spin: true },
    in_progress: { icon: Loader2, color: "text-muted-foreground", spin: true },
    completed: { icon: CheckCircle2, color: "text-green-600" },
    success: { icon: CheckCircle2, color: "text-green-600" },
    failed: { icon: AlertCircle, color: "text-red-500" },
    error: { icon: AlertCircle, color: "text-red-500" },
  };
  const { icon: Icon, color, spin } = statusMap[status] || { icon: Zap, color: "text-muted-foreground" };

  return (
    <div className="mt-1 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white border-border hover:bg-accent transition-colors"
      >
        <Icon className={cn("h-3 w-3", color, spin && "animate-spin")} />
        <span className="text-muted-foreground">{name}</span>
        {toolCall?.results && (
          <ChevronRight className={cn("h-3 w-3 text-muted-foreground ml-auto transition-transform", expanded && "rotate-90")} />
        )}
      </button>
      {expanded && toolCall?.results && (
        <pre className="mt-1 ml-3 pl-3 border-l-2 border-border text-xs text-muted-foreground bg-muted rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
          {(() => { try { return JSON.stringify(JSON.parse(toolCall.results), null, 2); } catch { return toolCall.results; } })()}
        </pre>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5 shrink-0">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
        </div>
      )}
      <div className={cn("max-w-[85%]", isUser && "flex flex-col items-end")}>
        {message.content && (
          <div className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-foreground text-background"
              : "bg-card border border-border"
          )}>
            {isUser ? (
              <p className="leading-relaxed">{message.content}</p>
            ) : (
              <ReactMarkdown
                className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                components={{
                  p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                  ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                  li: ({ children }) => <li className="my-0.5">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  code: ({ children }) => <code className="px-1 py-0.5 rounded bg-muted text-xs">{children}</code>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
        {message.tool_calls?.length > 0 && (
          <div className="space-y-1 mt-1">
            {message.tool_calls.map((tc, i) => <ToolCall key={i} toolCall={tc} />)}
          </div>
        )}
      </div>
    </div>
  );
}