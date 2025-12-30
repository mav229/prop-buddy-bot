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

// Premium typing indicator
const TypingIndicator = ({ isWidget }: { isWidget: boolean }) => (
  <div className="flex items-center gap-1.5 py-2 px-0.5">
    {[0, 1, 2].map((i) => (
      <span 
        key={i}
        className={cn(
          "w-[5px] h-[5px] rounded-full typing-dot",
          isWidget ? "bg-[#8E8E93]" : "bg-primary/50"
        )} 
        style={{ animationDelay: `${i * 150}ms` }}
      />
    ))}
  </div>
);

export const ChatMessage = ({ role, content, isStreaming, isWidget = false, timestamp }: ChatMessageProps) => {
  const isUser = role === "user";

  // Premium thin font styles
  const thinText = { fontWeight: 400, letterSpacing: '-0.01em' };

  return (
    <div 
      className={cn(
        "flex flex-col gap-1 message-bubble",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
        {/* Avatar */}
        <div
          className={cn(
            "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden",
            isWidget
              ? isUser
                ? "bg-gradient-to-br from-[#007AFF] to-[#0055D4]"
                : "bg-transparent"
              : isUser
                ? "bg-gradient-to-br from-primary to-accent"
                : "bg-transparent"
          )}
          style={{ boxShadow: isUser && isWidget ? '0 2px 8px -2px rgba(0, 122, 255, 0.25)' : undefined }}
        >
          {isUser ? (
            <User className={cn("w-3.5 h-3.5", isWidget ? "text-white" : "text-primary-foreground")} strokeWidth={1.5} />
          ) : (
            <img src={scholarisLogo} alt="Scholaris" className="w-full h-full object-cover rounded-full" />
          )}
        </div>

        {/* Message bubble */}
        <div
          className={cn(
            "max-w-[82%] px-4 py-2.5 text-[14px]",
            isWidget
              ? isUser
                ? "widget-bubble-user"
                : "widget-bubble-assistant"
              : isUser
                ? "chat-bubble-user"
                : "chat-bubble-assistant"
          )}
          style={{ ...thinText, lineHeight: '1.5' }}
        >
          {!content && isStreaming ? (
            <TypingIndicator isWidget={isWidget} />
          ) : isUser ? (
            <span className="whitespace-pre-wrap">{content}</span>
          ) : (
            <div className={cn(
              "prose prose-sm max-w-none",
              "prose-p:my-2.5 prose-p:leading-[1.55]",
              "prose-ul:my-2.5 prose-ol:my-2.5 prose-li:my-1",
              "prose-headings:my-3 prose-headings:tracking-tight",
              "prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-code:text-[13px]",
              "prose-blockquote:my-2.5 prose-blockquote:pl-3 prose-blockquote:border-l-2 prose-blockquote:italic",
              "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
              isWidget 
                ? "[&_*]:font-normal prose-headings:font-medium prose-pre:bg-[#F5F5F7] prose-pre:border prose-pre:border-[#E5E5EA] prose-pre:rounded-xl prose-code:text-[#1D1D1F] prose-code:bg-[#F5F5F7] prose-code:font-normal prose-blockquote:border-[#D1D1D6] prose-blockquote:text-[#48484A] prose-strong:font-medium"
                : "prose-invert prose-pre:bg-muted prose-pre:border prose-pre:border-border/50 prose-code:text-primary prose-code:bg-primary/10 prose-blockquote:border-primary/50"
            )}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      
      {/* Timestamp */}
      {content && (
        <span className={cn("text-[10px] px-10", isWidget ? "text-[#AEAEB2]" : "text-muted-foreground/50")} style={{ fontWeight: 400, letterSpacing: '0.01em' }}>
          {formatTimestamp(timestamp)}
        </span>
      )}
    </div>
  );
};
