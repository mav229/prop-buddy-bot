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

// Premium typing indicator with Apple-like animation
const TypingIndicator = ({ isWidget }: { isWidget: boolean }) => (
  <div className="flex items-center gap-1.5 py-2 px-1">
    {[0, 1, 2].map((i) => (
      <span 
        key={i}
        className={cn(
          "w-[6px] h-[6px] rounded-full typing-dot",
          isWidget ? "bg-[#8E8E93]" : "bg-primary/50"
        )} 
        style={{ animationDelay: `${i * 140}ms` }}
      />
    ))}
  </div>
);

export const ChatMessage = ({ role, content, isStreaming, isWidget = false, timestamp }: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <div 
      className={cn(
        "flex flex-col gap-1.5 message-bubble",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "flex gap-2.5",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden",
            isWidget
              ? isUser
                ? "bg-gradient-to-br from-[#007AFF] to-[#0051D4]"
                : "bg-transparent"
              : isUser
                ? "bg-gradient-to-br from-primary to-accent"
                : "bg-transparent"
          )}
          style={{
            boxShadow: isUser && isWidget ? '0 2px 8px -2px rgba(0, 122, 255, 0.3)' : undefined
          }}
        >
          {isUser ? (
            <User className={cn(
              "w-3.5 h-3.5",
              isWidget ? "text-white" : "text-primary-foreground"
            )} />
          ) : (
            <img 
              src={scholarisLogo} 
              alt="Scholaris" 
              className="w-full h-full object-cover rounded-full" 
            />
          )}
        </div>

        {/* Message bubble */}
        <div
          className={cn(
            "max-w-[82%] px-4 py-2.5 text-[14px] leading-[1.5]",
            isWidget
              ? isUser
                ? "widget-bubble-user"
                : "widget-bubble-assistant"
              : isUser
                ? "chat-bubble-user"
                : "chat-bubble-assistant"
          )}
          style={{
            fontWeight: isUser ? 450 : 400,
            letterSpacing: '-0.01em'
          }}
        >
          {!content && isStreaming ? (
            <TypingIndicator isWidget={isWidget} />
          ) : isUser ? (
            <span className="whitespace-pre-wrap">{content}</span>
          ) : (
            <div className={cn(
              "prose prose-sm max-w-none",
              "prose-p:my-3 prose-p:leading-[1.6]",
              "prose-ul:my-3 prose-ol:my-3 prose-li:my-1",
              "prose-headings:my-4 prose-headings:font-semibold prose-headings:tracking-tight",
              "prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-code:font-medium prose-code:text-[13px]",
              "prose-strong:font-semibold",
              "prose-blockquote:my-3 prose-blockquote:pl-3.5 prose-blockquote:border-l-2 prose-blockquote:italic",
              "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
              isWidget 
                ? "prose-pre:bg-[#F5F5F7] prose-pre:border prose-pre:border-[#E5E5EA] prose-pre:rounded-xl prose-code:text-[#1D1D1F] prose-code:bg-[#F5F5F7] prose-blockquote:border-[#D1D1D6] prose-blockquote:text-[#48484A]"
                : "prose-invert prose-pre:bg-muted prose-pre:border prose-pre:border-border/50 prose-code:text-primary prose-code:bg-primary/10 prose-blockquote:border-primary/50"
            )}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      
      {/* Timestamp - refined typography */}
      {content && (
        <span 
          className={cn(
            "text-[10px] font-medium tracking-wide px-10",
            isWidget ? "text-[#8E8E93]" : "text-muted-foreground/50"
          )}
          style={{ letterSpacing: '0.02em' }}
        >
          {formatTimestamp(timestamp)}
        </span>
      )}
    </div>
  );
};
