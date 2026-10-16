'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { DBMessage, DBConversation } from '@/lib/db';
import { useTreeStore } from '@/store/useTreeStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { SettingsModal } from '@/components/SettingsModal';
import { MessageItem } from '@/components/MessageItem';
import { HighlightActionTooltip } from '@/components/HighlightActionTooltip';
import { Sidebar } from '@/components/Sidebar';
import { getLinearThread, getBranchRootForNode, isNodeOnTrunk } from '@/lib/tree';
import { Settings, Send, GitBranch, ArrowLeft, Loader2 } from 'lucide-react';
export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [tangentParentId, setTangentParentId] = useState<string | null>(null);
  const [anchorSnippet, setAnchorSnippet] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { apiKey, defaultModel } = useSettingsStore();
  const { activeConversationId, activeNodeId, messages: storeMessages, initStore, addConversation, addMessage, updateMessage, setActiveNode, switchToTrunk } = useTreeStore();
  useEffect(() => { initStore(); }, [initStore]);
  const currentThread = React.useMemo(() => getLinearThread(storeMessages, activeNodeId), [storeMessages, activeNodeId]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentThread, isStreaming]);
  const activeBranchRoot = getBranchRootForNode(storeMessages, activeNodeId);
  const onTrunk = isNodeOnTrunk(storeMessages, activeNodeId);
  const handleCreateTangent = (parentMessageId: string, snippet: string) => { setTangentParentId(parentMessageId); setAnchorSnippet(snippet); };
  const streamInto = async (aid: string, payload: { role: string; content: string }[]) => {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-openrouter-key': apiKey }, body: JSON.stringify({ messages: payload, model: defaultModel }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'API Request Failed'); }
    const reader = r.body?.getReader();
    const dec = new TextDecoder();
    let s = '';
    if (reader) { while (true) { const { done, value } = await reader.read(); if (done) break; s += dec.decode(value, { stream: true }); await updateMessage(aid, { content: s }); } }
    await updateMessage(aid, { content: s });
  };
  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputEl = (e.currentTarget as HTMLFormElement).querySelector('input') as HTMLInputElement;
    const userText = inputEl?.value?.trim() || '';
    if (!userText || isStreaming || !apiKey) return;
    inputEl.value = '';
    setIsStreaming(true);
    let convId = activeConversationId;
    if (!convId) {
      convId = crypto.randomUUID();
      const now = Date.now();
      await addConversation({ id: convId, title: userText.slice(0, 32), createdAt: now, updatedAt: now, rootMessageId: '' } as DBConversation);
    }
    const uid = `msg_${Date.now()}_u`;
    const aid = `msg_${Date.now()}_a`;
    const unode: DBMessage = { id: uid, conversationId: convId, parentId: activeNodeId, childrenIds: [], role: 'user', content: userText, model: defaultModel, createdAt: Date.now() };
    await addMessage(unode);
    await addMessage({ id: aid, conversationId: convId, parentId: uid, childrenIds: [], role: 'assistant', content: '', model: defaultModel, createdAt: Date.now() + 1 });
    setActiveNode(aid);
    const ancestry = getLinearThread({ ...storeMessages, [uid]: unode }, uid);
    try { await streamInto(aid, ancestry.map((m: DBMessage) => ({ role: m.role, content: m.content }))); }
    catch (err: unknown) { await updateMessage(aid, { content: 'Error: ' + (err instanceof Error ? err.message : 'stream failed') }); }
    finally { setIsStreaming(false); }
  };
  const handleTangentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tangentParentId || !anchorSnippet.trim() || !activeConversationId || !apiKey) return;
    const inputEl = (e.currentTarget as HTMLFormElement).querySelector('input') as HTMLInputElement;
    const userText = inputEl?.value?.trim() || '';
    if (!userText) return;
    inputEl.value = '';
    const snip = anchorSnippet;
    const parid = tangentParentId;
    setTangentParentId(null);
    setAnchorSnippet('');
    setIsStreaming(true);
    const cid = activeConversationId;
    const uid = `msg_${Date.now()}_t_u`;
    const aid = `msg_${Date.now()}_t_a`;
    const now = Date.now();
    await addMessage({ id: uid, conversationId: cid, parentId: parid, childrenIds: [], role: 'user', content: userText, model: defaultModel, createdAt: now, isTangentRoot: true, anchorSnippet: snip });
    await addMessage({ id: aid, conversationId: cid, parentId: uid, childrenIds: [], role: 'assistant', content: '', model: defaultModel, createdAt: now + 1 });
    setActiveNode(aid);
    const pmsg = storeMessages[parid];
    const before = pmsg?.parentId ? getLinearThread(storeMessages, pmsg.parentId) : [];
    const head = before.map((m: DBMessage) => ({ role: m.role, content: m.content }));
    const payload = [...head, { role: 'assistant', content: 'Excerpt: ' + snip }, { role: 'user', content: 'Re excerpt [' + snip + '] Q: ' + userText } ];
    try { await streamInto(aid, payload); }
    catch (err: unknown) { await updateMessage(aid, { content: 'Error: ' + (err instanceof Error ? err.message : 'stream failed') }); }
    finally { setIsStreaming(false); }
  };
  return (
    <main className="flex h-screen w-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full relative">
        <header className="flex items-center justify-between px-6 py-3 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold tracking-tight text-neutral-300">Offshoot</span>
            <span className="text-neutral-600">/</span>
            {activeBranchRoot ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-emerald-400 font-medium bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                  <GitBranch className="w-3 h-3" />Branch
                </span>
                <button type="button" onClick={() => switchToTrunk()} className="flex items-center gap-1 text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-2 py-0.5 rounded transition cursor-pointer">
                  <ArrowLeft className="w-3 h-3" />Return to Trunk
                </button>
              </div>
            ) : (<span className="text-neutral-400 font-medium">Trunk (Main)</span>)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-neutral-900 border border-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full font-mono">{defaultModel.split('/')[1] || defaultModel}</span>
            <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 rounded-lg hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"><Settings className="w-4 h-4" /></button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-w-3xl w-full mx-auto">
          {currentThread.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-xs text-center space-y-2">
              <p>Type a prompt to start the conversation trunk.</p>
              <p className="text-neutral-600">Highlight any text in an assistant message to spawn a branch.</p>
            </div>
          ) : (currentThread.map((m: DBMessage) => <MessageItem key={m.id} message={m} />))}
          <div ref={scrollRef} />
        </div>
        {tangentParentId && anchorSnippet && (
          <div className="p-3 bg-neutral-900 border border-emerald-500/40 rounded-xl text-neutral-200 text-xs mb-3 mx-auto max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5" />Branch from excerpt:</span>
              <button onClick={() => { setTangentParentId(null); setAnchorSnippet(''); }} className="text-neutral-500 hover:text-neutral-300">X</button>
            </div>
            <div className="italic text-neutral-400 border-l-2 border-emerald-500/60 pl-2 mb-2 line-clamp-2">{anchorSnippet}</div>
            <form onSubmit={handleTangentSubmit} className="flex gap-2">
              <input type="text" autoFocus placeholder="Ask your tangent question..." className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-emerald-500" />
              <button type="submit" disabled={isStreaming} className="bg-emerald-500 text-neutral-950 font-medium px-3.5 py-2 rounded-lg text-xs hover:bg-emerald-400 disabled:opacity-50 transition">{isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Branch'}</button>
            </form>
          </div>
        )}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 max-w-3xl w-full mx-auto">
          <form onSubmit={handleSendPrompt} className="relative flex items-center">
            <input type="text" placeholder={!apiKey ? 'Enter an API key in settings...' : onTrunk ? 'Ask a question on the main trunk...' : 'Reply in branch...'} disabled={!apiKey || isStreaming} className={`w-full bg-neutral-900 border rounded-xl px-4 py-3 pr-12 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none disabled:opacity-50 transition-colors ${onTrunk ? 'border-neutral-800 focus:border-neutral-600' : 'border-emerald-900/60 focus:border-emerald-500'}`} />
            <button type="submit" disabled={!apiKey || isStreaming} className={`absolute right-2 p-2 rounded-lg transition disabled:opacity-30 ${onTrunk ? 'bg-neutral-100 text-neutral-900 hover:bg-white' : 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400'}`}>{isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}</button>
          </form>
        </div>
      </div>
      <HighlightActionTooltip onCreateTangent={handleCreateTangent} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </main>
  );
}
