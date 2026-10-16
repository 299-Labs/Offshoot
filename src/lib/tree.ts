import type { DBMessage } from './db';

/**
 * Given all messages in a conversation and an active leaf node ID,
 * walks up the parent pointers to construct the linear message thread
 * that should be sent to the LLM context.
 */
export function getLinearThread(
  messagesMap: Record<string, DBMessage>,
  activeNodeId: string | null
): DBMessage[] {
  if (!activeNodeId || !messagesMap[activeNodeId]) return [];

  const thread: DBMessage[] = [];
  let curr: DBMessage | null = messagesMap[activeNodeId];

  while (curr) {
    thread.unshift(curr); // Add to beginning of array
    curr = curr.parentId ? messagesMap[curr.parentId] || null : null;
  }

  return thread;
}
