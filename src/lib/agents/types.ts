// ============================================================
// Adaptive Reasoning AI System — Core Type Definitions
// ============================================================

export type AgentId =
  | 'problem-understanding'
  | 'planner'
  | 'solution-architect'
  | 'verifier';

export type AgentStatus = 'idle' | 'active' | 'completed' | 'failed' | 'waiting';

export type ReasoningPhase =
  | 'understanding'
  | 'analysis'
  | 'hypothesis-generation'
  | 'planning'
  | 'execution'
  | 'verification'
  | 'critique'
  | 'reflection'
  | 'completed';

export type StrategyRisk = 'low' | 'medium' | 'high';
export type StrategyComplexity = 'simple' | 'moderate' | 'complex';
export type VerificationResult = 'pass' | 'fail' | 'partial' | 'unknown';

// ─── Agent ────────────────────────────────────────────────────

export interface Agent {
  id: AgentId;
  name: string;
  description: string;
  icon: string;
  status: AgentStatus;
  output?: string;
  startTime?: number;
  endTime?: number;
  confidence?: number;
}

// ─── Tree of Thoughts ─────────────────────────────────────────

export interface ThoughtBranch {
  id: string;
  label: string;
  hypothesis: string;
  risk: StrategyRisk;
  complexity: StrategyComplexity;
  likelihood: number;      // 0-1
  scalability: number;     // 0-1
  maintainability: number; // 0-1
  status: 'exploring' | 'evaluated' | 'selected' | 'rejected' | 'executing';
  reasoning?: string;
  score?: number;
}

export interface TreeOfThoughts {
  problem: string;
  branches: ThoughtBranch[];
  selectedBranch?: string;
  evaluationSummary?: string;
}

// ─── Verification ─────────────────────────────────────────────

export interface VerificationCheck {
  id: string;
  name: string;
  result: VerificationResult;
  details: string;
  expected?: string;
  actual?: string;
}

export interface VerificationReport {
  overallResult: VerificationResult;
  checks: VerificationCheck[];
  summary: string;
}

// ─── Critique ─────────────────────────────────────────────────

export interface CritiquePoint {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: string;
  description: string;
  recommendation: string;
}

// ─── Reflection ───────────────────────────────────────────────

export interface ReflectionEntry {
  id: string;
  timestamp: number;
  phase: ReasoningPhase;
  insight: string;
  failedAssumption?: string;
  strategyChange?: string;
  lessonLearned?: string;
}

// ─── Memory ───────────────────────────────────────────────────

export interface FailureRecord {
  id: string;
  approach: string;
  failureCause: string;
  context: string;
  timestamp: number;
  preventedRetries: number;
}

export interface ProceduralRecord {
  id: string;
  workflow: string;
  steps: string[];
  successCount: number;
  lastUsed: number;
}

export interface MemoryState {
  shortTerm: {
    currentProblem: string;
    activePhase: ReasoningPhase;
    agentOutputs: Partial<Record<AgentId, string>>;
    hypothesisHistory: string[];
  };
  failureMemory: FailureRecord[];
  proceduralMemory: ProceduralRecord[];
  reflectionLog: ReflectionEntry[];
  sessionHistory: SessionSummary[];
}

// ─── Session ──────────────────────────────────────────────────

export interface SessionSummary {
  problem: string;
  solution: string;
  strategiesExplored: number;
  verificationPassed: boolean;
  reflections: number;
  timestamp: number;
}

// ─── Streaming Events ─────────────────────────────────────────

export type StreamEventType =
  | 'phase-change'
  | 'agent-start'
  | 'agent-output'
  | 'agent-complete'
  | 'thought-branch'
  | 'thought-evaluation'
  | 'thought-selected'
  | 'verification-check'
  | 'verification-complete'
  | 'critique-point'
  | 'reflection-entry'
  | 'memory-update'
  | 'final-answer'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  timestamp: number;
  data: unknown;
}
