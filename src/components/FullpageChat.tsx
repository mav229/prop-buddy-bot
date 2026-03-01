import { useRef, useEffect, useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUp, Loader2, RefreshCw, AlertTriangle, Menu } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { DashboardTicketForm } from "@/components/DashboardTicketForm";
import { ChatSidebar } from "@/components/ChatSidebar";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import propscholarIcon from "@/assets/propscholar-icon.png";
import { supabase } from "@/integrations/supabase/client";

const OPEN_TICKET_FORM_MARKER = "[[OPEN_TICKET_FORM]]";

const stripMarkers = (text: string) =>
  (text || "")
    .replace(/\[\[OPEN_TICKET_FORM\]\]/g, "")
    .replace(/!!OPEN_TICKET_FORM!!/g, "")
    .replace(/\[\[SUPPORT_TICKET_BUTTON\]\]/g, "")
    .replace(/!!SUPPORT_TICKET_BUTTON!!/g, "")
    .trim();

const TypingDots = () => (
  <div className="flex items-center gap-1.5 py-1">
    {[0, 1, 2].map((i) => (
      <span key={i} className="w-[5px] h-[5px] rounded-full bg-[hsl(0,0%,50%)] typing-dot" style={{ animationDelay: `${i * 150}ms` }} />
    ))}
  </div>
);

const Bubble = ({ role, content, isStreaming, userName }: { role: "user" | "assistant"; content: string; isStreaming?: boolean; userName?: string }) => {
  const isUser = role === "user";
  const display = stripMarkers(content);
  const initial = userName ? userName.charAt(0).toUpperCase() : "U";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden mt-1",
        isUser
          ? "bg-white/90"
          : "bg-[hsl(0,0%,12%)] border border-[hsl(0,0%,20%)]"
      )}>
        {isUser ? (
          <span className="text-[10px] font-bold text-black leading-none">{initial}</span>
        ) : (
          <img src={propscholarIcon} alt="S" className="w-full h-full object-cover rounded-full" />
        )}
      </div>

      {/* Bubble */}
      <div className={cn(
        "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-[13.5px] leading-[1.7]",
        isUser
          ? "bg-white/90 text-black font-normal"
          : "bg-[hsl(0,0%,10%)] text-[hsl(0,0%,82%)] font-light"
      )}>
        {!content && isStreaming ? (
          <TypingDots />
        ) : isUser ? (
          <span className="whitespace-pre-wrap">{display}</span>
        ) : (
          <div
            className={cn(
              "max-w-none",
              "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
              "[&_p]:my-2.5 [&_p]:leading-[1.75] [&_p]:tracking-[0.01em]",
              "[&_strong]:font-semibold [&_strong]:text-white",
              "[&_ul]:my-3 [&_ul]:space-y-1.5 [&_ul]:pl-1",
              "[&_ol]:my-3 [&_ol]:space-y-1.5 [&_ol]:pl-1",
              "[&_li]:text-[hsl(0,0%,78%)] [&_li]:leading-[1.7]",
              "[&_h1]:text-[16px] [&_h1]:font-semibold [&_h1]:text-white [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:tracking-tight",
              "[&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-white/95 [&_h2]:mt-3.5 [&_h2]:mb-2 [&_h2]:tracking-tight",
              "[&_h3]:text-[14px] [&_h3]:font-medium [&_h3]:text-white/90 [&_h3]:mt-3 [&_h3]:mb-1.5",
              "[&_code]:text-[12px] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:bg-white/[0.06] [&_code]:text-[hsl(0,0%,88%)] [&_code]:font-mono",
              "[&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-3.5 [&_blockquote]:my-3 [&_blockquote]:text-[hsl(0,0%,65%)] [&_blockquote]:italic",
              "[&_a]:text-white/90 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-white/30",
            )}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => <p>{children}</p>,
                ul: ({ children }) => <ul className="list-none">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside">{children}</ol>,
                li: ({ children }) => (
                  <li className="flex items-start gap-2">
                    <span className="mt-[9px] w-1 h-1 rounded-full bg-white/40 flex-shrink-0" />
                    <span className="flex-1">{children}</span>
                  </li>
                ),
                strong: ({ children }) => <strong>{children}</strong>,
                h1: ({ children }) => <h1>{children}</h1>,
                h2: ({ children }) => <h2>{children}</h2>,
                h3: ({ children }) => <h3>{children}</h3>,
              }}
            >
              {display}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

