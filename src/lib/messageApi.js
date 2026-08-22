import { messagesService } from "@/services/messages";

/**
 * Compatibility facade for existing session code.
 * Infrastructure access now lives behind the provider-neutral services layer.
 * @param {{ session_id: any, mode_id?: any, step_number?: any, role: any, content: any }} msg
 */
export async function createMessage({ session_id, mode_id, step_number, role, content }) {
  return messagesService.create({ session_id, mode_id, step_number, role, content });
}

/** Lists all messages for a session. */
export async function listMessages(session_id) {
  return messagesService.list(session_id);
}

/**
 * Reverts the last exchange (user answer + facilitator reply) and rolls the
 * session one step back. Returns { reverted, removed_user_text, new_current_step }.
 */
export async function revertLastExchange(session_id) {
  return messagesService.revertLastExchange(session_id);
}
