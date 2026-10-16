'use client';

import React from 'react';
import type { DBMessage } from '@/lib/db';
import { useTreeStore } from '@/store/useTreeStore';
import { GitBranch, Loader2 } from 'lucide-react';

interface Props {
  message: DBMessage;
}

export function MessageItem({ message }: Props) {
  const { messages, setActiveNode } = useTreeStore();

  // Find all child branches spawned from this message.
  const tangentChildren = (message.childrenIds ?? [])
    .map((id) => messages[id])
    .filter((m) => m && m.isTangentRoot);

  const isBranchRoot = message.isTangentRoot;

  return (
    <div
      className={`flex flex-col ${
        message.role === 'user' ? 'items-end' : 'items-start'
      }`}
    >
      <div
        data-message-id={message.id}
        data-role={message.role}
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed select-text ${
          message.role === 'user'
            ? 'bg-neutral-100 text-neutral-900 font-medium'
            : 'bg-neutral-900 border border-neutral-800 text-neutral-200'
        }`}
      >
        {/* Render text or loading animation if streaming has started */}
        {message.content ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <span className="flex items-center gap-2 text-neutral-400 italic text-xs py-0.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500" />
            Generating response...
          </span>
        )}

        {isBranchRoot && (
          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/30 border border-emerald-800/40 text-[10px] text-emerald-300">
            <GitBranch className="w-2.5 h-2.5 text-emerald-400" />
            <span>Branch</span>
          </div>
        )}

        {/* Inline Branch Indicators */}
        {tangentChildren.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex flex-wrap gap-1.5">
            {tangentChildren.map((branch) => (
              <button
                key={branch.id}
                onClick={() => setActiveNode(branch.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 text-[11px] text-emerald-300 transition"
              >
                <GitBranch className="w-3 h-3 text-emerald-400" />
                <span className="truncate max-w-[180px]">
                  {branch.anchorSnippet || 'Offshoot'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}