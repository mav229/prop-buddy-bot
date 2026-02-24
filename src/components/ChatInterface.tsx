import { useRef, useEffect, useCallback, useState } from "react";
import { RefreshCw, ArrowLeft, AlertTriangle, Send, Loader2 } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { Link } from "react-router-dom";
import { InlineTicketForm } from "./InlineTicketForm";
import { ChatSidebar } from "./ChatSidebar";
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

/* ── Typing dots ── */
const TypingDots = () => (
  <div className="flex items-center gap-1.5 py-1">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-[5px] h-[5px] rounded-full bg-[hsl(0,0%,40%)] typing-dot"
        style={{ animationDelay: `${i * 150}ms` }}
      />
    ))}
  </div>
);

/* ── Single message bubble ── */
const Bubble = ({
  role,
  content,
  isStreaming,
}: {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}) => {
  const isUser = role === "user";
  const display = stripMarkers(content);

  return (
    <div className={cn("flex gap-3 max-w-3xl mx-auto", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center overflow-hidden mt-1",
          isUser
            ? "bg-[hsl(0,0%,90%)]"
            : "bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,18%)]"
        )}
      >
        {isUser ? (
          <span className="text-xs font-semibold text-[hsl(0,0%,15%)]">Y</span>
        ) : (
          <img src={propscholarIcon} alt="S" className="w-full h-full object-cover rounded-full" />
        )}
      </div>
      <div
        className={cn(
          "px-5 py-3.5 max-w-[80%] text-[14px] font-light leading-relaxed",
          isUser
            ? "rounded-2xl rounded-tr-md bg-[hsl(0,0%,90%)] text-[hsl(0,0%,8%)]"
            : "rounded-2xl rounded-tl-md bg-[hsl(0,0%,9%)] border border-[hsl(0,0%,14%)] text-[hsl(0,0%,75%)]"
        )}
      >
        {!content && isStreaming ? (
          <TypingDots />
        ) : isUser ? (
          <span className="whitespace-pre-wrap">{display}</span>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-li:my-0.5 prose-strong:font-semibold prose-strong:text-[hsl(0,0%,88%)] prose-code:text-[13px] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:bg-[hsl(0,0%,14%)] prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown>{display}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Main Chat Interface ── */
export const ChatInterface = () => {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    isRateLimited,
    sessionId,
    appendAssistantMessage,
    setMessages,
  } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const lastTicketTriggerIdRef = useRef<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  /* Auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* Reset ticket state */
  useEffect(() => {
    if (messages.length === 0) {
      setTicketSubmitted(false);
      lastTicketTriggerIdRef.current = null;
      setShowTicketForm(false);
    }
  }, [messages.length]);

  /* Ticket form trigger */
  useEffect(() => {
    if (isLoading || ticketSubmitted || showTicketForm) return;
    const lastTrigger = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.includes(OPEN_TICKET_FORM_MARKER));
    if (!lastTrigger) return;
    if (lastTicketTriggerIdRef.current === lastTrigger.id) return;
    lastTicketTriggerIdRef.current = lastTrigger.id;
    setShowTicketForm(true);
  }, [messages, ticketSubmitted, showTicketForm, isLoading]);

  /* Auto-resize textarea */
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading || isRateLimited) return;
    sendMessage(input.trim());
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [input, isLoading, isRateLimited, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTicketSuccess = (ticketNumber?: string) => {
    setShowTicketForm(false);
    setTicketSubmitted(true);
    if (ticketNumber) {
      appendAssistantMessage(
        `Your ticket #${ticketNumber} has been created. Our support team will reach out to you within 4 hours.`
      );
    }
  };

  const handleSelectSession = async (sid: string) => {
    const { data } = await supabase
      .from("chat_history")
      .select("*")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      const loaded = data.map((row) => ({
        id: row.id,
        role: row.role as "user" | "assistant",
        content: row.content,
        timestamp: new Date(row.created_at),
      }));
      setMessages(loaded);
    }
  };

  const suggestions = [
    "What are the drawdown rules?",
    "How do payouts work?",
    "Tell me about evaluations",
    "What is Scholar Score?",
  ];

  return (
    <div className="flex h-screen bg-[hsl(0,0%,3%)]">
      {/* Sidebar */}
      <ChatSidebar
        currentSessionId={sessionId}
        onNewChat={clearChat}
        onSelectSession={handleSelectSession}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 relative min-w-0">
        {/* Ambient */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-[hsl(0,0%,8%)] rounded-full blur-[150px] opacity-40" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[hsl(0,0%,6%)] rounded-full blur-[120px] opacity-30" />
        </div>

        {/* ── Header ── */}
        <header className="flex-shrink-0 relative z-20">
          <div className="mx-5 mt-4 rounded-2xl border border-[hsl(0,0%,12%)] bg-[hsl(0,0%,5%)]/80 backdrop-blur-2xl px-5 py-3.5">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-full overflow-hidden border border-[hsl(0,0%,16%)] bg-black">
                  <img src={propscholarIcon} alt="Scholaris" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h1 className="text-[15px] font-semibold tracking-tight text-[hsl(0,0%,92%)]">
                    Scholaris AI
                  </h1>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[hsl(142,76%,46%)] online-dot" />
                    <span className="text-[11px] text-[hsl(0,0%,40%)] font-light">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link to="/">
                  <button className="p-2 rounded-xl text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,75%)] hover:bg-[hsl(0,0%,10%)] transition-all">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </Link>
                <button
                  onClick={clearChat}
                  className="p-2 rounded-xl text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,75%)] hover:bg-[hsl(0,0%,10%)] transition-all"
                  title="New chat"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto scrollbar-hide relative z-10 px-5 py-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full overflow-hidden border border-[hsl(0,0%,14%)] mb-8 bg-black">
                <img src={propscholarIcon} alt="Scholaris" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-[hsl(0,0%,90%)] mb-2">
                How can I help?
              </h2>
              <p className="text-[hsl(0,0%,40%)] max-w-sm mb-10 text-sm font-light leading-relaxed">
                Ask about evaluations, rules, payouts, or trading conditions.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="group rounded-xl border border-[hsl(0,0%,11%)] bg-[hsl(0,0%,5%)] px-4 py-3.5 text-[13px] text-left text-[hsl(0,0%,55%)] hover:text-[hsl(0,0%,85%)] hover:border-[hsl(0,0%,18%)] hover:bg-[hsl(0,0%,7%)] transition-all duration-200 font-light"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((msg, i) => (
                <Bubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  isStreaming={isLoading && i === messages.length - 1 && msg.role === "assistant"}
                />
              ))}

              {showTicketForm && (
                <div className="max-w-sm mx-auto">
                  <InlineTicketForm
                    onClose={() => setShowTicketForm(false)}
                    onSuccess={handleTicketSuccess}
                    sessionId={sessionId || "web"}
                    chatHistory={messages.map((m) => ({ role: m.role, content: m.content }))}
                  />
                </div>
              )}

              {error && (
                <div className="max-w-3xl mx-auto rounded-xl border border-[hsl(0,60%,25%)] bg-[hsl(0,60%,8%)] text-[hsl(0,60%,65%)] px-5 py-3.5 text-sm">
                  {error}
                </div>
              )}

              {isRateLimited && (
                <div className="max-w-3xl mx-auto rounded-xl border border-[hsl(38,70%,25%)] bg-[hsl(38,70%,8%)] px-5 py-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-[hsl(38,90%,50%)] flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-[hsl(38,90%,55%)] mb-1 text-sm">Session Limit</h4>
                      <p className="text-[13px] text-[hsl(0,0%,45%)] mb-3 font-light">
                        You've reached the limit for this session.
                      </p>
                      <button
                        onClick={clearChat}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[hsl(38,70%,25%)] text-[hsl(38,90%,55%)] text-xs font-medium hover:bg-[hsl(38,70%,12%)] transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        New Chat
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── Input ── */}
        <div className="flex-shrink-0 relative z-20 px-5 pb-5">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-[hsl(0,0%,12%)] bg-[hsl(0,0%,5%)]/80 backdrop-blur-2xl p-1.5 flex items-end gap-2 transition-all focus-within:border-[hsl(0,0%,20%)]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Scholaris..."
                disabled={isRateLimited}
                rows={1}
                className="flex-1 bg-transparent border-0 resize-none focus:ring-0 focus:outline-none px-3 py-2.5 max-h-28 scrollbar-hide text-[14px] font-light text-[hsl(0,0%,85%)] placeholder:text-[hsl(0,0%,30%)]"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || isRateLimited}
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-[hsl(0,0%,90%)] text-[hsl(0,0%,8%)] flex items-center justify-center disabled:opacity-30 hover:bg-white transition-all duration-200 disabled:hover:bg-[hsl(0,0%,90%)]"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-[hsl(0,0%,22%)] text-center mt-3 font-light">
              scholaris.space
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
