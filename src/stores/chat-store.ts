import { create } from "zustand";
import type {
  ChatMessage,
  MessageFeedback,
  Operation,
  OperationStatus,
  ToolOperationStatus,
} from "@/types/chat";
import {
  getToolDisplayName,
  getToolTarget,
  sendMessage,
  stopAgent,
} from "@/services/mock-backend";
import { withRetry } from "@/lib/withRetry";

const MAX_ATTEMPTS = 3;

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
        anchorMessageId: userMessage.id,
        history: [],
        retryCount: 0,
      };
      set({ currentOperation: operation });

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
              const status: OperationStatus = "retrying";
              updateOperation({ status, retryCount: n - 1 });
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
        } else {
          // All retries exhausted. The dedicated failed-callout UI lands in
          // c07; for now we preserve the existing behavior and surface the
          // failure as a chat-history error message.
          get().addMessage({
            id: generateId(),
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Unknown error occurred",
            timestamp: new Date().toISOString(),
          });
        }
        clearOperation();
      }
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
