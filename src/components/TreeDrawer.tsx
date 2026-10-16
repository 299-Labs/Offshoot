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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl text-neutral-100 flex flex-col gap-6">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold">Conversation Tree</h2>
        </div>

        {!activeConversation ? (
          <div className="text-neutral-500 text-sm text-center py-4">
            No conversation yet. Start chatting to build your tree.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3">
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
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
                          ? 'bg-emerald-900/30 border border-emerald-500/50'
                          : isOnPath
                            ? 'bg-neutral-800/50'
                            : 'hover:bg-neutral-800'
                      }`}
                    >
                      <div className="w-1 h-4 bg-neutral-600 mx-0.5" />
                      {isTangent && (
                        <GitBranch className="w-3 h-3 text-neutral-500" />
                      )}
                      {!isTangent && <MessageSquare className="w-3 h-3 text-neutral-500" />}
                      <span
                        className={`text-sm truncate ${
                          isActive
                            ? 'text-emerald-400 font-medium'
                            : isOnPath
                              ? 'text-neutral-300'
                              : 'text-neutral-500'
                        }`}
                      >
                        {m.role === 'user' ? 'You:' : 'AI:'} {text.slice(0, 60)}
                        {text.length > 60 ? '…' : ''}
                        {m.anchorSnippet && (
                          <span className="text-[10px] text-neutral-600 ml-1 italic">
                            '…'
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}

            {activeNodeId && messages[activeNodeId]?.isTangentRoot && (
              <div className="mt-4 pt-4 border-t border-neutral-800">
                <button
                  onClick={handleMergeToTrunk}
                  className="flex items-center gap-1.5 w-full justify-center px-4 py-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/30 hover:bg-emerald-950/50 rounded-lg border border-emerald-800/40 transition"
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
            className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition"
          >
            Close
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-neutral-100 text-neutral-900 font-medium px-4 py-2 rounded-lg text-sm hover:bg-white transition"
          >
            <ChevronRight className="w-4 h-4" /> Open Chat
          </button>
        </div>
      </div>
    </div>
  );
}
