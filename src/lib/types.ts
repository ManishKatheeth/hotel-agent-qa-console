export type Category = "answer" | "handoff" | "action";
export type Dept = "maintenance" | "housekeeping";

export interface KbEntry {
  id: string;
  keywords: string[];
  answer: string;
}

export interface KbVersion {
  id: "live" | "draft";
  label: string;
  entries: KbEntry[];
  changelog: string[];
}

export interface GoldenCase {
  id: string;
  utterance: string;
  category: Category;
  expect: {
    /** lowercase substrings the reply must contain */
    facts?: string[];
    /** lowercase substrings the reply must NOT contain (stale or wrong facts) */
    forbidden?: string[];
    dept?: Dept;
    room?: string;
    /** the agent should ask which room instead of guessing */
    askRoom?: boolean;
  };
}

export interface AgentResult {
  outcome: "answer" | "handoff" | "action";
  reply: string;
  /** KB entry used for an answer */
  entryId?: string;
  /** why the agent handed off */
  reason?: "no_match";
  action?: { type: "create_work_order"; dept: Dept; room?: string };
}

export type Agent = (utterance: string, kb: KbEntry[]) => AgentResult | Promise<AgentResult>;

export type FailureType =
  | "unsafe_guess" // should have handed off, answered instead
  | "wrong_fact" // answered, but stale/missing/forbidden facts
  | "missed_answer" // had an answer in scope but handed off
  | "wrong_action"; // action when none was wanted, or wrong dept/room

export interface CaseResult {
  id: string;
  utterance: string;
  category: Category;
  pass: boolean;
  failure?: FailureType;
  detail?: string;
  result: AgentResult;
}

export interface Metrics {
  total: number;
  passed: number;
  passRate: number;
  /** answer cases passed / answer cases */
  answerAccuracy: number;
  /** handoff cases where the agent answered or acted instead / handoff cases */
  unsafeGuessRate: number;
  /** answer cases with a wrong or stale fact / answer cases */
  wrongFactRate: number;
  actionAccuracy: number;
  byCategory: Record<Category, { passed: number; total: number }>;
}

export interface RunReport {
  kb: KbVersion["id"];
  metrics: Metrics;
  cases: CaseResult[];
}

export interface Diff {
  fixed: CaseResult[];
  regressed: { before: CaseResult; after: CaseResult }[];
  stillFailing: CaseResult[];
  stillPassing: number;
}

export interface QueueItem {
  key: string;
  label: string;
  count: number;
  utterances: string[];
  suggestedKeywords: string[];
  status: "needs_manager_answer";
}
