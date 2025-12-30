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

const TypingIndicator = ({ isWidget }: { isWidget: boolean }) => (
  <div className="flex items-center gap-1.5 py-2">
    {[0, 1, 2].map((i) => (
      <span 
        key={i}
        className={cn("w-[5px] h-[5px] rounded-full typing-dot", isWidget ? "bg-[#999]" : "bg-primary/50")} 
        style={{ animationDelay: `${i * 150}ms` }}
      />
    ))}
  </div>
);

export const ChatMessage = ({ role, content, isStreaming, isWidget = false, timestamp }: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <div className={cn("flex flex-col gap-1 message-bubble", isUser ? "items-end" : "items-start")}>
      <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
        {/* Avatar */}
        <div
          className={cn(
            "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden",
            isWidget ? isUser ? "bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]" : "bg-transparent" : isUser ? "bg-gradient-to-br from-primary to-accent" : "bg-transparent"
          )}
        >
          {isUser ? (
            <User className={cn("w-3.5 h-3.5", isWidget ? "text-white" : "text-primary-foreground")} strokeWidth={1.5} />
          ) : (
            <img src={scholarisLogo} alt="Scholaris" className="w-full h-full object-cover rounded-full" />
          )}
        </div>

        {/* Bubble */}
        <div
          className={cn(
            "max-w-[82%] px-4 py-2.5 text-[14px] leading-[1.5]",
            isWidget ? isUser ? "widget-bubble-user" : "widget-bubble-assistant" : isUser ? "chat-bubble-user" : "chat-bubble-assistant"
          )}
        >
          {!content && isStreaming ? (
            <TypingIndicator isWidget={isWidget} />
          ) : isUser ? (
            <span className="widget-text-light whitespace-pre-wrap">{content}</span>
          ) : (
            <div className={cn(
              "prose prose-sm max-w-none widget-text-light",
              "prose-p:my-2 prose-p:leading-[1.55]",
              "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
              "prose-headings:my-2 prose-headings:font-normal",
              "prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none",
              "prose-blockquote:my-2 prose-blockquote:pl-3 prose-blockquote:border-l-2",
              "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
              isWidget 
                ? "[&_*]:font-light prose-headings:font-normal prose-pre:bg-[#F5F5F5] prose-code:text-[#333] prose-code:bg-[#F5F5F5] prose-code:font-light prose-blockquote:border-[#ddd] prose-blockquote:text-[#666] prose-strong:font-normal"
                : "prose-invert prose-pre:bg-muted prose-code:text-primary prose-code:bg-primary/10"
            )}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      
      {content && (
        <span className={cn("widget-text-light text-[10px] px-10", isWidget ? "text-[#bbb]" : "text-muted-foreground/50")}>
          {formatTimestamp(timestamp)}
        </span>
      )}
    </div>
  );
};
