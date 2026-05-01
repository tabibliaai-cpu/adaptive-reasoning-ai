// ============================================================
// Adaptive Reasoning AI System — Memory System
// Multi-layer memory: Short-term, Long-term, Failure, Procedural
// ============================================================

import {
  MemoryState,
  FailureRecord,
  ProceduralRecord,
  ReflectionEntry,
  AgentId,
  ReasoningPhase,
} from './types';

let instance: MemorySystem | null = null;

export class MemorySystem {
  private state: MemoryState;

  private constructor() {
    this.state = {
      shortTerm: {
        currentProblem: '',
        activePhase: 'understanding',
        agentOutputs: {},
        hypothesisHistory: [],
      },
      failureMemory: [],
      proceduralMemory: [],
      reflectionLog: [],
      sessionHistory: [],
    };
  }

  static getInstance(): MemorySystem {
    if (!instance) {
      instance = new MemorySystem();
    }
    return instance;
  }

  // ─── Short-Term Memory ──────────────────────────────────────

  setCurrentProblem(problem: string) {
    this.state.shortTerm.currentProblem = problem;
  }

  setPhase(phase: ReasoningPhase) {
    this.state.shortTerm.activePhase = phase;
  }

  addAgentOutput(agentId: AgentId, output: string) {
    this.state.shortTerm.agentOutputs[agentId] = output;
  }

  addHypothesis(hypothesis: string) {
    this.state.shortTerm.hypothesisHistory.push(hypothesis);
  }

  getShortTerm() {
    return { ...this.state.shortTerm };
  }

  // ─── Failure Memory ─────────────────────────────────────────

  recordFailure(approach: string, failureCause: string, context: string) {
    const existing = this.state.failureMemory.find(
      (f) => f.approach === approach && f.context === context
    );
    if (existing) {
      existing.preventedRetries += 1;
      existing.timestamp = Date.now();
    } else {
      const record: FailureRecord = {
        id: `fail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        approach,
        failureCause,
        context,
        timestamp: Date.now(),
        preventedRetries: 1,
      };
      this.state.failureMemory.push(record);
    }
  }

  isApproachFailed(approach: string, context?: string): FailureRecord | null {
    return (
      this.state.failureMemory.find(
        (f) =>
          f.approach === approach &&
          (!context || f.context === context)
      ) ?? null
    );
  }

  getRelevantFailures(context: string): FailureRecord[] {
    const keywords = context.toLowerCase().split(/\s+/);
    return this.state.failureMemory.filter((f) =>
      keywords.some(
        (k) =>
          f.approach.toLowerCase().includes(k) ||
          f.context.toLowerCase().includes(k)
      )
    );
  }

  // ─── Procedural Memory ──────────────────────────────────────

  recordSuccessfulWorkflow(workflow: string, steps: string[]) {
    const existing = this.state.proceduralMemory.find(
      (p) => p.workflow === workflow
    );
    if (existing) {
      existing.successCount += 1;
      existing.steps = steps;
      existing.lastUsed = Date.now();
    } else {
      const record: ProceduralRecord = {
        id: `proc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        workflow,
        steps,
        successCount: 1,
        lastUsed: Date.now(),
      };
      this.state.proceduralMemory.push(record);
    }
  }

  findRelevantWorkflow(context: string): ProceduralRecord | null {
    const keywords = context.toLowerCase().split(/\s+/);
    const matches = this.state.proceduralMemory.filter((p) =>
      keywords.some((k) => p.workflow.toLowerCase().includes(k))
    );
    if (matches.length === 0) return null;
    return matches.sort((a, b) => b.successCount - a.successCount)[0];
  }

  // ─── Reflection Memory ──────────────────────────────────────

  addReflection(entry: ReflectionEntry) {
    this.state.reflectionLog.push(entry);
  }

  getRecentReflections(count = 5): ReflectionEntry[] {
    return this.state.reflectionLog.slice(-count);
  }

  // ─── Session History ────────────────────────────────────────

  recordSession(session: MemoryState['sessionHistory'][0]) {
    this.state.sessionHistory.push(session);
  }

  findSimilarSessions(problem: string): MemoryState['sessionHistory'] {
    const keywords = problem.toLowerCase().split(/\s+/).slice(0, 10);
    return this.state.sessionHistory.filter((s) =>
      keywords.some((k) => s.problem.toLowerCase().includes(k))
    );
  }

  // ─── State Export ───────────────────────────────────────────

  getState(): MemoryState {
    return JSON.parse(JSON.stringify(this.state));
  }

  reset() {
    this.state.shortTerm = {
      currentProblem: '',
      activePhase: 'understanding',
      agentOutputs: {},
      hypothesisHistory: [],
    };
  }
}
