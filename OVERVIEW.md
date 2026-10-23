# Offshoot — Overview

🌿 Offshoot — branching AI chat (conversation trees with tangent offshoots).

## Repo Structure

```
src/
  app/
    layout.tsx          # Root layout (Geist fonts, globals.css, metadata)
    globals.css         # Tailwind v4 entry + theme vars
    page.tsx            # Main chat UI — Sidebar + breadcrumb header,
                        # lazy-create convo on first send, shared streamInto helper,
                        # hyper-focused tangent payload (excerpt substitution)
    api/
      chat/
        route.ts        # BYOK plain-text streaming endpoint (POST /api/chat)
  components/
    Sidebar.tsx               # Conversation list, clickable Trunk button,
                              # leaf-seeking branch jumps, delete-conversation
    MessageItem.tsx           # Markdown/GFM assistant render, anchor header,
                              # inline branch pills
    HighlightActionTooltip.tsx # Assistant-only selection tooltip ("Ask Tangent")
    TreeDrawer.tsx            # Centered Conversation Tree modal + Merge to Trunk
                              # (currently unmounted from page.tsx — see State)
    SettingsModal.tsx         # API key + default model management modal
  hooks/
    useChat.ts          # Unused chat hook (dead code) + getMessageText() helper
                        # live-imported only for getMessageText by TreeDrawer
  store/
    useSettingsStore.ts # Zustand persisted settings (localStorage `offshoot-settings`)
    useTreeStore.ts     # Zustand tree store: initStore (IndexedDB hydration),
                        # loadConversation, setActiveConversation (trunk-leaf),
                        # setActiveNode, switchToTrunk, addConversation (put),
                        # addMessage (put + childrenIds link), updateMessage,
                        # getThreadForActive, createTangent, openTangent/closeTangent
  lib/
    db.ts               # Dexie IndexedDB (OffshootDB: conversations + messages tables)
    tree.ts             # getLinearThread + ancestry helpers (getBranchRootForNode,
                        # isNodeOnTrunk, getLatestTrunkNode) — a node is on a branch
                        # if it or ANY ancestor has isTangentRoot
  types/
    chat.ts             # MessageNode / ConversationTree (mirrored by DBMessage /
                        # DBConversation, wired to UI through useTreeStore)
```

## State

- **BYOK (Bring Your Own Key), zero-leak**: OpenRouter API key lives only in
  browser `localStorage` (Zustand `persist`, key `offshoot-settings`). The chat
  page sends it per-request as the `x-openrouter-key` header; the API route
  builds an ephemeral `createOpenRouter({ apiKey })` instance and discards it
  after streaming. The key is never stored/logged server-side.
- **Streaming protocol (plain text)**: server `src/app/api/chat/route.ts` does
  `streamText` → `toTextStreamResponse()` (not UI-message stream). Client
  `src/app/page.tsx` (`handleSendTrunk` / `handleTangentSubmit`) does
  `fetch('/api/chat')` + `response.body.getReader()` + `TextDecoder` loop and
  patches the seeded empty assistant node per-chunk via
  `updateMessage(assistantMsgId, { content: streamed })`. Errors land in the
  assistant node as `Error: <message>`. `401` when `x-openrouter-key` missing;
  `500` on completion failure.
- **API payload shaping (`route.ts`)**: body is `{ messages: {role,content}[], model? }`
  (default `openrouter/free`). `system` roles move into `instructions`;
  empty-content turns are dropped. `model` falls back to `DEFAULT_MODEL`.
- **Models**: default `openrouter/free` (`useSettingsStore.ts:16`).
  `SettingsModal` offers `openrouter/free` (Auto Free Router),
  `meta-llama/llama-3.1-8b-instruct:free`, `google/gemma-2-9b-it:free`,
  `anthropic/claude-3.5-sonnet` (Paid), `openai/gpt-4o` (Paid).
  Header badge shows `defaultModel.split('/')[1]`. Sent as JSON `model`.
- **Chat state / render path**: `src/app/page.tsx` calls `initStore()` on mount
  (hydrates all convos + messages from Dexie, selects most-recent `updatedAt`
  convo at its trunk leaf). `currentThread = getLinearThread(storeMessages, activeNodeId)`
  renders via `<MessageItem>`. No convo/seed message is saved until the first trunk
  send — then title = `userText.slice(0, 32)`, `rootMessageId: ''`. Trunk payload =
  full ancestry; tangent payload = hyper-focused (`ancestryBeforeParent` +
  `Excerpt: <snippet>` assistant turn + `Re excerpt [...] Q:` user turn —
  the long parent body is replaced by the snippet). Both share `streamInto(aid, payload)`.
- **Branching data model** (`src/types/chat.ts`: `MessageNode`,
  `ConversationTree` with `parentId`/`childrenIds`/`activeNodeId`) is mirrored
  in `src/lib/db.ts` (`DBMessage` = `MessageNode` + `conversationId`;
  `DBConversation` with `rootMessageId`) and wired to UI through
  `useTreeStore`.
