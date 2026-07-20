import { base44 } from "@/api/base44Client";

/**
 * Creates a Message record via backend function (bypasses frontend RLS).
 */
export async function createMessage({ session_id, mode_id, step_number, role, content }) {
  const res = await base44.functions.invoke("createSessionMessage", {
    session_id,
    mode_id: mode_id || null,
    step_number: step_number || null,
    role,
    content,
    created_at: new Date().toISOString(),
  });
  return res.data?.message;
}

/**
 * Lists all messages for a session via backend function (bypasses frontend RLS).
 */
export async function listMessages(session_id) {
  const res = await base44.functions.invoke("listSessionMessages", { session_id });
  return res.data?.messages || [];
}

/**
 * Reverts the last exchange (user answer + facilitator reply) and rolls the
 * session one step back. Returns { reverted, removed_user_text, new_current_step }.
 * The removed user text is meant to be placed back into the input for editing.
 */
export async function revertLastExchange(session_id) {
  const res = await base44.functions.invoke("revertLastExchange", { session_id });
  return res.data;
}
