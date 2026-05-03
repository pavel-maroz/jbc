import { useState } from "react";
import { ChevronRight } from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);
  const hasHistory = !!history && history.length > 0;

  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full bg-muted-foreground/50",
                "animate-pulse",
              )}
              style={{
                animationDelay: `${i * 200}ms`,
                animationDuration: "1s",
              }}
            />
          ))}
        </span>
        <span className="ml-1">{label}</span>
        {attempt && (
          <span className="ml-1 text-muted-foreground/70">
            (attempt {attempt.current}/{attempt.total})
          </span>
        )}
        {hasHistory && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide history" : "Show history"}
            className={cn(
              "ml-1 inline-flex items-center justify-center",
              "rounded hover:bg-muted-foreground/10",
              "h-4 w-4 transition-colors",
            )}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>
        )}
      </div>

      {hasHistory && expanded && (
        <ul className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-muted-foreground/20 pl-2">
          {history!.map((event) => (
            <li
              key={event.id}
              className="flex gap-2 text-[11px] text-muted-foreground/80"
            >
              <time className="tabular-nums text-muted-foreground/60">
                {formatTime(event.timestamp)}
              </time>
              <span>{event.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
