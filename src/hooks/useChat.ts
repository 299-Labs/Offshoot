'use client';

import { useCallback, useRef, useState } from 'react';
import {
  DefaultChatTransport,
  generateId,
  readUIMessageStream,
  type UIMessage,
} from 'ai';
import { db } from '@/lib/db';
import type { DBMessage } from '@/lib/db';
import { useTreeStore } from '@/store/useTreeStore';

interface UseChatOptions {
  apiKey: string;
  model: string;
  api?: string;
  /** Parent node ID when sending a tangent reply (Step 4). */
  parentId?: string | null;
  /** Highlighted text from the parent that spawned this tangent (Step 4). */
  anchorSnippet?: string;
}

/**
 * Minimal `useChat`-style hook built only on the installed `ai` package
 * (no `@ai-sdk/react` dependency). It sends UI messages through
 * `DefaultChatTransport` — attaching the BYOK key as the `x-openrouter-key`
 * header and the selected model as extra body — and accumulates the streamed
 * `UIMessageChunk`s into `UIMessage` state.
 */
export function useChat({
  apiKey,
  model,
  api = '/api/chat',
  parentId,
  anchorSnippet,
}: UseChatOptions) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const messagesRef = useRef<UIMessage[]>([]);
  const loadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const chatIdRef = useRef<string | null>(null);

  const syncMessages = (next: UIMessage[]) => {
    messagesRef.current = next;
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || loadingRef.current) return;

      if (!apiKey) {
        setError(
          new Error('Missing OpenRouter API Key. Please configure it in settings.')
        );
        return;
      }

      const tree = useTreeStore.getState();
      const activeConversationId = tree.activeConversationId;
      const activeNodeId = tree.activeNodeId;

      if (!activeConversationId) {
        setError(new Error('No active conversation. Start a new chat first.'));
        return;
      }

      loadingRef.current = true;
      setIsLoading(true);
      setError(undefined);

      const userId = generateId();
      const now = Date.now();

      const userDbMessage: DBMessage = {
        id: userId,
        conversationId: activeConversationId,
        parentId: parentId ?? activeNodeId,
        childrenIds: [],
        role: 'user',
        content,
        model,
        createdAt: now,
        ...(anchorSnippet ? { isTangentRoot: true, anchorSnippet } : {}),
      };
      await tree.addMessage(userDbMessage);
      const userMessage: UIMessage = {
        id: userId,
        role: 'user',
        parts: [{ type: 'text' as const, text: content }],
      };

      const thread = tree.getThreadForActive();
      const base: UIMessage[] = [
        ...thread.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          parts: [{ type: 'text' as const, text: m.content }],
        })),
        userMessage,
      ];

      const assistantId = generateId();
      const assistantSeed: UIMessage = {
        id: assistantId,
        role: 'assistant',
        parts: [],
      };
      syncMessages([...base, assistantSeed]);

      try {
        const transport = new DefaultChatTransport({
          api,
          headers: { 'x-openrouter-key': apiKey },
          body: { model },
        });

        const stream = await transport.sendMessages({
          trigger: 'submit-message',
          chatId: activeConversationId,
          messageId: undefined,
          messages: base,
          abortSignal: new AbortController().signal,
        });

        let accumulatedText = '';

        for await (const message of readUIMessageStream({
          message: assistantSeed,
          stream,
          onError: (e) => {
            throw e;
          },
        })) {
          syncMessages([...base, message]);
          if (message.parts) {
            for (const part of message.parts) {
              if (part.type === 'text' && part.text) {
                accumulatedText += part.text;
              }
            }
          }
        }

        if (accumulatedText) {
          const assistantDbMessage: DBMessage = {
            id: assistantId,
            conversationId: activeConversationId,
            parentId: userId,
            childrenIds: [],
            role: 'assistant',
            content: accumulatedText,
            model,
            createdAt: Date.now(),
          };
          await tree.addMessage(assistantDbMessage);
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          // Keep the partial assistant message on abort.
        } else {
          setError(
            e instanceof Error ? e : new Error('An error occurred during completion.')
          );
        }
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [api, apiKey, model, parentId, anchorSnippet]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const value = input;
      setInput('');
      void sendMessage(value);
    },
    [input, sendMessage]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const thread = useTreeStore.getState().getThreadForActive();

  return {
    messages: thread.map((m): UIMessage => ({
      id: m.id,
      role: m.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text' as const, text: m.content }],
    })),
    input,
    handleInputChange,
    handleSubmit,
    sendMessage,
    isLoading,
    error,
    stop,
  };
}

/** Concatenate the text parts of a UI message for rendering. */
export function getMessageText(message: UIMessage): string {
  return message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('');
}
