'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DBMessage } from '@/lib/db';
import { useTreeStore } from '@/store/useTreeStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SettingsModal } from '@/components/SettingsModal';
import { TreeDrawer } from '@/components/TreeDrawer';
import { MessageItem } from '@/components/MessageItem';
import { HighlightActionTooltip } from '@/components/HighlightActionTooltip';
import { Sidebar } from '@/components/Sidebar';
import { getLinearThread } from '@/lib/tree';
import { Settings, Send } from 'lucide-react';

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTreeDrawerOpen, setIsTreeDrawerOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { apiKey, defaultModel } = useSettingsStore();

  const {
    conversations,
    activeConversationId,
    activeNodeId,
    messages: storeMessages,
    loadConversation,
    setActiveConversation,
    addConversation,
    addMessage,
    updateMessage,
    setActiveNode,
    openTangent,
    closeTangent,
  } = useTreeStore();

  // Highlight / tangent state (Step 4)
  const [tangentParentId, setTangentParentId] = useState<string | null>(null);
  const [anchorSnippet, setAnchorSnippet] = useState('');

  const hasConversation = activeConversationId !== null;

  const createNewConversation = useCallback(() => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const rootId = crypto.randomUUID();
    const rootMessage = {
      id: rootId,
      conversationId: id,
      parentId: null,
      childrenIds: [],
      role: 'system',
      content: 'New conversation',
      model: defaultModel,
      createdAt: now,
    } as DBMessage;
    addConversation({
      id,
      title: 'New Conversation',
      createdAt: now,
      updatedAt: now,
      rootMessageId: rootId,
    });
    addMessage(rootMessage);
  }, [addConversation, addMessage, defaultModel]);

  // Ensure a conversation exists on mount.
  useEffect(() => {
    if (!hasConversation && Object.keys(conversations).length === 0) {
      createNewConversation();
    }
  }, [hasConversation, conversations, createNewConversation]);

  const currentThread = React.useMemo(() => {
    return getLinearThread(storeMessages, activeNodeId);
  }, [storeMessages, activeNodeId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentThread, isStreaming]);

  const handleCreateTangent = useCallback(
    (parentMessageId: string, snippet: string) => {
      setTangentParentId(parentMessageId);
      setAnchorSnippet(snippet);
    },
    []
  );

  const handleCancelTangent = useCallback(() => {
    setTangentParentId(null);
    setAnchorSnippet('');
  }, []);

  const handleSendTrunk = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputRef = e.currentTarget.querySelector('input');
    const userText = inputRef?.value?.trim() || '';
    if (!userText || isStreaming || !apiKey || !hasConversation) return;

    let convId = activeConversationId;
    if (!convId) {
      const newId = crypto.randomUUID();
      const now = Date.now();
      const rootId = crypto.randomUUID();
      addConversation({
        id: newId,
        title: 'New Conversation',
        createdAt: now,
        updatedAt: now,
        rootMessageId: rootId,
      });
      addMessage({
        id: rootId,
        conversationId: newId,
        parentId: null,
        childrenIds: [],
        role: 'system',
        content: 'New conversation',
        model: defaultModel,
        createdAt: now,
      } as DBMessage);
      convId = newId;
      setActiveConversation(newId);
    }

    (e.currentTarget as HTMLFormElement).reset();
    setIsStreaming(true);

    const userMsgId = `msg_${Date.now()}_u`;
    const assistantMsgId = `msg_${Date.now()}_a`;
    const parentId = activeNodeId;

    const userNode: DBMessage = {
      id: userMsgId,
      conversationId: convId,
      parentId,
      childrenIds: [],
      role: 'user',
      content: userText,
      model: defaultModel,
      createdAt: Date.now(),
    };
    await addMessage(userNode);

    const assistantNode: DBMessage = {
      id: assistantMsgId,
      conversationId: convId,
      parentId: userMsgId,
      childrenIds: [],
      role: 'assistant',
      content: '',
      model: defaultModel,
      createdAt: Date.now() + 1,
    };
    await addMessage(assistantNode);
    setActiveNode(assistantMsgId);

    const ancestry = getLinearThread({ ...storeMessages, [userMsgId]: userNode }, userMsgId);
    const messagesPayload = ancestry.map((m: DBMessage) => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openrouter-key': apiKey,
        },
        body: JSON.stringify({
          messages: messagesPayload,
          model: defaultModel,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'API Request Failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamed = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamed += decoder.decode(value, { stream: true });
          await updateMessage(assistantMsgId, { content: streamed });
        }
      }

      await updateMessage(assistantMsgId, { content: streamed });
    } catch (err: any) {
      console.error(err);
      await updateMessage(assistantMsgId, { content: `Error: ${err.message || 'Failed to stream response.'}` });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleTangentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tangentParentId || !anchorSnippet.trim()) return;
    const inputRef = e.currentTarget.querySelector('input');
    const userText = inputRef?.value?.trim() || '';
    if (!userText) return;

    const convId = activeConversationId;
    if (!convId) return;

    const userMsgId = `msg_${Date.now()}_t_u`;
    const assistantMsgId = `msg_${Date.now()}_t_a`;
    const now = Date.now();

    const userNode: DBMessage = {
      id: userMsgId,
      conversationId: convId,
      parentId: tangentParentId,
      childrenIds: [],
      role: 'user',
      content: userText,
      model: defaultModel,
      createdAt: now,
      isTangentRoot: true,
      anchorSnippet,
    };
    await addMessage(userNode);

    const assistantNode: DBMessage = {
      id: assistantMsgId,
      conversationId: convId,
      parentId: userMsgId,
      childrenIds: [],
      role: 'assistant',
      content: '',
      model: defaultModel,
      createdAt: now + 1,
    };
    await addMessage(assistantNode);
    setActiveNode(assistantMsgId);

    const ancestry = getLinearThread(
      { ...storeMessages, [userMsgId]: userNode },
      userMsgId
    );
    const messagesPayload = ancestry.map((m: DBMessage) => ({ role: m.role, content: m.content }));

    setTangentParentId(null);
    setAnchorSnippet('');
    setIsStreaming(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openrouter-key': apiKey,
        },
        body: JSON.stringify({
          messages: messagesPayload,
          model: defaultModel,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'API Request Failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamed = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamed += decoder.decode(value, { stream: true });
          await updateMessage(assistantMsgId, { content: streamed });
        }
      }

      await updateMessage(assistantMsgId, { content: streamed });
    } catch (err: any) {
      console.error(err);
      await updateMessage(assistantMsgId, { content: `Error: ${err.message || 'Failed to stream response.'}` });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <main className="flex h-screen w-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden">
      {/* 1. Left Sidebar with Tree Hierarchy */}
      <Sidebar />

      {/* 2. Main Chat Canvas */}
      <div className="flex-1 flex flex-col h-full relative">
        <header className="flex items-center justify-between px-6 py-3.5 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight">🌿 Offshoot</span>
            <span className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full font-mono">
              {defaultModel.split('/')[1] || defaultModel}
            </span>
          </div>
          <button
            onClick={() => setIsTreeDrawerOpen(true)}
            className="p-1.5 rounded-lg hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
          >
            <span className="sr-only">Open tree drawer</span>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 rounded-lg hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-w-3xl w-full mx-auto">
          {currentThread.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-xs text-center space-y-2">
              <p>Type a prompt to start the conversation trunk.</p>
              <p className="text-neutral-600">Highlight any sentence in the response to spawn a branch.</p>
            </div>
          ) : (
            currentThread.map((m: DBMessage) => <MessageItem key={m.id} message={m} />)
          )}
          <div ref={scrollRef} />
        </div>

        {/* Tangent compose area */}
        {tangentParentId && anchorSnippet && (
          <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg text-emerald-200 text-sm mb-4 mx-auto max-w-[calc(100%-4rem)]">
            <div className="font-medium mb-1">Create tangent from:</div>
            <div className="text-xs italic truncate max-w-full">{anchorSnippet}</div>
            <form onSubmit={handleTangentSubmit} className="mt-2">
              <input
                type="text"
                onChange={(e) => (e.currentTarget as HTMLInputElement).value}
                placeholder="Reply to this tangent..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-sm text-neutral-100 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={isStreaming}
                className="ml-2 bg-emerald-500 text-neutral-900 font-medium px-3 py-1.5 rounded text-sm hover:bg-emerald-400 disabled:opacity-50 transition"
              >
                Create Branch
              </button>
              <button
                type="button"
                onClick={handleCancelTangent}
                disabled={isStreaming}
                className="ml-2 text-neutral-500 hover:text-neutral-300 text-sm underline disabled:opacity-50"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSendTrunk} className="p-4 border-t border-neutral-800 bg-neutral-950 max-w-3xl w-full mx-auto">
          <div className="relative flex items-center">
            <input
              type="text"
              onChange={(e) => (e.currentTarget as HTMLInputElement).value}
              placeholder={apiKey ? 'Ask a question on the main trunk...' : 'Enter an API key first...'}
              disabled={!apiKey || isStreaming || !hasConversation}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 pr-12 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!apiKey || isStreaming || !hasConversation}
              className="absolute right-2 p-2 bg-neutral-100 text-neutral-900 rounded-lg hover:bg-white disabled:opacity-30 transition"
            >
              {isStreaming ? <Send className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </form>
      </div>

      {/* Global Overlays */}
      <HighlightActionTooltip onCreateTangent={handleCreateTangent} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <TreeDrawer isOpen={isTreeDrawerOpen} onClose={() => setIsTreeDrawerOpen(false)} />
    </main>
  );
}