- **Persistence**: `src/lib/db.ts` — Dexie `OffshootDB` v1 with
  `conversations` (`id, updatedAt, createdAt`) and `messages`
  (`id, conversationId, parentId, createdAt`) tables. `initStore` =
  `conversations.orderBy('updatedAt').reverse()` + `messages.toArray()` into
  maps, active = newest convo's trunk tip via `getLatestTrunkNode` (lineage-based:
  filters `isNodeOnTrunk`, sorts `createdAt` — never fooled by unflagged tangent
  assistant replies). `addConversation` uses `put`
  (upsert); `addMessage` uses `put` then links `childrenIds` on the in-state
  parent (+ `put`s parent, no state collision). `updateMessage(id, patch)` is
  the streaming path. `setActiveConversation` / `loadConversation` /
  `switchToTrunk` all use `getLatestTrunkNode` (ancestry walk, not a bare
  `!isTangentRoot` filter — the old filter misclassified tangent assistant
  replies as trunk and trapped Return-to-Trunk inside the branch) and reset
  `tangent` state.
- **Tree traversal**: `src/lib/tree.ts` — `getLinearThread(messagesMap, activeNodeId)`
  walks parent pointers to root, `unshift`ing for LLM context (`null`/missing → `[]`).
  `getBranchRootForNode` walks the same chain returning the first `isTangentRoot`
  ancestor-or-self (`null` = trunk); `isNodeOnTrunk` = that check `=== null`
  (`null`/missing id → `true`); `getLatestTrunkNode(convo)` = `isNodeOnTrunk`
  filter + `createdAt` sort, last wins. Used for render thread, request ancestry,
  `initStore`/`setActiveConversation`/`loadConversation`/`switchToTrunk` tips,
  `Sidebar.isTrunkActive`, `page.onTrunk` + `activeBranchRoot`.
  `TreeDrawer` still duplicates a bare walk for `activePathIds` (modal unmounted).
- **Tree Drawer UI (centered modal)**: `TreeDrawer.tsx` (header button in `page.tsx`).
  Centered modal (`max-w-lg`) lists all `messages` in the active conversation;
  active node `bg-brand-sage/20 border border-brand-sage/50`, on-path `bg-bg-surface/50`;
  click → `setActiveNode(m.id)`. `isTangentRoot` rows get `GitBranch` icon. When the
  active node `isTangentRoot`, **Merge to Trunk** builds a `USER:/ASSISTANT:` summary
  (300-char cap) into a `> 🌿 **Offshoot Summary (<anchor 40 chars>...)**` assistant
  node (`model: 'system-merge'`) parented to `branchNode.parentId`.
- **Highlight → Tangent**: `HighlightActionTooltip.tsx` listens `mouseup`/`keyup`,
  requires non-collapsed selection `>= 3 chars` inside
  `[data-message-id][data-role="assistant"]`, floats `fixed` above the selection.
  **Ask Tangent** sets local `tangentParentId/anchorSnippet` → floating excerpt
  compose box (`Branch from excerpt:` + quote + autofocus input + `Branch` button,
  `X` cancels). Submit creates `user(isTangentRoot, anchorSnippet)` + empty
  `assistant` seed, `setActiveNode(aid)`, streams the focused payload.
- **Sidebar**: `New Conversation` = `setActiveConversation(null)` (page lazy-creates
  on next send — no placeholder row saved). Conversation rows show `title || 'Untitled'`
  + hover `Trash2` delete (`db.conversations.delete` + `messages.where(conversationId).delete()`
  + `initStore()` re-hydrate; `stopPropagation` so delete doesn't switch chats).
  Active convo expands clickable **Trunk (Main)** (`switchToTrunk`,
  `isNodeOnTrunk(messages, activeNodeId)` — true even when the active node is an
  unflagged tangent assistant reply) + branch rows (`anchorSnippet.slice(0,20)`,
  active when `getBranchRootForNode(messages, activeNodeId)?.id === branch.id`,
  so deep follow-ups still highlight their root). Branch click leaf-seeks
  (`childrenIds[0]` walk) → `setActiveNode(leaf)` so `currentThread` shows the full branch.
  Breadcrumb header in `page.tsx` mirrors this via `activeBranchRoot` /
  `onTrunk` (`isNodeOnTrunk`): `Trunk (Main)` vs `Branch` chip +
  `Return to Trunk` (`onClick={() => switchToTrunk()}`, `type="button"`).
  The bottom input is context-aware: trunk placeholder/styling vs emerald
  `Reply in branch...` when `!onTrunk` (single `handleSendPrompt` continues
  whichever thread is active — full ancestry when on trunk). `TreeDrawer` modal (Merge to Trunk) still exists
  but is unmounted from `page.tsx` in this revision.
- **MessageItem**: user bubbles stay `whitespace-pre-wrap`; assistant bubbles render
  `ReactMarkdown + remark-gfm` (`prose prose-invert prose-sm`). `isTangentRoot` +
  `anchorSnippet` rows show an `Anchor: "..."` emerald header (replaces the old
  `Branch` badge). Empty `content` = `Loader2 Generating response...`.
  Inline pills for `childrenIds → isTangentRoot` children → `setActiveNode(branch.id)`.
- **Dead code**: `src/hooks/useChat.ts` (`DefaultChatTransport` + `readUIMessageStream`,
  Dexie + `parentId/anchorSnippet` support) is **not imported by `page.tsx`**. Only live
  export is `getMessageText(message)` (concats `parts[type=text]`), used by `TreeDrawer`.
- **Build**: `npx tsc --noEmit` clean; `npm run build` green.

