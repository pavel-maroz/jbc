import { ScrollArea } from "@/components/ui/scroll-area";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { cn } from "@/lib/utils";
import { MAX_ATTEMPTS, useChatStore } from "@/stores/chat-store";
import type {
  AgentTextMessage,
  ChatMessage,
  ErrorMessage as ErrorMessageType,
  Operation,
  ToolOperationMessage as ToolOperationMessageType,
} from "@/types/chat";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentMessage } from "./AgentMessage";
import { ConfirmPopover } from "./ConfirmPopover";
import { ErrorMessage } from "./ErrorMessage";
import { FeedbackForm } from "./FeedbackForm";
import { ToolOperationMessage } from "./ToolOperationMessage";
import { UserMessage } from "./UserMessage";
import { WorkingIndicator } from "./WorkingIndicator";
import { ScrollToBottomButton } from "./ScrollToBottomButton";

/**
 * Visual styling applied to messages inside the muted suffix (everything
 * from `mutedFromMessageId` to the end). Recoverability is preserved:
 * partial de-muting via rollback to a muted message restores opacity, and
 * a new user message burns the suffix entirely.
 *
 * Single-property treatment (`opacity-50`) is intentional: the muted
 * suffix always starts at a clearly recognizable user-message bubble,
 * so the visual delimiter is built-in and an extra border/divider only
 * adds noise. The `transition-opacity` keeps boundary changes smooth
 * (rollback success, partial de-muting, or burn on new user message).
 */
const MUTED_WRAPPER_CLASSES = "opacity-50 transition-opacity";

interface MessageListProps {
  messages: ChatMessage[];
}

function isToolCallMessage(message: ChatMessage): boolean {
  return message.type === "tool_operation";
}

interface OperationCopy {
  runningLabel: string;
  retryingLabel: string;
  failedTitle: string;
  failedDescription: string;
}

function getOperationCopy(type: Operation["type"]): OperationCopy {
  switch (type) {
    case "send":
      return {
        runningLabel: "Agent is working...",
        retryingLabel: "Reconnecting...",
        failedTitle: "Couldn't send message",
        failedDescription:
          "We couldn't reach the agent after several attempts.",
      };
    case "rollback":
      return {
        runningLabel: "Rolling back...",
        retryingLabel: "Reconnecting...",
        failedTitle: "Couldn't roll back",
        failedDescription:
          "We couldn't restore the file after several attempts.",
      };
    case "edit":
      return {
        runningLabel: "Updating message...",
        retryingLabel: "Reconnecting...",
        failedTitle: "Couldn't apply edit",
        failedDescription:
          "We couldn't update the message after several attempts.",
      };
  }
}

function OperationStatus({
  operation,
  onRetry,
  onCancel,
}: {
  operation: Operation;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const copy = getOperationCopy(operation.type);

  if (operation.status === "failed") {
    return (
      <ErrorMessage
        title={copy.failedTitle}
        description={copy.failedDescription}
        actions={{ onRetry, onCancel, retryLabel: "Retry", cancelLabel: "Cancel" }}
      />
    );
  }

  const isRetrying = operation.status === "retrying";
  return (
    <WorkingIndicator
      label={isRetrying ? copy.retryingLabel : copy.runningLabel}
      attempt={
        isRetrying
          ? { current: operation.retryCount + 1, total: MAX_ATTEMPTS }
          : undefined
      }
      history={operation.history}
    />
  );
}

/**
 * In-place "Undo rollback" affordance. Lives in the same slot a
 * `WorkingIndicator` occupied during the rollback round-trip so the
 * layout doesn't shift when WI disappears on success — outer wrapper
 * (`mx-3 min-w-0 overflow-hidden`), the `flex flex-col gap-1 text-xs`
 * frame, and the single-line `text-xs text-muted-foreground` row all
 * mirror `WorkingIndicator`'s collapsed shape.
 */
function UndoRollbackButton() {
  const undoRollback = useChatStore((s) => s.undoRollback);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      <div className="flex items-center justify-end gap-1">
        <ConfirmPopover
          open={open}
          onOpenChange={setOpen}
          description="Undo this rollback?"
          confirmLabel="Undo"
          destructive
          onConfirm={undoRollback}
          trigger={
            <button
              type="button"
              className="hover:text-foreground hover:underline transition-colors"
            >
              Undo rollback
            </button>
          }
        />
      </div>
    </div>
  );
}

