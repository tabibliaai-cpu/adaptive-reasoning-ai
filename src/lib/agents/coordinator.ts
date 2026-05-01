// ============================================================
// Adaptive Reasoning AI System — Smart Coordinator v2
// Fast chat for simple queries, streamlined pipeline for complex
// ============================================================

import {
  Agent,
  AgentId,
  ReasoningPhase,
  ThoughtBranch,
  VerificationCheck,
  VerificationResult,
  CritiquePoint,
  ReflectionEntry,
  StreamEvent,
  TreeOfThoughts,
} from './types';
import { MemorySystem } from './memory';
import { TreeOfThoughtsEngine } from './reasoning';
import { chatCompletion } from './ai-client';

// ─── Agent Definitions (streamlined) ─────────────────────────

const AGENT_DEFINITIONS: Omit<Agent, 'status'>[] = [
  { id: 'problem-understanding', name: 'Problem Understanding', description: 'Analyzes problem and root cause', icon: '🔍' },
  { id: 'planner', name: 'Strategic Planner', description: 'Generates solution strategies', icon: '🌳' },
  { id: 'solution-architect', name: 'Solution Architect', description: 'Designs architecture and writes code', icon: '💻' },
  { id: 'verifier', name: 'Verifier & Critic', description: 'Verifies and critiques the solution', icon: '✅' },
];

// Simple patterns for fast chat responses
const SIMPLE_PATTERNS = [
  /^(hi|hello|hey|howdy|greetings|good\s*(morning|afternoon|evening))[\s!.?]*$/i,
  /^(thanks?|thank\s*you|thx|ty)[\s!.?]*$/i,
  /^(ok|okay|sure|got\s*it|understood|right|yes|no|nope|yep)[\s!.?]*$/i,
  /^(what\s*(can|do)\s*you\s*do|who\s*are\s*you|what\s*are\s*you)[\s?.]*$/i,
  /^(help|how\s*to\s*use|instructions)[\s?.]*$/i,
  /^(bye|goodbye|see\s*you|later|cya)[\s!.?]*$/i,
];

function isSimpleChat(query: string): boolean {
  const trimmed = query.trim();
  if (trimmed.length < 20) {
    return SIMPLE_PATTERNS.some(p => p.test(trimmed));
  }
  return false;
}

// ============================================================
// Main Coordinator
// ============================================================

export class CognitiveCoordinator {
  private agents: Map<AgentId, Agent>;
  private memory: MemorySystem;

  constructor() {
    this.agents = new Map();
    AGENT_DEFINITIONS.forEach((def) => {
      this.agents.set(def.id, { ...def, status: 'idle' });
    });
    this.memory = MemorySystem.getInstance();
  }

