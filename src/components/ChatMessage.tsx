import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import scholarisLogo from "@/assets/scholaris-logo.png";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  isWidget?: boolean;
}

export const ChatMessage = ({ role, content, isStreaming, isWidget = false }: ChatMessageProps) => {
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
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shadow-sm",
          isWidget
            ? isUser
              ? "bg-gradient-to-br from-[#007AFF] to-[#0056CC]"
              : "bg-gradient-to-br from-gray-100 to-gray-200"
            : isUser
              ? "bg-gradient-to-br from-primary to-accent"
              : "bg-gradient-to-br from-secondary to-muted"
        )}
      >
        {isUser ? (
          <User className={cn("w-4 h-4", isWidget ? "text-white" : "text-primary-foreground")} />
        ) : (
          <img src={scholarisLogo} alt="Scholaris" className="w-full h-full object-cover" />
        )}
      </div>

      <div
        className={cn(
          "max-w-[80%] px-4 py-3 text-[14px] leading-relaxed",
          isWidget
            ? isUser
              ? "widget-bubble-user"
              : "widget-bubble-assistant"
            : isUser
              ? "chat-bubble-user"
              : "chat-bubble-assistant"
        )}
      >
        {!content && isStreaming ? (
          <div className="flex gap-1.5 py-1">
            <span className={cn("w-2 h-2 rounded-full animate-bounce [animation-delay:0ms]", isWidget ? "bg-[#007AFF]/60" : "bg-primary/60")} />
            <span className={cn("w-2 h-2 rounded-full animate-bounce [animation-delay:150ms]", isWidget ? "bg-[#007AFF]/60" : "bg-primary/60")} />
            <span className={cn("w-2 h-2 rounded-full animate-bounce [animation-delay:300ms]", isWidget ? "bg-[#007AFF]/60" : "bg-primary/60")} />
          </div>
        ) : isUser ? (
          <span className="whitespace-pre-wrap font-medium">{content}</span>
        ) : (
          <div className={cn(
            "prose prose-sm max-w-none",
            "prose-p:my-4 prose-p:leading-[1.7]",
            "prose-ul:my-4 prose-ol:my-4 prose-li:my-1.5",
            "prose-headings:my-5 prose-headings:font-semibold",
            "prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-code:font-medium",
            "prose-strong:font-semibold",
            "prose-blockquote:my-4 prose-blockquote:pl-4 prose-blockquote:border-l-2",
            "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
            isWidget 
              ? "prose-pre:bg-gray-100 prose-pre:border prose-pre:border-gray-200 prose-code:text-gray-800 prose-code:bg-gray-100 prose-blockquote:border-gray-300 prose-blockquote:text-gray-600"
              : "prose-invert prose-pre:bg-muted prose-pre:border prose-pre:border-border/50 prose-code:text-primary prose-code:bg-primary/10 prose-blockquote:border-primary/50"
          )}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
