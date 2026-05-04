import { Send, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAutoGrowTextarea } from "@/hooks/useAutoGrowTextarea";
import { useChatStore } from "@/stores/chat-store";
import type { UserMessage as UserMessageType } from "@/types/chat";
import { ConfirmPopover } from "./ConfirmPopover";

interface UserMessageProps {
  message: UserMessageType;
}

const EDIT_MIN_LINES = 2;
const EDIT_MAX_LINES = 8;

export function UserMessage({ message }: UserMessageProps) {
  const currentOperation = useChatStore((s) => s.currentOperation);
  const startRollback = useChatStore((s) => s.startRollback);
  const submitEdit = useChatStore((s) => s.submitEdit);
  const mutedFromMessageId = useChatStore((s) => s.mutedFromMessageId);

  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false);

  const {
    ref: textareaRef,
    element: textareaEl,
    onInput: handleInput,
    minHeight,
  } = useAutoGrowTextarea({
    minLines: EDIT_MIN_LINES,
    maxLines: EDIT_MAX_LINES,
  });

  const isOperationActive = currentOperation !== null;
  const isMuteBoundary = message.id === mutedFromMessageId;

  // When entering edit-mode the textarea isn't in the DOM yet, so we
  // wait one frame to focus it, place the caret at the end, and run a
  // first auto-grow pass so the box matches the current content height
  // instead of starting at minHeight and "popping" on the first keystroke.
  useEffect(() => {
    if (!editing) return;
    const id = requestAnimationFrame(() => {
      const el = textareaEl.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      handleInput();
    });
    return () => cancelAnimationFrame(id);
  }, [editing, handleInput, textareaEl]);

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

  const canSubmit =
    !isOperationActive &&
    draft.trim().length > 0 &&
    draft.trim() !== message.content.trim();

  return (
    <div
      className={cn(
        "group/user relative bg-sidebar-accent rounded-lg min-w-0",
        "border border-transparent transition-colors",
        !isOperationActive &&
          "hover:border-input-border focus-within:border-input-border-focus",
        !editing && !isOperationActive && "cursor-text",
        "px-3 py-1.5",
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
            onInput={handleInput}
            disabled={isOperationActive}
            style={{ minHeight }}
            aria-label="Message text"
            className={cn(
              "w-full resize-none bg-transparent px-0 py-0.5",
              "text-sm leading-5 text-sidebar-foreground placeholder:text-muted-foreground",
              "focus:outline-none",
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
          <div className="flex items-center justify-end gap-2 pt-1 mb-0.5 -mr-1">
            <button
              type="button"
              onClick={() => exitEdit()}
              disabled={isOperationActive}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm",
                "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
                "transition-colors",
              )}
            >
              Cancel
            </button>
            <ConfirmPopover
              open={replaceConfirmOpen}
              onOpenChange={setReplaceConfirmOpen}
              description="Replace this and discard later changes?"
              confirmLabel="Replace"
              destructive
              onConfirm={() => {
                void submitEdit(message.id, draft);
                exitEdit();
              }}
              anchor={
                <button
                  type="button"
                  onClick={tryCommitDraft}
                  disabled={!canSubmit}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm",
                    "bg-primary text-primary-foreground",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "transition-colors",
                  )}
                >
                  <Send className="h-3.5 w-3.5" />
                  Send
                </button>
              }
            />
          </div>
        </>
      ) : (
        <>
          <span className="text-sm text-sidebar-foreground whitespace-pre-wrap">
            {message.content}
          </span>

          {!isMuteBoundary && !isOperationActive && (
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
                  aria-label="Roll back to this message"
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "absolute bottom-1.5 right-1.5",
                    "h-6 w-6 rounded-md flex items-center justify-center",
                    "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    "transition-colors",
                    "opacity-0 group-hover/user:opacity-100",
                    rollbackOpen && "opacity-100",
                  )}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
              }
            />
          )}
        </>
      )}
    </div>
  );
}
