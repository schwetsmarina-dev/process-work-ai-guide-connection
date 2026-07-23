import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Reads the authoritative entitlement from the server.
 *
 * Use this to decide what to RENDER. Do not use it to protect anything that
 * matters on its own — the browser can be edited by the person using it, so
 * any action with real consequences must be checked again on the server.
 *
 * While loading, `hasAccess` is undefined rather than false, so the UI can
 * avoid flashing a paywall at someone who has already paid.
 */
export default function useEntitlement() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["entitlement"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getEntitlement", {});
      return res?.data ?? res;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    isLoading,
    error,
    refetch,
    hasAccess: isLoading ? undefined : Boolean(data?.hasAccess),
    plan: data?.plan || "free",
    isLifetime: Boolean(data?.isLifetime),
    isGranted: data?.plan === "beta",
    expiresAt: data?.expiresAt || null,
  };
}
