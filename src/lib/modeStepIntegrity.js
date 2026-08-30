// Pure validation of the ModeStep.next_step_on_answer chain for one mode.
//
// Why this exists: a tester reported a session ending abruptly with no way to
// answer the final question — root cause was SessionChat.jsx correctly
// treating "no next_step_on_answer" as "this is the true final step", but a
// step's next_step_on_answer field can silently point at a step_number that
// doesn't exist (or dead-end early) after a manual data edit in Base44. That
// is invisible in the UI until a real user hits it mid-session.
//
// This function walks the chain the same way the app does at runtime and
// reports exactly that class of problem ahead of time. Used by the admin
// self-test panel (AdminDataStatus.jsx) and covered by
// modeStepIntegrity.test.js.
export function checkModeStepChain(modeSteps) {
  const byNumber = new Map((modeSteps || []).filter(s => s.block !== "continuation" && !String(s.step_key || "").includes("_continue_")).map((s) => [Number(s.step_number), s]));

  if (byNumber.size === 0) {
    return { ok: false, issues: ["no steps found for this mode"], terminalStep: null, stepCount: 0, maxStepNumber: null };
  }

  const issues = [];

  if (!byNumber.has(1)) {
    issues.push("no step_number 1 — sessions cannot start");
    return { ok: false, issues, terminalStep: null, stepCount: byNumber.size, maxStepNumber: Math.max(...byNumber.keys()) };
  }

  const visited = new Set();
  let current = 1;
  let terminalStep = null;
  let guard = 0;

  while (byNumber.has(current) && guard < 200) {
    if (visited.has(current)) {
      issues.push(`cycle detected: step ${current} is revisited`);
      break;
    }
    visited.add(current);
    const step = byNumber.get(current);
    const next = step.next_step_on_answer;
    if (next === null || next === undefined || next === "") {
      terminalStep = current;
      break;
    }
    if (!byNumber.has(Number(next))) {
      issues.push(`step ${current} has next_step_on_answer=${next}, which does not exist as a step_number`);
      break;
    }
    current = Number(next);
    guard++;
  }

  const maxStepNumber = Math.max(...byNumber.keys());

  // Steps that exist in the table but are never reached by following
  // next_step_on_answer from step 1 — orphaned by a bad edit, silently dead.
  const unreachable = [...byNumber.keys()].filter((n) => !visited.has(n));
  if (unreachable.length > 0) {
    issues.push(`unreachable from step 1: step(s) ${unreachable.sort((a, b) => a - b).join(", ")}`);
  }

  // The specific bug class this module exists to catch: the chain dead-ends
  // before the highest-numbered step that was actually authored.
  if (terminalStep !== null && terminalStep < maxStepNumber) {
    issues.push(
      `chain ends at step ${terminalStep} but step ${maxStepNumber} exists — a session would be cut short before reaching it`
    );
  }

  if (terminalStep === null && issues.length === 0) {
    issues.push(`chain did not terminate within ${guard} hops — possible misconfiguration`);
  }

  return { ok: issues.length === 0, issues, terminalStep, stepCount: byNumber.size, maxStepNumber };
}
