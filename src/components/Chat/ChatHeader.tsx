import { Bot, RotateCcw } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { useCallback } from "react";

export function ChatHeader() {
  const clearMessages = useChatStore((s) => s.clearMessages);
  const messagesCount = useChatStore((s) => s.messages.length);

  const handleNewChat = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-sidebar-primary" />
        <span className="text-sm font-semibold text-sidebar-foreground">
          AI Coding Agent
        </span>
      </div>
      {messagesCount > 0 && (
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          New Chat
        </button>
      )}
    </div>
  );
}
