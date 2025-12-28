import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export const ChatMessage = ({ role, content, isStreaming }: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary/20 text-primary"
            : "bg-accent/20 text-accent"
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div
        className={cn(
          "max-w-[80%] px-4 py-3 text-sm leading-relaxed",
          isUser ? "chat-bubble-user" : "chat-bubble-assistant"
        )}
      >
        {content || (isStreaming && (
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-typing-dot-1" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-typing-dot-2" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-typing-dot-3" />
          </div>
        ))}
        <span className="whitespace-pre-wrap">{content}</span>
      </div>
    </div>
  );
};
