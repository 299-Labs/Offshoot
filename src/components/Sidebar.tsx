'use client';
import React, { useState } from 'react';
import { useTreeStore } from '@/store/useTreeStore';
import { db } from '@/lib/db';
import type { DBMessage, DBConversation } from '@/lib/db';
import { isNodeOnTrunk, getParentBranchRootId, getBranchTrail, getBranchLeafId } from '@/lib/tree';
import { Plus, MessageSquare, GitBranch, Terminal, ChevronRight, Trash2, Pencil } from 'lucide-react';
interface BranchTreeItemProps {
  branch: DBMessage;
  allBranches: DBMessage[];
  messages: Record<string, DBMessage>;
  activeNodeId: string | null;
  onSelectBranch: (branchRootId: string) => void;
  depth?: number;
}

function BranchTreeItem({
  branch,
  allBranches,
  messages,
  activeNodeId,
  onSelectBranch,
  depth = 0,
}: BranchTreeItemProps) {
  // Find child branches sprouted directly from anywhere inside this branch's lineage
  const childBranches = allBranches.filter(
    (b) => getParentBranchRootId(messages, b) === branch.id
  );

  const activeTrail = getBranchTrail(messages, activeNodeId);
  const isDirectlyActive = activeTrail.some((b) => b.id === branch.id);

  return (
    <div className="space-y-1">
      <button
        onClick={() => onSelectBranch(branch.id)}
        style={{ paddingLeft: `${depth * 10 + 8}px` }}
        className={`w-full flex items-center gap-1.5 py-1 pr-2 text-[11px] rounded text-left transition cursor-pointer group ${
          isDirectlyActive
            ? 'bg-[#1c1416] text-[#f7b2bd] font-medium border border-[#f7b2bd]/40'
            : 'text-[#8e948f] hover:text-[#f7b2bd] hover:bg-[#171a19]'
        }`}
      >
        <GitBranch className="w-3 h-3 shrink-0 text-[#f7b2bd]" />
        <span className="truncate flex-1">
          {branch.anchorSnippet?.slice(0, 18) || 'Offshoot'}...
        </span>
        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Recursive rendering of nested children */}
      {childBranches.length > 0 && (
        <div className="border-l border-[#242b28] ml-2 space-y-1">
          {childBranches.map((child) => (
            <BranchTreeItem
              key={child.id}
              branch={child}
              allBranches={allBranches}
              messages={messages}
              activeNodeId={activeNodeId}
              onSelectBranch={onSelectBranch}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { conversations, activeConversationId, activeNodeId, setActiveConversation, setActiveNode, switchToTrunk, messages, initStore, isSidebarOpen, updateConversation } = useTreeStore();
  const [editingConvoId, setEditingConvoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const currentMessages = activeConversationId ? Object.values(messages).filter((m) => m.conversationId === activeConversationId) : [];
  const allBranches = React.useMemo(() => {
    return currentMessages.filter((m) => m.isTangentRoot && m.anchorSnippet);
  }, [currentMessages]);

  // Root branches are branches that sprouted directly off the main trunk
  const rootBranches = React.useMemo(() => {
    return allBranches.filter((b) => getParentBranchRootId(messages, b) === null);
  }, [allBranches, messages]);

  const isTrunkActive = isNodeOnTrunk(messages, activeNodeId);

  const handleSelectBranch = (branchRootId: string) => {
    const leafId = getBranchLeafId(messages, branchRootId);
    setActiveNode(leafId);
  };
  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await db.conversations.delete(id);
    await db.messages.where('conversationId').equals(id).delete();
    await initStore();
  };

  const handleStartRename = (e: React.MouseEvent, convo: DBConversation) => {
    e.stopPropagation();
    setEditingConvoId(convo.id);
    setEditTitle(convo.title || 'Untitled');
  };

  const handleSaveRename = async (id: string) => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== conversations[id]?.title) {
      await updateConversation(id, { title: trimmed });
    }
    setEditingConvoId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveRename(id);
    } else if (e.key === 'Escape') {
      setEditingConvoId(null);
    }
  };
  return (
    <aside className={`bg-[#0d0f0e] border-r border-[#242b28] flex flex-col h-full shrink-0 select-none transition-all duration-200 ease-in-out overflow-hidden z-20 ${isSidebarOpen ? 'w-64 opacity-100' : 'w-0 border-r-0 opacity-0 pointer-events-none'}`}>
      {/* Inner fixed-width wrapper prevents text wrapping during transition */}
      <div className="w-64 flex flex-col h-full">
        <div className="p-3 border-b border-[#242b28]">
        <button onClick={() => setActiveConversation(null)} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-sage/10 hover:bg-brand-sage/20 border border-brand-sage/30 text-xs font-medium text-brand-sage rounded-lg transition cursor-pointer">
          <Plus className="w-3.5 h-3.5" /><span>New Conversation</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold text-brand-sage uppercase tracking-wider">Conversations</div>
        {Object.values(conversations).length === 0 ? (
          <div className="px-2 py-4 text-xs text-text-muted text-center italic">No chats yet</div>
        ) : (Object.values(conversations).map((c) => {
          const isActive = c.id === activeConversationId;
          const isEditing = editingConvoId === c.id;

          return (
            <div key={c.id} className="space-y-1 group/item">
              <div
                onClick={() => {
                  if (!isEditing) setActiveConversation(c.id);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${isActive ? 'bg-[#171a19] text-[#ecebe6] font-medium border border-[#242b28]' : 'text-[#8e948f] hover:text-[#ecebe6] hover:bg-[#141716]'}`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-1 min-w-0 flex-1 mr-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleSaveRename(c.id)}
                      onKeyDown={(e) => handleKeyDown(e, c.id)}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      className="w-full bg-[#111313] text-[#ecebe6] border border-[#506c64] rounded px-1.5 py-0.5 text-xs focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#8e948f]" />
                    <span className="truncate">{c.title || 'Untitled'}</span>
                  </div>
                )}

                {!isEditing && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleStartRename(e, c)}
                      className="p-1 hover:text-[#dfd0b8] text-[#8e948f] transition cursor-pointer"
                      title="Rename chat"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(e, c.id)}
                      className="p-1 hover:text-[#b2675e] text-[#8e948f] transition cursor-pointer"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              {isActive && (
                <div className="ml-3 pl-2 border-l border-[#242b28] space-y-1 my-1">
                  <button onClick={switchToTrunk} className={`w-full flex items-center gap-1.5 px-2 py-1 text-[11px] rounded transition ${isTrunkActive ? 'bg-[#171a19] text-brand-sage font-medium border border-brand-sage/20' : 'text-[#8e948f] hover:text-[#ecebe6] hover:bg-[#141716]'}`}>
                    <Terminal className="w-3 h-3 text-brand-sage" /><span>Trunk (Main)</span>
                  </button>
                  {rootBranches.map((branch) => (
                    <BranchTreeItem
                      key={branch.id}
                      branch={branch}
                      allBranches={allBranches}
                      messages={messages}
                      activeNodeId={activeNodeId}
                      onSelectBranch={handleSelectBranch}
                      depth={0}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        }))}
      </div>
      </div>
    </aside>
  );
}
