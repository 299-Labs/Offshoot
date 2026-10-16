export interface MessageNode {
  id: string;
  parentId: string | null;      // null = root message of conversation
  childrenIds: string[];        // allows one turn to spawn multiple offshoots
  role: 'user' | 'assistant' | 'system';
  content: string;
  model: string;                // e.g., "anthropic/claude-3.5-sonnet" or "meta-llama/llama-3.1-8b-instruct"
  createdAt: number;
  
  // Tangent Metadata
  isTangentRoot?: boolean;      // Marks if this message was spun off from a parent
  anchorSnippet?: string;       // The specific highlighted sentence that spawned this branch
}

export interface ConversationTree {
  id: string;
  title: string;
  rootMessageId: string;
  activeNodeId: string;         // The currently viewed message in the tree
  nodes: Record<string, MessageNode>; // Fast O(1) lookup
}