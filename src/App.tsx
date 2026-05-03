import { ChatInput, MessageList } from "@/components/Chat";
import { ChatHeader } from "@/components/Chat/ChatHeader";
import { MockEditor } from "@/components/Editor";
import { useChatStore } from "@/stores/chat-store";

export default function App() {
  const messages = useChatStore((s) => s.messages);
  const currentOperation = useChatStore((s) => s.currentOperation);
  const appendUserMessage = useChatStore((s) => s.appendUserMessage);
  const interruptCurrentOperation = useChatStore(
    (s) => s.interruptCurrentOperation,
  );

  const isAgentWorking =
    currentOperation !== null && currentOperation.status !== "failed";

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
          onSubmit={appendUserMessage}
          isAgentWorking={isAgentWorking}
          onInterrupt={interruptCurrentOperation}
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
