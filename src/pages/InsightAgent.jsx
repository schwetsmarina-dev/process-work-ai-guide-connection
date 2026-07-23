import { t, getStoredLanguage } from "@/lib/i18n";
import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Sparkles, Send, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import MessageBubble from "@/components/agent/MessageBubble";

const AGENT_NAME = "insight_guide";

export default function InsightAgent() {
  const lang = getStoredLanguage();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initConversation = async () => {
    setLoading(true);
    const convo = await base44.agents.createConversation({
      agent_name: AGENT_NAME,
      metadata: { name: t("agent_meta_name", lang) },
    });
    setConversation(convo);
    setMessages(convo.messages || []);

    const unsubscribe = base44.agents.subscribeToConversation(convo.id, (data) => {
      setMessages(data.messages || []);
    });

    setLoading(false);
    return () => unsubscribe();
  };

  const handleSend = async () => {
    if (!input.trim() || sending || !conversation) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    await base44.agents.addMessage(conversation, { role: "user", content: text });
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const visibleMessages = messages.filter((m) => m.role !== "system");

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <Link to="/insights">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="font-semibold text-sm leading-tight">{t("agent_title", lang)}</h1>
          <p className="text-xs text-muted-foreground">{t("agent_subtitle", lang)}</p>
        </div>
        <div className="ml-auto">
          <Link to="/insights">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <BookOpen className="w-3.5 h-3.5" />
              {t("agent_library", lang)}
            </Button>
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-semibold mb-2">{t("agent_title", lang)}</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {t("agent_intro", lang)}
              </p>
            </div>
            <div className="flex flex-col gap-2 items-center pt-2">
              {[
                t("agent_prompt_1", lang),
                t("agent_prompt_2", lang),
                t("agent_prompt_3", lang),
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-sm px-4 py-2 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          visibleMessages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("agent_placeholder", lang)}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[42px] max-h-32"
            style={{ height: "auto" }}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sending || loading}
            size="icon"
            className="shrink-0 h-[42px] w-[42px] rounded-xl"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}