import { useRef, useEffect, useState } from "react";
import { RefreshCw, X, MessageCircle } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatSkeleton } from "./ChatSkeleton";
import { Button } from "@/components/ui/button";
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
        className={`${bubbleClass} cursor-pointer touch-manipulation select-none rounded-full overflow-hidden bg-gradient-to-br from-primary to-blue-600 shadow-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95 flex items-center justify-center group`}
      >
        <img
          src={scholarisLogo}
          alt="Scholaris AI"
          className="w-[65%] h-[65%] rounded-full object-cover transition-transform duration-300 group-hover:scale-110"
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
            ? "fixed bottom-4 right-4 w-[380px] h-[580px] widget-container z-[9999]"
            : "w-full h-full widget-container"
          : "h-screen bg-background"
      }`}
    >
      {/* Header - Clean Apple style */}
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
              <h1 className="text-[17px] font-semibold text-white tracking-tight">
                Scholaris AI
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />
                <p className="text-[13px] text-white/80 font-medium">Online</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              title="New chat"
              className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/15 rounded-full transition-colors"
            >
              <RefreshCw className="w-[18px] h-[18px]" />
            </Button>
            {isWidget && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(true)}
                title="Close"
                className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/15 rounded-full transition-colors"
              >
                <X className="w-[18px] h-[18px]" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 scrollbar-hide bg-gradient-to-b from-background to-secondary/30">
        <div className="space-y-4">
          {!isReady ? (
            <ChatSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center animate-fade-in">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-primary/20 to-blue-100 p-1 shadow-lg shadow-primary/10 mb-5">
                <img
                  src={scholarisLogo}
                  alt="Scholaris"
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2 tracking-tight">
                Hey! I'm Scholaris 👋
              </h2>
              <p className="text-muted-foreground text-[15px] max-w-[280px] mb-6 leading-relaxed">
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
                    className="px-4 py-3 text-[14px] text-left rounded-2xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium transition-all duration-200 border border-border/50 hover:border-primary/30 hover:shadow-sm active:scale-[0.98] flex items-center gap-3"
                  >
                    <MessageCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    {suggestion}
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
                />
              ))}
            </>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl px-4 py-3 text-sm font-medium">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-3 bg-background border-t border-border/50">
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
        <p className="text-[11px] text-muted-foreground text-center mt-2.5 font-medium">
          Powered by Scholaris AI
        </p>
      </div>
    </div>
  );
};
