'use client';

import React from 'react';
import type { DBMessage } from '@/lib/db';
import { useTreeStore } from '@/store/useTreeStore';
import { Plus, MessageSquare, GitBranch, Terminal, ChevronRight } from 'lucide-react';

export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    addConversation,
    messages,
    openTangent,
  } = useTreeStore();

  // Find all tangent branches in the current conversation
  const currentMessages = activeConversationId
    ? Object.values(messages).filter((m) => m.conversationId === activeConversationId)
    : [];

  const branchRoots = React.useMemo(() => {
    return currentMessages.filter((m) => m.isTangentRoot && m.anchorSnippet);
  }, [currentMessages]);

  return (
    <aside className="w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col h-full shrink-0 select-none">
      {/* Top action */}
      <div className="p-3 border-b border-neutral-800">
        <button
          onClick={() => {
            const id = crypto.randomUUID();
            const now = Date.now();
            addConversation({
              id,
              title: 'New Conversation',
              createdAt: now,
              updatedAt: now,
              rootMessageId: id,
            });
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/60 text-xs font-medium text-neutral-200 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Conversations
        </div>

        {Object.values(conversations).map((c) => {
          const isActive = c.id === activeConversationId;
          return (
            <div key={c.id} className="space-y-1">
              <button
                onClick={() => setActiveConversation(c.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                  isActive
                    ? 'bg-neutral-800/80 text-white font-medium'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                <span className="truncate flex-1">{c.title}</span>
              </button>

              {/* Tree branches shown directly on the side under the active conversation */}
              {isActive && (
                <div className="ml-4 pl-2 border-l border-neutral-800 space-y-1 my-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-neutral-400">
                    <Terminal className="w-3 h-3 text-neutral-500" />
                    <span>Trunk (Main)</span>
                  </div>

                  {branchRoots.length > 0 ? (
                    branchRoots.map((branch) => (
                      <button
                        key={branch.id}
                        onClick={() =>
                          openTangent(branch.parentId || '', branch.anchorSnippet || '', branch.id)
                        }
                        className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 rounded text-left transition group"
                      >
                        <GitBranch className="w-3 h-3 shrink-0 text-emerald-500/70" />
                        <span className="truncate flex-1">
                          {branch.anchorSnippet?.slice(0, 22)}...
                        </span>
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-0.5 text-[10px] text-neutral-600 italic">
                      No branches yet
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}