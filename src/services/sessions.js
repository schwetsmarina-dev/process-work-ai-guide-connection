import provider from "@/services/provider/base44Provider";

const sessions = provider.entity("Session");
const modes = provider.entity("Mode");
const modeSteps = provider.entity("ModeStep");
const terms = provider.entity("Term");

export const sessionsService = {
  list: (sort, limit) => sessions.list(sort, limit),
  filter: (query, sort, limit) => sessions.filter(query, sort, limit),
  create: (payload) => sessions.create(payload),
  update: (id, payload) => sessions.update(id, payload),
  delete: (id) => sessions.delete(id),

  async getById(id) {
    if (!id) return null;
    const rows = await sessions.filter({ id });
    return rows?.[0] || null;
  },

  listModes: (sort, limit) => modes.list(sort, limit),
  listModeSteps: (sort = "step_number", limit = 500) => modeSteps.list(sort, limit),
  findTerms: (query, sort, limit) => terms.filter(query, sort, limit),

  start: (payload) => provider.functions.invoke("startSession", payload),
  persistMemory: (payload) => provider.functions.invoke("persistSessionMemory", payload),
  regenerateSummary: (payload) => provider.functions.invoke("regenerateSessionSummary", payload),
  abandonStale: (payload = {}) => provider.functions.invoke("abandonStaleSessions", payload),
};

export default sessionsService;
