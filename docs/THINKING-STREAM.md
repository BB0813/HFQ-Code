# Thinking / reasoning stream (backend)

**Audience:** UI / renderer agent  
**Date:** 2026-07-15  
**Status:** shipped (provider + agent-core + session events)

## What it is

Optional **chain-of-thought / extended thinking** stream from models that return it:

| Source | Wire field |
|--------|------------|
| OpenAI-compatible (DeepSeek, Qwen, etc.) | `delta.reasoning_content` or `delta.reasoning` |
| Anthropic | content block `type: "thinking"` |
| Mock provider | user text matches `thinking` / `reason` / `思考过程` / `推理` |

Models that never send these fields produce **no** thinking events (UI stays on normal `message.*` only).

## Session events

Same channel as everything else: `hfq.onSessionEvent` / `session:event`.

```ts
// Live (not written to JSONL)
{
  type: "thinking.delta",
  sessionId: string,
  messageId: string,  // same id as the following message.delta / message.completed for this model round
  text: string,       // chunk
  at: string,         // ISO
}

// Durable (JSONL + snapshot.messages role "thinking")
{
  type: "thinking.completed",
  sessionId: string,
  messageId: string,
  text: string,       // full reasoning for the round
  at: string,
}
```

### Rules

1. **`thinking.delta`** — live UI only (like `message.delta`). Skipped in `eventLog` / not restored as deltas.
2. **`thinking.completed`** — durable; rebuilds a UI row `role: "thinking"` with `thinking: true`.
3. **Not re-injected** into OpenAI/Anthropic chat history (only for display).
4. Share **`messageId`** with the assistant answer of the same model round so the UI can nest CoT under the bubble.

## Frontend wiring (suggested)

```js
hfq.onSessionEvent((ev) => {
  if (ev.type === "thinking.delta") {
    // append to a collapsible "思考过程" panel keyed by messageId
    // streamThinking[ev.messageId] = (streamThinking[ev.messageId] || "") + ev.text
  }
  if (ev.type === "thinking.completed") {
    // finalize panel; hide spinner; store full text for resume
  }
  if (ev.type === "message.delta" || ev.type === "message.completed") {
    // existing assistant body; same messageId may pair with thinking above
  }
});
```

On session open, `snapshot.messages` may include:

```js
{ role: "thinking", text: "…", messageId: "…", thinking: true }
```

Render collapsed by default; do **not** send this role back to the model.

## Provider API (packages)

```ts
// ChatRequest
onThinkingDelta?: (text: string) => void | Promise<void>;

// ChatResult
reasoning?: string;
```

## Out of scope

- Forcing models to think (no `thinking: { type: enabled }` request flag yet — enable when product wants Anthropic extended thinking budgets)
- Redacting CoT from diagnostics beyond existing `redactJsonValue` (thinking text may still contain paths; same as assistant text)
- Separate IPC channel — uses existing `session:event`

## Test / demo

Mock model: send `show 思考过程 please` → expect `thinking.delta` + `thinking.completed` + assistant reply.
