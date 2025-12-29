import { useRef, useEffect, useState } from "react";
import { X, MessageCircle, Send, Search, Home, HelpCircle, ExternalLink, ChevronLeft, MoreHorizontal } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatSkeleton } from "./ChatSkeleton";
import scholarisLogo from "@/assets/scholaris-logo.png";
import propscholarLogo from "@/assets/propscholar-logo.jpg";

interface EmbeddableChatProps {
  isWidget?: boolean;
}

type TabType = "home" | "messages" | "help";

export const EmbeddableChat = ({ isWidget = false }: EmbeddableChatProps) => {
  const { messages, isLoading, error, sendMessage, clearChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // Animation states - simplified for smooth transitions
  const [isMinimized, setIsMinimized] = useState<boolean>(isWidget);
  const [isClosing, setIsClosing] = useState(false);

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

  // Widget mode - minimized bubble
  if (isWidget && isMinimized) {
    const bubbleClass = inIframe
      ? "w-full h-full"
      : "fixed bottom-4 right-4 w-14 h-14 sm:w-16 sm:h-16 z-[9999]";

    return (
      <button
        type="button"
        aria-label="Open PropScholar chat widget"
        onClick={handleOpen}
        className={`${bubbleClass} cursor-pointer touch-manipulation select-none rounded-full overflow-hidden border-0 outline-none ring-0 flex items-center justify-center launcher-button`}
      >
        <div className="launcher-ambient-glow" />
        <img
          src={scholarisLogo}
          alt="PropScholar"
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

  return (
    <div
      className={`flex flex-col ${
        isWidget
          ? widgetFloatingFrame
            ? `fixed bottom-4 right-4 w-[380px] h-[600px] widget-container z-[9999] ${panelAnimation}`
            : `w-full h-full widget-container ${panelAnimation}`
          : "h-screen bg-background"
      }`}
    >
      {/* Header - Conditional based on chat state */}
      {activeTab === "messages" && messages.length > 0 ? (
        /* Compact chat header when messages exist */
        <header className="flex-shrink-0 px-4 py-3 flex items-center gap-3 bg-white border-b border-gray-100 header-transition">
          <button
            onClick={() => setActiveTab("home")}
            className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-sm">
            <img
              src={scholarisLogo}
              alt="Scholaris AI"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-gray-900">Scholaris AI</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/50" />
              <p className="text-[13px] text-gray-500">Online</p>
            </div>
          </div>
          <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <MoreHorizontal className="w-5 h-5" />
          </button>
          {isWidget && (
            <button
              onClick={handleClose}
              title="Close"
              className="h-8 w-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex items-center justify-center close-button"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </header>
      ) : (
        /* Full greeting header when no messages */
        <header className="flex-shrink-0 px-5 pt-5 pb-6 relative overflow-hidden header-transition" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f1c2e 50%, #0a1628 100%)' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/5" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-blue-400/20 to-blue-600/20 backdrop-blur-sm shadow-lg shadow-blue-500/20">
                <img
                  src={propscholarLogo}
                  alt="PropScholar"
                  className="w-full h-full object-cover"
                />
              </div>
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
            <h1 className="text-2xl font-semibold text-blue-200 mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif' }}>
              Hello Trader! 👋
            </h1>
            <p className="text-xl font-semibold text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif' }}>
              How can I help?
            </p>
          </div>
        </header>
      )}

      {/* Content Area */}
      <div 
        className="flex-1 overflow-y-auto scrollbar-hide bg-gray-50"
      >
        {activeTab === "home" && (
          <div className="p-4 space-y-3 animate-fade-in">
            {/* Action Cards */}
            <button
              onClick={() => window.open('https://www.discord.com/invite/discord', '_blank')}
              className="w-full bg-white rounded-xl px-4 py-3.5 flex items-center justify-between shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-[0.99]"
            >
              <span className="text-[15px] font-semibold text-gray-900">JOIN DISCORD</span>
              <ExternalLink className="w-5 h-5 text-blue-500" />
            </button>

            <button
              onClick={() => setActiveTab("messages")}
              className="w-full bg-white rounded-xl px-4 py-3.5 flex items-center justify-between shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-[0.99]"
            >
              <span className="text-[15px] font-semibold text-gray-900">Send us a message</span>
              <Send className="w-5 h-5 text-blue-500" />
            </button>

            {/* Search/Help Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                <span className="text-[15px] font-medium text-gray-700">Search for help</span>
                <Search className="w-5 h-5 text-gray-400 ml-auto" />
              </div>
              
              {/* Help suggestions */}
              <div className="divide-y divide-gray-50">
                {[
                  "How PropScholar works?",
                  "What are the drawdown rules?",
                  "How do payouts work?",
                  "Tell me about evaluations",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSendMessage(suggestion)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left active:bg-gray-100"
                  >
                    <span className="text-[14px] text-gray-600">{suggestion}</span>
                    <span className="text-gray-300">›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "messages" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto scrollbar-hide" style={{ background: 'linear-gradient(to bottom, hsl(220 20% 97%), hsl(220 14% 96%))' }}>
              {!isReady ? (
                <ChatSkeleton />
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center animate-fade-in">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500/20 to-blue-600/20 shadow-lg shadow-blue-500/10 mb-4">
                    <img
                      src={propscholarLogo}
                      alt="PropScholar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-gray-500 text-[14px] max-w-[260px]">
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
                      isStreaming={
                        isLoading &&
                        index === messages.length - 1 &&
                        message.role === "assistant"
                      }
                      isWidget={true}
                    />
                  ))}
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm font-medium">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {activeTab === "help" && (
          <div className="p-4 animate-fade-in space-y-3">
            {/* Support Ticket Card */}
            <a
              href="mailto:support@propscholar.com"
              className="w-full bg-white rounded-xl px-4 py-4 flex items-center justify-between shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-[0.99] block"
            >
              <div>
                <span className="text-[15px] font-semibold text-gray-900 block">Open Support Ticket</span>
                <span className="text-[13px] text-gray-500">support@propscholar.com</span>
              </div>
              <Send className="w-5 h-5 text-blue-500" />
            </a>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="text-[15px] font-semibold text-gray-900">Frequently Asked</span>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  "How PropScholar works?",
                  "What are the drawdown rules?",
                  "How do payouts work?",
                  "Tell me about evaluations",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSendMessage(suggestion)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left active:bg-gray-100"
                  >
                    <span className="text-[14px] text-gray-600">{suggestion}</span>
                    <span className="text-gray-300">›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area - only show on messages tab */}
      {activeTab === "messages" && (
        <div className="flex-shrink-0 px-4 pb-2 pt-2 bg-gray-50 border-t border-gray-100">
          <ChatInput onSend={handleSendMessage} isLoading={isLoading} isWidget={true} />
        </div>
      )}

      {/* Bottom Navigation Tabs */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-bottom">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
              activeTab === "home" ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
              activeTab === "messages" ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-xs font-medium">Messages</span>
          </button>
          <button
            onClick={() => setActiveTab("help")}
            className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
              activeTab === "help" ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-xs font-medium">Help</span>
          </button>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-1 font-medium">
          Powered by PropScholar
        </p>
      </div>
    </div>
  );
};
