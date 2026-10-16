import { create } from 'zustand';
import type { DBConversation, DBMessage } from '@/lib/db';
import { db } from '@/lib/db';
import { getLinearThread } from '@/lib/tree';

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

  loadConversation: (conversation: DBConversation, messageList: DBMessage[]) => void;
  setActiveConversation: (id: string | null) => void;
  setActiveNode: (id: string | null) => void;
  addConversation: (conversation: DBConversation) => Promise<void>;
  addMessage: (message: DBMessage) => Promise<void>;
  updateMessage: (id: string, patch: Partial<DBMessage>) => Promise<void>;
  getThreadForActive: () => DBMessage[];
  createTangent: (
    parentId: string,
    anchorSnippet: string,
    content: string,
    role: DBMessage['role'],
    model: string
  ) => Promise<string>;
  openTangent: (parentMessageId: string, anchorSnippet: string, activeBranchNodeId?: string) => void;
  closeTangent: () => void;
}

export const useTreeStore = create<TreeState>((set, get) => ({
  conversations: {},
  messages: {},
  activeConversationId: null,
  activeNodeId: null,
  tangent: {
    isOpen: false,
    parentMessageId: null,
    anchorSnippet: '',
    activeBranchNodeId: null,
  },

  loadConversation: (conversation, messageList) => {
    const map: Record<string, DBMessage> = {};
    messageList.forEach((m) => {
      map[m.id] = m;
    });
    set({
      conversations: { ...get().conversations, [conversation.id]: conversation },
      messages: { ...get().messages, ...map },
      activeConversationId: conversation.id,
      activeNodeId: conversation.rootMessageId || (messageList.length ? messageList[messageList.length - 1].id : null),
    });
  },

  setActiveConversation: async (id) => {
    set({ activeConversationId: id, activeNodeId: null });
  },

  setActiveNode: (id) => {
    set({ activeNodeId: id });
  },

  addConversation: async (conversation) => {
    await db.conversations.add(conversation);
    set((state) => ({
      conversations: { ...state.conversations, [conversation.id]: conversation },
      activeConversationId: conversation.id,
      activeNodeId: conversation.rootMessageId,
    }));
  },

  addMessage: async (message) => {
    await db.messages.add(message);

    set((state) => {
      const messages = { ...state.messages, [message.id]: message };
      // Register this node in its parent's childrenIds.
      if (message.parentId && state.messages[message.parentId]) {
        const parent = state.messages[message.parentId];
        if (!parent.childrenIds.includes(message.id)) {
          messages[message.parentId] = {
            ...parent,
            childrenIds: [...parent.childrenIds, message.id],
          };
          // Persist updated parent.
          void db.messages.put(messages[message.parentId]);
        }
      }
      return { messages };
    });
  },

  updateMessage: async (id, patch) => {
    const msg = get().messages[id];
    if (!msg) return;
    const updated = { ...msg, ...patch };
    await db.messages.put(updated);
    set((state) => ({
      messages: { ...state.messages, [id]: updated },
    }));
  },

  getThreadForActive: () => {
    const { messages, activeNodeId } = get();
    return getLinearThread(messages, activeNodeId);
  },

  createTangent: async (parentId, anchorSnippet, content, role, model) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const message: DBMessage = {
      id,
      conversationId: get().activeConversationId || '',
      parentId,
      childrenIds: [],
      role,
      content,
      model,
      createdAt: now,
      isTangentRoot: true,
      anchorSnippet,
    };
    await get().addMessage(message);
    get().setActiveNode(id);
    return id;
  },

  openTangent: (parentMessageId, anchorSnippet, activeBranchNodeId) => {
    set({
      activeNodeId: activeBranchNodeId || parentMessageId,
      tangent: {
        isOpen: true,
        parentMessageId,
        anchorSnippet,
        activeBranchNodeId: activeBranchNodeId || null,
      },
    });
  },

  closeTangent: () => {
    set((state) => ({
      tangent: { ...state.tangent, isOpen: false },
    }));
  },
}));
