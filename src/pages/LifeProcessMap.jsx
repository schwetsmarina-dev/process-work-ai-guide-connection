import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { t, getStoredLanguage } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Network, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProcessGraph from "@/components/map/ProcessGraph";

export default function LifeProcessMap() {
  const lang = getStoredLanguage();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["lifeProcessMap", currentUser?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("buildLifeProcessMap", {
        user_id: currentUser.id,
      });
      return res.data;
    },
    enabled: !!currentUser?.id,
  });

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Network className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold">{t("map_title", lang)}</h1>
            <p className="text-sm text-muted-foreground">
              {t("map_subtitle", lang)}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          {t("refresh", lang)}
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-24 text-muted-foreground text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          {t("map_building", lang)}
        </div>
      )}

      {isError && !isLoading && (
        <div className="p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-center">
          <p className="text-sm text-destructive mb-3">{t("map_error", lang)}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>{t("retry", lang)}</Button>
        </div>
      )}

      {!isLoading && !isError && nodes.length === 0 && (
        <div className="py-24 text-center">
          <Network className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            {t("map_empty", lang)}
          </p>
        </div>
      )}

      {!isLoading && !isError && nodes.length > 0 && (
        <>
          <ProcessGraph nodes={nodes} edges={edges} />
          <p className="text-xs text-muted-foreground mt-3">
            {t("map_legend", lang)}
          </p>
        </>
      )}
    </div>
  );
}