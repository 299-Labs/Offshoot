import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText, type ModelMessage } from 'ai';

const DEFAULT_MODEL = 'openrouter/free';

/**
 * Zero-leak BYOK chat endpoint.
 *
 * The OpenRouter key is read from the `x-openrouter-key` header (supplied by
 * the browser from localStorage), used to build an ephemeral provider for
 * this request only, and then discarded — it is never persisted, logged, or
 * written to any server-side store.
 */
export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get('x-openrouter-key');

    if (!apiKey) {
      return Response.json(
        { error: 'Missing OpenRouter API Key. Please configure it in settings.' },
        { status: 401 }
      );
    }

    // The client streams plain `{ role, content }` messages (already
    // model-message shaped) — not `UIMessage`s with `parts`.
    const { messages, model } = (await req.json()) as {
      messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      model?: string;
    };

    // Separate system messages — AI SDK requires them in `instructions`,
    // not in the `messages` array.
    const systemMessages = messages?.filter((m) => m.role === 'system') ?? [];
    const regularMessages = messages?.filter((m) => m.role !== 'system') ?? [];
    const instructions = systemMessages
      .map((m) => m.content)
      .filter((text) => text.trim().length > 0)
      .join('\n');

    // Drop empty placeholder turns (e.g. an assistant seed that never
    // received any content) — providers reject empty text parts.
    const modelMessages: ModelMessage[] = regularMessages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    // Ephemeral provider instance — scoped to this request, dropped after.
    const openrouter = createOpenRouter({ apiKey });

    const result = streamText({
      model: openrouter(model || DEFAULT_MODEL),
      instructions,
      messages: modelMessages,
    });

    // Plain text streaming for standard fetch + TextDecoder reader
    return result.toTextStreamResponse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An error occurred during completion.';
    return Response.json({ error: message }, { status: 500 });
  }
}
