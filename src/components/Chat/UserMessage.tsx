import { Pencil, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";
import type { UserMessage as UserMessageType } from "@/types/chat";
import { ConfirmPopover } from "./ConfirmPopover";

interface UserMessageProps {
  message: UserMessageType;
}

export function UserMessage({ message }: UserMessageProps) {
  const currentOperation = useChatStore((s) => s.currentOperation);
  const startRollback = useChatStore((s) => s.startRollback);
  const submitEdit = useChatStore((s) => s.submitEdit);
  const mutedFromMessageId = useChatStore((s) => s.mutedFromMessageId);

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOperationActive = currentOperation !== null;

  const isMuteBoundary = message.id === mutedFromMessageId;

  useEffect(() => {
    if (!editing) return;
    const id = requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
    return () => cancelAnimationFrame(id);
  }, [editing]);

  const enterEdit = () => {
    setDraft(message.content);
    setEditing(true);
  };

  const exitEdit = () => {
    setReplaceConfirmOpen(false);
    setEditing(false);
    setDraft(message.content);
  };

  const tryCommitDraft = () => {
    const next = draft.trim();
    const prev = message.content.trim();
    if (next === "" || next === prev) {
      exitEdit();
      return;
    }
    setReplaceConfirmOpen(true);
  };

  const bubble = (
    <div
      className={cn(
        "border border-border bg-sidebar-accent rounded-lg px-3 py-1.5 min-w-0",
        editing && "ring-1 ring-ring/60",
        !editing && !isOperationActive && "cursor-pointer",
      )}
      onClick={() => {
        if (!editing && !isOperationActive) enterEdit();
      }}
    >
      {editing ? (
        <>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={isOperationActive}
            rows={3}
            aria-label="Message text"
            className={cn(
              "w-full min-h-[4.5rem] max-h-52 resize-y bg-transparent",
              "text-sm text-sidebar-foreground placeholder:text-muted-foreground",
              "outline-none focus-visible:outline-none",
              "disabled:opacity-50",
            )}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                if (replaceConfirmOpen) {
                  setReplaceConfirmOpen(false);
                } else {
                  exitEdit();
                }
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                tryCommitDraft();
              }
            }}
          />
          <p className="mt-1.5 text-[10px] text-muted-foreground/90 leading-snug">
            Enter to replace · Shift+Enter newline · Esc to cancel
          </p>
        </>
      ) : (
        <span className="text-sm text-sidebar-foreground whitespace-pre-wrap">
          {message.content}
        </span>
      )}
    </div>
  );

  return (
    <div className="group/user relative">
      <ConfirmPopover
        open={replaceConfirmOpen}
        onOpenChange={setReplaceConfirmOpen}
        anchor={bubble}
        description="Replace this and discard later changes?"
        confirmLabel="Replace"
        destructive
        onConfirm={() => {
          void submitEdit(message.id, draft);
          exitEdit();
        }}
      />

      <div
        className={cn(
          "absolute -top-3 right-2 flex items-center gap-1",
          "opacity-0 group-hover/user:opacity-100",
          "transition-opacity",
          (rollbackOpen || editing || replaceConfirmOpen) && "opacity-100",
        )}
      >
        {editing ? (
          <button
            type="button"
            onClick={() => exitEdit()}
            disabled={isOperationActive}
            aria-label="Cancel editing"
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs",
              "border border-border bg-background text-muted-foreground",
              "shadow-sm",
              "hover:bg-muted/40 hover:text-foreground",
              "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-muted-foreground",
              "transition-colors",
            )}
          >
            Cancel
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={enterEdit}
              disabled={isOperationActive}
              aria-label="Edit message"
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs",
                "border border-border bg-background text-muted-foreground",
                "shadow-sm",
                "hover:bg-muted/40 hover:text-foreground",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-muted-foreground",
                "transition-colors",
              )}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>

            {!isMuteBoundary && (
              <ConfirmPopover
                open={rollbackOpen}
                onOpenChange={setRollbackOpen}
                description="Roll back this and later changes?"
                confirmLabel="Roll back"
                destructive
                onConfirm={() => {
                  void startRollback(message.id);
                }}
                trigger={
                  <button
                    type="button"
                    disabled={isOperationActive}
                    aria-label="Roll back to this message"
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs",
                      "border border-border bg-background text-muted-foreground",
                      "shadow-sm",
                      "hover:bg-muted/40 hover:text-foreground",
                      "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-background disabled:hover:text-muted-foreground",
                      "transition-colors",
                    )}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Rollback
                  </button>
                }
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
