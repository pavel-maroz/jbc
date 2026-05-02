import { cn } from "@/lib/utils";

export function WorkingIndicator() {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
      <span className="ml-1">Agent is working...</span>
    </div>
  );
}
