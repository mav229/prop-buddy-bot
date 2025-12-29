import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import scholarisLogo from "@/assets/scholaris-logo.png";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  isWidget?: boolean;
  timestamp?: Date;
}

const formatTimestamp = (date?: Date): string => {
  if (!date) return "Just now";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffSecs < 10) return "Just now";
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Typing indicator component
const TypingIndicator = ({ isWidget }: { isWidget: boolean }) => (
  <div className="flex items-center gap-1 py-1">
    <span 
      className={cn(
        "w-2 h-2 rounded-full typing-dot",
        isWidget ? "bg-gray-400" : "bg-primary/60"
      )} 
      style={{ animationDelay: '0ms' }}
    />
    <span 
      className={cn(
        "w-2 h-2 rounded-full typing-dot",
        isWidget ? "bg-gray-400" : "bg-primary/60"
      )} 
      style={{ animationDelay: '160ms' }}
    />
    <span 
      className={cn(
        "w-2 h-2 rounded-full typing-dot",
        isWidget ? "bg-gray-400" : "bg-primary/60"
      )} 
      style={{ animationDelay: '320ms' }}
    />
  </div>
);

export const ChatMessage = ({ role, content, isStreaming, isWidget = false, timestamp }: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "flex gap-3 animate-fade-in",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        <div
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden",
            isWidget
              ? isUser
                ? "bg-gradient-to-br from-[#007AFF] to-[#0056CC] shadow-sm"
                : "bg-transparent"
              : isUser
                ? "bg-gradient-to-br from-primary to-accent shadow-sm"
                : "bg-transparent"
          )}
        >
          {isUser ? (
            <User className={cn("w-4 h-4", isWidget ? "text-white" : "text-primary-foreground")} />
          ) : (
            <img src={scholarisLogo} alt="Scholaris" className="w-full h-full object-cover rounded-xl" />
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
            <TypingIndicator isWidget={isWidget} />
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
      
      {/* Timestamp */}
      {content && (
        <span 
          className={cn(
            "text-[10px] px-11",
            isWidget ? "text-gray-400" : "text-muted-foreground/60"
          )}
        >
          {formatTimestamp(timestamp)}
        </span>
      )}
    </div>
  );
};
