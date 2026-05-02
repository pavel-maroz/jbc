import type { UserMessage as UserMessageType } from "@/types/chat";

interface UserMessageProps {
  message: UserMessageType;
}

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="border border-border bg-sidebar-accent rounded-lg px-3 py-1.5">
      <span className="text-sm text-sidebar-foreground whitespace-pre-wrap">
        {message.content}
      </span>
    </div>
  );
}
