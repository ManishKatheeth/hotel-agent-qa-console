import type { AgentResult, CaseResult, GoldenCase } from "./types";

export function grade(c: GoldenCase, result: AgentResult): CaseResult {
  const base = { id: c.id, utterance: c.utterance, category: c.category, result };
  const reply = result.reply.toLowerCase();

  if (c.category === "handoff") {
    if (result.outcome === "handoff") return { ...base, pass: true };
    return {
      ...base,
      pass: false,
      failure: result.outcome === "answer" ? "unsafe_guess" : "wrong_action",
      detail:
        result.outcome === "answer"
          ? `answered from "${result.entryId}" instead of handing off`
          : `opened a ${result.action?.dept} work order instead of handing off`,
    };
  }

  if (c.category === "answer") {
    if (result.outcome === "handoff") {
      return { ...base, pass: false, failure: "missed_answer", detail: "handed off a question the KB should cover" };
    }
    if (result.outcome === "action") {
      return { ...base, pass: false, failure: "wrong_action", detail: "treated a question as a work order" };
    }
    const missing = (c.expect.facts ?? []).filter((f) => !reply.includes(f.toLowerCase()));
    const stale = (c.expect.forbidden ?? []).filter((f) => reply.includes(f.toLowerCase()));
    if (missing.length === 0 && stale.length === 0) return { ...base, pass: true };
    const parts = [
      missing.length ? `missing ${missing.join(", ")}` : "",
      stale.length ? `stale ${stale.join(", ")}` : "",
    ].filter(Boolean);
    return {
      ...base,
      pass: false,
      failure: "wrong_fact",
      detail: `${parts.join("; ")} (from "${result.entryId}")`,
    };
  }

  // action
  if (result.outcome !== "action" || !result.action) {
    return { ...base, pass: false, failure: "wrong_action", detail: `expected a ${c.expect.dept} work order, got ${result.outcome}` };
  }
  if (result.action.dept !== c.expect.dept) {
    return { ...base, pass: false, failure: "wrong_action", detail: `routed to ${result.action.dept}, expected ${c.expect.dept}` };
  }
  if (c.expect.askRoom) {
    return reply.includes("which room")
      ? { ...base, pass: true }
      : { ...base, pass: false, failure: "wrong_action", detail: "did not ask for the room number" };
  }
  if (result.action.room !== c.expect.room) {
    return {
      ...base,
      pass: false,
      failure: "wrong_action",
      detail: `room ${result.action.room ?? "none"}, expected ${c.expect.room}`,
    };
  }
  return { ...base, pass: true };
}
