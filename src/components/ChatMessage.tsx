import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import scholarisLogo from "@/assets/scholaris-logo.png";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";
import { useState, useEffect } from "react";

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
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

// Hook for dynamic timestamp updates
const useFormattedTimestamp = (timestamp?: Date) => {
  const [formatted, setFormatted] = useState(() => formatTimestamp(timestamp));
  
  useEffect(() => {
    if (!timestamp) return;
    
    const update = () => setFormatted(formatTimestamp(timestamp));
    update();
    
    const interval = setInterval(update, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [timestamp]);
  
  return formatted;
};

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 py-1.5">
    {[0, 1, 2].map((i) => (
      <span key={i} className="w-[5px] h-[5px] rounded-full bg-gray-400 typing-dot" style={{ animationDelay: `${i * 150}ms` }} />
    ))}
  </div>
);

export const ChatMessage = ({ role, content, isStreaming, isWidget = false, timestamp }: ChatMessageProps) => {
  const isUser = role === "user";
  const { config } = useWidgetConfig();
  const formattedTime = useFormattedTimestamp(timestamp);

  // Build inline styles from config when in widget mode
  const userBubbleStyle = isWidget ? {
    backgroundColor: config.userMessageBgColor,
    color: config.userMessageTextColor,
    borderRadius: `${config.userMessageBorderRadius}px`,
  } : undefined;

  const aiBubbleStyle = isWidget ? {
    backgroundColor: config.aiMessageBgColor,
    color: config.aiMessageTextColor,
    borderRadius: `${config.aiMessageBorderRadius}px`,
  } : undefined;

  return (
    <div className={cn("flex flex-col gap-1 message-in", isUser ? "items-end" : "items-start")}>
      <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden",
          isUser ? "bg-gradient-to-br from-indigo-500 to-purple-500" : "bg-transparent"
        )}
          style={isWidget && isUser ? { background: `linear-gradient(135deg, ${config.userMessageBgColor}, ${config.primaryColor})` } : undefined}
        >
          {isUser ? (
            <User className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
          ) : (
            <img src={scholarisLogo} alt="AI" className="w-full h-full object-cover rounded-full" />
          )}
        </div>

        {/* Bubble */}
        <div 
          className={cn(
            "max-w-[80%] px-4 py-3 leading-relaxed",
            !isWidget && (isUser ? "chat-bubble-user" : "chat-bubble-assistant")
          )}
          style={{
            ...(isUser ? userBubbleStyle : aiBubbleStyle),
            fontSize: isWidget ? `${config.chatMessageFontSize}px` : '14px',
          }}
        >
          {!content && isStreaming ? (
            <TypingIndicator />
          ) : isUser ? (
            <span className="text-thin whitespace-pre-wrap">{content}</span>
          ) : (
            <div 
              className={cn(
                "prose prose-sm max-w-none text-thin whitespace-pre-line",
                "prose-p:my-3 prose-p:leading-relaxed",
                "prose-ul:my-3 prose-ol:my-3 prose-li:my-1",
                "prose-headings:my-3 prose-headings:font-medium",
                "prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none",
                "prose-blockquote:my-3 prose-blockquote:pl-3 prose-blockquote:border-l-2",
                "prose-strong:font-semibold",
                "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                "[&_br]:block [&_br]:my-2",
                !isWidget && "prose-invert"
              )}
              style={isWidget ? { color: config.aiMessageTextColor } : undefined}
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-3">{children}</p>,
                  ul: ({ children }) => <ul className="my-3 space-y-1 list-disc list-inside">{children}</ul>,
                  li: ({ children }) => <li style={isWidget ? { color: config.aiMessageTextColor } : undefined}>{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold" style={isWidget ? { color: config.aiMessageTextColor } : undefined}>{children}</strong>,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      
      {content && config.showTimestamps && (
        <span className={cn("text-ultra-thin text-[10px] px-10", isWidget ? "text-gray-400" : "text-muted-foreground/50")}>
          {formattedTime}
        </span>
      )}
    </div>
  );
};
