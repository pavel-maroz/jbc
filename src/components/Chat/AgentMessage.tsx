import type { AgentTextMessage } from "@/types/chat";
import { Markdown } from "./Markdown";

interface AgentMessageProps {
  message: AgentTextMessage;
}

export function AgentMessage({ message }: AgentMessageProps) {
  return (
    <div className="min-w-0">
      <Markdown
        content={message.content}
        className="text-sidebar-foreground text-sm"
      />
    </div>
  );
}
