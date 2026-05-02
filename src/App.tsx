import { ChatInput, MessageList } from "@/components/Chat";
import { ChatHeader } from "@/components/Chat/ChatHeader";
import { MockEditor } from "@/components/Editor";
import {
  getToolDisplayName,
  getToolTarget,
  sendMessage,
  stopAgent,
} from "@/services/mock-backend";
import { useChatStore } from "@/stores/chat-store";
import type { ChatMessage } from "@/types/chat";
import { useCallback } from "react";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const messages = useChatStore((s) => s.messages);
  const fileContent = useChatStore((s) => s.fileContent);
  const isAgentWorking = useChatStore((s) => s.isAgentWorking);
  const responseIndex = useChatStore((s) => s.responseIndex);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateToolStatus = useChatStore((s) => s.updateToolStatus);
  const updateFileContent = useChatStore((s) => s.updateFileContent);
  const setAgentWorking = useChatStore((s) => s.setAgentWorking);
  const setAbortController = useChatStore((s) => s.setAbortController);
  const setResponseIndex = useChatStore((s) => s.setResponseIndex);
  const abortController = useChatStore((s) => s.abortController);

  const handleSubmit = useCallback(
    async (text: string) => {
      const userMessage: ChatMessage = {
        id: generateId(),
        type: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      addMessage(userMessage);

      /**
       * INTENTIONAL BUG: No loading indicator shown immediately after sending.
       * User has no feedback that agent is working for up to 1-5 seconds.
       * This is a known issue for candidates to identify.
       */
      const controller = new AbortController();
      setAbortController(controller);
      setAgentWorking(true);

      try {
        const generator = sendMessage(
          responseIndex,
          fileContent.length,
          false,
          controller.signal,
        );

        for await (const { response, fileContent, newIndex } of generator) {
          setResponseIndex(newIndex);

          if (response.type === "text") {
            const agentMessage: ChatMessage = {
              id: generateId(),
              type: "agent_message",
              content: response.content,
              timestamp: new Date().toISOString(),
            };
            addMessage(agentMessage);
          } else if (response.type === "tool_call") {
            const toolCallId = generateId();
            const toolMessage: ChatMessage = {
              id: generateId(),
              type: "tool_operation",
              toolCallId,
              toolName: response.tool,
              displayName: getToolDisplayName(response.tool),
              target: getToolTarget(response.tool, response.args),
              status: "running",
              args: response.args,
              timestamp: new Date().toISOString(),
              fileContent: fileContent,
            };
            addMessage(toolMessage);

            const toolDelay = response.tool === "run_test" ? 5000 : 300;
            await new Promise((resolve) => setTimeout(resolve, toolDelay));

            updateToolStatus(toolCallId, "completed", response.result);

            if (fileContent) {
              updateFileContent(fileContent);
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          const cancelMessage: ChatMessage = {
            id: generateId(),
            type: "error",
            message: "Agent stopped by user",
            timestamp: new Date().toISOString(),
          };
          addMessage(cancelMessage);
        } else {
          const errorMessage: ChatMessage = {
            id: generateId(),
            type: "error",
            message:
              error instanceof Error ? error.message : "Unknown error occurred",
            timestamp: new Date().toISOString(),
          };
          addMessage(errorMessage);
        }
      } finally {
        setAgentWorking(false);
        setAbortController(null);
      }
    },
    [
      addMessage,
      updateToolStatus,
      updateFileContent,
      setAgentWorking,
      setAbortController,
      responseIndex,
      setResponseIndex,
      fileContent.length,
    ],
  );

  const handleInterrupt = useCallback(async () => {
    if (abortController) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      abortController.abort();
    }

    try {
      await stopAgent();
    } catch {
      // Ignore stop errors
    }
  }, [abortController]);

  return (
    <div className="h-screen flex">
      {/* 
        Chat panel - 30% width but can shrink to 0
        INTENTIONAL BUG: min-w-0 allows shrinking when editor has fixed min-width
        This is a known issue for candidates to identify.
      */}
      <div className="w-[30%] min-w-0 flex flex-col bg-sidebar border-r border-sidebar-border">
        <ChatHeader />
        <MessageList messages={messages} isAgentWorking={isAgentWorking} />
        <ChatInput
          onSubmit={handleSubmit}
          isAgentWorking={isAgentWorking}
          onInterrupt={handleInterrupt}
        />
      </div>

      {/* 
        Editor panel - fixed minimum width
        INTENTIONAL BUG: min-w-[400px] causes chat panel to shrink on narrow viewports
        This is a known issue for candidates to identify.
      */}
      <div className="flex-1 min-w-[400px] bg-background">
        <MockEditor />
      </div>
    </div>
  );
}
