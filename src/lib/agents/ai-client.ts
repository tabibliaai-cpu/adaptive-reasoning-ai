// ============================================================
// Adaptive Reasoning AI — AI Client (works with or without .z-ai-config)
// Falls back to environment variables for deployment on Netlify, Vercel, etc.
// ============================================================

interface AIConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

let cachedConfig: AIConfig | null = null;

/**
 * Load AI configuration from:
 * 1. .z-ai-config file (Z.ai environment)
 * 2. Environment variables (external hosting: Netlify, Vercel, etc.)
 */
async function loadConfig(): Promise<AIConfig> {
  if (cachedConfig) return cachedConfig;

  // Strategy 1: Try the .z-ai-config file (works in Z.ai sandbox)
  try {
    const { readFile } = await import('fs/promises');
    const { resolve } = await import('path');
    const os = await import('os');

    const searchPaths = [
      resolve(process.cwd(), '.z-ai-config'),
      resolve(os.homedir(), '.z-ai-config'),
      '/etc/.z-ai-config',
    ];

    for (const p of searchPaths) {
      try {
        const raw = await readFile(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.baseUrl && parsed.apiKey) {
          cachedConfig = parsed;
          return cachedConfig;
        }
      } catch {
        // Skip unreadable / missing files
      }
    }
  } catch {
    // fs not available or other error — fall through to env vars
  }

  // Strategy 2: Environment variables (Netlify, Vercel, Railway, etc.)
  const baseUrl = process.env.ZAI_BASE_URL || process.env.OPENAI_BASE_URL;
  const apiKey = process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY;
  const chatId = process.env.ZAI_CHAT_ID;
  const userId = process.env.ZAI_USER_ID;
  const token = process.env.ZAI_TOKEN;

  if (baseUrl && apiKey) {
    cachedConfig = { baseUrl, apiKey, chatId, userId, token };
    return cachedConfig;
  }

  throw new Error(
    'AI configuration not found. Either:\n' +
    '  1. Create a .z-ai-config file with { "baseUrl": "...", "apiKey": "..." }\n' +
    '  2. Set environment variables: ZAI_BASE_URL + ZAI_API_KEY'
  );
}

// ─── Streaming Chat Completion ─────────────────────────────────

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

export async function chatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResponse> {
  const config = await loadConfig();

  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
    'X-Z-AI-From': 'Z',
  };
  if (config.chatId) headers['X-Chat-Id'] = config.chatId;
  if (config.userId) headers['X-User-Id'] = config.userId;
  if (config.token) headers['X-Token'] = config.token;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'default',
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1200,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API request failed with status ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<ChatCompletionResponse>;
}
