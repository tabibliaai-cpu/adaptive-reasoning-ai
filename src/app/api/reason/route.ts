// ============================================================
// Adaptive Reasoning AI System — Streaming API Route
// Handles POST /api/reason — streams reasoning events as SSE
// ============================================================

import { NextRequest } from 'next/server';
import { CognitiveCoordinator } from '@/lib/agents/coordinator';

const coordinator = new CognitiveCoordinator();

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query } = body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Query is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      const initEvent = `data: ${JSON.stringify({
        type: 'connected',
        timestamp: Date.now(),
        data: { message: 'Cognitive pipeline initialized' },
      })}\n\n`;
      controller.enqueue(encoder.encode(initEvent));

      try {
        // Stream reasoning events from coordinator
        for await (const chunk of coordinator.processQuery(query.trim())) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        const errorEvent = `data: ${JSON.stringify({
          type: 'error',
          timestamp: Date.now(),
          data: { message: msg },
        })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
