import { useRef, useEffect, useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Send, Loader2, Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { InlineTicketForm } from "@/components/InlineTicketForm";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import scholarisLogo from "@/assets/scholaris-logo.png";
import propscholarIcon from "@/assets/propscholar-icon.png";

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

const Bubble = ({ role, content, isStreaming }: { role: "user" | "assistant"; content: string; isStreaming?: boolean }) => {
  const isUser = role === "user";
  const display = stripMarkers(content);

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn(
        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden mt-0.5",
        isUser ? "bg-white/90" : "bg-[hsl(0,0%,12%)] border border-[hsl(0,0%,20%)]"
      )}>
        {isUser ? (
          <span className="text-[10px] font-bold text-black">U</span>
        ) : (
          <img src={scholarisLogo} alt="S" className="w-full h-full object-cover rounded-full" />
        )}
      </div>
      <div className={cn(
        "px-4 py-3 max-w-[75%] text-[13px] font-light leading-relaxed",
        isUser
          ? "rounded-2xl rounded-tr-sm bg-white text-black"
          : "rounded-2xl rounded-tl-sm bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,16%)] text-[hsl(0,0%,78%)]"
      )}>
        {!content && isStreaming ? (
          <TypingDots />
        ) : isUser ? (
          <span className="whitespace-pre-wrap">{display}</span>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 prose-p:my-1.5 prose-p:leading-relaxed prose-strong:text-white/90 prose-code:text-[12px] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-white/5 prose-code:before:content-none prose-code:after:content-none">
            <ReactMarkdown>{display}</ReactMarkdown>
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

  // Listen for postMessage from parent window
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "scholaris:user" && event.data?.email) {
        setPreloadEmail(event.data.email);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const { messages, isLoading, error, sendMessage, clearChat, isRateLimited, sessionId, appendAssistantMessage } = useChat(preloadEmail);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const lastTicketTriggerIdRef = useRef<string | null>(null);

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
    if (ticketNumber) appendAssistantMessage(`✅ **Your ticket #${ticketNumber} has been created!**\n\nOur support team will reach out within **4 hours**.`);
  };

  const suggestions = ["What are the drawdown rules?", "How do payouts work?", "Tell me about evaluations", "What is Scholar Score?"];

  return (
    <div className="w-full h-full flex flex-col bg-[hsl(0,0%,4%)] relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-[hsl(0,0%,10%)] rounded-full blur-[100px] opacity-40" />
        <div className="absolute bottom-0 left-1/3 w-[250px] h-[250px] bg-[hsl(0,0%,7%)] rounded-full blur-[80px] opacity-30" />
      </div>

      {/* Header */}
      <header className="flex-shrink-0 relative z-10 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-[hsl(0,0%,18%)] bg-black">
              <img src={propscholarIcon} alt="PropScholar" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-[14px] font-semibold tracking-tight text-white/90">PropScholar</h1>
                <span className="text-[10px] text-white/20 font-light">× Scholaris</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 online-dot" />
                <span className="text-[10px] text-white/30 font-light">Online</span>
              </div>
            </div>
          </div>
          <button onClick={clearChat} className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/5 transition-all" title="New chat">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide relative z-10 px-5 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-full overflow-hidden border border-[hsl(0,0%,15%)] mb-5 bg-black">
              <img src={propscholarIcon} alt="PropScholar" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-white/85 mb-1">How can I help?</h2>
            <p className="text-white/25 text-xs font-light mb-6 max-w-xs">Ask about evaluations, rules, payouts, or trading conditions.</p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
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
              <Bubble key={msg.id} role={msg.role} content={msg.content} isStreaming={isLoading && i === messages.length - 1 && msg.role === "assistant"} />
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <Bubble role="assistant" content="" isStreaming />
            )}
            {showTicketForm && (
              <div className="max-w-xs mx-auto">
                <InlineTicketForm onClose={() => setShowTicketForm(false)} onSuccess={handleTicketSuccess} sessionId={sessionId || "web"} chatHistory={messages.map((m) => ({ role: m.role, content: m.content }))} />
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
      <div className="flex-shrink-0 relative z-10 px-5 pb-4">
        <div className="rounded-xl border border-[hsl(0,0%,13%)] bg-[hsl(0,0%,6%)]/80 backdrop-blur-xl p-1 flex items-end gap-1.5 focus-within:border-[hsl(0,0%,20%)] transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Scholaris..."
            disabled={isRateLimited}
            rows={1}
            className="flex-1 bg-transparent border-0 resize-none focus:ring-0 focus:outline-none px-3 py-2 max-h-24 scrollbar-hide text-[13px] font-light text-white/80 placeholder:text-white/20"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isRateLimited}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center disabled:opacity-20 hover:bg-white/90 transition-all"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-[9px] text-white/10 text-center mt-2 font-light">scholaris.space</p>
      </div>
    </div>
  );
};

export default FullpageChat;
