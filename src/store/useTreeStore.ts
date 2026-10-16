import { create } from 'zustand';
import type { DBConversation, DBMessage } from '@/lib/db';
import { db } from '@/lib/db';
import { getLinearThread, getLatestTrunkNode } from '@/lib/tree';

interface TreeState {
  conversations: Record<string, DBConversation>;
  messages: Record<string, DBMessage>;
  activeConversationId: string | null;
  activeNodeId: string | null;
  tangent: {
    isOpen: boolean;
    parentMessageId: string | null;
    anchorSnippet: string;
    activeBranchNodeId: string | null;
  };
  initStore: () => Promise<void>;
  loadConversation: (conversation: DBConversation, messageList: DBMessage[]) => void;
  setActiveConversation: (id: string | null) => Promise<void>;
  setActiveNode: (id: string | null) => void;
  switchToTrunk: () => void;
  addConversation: (conversation: DBConversation) => Promise<void>;
  addMessage: (message: DBMessage) => Promise<void>;
  updateMessage: (id: string, patch: Partial<DBMessage>) => Promise<void>;
  getThreadForActive: () => DBMessage[];
  createTangent: (parentId: string, anchorSnippet: string, content: string, role: DBMessage['role'], model: string) => Promise<string>;
  openTangent: (parentMessageId: string, anchorSnippet: string, activeBranchNodeId?: string) => void;
  closeTangent: () => void;
}

export const useTreeStore = create<TreeState>((set, get) => ({
  conversations: {},
  messages: {},
  activeConversationId: null,
  activeNodeId: null,
  tangent: { isOpen: false, parentMessageId: null, anchorSnippet: '', activeBranchNodeId: null },
  initStore: async () => {
    const convos = await db.conversations.orderBy('updatedAt').reverse().toArray();
    const convMap: Record<string, DBConversation> = {};
    convos.forEach((c) => { convMap[c.id] = c; });
    const allMsgs = await db.messages.toArray();
    const msgMap: Record<string, DBMessage> = {};
    allMsgs.forEach((m) => { msgMap[m.id] = m; });
    const initialConvoId = convos.length > 0 ? convos[0].id : null;
    let initialNodeId: string | null = null;
    if (initialConvoId) {
      const latestTrunk = getLatestTrunkNode(msgMap, initialConvoId);
      initialNodeId = latestTrunk ? latestTrunk.id : null;
    }
    set({ conversations: convMap, messages: msgMap, activeConversationId: initialConvoId, activeNodeId: initialNodeId });
  },
  loadConversation: (conversation, messageList) => {
    const map: Record<string, DBMessage> = {};
    messageList.forEach((m) => { map[m.id] = m; });
    const merged = { ...get().messages, ...map };
    const latestTrunk = getLatestTrunkNode(merged, conversation.id);
    set((state) => ({
      conversations: { ...state.conversations, [conversation.id]: conversation },
      messages: { ...state.messages, ...map },
      activeConversationId: conversation.id,
      activeNodeId: latestTrunk ? latestTrunk.id : null,
    }));
  },
  setActiveConversation: async (id) => {
    if (!id) { set({ activeConversationId: null, activeNodeId: null }); return; }
    const latestTrunk = getLatestTrunkNode(get().messages, id);
    set({ activeConversationId: id, activeNodeId: latestTrunk ? latestTrunk.id : null, tangent: { isOpen: false, parentMessageId: null, anchorSnippet: '', activeBranchNodeId: null } });
  },
  setActiveNode: (id) => { set({ activeNodeId: id }); },
  switchToTrunk: () => {
    const { activeConversationId, messages } = get();
    if (!activeConversationId) return;
    const latestTrunk = getLatestTrunkNode(messages, activeConversationId);
    set({ activeNodeId: latestTrunk ? latestTrunk.id : null, tangent: { isOpen: false, parentMessageId: null, anchorSnippet: '', activeBranchNodeId: null } });
  },
  addConversation: async (conversation) => {
    await db.conversations.put(conversation);
    set((state) => ({
      conversations: { ...state.conversations, [conversation.id]: conversation },
      activeConversationId: conversation.id,
      activeNodeId: conversation.rootMessageId || null,
    }));
  },
  addMessage: async (message) => {
    await db.messages.put(message);
    set((state) => {
      const nextMessages = { ...state.messages, [message.id]: message };
      if (message.parentId && nextMessages[message.parentId]) {
        const parent = nextMessages[message.parentId];
        if (!parent.childrenIds.includes(message.id)) {
          const updatedParent = { ...parent, childrenIds: [...parent.childrenIds, message.id] };
          void db.messages.put(updatedParent);
          nextMessages[message.parentId] = updatedParent;
        }
      }
      return { messages: nextMessages };
    });
  },
  updateMessage: async (id, patch) => {
    const msg = get().messages[id];
    if (!msg) return;
    const updated = { ...msg, ...patch };
    await db.messages.put(updated);
    set((state) => ({ messages: { ...state.messages, [id]: updated } }));
  },
  getThreadForActive: () => {
    const { messages, activeNodeId } = get();
    return getLinearThread(messages, activeNodeId);
  },
  createTangent: async (parentId, anchorSnippet, content, role, model) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const message: DBMessage = { id, conversationId: get().activeConversationId || '', parentId, childrenIds: [], role, content, model, createdAt: now, isTangentRoot: true, anchorSnippet };
    await get().addMessage(message);
    get().setActiveNode(id);
    return id;
  },
  openTangent: (parentMessageId, anchorSnippet, activeBranchNodeId) => {
    set({ activeNodeId: activeBranchNodeId || parentMessageId, tangent: { isOpen: true, parentMessageId, anchorSnippet, activeBranchNodeId: activeBranchNodeId || null } });
  },
  closeTangent: () => { set((state) => ({ tangent: { ...state.tangent, isOpen: false } })); },
}));
