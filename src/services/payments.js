import provider from "@/services/provider/base44Provider";

/**
 * Payment/subscription boundary. UI code should depend on this service rather
 * than a concrete billing vendor or Base44 function name.
 */
export const paymentsService = {
  getEntitlement: () => provider.functions.invoke("getEntitlement", {}),

  createCheckoutSession: (payload = {}) =>
    provider.functions.invoke("createCheckoutSession", payload),

  createPortalSession: (payload = {}) =>
    provider.functions.invoke("createPortalSession", payload),

  adminSetPlan: (payload) => provider.functions.invoke("adminSetPlan", payload),
};

export default paymentsService;
