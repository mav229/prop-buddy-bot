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
  <div className="flex items-center gap-[5px] py-1">
    {[0, 1, 2].map((i) => (
      <span key={i} className="w-[7px] h-[7px] rounded-full bg-gray-400 typing-dot" style={{ animationDelay: `${i * 200}ms` }} />
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
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
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
            border: isWidget ? "none" : "1px solid hsl(0 0% 14%)",
          }}
        >
          {!content && isStreaming ? (
            <TypingIndicator />
          ) : isUser ? (
            <span className="whitespace-pre-wrap font-light">{displayContent}</span>
          ) : (
            <div
              className={cn(
                "max-w-none font-light",
                "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                "[&_p]:my-2.5 [&_p]:leading-[1.75] [&_p]:tracking-[0.01em]",
                "[&_strong]:font-semibold [&_strong]:text-[hsl(0,0%,92%)]",
                "[&_ul]:my-3 [&_ul]:space-y-1.5 [&_ul]:pl-1",
                "[&_ol]:my-3 [&_ol]:space-y-1.5 [&_ol]:pl-1",
                "[&_li]:text-[hsl(0,0%,78%)] [&_li]:leading-[1.7]",
                "[&_h1]:text-[16px] [&_h1]:font-semibold [&_h1]:text-white [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:tracking-tight",
                "[&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-white/95 [&_h2]:mt-3.5 [&_h2]:mb-2 [&_h2]:tracking-tight",
                "[&_h3]:text-[14px] [&_h3]:font-medium [&_h3]:text-white/90 [&_h3]:mt-3 [&_h3]:mb-1.5",
                "[&_code]:text-[12px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:bg-white/[0.06] [&_code]:text-[hsl(0,0%,88%)] [&_code]:font-mono",
                "[&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3.5 [&_blockquote]:my-3 [&_blockquote]:text-[hsl(0,0%,65%)] [&_blockquote]:italic",
                "[&_a]:text-white/90 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-white/30",
              )}
              style={isWidget ? { color: config.aiMessageTextColor } : undefined}
            >
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p>{children}</p>,
                  ul: ({ children }) => <ul className="list-none">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside">{children}</ol>,
                  li: ({ children }) => (
                    <li className="flex items-start gap-2" style={isWidget ? { color: config.aiMessageTextColor } : undefined}>
                      <span className="mt-[9px] w-1 h-1 rounded-full bg-white/40 flex-shrink-0" />
                      <span className="flex-1">{children}</span>
                    </li>
                  ),
                  strong: ({ children }) => <strong className="font-semibold" style={isWidget ? { color: config.aiMessageTextColor } : undefined}>{children}</strong>,
                }}
              >
                {displayContent}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp removed */}

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
