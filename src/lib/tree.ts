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

/**
 * Returns the ordered trail of tangent root messages from the trunk down to the active node.
 * Example: [Branch Level 1 Root, Branch Level 2 Root]
 */
export function getBranchTrail(
  messagesMap: Record<string, DBMessage>,
  activeNodeId: string | null
): DBMessage[] {
  if (!activeNodeId || !messagesMap[activeNodeId]) return [];

  const trail: DBMessage[] = [];
  let curr: DBMessage | undefined = messagesMap[activeNodeId];

  while (curr) {
    if (curr.isTangentRoot) {
      trail.unshift(curr);
    }
    if (!curr.parentId) break;
    curr = messagesMap[curr.parentId];
  }

  return trail;
}

/**
 * Determines which branch root is the direct parent of this tangent root.
 * Returns null if the branch sprouted directly off the trunk.
 */
export function getParentBranchRootId(
  messagesMap: Record<string, DBMessage>,
  tangentRoot: DBMessage
): string | null {
  let curr = tangentRoot.parentId ? messagesMap[tangentRoot.parentId] : null;

  while (curr) {
    if (curr.isTangentRoot) {
      return curr.id;
    }
    curr = curr.parentId ? messagesMap[curr.parentId] : null;
  }

  return null; // Parent is the main Trunk
}

/**
 * Drills down from a branch root to its deepest linear message,
 * without crossing into child tangents.
 */
export function getBranchLeafId(
  messagesMap: Record<string, DBMessage>,
  branchRootId: string
): string {
  let curr = messagesMap[branchRootId];
  if (!curr) return branchRootId;

  while (curr && curr.childrenIds && curr.childrenIds.length > 0) {
    const nextLinearChild = curr.childrenIds
      .map((id) => messagesMap[id])
      .find((m) => m && !m.isTangentRoot);

    if (!nextLinearChild) break;
    curr = nextLinearChild;
  }

  return curr.id;
}
