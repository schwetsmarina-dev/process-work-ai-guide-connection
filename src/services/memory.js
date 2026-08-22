import provider from "@/services/provider/base44Provider";

const memories = provider.entity("UserMemory");

export const memoryService = {
  list: (query, sort, limit) => memories.filter(query, sort, limit),
  create: (payload) => memories.create(payload),
  update: (id, payload) => memories.update(id, payload),
  delete: (id) => memories.delete(id),

  persistSessionMemory: (payload) =>
    provider.functions.invoke("persistSessionMemory", payload),
};

export default memoryService;
