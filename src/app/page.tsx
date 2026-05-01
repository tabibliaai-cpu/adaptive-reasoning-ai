// ============================================================
// Adaptive Reasoning AI — Main Page
// Full cognitive system interface with agent visualization
// ============================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Bot,
  Send,
  Brain,
  Search,
  GitBranch,
  Building2,
  Code2,
  Zap,
  ShieldCheck,
  AlertTriangle,
  ScanEye,
  BarChart3,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Activity,
  Lightbulb,
  TreePine,
  Eye,
  RotateCcw,
  Sparkles,
  Terminal,
  MessageSquare,
  PanelRightOpen,
  PanelRightClose,
  Cpu,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

// ─── Types ────────────────────────────────────────────────────

interface StreamEvent {
  type: string;
  timestamp: number;
  data: unknown;
}

interface AgentState {
  id: string;
  name: string;
  icon: string;
  status: 'idle' | 'active' | 'completed' | 'failed' | 'waiting';
  output?: string;
  startTime?: number;
  endTime?: number;
  confidence?: number;
}

interface ThoughtBranch {
  id: string;
  label: string;
  hypothesis: string;
  risk: string;
  complexity: string;
  likelihood: number;
  scalability: number;
  maintainability: number;
  status: string;
  reasoning?: string;
  score?: number;
}

interface VerificationCheck {
  id: string;
  name: string;
  result: string;
  details: string;
}

interface CritiquePoint {
  id: string;
  severity: string;
  category: string;
  description: string;
  recommendation: string;
}

interface ReflectionEntry {
  id: string;
  timestamp: number;
  phase: string;
  insight: string;
  lessonLearned?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ─── Agent Config ─────────────────────────────────────────────

const AGENT_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  'problem-understanding': { icon: <Search className="w-4 h-4" />, color: 'text-blue-400' },
  'root-cause-analyzer': { icon: <GitBranch className="w-4 h-4" />, color: 'text-purple-400' },
  planner: { icon: <TreePine className="w-4 h-4" />, color: 'text-emerald-400' },
  architecture: { icon: <Building2 className="w-4 h-4" />, color: 'text-amber-400' },
  coding: { icon: <Code2 className="w-4 h-4" />, color: 'text-cyan-400' },
  executor: { icon: <Zap className="w-4 h-4" />, color: 'text-yellow-400' },
  verification: { icon: <ShieldCheck className="w-4 h-4" />, color: 'text-green-400' },
  critic: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-400' },
  reflection: { icon: <ScanEye className="w-4 h-4" />, color: 'text-pink-400' },
};

const PHASE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  understanding: { label: 'Understanding Problem', icon: <Search className="w-4 h-4" /> },
  analysis: { label: 'Analyzing Root Causes', icon: <GitBranch className="w-4 h-4" /> },
  'hypothesis-generation': { label: 'Generating Hypotheses', icon: <Brain className="w-4 h-4" /> },
  planning: { label: 'Planning Architecture', icon: <Building2 className="w-4 h-4" /> },
  execution: { label: 'Executing Solution', icon: <Zap className="w-4 h-4" /> },
  verification: { label: 'Verifying Results', icon: <ShieldCheck className="w-4 h-4" /> },
  critique: { label: 'Running Critique', icon: <AlertTriangle className="w-4 h-4" /> },
  reflection: { label: 'Reflecting & Learning', icon: <ScanEye className="w-4 h-4" /> },
  completed: { label: 'Completed', icon: <CheckCircle2 className="w-4 h-4" /> },
};

const PHASE_ORDER = ['understanding', 'analysis', 'hypothesis-generation', 'planning', 'execution', 'verification', 'critique', 'reflection', 'completed'];

// ─── Main Component ───────────────────────────────────────────

