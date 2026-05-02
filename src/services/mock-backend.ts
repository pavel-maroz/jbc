import type { ToolName } from "@/types/chat";

export type AgentResponse =
  | { type: "text"; content: string }
  | {
      type: "tool_call";
      tool: ToolName;
      args: Record<string, unknown>;
      result?: string;
      fileContent?: string[];
    };

export interface RollbackResult {
  success: boolean;
  fileContent: string[];
}

const ERROR_RATE = 0.05;
const USER_MESSAGE_DELAY = 2000;
const MIN_SUBSEQUENT_DELAY = 200;
const MAX_SUBSEQUENT_DELAY = 500;
const ERROR_DELAY = 5000;
const STOP_DELAY = 1000;
const ROLLBACK_DELAY = 5000;

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shouldError(forceError?: boolean): boolean {
  if (forceError) return true;
  return Math.random() < ERROR_RATE;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

const HARDCODED_RESPONSES: AgentResponse[] = [
  {
    type: "text",
    content:
      "I'll help you implement this feature. Let me start by exploring the project structure.",
  },
  {
    type: "tool_call",
    tool: "list_dir",
    args: { path: "." },
    result: "src/\npackage.json\ntsconfig.json\nmock-file.txt",
  },
  {
    type: "text",
    content:
      "Now let me read the main configuration file to understand the project setup.",
  },
  {
    type: "tool_call",
    tool: "read_file",
    args: { path: "package.json" },
    result: '{\n  "name": "my-app",\n  "version": "1.0.0"\n}',
  },
  {
    type: "tool_call",
    tool: "list_dir",
    args: { path: "src" },
    result: "components/\nApp.tsx\nmain.tsx",
  },
  {
    type: "text",
    content:
      "I see the project structure. Let me add the initial implementation to the mock file.",
  },
  {
    type: "tool_call",
    tool: "edit_file",
    args: { path: "mock-file.txt", linesAdded: 3 },
    fileContent: [
      "const greet = (name: string) => `Hello, ${name}!`;",
      "type User = { id: number; name: string };",
      "const nums: number[] = [1, 2, 3, 4, 5];",
    ],
  },
  {
    type: "text",
    content:
      "I've added the basic structure. Now let me expand it with more functionality.",
  },
  {
    type: "tool_call",
    tool: "edit_file",
    args: { path: "mock-file.txt", linesAdded: 5 },
    fileContent: [
      "const greet = (name: string) => `Hello, ${name}!`;",
      "type User = { id: number; name: string };",
      "const nums: number[] = [1, 2, 3, 4, 5];",
      "const doubled = nums.map(n => n * 2);",
      "interface Config { debug?: boolean; timeout: number }",
      "const user = users.find(u => u.id === targetId);",
      "async function fetchData(): Promise<Response> { }",
      "type Nullable<T> = T | null;",
    ],
  },
  {
    type: "text",
    content: "Now let me run the tests to make sure everything works.",
  },
  {
    type: "tool_call",
    tool: "run_test",
    args: { testFile: "src/tests/mock-file.test.tsx" },
    result: "PASS: All tests passed (3/3)",
  },
  {
    type: "text",
    content:
      "All tests pass. The feature has been successfully implemented. Here's a summary of what I did:\n\n1. Explored the project structure\n2. Read the configuration\n3. Added initial implementation (3 lines)\n4. Expanded with more functionality (5 more lines)\n5. Ran tests to verify\n\nLet me know if you need any changes!",
  },
];

export function getResponseCount(): number {
  return HARDCODED_RESPONSES.length;
}

function generateFileContent(
  baseLineCount: number,
  linesAdded: number,
): string[] {
  const content: string[] = [];
  for (let i = 1; i <= baseLineCount + linesAdded; i++) {
    content.push(`line${i}`);
  }
  return content;
}

export async function* sendMessage(
  startIndex: number,
  currentLineCount: number,
  forceError?: boolean,
  signal?: AbortSignal,
): AsyncGenerator<{
  response: AgentResponse;
  fileContent?: string[];
  newIndex: number;
}> {
  let currentIndex = startIndex % HARDCODED_RESPONSES.length;
  let lineCount = currentLineCount;

  await sleep(USER_MESSAGE_DELAY, signal);

  while (currentIndex < HARDCODED_RESPONSES.length) {
    if (shouldError(forceError)) {
      await sleep(ERROR_DELAY, signal);
      throw new Error("NETWORK_TIMEOUT: Connection to agent server lost");
    }

    const response = HARDCODED_RESPONSES[currentIndex];
    const result: {
      response: AgentResponse;
      fileContent?: string[];
      newIndex: number;
    } = {
      response,
      newIndex: currentIndex + 1,
    };

    if (response.type === "tool_call" && response.tool === "edit_file") {
      const linesAdded =
        (response.args as { linesAdded?: number }).linesAdded || 0;
      result.fileContent = generateFileContent(lineCount, linesAdded);
      lineCount += linesAdded;
    }

    yield result;
    currentIndex++;

    if (currentIndex < HARDCODED_RESPONSES.length) {
      await sleep(
        randomDelay(MIN_SUBSEQUENT_DELAY, MAX_SUBSEQUENT_DELAY),
        signal,
      );
    }
  }
}

export async function stopAgent(signal?: AbortSignal): Promise<void> {
  await sleep(STOP_DELAY, signal);

  if (shouldError()) {
    throw new Error("STOP_FAILED: Unable to stop agent process");
  }
}

export async function rollbackToMessage(
  messageId: string,
  messages: {
    id: string;
    type: string;
    toolName?: string;
    status?: string;
    fileContent?: string[];
  }[],
  signal?: AbortSignal,
): Promise<RollbackResult> {
  await sleep(ROLLBACK_DELAY, signal);

  if (shouldError()) {
    throw new Error("ROLLBACK_FAILED: Database transaction error");
  }

  const index = messages.findIndex((m) => m.id === messageId);
  if (index === -1) {
    throw new Error("ROLLBACK_FAILED: Message not found");
  }

  const relevantMessages = messages.slice(0, index + 1);
  let fileContent: string[] = [];

  for (let i = relevantMessages.length - 1; i >= 0; i--) {
    const msg = relevantMessages[i];
    if (
      msg.type === "tool_operation" &&
      msg.toolName === "edit_file" &&
      msg.status === "completed" &&
      msg.fileContent
    ) {
      fileContent = msg.fileContent;
      break;
    }
  }

  return { success: true, fileContent };
}

export function getToolDisplayName(tool: ToolName): string {
  switch (tool) {
    case "list_dir":
      return "list_dir";
    case "read_file":
      return "read_file";
    case "edit_file":
      return "edit_file";
    case "run_test":
      return "run_test";
    default:
      return tool;
  }
}

export function getToolTarget(
  tool: ToolName,
  args: Record<string, unknown>,
): string {
  switch (tool) {
    case "list_dir":
      return String(args.path || ".");
    case "read_file":
    case "edit_file":
      return String(args.path || "unknown");
    case "run_test":
      return String(args.testFile || "tests");
    default:
      return "";
  }
}