const FullpageChat = () => {
  const [searchParams] = useSearchParams();
  const [preloadEmail, setPreloadEmail] = useState<string | undefined>(
    searchParams.get("email") || undefined
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "scholaris:user" && event.data?.email) {
        setPreloadEmail(event.data.email);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const { messages, isLoading, error, sendMessage, clearChat, isRateLimited, sessionId, appendAssistantMessage, setMessages } = useChat(preloadEmail, "fullpage");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const lastTicketTriggerIdRef = useRef<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (messages.length === 0) { setTicketSubmitted(false); lastTicketTriggerIdRef.current = null; setShowTicketForm(false); }
  }, [messages.length]);

  useEffect(() => {
    if (isLoading || ticketSubmitted || showTicketForm) return;
    const t = [...messages].reverse().find((m) => m.role === "assistant" && m.content.includes(OPEN_TICKET_FORM_MARKER));
    if (!t || lastTicketTriggerIdRef.current === t.id) return;
    lastTicketTriggerIdRef.current = t.id;
    setShowTicketForm(true);
  }, [messages, ticketSubmitted, showTicketForm, isLoading]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 100)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading || isRateLimited) return;
    sendMessage(input.trim());
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [input, isLoading, isRateLimited, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTicketSuccess = (ticketNumber?: string) => {
    setShowTicketForm(false);
    setTicketSubmitted(true);
    if (ticketNumber) appendAssistantMessage(`Your ticket #${ticketNumber} has been created. Our support team will reach out within 4 hours.`);
  };

  const handleSelectSession = async (sid: string) => {
    const { data: response } = await supabase.functions.invoke("read-chat-history", {
      body: { session_id: sid },
    });

    const data = response?.data;
    if (data && data.length > 0) {
      const loaded = data.map((row: any) => ({
        id: row.id,
        role: row.role as "user" | "assistant",
        content: row.content,
        timestamp: new Date(row.created_at),
      }));
      setMessages(loaded);
    }
  };

  const suggestions = ["What are the drawdown rules?", "How do payouts work?", "Tell me about evaluations", "What is Scholar Score?"];

  return (
    <div className="w-full h-full flex bg-[hsl(0,0%,4%)] overflow-hidden sm:aspect-video">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex sm:hidden">
          <div className="w-72 h-full flex-shrink-0">
            <ChatSidebar
              currentSessionId={sessionId}
              onNewChat={() => { clearChat(); setMobileSidebarOpen(false); }}
              onSelectSession={(sid) => { handleSelectSession(sid); setMobileSidebarOpen(false); }}
              collapsed={false}
              onToggle={() => setMobileSidebarOpen(false)}
              userEmail={preloadEmail}
            />
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden sm:flex">
        <ChatSidebar
          currentSessionId={sessionId}
          onNewChat={clearChat}
          onSelectSession={handleSelectSession}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          userEmail={preloadEmail}
        />
      </div>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 relative min-w-0 bg-[hsl(0,0%,5%)]">
        {/* Subtle ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-20"
            style={{
              background: 'radial-gradient(circle, hsl(0,0%,14%) 0%, hsl(0,0%,8%) 40%, transparent 70%)',
            }}
          />
        </div>

        {/* Header - sticky */}
        <header className="flex-shrink-0 sticky top-0 z-10 px-3 sm:px-5 pt-3 sm:pt-4 pb-2 sm:pb-3 bg-[hsl(0,0%,4%)] border-b border-[hsl(0,0%,10%)]">
          <div className="flex items-center">
            <button onClick={() => setMobileSidebarOpen(true)} className="sm:hidden mr-2 p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-[hsl(0,0%,10%)] transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-[hsl(0,0%,18%)] bg-black">
                <img src={propscholarIcon} alt="PropScholar" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-[14px] font-semibold tracking-tight text-white/90">Scholaris AI</h1>
                  <span className="text-[10px] text-white/20 font-light">by PropScholar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 online-dot" />
                  <span className="text-[10px] text-white/30 font-light">Online</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-hide relative z-10 px-3 sm:px-5 py-3 sm:py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-full overflow-hidden border border-[hsl(0,0%,15%)] mb-5 bg-black">
                <img src={propscholarIcon} alt="PropScholar" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-white/85 mb-1">How can I help?</h2>
              <p className="text-white/25 text-xs font-light mb-6 max-w-xs">Ask about evaluations, rules, payouts, or trading conditions.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => sendMessage(s)} className="rounded-lg border border-[hsl(0,0%,12%)] bg-[hsl(0,0%,6%)] px-3 py-2.5 text-[11px] text-left text-white/40 hover:text-white/70 hover:border-[hsl(0,0%,18%)] hover:bg-[hsl(0,0%,8%)] transition-all font-light">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <Bubble key={msg.id} role={msg.role} content={msg.content} isStreaming={isLoading && i === messages.length - 1 && msg.role === "assistant"} userName={preloadEmail?.split("@")[0]} />
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <Bubble role="assistant" content="" isStreaming userName={preloadEmail?.split("@")[0]} />
              )}
              {showTicketForm && (
                <div className="py-2">
                  <DashboardTicketForm onClose={() => setShowTicketForm(false)} onSuccess={handleTicketSuccess} sessionId={sessionId || "web"} chatHistory={messages.map((m) => ({ role: m.role, content: m.content }))} />
                </div>
              )}
              {error && <div className="rounded-lg border border-red-900/40 bg-red-950/30 text-red-400 px-4 py-2.5 text-xs">{error}</div>}
              {isRateLimited && (
                <div className="rounded-lg border border-amber-900/40 bg-amber-950/30 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-amber-400 font-medium">Session Limit</p>
                      <button onClick={clearChat} className="text-[10px] text-amber-500/60 hover:text-amber-400 mt-1 underline">New Chat</button>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 relative z-10 px-3 sm:px-5 pb-3 sm:pb-4 flex flex-col items-center">
          <div className="w-full max-w-2xl rounded-2xl border border-[hsl(0,0%,22%)] bg-[hsl(0,0%,17%)] px-3 sm:px-4 py-2 flex items-end gap-2 transition-all focus-within:border-[hsl(0,0%,30%)]">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Scholaris..."
              disabled={isRateLimited}
              rows={1}
              className="flex-1 bg-transparent border-0 resize-none focus:ring-0 focus:outline-none py-1.5 max-h-20 scrollbar-hide text-[13px] font-light text-white/80 placeholder:text-white/25"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isRateLimited}
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all mb-0.5 ${
                input.trim() && !isLoading && !isRateLimited
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-[hsl(0,0%,20%)] text-white/40 cursor-default"
              }`}
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-4 h-4" strokeWidth={2.5} />}
            </button>
          </div>
          <p className="text-[11px] text-white/40 text-center mt-2 font-light">Scholaris AI <span className="text-white/20">powered by</span> <span className="text-white/40">PropScholar</span></p>
        </div>
      </div>
    </div>
  );
};

export default FullpageChat;
