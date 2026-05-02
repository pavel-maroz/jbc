import { create } from "zustand";
import type {
  ChatMessage,
  MessageFeedback,
  ToolOperationStatus,
} from "@/types/chat";

interface ChatState {
  messages: ChatMessage[];
  fileContent: string[];
  isAgentWorking: boolean;
  abortController: AbortController | null;
  responseIndex: number;

  addMessage: (message: ChatMessage) => void;
  updateToolStatus: (
    toolCallId: string,
    status: ToolOperationStatus,
    result?: string,
  ) => void;
  updateFileContent: (content: string[]) => void;
  setAgentWorking: (working: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  setMessageFeedback: (
    messageId: string,
    feedback: MessageFeedback,
    feedbackText?: string,
  ) => void;
  setResponseIndex: (index: number) => void;
  clearMessages: () => void;
  rollbackToMessage: (messageId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  fileContent: [],
  isAgentWorking: false,
  abortController: null,
  responseIndex: 0,

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

  setAgentWorking: (working) => {
    set({ isAgentWorking: working });
  },

  setAbortController: (controller) => {
    set({ abortController: controller });
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

  setResponseIndex: (index) => {
    set({ responseIndex: index });
  },

  clearMessages: () => {
    set({ messages: [], fileContent: [], responseIndex: 0 });
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
}));
