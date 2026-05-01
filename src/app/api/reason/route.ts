// ============================================================
// Adaptive Reasoning AI System — Streaming API Route
// Handles POST /api/reason — streams reasoning events as SSE
// ============================================================

import { NextRequest } from 'next/server';
import { CognitiveCoordinator } from '@/lib/agents/coordinator';

// Netlify: extend serverless function timeout (max 26s on Pro, 10s on free)
export const maxDuration = 60;

// Create a new coordinator per request to avoid state leakage
function createCoordinator(): CognitiveCoordinator {
  return new CognitiveCoordinator();
}

export async function POST(request: NextRequest) {
  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { query } = body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Query is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const coordinator = createCoordinator();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'connected',
          timestamp: Date.now(),
          data: { message: 'Cognitive pipeline initialized' },
        })}\n\n`));

        // Stream reasoning events
        for await (const chunk of coordinator.processQuery(query.trim())) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            timestamp: Date.now(),
            data: { message: msg },
          })}\n\n`));
        } catch {
          // Stream already closed
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
