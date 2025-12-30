import { useRef, useEffect, useState, useCallback } from "react";
import { X, MessageCircle, Send, Search, Home, HelpCircle, ExternalLink, ChevronRight, ShoppingBag, Clock } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ChatSkeleton, CardSkeleton } from "./ChatSkeleton";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";
import scholarisLogo from "@/assets/scholaris-logo.png";
import propscholarLogo from "@/assets/propscholar-logo.jpg";
import { cn } from "@/lib/utils";

interface EmbeddableChatProps {
  isWidget?: boolean;
}

type TabType = "home" | "messages" | "help";

export const EmbeddableChat = ({ isWidget = false }: EmbeddableChatProps) => {
  const { messages, isLoading, error, sendMessage } = useChat();
  const { config } = useWidgetConfig();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [isMinimized, setIsMinimized] = useState<boolean>(isWidget);
  const [isClosing, setIsClosing] = useState(false);

  const headerLogo = config.logoUrl || propscholarLogo;
  const launcherLogo = config.launcherLogoUrl || scholarisLogo;

  const handleOpen = () => setIsMinimized(false);
  
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsMinimized(true);
    }, 300);
  };

  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();

  useEffect(() => {
    if (!isWidget) return;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [isWidget]);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  useEffect(() => {
    if (!isWidget || !inIframe) return;
    try { window.parent?.postMessage({ type: "scholaris:widget", action: isMinimized ? "minimized" : "expanded" }, "*"); } catch {}
  }, [isMinimized, isWidget, inIframe]);

  const handleSendMessage = (msg: string) => {
    sendMessage(msg);
    setActiveTab("messages");
  };

  // Get last message for recent conversation preview
  const lastAssistantMessage = messages.filter(m => m.role === "assistant").slice(-1)[0];
  const lastUserMessage = messages.filter(m => m.role === "user").slice(-1)[0];

  // Minimized launcher
  if (isWidget && isMinimized) {
    return (
      <div className={cn(inIframe ? "w-full h-full" : "fixed bottom-6 right-4 z-[9999]", "flex items-center justify-center")}>
        <div className="relative" style={{ width: 56, height: 56 }}>
          <div className="glow-ring" />
          <button
            onClick={handleOpen}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden launcher-btn relative z-10"
          >
            <img src={launcherLogo} alt="Chat" className="w-full h-full object-cover" draggable={false} />
          </button>
        </div>
      </div>
    );
  }

  const widgetFloatingFrame = isWidget && !inIframe;
  const panelClass = isClosing ? "panel-close" : "panel-open";

  return (
    <div
      className={cn(
        "widget-glass flex flex-col",
        isWidget ? widgetFloatingFrame ? `fixed bottom-6 right-4 z-[9999] ${panelClass}` : `w-full h-full ${panelClass}` : "h-screen bg-background"
      )}
      style={{
        ...(widgetFloatingFrame ? { width: config.widgetWidth, height: config.widgetHeight } : {}),
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 16px 40px -12px rgba(0,0,0,0.25)",
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {/* HEADER - Thin glassmorphic */}
      <header
        className="flex-shrink-0 relative"
        style={{
          background: "linear-gradient(135deg, rgba(102,126,234,0.95) 0%, rgba(118,75,162,0.95) 100%)",
          backdropFilter: "blur(16px)",
          padding: activeTab === "messages" && messages.length > 0 ? "12px 14px" : "18px 16px 22px",
        }}
      >
        {activeTab === "messages" && messages.length > 0 ? (
          <div className="flex items-center gap-2.5 content-fade">
            <button onClick={() => setActiveTab("home")} className="w-7 h-7 flex items-center justify-center rounded-full close-btn">
              <ChevronRight className="w-4 h-4 text-white/80 rotate-180" strokeWidth={1.5} />
            </button>
            <div className="w-8 h-8 rounded-xl overflow-hidden glass-surface-subtle p-0.5">
              <img src={launcherLogo} alt={config.botName} className="w-full h-full object-cover rounded-lg" />
            </div>
            <div className="flex-1">
              <p className="text-thin text-[13px] text-white">{config.botName}</p>
              {config.showOnlineIndicator && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 online-dot" />
                  <span className="text-ultra-thin text-[10px] text-white/60">Online</span>
                </div>
              )}
            </div>
            {isWidget && (
              <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-full close-btn">
                <X className="w-4 h-4 text-white/70" strokeWidth={1.5} />
              </button>
            )}
          </div>
        ) : (
          <div className="content-fade">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden glass-surface-subtle p-0.5 logo-float">
                <img src={headerLogo} alt="Logo" className="w-full h-full object-cover rounded-lg" />
              </div>
              {isWidget && (
                <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-full close-btn">
                  <X className="w-4 h-4 text-white/70" strokeWidth={1.5} />
                </button>
              )}
            </div>
            <h1 className="text-thin text-[22px] text-white leading-tight">
              {config.greetingText} {config.greetingEmoji}
            </h1>
            <p className="text-ultra-thin text-[14px] text-white/70 mt-0.5">
              {config.greetingSubtext}
            </p>
          </div>
        )}
      </header>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: "rgba(250,250,252,0.8)" }}>
        
        {/* HOME */}
        {activeTab === "home" && (
          <div className="p-3 space-y-2 content-fade">
            {!isReady ? <CardSkeleton /> : (
              <>
                {/* Recent Conversation */}
                {(lastAssistantMessage || lastUserMessage) && (
                  <button
                    onClick={() => setActiveTab("messages")}
                    className="w-full p-3 rounded-xl text-left card-hover stagger-item stagger-1 glass-card"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />
                      <span className="text-ultra-thin text-[10px] text-gray-400 uppercase tracking-wide">Recent conversation</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
                        <img src={launcherLogo} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-thin text-[12px] text-gray-700 line-clamp-2">
                          {lastAssistantMessage?.content?.slice(0, 80) || lastUserMessage?.content?.slice(0, 80)}...
                        </p>
                        <span className="text-ultra-thin text-[10px] text-gray-400">Tap to continue</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" strokeWidth={1.5} />
                    </div>
                  </button>
                )}

                <button
                  onClick={() => window.open("https://www.propscholar.com/shop", "_blank")}
                  className="w-full px-4 py-3 flex items-center justify-between rounded-xl card-hover stagger-item stagger-1 glass-card"
                >
                  <span className="text-thin text-[13px] text-gray-700">Shop Now</span>
                  <ShoppingBag className="w-4 h-4 text-indigo-400" strokeWidth={1.5} />
                </button>

                {config.showDiscordCard && (
                  <button
                    onClick={() => window.open(config.discordLink, "_blank")}
                    className="w-full px-4 py-3 flex items-center justify-between rounded-xl card-hover stagger-item stagger-2 glass-card"
                  >
                    <span className="text-thin text-[13px] text-gray-700">{config.discordCardText}</span>
                    <ExternalLink className="w-4 h-4 text-indigo-400" strokeWidth={1.5} />
                  </button>
                )}

                {config.showMessageCard && (
                  <button
                    onClick={() => setActiveTab("messages")}
                    className="w-full px-4 py-3 flex items-center justify-between rounded-xl card-hover stagger-item stagger-3"
                    style={{ 
                      background: "linear-gradient(135deg, rgba(102,126,234,0.9) 0%, rgba(118,75,162,0.9) 100%)",
                      boxShadow: "0 6px 20px -6px rgba(102, 126, 234, 0.4)"
                    }}
                  >
                    <span className="text-thin text-[13px] text-white">{config.messageCardText}</span>
                    <ChevronRight className="w-4 h-4 text-white/70" strokeWidth={1.5} />
                  </button>
                )}

                {config.showHelpSearch && (
                  <div className="rounded-xl overflow-hidden stagger-item stagger-4 glass-card">
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                      <span className="text-ultra-thin text-[11px] text-gray-400 uppercase tracking-wide">Search for help</span>
                      <Search className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />
                    </div>
                    {config.suggestedQuestions.map((q, i) => (
                      <button
                        key={q}
                        onClick={() => handleSendMessage(q)}
                        className={cn("w-full px-4 py-2.5 flex items-center justify-between text-left list-item", i < config.suggestedQuestions.length - 1 && "border-b border-gray-50/50")}
                      >
                        <span className="text-ultra-thin text-[12px] text-gray-500">{q}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* MESSAGES */}
        {activeTab === "messages" && (
          <div className="flex flex-col h-full" style={{ background: "rgba(255,255,255,0.6)" }}>
            <div className="flex-1 px-3 py-3 space-y-3 overflow-y-auto scrollbar-hide">
              {!isReady ? <ChatSkeleton /> : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-center content-fade">
                  <div className="w-12 h-12 rounded-xl overflow-hidden mb-3 logo-float glass-card">
                    <img src={headerLogo} alt="Logo" className="w-full h-full object-contain p-2" />
                  </div>
                  <p className="text-ultra-thin text-[12px] text-gray-400 max-w-[200px]">
                    Ask me anything about PropScholar trading, evaluations, or payouts.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    role={m.role}
                    content={m.content}
                    isStreaming={isLoading && m.id === messages[messages.length - 1]?.id && m.role === "assistant"}
                    isWidget={true}
                  />
                ))
              )}
              {error && <div className="text-ultra-thin text-[11px] px-3 py-2 rounded-lg bg-red-50/80 text-red-500">{error}</div>}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* HELP */}
        {activeTab === "help" && (
          <div className="p-3 space-y-2 content-fade">
            {config.showSupportCard && (
              <a
                href={`mailto:${config.supportEmail}`}
                className="block w-full px-4 py-3 rounded-xl card-hover stagger-item stagger-1"
                style={{ 
                  background: "linear-gradient(135deg, rgba(102,126,234,0.9) 0%, rgba(118,75,162,0.9) 100%)",
                  boxShadow: "0 6px 20px -6px rgba(102, 126, 234, 0.4)"
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-thin text-[13px] text-white block">Open Support Ticket</span>
                    <span className="text-ultra-thin text-[11px] text-white/50">{config.supportEmail}</span>
                  </div>
                  <Send className="w-4 h-4 text-white/70" strokeWidth={1.5} />
                </div>
              </a>
            )}

            <div className="rounded-xl overflow-hidden stagger-item stagger-2 glass-card">
              <div className="px-4 py-2.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                <span className="text-ultra-thin text-[11px] text-gray-400 uppercase tracking-wide">Frequently Asked</span>
              </div>
              {config.suggestedQuestions.map((q, i) => (
                <button
                  key={q}
                  onClick={() => handleSendMessage(q)}
                  className={cn("w-full px-4 py-2.5 flex items-center justify-between text-left list-item", i < config.suggestedQuestions.length - 1 && "border-b border-gray-50/50")}
                >
                  <span className="text-ultra-thin text-[12px] text-gray-500">{q}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* INPUT */}
      {activeTab === "messages" && (
        <div className="flex-shrink-0 px-3 pb-2 pt-1.5" style={{ background: "rgba(255,255,255,0.8)", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
          <ChatInput onSend={handleSendMessage} isLoading={isLoading} isWidget={true} />
        </div>
      )}

      {/* TABS */}
      <nav className="flex-shrink-0" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-around py-1.5">
          {([
            { id: "home", icon: Home, label: "Home" },
            { id: "messages", icon: MessageCircle, label: "Messages" },
            { id: "help", icon: HelpCircle, label: "Help" },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn("flex flex-col items-center gap-0.5 px-4 py-1 tab-btn", activeTab === id && "active")}
            >
              <Icon className="w-4 h-4" style={{ color: activeTab === id ? "#667eea" : "#b0b0b0" }} strokeWidth={activeTab === id ? 1.6 : 1.2} />
              <span className="text-ultra-thin text-[9px]" style={{ color: activeTab === id ? "#667eea" : "#b0b0b0" }}>{label}</span>
            </button>
          ))}
        </div>
        {config.showFooter && (
          <div className="pb-2 pt-0.5">
            <p 
              className="text-ultra-thin text-[10px] text-center"
              style={{ 
                background: "linear-gradient(90deg, #667eea, #764ba2)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                opacity: 0.7
              }}
            >
              {config.footerText}
            </p>
          </div>
        )}
      </nav>
    </div>
  );
};
