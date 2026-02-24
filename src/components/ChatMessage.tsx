import { User, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import scholarisLogo from "@/assets/scholaris-logo.png";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";
import { useEffect, useRef, useMemo } from "react";
import { playSound } from "@/hooks/useSounds";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  isWidget?: boolean;
  showAgentButton?: boolean;
  onConnectAgent?: () => void;
  timestamp?: Date;
}

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 py-1.5">
    {[0, 1, 2].map((i) => (
      <span key={i} className="w-[5px] h-[5px] rounded-full bg-gray-400 typing-dot" style={{ animationDelay: `${i * 150}ms` }} />
    ))}
  </div>
);

const getRelativeTime = (date?: Date) => {
  if (!date) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "less than a minute ago";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
};

export const ChatMessage = ({ role, content, isStreaming, isWidget = false, showAgentButton = false, onConnectAgent, timestamp }: ChatMessageProps) => {
  const isUser = role === "user";
  const { config } = useWidgetConfig();
  const hasPlayedCodeSound = useRef(false);

  const stripInternalMarkers = (text: string) =>
    (text || "")
      .replace(/\[\[OPEN_TICKET_FORM\]\]/g, "")
      .replace(/!!OPEN_TICKET_FORM!!/g, "")
      .replace(/\[\[SUPPORT_TICKET_BUTTON\]\]/g, "")
      .replace(/!!SUPPORT_TICKET_BUTTON!!/g, "")
      .trim();

  const displayContent = stripInternalMarkers(content);

  const timeLabel = useMemo(() => getRelativeTime(timestamp), [timestamp]);

  useEffect(() => {
    if (role === "assistant" && !isStreaming && !hasPlayedCodeSound.current) {
      const hasCode = /```[\s\S]*?```|`[^`]+`/.test(displayContent);
      if (hasCode) {
        hasPlayedCodeSound.current = true;
        playSound("code", 0.06);
      }
    }
  }, [displayContent, isStreaming, role]);

  return (
    <div className={cn("flex flex-col gap-1 message-in", isUser ? "items-end" : "items-start")}>
      {/* Bubble – dark rounded card style */}
      <div className="max-w-[85%]">
        <div
          className="rounded-2xl px-4 py-3 leading-relaxed"
          style={{
            backgroundColor: isWidget
              ? (isUser ? config.userMessageBgColor : config.aiMessageBgColor)
              : "hsl(0 0% 14%)",
            color: isWidget
              ? (isUser ? config.userMessageTextColor : config.aiMessageTextColor)
              : "hsl(0 0% 82%)",
            borderRadius: isWidget
              ? `${isUser ? config.userMessageBorderRadius : config.aiMessageBorderRadius}px`
              : "16px",
            fontSize: isWidget ? `${config.chatMessageFontSize}px` : "14px",
            border: "1px solid hsl(0 0% 18%)",
          }}
        >
          {!content && isStreaming ? (
            <TypingIndicator />
          ) : isUser ? (
            <span className="whitespace-pre-wrap font-light">{displayContent}</span>
          ) : (
            <div
              className={cn(
                "prose prose-sm max-w-none font-light whitespace-pre-line",
                "prose-p:my-2 prose-p:leading-relaxed",
                "prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5",
                "prose-headings:my-2 prose-headings:font-medium",
                "prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none prose-code:bg-[hsl(0,0%,10%)]",
                "prose-blockquote:my-2 prose-blockquote:pl-3 prose-blockquote:border-l-2 prose-blockquote:border-[hsl(0,0%,25%)]",
                "prose-strong:font-semibold prose-strong:text-[hsl(0,0%,90%)]",
                "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                "prose-invert"
              )}
              style={isWidget ? { color: config.aiMessageTextColor } : undefined}
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2">{children}</p>,
                  ul: ({ children }) => <ul className="my-2 space-y-1 list-disc list-inside">{children}</ul>,
                  li: ({ children }) => <li style={isWidget ? { color: config.aiMessageTextColor } : undefined}>{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold" style={isWidget ? { color: config.aiMessageTextColor } : undefined}>{children}</strong>,
                }}
              >
                {displayContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp */}
        {timeLabel && !isStreaming && (
          <p className="text-[10px] font-light mt-1.5 px-1" style={{ color: "hsl(0 0% 35%)" }}>
            {timeLabel}
          </p>
        )}

        {/* Connect to Real Agent Button */}
        {showAgentButton && !isUser && !isStreaming && onConnectAgent && (
          <button
            onClick={onConnectAgent}
            className="flex items-center gap-2 px-3 py-2 mt-2 rounded-lg text-[11px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: isWidget
                ? `linear-gradient(135deg, ${config.primaryColor}, ${config.headerGradientEnd || config.primaryColor})`
                : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "white",
              boxShadow: "0 2px 8px -2px rgba(99, 102, 241, 0.4)",
            }}
          >
            <Headphones className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Still having doubts? Connect to a real agent</span>
          </button>
        )}
      </div>
    </div>
  );
};
