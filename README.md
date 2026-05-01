# Adaptive Reasoning AI System

A multi-agent cognitive architecture built with Next.js 16, featuring Tree-of-Thoughts reasoning, real-time agent visualization, and smart query routing.

## Architecture

The system employs a **4-agent cognitive pipeline** with intelligent routing:

- **Smart Router** — Classifies queries as "simple" (fast chat, ~1-2s) or "complex" (full reasoning pipeline, ~15-25s)
- **Problem Understanding Agent** — Analyzes the problem, identifies root causes, and classifies constraints
- **Strategic Planner** — Generates multiple solution strategies using Tree-of-Thoughts reasoning
- **Solution Architect** — Designs architecture and produces implementation code
- **Verifier & Critic** — Validates correctness, completeness, scalability, and maintainability

### Key Features

- **Tree-of-Thoughts Reasoning** — Explores 3 solution strategies in parallel, evaluates by likelihood/scalability/maintainability, selects optimal path
- **Multi-Layer Memory System** — Short-term, failure, procedural, and reflection memory across sessions
- **Real-Time Streaming** — SSE-based streaming with live agent progress, thought branch visualization, and verification results
- **Verification-First Philosophy** — Every solution undergoes 4-point verification (correctness, completeness, scalability, maintainability)
- **Reflective Learning** — System learns from failed approaches and records successful workflows

## Tech Stack

| Technology | Purpose |
|---|---|
| Next.js 16 | App framework (standalone output) |
| TypeScript | Type-safe development |
| Tailwind CSS 4 | Styling |
| shadcn/ui | UI component library |
| Lucide React | Icon library |
| ReactMarkdown | Markdown rendering |
| z-ai-web-dev-sdk | AI LLM integration |
| Prisma | Database ORM |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── reason/
│   │       └── route.ts          # SSE streaming API endpoint
│   ├── globals.css                # Tailwind + theme config
│   ├── layout.tsx                 # Root layout
│   └── page.tsx                   # Main UI with agent visualization
├── components/
│   └── ui/                        # shadcn/ui components
├── hooks/
│   ├── use-mobile.ts              # Mobile detection hook
│   └── use-toast.ts               # Toast notification hook
└── lib/
    ├── agents/
    │   ├── coordinator.ts         # Smart router + cognitive coordinator
    │   ├── memory.ts              # Multi-layer memory system
    │   ├── reasoning.ts           # Tree-of-Thoughts engine
    │   └── types.ts               # TypeScript type definitions
    ├── db.ts                      # Database connection
    └── utils.ts                   # Utility functions
```

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, or bun

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd adaptive-reasoning-ai

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your AI API credentials
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

The standalone output is optimized for deployment to any Node.js hosting platform.

## How It Works

### Simple Queries (Fast Path)

For greetings, acknowledgments, and basic questions, the system responds directly in ~1-2 seconds using a single LLM call — no pipeline overhead.

### Complex Queries (Deep Reasoning)

For technical problems, debugging, architecture design, and strategic planning, the full 4-agent pipeline activates:

1. **Understand** — Problem classification, root cause analysis, constraint identification
2. **Plan** — Generate 3 strategies, evaluate each on 7 dimensions, select best approach
3. **Build** — Design solution architecture, write implementation code, define tests
4. **Verify** — Run 4 verification checks, generate critique points, reflect on outcomes

All steps stream in real-time to the UI with visual progress indicators.

## UI Features

- **Real-time pipeline progress** with phase-by-phase visualization
- **Agent activity monitor** showing each agent's status and output
- **Tree-of-Thoughts explorer** with branch scoring and risk assessment
- **Verification dashboard** with pass/fail/partial results per dimension
- **Reflection & learning panel** with critique points and insights
- **Responsive design** — Desktop uses resizable panels, mobile uses bottom sheets

## License

MIT
