import { useChatStore } from "@/stores/chat-store";

/**
 * Dev-only side-effect module: exposes `window.store` so the rollback,
 * send and muted-zone behavior can be exercised manually from DevTools
 * before there is a UI trigger for them. Loaded only under DEV via a
 * conditional dynamic import in main.tsx.
 */

const storeControls = {
  /** Snapshot of the current store state. */
  state() {
    return useChatStore.getState();
  },

  /** Pretty-print the message list as `[type] id — preview`. */
  messages() {
    return useChatStore.getState().messages.map((m, i) => {
      const preview =
        m.type === "user"
          ? m.content
          : m.type === "agent_message"
            ? m.content
            : m.type === "tool_operation"
              ? `${m.displayName} ${m.target}`
              : m.type === "error"
                ? m.message
                : "";
      return `${i.toString().padStart(2)} [${m.type}] ${m.id.slice(-6)} — ${preview.slice(0, 60)}`;
    });
  },

  /** Send a programmatic user message (same code path as the UI). */
  send(text: string) {
    return useChatStore.getState().appendUserMessage(text);
  },

  /**
   * Roll back to the user message at `userMessageIndex`.
   * Default 0 = first user message. Negative index counts from the end
   * (`-1` = latest user message). Logs which message was picked.
   */
  rollback(userMessageIndex = 0) {
    const state = useChatStore.getState();
    const userMessages = state.messages.filter((m) => m.type === "user");
    if (userMessages.length === 0) {
      console.warn("[store] no user messages to roll back to");
      return;
    }
    const normalized =
      userMessageIndex < 0
        ? userMessages.length + userMessageIndex
        : userMessageIndex;
    const target = userMessages[normalized];
    if (!target) {
      console.warn(
        `[store] no user message at index ${userMessageIndex} (have ${userMessages.length})`,
      );
      return;
    }
    console.info(
      `[store] rollback → user #${normalized}: "${(target as { content: string }).content.slice(0, 80)}"`,
    );
    return state.startRollback(target.id);
  },

  /** Show the muted suffix (`null` if there is none). */
  muted() {
    const state = useChatStore.getState();
    if (!state.mutedFromMessageId) return null;
    const idx = state.messages.findIndex(
      (m) => m.id === state.mutedFromMessageId,
    );
    if (idx === -1) return null;
    return state.messages.slice(idx).map((m) => `[${m.type}] ${m.id.slice(-6)}`);
  },

  /** Clear all messages, fileContent and operation state. */
  clear() {
    useChatStore.getState().clearMessages();
  },
};

declare global {
  interface Window {
    store?: typeof storeControls;
  }
}

window.store = storeControls;

console.info(
  "%c[store] dev controls installed",
  "color: #8aa; font-weight: bold;",
  "\n  window.store.send(text)        send a message programmatically",
  "\n  window.store.rollback(i = 0)   rollback to user message #i (negative = from end)",
  "\n  window.store.messages()        list messages",
  "\n  window.store.muted()           show muted suffix",
  "\n  window.store.state()           full state snapshot",
  "\n  window.store.clear()           reset chat",
);
