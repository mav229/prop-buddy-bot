import { useRef, useEffect, useState } from "react";
import { RefreshCw, X, MessageCircle } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatSkeleton } from "./ChatSkeleton";
import scholarisLogo from "@/assets/scholaris-logo.png";

interface EmbeddableChatProps {
  isWidget?: boolean;
}

export const EmbeddableChat = ({ isWidget = false }: EmbeddableChatProps) => {
  const { messages, isLoading, error, sendMessage, clearChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // In widget mode we start minimized (bubble) and expand on click.
  const [isMinimized, setIsMinimized] = useState<boolean>(isWidget);

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

  // Widget mode - minimized bubble
  if (isWidget && isMinimized) {
    const bubbleClass = inIframe
      ? "w-full h-full"
      : "fixed bottom-4 right-4 w-14 h-14 sm:w-16 sm:h-16 z-[9999]";

    return (
      <button
        type="button"
        aria-label="Open Scholaris AI chat widget"
        onClick={() => setIsMinimized(false)}
        className={`${bubbleClass} cursor-pointer touch-manipulation select-none rounded-full overflow-hidden border-0 outline-none ring-0 transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center animate-soft-pulse`}
        style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)' }}
      >
        <img
          src={scholarisLogo}
          alt="Scholaris AI"
          className="w-full h-full rounded-full object-cover"
          draggable={false}
        />
      </button>
    );
  }

  const widgetFloatingFrame = isWidget && !inIframe;

  return (
    <div
      className={`flex flex-col ${
        isWidget
          ? widgetFloatingFrame
            ? "fixed bottom-4 right-4 w-[380px] h-[580px] widget-container z-[9999] animate-chat-open"
            : "w-full h-full widget-container animate-chat-open"
          : "h-screen bg-background"
      }`}
    >
      {/* Header - Clean Apple style blue */}
      <header className="flex-shrink-0 widget-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-white/20 backdrop-blur-sm p-0.5 shadow-lg">
              <img
                src={scholarisLogo}
                alt="Scholaris"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-white tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif' }}>
                Scholaris AI
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />
                <p className="text-[13px] text-white/80 font-medium">Online</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={clearChat}
              title="New chat"
              className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/15 rounded-full transition-colors flex items-center justify-center"
            >
              <RefreshCw className="w-[18px] h-[18px]" />
            </button>
            {isWidget && (
              <button
                onClick={() => setIsMinimized(true)}
                title="Close"
                className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/15 rounded-full transition-colors flex items-center justify-center"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Messages - Light background for widget */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-5 scrollbar-hide"
        style={{ background: 'linear-gradient(to bottom, hsl(220 20% 97%), hsl(220 14% 94%))' }}
      >
        <div className="space-y-4">
          {!isReady ? (
            <ChatSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center animate-fade-in">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#007AFF]/20 to-blue-100 p-1 shadow-lg shadow-blue-500/10 mb-5">
                <img
                  src={scholarisLogo}
                  alt="Scholaris"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2 tracking-tight" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif' }}>
                Hey! I'm Scholaris 👋
              </h2>
              <p className="text-gray-500 text-[15px] max-w-[280px] mb-6 leading-relaxed">
                Your AI assistant for PropScholar. Ask me anything about evaluations, payouts, or trading.
              </p>
              <div className="grid grid-cols-1 gap-2.5 w-full max-w-[300px]">
                {[
                  "What are the drawdown rules?",
                  "How do payouts work?",
                  "Tell me about evaluations",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="widget-suggestion px-4 py-3 text-[14px] text-left font-medium flex items-center gap-3 active:scale-[0.98]"
                  >
                    <MessageCircle className="w-4 h-4 text-[#007AFF] flex-shrink-0" />
                    <span className="text-gray-700">{suggestion}</span>
                  </button>
                ))}
              </div>
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
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3 text-sm font-medium">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-3 widget-input">
        <ChatInput onSend={sendMessage} isLoading={isLoading} isWidget={true} />
        <p className="text-[11px] text-gray-400 text-center mt-2.5 font-medium">
          Powered by Scholaris AI
        </p>
      </div>
    </div>
  );
};