export function MessageList({ messages }: MessageListProps) {
  const currentOperation = useChatStore((s) => s.currentOperation);
  const retryCurrentOperation = useChatStore((s) => s.retryCurrentOperation);
  const cancelCurrentOperation = useChatStore((s) => s.cancelCurrentOperation);
  const mutedFromMessageId = useChatStore((s) => s.mutedFromMessageId);

  const isOperationActive =
    currentOperation !== null && currentOperation.status !== "failed";

  const {
    setContainer,
    hasUnseenMessages,
    scrollToBottom,
    onContentAdded,
    onUserMessageSent,
  } = useAutoScroll({ threshold: 100 });

  const prevMessageCountRef = useRef(messages.length);

  const scrollAreaRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        requestAnimationFrame(() => {
          const viewport = node.querySelector(
            "[data-radix-scroll-area-viewport]",
          ) as HTMLElement | null;
          if (viewport) {
            setContainer(viewport);
          }
        });
      }
    },
    [setContainer],
  );

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const prevCount = prevMessageCountRef.current;
    const currentCount = messages.length;

    if (currentCount > prevCount) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.type === "user") {
        onUserMessageSent();
      } else {
        onContentAdded();
      }
    }

    prevMessageCountRef.current = currentCount;
  }, [messages.length, onContentAdded, onUserMessageSent]);

  // Auto-scroll on operation start only when the operation has no anchor
  // (i.e. plain "send" — its WorkingIndicator renders at the bottom of
  // the list, so jumping there is the right thing). For rollback/edit
  // the anchor is somewhere in the middle of the history; scrolling to
  // the bottom would yank the user away from the message they just
  // clicked, which is exactly the place the indicator appears.
  const operationAnchorId = currentOperation?.anchorMessageId ?? null;
  useEffect(() => {
    if (isOperationActive && operationAnchorId === null) {
      onContentAdded();
    }
  }, [isOperationActive, operationAnchorId, onContentAdded]);

  const renderMessage = (message: ChatMessage) => {
    switch (message.type) {
      case "tool_operation": {
        const toolMsg = message as ToolOperationMessageType;
        return (
          <div className="mx-3 min-w-0 overflow-hidden">
            <ToolOperationMessage
              displayName={toolMsg.displayName}
              target={toolMsg.target}
              status={toolMsg.status}
              description={toolMsg.description}
              args={toolMsg.args}
              result={toolMsg.result}
            />
          </div>
        );
      }
      case "agent_message": {
        const agentMsg = message as AgentTextMessage;
        return (
          <div className="mx-3 min-w-0 overflow-hidden">
            <AgentMessage message={agentMsg} />
            <FeedbackForm
              messageId={message.id}
              currentFeedback={agentMsg.feedback}
            />
          </div>
        );
      }
      case "user":
        return <UserMessage message={message} />;
      case "error":
        return (
          <div className="mx-3 min-w-0 overflow-hidden">
            <ErrorMessage message={message as ErrorMessageType} />
          </div>
        );
      default:
        return null;
    }
  };

  const renderOperationStatus = () => {
    if (!currentOperation) return null;
    return (
      <div className="mx-3 min-w-0 overflow-hidden">
        <OperationStatus
          operation={currentOperation}
          onRetry={retryCurrentOperation}
          onCancel={cancelCurrentOperation}
        />
      </div>
    );
  };

  const renderMessages = () => {
    const elements: React.ReactNode[] = [];
    let toolCallGroup: { message: ChatMessage; isMuted: boolean }[] = [];

    const anchorId = currentOperation?.anchorMessageId;
    let anchorRendered = false;

    // Find the muted suffix boundary once per render. -1 means no muted
    // zone, otherwise every index >= mutedFromIndex is muted.
    const mutedFromIndex = mutedFromMessageId
      ? messages.findIndex((m) => m.id === mutedFromMessageId)
      : -1;

    const renderAnchorIfMatches = (id: string) => {
      if (!anchorId || anchorRendered) return;
      if (id !== anchorId) return;
      const status = renderOperationStatus();
      if (status) {
        elements.push(
          <div key={`op-status-${currentOperation!.id}`} className="min-w-0">
            {status}
          </div>,
        );
        anchorRendered = true;
      }
    };

    // The Undo affordance lives in the same slot as the rollback
    // WorkingIndicator (right under the boundary message). Gated on
    // "no live operation + mute boundary set"; while a rollback is
    // running/retrying or failed, the operation status itself owns the
    // slot via renderAnchorIfMatches.
    const renderUndoIfMatches = (id: string) => {
      if (currentOperation !== null) return;
      if (mutedFromMessageId === null || id !== mutedFromMessageId) return;
      elements.push(
        <div key={`undo-rb-${id}`} className="mx-3 min-w-0 overflow-hidden">
          <UndoRollbackButton />
        </div>,
      );
    };

    const flushToolCallGroup = () => {
      if (toolCallGroup.length === 0) return;
      const lastInGroup = toolCallGroup[toolCallGroup.length - 1];
      elements.push(
        <div
          key={`tool-group-${toolCallGroup[0].message.id}`}
          className="space-y-2 min-w-0"
        >
          {toolCallGroup.map(({ message: msg, isMuted }) => (
            <div
              key={msg.id}
              id={`message-${msg.id}`}
              className={cn(isMuted && MUTED_WRAPPER_CLASSES)}
            >
              {renderMessage(msg)}
            </div>
          ))}
        </div>,
      );
      renderAnchorIfMatches(lastInGroup.message.id);
      renderUndoIfMatches(lastInGroup.message.id);
      toolCallGroup = [];
    };

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const isMuted = mutedFromIndex !== -1 && i >= mutedFromIndex;

      if (isToolCallMessage(message)) {
        toolCallGroup.push({ message, isMuted });
        continue;
      }

      flushToolCallGroup();
      elements.push(
        <div
          key={message.id}
          id={`message-${message.id}`}
          className={cn("min-w-0", isMuted && MUTED_WRAPPER_CLASSES)}
        >
          {renderMessage(message)}
        </div>,
      );
      renderAnchorIfMatches(message.id);
      renderUndoIfMatches(message.id);
    }

    flushToolCallGroup();

    // Fallback: operation has no anchor (or anchor was removed) — render at the end.
    if (currentOperation && !anchorRendered) {
      const status = renderOperationStatus();
      if (status) {
        elements.push(
          <div key={`op-status-${currentOperation.id}`} className="min-w-0">
            {status}
          </div>,
        );
      }
    }

    return elements;
  };

  if (messages.length === 0 && !currentOperation) {
    return (
      <div className="flex flex-1 justify-center items-center p-4">
        <p className="text-muted-foreground text-sm text-center">
          Start a conversation...
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full min-w-0 min-h-0 flex flex-col overflow-hidden">
      <ScrollArea ref={scrollAreaRef} className="flex-1 w-full min-w-0 min-h-0">
        <div className="px-3 pt-4 pb-40 space-y-3 flex flex-col overflow-hidden">
          {renderMessages()}
        </div>
      </ScrollArea>
      <ScrollToBottomButton
        visible={hasUnseenMessages}
        onClick={scrollToBottom}
      />
    </div>
  );
}
