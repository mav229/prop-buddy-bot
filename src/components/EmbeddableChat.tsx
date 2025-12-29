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

  // Full flowing gradient for the entire widget
  const flowingGradient = `linear-gradient(180deg, ${config.headerGradientStart} 0%, ${config.headerGradientMiddle} 25%, ${config.headerGradientEnd} 50%, ${config.backgroundColor} 100%)`;

  return (
    <div
      className={`flex flex-col ${animationClass} ${
        isWidget
          ? widgetFloatingFrame
            ? `fixed bottom-4 right-4 z-[9999] ${panelAnimation}`
            : `w-full h-full ${panelAnimation}`
          : "h-screen bg-background"
      }`}
      style={{
        ...(widgetFloatingFrame ? { width: `${config.widgetWidth}px`, height: `${config.widgetHeight}px` } : {}),
        background: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <header 
        className="flex-shrink-0 relative"
        style={{ 
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
          padding: activeTab === "messages" && messages.length > 0 ? '12px 16px' : '20px',
        }}
      >
        {activeTab === "messages" && messages.length > 0 ? (
          /* Compact header */
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("home")}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <div 
              className="w-9 h-9 rounded-xl overflow-hidden bg-white/20 p-1"
            >
              <img src={launcherLogo} alt={config.botName} className="w-full h-full object-cover rounded-lg" />
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-semibold text-white">{config.botName}</h3>
              {config.showOnlineIndicator && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-[12px] text-white/70">Online</span>
                </div>
              )}
            </div>
            {isWidget && (
              <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                <X className="w-5 h-5 text-white/80" />
              </button>
            )}
          </div>
        ) : (
          /* Full header */
          <div>
            <div className="flex items-start justify-between mb-4">
              <div 
                className="w-12 h-12 rounded-2xl overflow-hidden bg-white p-1.5"
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              >
                <img src={headerLogo} alt="Logo" className="w-full h-full object-contain" />
              </div>
              {isWidget && (
                <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-white/80" />
                </button>
              )}
            </div>
            <h1 className="text-[22px] font-semibold text-white mb-0.5">
              {config.greetingText} {config.greetingEmoji}
            </h1>
            <p className="text-[18px] font-medium text-white/80">
              {config.greetingSubtext}
            </p>
          </div>
        )}
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-white">
        
        {/* HOME TAB */}
        {activeTab === "home" && (
          <div className="p-4 space-y-3">
            {/* Discord Card */}
            {config.showDiscordCard && (
              <button
                onClick={() => window.open(config.discordLink, '_blank')}
                className="w-full p-4 flex items-center justify-between rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ 
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}
              >
                <span className="text-[15px] font-semibold text-gray-800">{config.discordCardText}</span>
                <ExternalLink className="w-5 h-5 text-blue-500" />
              </button>
            )}

            {/* Message Card */}
            {config.showMessageCard && (
              <button
                onClick={() => setActiveTab("messages")}
                className="w-full p-4 flex items-center justify-between rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ 
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)'
                }}
              >
                <span className="text-[15px] font-semibold text-white">{config.messageCardText}</span>
                <Send className="w-5 h-5 text-white" />
              </button>
            )}

            {/* FAQ Section */}
            {config.showHelpSearch && (
              <div className="rounded-2xl overflow-hidden" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                  <span className="text-[15px] font-semibold text-gray-800">Frequently Asked</span>
                  <Search className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  {config.suggestedQuestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSendMessage(suggestion)}
                      className="w-full px-4 py-3.5 flex items-center justify-between text-left border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-[14px] text-gray-600">{suggestion}</span>
                      <span className="text-gray-300 text-lg">›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MESSAGES TAB */}
        {activeTab === "messages" && (
          <div className="flex flex-col h-full bg-white">
            <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto scrollbar-hide">
              {!isReady ? (
                <ChatSkeleton />
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
                  <div 
                    className="w-16 h-16 rounded-2xl overflow-hidden bg-blue-50 p-2 mb-4"
                    style={{ border: '1px solid #dbeafe' }}
                  >
                    <img src={headerLogo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[14px] text-gray-500 max-w-[240px]">
                    Ask me anything about PropScholar trading, evaluations, or payouts.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((message, index) => (
                    <ChatMessage
                      key={message.id}
                      role={message.role}
                      content={message.content}
                      isStreaming={isLoading && index === messages.length - 1 && message.role === "assistant"}
                      isWidget={true}
                    />
                  ))}
                </>
              )}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* HELP TAB */}
        {activeTab === "help" && (
          <div className="p-4 space-y-3">
            {/* Support Card */}
            {config.showSupportCard && (
              <a
                href={`mailto:${config.supportEmail}`}
                className="block w-full p-4 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ 
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[15px] font-semibold text-white block">Open Support Ticket</span>
                    <span className="text-[13px] text-white/70">{config.supportEmail}</span>
                  </div>
                  <Send className="w-5 h-5 text-white" />
                </div>
              </a>
            )}

            {/* FAQ */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="text-[15px] font-semibold text-gray-800">Frequently Asked</span>
              </div>
              <div>
                {config.suggestedQuestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSendMessage(suggestion)}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-left border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-[14px] text-gray-600">{suggestion}</span>
                    <span className="text-gray-300 text-lg">›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      {activeTab === "messages" && (
        <div className="flex-shrink-0 px-4 pb-3 pt-2 border-t bg-white" style={{ borderColor: '#e5e7eb' }}>
          <ChatInput onSend={handleSendMessage} isLoading={isLoading} isWidget={true} />
        </div>
      )}

      {/* Bottom Navigation Tabs */}
      <div 
        className="flex-shrink-0 border-t px-4 py-2"
        style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}
      >
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveTab("home")}
            className="flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors"
            style={{ color: activeTab === "home" ? '#3b82f6' : '#9ca3af' }}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className="flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors"
            style={{ color: activeTab === "messages" ? '#3b82f6' : '#9ca3af' }}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-medium">Messages</span>
          </button>
          <button
            onClick={() => setActiveTab("help")}
            className="flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors"
            style={{ color: activeTab === "help" ? '#3b82f6' : '#9ca3af' }}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-xs font-medium">Help</span>
          </button>
        </div>
        {config.showFooter && (
          <p className="text-[10px] text-center mt-1 font-medium text-gray-400">
            {config.footerText}
          </p>
        )}
      </div>
    </div>
  );
};
