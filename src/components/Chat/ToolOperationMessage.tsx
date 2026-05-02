import * as Collapsible from "@radix-ui/react-collapsible";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { ToolOperationStatus } from "@/types/chat";

const SHIMMER_DURATION_MS = 2000;

interface ToolOperationMessageProps {
  displayName: string;
  target?: string;
  status?: ToolOperationStatus;
  description?: string;
  args?: Record<string, unknown>;
  result?: string;
}

function formatArgs(args: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    const displayValue =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
    lines.push(`${key}: ${displayValue}`);
  }
  return lines.join("\n");
}

export function ToolOperationMessage({
  displayName,
  target,
  status = "running",
  description,
  args,
  result,
}: ToolOperationMessageProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasExpandableContent = result || (args && Object.keys(args).length > 0);
  const content = result || (args && formatArgs(args)) || "";

  const shimmerDelay = useMemo(() => {
    const now = performance.now();
    const phase = now % SHIMMER_DURATION_MS;
    return `-${phase}ms`;
  }, []);

  return (
    <Collapsible.Root
      open={isOpen}
      onOpenChange={setIsOpen}
      className="min-w-0"
    >
      <Collapsible.Trigger
        className={cn(
          "group flex items-center w-full text-xs text-muted-foreground hover:text-sidebar-foreground transition-colors",
        )}
        disabled={!hasExpandableContent}
      >
        <span className="font-medium shrink min-w-0 truncate">
          {displayName}
        </span>
        {description && (
          <span
            className={cn(
              "shrink-[99999] min-w-0 truncate ml-1.5 opacity-70",
              status === "running" && "shimmer-text",
            )}
            style={
              status === "running"
                ? ({ "--shimmer-delay": shimmerDelay } as React.CSSProperties)
                : undefined
            }
          >
            {description}
          </span>
        )}
        {target && !description && (
          <span
            className={cn(
              "shrink-[99999] min-w-0 truncate ml-1.5 opacity-70",
              status === "running" && "shimmer-text",
            )}
            style={
              status === "running"
                ? ({ "--shimmer-delay": shimmerDelay } as React.CSSProperties)
                : undefined
            }
          >
            {target}
          </span>
        )}
        {hasExpandableContent && (
          <span
            className={cn(
              "flex items-center shrink-0 overflow-hidden transition-all ml-1",
              isOpen
                ? "w-3 opacity-100"
                : "w-0 opacity-0 group-hover:w-3 group-hover:opacity-100",
            )}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 transition-transform",
                isOpen && "rotate-90",
              )}
            />
          </span>
        )}
      </Collapsible.Trigger>
      {hasExpandableContent && (
        <Collapsible.Content className="py-1.5 pl-5 text-muted-foreground text-xs font-mono bg-muted/30 rounded mt-1 overflow-x-auto max-h-64 overflow-y-auto">
          <pre className="whitespace-pre-wrap">
            <span className="break-all">{content}</span>
          </pre>
        </Collapsible.Content>
      )}
    </Collapsible.Root>
  );
}
