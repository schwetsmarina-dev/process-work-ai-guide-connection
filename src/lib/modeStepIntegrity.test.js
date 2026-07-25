import { describe, it, expect } from "vitest";
import { checkModeStepChain } from "./modeStepIntegrity";

function step(step_number, next_step_on_answer) {
  return { step_number, next_step_on_answer };
}

describe("checkModeStepChain", () => {
  it("passes a healthy 7-step chain (journaling shape)", () => {
    const steps = [
      step(1, 2), step(2, 3), step(3, 4), step(4, 5), step(5, 6), step(6, 7), step(7, null),
    ];
    const result = checkModeStepChain(steps);
    expect(result.ok).toBe(true);
    expect(result.terminalStep).toBe(7);
    expect(result.maxStepNumber).toBe(7);
  });

  it("flags a chain that ends before the last authored step (the exact bug class reported by testers)", () => {
    const steps = [
      step(1, 2), step(2, 3), step(3, null), // dead-ends here...
      step(4, 5), step(5, null), // ...but steps 4-5 exist and were authored
    ];
    const result = checkModeStepChain(steps);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("ends at step 3"))).toBe(true);
  });

  it("flags a next_step_on_answer pointing at a step_number that does not exist", () => {
    const steps = [step(1, 2), step(2, 99)];
    const result = checkModeStepChain(steps);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("does not exist"))).toBe(true);
  });

  it("flags a missing step 1", () => {
    const steps = [step(2, 3), step(3, null)];
    const result = checkModeStepChain(steps);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("no step_number 1"))).toBe(true);
  });

  it("flags a cycle", () => {
    const steps = [step(1, 2), step(2, 1)];
    const result = checkModeStepChain(steps);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("cycle"))).toBe(true);
  });

  it("flags an empty step list", () => {
    const result = checkModeStepChain([]);
    expect(result.ok).toBe(false);
    expect(result.stepCount).toBe(0);
  });

  it("flags unreachable steps that exist but are never linked to from step 1", () => {
    const steps = [step(1, 2), step(2, null), step(5, null)]; // step 5 orphaned
    const result = checkModeStepChain(steps);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes("unreachable"))).toBe(true);
  });
});
