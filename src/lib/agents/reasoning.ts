// ============================================================
// Adaptive Reasoning AI System — Tree of Thoughts Engine
// Generates, evaluates, and selects reasoning strategies
// ============================================================

import { ThoughtBranch, TreeOfThoughts, StrategyRisk, StrategyComplexity } from './types';

export class TreeOfThoughtsEngine {
  private tree: TreeOfThoughts;

  constructor(problem: string) {
    this.tree = {
      problem,
      branches: [],
    };
  }

  // ─── Generate Multiple Hypothesis Branches ──────────────────

  generateBranches(hypotheses: Array<{
    label: string;
    hypothesis: string;
    risk?: StrategyRisk;
    complexity?: StrategyComplexity;
    likelihood?: number;
    scalability?: number;
    maintainability?: number;
  }>): ThoughtBranch[] {
    const branches = hypotheses.map((h, i) => ({
      id: `branch-${i}-${Date.now()}`,
      label: h.label,
      hypothesis: h.hypothesis,
      risk: h.risk ?? 'medium',
      complexity: h.complexity ?? 'moderate',
      likelihood: h.likelihood ?? 0.5,
      scalability: h.scalability ?? 0.5,
      maintainability: h.maintainability ?? 0.5,
      status: 'exploring' as const,
      reasoning: '',
    }));

    this.tree.branches = branches;
    return branches;
  }

  // ─── Evaluate a Single Branch ───────────────────────────────

  evaluateBranch(
    branchId: string,
    reasoning: string,
    adjustments?: Partial<Pick<ThoughtBranch, 'likelihood' | 'scalability' | 'maintainability'>>
  ): ThoughtBranch | null {
    const branch = this.tree.branches.find((b) => b.id === branchId);
    if (!branch) return null;

    branch.reasoning = reasoning;
    branch.status = 'evaluated';

    if (adjustments) {
      if (adjustments.likelihood !== undefined) branch.likelihood = adjustments.likelihood;
      if (adjustments.scalability !== undefined) branch.scalability = adjustments.scalability;
      if (adjustments.maintainability !== undefined) branch.maintainability = adjustments.maintainability;
    }

    // Composite score: weighted average
    const riskPenalty = branch.risk === 'high' ? 0.15 : branch.risk === 'medium' ? 0.05 : 0;
    const complexityPenalty = branch.complexity === 'complex' ? 0.1 : branch.complexity === 'moderate' ? 0.03 : 0;

    branch.score =
      (branch.likelihood * 0.35 +
        branch.scalability * 0.25 +
        branch.maintainability * 0.25 +
        (1 - riskPenalty - complexityPenalty) * 0.15);

    return branch;
  }

  // ─── Select Best Branch ─────────────────────────────────────

  selectBestBranch(): ThoughtBranch {
    const evaluated = this.tree.branches.filter((b) => b.status === 'evaluated' && b.score !== undefined);
    if (evaluated.length === 0) {
      // Fallback: select the first branch
      this.tree.branches[0].status = 'selected';
      this.tree.selectedBranch = this.tree.branches[0].id;
      return this.tree.branches[0];
    }

    const best = evaluated.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    best.status = 'selected';
    this.tree.selectedBranch = best.id;

    // Mark others as rejected
    this.tree.branches.forEach((b) => {
      if (b.id !== best.id && b.status === 'evaluated') {
        b.status = 'rejected';
      }
    });

    return best;
  }

  // ─── Generate Evaluation Summary ────────────────────────────

  generateSummary(): string {
    const branches = this.tree.branches;
    const selected = branches.find((b) => b.id === this.tree.selectedBranch);
    const rejected = branches.filter((b) => b.status === 'rejected');

    let summary = `Evaluated ${branches.length} strategies.\n\n`;
    if (selected) {
      summary += `Selected Strategy: "${selected.label}" (Score: ${(selected.score ?? 0).toFixed(2)})\n`;
      summary += `Rationale: ${selected.reasoning}\n\n`;
    }

    if (rejected.length > 0) {
      summary += `Rejected alternatives:\n`;
      rejected.forEach((r) => {
        summary += `  - "${r.label}" (Score: ${(r.score ?? 0).toFixed(2)}): ${r.reasoning?.slice(0, 100)}...\n`;
      });
    }

    this.tree.evaluationSummary = summary;
    return summary;
  }

  // ─── Accessors ──────────────────────────────────────────────

  getTree(): TreeOfThoughts {
    return JSON.parse(JSON.stringify(this.tree));
  }

  getBranch(branchId: string): ThoughtBranch | undefined {
    return this.tree.branches.find((b) => b.id === branchId);
  }

  getAllBranches(): ThoughtBranch[] {
    return [...this.tree.branches];
  }
}
