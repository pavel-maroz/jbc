# AI Coding Agent Sandbox - Development Guide

## Overview

This is a mocked AI coding agent sandbox designed for evaluating Design Engineer candidates. The application simulates a coding assistant with a chat interface on the left and a mock code editor on the right.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## Mock Backend

The mock backend (`src/services/mock-backend.ts`) simulates agent responses with configurable delays and error rates.

### API Methods

| Method                                            | Description                                 | Success Delay                  | Error Rate      |
| ------------------------------------------------- | ------------------------------------------- | ------------------------------ | --------------- |
| `sendMessage(text, forceError?, signal?)`         | Sends a message and streams agent responses | 1s first, 200-500ms subsequent | 5% per response |
| `stopAgent(signal?)`                              | Stops the agent                             | 1s                             | 5%              |
| `rollbackToMessage(messageId, messages, signal?)` | Rolls back to a specific message            | 5s                             | 5%              |

### Response Types

- **Text response**: Agent's text message (rendered as markdown)
- **Tool call**: Tool operation (list_dir, read_file, write_file, run_test)

### Error Simulation

- 10% chance of error for each response (configurable)
- 5 second delay before error is thrown
- Set `forceError: true` to always trigger an error

## Message Types

```typescript
type ChatMessage =
  | UserMessage // User's text message
  | AgentTextMessage // Agent's text response
  | ToolOperationMessage // Tool call (list_dir, read_file, etc.)
  | ErrorMessage; // Error display
```

## Key Components

### MessageList

Renders the chat messages with auto-scroll behavior. Groups consecutive tool operations together.

### ChatInput

Text input with send/stop buttons. Enter to send, Shift+Enter for newline.

### ToolOperationMessage

Collapsible tool operation display with shimmer animation for running state.

### FeedbackForm

Like/dislike buttons with optional text feedback.

### MockEditor

Simple text display showing the mock file content updated by write_file operations.

## State Management

The `chat-store.ts` manages:

- `messages`: Array of chat messages
- `fileContent`: Mock file content (lines array)
- `isAgentWorking`: Boolean indicating agent activity
- `abortController`: For cancelling ongoing requests

## Styling

The project uses Tailwind CSS with a custom color palette based on CSS variables (dark theme by default).

Key color tokens:

- `sidebar`: Chat panel background and text
- `background`: Editor panel background
- `muted`: Secondary/disabled states
- `primary`: Primary actions (send button)

## Development Guidelines

1. **Components**: Keep components focused and single-responsibility
2. **State**: Use Zustand selectors to minimize re-renders
3. **Types**: Define explicit types for all data structures
4. **Styling**: Use Tailwind utilities, avoid inline styles
5. **Error Handling**: Always handle async errors gracefully

## Candidate Evaluation Tasks

### Part 1: UI/UX Review (Interview)

- Identify UI issues and inconsistencies
- Suggest UX improvements
- Review error handling and edge cases

### Part 2: Feature Design (Interview)

- Design rollback behavior (restore chat + file state)
- Design message editing flow
- Consider edge cases and state management

### Part 3: Implementation (Home Task)

- Implement the designed rollback/editing feature
- Write clean, maintainable code
