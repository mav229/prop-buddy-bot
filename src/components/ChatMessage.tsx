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
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

  return (
    <div className={cn("flex flex-col gap-1 message-in", isUser ? "items-end" : "items-start")}>
      <div className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}>
        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden",
          isUser ? "bg-gradient-to-br from-indigo-500 to-purple-500" : "bg-transparent"
        )}>
          {isUser ? (
            <User className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
          ) : (
            <img src={scholarisLogo} alt="AI" className="w-full h-full object-cover rounded-full" />
          )}
        </div>

        {/* Bubble */}
        <div className={cn(
          "max-w-[80%] px-4 py-3 text-[14px] leading-relaxed",
          isWidget ? (isUser ? "bubble-user" : "bubble-assistant") : (isUser ? "chat-bubble-user" : "chat-bubble-assistant")
        )}>
          {!content && isStreaming ? (
            <TypingIndicator />
          ) : isUser ? (
            <span className="text-thin whitespace-pre-wrap">{content}</span>
          ) : (
            <div className={cn(
              "prose prose-sm max-w-none text-thin",
              "prose-p:my-2 prose-p:leading-relaxed",
              "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
              "prose-headings:my-2 prose-headings:font-normal prose-headings:text-gray-700",
              "prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:bg-gray-100 prose-code:text-gray-700 prose-code:before:content-none prose-code:after:content-none",
              "prose-blockquote:my-2 prose-blockquote:pl-3 prose-blockquote:border-l-2 prose-blockquote:border-gray-200 prose-blockquote:text-gray-500",
              "prose-strong:font-normal prose-strong:text-gray-700",
              "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
              isWidget ? "[&_*]:text-gray-600" : "prose-invert"
            )}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      
      {content && (
        <span className={cn("text-ultra-thin text-[10px] px-10", isWidget ? "text-gray-300" : "text-muted-foreground/50")}>
          {formatTimestamp(timestamp)}
        </span>
      )}
    </div>
  );
};
