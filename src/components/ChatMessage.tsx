import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

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
        {!content && isStreaming ? (
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-typing-dot-1" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-typing-dot-2" />
            <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-typing-dot-3" />
          </div>
        ) : isUser ? (
          <span className="whitespace-pre-wrap">{content}</span>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:bg-background/50 prose-pre:border prose-pre:border-border/50 prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
