import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, response_json_schema, model } = await req.json();

    if (!prompt) {
      return Response.json({ error: 'Missing required field: prompt' }, { status: 400 });
    }

    const params = { prompt };
    if (response_json_schema) params.response_json_schema = response_json_schema;
    if (model) params.model = model;

    const response = await base44.integrations.Core.InvokeLLM(params);

    return Response.json({ response });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});