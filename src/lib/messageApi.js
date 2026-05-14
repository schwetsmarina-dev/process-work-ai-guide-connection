import { base44 } from "@/api/base44Client";

/**
 * Creates a Message record via backend function (bypasses frontend RLS).
 * All Message.create calls must go through this helper.
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