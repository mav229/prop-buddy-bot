import { useRef, useEffect, useState } from "react";
import { RefreshCw, Minus, X } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Button } from "@/components/ui/button";
import scholarisLogo from "@/assets/scholaris-logo.png";

interface EmbeddableChatProps {
  isWidget?: boolean;
}

export const EmbeddableChat = ({ isWidget = false }: EmbeddableChatProps) => {
  const { messages, isLoading, error, sendMessage, clearChat } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // In widget mode we start minimized (bubble) and expand on click.
  const [isMinimized, setIsMinimized] = useState<boolean>(isWidget);

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Allow host page to force open/close (fallback for click issues on some sites/mobile).
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

  // Tell the parent page to resize the iframe when we expand/minimize.
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
    // When embedded, the iframe itself is already sized to the bubble.
    // When previewed as a full page (/widget), render a floating bubble bottom-right.
    const bubbleClass = inIframe
      ? "w-full h-full"
      : "fixed bottom-4 right-4 w-20 h-20 z-50";

    return (
      <button
        type="button"
        aria-label="Open Scholaris AI chat widget"
        onClick={() => setIsMinimized(false)}
        className={`${bubbleClass} cursor-pointer touch-manipulation select-none rounded-full overflow-hidden bg-gradient-to-br from-primary to-accent shadow-2xl transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center`}
      >
        <img
          src={scholarisLogo}
          alt="Scholaris AI chat widget logo"
          className="w-[70%] h-[70%] rounded-full object-cover"
          draggable={false}
        />
      </button>
    );
  }

  const widgetFloatingFrame = isWidget && !inIframe;

  return (
    <div
      className={`flex flex-col bg-background ${
        isWidget
          ? widgetFloatingFrame
            ? "fixed bottom-4 right-4 w-[384px] h-[600px] rounded-2xl shadow-2xl border border-border/50 overflow-hidden z-50"
            : "w-full h-full rounded-2xl shadow-2xl border border-border/50 overflow-hidden"
          : "h-screen"
      }`}
    >
      {/* Header */}
      <header className="flex-shrink-0 bg-gradient-to-r from-[#0a1628] to-[#0d1d35] border-b border-primary/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary/50 shadow-lg shadow-primary/20">
              <img
                src={scholarisLogo}
                alt="Scholaris"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-white">
                Scholaris AI
              </h1>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <p className="text-xs text-primary/80">Online • Ready to help</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              title="Clear chat"
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isWidget && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(true)}
                  title="Minimize"
                  className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(true)}
                  title="Close"
                  className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide bg-gradient-to-b from-[#050d1a] to-[#0a1628]">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center animate-fade-in">
              <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-primary/30 shadow-2xl shadow-primary/30 mb-4">
                <img
                  src={scholarisLogo}
                  alt="Scholaris"
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="font-display text-xl font-bold text-white mb-2">
                Hey! I'm Scholaris 👋
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs mb-6">
                Your AI assistant for PropScholar. Ask me anything about evaluations,
                payouts, or trading.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
                {[
                  "What are the drawdown rules?",
                  "How do payouts work?",
                  "Tell me about evaluations",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="px-4 py-2.5 text-sm text-left rounded-xl bg-primary/10 hover:bg-primary/20 text-white/90 transition-colors duration-200 border border-primary/20"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

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

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2 bg-[#050d1a] border-t border-primary/20">
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Powered by Scholaris AI
        </p>
      </div>
    </div>
  );
};