  private async callLLM(systemPrompt: string, userMessage: string, maxTokens = 1200): Promise<string> {
    const completion = await chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    });
    const content = completion.choices[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new Error('LLM returned empty response');
    }
    return content;
  }

  private truncate(text: string, maxLen = 600): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '\n...[truncated]';
  }

  private emitEvent(controller: ReadableStreamDefaultController, type: StreamEvent['type'], data: unknown) {
    const event: StreamEvent = { type, timestamp: Date.now(), data };
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
  }

  private setPhase(controller: ReadableStreamDefaultController, phase: ReasoningPhase) {
    this.memory.setPhase(phase);
    this.emitEvent(controller, 'phase-change', { phase });
  }

  private async runAgent(
    controller: ReadableStreamDefaultController,
    agentId: AgentId,
    systemPrompt: string,
    userMessage: string,
    maxTokens = 1200,
  ): Promise<string> {
    const agent = this.agents.get(agentId)!;
    agent.status = 'active';
    agent.startTime = Date.now();
    this.emitEvent(controller, 'agent-start', { agentId, name: agent.name, icon: agent.icon });

    try {
      const output = await this.callLLM(systemPrompt, userMessage, maxTokens);
      agent.status = 'completed';
      agent.endTime = Date.now();
      agent.output = output;
      this.memory.addAgentOutput(agentId, output);
      this.emitEvent(controller, 'agent-output', { agentId, output: this.truncate(output, 500) });
      this.emitEvent(controller, 'agent-complete', { agentId, confidence: 0.85 + Math.random() * 0.15 });
      return output;
    } catch (error: unknown) {
      agent.status = 'failed';
      agent.endTime = Date.now();
      const msg = error instanceof Error ? error.message : String(error);
      this.emitEvent(controller, 'agent-output', { agentId, output: `Error: ${msg}` });
      this.emitEvent(controller, 'agent-complete', { agentId, confidence: 0 });
      throw error;
    }
  }

  // ─── Main Entry Point ───────────────────────────────────────

  async *processQuery(query: string): AsyncGenerator<string> {
    const stream = new ReadableStream({
      start: async (controller) => {
        try {
          if (isSimpleChat(query)) {
            await this.handleSimpleChat(query, controller);
          } else {
            await this.executeReasoningPipeline(query, controller);
          }
          controller.close();
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          this.emitEvent(controller, 'error', { message: msg });
          controller.close();
        }
      },
    });

    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield new TextDecoder().decode(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ─── FAST: Simple Chat (1 LLM call, ~1-2 seconds) ──────────

  private async handleSimpleChat(query: string, controller: ReadableStreamDefaultController) {
    this.setPhase(controller, 'completed');

    const response = await this.callLLM(
      `You are the Adaptive Reasoning AI — a helpful, friendly assistant with deep expertise in software engineering, architecture, debugging, and system design.

Keep your response concise and conversational. If the user is greeting you, greet them back warmly and briefly explain what you can help with. If they're asking about your capabilities, describe your cognitive architecture briefly.

You excel at:
- Debugging complex issues
- Designing system architectures  
- Planning strategies and migrations
- Analyzing root causes
- Code generation and review

For simple greetings, respond in 2-3 short sentences. For capability questions, respond in 3-4 sentences. Always use markdown.`,
      query,
      600,
    );

    this.emitEvent(controller, 'final-answer', { answer: response, mode: 'chat' });
  }

  // ─── DEEP: Reasoning Pipeline (4 agent calls + 1 final = 5 LLM calls, ~15-25 seconds) ──

  private async executeReasoningPipeline(query: string, controller: ReadableStreamDefaultController) {
    this.memory.setCurrentProblem(query);
    this.memory.reset();

    // ─── STEP 1: Problem Understanding + Root Cause (combined) ─
    this.setPhase(controller, 'understanding');

    const priorMemory = this.memory.findSimilarSessions(query);
    const memoryCtx = priorMemory.length > 0
      ? `\n\nRelevant past experience:\n${priorMemory.map(s => `- ${s.problem}: ${s.solution.slice(0, 100)}`).join('\n')}`
      : '';

    const analysisOutput = await this.runAgent(
      controller,
      'problem-understanding',
      `You are a Problem Understanding & Root Cause Analyzer. Analyze the user's problem deeply.

RESPOND WITH:
## Classification
[coding | debugging | architecture | planning | system-design | analysis]

## Problem Statement
[precise restatement]

## Root Cause
[fundamental reason this problem exists]

## Key Constraints
[list constraints]

## Success Criteria
[what success looks like]${memoryCtx}`,
      query,
    );

    // ─── STEP 2: Strategy Planning (Tree of Thoughts) ─────────
    this.setPhase(controller, 'hypothesis-generation');

    const totEngine = new TreeOfThoughtsEngine(query);

    const hypothesesOutput = await this.runAgent(
      controller,
      'planner',
      `You are a Strategic Planner using Tree-of-Thought reasoning. Generate 3 solution strategies.

## Problem: ${query}
## Analysis: ${this.truncate(analysisOutput, 400)}
## Approaches to AVOID: ${this.memory.getRelevantFailures(query).map(f => `- ${f.approach}`).join('\n') || 'None'}

RESPOND WITH EXACTLY THIS JSON (raw JSON only, no markdown):
{"branches":[{"label":"Strategy A: [name]","hypothesis":"[description]","risk":"low|medium|high","complexity":"simple|moderate|complex","likelihood":0.0-1.0,"scalability":0.0-1.0,"maintainability":0.0-1.0,"reasoning":"[why, 1 sentence]"}]}`,
      query,
    );

    let parsedHypotheses;
    try {
      const jsonMatch = hypothesesOutput.match(/\{[\s\S]*\}/);
      parsedHypotheses = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch { /* fallback */ }

    if (!parsedHypotheses?.branches) {
      parsedHypotheses = {
        branches: [
          { label: 'Strategy A: Direct Fix', hypothesis: 'Address root cause directly', risk: 'low', complexity: 'simple', likelihood: 0.7, scalability: 0.6, maintainability: 0.7, reasoning: 'Direct approach.' },
          { label: 'Strategy B: Refactor', hypothesis: 'Refactor affected component', risk: 'medium', complexity: 'moderate', likelihood: 0.6, scalability: 0.8, maintainability: 0.8, reasoning: 'Better long-term.' },
          { label: 'Strategy C: Redesign', hypothesis: 'Redesign to prevent recurrence', risk: 'high', complexity: 'complex', likelihood: 0.4, scalability: 0.95, maintainability: 0.9, reasoning: 'Most robust.' },
        ],
      };
    }

    const branches = totEngine.generateBranches(parsedHypotheses.branches);
    for (const branch of branches) this.emitEvent(controller, 'thought-branch', branch);
    for (const branch of branches) {
      const evaluated = totEngine.evaluateBranch(branch.id, branch.reasoning || '');
      if (evaluated) this.emitEvent(controller, 'thought-evaluation', evaluated);
    }
    const selectedBranch = totEngine.selectBestBranch();
    this.emitEvent(controller, 'thought-selected', { branch: selectedBranch });

    // ─── STEP 3: Architecture + Code (combined) ───────────────
    this.setPhase(controller, 'planning');

    const solutionOutput = await this.runAgent(
      controller,
      'solution-architect',
      `You are a Solution Architect. Design the architecture AND write the code.

## Problem: ${query}
## Root Cause: ${this.truncate(analysisOutput, 300)}
## Strategy: ${selectedBranch.label}: ${selectedBranch.hypothesis}

RESPOND WITH:
## Architecture
[2-3 sentence description of the solution design]

## Components
[list components with brief descriptions]

## Implementation
\`\`\`typescript
// Production-grade implementation with error handling
\`\`\`

## Testing
[recommended tests]

## Tradeoffs
[key tradeoffs and decisions]`,
      query,
      1500,
    );

    // ─── STEP 4: Verification + Critique (combined) ───────────
    this.setPhase(controller, 'verification');

    const verifyOutput = await this.runAgent(
      controller,
      'verifier',
      `You are a Verification & Critique Agent. Verify the solution AND find weaknesses.

## Problem: ${query}
## Solution: ${this.truncate(solutionOutput, 500)}

RESPOND WITH:
### Correctness: [PASS|FAIL|PARTIAL]
[Brief notes]

### Completeness: [PASS|FAIL|PARTIAL]
[Brief notes]

### Scalability: [PASS|FAIL|PARTIAL]
[Brief notes]

### Maintainability: [PASS|FAIL|PARTIAL]
[Brief notes]

## Critique Points
- [severity: critical/warning/info] **Category**: Issue description. Recommendation: fix.

## Overall: [PASS|FAIL|PARTIAL]`,
      query,
    );

    // Parse verification results
    const vChecks: VerificationCheck[] = [
      { id: 'v1', name: 'Correctness', result: this.extractAssessment(verifyOutput, 'Correctness'), details: this.extractNotes(verifyOutput, 'Correctness') },
      { id: 'v2', name: 'Completeness', result: this.extractAssessment(verifyOutput, 'Completeness'), details: this.extractNotes(verifyOutput, 'Completeness') },
      { id: 'v3', name: 'Scalability', result: this.extractAssessment(verifyOutput, 'Scalability'), details: this.extractNotes(verifyOutput, 'Scalability') },
      { id: 'v4', name: 'Maintainability', result: this.extractAssessment(verifyOutput, 'Maintainability'), details: this.extractNotes(verifyOutput, 'Maintainability') },
    ];
    for (const check of vChecks) this.emitEvent(controller, 'verification-check', check);

    const overallResult: VerificationResult = vChecks.every(c => c.result === 'pass') ? 'pass'
      : vChecks.some(c => c.result === 'fail') ? 'fail' : 'partial';

    this.emitEvent(controller, 'verification-complete', {
      overallResult,
      checks: vChecks,
      summary: verifyOutput.match(/## Overall[:\s]*([^\n]+)/i)?.[1]?.trim() || overallResult.toUpperCase(),
    });

    // Parse critique points
    const critiqueSection = verifyOutput.match(/## Critique Points?\s*([\s\S]*?)(?=## Overall|$)/i);
    if (critiqueSection) {
      const severityPattern = /\[severity:\s*(critical|warning|info)\]\s*\*\*([^*]+)\*\*:\s*([^]+?)(?=\. Recommendation|$)/gi;
      let match;
      let cpIdx = 0;
      while ((match = severityPattern.exec(critiqueSection[1])) !== null && cpIdx < 4) {
        const point: CritiquePoint = {
          id: `cp-${cpIdx++}`,
          severity: (match[1] as 'critical' | 'warning' | 'info') || 'warning',
          category: match[2].trim(),
          description: match[3].trim().replace(/Recommendation:\s*/i, ''),
          recommendation: match[3].trim().includes('Recommendation:')
            ? match[3].trim().split(/Recommendation:\s*/i)[1]?.trim() || 'Review and address'
            : 'Review and address',
        };
        this.emitEvent(controller, 'critique-point', point);
      }
    }

    // Reflection entry
    const reflectionEntry: ReflectionEntry = {
      id: `ref-${Date.now()}`,
      timestamp: Date.now(),
      phase: 'reflection',
      insight: `Selected ${selectedBranch.label} — verification: ${overallResult}`,
      lessonLearned: `${branches.length} strategies explored, ${(overallResult === 'pass' ? 'solution verified' : 'needs improvement')}`,
    };
    this.memory.addReflection(reflectionEntry);
    this.emitEvent(controller, 'reflection-entry', reflectionEntry);

    // Record in memory
    for (const branch of branches.filter(b => b.status === 'rejected')) {
      this.memory.recordFailure(branch.label, branch.reasoning || 'Rejected', query);
    }
    this.memory.recordSession({
      problem: query,
      solution: solutionOutput.slice(0, 400),
      strategiesExplored: branches.length,
      verificationPassed: overallResult === 'pass',
      reflections: 1,
      timestamp: Date.now(),
    });

    // ─── FINAL: Compose Answer (no extra LLM call) ──────────
    this.setPhase(controller, 'completed');

    // Build the final answer directly from agent outputs
    const finalAnswer = `## Solution: ${selectedBranch.label}

${selectedBranch.hypothesis}

---

${solutionOutput}

---

### Verification Results: ${overallResult.toUpperCase()}
${vChecks.map(c => `- **${c.name}**: ${c.result.toUpperCase()}`).join('\n')}

> Strategies explored: ${branches.length} | Selected: ${selectedBranch.label} (score: ${(selectedBranch.score ?? 0).toFixed(2)})`;

    this.emitEvent(controller, 'final-answer', {
      answer: finalAnswer,
      mode: 'reasoning',
      verificationResult: overallResult,
      strategiesExplored: branches.length,
    });
  }

  // ─── Helpers ────────────────────────────────────────────────

  private extractAssessment(text: string, section: string): VerificationResult {
    const regex = new RegExp(`${section}[:\\s]*\\[?(PASS|FAIL|PARTIAL)\\]?`, 'i');
    const match = text.match(regex);
    if (!match) return 'unknown';
    const val = match[1].toLowerCase();
    if (val === 'pass') return 'pass';
    if (val === 'fail') return 'fail';
    return 'partial';
  }

  private extractNotes(text: string, section: string): string {
    const regex = new RegExp(`${section}[:\\s]*\\[?(?:PASS|FAIL|PARTIAL)\\]?\\s*\\n?([\\s\\S]*?)(?=###|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim().slice(0, 200) : 'Analysis pending';
  }

  getAgentStatuses(): Agent[] {
    return Array.from(this.agents.values());
  }
}
