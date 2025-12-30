import { useRef, useEffect, useState, useCallback } from "react";
import { X, MessageCircle, Send, Search, Home, HelpCircle, ExternalLink, ChevronLeft, ShoppingBag } from "lucide-react";
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

// Soft chime sound (base64 encoded short tone)
const OPEN_SOUND_URL = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNAz7CAAAAAAD/+9DEAAAH8ANntAAAA3AI7PcaAAAEAKQeaYoMBg+D4fBAEHggCAIHB9YPvB8HwfD4f5QEP/h+oGP/+sHwQBAMf/Lgg7///5c/ygIf+XD4IHH/1hAGD4f/+gABgCMN//yhSA//7vxB///KAgCAYB///+D4P/1A+H///0HAsD///+qBz/qH//qH/+D///9UDH///+oHP/U/5QEHw///0Hw////9QPgg+H///5QOfq////lg+Dj//qB9/////////////8AAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//tQxBsAAADSAAAAAAAAANIAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";

export const EmbeddableChat = ({ isWidget = false }: EmbeddableChatProps) => {
  const { messages, isLoading, error, sendMessage, clearChat } = useChat();
  const { config } = useWidgetConfig();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // Animation states
  const [isMinimized, setIsMinimized] = useState<boolean>(isWidget);
  const [isClosing, setIsClosing] = useState(false);
  

  // Use config logos or fallback to defaults
  const headerLogo = config.logoUrl || propscholarLogo;
  const launcherLogo = config.launcherLogoUrl || scholarisLogo;

  // Play soft open sound
  const playOpenSound = useCallback(() => {
    try {
      const audio = new Audio(OPEN_SOUND_URL);
      audio.volume = 0.25;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  const handleOpen = () => {
    playOpenSound();
    setIsMinimized(false);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setIsMinimized(true);
    }, 250);
  };

  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  // Prevent tiny scrollbars inside the widget iframe (glow/animations can overflow)
  useEffect(() => {
    if (!isWidget) return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [isWidget]);

  // Simulate initial load with skeleton
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 800);
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
      : "fixed bottom-4 right-4 z-[9999]";

    return (
      <div className={`${bubbleClass} flex items-center justify-center`} style={{ overflow: "hidden" }}>
        <div className="relative" style={{ width: 64, height: 64 }}>
          <div className="launcher-glow-ring" />
          <button
            type="button"
            aria-label="Open chat widget"
            onClick={handleOpen}
            className="w-14 h-14 sm:w-16 sm:h-16 cursor-pointer touch-manipulation select-none rounded-full overflow-hidden border-0 outline-none ring-0 flex items-center justify-center launcher-button relative"
          >
            <img
              src={launcherLogo}
              alt="Chat"
              className="w-full h-full rounded-full object-cover relative z-10 active:scale-95 transition-transform duration-100"
              draggable={false}
            />
          </button>
        </div>
      </div>
    );
  }

  const widgetFloatingFrame = isWidget && !inIframe;
  const panelAnimation = isClosing 
    ? "panel-close" 
    : "panel-open";

  return (
    <div
      className={cn(
        "flex flex-col",
        animationClass,
        isWidget
          ? widgetFloatingFrame
            ? `fixed bottom-4 right-4 z-[9999] ${panelAnimation}`
            : `w-full h-full ${panelAnimation}`
          : "h-screen bg-background"
      )}
      style={{
        ...(widgetFloatingFrame ? { width: `${config.widgetWidth}px`, height: `${config.widgetHeight}px` } : {}),
        background: '#FFFFFF',
        borderRadius: '20px',
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.04), 0 8px 32px -4px rgba(0, 0, 0, 0.12), 0 24px 48px -8px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden'
      }}
    >
      {/* Header - Premium Apple gradient */}
      <header 
        className="flex-shrink-0 relative"
        style={{ 
          background: 'linear-gradient(135deg, #0A84FF 0%, #007AFF 50%, #0051D4 100%)',
          padding: activeTab === "messages" && messages.length > 0 ? '14px 16px' : '20px',
        }}
      >
        {activeTab === "messages" && messages.length > 0 ? (
          /* Compact header */
          <div className="flex items-center gap-3 header-transition">
            <button
              onClick={() => setActiveTab("home")}
              className="w-8 h-8 flex items-center justify-center rounded-full close-button"
            >
              <ChevronLeft className="w-5 h-5 text-white/90" />
            </button>
            <div 
              className="w-9 h-9 rounded-xl overflow-hidden"
              style={{ 
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
            >
              <img src={launcherLogo} alt={config.botName} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-white tracking-tight truncate">{config.botName}</h3>
              {config.showOnlineIndicator && (
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] online-pulse" />
                  <span className="text-[11px] text-white/70 font-medium">Active now</span>
                </div>
              )}
            </div>
            {isWidget && (
              <button 
                onClick={handleClose} 
                className="w-8 h-8 flex items-center justify-center rounded-full close-button"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>
            )}
          </div>
        ) : (
          /* Full header */
          <div className="content-fade">
            <div className="flex items-start justify-between mb-4">
              <div 
                className="w-11 h-11 rounded-2xl overflow-hidden logo-float"
                style={{ 
                  background: 'rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.25)'
                }}
              >
                <img src={headerLogo} alt="Logo" className="w-full h-full object-cover" />
              </div>
              {isWidget && (
                <button 
                  onClick={handleClose} 
                  className="w-8 h-8 flex items-center justify-center rounded-full close-button"
                >
                  <X className="w-5 h-5 text-white/80" />
                </button>
              )}
            </div>
            <h1 
              className="text-[22px] font-semibold text-white mb-1"
              style={{ letterSpacing: '-0.02em' }}
            >
              {config.greetingText} {config.greetingEmoji}
            </h1>
            <p 
              className="text-[16px] text-white/75 font-normal"
              style={{ letterSpacing: '-0.01em' }}
            >
              {config.greetingSubtext}
            </p>
          </div>
        )}
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-white scrollbar-premium">
        
        {/* HOME TAB */}
        {activeTab === "home" && (
          <div className="p-4 space-y-2.5 content-fade">
            {!isReady ? (
              <CardSkeleton />
            ) : (
              <>
                {/* Shop Now Card */}
                <button
                  onClick={() => window.open('https://www.propscholar.com/shop', '_blank')}
                  className="w-full p-4 flex items-center justify-between rounded-2xl premium-card stagger-item stagger-1"
                  style={{ 
                    background: '#F5F5F7',
                    border: '1px solid rgba(0, 0, 0, 0.04)'
                  }}
                >
                  <span className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight">Shop Now</span>
                  <ShoppingBag className="w-5 h-5 text-[#007AFF]" />
                </button>

                {/* Discord Card */}
                {config.showDiscordCard && (
                  <button
                    onClick={() => window.open(config.discordLink, '_blank')}
                    className="w-full p-4 flex items-center justify-between rounded-2xl premium-card stagger-item stagger-2"
                    style={{ 
                      background: '#F5F5F7',
                      border: '1px solid rgba(0, 0, 0, 0.04)'
                    }}
                  >
                    <span className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight">{config.discordCardText}</span>
                    <ExternalLink className="w-5 h-5 text-[#007AFF]" />
                  </button>
                )}

                {/* Message Card - Primary CTA */}
                {config.showMessageCard && (
                  <button
                    onClick={() => setActiveTab("messages")}
                    className="w-full p-4 flex items-center justify-between rounded-2xl btn-press stagger-item stagger-3"
                    style={{ 
                      background: 'linear-gradient(135deg, #007AFF 0%, #0051D4 100%)',
                      boxShadow: '0 4px 16px -2px rgba(0, 122, 255, 0.35), 0 8px 24px -4px rgba(0, 122, 255, 0.2)'
                    }}
                  >
                    <span className="text-[15px] font-semibold text-white tracking-tight">{config.messageCardText}</span>
                    <Send className="w-5 h-5 text-white/90" />
                  </button>
                )}

                {/* FAQ Section */}
                {config.showHelpSearch && (
                  <div 
                    className="rounded-2xl overflow-hidden stagger-item stagger-4" 
                    style={{ 
                      background: '#F5F5F7', 
                      border: '1px solid rgba(0, 0, 0, 0.04)' 
                    }}
                  >
                    <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'rgba(0, 0, 0, 0.04)' }}>
                      <span className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight">Frequently Asked</span>
                      <Search className="w-4 h-4 text-[#8E8E93]" />
                    </div>
                    <div>
                      {config.suggestedQuestions.map((suggestion, index) => (
                        <button
                          key={suggestion}
                          onClick={() => handleSendMessage(suggestion)}
                          className={cn(
                            "w-full px-4 py-3.5 flex items-center justify-between text-left list-item-smooth",
                            index < config.suggestedQuestions.length - 1 && "border-b"
                          )}
                          style={{ borderColor: 'rgba(0, 0, 0, 0.04)' }}
                        >
                          <span className="text-[14px] text-[#48484A] font-normal">{suggestion}</span>
                          <ChevronLeft className="w-4 h-4 text-[#C7C7CC] rotate-180" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
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
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center content-fade">
                  <div 
                    className="w-14 h-14 rounded-2xl overflow-hidden mb-4 logo-float"
                    style={{ 
                      background: '#F5F5F7',
                      border: '1px solid rgba(0, 0, 0, 0.04)'
                    }}
                  >
                    <img src={headerLogo} alt="Logo" className="w-full h-full object-contain p-2" />
                  </div>
                  <p 
                    className="text-[14px] text-[#8E8E93] max-w-[240px] font-normal"
                    style={{ lineHeight: '1.5', letterSpacing: '-0.01em' }}
                  >
                    Ask me anything about PropScholar trading, evaluations, or payouts.
                  </p>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      role={message.role}
                      content={message.content}
                      isStreaming={isLoading && message.id === messages[messages.length - 1]?.id && message.role === "assistant"}
                      isWidget={true}
                    />
                  ))}
                </>
              )}
              {error && (
                <div 
                  className="text-[13px] px-4 py-3 rounded-xl message-bubble"
                  style={{ 
                    background: '#FFF2F2', 
                    color: '#FF3B30',
                    border: '1px solid rgba(255, 59, 48, 0.1)'
                  }}
                >
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* HELP TAB */}
        {activeTab === "help" && (
          <div className="p-4 space-y-2.5 content-fade">
            {/* Support Card */}
            {config.showSupportCard && (
              <a
                href={`mailto:${config.supportEmail}`}
                className="block w-full p-4 rounded-2xl btn-press stagger-item stagger-1"
                style={{ 
                  background: 'linear-gradient(135deg, #007AFF 0%, #0051D4 100%)',
                  boxShadow: '0 4px 16px -2px rgba(0, 122, 255, 0.35), 0 8px 24px -4px rgba(0, 122, 255, 0.2)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[15px] font-semibold text-white block tracking-tight">Open Support Ticket</span>
                    <span className="text-[13px] text-white/70 font-normal">{config.supportEmail}</span>
                  </div>
                  <Send className="w-5 h-5 text-white/90" />
                </div>
              </a>
            )}

            {/* FAQ */}
            <div 
              className="rounded-2xl overflow-hidden stagger-item stagger-2" 
              style={{ 
                background: '#F5F5F7', 
                border: '1px solid rgba(0, 0, 0, 0.04)' 
              }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0, 0, 0, 0.04)' }}>
                <span className="text-[15px] font-semibold text-[#1D1D1F] tracking-tight">Frequently Asked</span>
              </div>
              <div>
                {config.suggestedQuestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSendMessage(suggestion)}
                    className={cn(
                      "w-full px-4 py-3.5 flex items-center justify-between text-left list-item-smooth",
                      index < config.suggestedQuestions.length - 1 && "border-b"
                    )}
                    style={{ borderColor: 'rgba(0, 0, 0, 0.04)' }}
                  >
                    <span className="text-[14px] text-[#48484A] font-normal">{suggestion}</span>
                    <ChevronLeft className="w-4 h-4 text-[#C7C7CC] rotate-180" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area - Refined */}
      {activeTab === "messages" && (
        <div 
          className="flex-shrink-0 px-4 pb-3 pt-2 border-t bg-white" 
          style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}
        >
          <ChatInput onSend={handleSendMessage} isLoading={isLoading} isWidget={true} />
        </div>
      )}

      {/* Bottom Navigation - Premium tab bar */}
      <div 
        className="flex-shrink-0 border-t"
        style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.95)', 
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(0, 0, 0, 0.06)' 
        }}
      >
        <div className="flex items-center justify-around py-2">
          {[
            { id: 'home' as TabType, icon: Home, label: 'Home' },
            { id: 'messages' as TabType, icon: MessageCircle, label: 'Messages' },
            { id: 'help' as TabType, icon: HelpCircle, label: 'Help' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-6 py-1.5 rounded-lg tab-button",
                activeTab === id && "active"
              )}
            >
              <Icon 
                className="w-[22px] h-[22px] transition-colors duration-200"
                style={{ 
                  color: activeTab === id ? '#007AFF' : '#8E8E93',
                  strokeWidth: activeTab === id ? 2 : 1.5
                }} 
              />
              <span 
                className="text-[10px] font-medium transition-colors duration-200"
                style={{ 
                  color: activeTab === id ? '#007AFF' : '#8E8E93',
                  letterSpacing: '0.01em'
                }}
              >
                {label}
              </span>
            </button>
          ))}
        </div>
        {config.showFooter && (
          <p 
            className="text-[10px] text-center pb-2 font-medium"
            style={{ color: '#C7C7CC', letterSpacing: '0.02em' }}
          >
            {config.footerText}
          </p>
        )}
      </div>
    </div>
  );
};
