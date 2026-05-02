import { useChatStore } from "@/stores/chat-store";
import { File } from "lucide-react";

export function MockEditor() {
  const fileContent = useChatStore((s) => s.fileContent);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
        <File className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-sidebar-foreground font-medium">
          mock-file.txt
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4 font-mono text-sm">
        {fileContent.length === 0 ? (
          <div className="text-muted-foreground italic">
            No file content yet. Agent will modify this file during the
            conversation.
          </div>
        ) : (
          <div className="space-y-0">
            {fileContent.map((line, index) => (
              <div key={index} className="flex">
                <span className="select-none text-muted-foreground/50 pr-4 text-right w-8">
                  {index + 1}
                </span>
                <span className="text-foreground">{line}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
