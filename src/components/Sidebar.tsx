'use client';
import React from 'react';
import { useTreeStore } from '@/store/useTreeStore';
import { db } from '@/lib/db';
import { isNodeOnTrunk, getBranchRootForNode } from '@/lib/tree';
import { Plus, MessageSquare, GitBranch, Terminal, ChevronRight, Trash2 } from 'lucide-react';
export function Sidebar() {
  const { conversations, activeConversationId, activeNodeId, setActiveConversation, setActiveNode, switchToTrunk, messages, initStore } = useTreeStore();
  const currentMessages = activeConversationId ? Object.values(messages).filter((m) => m.conversationId === activeConversationId) : [];
  const branchRoots = React.useMemo(() => currentMessages.filter((m) => m.isTangentRoot && m.anchorSnippet), [currentMessages]);
  const isTrunkActive = isNodeOnTrunk(messages, activeNodeId);
  const activeBranchRoot = getBranchRootForNode(messages, activeNodeId);
  const handleSelectBranch = (branchRootId: string) => {
    let curr = messages[branchRootId];
    while (curr && curr.childrenIds && curr.childrenIds.length > 0) {
      const nextChild = messages[curr.childrenIds[0]];
      if (!nextChild) break;
      curr = nextChild;
    }
    setActiveNode(curr ? curr.id : branchRootId);
  };
  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await db.conversations.delete(id);
    await db.messages.where('conversationId').equals(id).delete();
    await initStore();
  };
  return (
    <aside className="w-64 bg-neutral-950 border-r border-neutral-800 flex flex-col h-full shrink-0 select-none">
      <div className="p-3 border-b border-neutral-800">
        <button onClick={() => setActiveConversation(null)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/60 text-xs font-medium text-neutral-200 rounded-lg transition">
          <Plus className="w-3.5 h-3.5" /><span>New Conversation</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Conversations</div>
        {Object.values(conversations).length === 0 ? (
          <div className="px-2 py-4 text-xs text-neutral-600 text-center italic">No chats yet</div>
        ) : (Object.values(conversations).map((c) => {
          const isActive = c.id === activeConversationId;
          return (
            <div key={c.id} className="space-y-1 group/item">
              <div onClick={() => setActiveConversation(c.id)} className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${isActive ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'}`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-neutral-500" />
                  <span className="truncate">{c.title || 'Untitled'}</span>
                </div>
                <button onClick={(e) => handleDeleteConversation(e, c.id)} className="opacity-0 group-hover/item:opacity-100 p-1 hover:text-red-400 text-neutral-500 transition" title="Delete chat">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              {isActive && (
                <div className="ml-3 pl-2.5 border-l border-neutral-800 space-y-1 my-1">
                  <button onClick={switchToTrunk} className={`w-full flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition ${isTrunkActive ? 'bg-neutral-800/80 text-emerald-400 font-medium' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'}`}>
                    <Terminal className="w-3 h-3 text-neutral-400" /><span>Trunk (Main)</span>
                  </button>
                  {branchRoots.map((branch) => {
                    const isBranchActive = activeBranchRoot?.id === branch.id;
                    return (
                      <button key={branch.id} onClick={() => handleSelectBranch(branch.id)} className={`w-full flex items-center gap-1.5 px-2 py-1 text-[11px] rounded text-left transition group ${isBranchActive ? 'bg-emerald-950/50 text-emerald-300 font-medium border border-emerald-800/50' : 'text-neutral-400 hover:text-emerald-300 hover:bg-neutral-900'}`}>
                        <GitBranch className="w-3 h-3 shrink-0 text-emerald-500" />
                        <span className="truncate flex-1">{branch.anchorSnippet?.slice(0, 20)}...</span>
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }))}
      </div>
    </aside>
  );
}
