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

/**
 * Walks up parent pointers to find if any ancestor (or the node itself)
 * is a tangent root. Returns the branch root, or null if on trunk.
 */
export function getBranchRootForNode(
  messagesMap: Record<string, DBMessage>,
  nodeId: string | null
): DBMessage | null {
  if (!nodeId || !messagesMap[nodeId]) return null;
  let curr: DBMessage | null = messagesMap[nodeId];
  while (curr) {
    if (curr.isTangentRoot) return curr;
    curr = curr.parentId ? messagesMap[curr.parentId] || null : null;
  }
  return null;
}

/** True if the node has zero tangent roots in its lineage. */
export function isNodeOnTrunk(
  messagesMap: Record<string, DBMessage>,
  nodeId: string | null
): boolean {
  if (!nodeId || !messagesMap[nodeId]) return true;
  return getBranchRootForNode(messagesMap, nodeId) === null;
}

/** Latest message strictly on the main trunk for a conversation. */
export function getLatestTrunkNode(
  messagesMap: Record<string, DBMessage>,
  conversationId: string | null
): DBMessage | null {
  if (!conversationId) return null;
  const trunkNodes = Object.values(messagesMap)
    .filter((m) => m.conversationId === conversationId && isNodeOnTrunk(messagesMap, m.id))
    .sort((a, b) => a.createdAt - b.createdAt);
  return trunkNodes.length > 0 ? trunkNodes[trunkNodes.length - 1] : null;
}
