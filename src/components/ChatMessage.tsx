import { User, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import scholarisLogo from "@/assets/scholaris-logo.png";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";
import { useEffect, useRef } from "react";
import { playSound } from "@/hooks/useSounds";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  isWidget?: boolean;
  showAgentButton?: boolean;
  onConnectAgent?: () => void;
}

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 py-1.5">
    {[0, 1, 2].map((i) => (
      <span key={i} className="w-[5px] h-[5px] rounded-full bg-gray-400 typing-dot" style={{ animationDelay: `${i * 150}ms` }} />
    ))}
  </div>
);

export const ChatMessage = ({ role, content, isStreaming, isWidget = false, showAgentButton = false, onConnectAgent }: ChatMessageProps) => {
  const isUser = role === "user";
  const { config } = useWidgetConfig();
  const hasPlayedCodeSound = useRef(false);

  // Internal control markers that should never be shown to the user.
  // We strip multiple variants to be robust across older builds / formatting quirks.
  const stripInternalMarkers = (text: string) =>
    (text || "")
      .replace(/\[\[OPEN_TICKET_FORM\]\]/g, "")
      .replace(/!!OPEN_TICKET_FORM!!/g, "")
      .replace(/\[\[SUPPORT_TICKET_BUTTON\]\]/g, "")
      .replace(/!!SUPPORT_TICKET_BUTTON!!/g, "")
      .trim();

  const displayContent = stripInternalMarkers(content);

  // Detect code blocks and play sound
  useEffect(() => {
    if (role === "assistant" && !isStreaming && !hasPlayedCodeSound.current) {
      const hasCode = /```[\s\S]*?```|`[^`]+`/.test(displayContent);
      if (hasCode) {
        hasPlayedCodeSound.current = true;
        playSound("code", 0.06);
      }
    }
  }, [displayContent, isStreaming, role]);

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
        <div className="flex flex-col gap-2 max-w-[80%]">
          <div 
            className={cn(
              "px-4 py-3 leading-relaxed",
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
              <span className="text-thin whitespace-pre-wrap">{displayContent}</span>
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
                  {displayContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
          
          {/* Connect to Real Agent Button - only for assistant messages after threshold */}
          {showAgentButton && !isUser && !isStreaming && onConnectAgent && (
            <button
              onClick={onConnectAgent}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: isWidget 
                  ? `linear-gradient(135deg, ${config.primaryColor}, ${config.headerGradientEnd || config.primaryColor})` 
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                boxShadow: '0 2px 8px -2px rgba(99, 102, 241, 0.4)',
              }}
            >
              <Headphones className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Still having doubts? Connect to a real agent</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
