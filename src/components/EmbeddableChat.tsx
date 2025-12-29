import { useRef, useEffect, useState } from "react";
import { X, MessageCircle, Send, Search, Home, HelpCircle, ExternalLink, ChevronLeft, MoreHorizontal } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatSkeleton } from "./ChatSkeleton";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";
import scholarisLogo from "@/assets/scholaris-logo.png";
import propscholarLogo from "@/assets/propscholar-logo.jpg";

interface EmbeddableChatProps {
  isWidget?: boolean;
}

type TabType = "home" | "messages" | "help";

export const EmbeddableChat = ({ isWidget = false }: EmbeddableChatProps) => {
  const { messages, isLoading, error, sendMessage, clearChat } = useChat();
  const { config } = useWidgetConfig();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // Animation states - simplified for smooth transitions
  const [isMinimized, setIsMinimized] = useState<boolean>(isWidget);
  const [isClosing, setIsClosing] = useState(false);

  // Use config logos or fallback to defaults
  const headerLogo = config.logoUrl || propscholarLogo;
  const launcherLogo = config.launcherLogoUrl || scholarisLogo;

  const handleOpen = () => {
    setIsMinimized(false);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsMinimized(true);
    }, 180);
  };

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  // Simulate initial load
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Allow host page to force open/close
  useEffect(() => {
    if (!isWidget || !inIframe) return;

    const onMessage = (e: MessageEvent) => {
      if (!e?.data || typeof e.data !== "object") return;
      const data = e.data as { type?: string; action?: string };
      if (data.type !== "scholaris:host") return;
      if (data.action === "expand") setIsMinimized(false);
      if (data.action === "minimize") setIsMinimized(true);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isWidget, inIframe]);

  // Tell the parent page to resize the iframe
  useEffect(() => {
    if (!isWidget || !inIframe) return;
    try {
      window.parent?.postMessage(
        {
          type: "scholaris:widget",
          action: isMinimized ? "minimized" : "expanded",
        },
        "*"
      );
    } catch {
      // ignore cross-origin errors
    }
  }, [isMinimized, isWidget, inIframe]);

  // Switch to messages tab when a message is sent
  const handleSendMessage = (msg: string) => {
    sendMessage(msg);
    setActiveTab("messages");
  };

  // Animation classes
  const animationClass = config.enableAnimations ? "" : "!animation-none";

  // Widget mode - minimized bubble
  if (isWidget && isMinimized) {
    const bubbleClass = inIframe
      ? "w-full h-full"
      : "fixed bottom-4 right-4 w-14 h-14 sm:w-16 sm:h-16 z-[9999]";

    return (
      <button
        type="button"
        aria-label="Open chat widget"
        onClick={handleOpen}
        className={`${bubbleClass} cursor-pointer touch-manipulation select-none rounded-full overflow-hidden border-0 outline-none ring-0 flex items-center justify-center launcher-button`}
      >
        <div className="launcher-ambient-glow" />
        <img
          src={launcherLogo}
          alt="Chat"
          className="w-full h-full rounded-full object-cover relative z-10 active:scale-95 transition-transform duration-100"
          draggable={false}
        />
      </button>
    );
  }

  const widgetFloatingFrame = isWidget && !inIframe;
  const panelAnimation = isClosing 
    ? "panel-close" 
    : "panel-open";

  // Dynamic styles from config
  const headerGradient = `linear-gradient(${config.headerGradientAngle}deg, ${config.headerGradientStart} 0%, ${config.headerGradientMiddle} 50%, ${config.headerGradientEnd} 100%)`;
  const supportCardGradient = `linear-gradient(90deg, ${config.supportCardGradientStart}, ${config.supportCardGradientEnd})`;

  return (
    <div
      className={`flex flex-col ${animationClass} ${
        isWidget
          ? widgetFloatingFrame
            ? `fixed bottom-4 right-4 widget-container z-[9999] ${panelAnimation}`
            : `w-full h-full widget-container ${panelAnimation}`
          : "h-screen bg-background"
      }`}
      style={widgetFloatingFrame ? { width: `${config.widgetWidth}px`, height: `${config.widgetHeight}px` } : {}}
    >
      {/* Header - Conditional based on chat state */}
      {activeTab === "messages" && messages.length > 0 ? (
        /* Compact chat header when messages exist */
        <header 
          className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b header-transition"
          style={{ backgroundColor: config.cardBackgroundColor, borderColor: `${config.mutedTextColor}20` }}
        >
          <button
            onClick={() => setActiveTab("home")}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{ color: config.mutedTextColor }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div 
            className="overflow-hidden flex items-center justify-center shadow-sm"
            style={{ 
              width: `${config.logoSize * 0.83}px`, 
              height: `${config.logoSize * 0.83}px`,
              borderRadius: `${config.logoBorderRadius}px`
            }}
          >
            <img
              src={launcherLogo}
              alt={config.botName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold" style={{ color: config.textColor }}>{config.botName}</h3>
            {config.showOnlineIndicator && (
              <div className="flex items-center gap-1.5">
                <span 
                  className="w-2 h-2 rounded-full online-pulse" 
                  style={{ backgroundColor: config.onlineIndicatorColor }}
                />
                <p className="text-[13px]" style={{ color: config.mutedTextColor }}>{config.botSubtitle}</p>
              </div>
            )}
          </div>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{ color: config.mutedTextColor }}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          {isWidget && (
            <button
              onClick={handleClose}
              title="Close"
              className="h-8 w-8 rounded-full transition-colors flex items-center justify-center close-button"
              style={{ color: config.mutedTextColor }}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </header>
      ) : (
        /* Full greeting header when no messages */
        <header 
          className="flex-shrink-0 px-5 pt-5 pb-6 relative overflow-hidden header-transition" 
          style={{ background: headerGradient }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/5" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              {config.showLogo && (
                <div 
                  className="overflow-hidden bg-gradient-to-br from-blue-400/20 to-blue-600/20 backdrop-blur-sm shadow-lg shadow-blue-500/20 logo-float"
                  style={{ 
                    width: `${config.logoSize}px`, 
                    height: `${config.logoSize}px`,
                    borderRadius: `${config.logoBorderRadius}px`
                  }}
                >
                  <img
                    src={headerLogo}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {isWidget && (
                <button
                  onClick={handleClose}
                  title="Close"
                  className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors flex items-center justify-center close-button"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <h1 
              className="text-2xl font-semibold mb-1" 
              style={{ 
                color: config.greetingTextColor,
                fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif' 
              }}
            >
              {config.greetingText} {config.greetingEmoji}
            </h1>
            <p 
              className="text-xl font-semibold" 
              style={{ 
                color: config.greetingSubtextColor,
                fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif' 
              }}
            >
              {config.greetingSubtext}
            </p>
          </div>
        </header>
      )}

      {/* Content Area */}
      <div 
        className="flex-1 overflow-y-auto scrollbar-hide"
        style={{ backgroundColor: config.backgroundColor }}
      >
        {activeTab === "home" && (
          <div className="p-4 space-y-3 content-fade">
            {/* Discord Card */}
            {config.showDiscordCard && (
              <button
                onClick={() => window.open(config.discordLink, '_blank')}
                className="w-full px-4 py-3.5 flex items-center justify-between shadow-sm border premium-card stagger-item stagger-1"
                style={{ 
                  backgroundColor: config.cardBackgroundColor,
                  borderRadius: `${config.cardBorderRadius}px`,
                  borderColor: `${config.mutedTextColor}20`
                }}
              >
                <span className="text-[15px] font-semibold" style={{ color: config.textColor }}>{config.discordCardText}</span>
                <ExternalLink className="w-5 h-5" style={{ color: config.primaryColor }} />
              </button>
            )}

            {/* Message Card */}
            {config.showMessageCard && (
              <button
                onClick={() => setActiveTab("messages")}
                className="w-full px-4 py-3.5 flex items-center justify-between shadow-sm border premium-card stagger-item stagger-2"
                style={{ 
                  backgroundColor: config.cardBackgroundColor,
                  borderRadius: `${config.cardBorderRadius}px`,
                  borderColor: `${config.mutedTextColor}20`
                }}
              >
                <span className="text-[15px] font-semibold" style={{ color: config.textColor }}>{config.messageCardText}</span>
                <Send className="w-5 h-5" style={{ color: config.primaryColor }} />
              </button>
            )}

            {/* Search/Help Section */}
            {config.showHelpSearch && (
              <div 
                className="shadow-sm border overflow-hidden stagger-item stagger-3"
                style={{ 
                  backgroundColor: config.cardBackgroundColor,
                  borderRadius: `${config.cardBorderRadius}px`,
                  borderColor: `${config.mutedTextColor}20`
                }}
              >
                <div 
                  className="px-4 py-3 border-b flex items-center gap-3"
                  style={{ borderColor: `${config.mutedTextColor}15` }}
                >
                  <span className="text-[15px] font-medium" style={{ color: config.textColor }}>{config.helpSearchText}</span>
                  <Search className="w-5 h-5 ml-auto" style={{ color: config.mutedTextColor }} />
                </div>
                
                {/* Help suggestions */}
                <div className="divide-y" style={{ borderColor: `${config.mutedTextColor}10` }}>
                  {config.suggestedQuestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSendMessage(suggestion)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left help-item"
                    >
                      <span className="text-[14px]" style={{ color: config.mutedTextColor }}>{suggestion}</span>
                      <span style={{ color: `${config.mutedTextColor}60` }}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "messages" && (
          <div className="flex flex-col h-full">
            <div 
              className="flex-1 px-4 py-4 space-y-4 overflow-y-auto scrollbar-hide" 
              style={{ background: `linear-gradient(to bottom, ${config.backgroundColor}, ${config.backgroundColor}ee)` }}
            >
              {!isReady ? (
                <ChatSkeleton />
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center content-fade">
                  <div 
                    className="overflow-hidden shadow-lg mb-4 logo-float"
                    style={{ 
                      width: '64px', 
                      height: '64px',
                      borderRadius: `${config.logoBorderRadius}px`,
                      background: `linear-gradient(135deg, ${config.primaryColor}20, ${config.accentColor}20)`
                    }}
                  >
                    <img
                      src={headerLogo}
                      alt="Logo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-[14px] max-w-[260px]" style={{ color: config.mutedTextColor }}>
                    Ask me anything about PropScholar trading, evaluations, or payouts.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <div key={message.id} className="message-bubble">
                      <ChatMessage
                        role={message.role}
                        content={message.content}
                        isStreaming={
                          isLoading &&
                          index === messages.length - 1 &&
                          message.role === "assistant"
                        }
                        isWidget={true}
                      />
                    </div>
                  ))}
                </>
              )}

              {error && (
                <div 
                  className="border text-sm font-medium px-4 py-3"
                  style={{ 
                    backgroundColor: '#fef2f2', 
                    borderColor: '#fecaca', 
                    color: '#dc2626',
                    borderRadius: `${config.cardBorderRadius}px`
                  }}
                >
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {activeTab === "help" && (
          <div className="p-4 content-fade space-y-3">
            {/* Support Ticket Card */}
            {config.showSupportCard && (
              <a
                href={`mailto:${config.supportEmail}`}
                className="w-full px-4 py-4 flex items-center justify-between shadow-lg premium-card stagger-item stagger-1 block"
                style={{ 
                  background: supportCardGradient,
                  borderRadius: `${config.cardBorderRadius}px`,
                  boxShadow: `0 10px 15px -3px ${config.supportCardGradientStart}30`
                }}
              >
                <div>
                  <span className="text-[15px] font-semibold text-white block">Open Support Ticket</span>
                  <span className="text-[13px] text-white/80">{config.supportEmail}</span>
                </div>
                <Send className="w-5 h-5 text-white" />
              </a>
            )}

            <div 
              className="shadow-sm border overflow-hidden stagger-item stagger-2"
              style={{ 
                backgroundColor: config.cardBackgroundColor,
                borderRadius: `${config.cardBorderRadius}px`,
                borderColor: `${config.mutedTextColor}20`
              }}
            >
              <div 
                className="px-4 py-3 border-b"
                style={{ borderColor: `${config.mutedTextColor}15` }}
              >
                <span className="text-[15px] font-semibold" style={{ color: config.textColor }}>Frequently Asked</span>
              </div>
              <div className="divide-y" style={{ borderColor: `${config.mutedTextColor}10` }}>
                {config.suggestedQuestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSendMessage(suggestion)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left help-item"
                  >
                    <span className="text-[14px]" style={{ color: config.mutedTextColor }}>{suggestion}</span>
                    <span style={{ color: `${config.mutedTextColor}60` }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area - only show on messages tab */}
      {activeTab === "messages" && (
        <div 
          className="flex-shrink-0 px-4 pb-2 pt-2 border-t input-premium"
          style={{ backgroundColor: config.backgroundColor, borderColor: `${config.mutedTextColor}20` }}
        >
          <ChatInput onSend={handleSendMessage} isLoading={isLoading} isWidget={true} />
        </div>
      )}

      {/* Bottom Navigation Tabs */}
      <div 
        className="flex-shrink-0 border-t px-4 py-2 safe-area-bottom"
        style={{ backgroundColor: config.cardBackgroundColor, borderColor: `${config.mutedTextColor}20` }}
      >
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg tab-button ${activeTab === "home" ? "active" : ""}`}
            style={{ color: activeTab === "home" ? config.activeTabColor : config.inactiveTabColor }}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg tab-button ${activeTab === "messages" ? "active" : ""}`}
            style={{ color: activeTab === "messages" ? config.activeTabColor : config.inactiveTabColor }}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-medium">Messages</span>
          </button>
          <button
            onClick={() => setActiveTab("help")}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg tab-button ${activeTab === "help" ? "active" : ""}`}
            style={{ color: activeTab === "help" ? config.activeTabColor : config.inactiveTabColor }}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-xs font-medium">Help</span>
          </button>
        </div>
        {config.showFooter && (
          <p 
            className="text-[10px] text-center mt-1 font-medium"
            style={{ color: config.mutedTextColor }}
          >
            {config.footerText}
          </p>
        )}
      </div>
    </div>
  );
};
