# Offshoot — Overview

🌿 Offshoot — branching AI chat (conversation trees with tangent offshoots).

## Repo Structure

```
src/
  app/
    layout.tsx          # Root layout (Geist fonts, global CSS)
    globals.css         # Tailwind v4 entry + theme vars
    page.tsx            # Main chat UI (client component)
    api/
      chat/
        route.ts        # BYOK streaming chat endpoint (POST /api/chat)
  components/
    SettingsModal.tsx   # API key + default model management modal
  hooks/
    useChat.ts          # Lightweight useChat-style hook (DefaultChatTransport + readUIMessageStream).
                          Persists user + assistant messages to Dexie; derives messages
                          from the tree store's linear thread. Supports optional
                          parentId/anchorSnippet for tangent creation.
  store/
    useSettingsStore.ts # Zustand persisted settings (localStorage `offshoot-settings`)
    useTreeStore.ts     # Zustand tree store: conversations, messages map,
                          activeConversationId, activeNodeId, addMessage,
                          addConversation, setActiveNode, getThreadForActive,
                          createTangent (Step 3/4 foundation)
  components/
    SettingsModal.tsx   # API key + default model management modal
    TreeDrawer.tsx      # Slide-over conversation tree drawer (Step 3 UI)
  lib/
    db.ts               # Dexie IndexedDB (OffshootDB: conversations + messages tables)
    tree.ts             # getLinearThread: active-branch path for LLM context
  types/
    chat.ts             # MessageNode / ConversationTree (branching data model — not yet wired to UI)
```

## State

- **BYOK (Bring Your Own Key), zero-leak**: OpenRouter API key lives only in
  browser `localStorage` (Zustand `persist`, key `offshoot-settings`). The chat
  page sends it per-request as the `x-openrouter-key` header; the API route
  builds an ephemeral `createOpenRouter({ apiKey })` instance and discards it
  after streaming. The key is never stored/logged server-side.
- **Streaming protocol**: AI SDK v7 UI-message stream. Server:
  `streamText` → `toUIMessageStream` → `createUIMessageStreamResponse`;
  client consumes via `DefaultChatTransport.sendMessages` +
  `readUIMessageStream`. (The original spec referenced AI SDK v3/v4
  `ai/react` + `toDataStreamResponse`; adapted since the repo has `ai@7` and no
  `@ai-sdk/react`.)
- **Models**: default `anthropic/claude-3.5-sonnet`; modal offers GPT-4o,
  Llama 3.1 70B/8B, Gemini 1.5 Pro. Selected model is sent as extra request body.
- **Chat state**: powered by `src/store/useTreeStore` (Zustand). Messages are
  persisted to Dexie IndexedDB on every turn. `useChat` derives its rendered
  thread from `getThreadForActive()` (parent-walk to root via `getLinearThread`).
- **Branching data model** (`src/types/chat.ts`: `MessageNode`,
  `ConversationTree` with `parentId`/`childrenIds`/`activeNodeId`) is mirrored
  in `src/lib/db.ts` (`DBMessage` / `DBConversation`) and wired to UI through
  `useTreeStore`.
- **Persistence (Step 1 done)**: `src/lib/db.ts` — Dexie `OffshootDB` v1 with
  `conversations` (`id, updatedAt, createdAt`) and `messages`
  (`id, conversationId, parentId, createdAt`) tables. `DBMessage` mirrors
  `MessageNode` + `conversationId` (cross-table key) and tangent fields
  (`isTangentRoot`, `anchorSnippet`).
- **Tree traversal (Step 2 done)**: `src/lib/tree.ts` — `getLinearThread`
  walks parent pointers from the active node back to the root to build the
  linear thread for LLM context (verified: `a>b>c`, tangent `a>b>t1`,
  null/missing → `[]`). Pure, dependency-free.
- **Tangent Drawer UI (Step 3 done)**: `src/store/useTreeStore.ts` +
  `src/components/TreeDrawer.tsx` + integrated into `src/app/page.tsx`.
  Slide-over panel lists all nodes in the active conversation; active branch
  path highlighted; click any node to switch active context.
- **Highlight Action (Step 4 done)**: Select text in any assistant message,
  click the "Tangent" button that appears, compose a reply, and hit "Create
  Branch". The new user message is persisted with `parentId` pointing to the
  source message and `anchorSnippet` set to the highlighted text; `isTangentRoot`
  is flagged. The assistant reply continues the branch.
- **Build**: `npx tsc --noEmit` clean; `npm run build` green.

