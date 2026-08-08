import provider from "@/services/provider/base44Provider";

/**
 * Provider-neutral AI boundary for Talvira.
 * The current implementation delegates to Base44's invokeAI backend function.
 * A future provider can route this to OpenAI, Anthropic, Gemini, or an internal
 * model gateway without changing the domain/session code that calls this API.
 */
export const aiService = {
  async generate({ prompt, response_json_schema, model } = {}) {
    const data = await provider.functions.invoke("invokeAI", {
      prompt,
      response_json_schema,
      model,
    });
    return data?.response ?? data;
  },

  detectUserPatterns: (payload) =>
    provider.functions.invoke("detectUserPatterns", payload),

  buildLifeProcessMap: (payload) =>
    provider.functions.invoke("buildLifeProcessMap", payload),

  generateProcessPractice: (payload) =>
    provider.functions.invoke("generateProcessPractice", payload),

  generatePracticeAudio: (payload) =>
    provider.functions.invoke("generatePracticeAudio", payload),
};

export default aiService;
