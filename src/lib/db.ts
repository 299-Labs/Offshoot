import Dexie, { type Table } from 'dexie';

export interface DBMessage {
  id: string;
  conversationId: string;
  parentId: string | null; // null if it's the very first message
  childrenIds: string[]; // IDs of direct replies/branches
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string;
  createdAt: number;

  // Tangent context
  isTangentRoot?: boolean; // true if this node opened a branch
  anchorSnippet?: string; // the text from the parent that was highlighted
}

export interface DBConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  rootMessageId: string;
}

export class OffshootDatabase extends Dexie {
  conversations!: Table<DBConversation, string>;
  messages!: Table<DBMessage, string>;

  constructor() {
    super('OffshootDB');
    this.version(1).stores({
      conversations: 'id, updatedAt, createdAt',
      messages: 'id, conversationId, parentId, createdAt',
    });
  }
}

export const db = new OffshootDatabase();
