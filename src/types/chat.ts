export type ChatMessageType =
  | "tool_operation"
  | "agent_message"
  | "user"
  | "error";

interface ChatMessageBase {
  id: string;
  timestamp: string;
}

export type ToolOperationStatus = "running" | "completed" | "cancelled";

export type ToolName = "list_dir" | "read_file" | "edit_file" | "run_test";

export interface ToolOperationMessage extends ChatMessageBase {
  type: "tool_operation";
  toolCallId: string;
  toolName: ToolName;
  displayName: string;
  target: string;
  status: ToolOperationStatus;
  description?: string;
  args?: Record<string, unknown>;
  result?: string;
  fileContent?: string[];
}

export type MessageFeedback = "positive" | "negative" | null;

export interface AgentTextMessage extends ChatMessageBase {
  type: "agent_message";
  content: string;
  feedback?: MessageFeedback;
  feedbackText?: string;
}

export interface UserMessage extends ChatMessageBase {
  type: "user";
  content: string;
}

export interface ErrorMessage extends ChatMessageBase {
  type: "error";
  message: string;
}

export type ChatMessage =
  | ToolOperationMessage
  | AgentTextMessage
  | UserMessage
  | ErrorMessage;
