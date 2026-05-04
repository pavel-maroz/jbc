import { create } from "zustand";
import type {
  ChatMessage,
  MessageFeedback,
  Operation,
  ToolOperationStatus,
} from "@/types/chat";
import {
  getResponseCount,
  getToolDisplayName,
  getToolTarget,
  rollbackToMessage as rollbackToMessageService,
  sendMessage,
  stopAgent,
} from "@/services/mock-backend";
import { withRetry } from "@/lib/withRetry";

export const MAX_ATTEMPTS = 3;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * AbortController is intentionally module-scope rather than store state:
 * it isn't serializable, swapping it shouldn't trigger UI re-renders, and
 * keeping it outside zustand prevents accidental subscriptions to controller
 * identity. The store exposes interruptCurrentOperation() as the only way
 * to interact with it.
 */
let activeController: AbortController | null = null;

interface ChatState {
  messages: ChatMessage[];
  fileContent: string[];
  responseIndex: number;
  currentOperation: Operation | null;
  /**
   * Id of the first message in the muted suffix (everything from this
   * message to the end of `messages` is rolled back but kept around for
   * recoverability). `null` means there is no muted suffix.
   *
   * Invariant: muted zone is always a contiguous suffix; we never have a
   * muted segment in the middle of the active history.
   */
  mutedFromMessageId: string | null;

  addMessage: (message: ChatMessage) => void;
  updateToolStatus: (
    toolCallId: string,
    status: ToolOperationStatus,
    result?: string,
  ) => void;
  updateFileContent: (content: string[]) => void;
  setMessageFeedback: (
    messageId: string,
    feedback: MessageFeedback,
    feedbackText?: string,
  ) => void;
  clearMessages: () => void;

  appendUserMessage: (text: string) => Promise<void>;
  startRollback: (targetMessageId: string) => Promise<void>;
  submitEdit: (messageId: string, newText: string) => Promise<void>;
  interruptCurrentOperation: () => Promise<void>;
  retryCurrentOperation: () => Promise<void>;
  cancelCurrentOperation: () => void;
}

