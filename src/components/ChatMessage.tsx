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
  onTicketButtonClick?: () => void;
}

const SUPPORT_BUTTON_MARKER = "[[SUPPORT_TICKET_BUTTON]]";

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 py-1.5">
    {[0, 1, 2].map((i) => (
      <span key={i} className="w-[5px] h-[5px] rounded-full bg-gray-400 typing-dot" style={{ animationDelay: `${i * 150}ms` }} />
    ))}
  </div>
);

// Support ticket button component
const SupportTicketButton = ({ onClick }: { onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl active:scale-[0.98] my-2"
  >
    <Headphones className="w-4 h-4" />
    Talk to Real Agent
  </button>
);

export const ChatMessage = ({ role, content, isStreaming, isWidget = false, onTicketButtonClick }: ChatMessageProps) => {
  const isUser = role === "user";
  const { config } = useWidgetConfig();
  const hasPlayedCodeSound = useRef(false);

  // Check if content has support button marker
  const hasSupportButton = content.includes(SUPPORT_BUTTON_MARKER);
  
  // Split content around the button marker if present
  const renderContent = () => {
    if (!hasSupportButton) {
      return content;
    }
    
    const parts = content.split(SUPPORT_BUTTON_MARKER);
    return parts.map((part, index) => (
      <span key={index}>
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-3">{children}</p>,
            ul: ({ children }) => <ul className="my-3 space-y-1 list-disc list-inside">{children}</ul>,
            li: ({ children }) => <li style={isWidget ? { color: config.aiMessageTextColor } : undefined}>{children}</li>,
            strong: ({ children }) => <strong className="font-semibold" style={isWidget ? { color: config.aiMessageTextColor } : undefined}>{children}</strong>,
          }}
        >
          {part}
        </ReactMarkdown>
        {index < parts.length - 1 && <SupportTicketButton onClick={onTicketButtonClick} />}
      </span>
    ));
  };

  // Detect code blocks and play sound
  useEffect(() => {
    if (role === "assistant" && !isStreaming && !hasPlayedCodeSound.current) {
      const hasCode = /```[\s\S]*?```|`[^`]+`/.test(content);
      if (hasCode) {
        hasPlayedCodeSound.current = true;
        playSound("code", 0.06);
      }
    }
  }, [content, isStreaming, role]);

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
          ) : hasSupportButton ? (
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
              {renderContent()}
            </div>
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
    </div>
  );
};
