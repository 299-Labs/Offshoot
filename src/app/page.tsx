'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { DBMessage, DBConversation } from '@/lib/db';
import { useTreeStore } from '@/store/useTreeStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SettingsModal } from '@/components/SettingsModal';
import { MessageItem } from '@/components/MessageItem';
import { HighlightActionTooltip } from '@/components/HighlightActionTooltip';
import { Sidebar } from '@/components/Sidebar';
import { getLinearThread, getBranchTrail, isNodeOnTrunk, getBranchLeafId } from '@/lib/tree';
import { Settings, Send, GitBranch, ArrowLeft, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Logo } from '@/components/Logo';

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [tangentParentId, setTangentParentId] = useState<string | null>(null);
  const [anchorSnippet, setAnchorSnippet] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const breadcrumbScrollRef = useRef<HTMLDivElement>(null);
  const { apiKey, defaultModel } = useSettingsStore();
  const { activeConversationId, activeNodeId, messages: storeMessages, initStore, addConversation, addMessage, updateMessage, setActiveNode, switchToTrunk, isSidebarOpen, toggleSidebar, setSidebarOpen } = useTreeStore();
  useEffect(() => { initStore(); }, [initStore]);

  // Responsive check & Cmd+B / Ctrl+B keyboard shortcut
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleSidebar, setSidebarOpen]);
  const currentThread = React.useMemo(() => getLinearThread(storeMessages, activeNodeId), [storeMessages, activeNodeId]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentThread, isStreaming]);


  const branchTrail = React.useMemo(() => {
    return getBranchTrail(storeMessages, activeNodeId);
  }, [storeMessages, activeNodeId]);

  const onTrunk = isNodeOnTrunk(storeMessages, activeNodeId);

  // Auto-scroll the breadcrumb trail to the far right on updates
  useEffect(() => {
    const el = breadcrumbScrollRef.current;
    if (el) {
      el.scrollTo({
        left: el.scrollWidth,
        behavior: 'smooth',
      });
    }
  }, [branchTrail, onTrunk]);

  const activeBranchRoot = branchTrail.length > 0 ? branchTrail[branchTrail.length - 1] : null;
  const handleCreateTangent = (parentMessageId: string, snippet: string) => { setTangentParentId(parentMessageId); setAnchorSnippet(snippet); };
  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputEl = (e.currentTarget as HTMLFormElement).querySelector('input') as HTMLInputElement;
    const userText = inputEl?.value?.trim() || '';
    if (!userText || isStreaming || !apiKey) return;

    inputEl.value = '';

    let convId = activeConversationId;
    if (!convId) {
      convId = crypto.randomUUID();
      const now = Date.now();
      const newConvo: DBConversation = {
        id: convId,
        title: userText.slice(0, 32),
        createdAt: now,
        updatedAt: now,
        rootMessageId: '',
      };
      await addConversation(newConvo);
    }

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

    setIsStreaming(true);
    setStreamingMessageId(assistantMsgId);

    const ancestry = getLinearThread({ ...storeMessages, [userMsgId]: userNode }, userMsgId);
    const messagesPayload = ancestry.map((m: DBMessage) => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch('/Offshoot/api/chat', {
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
      await updateMessage(assistantMsgId, {
        content: `Error: ${err.message || 'Failed to stream response.'}`,
      });
    } finally {
      setIsStreaming(false);
      setStreamingMessageId(null);
    }
  };
  const handleTangentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tangentParentId || !anchorSnippet.trim() || !activeConversationId || !apiKey) return;

    const inputEl = (e.currentTarget as HTMLFormElement).querySelector('input') as HTMLInputElement;
    const userText = inputEl?.value?.trim() || '';
    if (!userText) return;

    inputEl.value = '';
    const capturedSnippet = anchorSnippet;
    const capturedParentId = tangentParentId;
    setTangentParentId(null);
    setAnchorSnippet('');

    const userMsgId = `msg_${Date.now()}_t_u`;
    const assistantMsgId = `msg_${Date.now()}_t_a`;
    const now = Date.now();

    const userNode: DBMessage = {
      id: userMsgId,
      conversationId: activeConversationId,
      parentId: capturedParentId,
      childrenIds: [],
      role: 'user',
      content: userText,
      model: defaultModel,
      createdAt: now,
      isTangentRoot: true,
      anchorSnippet: capturedSnippet,
    };
    await addMessage(userNode);

    const assistantNode: DBMessage = {
      id: assistantMsgId,
      conversationId: activeConversationId,
      parentId: userMsgId,
      childrenIds: [],
      role: 'assistant',
      content: '',
      model: defaultModel,
      createdAt: now + 1,
    };
    await addMessage(assistantNode);
    setActiveNode(assistantMsgId);

    setIsStreaming(true);
    setStreamingMessageId(assistantMsgId);

    const parentMsg = storeMessages[capturedParentId];
    const ancestryBeforeParent = parentMsg?.parentId
      ? getLinearThread(storeMessages, parentMsg.parentId)
      : [];

    const messagesPayload = [
      ...ancestryBeforeParent.map((m: DBMessage) => ({ role: m.role, content: m.content })),
      {
        role: 'assistant',
        content: `Excerpt from earlier response:\n"${capturedSnippet}"`,
      },
      {
        role: 'user',
        content: `Regarding specifically this statement: "${capturedSnippet}"\n\nQuestion: ${userText}\n\n(Instruction: Address solely this tangent question and excerpt directly.)`,
      },
    ];

    try {
      const response = await fetch('/Offshoot/api/chat', {
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
      await updateMessage(assistantMsgId, {
        content: `Error: ${err.message || 'Failed to stream response.'}`,
      });
    } finally {
      setIsStreaming(false);
      setStreamingMessageId(null);
    }
  };

  // Navigates up exactly one branch level, landing at the parent anchor message
  const handleStepUp = () => {
    if (branchTrail.length === 0) return;
    const currentRoot = branchTrail[branchTrail.length - 1];
    if (currentRoot.parentId) {
      setActiveNode(currentRoot.parentId);
    } else {
      switchToTrunk();
    }
  };

  return (
    <main className="flex h-screen w-screen bg-[#111313] text-[#ecebe6] font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        {/* Sidebar Margin Arrow Toggle */}
        <button
          type="button"
          onClick={toggleSidebar}
          title={isSidebarOpen ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
          className={`absolute top-1/2 -translate-y-1/2 z-30 flex items-center justify-center transition-all duration-200 cursor-pointer bg-[#171a19] border border-[#242b28] text-[#8e948f] hover:text-[#ecebe6] hover:border-[#506c64] hover:bg-[#202523] shadow-md group ${
            isSidebarOpen
              ? '-left-3 w-6 h-6 rounded-full hover:scale-110'
              : 'left-0 w-4 h-10 rounded-r-md border-l-0 hover:w-5'
          }`}
        >
          {isSidebarOpen ? (
            <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          )}
        </button>

        <header className="flex items-center justify-between px-6 py-3 border-b border-[#242b28] bg-[#111313]">
          <div ref={breadcrumbScrollRef} className="flex items-center gap-2 text-xs min-w-0 overflow-x-auto no-scrollbar py-0.5">

            {/* Logo */}
            <div className="flex items-center gap-1.5 font-semibold tracking-tight text-brand-sage shrink-0">
              <Logo className="w-4 h-4" />
              <span>Offshoot</span>
            </div>

            <span className="text-[#8e948f]/40 shrink-0">/</span>

            {/* Clickable Trunk Root */}
            <button
              type="button"
              onClick={switchToTrunk}
              className={`px-2 py-0.5 rounded transition cursor-pointer shrink-0 font-medium ${
                onTrunk
                  ? 'text-brand-sage bg-brand-sage/10 border border-brand-sage/30'
                  : 'text-[#8e948f] hover:text-[#ecebe6]'
              }`}
            >
              Trunk
            </button>

            {/* Multi-depth Branch Trail */}
            {branchTrail.map((branch, idx) => {
              const isCurrent = idx === branchTrail.length - 1;
              return (
                <React.Fragment key={branch.id}>
                  <span className="text-[#8e948f]/40 shrink-0">/</span>
                  <button
                    type="button"
                    onClick={() => setActiveNode(getBranchLeafId(storeMessages, branch.id))}
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs transition cursor-pointer shrink-0 max-w-[160px] truncate ${
                      isCurrent
                        ? 'bg-[#1c1416] text-[#f7b2bd] border-[#f7b2bd]/40 font-medium'
                        : 'bg-[#141716] text-[#8e948f] border-[#242b28] hover:text-[#f7b2bd]'
                    }`}
                    title={branch.anchorSnippet}
                  >
                    <GitBranch className="w-3 h-3 text-[#f7b2bd] shrink-0" />
                    <span className="truncate">
                      {branch.anchorSnippet?.slice(0, 16) || 'Branch'}...
                    </span>
                  </button>
                </React.Fragment>
              );
            })}

            {/* Step Up Button */}
            {!onTrunk && (
              <button
                type="button"
                onClick={handleStepUp}
                className="ml-2 flex items-center gap-1 text-brand-sage hover:text-[#ecebe6] bg-brand-sage/10 hover:bg-brand-sage/20 border border-brand-sage/30 hover:border-brand-sage/50 px-2 py-0.5 rounded-md transition cursor-pointer text-xs shrink-0"
              >
                <ArrowLeft className="w-3 h-3 text-brand-sage" />
                <span>{branchTrail.length > 1 ? 'Up to Parent' : 'Return to Trunk'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg hover:bg-[#171a19] border border-[#242b28] text-[#8e948f] hover:text-[#ecebe6] transition cursor-pointer"
            >
              <Settings className="w-4 h-4 text-brand-sage" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-w-3xl w-full mx-auto">
          {currentThread.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#8e948f] text-xs text-center space-y-2">
              <p>Type a prompt to start the conversation trunk.</p>
              <p className="text-[#8e948f]/60">Highlight any sentence in the response to spawn a branch.</p>
            </div>
          ) : (
            currentThread.map((m: DBMessage) => (
              <MessageItem
                key={m.id}
                message={m}
                isStreaming={isStreaming && streamingMessageId === m.id}
              />
            ))
          )}
          <div ref={scrollRef} />
        </div>
        {tangentParentId && anchorSnippet && (
          <div className="p-3 bg-[#171a19] border border-[#f7b2bd]/40 rounded-xl text-[#ecebe6] text-xs mb-3 mx-auto max-w-2xl w-full shadow-2xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-[#f7b2bd] flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" />
                Branch from excerpt:
              </span>
              <button
                onClick={() => {
                  setTangentParentId(null);
                  setAnchorSnippet('');
                }}
                className="text-[#8e948f] hover:text-[#ecebe6]"
              >
                ✕
              </button>
            </div>
            <div className="italic text-[#f0f3bd] border-l-2 border-[#506c64] pl-2 mb-2 line-clamp-2">
              "{anchorSnippet}"
            </div>
            <form onSubmit={handleTangentSubmit} className="flex gap-2">
              <input
                type="text"
                autoFocus
                placeholder="Ask your tangent question..."
                className="flex-1 bg-[#111313] border border-[#242b28] rounded-lg px-3 py-2 text-xs text-[#ecebe6] placeholder-[#8e948f]/50 focus:outline-none focus:border-[#506c64]"
              />
              <button
                type="submit"
                disabled={isStreaming}
                className="bg-[#506c64] text-[#ecebe6] font-medium px-3.5 py-2 rounded-lg text-xs hover:bg-[#5d7e75] disabled:opacity-50 transition"
              >
                {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Branch'}
              </button>
            </form>
          </div>
        )}
        <div className="p-4 border-t border-[#242b28] bg-[#111313] max-w-3xl w-full mx-auto">
          <form onSubmit={handleSendPrompt} className="relative flex items-center">
            <input
              type="text"
              placeholder={
                !apiKey
                  ? 'Enter an API key in settings...'
                  : onTrunk
                  ? 'Ask a question on the main trunk...'
                  : `Reply in branch "${activeBranchRoot?.anchorSnippet?.slice(0, 20)}..."`
              }
              disabled={!apiKey || isStreaming}
              className={`w-full bg-[#111313] border rounded-xl px-4 py-3 pr-12 text-xs text-[#ecebe6] placeholder-[#8e948f]/60 focus:outline-none disabled:opacity-50 transition-colors ${
                onTrunk
                  ? 'border-[#242b28] focus:border-[#506c64]'
                  : 'border-[#f7b2bd]/40 focus:border-[#f7b2bd]'
              }`}
            />
            <button
              type="submit"
              disabled={!apiKey || isStreaming}
              className="absolute right-2 p-2 bg-brand-sage text-bg-canvas hover:bg-brand-blush rounded-lg transition disabled:opacity-30 disabled:hover:bg-brand-sage cursor-pointer"
            >
              {isStreaming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </form>
        </div>
      </div>
      <HighlightActionTooltip onCreateTangent={handleCreateTangent} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </main>
  );
}