export default function Home() {
  // State
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Map<string, AgentState>>(new Map());
  const [currentPhase, setCurrentPhase] = useState<string>('understanding');
  const [thoughtBranches, setThoughtBranches] = useState<ThoughtBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [verificationChecks, setVerificationChecks] = useState<VerificationCheck[]>([]);
  const [verificationResult, setVerificationResult] = useState<string>('unknown');
  const [critiquePoints, setCritiquePoints] = useState<CritiquePoint[]>([]);
  const [reflections, setReflections] = useState<ReflectionEntry[]>([]);
  const [finalAnswer, setFinalAnswer] = useState<string>('');
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'tree' | 'verification' | 'reflection'>('tree');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, finalAnswer]);

  // ─── Process SSE Events ────────────────────────────────────

  const processEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'phase-change': {
        const { phase } = event.data as { phase: string };
        setCurrentPhase(phase);
        break;
      }

      case 'agent-start': {
        const { agentId, name, icon } = event.data as { agentId: string; name: string; icon: string };
        setAgents((prev) => {
          const next = new Map(prev);
          next.set(agentId, { id: agentId, name, icon, status: 'active', startTime: Date.now() });
          return next;
        });
        break;
      }

      case 'agent-output': {
        const { agentId, output } = event.data as { agentId: string; output: string };
        setAgents((prev) => {
          const next = new Map(prev);
          const existing = next.get(agentId);
          if (existing) {
            next.set(agentId, { ...existing, output });
          }
          return next;
        });
        break;
      }

      case 'agent-complete': {
        const { agentId, confidence } = event.data as { agentId: string; confidence: number };
        setAgents((prev) => {
          const next = new Map(prev);
          const existing = next.get(agentId);
          if (existing) {
            next.set(agentId, { ...existing, status: 'completed', endTime: Date.now(), confidence });
          }
          return next;
        });
        break;
      }

      case 'thought-branch': {
        const branch = event.data as ThoughtBranch;
        setThoughtBranches((prev) => [...prev, branch]);
        break;
      }

      case 'thought-evaluation': {
        const branch = event.data as ThoughtBranch;
        setThoughtBranches((prev) => prev.map((b) => (b.id === branch.id ? branch : b)));
        break;
      }

      case 'thought-selected': {
        const { branch } = event.data as { branch: ThoughtBranch };
        setSelectedBranchId(branch.id);
        setThoughtBranches((prev) =>
          prev.map((b) => {
            if (b.id === branch.id) return { ...b, status: 'selected' };
            if (b.status === 'evaluated') return { ...b, status: 'rejected' };
            return b;
          })
        );
        break;
      }

      case 'verification-check': {
        const check = event.data as VerificationCheck;
        setVerificationChecks((prev) => [...prev, check]);
        break;
      }

      case 'verification-complete': {
        const { overallResult, checks, summary } = event.data as { overallResult: string; checks: VerificationCheck[]; summary: string };
        setVerificationResult(overallResult);
        setVerificationChecks(checks);
        break;
      }

      case 'critique-point': {
        const point = event.data as CritiquePoint;
        setCritiquePoints((prev) => [...prev, point]);
        break;
      }

      case 'reflection-entry': {
        const entry = event.data as ReflectionEntry;
        setReflections((prev) => [...prev, entry]);
        break;
      }

      case 'final-answer': {
        const { answer } = event.data as { answer: string };
        setFinalAnswer(answer);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: answer, timestamp: Date.now() },
        ]);
        setIsProcessing(false);
        break;
      }

      case 'error': {
        const { message } = event.data as { message: string };
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${message}`, timestamp: Date.now() },
        ]);
        setIsProcessing(false);
        break;
      }
    }
  }, []);

  // ─── Submit Query ──────────────────────────────────────────

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;

    const query = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: query, timestamp: Date.now() }]);
    setIsProcessing(true);

    // Reset state
    setAgents(new Map());
    setCurrentPhase('understanding');
    setThoughtBranches([]);
    setSelectedBranchId(null);
    setVerificationChecks([]);
    setVerificationResult('unknown');
    setCritiquePoints([]);
    setReflections([]);
    setFinalAnswer('');

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) throw new Error('Failed to start reasoning pipeline');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6));
              processEvent(event);
            } catch {
              // Skip malformed events
            }
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Connection error: ${error.message}`, timestamp: Date.now() },
        ]);
        setIsProcessing(false);
      }
    }
  };

  // ─── Get active agent count ────────────────────────────────

  const completedAgents = Array.from(agents.values()).filter((a) => a.status === 'completed').length;
  const totalAgents = 9;
  const phaseIndex = PHASE_ORDER.indexOf(currentPhase);
  const progressPercent = Math.round(((phaseIndex + completedAgents / totalAgents) / PHASE_ORDER.length) * 100);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
        {/* ─── Header ─────────────────────────────────────── */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Brain className="w-7 h-7 text-emerald-500" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Adaptive Reasoning AI</h1>
              <p className="text-xs text-muted-foreground">Multi-Agent Cognitive Architecture</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isProcessing && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-muted-foreground font-mono">
                  {PHASE_LABELS[currentPhase]?.label || 'Initializing...'}
                </span>
              </div>
            )}
            <Badge variant={isProcessing ? 'default' : 'secondary'} className="text-xs">
              <Cpu className="w-3 h-3 mr-1" />
              {completedAgents}/{totalAgents} Agents
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRightPanelOpen(!rightPanelOpen)}
                >
                  {rightPanelOpen ? (
                    <PanelRightClose className="w-4 h-4" />
                  ) : (
                    <PanelRightOpen className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {rightPanelOpen ? 'Hide Analysis Panel' : 'Show Analysis Panel'}
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ─── Main Content ────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            {/* Left: Chat & Pipeline */}
            <ResizablePanel defaultSize={rightPanelOpen ? 60 : 100} minSize={40}>
              <div className="flex flex-col h-full">
                {/* Phase Progress Bar */}
                {isProcessing && (
                  <div className="px-4 py-2 border-b border-border bg-card/30 shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">Reasoning Pipeline</span>
                      <span className="text-xs font-mono text-muted-foreground">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5" />
                    <div className="flex items-center justify-between mt-1.5 gap-1">
                      {PHASE_ORDER.slice(0, -1).map((phase, i) => (
                        <div key={phase} className="flex items-center gap-1 flex-1 justify-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 ${
                                  i < phaseIndex
                                    ? 'bg-emerald-500/20 text-emerald-500'
                                    : i === phaseIndex
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                    : 'bg-muted text-muted-foreground/50'
                                }`}
                              >
                                {i < phaseIndex ? (
                                  <CheckCircle2 className="w-3 h-3" />
                                ) : i === phaseIndex ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <div className="w-1.5 h-1.5 rounded-full" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              {PHASE_LABELS[phase]?.label}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages Area */}
                <ScrollArea className="flex-1 p-4">
                  <div className="max-w-3xl mx-auto space-y-4">
                    {messages.length === 0 && !isProcessing && (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="relative mb-6">
                          <Brain className="w-16 h-16 text-muted-foreground/30" />
                          <Sparkles className="w-6 h-6 text-emerald-500 absolute -top-2 -right-2" />
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Adaptive Cognitive System</h2>
                        <p className="text-muted-foreground max-w-md mb-8">
                          A multi-agent reasoning engine that understands deeply, plans strategically,
                          verifies thoroughly, and learns from every interaction.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                          {[
                            { icon: <Code2 className="w-4 h-4" />, text: 'Debug a failing build', query: 'Debug why my React app has memory leaks when navigating between pages' },
                            { icon: <Building2 className="w-4 h-4" />, text: 'Design architecture', query: 'Design a scalable microservices architecture for an e-commerce platform' },
                            { icon: <GitBranch className="w-4 h-4" />, text: 'Analyze root cause', query: 'Why is my GraphQL API returning null for deeply nested queries?' },
                            { icon: <Terminal className="w-4 h-4" />, text: 'Plan strategy', query: 'Plan the migration from monolith to serverless architecture step by step' },
                          ].map((suggestion) => (
                            <button
                              key={suggestion.text}
                              onClick={() => setInput(suggestion.query)}
                              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent hover:border-accent-foreground/20 transition-colors text-left group"
                            >
                              <div className="mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors">
                                {suggestion.icon}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{suggestion.text}</p>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{suggestion.query}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Messages */}
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-1">
                            <Bot className="w-4 h-4 text-emerald-500" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card border border-border'
                          }`}
                        >
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-3 prose-pre:bg-muted prose-pre:border prose-pre:border-border">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                            <MessageSquare className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Processing Indicator with Agent Pipeline */}
                    {isProcessing && (
                      <div className="space-y-4">
                        {/* Active Agent Display */}
                        <Card className="border-emerald-500/20 bg-emerald-500/5">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                              <span className="text-sm font-medium text-emerald-500">
                                {PHASE_LABELS[currentPhase]?.label || 'Processing...'}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {Array.from(agents.values()).map((agent) => {
                                const config = AGENT_CONFIG[agent.id];
                                return (
                                  <div
                                    key={agent.id}
                                    className={`flex items-center gap-2 text-xs py-1 px-2 rounded transition-all duration-300 ${
                                      agent.status === 'active'
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : agent.status === 'completed'
                                        ? 'text-emerald-500/60'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {agent.status === 'active' ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : agent.status === 'completed' ? (
                                      <CheckCircle2 className="w-3 h-3" />
                                    ) : (
                                      <div className="w-3 h-3 rounded-full border border-current" />
                                    )}
                                    <span>{agent.icon}</span>
                                    <span className="font-medium">{agent.name}</span>
                                    {agent.status === 'active' && (
                                      <span className="ml-auto">Processing...</span>
                                    )}
                                    {agent.status === 'completed' && (
                                      <span className="ml-auto font-mono">
                                        {((agent.endTime! - agent.startTime!) / 1000).toFixed(1)}s
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Final Answer Streaming */}
                        {finalAnswer && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-500" />
                                Final Answer
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:my-3 prose-pre:bg-muted prose-pre:border prose-pre:border-border">
                                <ReactMarkdown>{finalAnswer}</ReactMarkdown>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 border-t border-border bg-card/50 shrink-0">
                  <div className="max-w-3xl mx-auto">
                    <div className="flex gap-2">
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                        placeholder="Describe your problem, ask for architecture advice, or request debugging help..."
                        disabled={isProcessing}
                        className="flex-1 bg-background"
                      />
                      <Button
                        onClick={handleSubmit}
                        disabled={isProcessing || !input.trim()}
                        size="icon"
                        className="shrink-0"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Brain className="w-3 h-3" />
                        9-Agent Pipeline
                      </span>
                      <span className="flex items-center gap-1">
                        <TreePine className="w-3 h-3" />
                        Tree-of-Thoughts
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Verification-First
                      </span>
                      <span className="flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" />
                        Adaptive Learning
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </ResizablePanel>

            {/* Right: Analysis Panel */}
            {rightPanelOpen && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={40} minSize={25}>
                  <div className="h-full flex flex-col border-l border-border bg-card/30">
                    <div className="flex items-center gap-1 p-2 border-b border-border shrink-0">
                      {[
                        { id: 'tree' as const, label: 'Strategies', icon: <TreePine className="w-3.5 h-3.5" /> },
                        { id: 'verification' as const, label: 'Verify', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
                        { id: 'reflection' as const, label: 'Reflect', icon: <ScanEye className="w-3.5 h-3.5" /> },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setRightTab(tab.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            rightTab === tab.id
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          }`}
                        >
                          {tab.icon}
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <ScrollArea className="flex-1">
                      <div className="p-3 space-y-3">
                        {/* ─── Tree of Thoughts Tab ──────────── */}
                        {rightTab === 'tree' && (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <TreePine className="w-4 h-4 text-emerald-500" />
                              <h3 className="text-sm font-semibold">Tree-of-Thoughts</h3>
                            </div>

                            {thoughtBranches.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">Strategies will appear here once the Planner agent begins exploring solutions.</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {thoughtBranches.map((branch, i) => (
                                  <Card
                                    key={branch.id}
                                    className={`transition-all duration-500 ${
                                      branch.status === 'selected'
                                        ? 'border-emerald-500/50 bg-emerald-500/5 shadow-lg shadow-emerald-500/5'
                                        : branch.status === 'rejected'
                                        ? 'border-red-500/20 opacity-50'
                                        : branch.status === 'evaluating'
                                        ? 'border-amber-500/30 bg-amber-500/5'
                                        : 'border-border'
                                    }`}
                                  >
                                    <CardContent className="p-3">
                                      <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                          {branch.status === 'selected' ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                          ) : branch.status === 'rejected' ? (
                                            <XCircle className="w-4 h-4 text-red-400" />
                                          ) : branch.status === 'evaluating' ? (
                                            <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                                          ) : (
                                            <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                          )}
                                          <span className="text-xs font-semibold">{branch.label}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Badge
                                            variant={
                                              branch.risk === 'low'
                                                ? 'secondary'
                                                : branch.risk === 'medium'
                                                ? 'outline'
                                                : 'destructive'
                                            }
                                            className="text-[10px] px-1.5 py-0"
                                          >
                                            {branch.risk}
                                          </Badge>
                                          {branch.score !== undefined && (
                                            <span className="text-[10px] font-mono text-muted-foreground">
                                              {branch.score.toFixed(2)}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                        {branch.hypothesis}
                                      </p>

                                      {/* Score Bars */}
                                      <div className="grid grid-cols-3 gap-2">
                                        {[
                                          { label: 'Likelihood', value: branch.likelihood },
                                          { label: 'Scalability', value: branch.scalability },
                                          { label: 'Maintain.', value: branch.maintainability },
                                        ].map((metric) => (
                                          <div key={metric.label} className="text-center">
                                            <div className="text-[10px] text-muted-foreground mb-0.5">
                                              {metric.label}
                                            </div>
                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                              <div
                                                className={`h-full rounded-full transition-all duration-700 ${
                                                  metric.value > 0.7
                                                    ? 'bg-emerald-500'
                                                    : metric.value > 0.4
                                                    ? 'bg-amber-500'
                                                    : 'bg-red-500'
                                                }`}
                                                style={{ width: `${metric.value * 100}%` }}
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Expandable Reasoning */}
                                      {branch.reasoning && (
                                        <details className="mt-2">
                                          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                                            View reasoning
                                          </summary>
                                          <p className="text-xs text-muted-foreground mt-1 pl-2 border-l-2 border-border">
                                            {branch.reasoning}
                                          </p>
                                        </details>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}

                            {/* Agent Output Inspector */}
                            {agents.size > 0 && (
                              <div className="mt-6">
                                <div className="flex items-center gap-2 mb-2">
                                  <Activity className="w-4 h-4 text-emerald-500" />
                                  <h3 className="text-sm font-semibold">Agent Outputs</h3>
                                </div>
                                <div className="space-y-2">
                                  {Array.from(agents.values()).map((agent) => {
                                    const config = AGENT_CONFIG[agent.id];
                                    return (
                                      <details key={agent.id}>
                                        <summary className={`flex items-center gap-2 text-xs font-medium cursor-pointer py-1 px-2 rounded hover:bg-accent transition-colors ${config?.color || ''}`}>
                                          <ChevronRight className="w-3 h-3" />
                                          <span>{agent.icon}</span>
                                          <span>{agent.name}</span>
                                          {agent.status === 'completed' && (
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto" />
                                          )}
                                        </summary>
                                        <div className="mt-1 ml-4 pl-3 border-l-2 border-border text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                                          {agent.output || 'Processing...'}
                                        </div>
                                      </details>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* ─── Verification Tab ──────────────── */}
                        {rightTab === 'verification' && (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-500" />
                              <h3 className="text-sm font-semibold">Verification Report</h3>
                            </div>

                            {verificationChecks.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">Verification checks will run after the solution is generated.</p>
                              </div>
                            ) : (
                              <>
                                {/* Overall Result */}
                                <Card
                                  className={`border ${
                                    verificationResult === 'pass'
                                      ? 'border-emerald-500/50 bg-emerald-500/5'
                                      : verificationResult === 'fail'
                                      ? 'border-red-500/50 bg-red-500/5'
                                      : 'border-amber-500/50 bg-amber-500/5'
                                  }`}
                                >
                                  <CardContent className="p-3 flex items-center gap-3">
                                    {verificationResult === 'pass' ? (
                                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                    ) : verificationResult === 'fail' ? (
                                      <XCircle className="w-6 h-6 text-red-500" />
                                    ) : (
                                      <AlertCircle className="w-6 h-6 text-amber-500" />
                                    )}
                                    <div>
                                      <p className="text-sm font-semibold capitalize">
                                        {verificationResult === 'pass' ? 'All Checks Passed' : verificationResult === 'fail' ? 'Checks Failed' : 'Partial Results'}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {verificationChecks.filter((c) => c.result === 'pass').length}/{verificationChecks.length} checks passed
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Individual Checks */}
                                <div className="space-y-2">
                                  {verificationChecks.map((check) => (
                                    <Card key={check.id} className="border-border">
                                      <CardContent className="p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                          {check.result === 'pass' ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                          ) : check.result === 'fail' ? (
                                            <XCircle className="w-4 h-4 text-red-500" />
                                          ) : (
                                            <AlertCircle className="w-4 h-4 text-amber-500" />
                                          )}
                                          <span className="text-xs font-semibold">{check.name}</span>
                                          <Badge
                                            variant={
                                              check.result === 'pass'
                                                ? 'secondary'
                                                : check.result === 'fail'
                                                ? 'destructive'
                                                : 'outline'
                                            }
                                            className="ml-auto text-[10px] px-1.5 py-0"
                                          >
                                            {check.result.toUpperCase()}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground pl-6">
                                          {check.details}
                                        </p>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </>
                            )}
                          </>
                        )}

                        {/* ─── Reflection Tab ────────────────── */}
                        {rightTab === 'reflection' && (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <ScanEye className="w-4 h-4 text-pink-500" />
                              <h3 className="text-sm font-semibold">Reflection & Learning</h3>
                            </div>

                            {reflections.length === 0 && critiquePoints.length === 0 ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <ScanEye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">Reflection insights will appear after the system completes its analysis.</p>
                              </div>
                            ) : (
                              <>
                                {/* Critique Points */}
                                {critiquePoints.length > 0 && (
                                  <div className="mb-4">
                                    <h4 className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      Critique Points
                                    </h4>
                                    <div className="space-y-2">
                                      {critiquePoints.map((point) => (
                                        <Card key={point.id} className="border-border">
                                          <CardContent className="p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                              <Badge
                                                variant={
                                                  point.severity === 'critical'
                                                    ? 'destructive'
                                                    : point.severity === 'warning'
                                                    ? 'outline'
                                                    : 'secondary'
                                                }
                                                className="text-[10px] px-1.5 py-0"
                                              >
                                                {point.severity}
                                              </Badge>
                                              <span className="text-xs font-medium">{point.category}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-1">{point.description}</p>
                                            <p className="text-xs text-emerald-500 flex items-start gap-1">
                                              <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                                              {point.recommendation}
                                            </p>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Reflections */}
                                <div>
                                  <h4 className="text-xs font-semibold text-pink-400 mb-2 flex items-center gap-1">
                                    <Lightbulb className="w-3 h-3" />
                                    Key Insights
                                  </h4>
                                  <div className="space-y-2">
                                    {reflections.map((entry) => (
                                      <Card key={entry.id} className="border-pink-500/10 bg-pink-500/5">
                                        <CardContent className="p-3">
                                          <p className="text-xs text-muted-foreground">{entry.insight}</p>
                                          {entry.lessonLearned && (
                                            <div className="mt-2 pt-2 border-t border-border">
                                              <p className="text-xs text-emerald-500 flex items-start gap-1">
                                                <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                                                {entry.lessonLearned}
                                              </p>
                                            </div>
                                          )}
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>
    </TooltipProvider>
  );
}
