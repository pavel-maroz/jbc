import { cn } from "@/lib/utils";
import { ArrowDown } from "lucide-react";

interface ScrollToBottomButtonProps {
  visible: boolean;
  onClick: () => void;
}

export function ScrollToBottomButton({
  visible,
  onClick,
}: ScrollToBottomButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2",
        "flex items-center gap-1.5 px-3 py-1.5",
        "bg-sidebar-accent border border-border rounded-full",
        "text-xs text-sidebar-foreground",
        "shadow-lg",
        "transition-all duration-200",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2 pointer-events-none",
      )}
    >
      <ArrowDown className="h-3 w-3" />
      <span>New messages</span>
    </button>
  );
}
