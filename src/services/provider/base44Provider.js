import { base44 } from "@/api/base44Client";

/**
 * Base44 infrastructure adapter.
 *
 * This is the only services-layer module that should know about the Base44 SDK.
 * Domain services depend on this adapter rather than importing `base44` directly,
 * so a future Supabase/custom API provider can implement the same contract.
 */
export const base44Provider = {
  auth: {
    getCurrentUser: () => base44.auth.me(),
  },

  entity(name) {
    const entity = base44.entities?.[name];
    if (!entity) throw new Error(`[services] Unknown Base44 entity: ${name}`);

    return {
      list: (sort, limit) => entity.list(sort, limit),
      filter: (query, sort, limit) => entity.filter(query, sort, limit),
      create: (payload) => entity.create(payload),
      update: (id, payload) => entity.update(id, payload),
      delete: (id) => entity.delete(id),
    };
  },

  functions: {
    async invoke(name, payload = {}) {
      const result = await base44.functions.invoke(name, payload);
      return result?.data ?? result;
    },
  },
};

export default base44Provider;
