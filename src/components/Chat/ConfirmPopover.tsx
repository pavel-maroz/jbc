import type { ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export interface ConfirmPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * If true, the confirm button is rendered with a destructive (red) intent.
   * Use for irreversible actions (rollback, edit submit).
   */
  destructive?: boolean;
  onConfirm: () => void;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export function ConfirmPopover({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  side = "top",
  align = "end",
}: ConfirmPopoverProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "z-50 w-72 rounded-md border bg-popover p-3 text-popover-foreground shadow-md",
            "outline-none",
          )}
        >
          {title && (
            <p className="mb-1 text-sm font-medium">{title}</p>
          )}
          <p className="text-xs text-muted-foreground">{description}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md",
                "border border-border text-foreground",
                "hover:bg-muted/40 transition-colors",
              )}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                destructive
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {confirmLabel}
            </button>
          </div>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
