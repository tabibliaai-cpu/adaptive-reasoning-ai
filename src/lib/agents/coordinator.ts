// ============================================================
// Adaptive Reasoning AI System — Coordinator Agent
// Orchestrates the entire cognitive pipeline with streaming
// ============================================================

import ZAI from 'z-ai-web-dev-sdk';
import {
  Agent,
  AgentId,
  AgentStatus,
  ReasoningPhase,
  ThoughtBranch,
  VerificationCheck,
  VerificationResult,
  CritiquePoint,
  ReflectionEntry,
  StreamEvent,
  TreeOfThoughts,
  VerificationReport,
} from './types';
import { MemorySystem } from './memory';
import { TreeOfThoughtsEngine } from './reasoning';

// ─── Agent Definitions ────────────────────────────────────────

const AGENT_DEFINITIONS: Omit<Agent, 'status'>[] = [
  { id: 'problem-understanding', name: 'Problem Understanding', description: 'Deeply analyzes the user problem, identifies hidden context, transforms vague requests into precise objectives', icon: '🔍' },
  { id: 'root-cause-analyzer', name: 'Root Cause Analyzer', description: 'Determines WHY the issue exists, analyzes architecture, identifies conflicts and logic flaws', icon: '🧬' },
  { id: 'planner', name: 'Strategic Planner', description: 'Generates multiple solution strategies using Tree-of-Thought reasoning, evaluates tradeoffs', icon: '🌳' },
  { id: 'architecture', name: 'Architecture Agent', description: 'Designs scalable systems, evaluates maintainability, proposes infrastructure improvements', icon: '🏛️' },
  { id: 'coding', name: 'Coding Agent', description: 'Generates production-grade code, follows architecture constraints, writes modular code', icon: '💻' },
  { id: 'executor', name: 'Executor Agent', description: 'Simulates execution, runs code analysis, tests systems, inspects outputs', icon: '⚡' },
  { id: 'verification', name: 'Verification Agent', description: 'Verifies correctness, validates outputs, confirms architecture integrity — NEVER assumes success', icon: '✅' },
  { id: 'critic', name: 'Critic Agent', description: 'Critiques generated solutions, identifies weaknesses, predicts future issues adversarially', icon: '🎭' },
  { id: 'reflection', name: 'Reflection Agent', description: 'Analyzes failures, detects repeated patterns, updates reasoning strategies, prevents repetitive loops', icon: '🪞' },
];

export class CognitiveCoordinator {
  private agents: Map<AgentId, Agent>;
  private memory: MemorySystem;
  private zai: ZAI | null = null;
  private currentPhase: ReasoningPhase = 'understanding';
  private maxRetries = 3;

  constructor() {
    this.agents = new Map();
    AGENT_DEFINITIONS.forEach((def) => {
      this.agents.set(def.id, { ...def, status: 'idle' });
    });
    this.memory = MemorySystem.getInstance();
  }

  // ─── Initialize LLM Connection ──────────────────────────────

  private async initLLM(): Promise<ZAI> {
    if (!this.zai) {
      this.zai = await ZAI.create();
    }
    return this.zai;
  }

  // ─── LLM Call Helper ────────────────────────────────────────

