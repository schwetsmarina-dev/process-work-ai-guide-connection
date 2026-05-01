import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import RecentSessionCard from "@/components/dashboard/RecentSessionCard";

export default function History() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser);
  }, []);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions-all", currentUser?.email],
    queryFn: () => base44.entities.Session.filter({ created_by: currentUser.email }, "-created_date", 50),
    enabled: !!currentUser?.email,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <h1 className="font-serif text-3xl font-semibold mb-2">История сессий</h1>
      <p className="text-muted-foreground mb-8">Все ваши сессии самоисследования</p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">У вас пока нет сессий</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <RecentSessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}