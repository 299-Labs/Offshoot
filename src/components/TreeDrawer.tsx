'use client';

import React from 'react';
import type { DBMessage } from '@/lib/db';
import { useTreeStore } from '@/store/useTreeStore';
import { getMessageText } from '@/hooks/useChat';
import { ChevronRight, MessageSquare, GitBranch, GitMerge } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function TreeDrawer({ isOpen, onClose }: Props) {
  const {
    conversations,
    messages,
    activeConversationId,
    activeNodeId,
    setActiveNode,
    addMessage,
  } = useTreeStore();

  if (!isOpen) return null;

  const activeConversation =
    activeConversationId && conversations[activeConversationId];

  // Build a set of node IDs on the active branch path.
  const activePathIds = new Set<string>();
  if (activeNodeId) {
    let curr: DBMessage | null = messages[activeNodeId] || null;
    while (curr) {
      activePathIds.add(curr.id);
      curr = curr.parentId ? (messages[curr.parentId] || null) : null;
    }
  }

  const handleMergeToTrunk = async () => {
    if (!activeNodeId || !activeConversationId) return;

    const branchNode = messages[activeNodeId];
    if (!branchNode || !branchNode.isTangentRoot) return;

    // Build the linear thread for this tangent branch.
    const thread: DBMessage[] = [];
    let curr: DBMessage | null = branchNode;
    while (curr) {
      thread.unshift(curr);
      curr = curr.parentId ? messages[curr.parentId] : null;
    }
    if (thread.length === 0) return;

    const summaryText = thread
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const mergeNotice = `> 🌿 **Offshoot Summary (${(branchNode.anchorSnippet || '').slice(0, 40)}...)**\n>\n> ${
      summaryText.length > 300 ? summaryText.slice(0, 300) + '...' : summaryText
    }`;

    const mergeMessageId = crypto.randomUUID();
    const now = Date.now();
    const mergeNode: DBMessage = {
      id: mergeMessageId,
      conversationId: activeConversationId,
      parentId: branchNode.parentId,
      childrenIds: [],
      role: 'assistant',
      content: mergeNotice,
      model: 'system-merge',
      createdAt: now,
    };

    await addMessage(mergeNode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-canvas/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-bg-surface border border-border-subtle rounded-xl p-6 shadow-2xl text-text-primary flex flex-col gap-6">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="w-5 h-5 text-brand-sage" />
          <h2 className="text-lg font-semibold">Conversation Tree</h2>
        </div>

        {!activeConversation ? (
          <div className="text-text-muted text-sm text-center py-4">
            No conversation yet. Start chatting to build your tree.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              {activeConversation.title}
            </div>
            <div className="space-y-2">
              {Object.values(messages)
                .filter((m) => m.conversationId === activeConversationId)
                .map((m) => {
                  const isActive = m.id === activeNodeId;
                  const isOnPath = activePathIds.has(m.id);
                  const isTangent = m.isTangentRoot;
                  const text = getMessageText({
                    id: m.id,
                    role: m.role as 'user' | 'assistant' | 'system',
                    parts: [{ type: 'text', text: m.content }],
                  });
                  return (
                    <div
                      key={m.id}
                      onClick={() => setActiveNode(m.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                        isActive
                          ? 'bg-brand-sage/20 border border-brand-sage/50'
                          : isOnPath
                            ? 'bg-bg-surface/50'
                            : 'hover:bg-bg-canvas'
                      }`}
                    >
                      <div className="w-1 h-4 bg-text-muted mx-0.5" />
                      {isTangent && (
                        <GitBranch className="w-3 h-3 text-text-muted" />
                      )}
                      {!isTangent && <MessageSquare className="w-3 h-3 text-text-muted" />}
                      <span
                        className={`text-sm truncate ${
                          isActive
                            ? 'text-brand-sage font-medium'
                            : isOnPath
                              ? 'text-text-primary'
                              : 'text-text-muted'
                        }`}
                      >
                        {m.role === 'user' ? 'You:' : 'AI:'} {text.slice(0, 60)}
                        {text.length > 60 ? '…' : ''}
                        {m.anchorSnippet && (
                          <span className="text-[10px] text-text-muted ml-1 italic">
                            '…'
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}

            {activeNodeId && messages[activeNodeId]?.isTangentRoot && (
              <div className="mt-4 pt-4 border-t border-border-subtle">
                <button
                  onClick={handleMergeToTrunk}
                  className="flex items-center gap-1.5 w-full justify-center px-4 py-2 text-xs font-medium text-brand-sage hover:text-brand-blush bg-brand-sage/20 hover:bg-brand-sage/30 rounded-lg border border-brand-sage/40 transition"
                >
                  <GitMerge className="w-3.5 h-3.5" />
                  Merge to Trunk
                </button>
              </div>
            )}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition"
          >
            Close
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-brand-sage text-bg-canvas font-medium px-4 py-2 rounded-lg text-sm hover:bg-brand-blush transition"
          >
            <ChevronRight className="w-4 h-4" /> Open Chat
          </button>
        </div>
      </div>
    </div>
  );
}
