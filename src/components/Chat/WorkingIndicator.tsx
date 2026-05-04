import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { OperationEvent } from "@/types/chat";

export interface WorkingIndicatorProps {
  label?: string;
  attempt?: { current: number; total: number };
  history?: OperationEvent[];
}

export function WorkingIndicator({
  label = "Agent is working...",
  attempt,
  history,
}: WorkingIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // The trail is only worth surfacing when there is something past the
  // first "Sending message…" / "Rolling back…" entry — a single-event
  // history is just the live label and offers nothing to expand into.
  const events = history ?? [];
  const isExpandable = events.length > 1;

  // The send stream wipes the history after every successful yield, so
  // the *same* WorkingIndicator instance can flip from expandable to
  // collapsed-only between retries. Without resetting `isOpen`, a user
  // who expanded the trail during one round-trip would see the next
  // retry's events pop open uninvited. Force-close whenever the
  // dropdown has no content to show.
  useEffect(() => {
    if (!isExpandable && isOpen) setIsOpen(false);
  }, [isExpandable, isOpen]);

  return (
    <Collapsible.Root
      open={isOpen}
      onOpenChange={setIsOpen}
      className="min-w-0"
    >
      <Collapsible.Trigger
        disabled={!isExpandable}
        className={cn(
          "group flex w-full items-center gap-1 text-xs text-muted-foreground",
          "transition-colors",
          isExpandable && "hover:text-sidebar-foreground",
          "disabled:cursor-default",
        )}
      >
        <span className="flex shrink-0 gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full bg-muted-foreground/50",
                "animate-pulse",
              )}
              style={{
                animationDelay: `${i * 200}ms`,
                animationDuration: "1s",
              }}
            />
          ))}
        </span>
        <span className="ml-1 truncate text-left">{label}</span>
        {attempt && (
          <span className="shrink-0 text-muted-foreground/70">
            (attempt {attempt.current}/{attempt.total})
          </span>
        )}
        {isExpandable && (
          <span
            className={cn(
              "ml-1 flex shrink-0 items-center overflow-hidden transition-all",
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

      {isExpandable && (
        <Collapsible.Content
          className={cn(
            "mt-1 overflow-x-auto overflow-y-auto rounded bg-muted/30",
            "max-h-64 px-3 py-1.5 text-xs text-muted-foreground",
          )}
        >
          <ul className="flex flex-col gap-0.5">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex gap-2 text-[11px] text-muted-foreground/80"
              >
                <time className="tabular-nums text-muted-foreground/60">
                  {formatTime(event.timestamp)}
                </time>
                <span className="break-words">{event.message}</span>
              </li>
            ))}
          </ul>
        </Collapsible.Content>
      )}
    </Collapsible.Root>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