export const useChatStore = create<ChatState>((set, get) => {
  const appendOperationEvent = (message: string) => {
    set((state) => {
      if (!state.currentOperation) return {};
      return {
        currentOperation: {
          ...state.currentOperation,
          history: [
            ...state.currentOperation.history,
            {
              id: generateId(),
              timestamp: new Date().toISOString(),
              message,
            },
          ],
        },
      };
    });
  };

  const updateOperation = (
    patch: Partial<Pick<Operation, "status" | "retryCount">>,
  ) => {
    set((state) => {
      if (!state.currentOperation) return {};
      return {
        currentOperation: { ...state.currentOperation, ...patch },
      };
    });
  };

  const clearOperation = () => {
    activeController = null;
    set({ currentOperation: null });
  };

  /**
   * Re-derive responseIndex from the active prefix of the message history.
   *
   * Invariant kept by all store actions:
   *   responseIndex === count(agent_message + tool_operation in active prefix)
   *                    mod HARDCODED_RESPONSES.length
   *
   * Without this recompute after a rollback, the mock would keep counting
   * from where it left off and the next send would resume in the middle of
   * the scripted scenario instead of replaying it from the rollback point.
   */
  const recomputeResponseIndex = (
    messages: ChatMessage[],
    mutedFromId: string | null,
  ): number => {
    const total = getResponseCount();
    let count = 0;
    for (const msg of messages) {
      if (mutedFromId && msg.id === mutedFromId) break;
      if (msg.type === "agent_message" || msg.type === "tool_operation") {
        count++;
      }
    }
    return total > 0 ? count % total : 0;
  };

  /**
   * Drive the current "send" operation through withRetry. Used both by the
   * initial appendUserMessage and by user-triggered retryCurrentOperation,
   * so they share identical retry/abort/failure semantics.
   *
   * On exhausted retries the operation is left in `failed` state so the UI
   * can render a callout with Retry / Cancel actions; nothing is added to
   * chat history. On abort (Stop) we add a single "Agent stopped by user"
   * message and clear the operation.
   */
  const runSendOperation = async (): Promise<void> => {
    const controller = new AbortController();
    activeController = controller;

    try {
      await withRetry(runSendStream, {
        signal: controller.signal,
        maxAttempts: MAX_ATTEMPTS,
        onAttempt: (n) => {
          if (n === 1) {
            appendOperationEvent("Sending message...");
          } else {
            updateOperation({ status: "retrying", retryCount: n - 1 });
            appendOperationEvent(
              `Reconnecting (attempt ${n} of ${MAX_ATTEMPTS})...`,
            );
          }
        },
        onError: (n, err) => {
          appendOperationEvent(`Attempt ${n} failed: ${err.message}`);
        },
      });

      clearOperation();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        get().addMessage({
          id: generateId(),
          type: "error",
          message: "Agent stopped by user",
          timestamp: new Date().toISOString(),
        });
        clearOperation();
      } else {
        // All retries exhausted: keep the operation around as `failed` so the
        // MessageList can render an inline callout with Retry/Cancel.
        updateOperation({ status: "failed", retryCount: MAX_ATTEMPTS });
        activeController = null;
      }
    }
  };

  /**
   * Drive rollback (`rollback` | `edit` phase A) through withRetry. Used by
   * startRollback, submitEdit, and retryCurrentOperation so retry/abort
   * semantics stay unified. Optimistic mute is applied before this runs.
   *
   * On success — plain rollback clears the operation; edit commits file state,
   * clears the edit operation, then `appendUserMessage(pendingText)` burns the
   * muted suffix (including the old user bubble) and starts send. On abort we
   * revert optimistic mute. On exhausted retries we leave the operation
   * `failed` for the inline callout.
   */
  const runRollbackOperation = async (): Promise<void> => {
    const op = get().currentOperation;
    if (!op || !op.anchorMessageId) return;
    if (op.type !== "rollback" && op.type !== "edit") return;
    const targetId = op.anchorMessageId;

    const controller = new AbortController();
    activeController = controller;

    try {
      const result = await withRetry(
        (signal) => rollbackToMessageService(targetId, get().messages, signal),
        {
          signal: controller.signal,
          maxAttempts: MAX_ATTEMPTS,
          onAttempt: (n) => {
            if (n === 1) {
              appendOperationEvent(
                op.type === "edit" ? "Applying edit..." : "Rolling back...",
              );
            } else {
              updateOperation({ status: "retrying", retryCount: n - 1 });
              appendOperationEvent(
                `Reconnecting (attempt ${n} of ${MAX_ATTEMPTS})...`,
              );
            }
          },
          onError: (n, err) => {
            appendOperationEvent(`Attempt ${n} failed: ${err.message}`);
          },
        },
      );

      const messages = get().messages;
      const targetIndex = messages.findIndex((m) => m.id === targetId);
      if (targetIndex === -1) {
        // Target was removed in the meantime (very unlikely — we block other
        // operations while this one runs, but keep a defensive bail-out).
        // Revert the optimistic mute boundary so we don't leave a stale
        // suffix pointing at a missing id.
        set({
          mutedFromMessageId: op.previousMutedFromMessageId ?? null,
        });
        clearOperation();
        return;
      }

      // mutedFromMessageId was already set optimistically in startRollback /
      // submitEdit. Here we only commit fileContent and resync responseIndex.
      set({
        fileContent: result.fileContent,
        responseIndex: recomputeResponseIndex(messages, targetId),
      });

      const pendingText =
        op.type === "edit" ? (op.pendingText ?? "").trim() : "";

      clearOperation();

      if (op.type === "edit" && pendingText.length > 0) {
        await get().appendUserMessage(pendingText);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // Stop = user pulled out — undo the optimistic mute so the chat
        // returns to the pre-rollback state. fileContent was never touched.
        set({
          mutedFromMessageId: op.previousMutedFromMessageId ?? null,
        });
        clearOperation();
      } else {
        // All retries exhausted: leave the optimistic mute in place so
        // the user sees what's about to be discarded. They can Retry to
        // try again or Cancel to roll the boundary back to its prior
        // value (handled in cancelCurrentOperation).
        updateOperation({ status: "failed", retryCount: MAX_ATTEMPTS });
        activeController = null;
      }
    }
  };

  /**
   * One pass through the mock generator. Idempotent across retries: errors
   * in mock-backend.sendMessage are thrown BEFORE yield, so each successful
   * yield permanently advances responseIndex and never repeats.
   */
  const runSendStream = async (signal: AbortSignal): Promise<void> => {
    const generator = sendMessage(
      get().responseIndex,
      get().fileContent.length,
      false,
      signal,
    );

    for await (const {
      response,
      fileContent: newFile,
      newIndex,
    } of generator) {
      set({ responseIndex: newIndex });

      // First successful yield after a retry — flip status back to "running"
      // so the indicator stops showing "Reconnecting (attempt N of M)..."
      // once data starts flowing again.
      const op = get().currentOperation;
      if (op && op.status === "retrying") {
        updateOperation({ status: "running" });
        appendOperationEvent("Reconnected.");
      }

      if (response.type === "text") {
        get().addMessage({
          id: generateId(),
          type: "agent_message",
          content: response.content,
          timestamp: new Date().toISOString(),
        });
      } else if (response.type === "tool_call") {
        const toolCallId = generateId();
        get().addMessage({
          id: generateId(),
          type: "tool_operation",
          toolCallId,
          toolName: response.tool,
          displayName: getToolDisplayName(response.tool),
          target: getToolTarget(response.tool, response.args),
          status: "running",
          args: response.args,
          timestamp: new Date().toISOString(),
          fileContent: newFile,
        });

        const toolDelay = response.tool === "run_test" ? 5000 : 300;
        await new Promise((resolve) => setTimeout(resolve, toolDelay));

        get().updateToolStatus(toolCallId, "completed", response.result);

        if (newFile) {
          get().updateFileContent(newFile);
        }
      }
    }
  };

  return {
    messages: [],
    fileContent: [],
    responseIndex: 0,
    currentOperation: null,
    mutedFromMessageId: null,

    addMessage: (message) => {
      set((state) => ({
        messages: [...state.messages, message],
      }));
    },

    updateToolStatus: (toolCallId, status, result) => {
      set((state) => ({
        messages: state.messages.map((msg) => {
          if (msg.type === "tool_operation" && msg.toolCallId === toolCallId) {
            return { ...msg, status, result: result ?? msg.result };
          }
          return msg;
        }),
      }));
    },

    updateFileContent: (content) => {
      set({ fileContent: content });
    },

    setMessageFeedback: (messageId, feedback, feedbackText) => {
      set((state) => ({
        messages: state.messages.map((msg) => {
          if (msg.id === messageId && msg.type === "agent_message") {
            return { ...msg, feedback, feedbackText };
          }
          return msg;
        }),
      }));
    },

    clearMessages: () => {
      activeController = null;
      set({
        messages: [],
        fileContent: [],
        responseIndex: 0,
        currentOperation: null,
        mutedFromMessageId: null,
      });
    },

    appendUserMessage: async (text) => {
      // Burning the muted suffix on a new user message is irreversible —
      // it's the explicit signal that the user accepts the post-rollback
      // state as the new point of growth.
      const { messages, mutedFromMessageId } = get();
      let baseMessages = messages;
      if (mutedFromMessageId) {
        const cutIndex = messages.findIndex(
          (m) => m.id === mutedFromMessageId,
        );
        if (cutIndex !== -1) {
          baseMessages = messages.slice(0, cutIndex);
        }
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        type: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      set({
        messages: [...baseMessages, userMessage],
        mutedFromMessageId: null,
      });

      const operation: Operation = {
        id: generateId(),
        type: "send",
        status: "running",
        // No anchorMessageId for send: the MessageList fallback renders the
        // indicator at the end of the list, so it naturally stays below each
        // newly streamed response instead of being pinned under the user
        // message. Rollback/edit will set anchorMessageId explicitly.
        history: [],
        retryCount: 0,
      };
      set({ currentOperation: operation });

      await runSendOperation();
    },

    startRollback: async (targetMessageId: string) => {
      // Block when something else is in flight; UI also disables the
      // trigger, but this guard makes the action safe to call directly.
      if (get().currentOperation !== null) return;

      const { messages, mutedFromMessageId: previousMuted } = get();
      if (!messages.some((m) => m.id === targetMessageId)) return;

      const operation: Operation = {
        id: generateId(),
        type: "rollback",
        status: "running",
        anchorMessageId: targetMessageId,
        history: [],
        retryCount: 0,
        previousMutedFromMessageId: previousMuted,
      };

      // Optimistic mute: flip the boundary the instant the user confirms,
      // so the target and everything after it visibly fade before the
      // service round-trip completes. fileContent and responseIndex stay
      // untouched until success — they can only change once the service
      // returns the new file. On Stop or Cancel-from-failed we restore
      // the boundary from `previousMutedFromMessageId`.
      set({
        currentOperation: operation,
        mutedFromMessageId: targetMessageId,
      });

      await runRollbackOperation();
    },

    submitEdit: async (messageId: string, newText: string) => {
      if (get().currentOperation !== null) return;

      const trimmed = newText.trim();
      if (trimmed === "") return;

      const { messages, mutedFromMessageId: previousMuted } = get();
      const target = messages.find((m) => m.id === messageId);
      if (!target || target.type !== "user") return;
      if (trimmed === target.content.trim()) return;

      const operation: Operation = {
        id: generateId(),
        type: "edit",
        status: "running",
        anchorMessageId: messageId,
        pendingText: trimmed,
        history: [],
        retryCount: 0,
        previousMutedFromMessageId: previousMuted,
      };

      set({
        currentOperation: operation,
        mutedFromMessageId: messageId,
      });

      await runRollbackOperation();
    },

    retryCurrentOperation: async () => {
      const op = get().currentOperation;
      if (!op || op.status !== "failed") return;

      // Reset to running for a fresh attempt; keep accumulated history so the
      // user can still expand it and see prior failures.
      updateOperation({ status: "running", retryCount: 0 });
      appendOperationEvent("Retrying...");

      switch (op.type) {
        case "send":
          await runSendOperation();
          break;
        case "rollback":
          await runRollbackOperation();
          break;
        case "edit":
          await runRollbackOperation();
          break;
      }
    },

    cancelCurrentOperation: () => {
      const op = get().currentOperation;
      if (!op || op.status !== "failed") return;
      // For rollback (and future edit) the mute boundary was applied
      // optimistically at startRollback; on Cancel-from-failed we have
      // to undo it so the user lands back in the pre-rollback state.
      if (op.type === "rollback" || op.type === "edit") {
        set({
          mutedFromMessageId: op.previousMutedFromMessageId ?? null,
        });
      }
      clearOperation();
    },

    interruptCurrentOperation: async () => {
      if (activeController) {
        /**
         * INTENTIONAL BUG: 800ms delay before abort makes Stop feel sluggish.
         * Preserved verbatim from the previous handleInterrupt in App.tsx.
         */
        await new Promise((resolve) => setTimeout(resolve, 800));
        activeController.abort();
      }

      try {
        await stopAgent();
      } catch {
        // Ignore stop errors
      }
    },
  };
});
