import provider from "@/services/provider/base44Provider";

export const messagesService = {
  async create({ session_id, mode_id, step_number, role, content }) {
    const data = await provider.functions.invoke("createSessionMessage", {
      session_id,
      mode_id: mode_id || null,
      step_number: step_number || null,
      role,
      content,
      created_at: new Date().toISOString(),
    });
    return data?.message;
  },

  async list(session_id) {
    const data = await provider.functions.invoke("listSessionMessages", { session_id });
    return data?.messages || [];
  },

  revertLastExchange: (session_id) =>
    provider.functions.invoke("revertLastExchange", { session_id }),
};

export default messagesService;
