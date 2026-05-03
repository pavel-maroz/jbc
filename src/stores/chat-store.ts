import { create } from "zustand";
import type {
  ChatMessage,
  MessageFeedback,
  Operation,
  ToolOperationStatus,
} from "@/types/chat";
import {
  getToolDisplayName,
  getToolTarget,
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
  /**
   * Legacy synchronous rollback used by ChatHeader. Will be replaced by an
   * async startRollback action in c08 alongside the muted-zone work.
   */
  rollbackToMessage: (messageId: string) => void;

  appendUserMessage: (text: string) => Promise<void>;
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
      });
    },

    rollbackToMessage: (messageId) => {
      const { messages } = get();
      const index = messages.findIndex((m) => m.id === messageId);
      if (index === -1) return;

      const newMessages = messages.slice(0, index + 1);

      let newFileContent: string[] = [];
      for (let i = newMessages.length - 1; i >= 0; i--) {
        const msg = newMessages[i];
        if (
          msg.type === "tool_operation" &&
          msg.toolName === "edit_file" &&
          msg.status === "completed" &&
          msg.fileContent
        ) {
          newFileContent = msg.fileContent;
          break;
        }
      }

      set({
        messages: newMessages,
        fileContent: newFileContent,
      });
    },

    appendUserMessage: async (text) => {
      const userMessage: ChatMessage = {
        id: generateId(),
        type: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      get().addMessage(userMessage);

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

    retryCurrentOperation: async () => {
      const op = get().currentOperation;
      if (!op || op.status !== "failed") return;

      // Currently only the send operation can be retried. Rollback/edit retry
      // wiring lands in c08/c12 alongside their respective actions.
      if (op.type !== "send") return;

      // Reset to running for a fresh attempt; keep accumulated history so the
      // user can still expand it and see prior failures.
      updateOperation({ status: "running", retryCount: 0 });
      appendOperationEvent("Retrying...");

      await runSendOperation();
    },

    cancelCurrentOperation: () => {
      const op = get().currentOperation;
      if (!op || op.status !== "failed") return;
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
