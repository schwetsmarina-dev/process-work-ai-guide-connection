import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare } from "lucide-react";
import FeedbackSummary from "@/components/admin/FeedbackSummary";
import FeedbackCard from "@/components/admin/FeedbackCard";

export default function AdminFeedback() {
  const navigate = useNavigate();
  const [language, setLanguage] = React.useState("all");
  const [rating, setRating] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [userQuery, setUserQuery] = React.useState("");

  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ["admin-feedback-all"],
    queryFn: async () => {
      const [sessions, experiences] = await Promise.all([
        base44.entities.SessionFeedback.list("-created_date", 500),
        base44.entities.ExperienceFeedback.list("-created_date", 500),
      ]);
      return [
        ...(sessions || []).map((x) => ({ ...x, _feedback_kind: "session" })),
        ...(experiences || []).map((x) => ({ ...x, _feedback_kind: "experience" })),
      ].sort((a, b) => new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0));
    },
  });

  const filtered = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return feedback.filter((f) => {
      if (language !== "all" && f.language !== language) return false;
      if (rating !== "all" && f.rating !== Number(rating)) return false;
      if (type === "session" && f._feedback_kind !== "session") return false;
      if (type === "practice" && f.experience_type !== "practice") return false;
      if (type === "edge_program_day" && f.experience_type !== "edge_program_day") return false;
      if (type === "edge_program_complete" && f.experience_type !== "edge_program_complete") return false;
      if (q && !`${f.user_name || ""} ${f.user_email || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [feedback, language, rating, type, userQuery]);

  const FilterSelect = ({ value, onChange, options, placeholder }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-serif font-semibold">Beta tester feedback</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <FeedbackSummary feedback={feedback} />

          <div className="flex flex-wrap gap-2 mb-5">
            <input
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Name or email"
              className="h-10 w-56 rounded-md border border-input bg-background px-3 text-sm"
            />
            <FilterSelect
              value={language}
              onChange={setLanguage}
              placeholder="Language"
              options={[
                { value: "all", label: "All languages" },
                { value: "ru", label: "RU" },
                { value: "es", label: "ES" },
              ]}
            />
            <FilterSelect
              value={rating}
              onChange={setRating}
              placeholder="Rating"
              options={[
                { value: "all", label: "All ratings" },
                ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} ★` })),
              ]}
            />
            <FilterSelect
              value={type}
              onChange={setType}
              placeholder="Feedback type"
              options={[
                { value: "all", label: "All feedback" },
                { value: "session", label: "Sessions" },
                { value: "practice", label: "Personal practices" },
                { value: "edge_program_day", label: "28-day program · days" },
                { value: "edge_program_complete", label: "28-day program · final" },
              ]}
            />
          </div>

          <div className="text-sm text-muted-foreground mb-3">
            Showing {filtered.length} of {feedback.length}
          </div>

          <div className="space-y-3">
            {filtered.map((item) => (
              <FeedbackCard
                key={`${item._feedback_kind}-${item.id}`}
                item={item}
                onOpenSession={(sid) =>
                  navigate(
                    `/session/${sid}/summary?from=feedback` +
                    `&fe=${encodeURIComponent(item.user_email || "")}` +
                    `&fc=${encodeURIComponent(item.created_at || item.created_date || "")}`
                  )
                }
              />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground text-sm">
                No feedback found
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
