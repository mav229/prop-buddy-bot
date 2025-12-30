import { useRef, useEffect, useState, useCallback } from "react";
import { X, MessageCircle, Send, Search, Home, HelpCircle, ExternalLink, ChevronRight, ShoppingBag } from "lucide-react";
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

  // Minimized launcher
  if (isWidget && isMinimized) {
    return (
      <div className={cn(inIframe ? "w-full h-full" : "fixed bottom-4 right-4 z-[9999]", "flex items-center justify-center")}>
        <div className="relative" style={{ width: 64, height: 64 }}>
          <div className="glow-ring" />
          <button
            onClick={handleOpen}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden launcher-btn relative z-10"
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
        isWidget ? widgetFloatingFrame ? `fixed bottom-4 right-4 z-[9999] ${panelClass}` : `w-full h-full ${panelClass}` : "h-screen bg-background"
      )}
      style={{
        ...(widgetFloatingFrame ? { width: config.widgetWidth, height: config.widgetHeight } : {}),
        borderRadius: 24,
        overflow: "hidden",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 24px 48px -12px rgba(0,0,0,0.18)",
        background: "#fff",
      }}
    >
      {/* HEADER - Glassmorphic gradient */}
      <header
        className="flex-shrink-0 relative"
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6B8DD6 100%)",
          padding: activeTab === "messages" && messages.length > 0 ? "16px" : "24px 20px 28px",
        }}
      >
        {activeTab === "messages" && messages.length > 0 ? (
          <div className="flex items-center gap-3 content-fade">
            <button onClick={() => setActiveTab("home")} className="w-8 h-8 flex items-center justify-center rounded-full close-btn">
              <ChevronRight className="w-5 h-5 text-white/80 rotate-180" strokeWidth={1.5} />
            </button>
            <div className="w-10 h-10 rounded-2xl overflow-hidden glass-surface-subtle p-0.5">
              <img src={launcherLogo} alt={config.botName} className="w-full h-full object-cover rounded-xl" />
            </div>
            <div className="flex-1">
              <p className="text-regular text-[15px] text-white">{config.botName}</p>
              {config.showOnlineIndicator && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 online-dot" />
                  <span className="text-ultra-thin text-[11px] text-white/70">Active now</span>
                </div>
              )}
            </div>
            {isWidget && (
              <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full close-btn">
                <X className="w-5 h-5 text-white/70" strokeWidth={1.5} />
              </button>
            )}
          </div>
        ) : (
          <div className="content-fade">
            <div className="flex items-start justify-between mb-5">
              <div className="w-12 h-12 rounded-2xl overflow-hidden glass-surface-subtle p-0.5 logo-float">
                <img src={headerLogo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
              </div>
              {isWidget && (
                <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full close-btn">
                  <X className="w-5 h-5 text-white/70" strokeWidth={1.5} />
                </button>
              )}
            </div>
            <h1 className="text-thin text-[28px] text-white leading-tight">
              {config.greetingText} {config.greetingEmoji}
            </h1>
            <p className="text-ultra-thin text-[18px] text-white/80 mt-1">
              {config.greetingSubtext}
            </p>
          </div>
        )}
      </header>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: "#fafafa" }}>
        
        {/* HOME */}
        {activeTab === "home" && (
          <div className="p-4 space-y-3 content-fade">
            {!isReady ? <CardSkeleton /> : (
              <>
                <button
                  onClick={() => window.open("https://www.propscholar.com/shop", "_blank")}
                  className="w-full px-5 py-4 flex items-center justify-between rounded-2xl card-hover stagger-item stagger-1"
                  style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
                >
                  <span className="text-regular text-[15px] text-gray-800">Shop Now</span>
                  <ShoppingBag className="w-5 h-5 text-indigo-500" strokeWidth={1.5} />
                </button>

                {config.showDiscordCard && (
                  <button
                    onClick={() => window.open(config.discordLink, "_blank")}
                    className="w-full px-5 py-4 flex items-center justify-between rounded-2xl card-hover stagger-item stagger-2"
                    style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}
                  >
                    <span className="text-regular text-[15px] text-gray-800">{config.discordCardText}</span>
                    <ExternalLink className="w-5 h-5 text-indigo-500" strokeWidth={1.5} />
                  </button>
                )}

                {config.showMessageCard && (
                  <button
                    onClick={() => setActiveTab("messages")}
                    className="w-full px-5 py-4 flex items-center justify-between rounded-2xl card-hover stagger-item stagger-3"
                    style={{ 
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      boxShadow: "0 8px 24px -8px rgba(102, 126, 234, 0.5)"
                    }}
                  >
                    <span className="text-regular text-[15px] text-white">{config.messageCardText}</span>
                    <ChevronRight className="w-5 h-5 text-white/80" strokeWidth={1.5} />
                  </button>
                )}

                {config.showHelpSearch && (
                  <div className="rounded-2xl overflow-hidden stagger-item stagger-4" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}>
                    <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                      <span className="text-thin text-[14px] text-gray-500">Search for help</span>
                      <Search className="w-4 h-4 text-indigo-500" strokeWidth={1.5} />
                    </div>
                    {config.suggestedQuestions.map((q, i) => (
                      <button
                        key={q}
                        onClick={() => handleSendMessage(q)}
                        className={cn("w-full px-5 py-3.5 flex items-center justify-between text-left list-item", i < config.suggestedQuestions.length - 1 && "border-b border-gray-50")}
                      >
                        <span className="text-thin text-[14px] text-gray-600">{q}</span>
                        <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={1.5} />
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
          <div className="flex flex-col h-full" style={{ background: "#fff" }}>
            <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto scrollbar-hide">
              {!isReady ? <ChatSkeleton /> : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center content-fade">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden mb-4 logo-float" style={{ background: "#f5f5f5" }}>
                    <img src={headerLogo} alt="Logo" className="w-full h-full object-contain p-2" />
                  </div>
                  <p className="text-thin text-[14px] text-gray-400 max-w-[220px]">
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
              {error && <div className="text-thin text-[13px] px-4 py-3 rounded-xl bg-red-50 text-red-500">{error}</div>}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* HELP */}
        {activeTab === "help" && (
          <div className="p-4 space-y-3 content-fade">
            {config.showSupportCard && (
              <a
                href={`mailto:${config.supportEmail}`}
                className="block w-full px-5 py-4 rounded-2xl card-hover stagger-item stagger-1"
                style={{ 
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  boxShadow: "0 8px 24px -8px rgba(102, 126, 234, 0.5)"
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-regular text-[15px] text-white block">Open Support Ticket</span>
                    <span className="text-ultra-thin text-[13px] text-white/60">{config.supportEmail}</span>
                  </div>
                  <Send className="w-5 h-5 text-white/80" strokeWidth={1.5} />
                </div>
              </a>
            )}

            <div className="rounded-2xl overflow-hidden stagger-item stagger-2" style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)" }}>
              <div className="px-5 py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                <span className="text-thin text-[14px] text-gray-500">Frequently Asked</span>
              </div>
              {config.suggestedQuestions.map((q, i) => (
                <button
                  key={q}
                  onClick={() => handleSendMessage(q)}
                  className={cn("w-full px-5 py-3.5 flex items-center justify-between text-left list-item", i < config.suggestedQuestions.length - 1 && "border-b border-gray-50")}
                >
                  <span className="text-thin text-[14px] text-gray-600">{q}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* INPUT */}
      {activeTab === "messages" && (
        <div className="flex-shrink-0 px-4 pb-3 pt-2" style={{ background: "#fff", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <ChatInput onSend={handleSendMessage} isLoading={isLoading} isWidget={true} />
        </div>
      )}

      {/* TABS */}
      <nav className="flex-shrink-0" style={{ background: "#fff", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
        <div className="flex items-center justify-around py-2.5">
          {([
            { id: "home", icon: Home, label: "Home" },
            { id: "messages", icon: MessageCircle, label: "Messages" },
            { id: "help", icon: HelpCircle, label: "Help" },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn("flex flex-col items-center gap-1 px-5 py-1 tab-btn", activeTab === id && "active")}
            >
              <Icon className="w-5 h-5" style={{ color: activeTab === id ? "#667eea" : "#9ca3af" }} strokeWidth={activeTab === id ? 1.8 : 1.3} />
              <span className="text-ultra-thin text-[11px]" style={{ color: activeTab === id ? "#667eea" : "#9ca3af" }}>{label}</span>
            </button>
          ))}
        </div>
        {config.showFooter && (
          <p className="text-ultra-thin text-[10px] text-center pb-2 text-gray-300">{config.footerText}</p>
        )}
      </nav>
    </div>
  );
};