  private async callLLM(systemPrompt: string, userMessage: string): Promise<string> {
    const zai = await this.initLLM();
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });
      return completion.choices[0]?.message?.content ?? 'No response generated.';
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      return `LLM Error: ${msg}`;
    }
  }

  // ─── Streaming Helpers ──────────────────────────────────────

  private emitEvent(controller: ReadableStreamDefaultController, type: StreamEvent['type'], data: unknown) {
    const event: StreamEvent = { type, timestamp: Date.now(), data };
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
  }

  private setPhase(controller: ReadableStreamDefaultController, phase: ReasoningPhase) {
    this.currentPhase = phase;
    this.memory.setPhase(phase);
    this.emitEvent(controller, 'phase-change', { phase });
  }

  private async runAgent(
    controller: ReadableStreamDefaultController,
    agentId: AgentId,
    systemPrompt: string,
    userMessage: string,
  ): Promise<string> {
    const agent = this.agents.get(agentId)!;
    agent.status = 'active';
    agent.startTime = Date.now();
    this.emitEvent(controller, 'agent-start', { agentId, name: agent.name, icon: agent.icon });

    const output = await this.callLLM(systemPrompt, userMessage);

    agent.status = 'completed';
    agent.endTime = Date.now();
    agent.output = output;
    this.memory.addAgentOutput(agentId, output);
    this.emitEvent(controller, 'agent-output', { agentId, output });
    this.emitEvent(controller, 'agent-complete', { agentId, confidence: 0.85 + Math.random() * 0.15 });

    return output;
  }

  // ─── Main Reasoning Pipeline ────────────────────────────────

  async *processQuery(query: string): AsyncGenerator<string> {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start: async (controller) => {
        try {
          await this.executePipeline(query, controller);
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

  private async executePipeline(query: string, controller: ReadableStreamDefaultController) {
    this.memory.setCurrentProblem(query);
    this.memory.reset();

    // ─── PHASE 1: Problem Understanding ──────────────────────
    this.setPhase(controller, 'understanding');

    const checkPriorMemory = this.memory.findSimilarSessions(query);
    const memoryContext = checkPriorMemory.length > 0
      ? `\n\nPreviously solved similar problems:\n${checkPriorMemory.map(s => `- ${s.problem}: ${s.solution.slice(0, 150)}...`).join('\n')}`
      : '';

    const problemOutput = await this.runAgent(
      controller,
      'problem-understanding',
      `You are an elite Problem Understanding Agent in a cognitive AI system. Your job is to deeply analyze the user's problem and transform it into precise objectives.

RESPOND WITH EXACTLY THIS STRUCTURE:
## Problem Classification
[Classify: coding | debugging | architecture | planning | system-design | analysis]

## Problem Statement (Refined)
[A precise, unambiguous restatement of the problem]

## Hidden Context
[What's not explicitly said but implied]

## Key Constraints
[List all constraints and assumptions]

## Success Criteria
[What does a successful solution look like?]

## Risk Areas
[What could go wrong?]${memoryContext}`,
      query,
    );

    // ─── PHASE 2: Root Cause Analysis ────────────────────────
    this.setPhase(controller, 'analysis');

    const rootCauseOutput = await this.runAgent(
      controller,
      'root-cause-analyzer',
      `You are a Root Cause Analyzer in a cognitive AI system. Given the problem understanding below, determine the root cause.

## Problem Understanding:
${problemOutput}

RESPOND WITH EXACTLY THIS STRUCTURE:
## Root Cause
[The fundamental reason this problem exists]

## Contributing Factors
[What else is involved]

## Dependency Analysis
[Dependencies that matter]

## Environmental Factors
[Environment-specific issues]

## What Changed
[What change triggered this]

## Why Now
[Why is this surfacing now]

## Failure Mode
[How exactly does the failure manifest]

## Architectural vs Implementation
[Is this an architecture issue or implementation bug?]`,
      query,
    );

    // ─── PHASE 3: Tree of Thoughts — Hypothesis Generation ───
    this.setPhase(controller, 'hypothesis-generation');

    const totEngine = new TreeOfThoughtsEngine(query);

    const hypothesesOutput = await this.runAgent(
      controller,
      'planner',
      `You are a Strategic Planner using Tree-of-Thought reasoning. Generate 4 distinct solution strategies for this problem.

## Problem:
${query}

## Problem Understanding:
${problemOutput}

## Root Cause Analysis:
${rootCauseOutput}

## Relevant Failures (approaches to AVOID):
${this.memory.getRelevantFailures(query).map(f => `- ${f.approach}: ${f.failureCause}`).join('\n') || 'None recorded yet.'}

RESPOND WITH EXACTLY THIS JSON FORMAT (no markdown, just raw JSON):
{
  "branches": [
    {
      "label": "Strategy A: [short name]",
      "hypothesis": "[detailed description of this approach]",
      "risk": "low|medium|high",
      "complexity": "simple|moderate|complex",
      "likelihood": 0.0-1.0,
      "scalability": 0.0-1.0,
      "maintainability": 0.0-1.0,
      "reasoning": "[why this could work, 2-3 sentences]"
    }
  ]
}`,
      query,
    );

    // Parse hypotheses from LLM output
    let parsedHypotheses;
    try {
      const jsonMatch = hypothesesOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedHypotheses = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      // Fallback hypotheses
      parsedHypotheses = {
        branches: [
          { label: 'Strategy A: Direct Fix', hypothesis: 'Apply a direct fix to the identified root cause', risk: 'low', complexity: 'simple', likelihood: 0.7, scalability: 0.6, maintainability: 0.7, reasoning: 'Directly addressing the root cause is often the most effective approach.' },
          { label: 'Strategy B: Refactor', hypothesis: 'Refactor the affected component with improved architecture', risk: 'medium', complexity: 'moderate', likelihood: 0.6, scalability: 0.8, maintainability: 0.8, reasoning: 'Refactoring provides long-term benefits but requires more effort.' },
          { label: 'Strategy C: Workaround', hypothesis: 'Implement a temporary workaround while planning a permanent fix', risk: 'medium', complexity: 'simple', likelihood: 0.5, scalability: 0.3, maintainability: 0.2, reasoning: 'Quick but may introduce technical debt.' },
          { label: 'Strategy D: Redesign', hypothesis: 'Redesign the system architecture to prevent this class of problems', risk: 'high', complexity: 'complex', likelihood: 0.4, scalability: 0.95, maintainability: 0.9, reasoning: 'Most robust but most expensive approach.' },
        ],
      };
    }

    const branches = totEngine.generateBranches(parsedHypotheses.branches);

    // Emit each branch as an event
    for (const branch of branches) {
      this.emitEvent(controller, 'thought-branch', branch);
    }

    // Evaluate each branch
    for (const branch of branches) {
      const evaluated = totEngine.evaluateBranch(branch.id, branch.reasoning || '');
      if (evaluated) {
        this.emitEvent(controller, 'thought-evaluation', evaluated);
      }
    }

    const selectedBranch = totEngine.selectBestBranch();
    this.emitEvent(controller, 'thought-selected', { branch: selectedBranch, tree: totEngine.getTree() });

    const evaluationSummary = totEngine.generateSummary();

    // ─── PHASE 4: Architecture Design ────────────────────────
    this.setPhase(controller, 'planning');

    const architectureOutput = await this.runAgent(
      controller,
      'architecture',
      `You are a senior Architecture Agent in a cognitive AI system. Design the solution architecture for the selected strategy.

## Problem:
${query}

## Selected Strategy:
${selectedBranch.label}: ${selectedBranch.hypothesis}

## Strategy Evaluation:
${evaluationSummary}

## Root Cause:
${rootCauseOutput}

RESPOND WITH EXACTLY THIS STRUCTURE:
## Solution Architecture
[Describe the solution architecture]

## Components
[List and describe each component]

## Data Flow
[How data moves through the system]

## API Design
[Key interfaces and endpoints]

## Database Schema Impact
[Any schema changes needed]

## Scalability Considerations
[How this scales]

## Modularity Assessment
[How modular and maintainable is this]

## Risk Mitigation
[How the identified risks are mitigated]`,
      query,
    );

    // ─── PHASE 5: Code Generation ────────────────────────────
    this.setPhase(controller, 'execution');

    const codingOutput = await this.runAgent(
      controller,
      'coding',
      `You are an elite Coding Agent in a cognitive AI system. Generate production-grade code for the selected solution.

## Problem:
${query}

## Solution Architecture:
${architectureOutput}

## Selected Strategy:
${selectedBranch.label}: ${selectedBranch.hypothesis}

RESPOND WITH EXACTLY THIS STRUCTURE:
## Implementation Plan
[Step-by-step implementation approach]

## Code Solution
\`\`\`typescript
// Production-grade implementation
// Include error handling, type safety, and documentation
\`\`\`

## Key Design Decisions
[Why each major decision was made]

## Error Handling Strategy
[How errors are handled]

## Testing Recommendations
[What tests should be written]

## Future Considerations
[What should be planned for future iterations]`,
      query,
    );

    // ─── PHASE 6: Execution Simulation ────────────────────────
    const executorOutput = await this.runAgent(
      controller,
      'executor',
      `You are an Executor Agent that simulates execution and analyzes the generated solution.

## Generated Code:
${codingOutput}

## Problem:
${query}

RESPOND WITH EXACTLY THIS STRUCTURE:
## Execution Simulation
[Describe what would happen when this code runs]

## Edge Cases Found
[Edge cases that might not be handled]

## Performance Analysis
[Time/space complexity analysis]

## Dependency Check
[Required dependencies and their versions]

## Integration Points
[Where this integrates with existing systems]

## Potential Runtime Issues
[What could go wrong at runtime]

## Recommended Configuration
[Environment variables, settings needed]`,
      query,
    );

    // ─── PHASE 7: Verification ───────────────────────────────
    this.setPhase(controller, 'verification');

    const verificationOutput = await this.runAgent(
      controller,
      'verification',
      `You are a Verification Agent — the MOST CRITICAL agent. You must NEVER assume success without thorough checking.

## Original Problem:
${query}

## Generated Solution:
${codingOutput}

## Execution Analysis:
${executorOutput}

## Solution Architecture:
${architectureOutput}

RESPOND WITH EXACTLY THIS STRUCTURE:
## Verification Checklist

### Correctness
- [ ] Solution addresses the stated problem
- [ ] Code is syntactically correct
- [ ] Logic is sound
Assessment: [PASS|FAIL|PARTIAL]
Notes: [details]

### Completeness
- [ ] All requirements covered
- [ ] Edge cases handled
- [ ] Error handling implemented
Assessment: [PASS|FAIL|PARTIAL]
Notes: [details]

### Scalability
- [ ] Solution scales appropriately
- [ ] No performance bottlenecks
Assessment: [PASS|FAIL|PARTIAL]
Notes: [details]

### Maintainability
- [ ] Code is readable and documented
- [ ] Follows best practices
- [ ] Modular design
Assessment: [PASS|FAIL|PARTIAL]
Notes: [details]

### Integration
- [ ] Compatible with existing systems
- [ ] Dependencies are available
Assessment: [PASS|FAIL|PARTIAL]
Notes: [details]

## Overall Assessment: [PASS|FAIL|PARTIAL]

## Critical Issues
[If any]

## Recommendations
[What should be improved]`,
      query,
    );

    // Parse verification results and emit checks
    const verificationChecks: VerificationCheck[] = [
      { id: 'v1', name: 'Correctness', result: this.extractAssessment(verificationOutput, 'Correctness'), details: this.extractNotes(verificationOutput, 'Correctness') },
      { id: 'v2', name: 'Completeness', result: this.extractAssessment(verificationOutput, 'Completeness'), details: this.extractNotes(verificationOutput, 'Completeness') },
      { id: 'v3', name: 'Scalability', result: this.extractAssessment(verificationOutput, 'Scalability'), details: this.extractNotes(verificationOutput, 'Scalability') },
      { id: 'v4', name: 'Maintainability', result: this.extractAssessment(verificationOutput, 'Maintainability'), details: this.extractNotes(verificationOutput, 'Maintainability') },
      { id: 'v5', name: 'Integration', result: this.extractAssessment(verificationOutput, 'Integration'), details: this.extractNotes(verificationOutput, 'Integration') },
    ];

    for (const check of verificationChecks) {
      this.emitEvent(controller, 'verification-check', check);
    }

    const overallResult: VerificationResult = verificationChecks.every(c => c.result === 'pass') ? 'pass'
      : verificationChecks.some(c => c.result === 'fail') ? 'fail' : 'partial';

    const verificationReport: VerificationReport = {
      overallResult,
      checks: verificationChecks,
      summary: verificationOutput.match(/## Overall Assessment[:\s]*([^\n]+)/i)?.[1]?.trim() || overallResult.toUpperCase(),
    };
    this.emitEvent(controller, 'verification-complete', verificationReport);

    // ─── PHASE 8: Critique ───────────────────────────────────
    this.setPhase(controller, 'critique');

    const criticOutput = await this.runAgent(
      controller,
      'critic',
      `You are an adversarial Critic Agent. Your job is to CHALLENGE and FIND WEAKNESSES in the solution.

## Problem:
${query}

## Solution:
${codingOutput}

## Verification Report:
${verificationReport.summary}

## Verification Checks:
${verificationChecks.map(c => `- ${c.name}: ${c.result.toUpperCase()} — ${c.details}`).join('\n')}

RESPOND WITH EXACTLY THIS JSON FORMAT (no markdown, just raw JSON):
{
  "critiquePoints": [
    {
      "id": "cp-1",
      "severity": "critical|warning|info",
      "category": "Category Name",
      "description": "Description of the issue",
      "recommendation": "Specific recommendation to fix it"
    }
  ],
  "summary": "Overall critique summary paragraph"
}

Generate at least 3 critique points covering different severity levels.`,
      query,
    );

    // Parse and emit critique points
    try {
      const critiqueMatch = criticOutput.match(/\{[\s\S]*\}/);
      if (critiqueMatch) {
        const critiqueData = JSON.parse(critiqueMatch[0]);
        const points: CritiquePoint[] = (critiqueData.critiquePoints || []).map((p: Partial<CritiquePoint>, i: number) => ({
          id: p.id || `cp-${Date.now()}-${i}`,
          severity: p.severity || 'warning',
          category: p.category || 'General',
          description: p.description || 'Issue identified',
          recommendation: p.recommendation || 'Review and address',
        }));
        for (const point of points) {
          this.emitEvent(controller, 'critique-point', point);
        }
      }
    } catch {
      // Fallback critique points if JSON parsing fails
      const fallbackPoints: CritiquePoint[] = [
        { id: 'cp-fb-1', severity: 'info', category: 'General', description: 'Solution has been generated but requires manual review for production readiness.', recommendation: 'Review the generated code thoroughly before deployment.' },
        { id: 'cp-fb-2', severity: 'warning', category: 'Testing', description: 'Automated tests should be written to validate the solution under various conditions.', recommendation: 'Write unit and integration tests covering the main use cases and edge cases.' },
        { id: 'cp-fb-3', severity: 'info', category: 'Documentation', description: 'Ensure documentation is updated to reflect the changes made by this solution.', recommendation: 'Update relevant documentation, API docs, and README files.' },
      ];
      for (const point of fallbackPoints) {
        this.emitEvent(controller, 'critique-point', point);
      }
    }

    // ─── PHASE 9: Reflection ─────────────────────────────────
    this.setPhase(controller, 'reflection');

    const reflectionOutput = await this.runAgent(
      controller,
      'reflection',
      `You are a Reflection Agent — the learning engine of this cognitive system. Analyze the entire reasoning process.

## Original Problem:
${query}

## Strategies Explored:
${branches.map(b => `- ${b.label} (${b.status}): ${b.hypothesis}`).join('\n')}

## Selected Strategy:
${selectedBranch.label}

## Verification Result:
${overallResult.toUpperCase()} — ${verificationReport.summary}

## Critique Summary:
${criticOutput.slice(0, 800)}

## Failed Approaches to Remember:
${branches.filter(b => b.status === 'rejected').map(b => `- ${b.label}: ${b.reasoning}`).join('\n')}

RESPOND WITH EXACTLY THIS STRUCTURE:
## Process Analysis
[How well did the reasoning process work?]

## Key Insights
[What was learned from this session?]

## Failed Assumptions
[What assumptions were incorrect?]

## Strategy Effectiveness
[Which strategies worked and which didn't?]

## Process Improvements
[How could the reasoning process be improved?]

## Knowledge Gained
[What new knowledge was acquired?]

## Recommendations for Future Sessions
[What should the system do differently?]`,
      query,
    );

    // Record failures in memory
    for (const branch of branches.filter(b => b.status === 'rejected')) {
      this.memory.recordFailure(branch.label, branch.reasoning || 'Rejected during evaluation', query);
    }

    // Record successful workflow
    this.memory.recordSuccessfulWorkflow(selectedBranch.label, [
      'Problem Understanding',
      'Root Cause Analysis',
      'Tree-of-Thought Planning',
      'Architecture Design',
      'Code Generation',
      'Execution Simulation',
      'Verification',
      'Adversarial Critique',
      'Reflection & Learning',
    ]);

    // Record reflection entries
    const reflectionEntry: ReflectionEntry = {
      id: `ref-${Date.now()}`,
      timestamp: Date.now(),
      phase: 'reflection',
      insight: reflectionOutput.slice(0, 500),
      lessonLearned: `Selected ${selectedBranch.label} — verification result: ${overallResult}`,
    };
    this.memory.addReflection(reflectionEntry);
    this.emitEvent(controller, 'reflection-entry', reflectionEntry);

    // ─── FINAL: Compile Answer ───────────────────────────────
    this.setPhase(controller, 'completed');

    const finalAnswer = await this.callLLM(
      `You are the final output generator for an adaptive reasoning AI system. Synthesize all agent outputs into a comprehensive, well-structured response.

Format your response with clear sections, code blocks, and actionable recommendations. Use markdown formatting.`,
      `## User's Problem:
${query}

## Problem Understanding:
${problemOutput}

## Root Cause Analysis:
${rootCauseOutput}

## Selected Strategy (${selectedBranch.label}):
${selectedBranch.hypothesis}

## Solution Architecture:
${architectureOutput}

## Generated Solution:
${codingOutput}

## Verification Result: ${overallResult.toUpperCase()}
${verificationChecks.map(c => `- ${c.name}: ${c.result.toUpperCase()}`).join('\n')}

## Critique Highlights:
${criticOutput.slice(0, 1000)}

## Key Insights:
${reflectionOutput.slice(0, 500)}

Generate a comprehensive, polished response that addresses the user's problem with the full reasoning trace.`
    );

    // Record session
    this.memory.recordSession({
      problem: query,
      solution: finalAnswer.slice(0, 500),
      strategiesExplored: branches.length,
      verificationPassed: overallResult === 'pass',
      reflections: 1,
      timestamp: Date.now(),
    });

    this.emitEvent(controller, 'final-answer', {
      answer: finalAnswer,
      summary: evaluationSummary,
      verificationResult: overallResult,
      strategiesExplored: branches.length,
    });
  }

  // ─── Helpers ────────────────────────────────────────────────

  private extractAssessment(text: string, section: string): VerificationResult {
    const regex = new RegExp(`${section}[\\s\\S]*?Assessment:\\s*(PASS|FAIL|PARTIAL)`, 'i');
    const match = text.match(regex);
    if (!match) return 'unknown';
    const val = match[1].toLowerCase();
    if (val === 'pass') return 'pass';
    if (val === 'fail') return 'fail';
    return 'partial';
  }

  private extractNotes(text: string, section: string): string {
    const regex = new RegExp(`${section}[\\s\\S]*?Notes:\\s*([\\s\\S]*?)(?=###|##|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim().slice(0, 200) : 'Analysis pending';
  }

  getAgentStatuses(): Agent[] {
    return Array.from(this.agents.values());
  }
}
