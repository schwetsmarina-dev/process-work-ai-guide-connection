import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { canUseFeature } from "@/lib/entitlement";

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
export const ENTITLEMENT_QUERY_KEY = ["entitlement"];

async function fetchEntitlementRaw() {
  const res = await base44.functions.invoke("getEntitlement", {});
  return res?.data ?? res;
}

/**
 * Resolve the entitlement inside an async handler, awaiting the request if it
 * has not landed yet and reusing the cached value if it has.
 *
 * Needed because the hook reports `hasAccess: undefined` while loading, and a
 * handler that treats "undefined" as "no access" silently switches paid
 * features off for paying users during the first seconds of a page. That is
 * exactly how cross-session memory got disabled for everyone.
 */
export async function fetchEntitlement(queryClient) {
  return queryClient.fetchQuery({
    queryKey: ENTITLEMENT_QUERY_KEY,
    queryFn: fetchEntitlementRaw,
    staleTime: 5 * 60 * 1000,
  });
}

export default function useEntitlement() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ENTITLEMENT_QUERY_KEY,
    queryFn: fetchEntitlementRaw,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const entitlement = data
    ? {
        plan: data.plan,
        status: data.status,
        expires_at: data.expiresAt,
      }
    : null;

  return {
    isLoading,
    error,
    refetch,
    entitlement,
    usageByMode: data?.usageByMode || {},
    hasAccess: isLoading ? undefined : Boolean(data?.hasAccess),
    plan: data?.plan || "free",
    isLifetime: Boolean(data?.isLifetime),
    isGranted: data?.plan === "beta",
    expiresAt: data?.expiresAt || null,
    /** Gate a screen: can(FEATURES.SUMMARY). Undefined while loading. */
    can: (feature) =>
      isLoading ? undefined : canUseFeature(entitlement, feature),
  };
}
