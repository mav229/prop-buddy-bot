import { useRef, useEffect, useCallback, useState } from "react";
import { Bot, RefreshCw, ArrowLeft, AlertTriangle, Sparkles } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { InlineTicketForm } from "./InlineTicketForm";

const OPEN_TICKET_FORM_MARKER = "[[OPEN_TICKET_FORM]]";

export const ChatInterface = () => {
  const { messages, isLoading, error, sendMessage, clearChat, isRateLimited, sessionId, appendAssistantMessage } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const lastTicketTriggerIdRef = useRef<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      setTicketSubmitted(false);
      lastTicketTriggerIdRef.current = null;
      setShowTicketForm(false);
    }
  }, [messages.length]);

  useEffect(() => {
    if (isLoading) return;
    if (ticketSubmitted || showTicketForm) return;
    const lastTrigger = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content.includes(OPEN_TICKET_FORM_MARKER));
    if (!lastTrigger) return;
    if (lastTicketTriggerIdRef.current === lastTrigger.id) return;
    lastTicketTriggerIdRef.current = lastTrigger.id;
    setShowTicketForm(true);
  }, [messages, ticketSubmitted, showTicketForm, isLoading]);

  const handleSendMessage = useCallback(
    (msg: string) => { sendMessage(msg); },
    [sendMessage]
  );

  const handleTicketSuccess = (ticketNumber?: string) => {
    setShowTicketForm(false);
    setTicketSubmitted(true);
    if (ticketNumber) {
      appendAssistantMessage(`✅ **Your ticket #${ticketNumber} has been created!**\n\nOur support team will reach out to you within **4 hours**.`);
    }
  };

  const suggestions = [
    "What are the drawdown rules?",
    "How do payouts work?",
    "Tell me about evaluations",
    "What is Scholar Score?",
  ];

  return (
    <div className="flex flex-col h-screen bg-[hsl(0,0%,3%)] relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[hsl(0,0%,15%)] rounded-full blur-[128px] opacity-30 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[hsl(0,0%,12%)] rounded-full blur-[100px] opacity-20 pointer-events-none" />

      {/* Header - Glass */}
      <header className="flex-shrink-0 relative z-10">
        <div className="mx-4 mt-4 rounded-2xl border border-[hsl(0,0%,15%)] bg-[hsl(0,0%,6%)]/80 backdrop-blur-xl px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-[hsl(0,0%,10%)] border border-[hsl(0,0%,18%)] flex items-center justify-center">
                <Bot className="w-5 h-5 text-[hsl(0,0%,70%)]" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-[hsl(0,0%,92%)]">
                  PropScholar AI
                </h1>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[hsl(142,76%,46%)] online-dot" />
                  <p className="text-xs text-[hsl(0,0%,45%)] font-light">
                    Online — Support Assistant
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link to="/">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  title="Home"
                  className="rounded-xl text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,80%)] hover:bg-[hsl(0,0%,10%)]"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearChat}
                title="Clear chat"
                className="rounded-xl text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,80%)] hover:bg-[hsl(0,0%,10%)]"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide relative z-10">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center animate-fade-in">
              {/* Glassy icon */}
              <div className="w-20 h-20 rounded-2xl bg-[hsl(0,0%,8%)] border border-[hsl(0,0%,16%)] backdrop-blur-xl flex items-center justify-center mb-8 relative">
                <Sparkles className="w-8 h-8 text-[hsl(0,0%,50%)]" />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[hsl(0,0%,20%)]/10 to-transparent pointer-events-none" />
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-[hsl(0,0%,92%)] mb-2">
                Welcome to PropScholar Support
              </h2>
              <p className="text-[hsl(0,0%,45%)] max-w-md mb-10 text-sm font-light leading-relaxed">
                I can help you with questions about evaluations, rules, payouts,
                accounts, and trading conditions.
              </p>

              {/* Boxy suggestion cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="group relative rounded-xl border border-[hsl(0,0%,13%)] bg-[hsl(0,0%,7%)]/60 backdrop-blur-md px-5 py-4 text-sm text-left text-[hsl(0,0%,70%)] hover:text-[hsl(0,0%,90%)] hover:border-[hsl(0,0%,20%)] hover:bg-[hsl(0,0%,9%)]/80 transition-all duration-200"
                  >
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-[hsl(0,0%,15%)]/5 to-transparent pointer-events-none" />
                    <span className="relative font-light">{suggestion}</span>
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

          {showTicketForm && (
            <div className="max-w-sm">
              <InlineTicketForm
                onClose={() => setShowTicketForm(false)}
                onSuccess={handleTicketSuccess}
                sessionId={sessionId || "web"}
                chatHistory={messages.map((m) => ({ role: m.role, content: m.content }))}
              />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[hsl(0,72%,30%)] bg-[hsl(0,72%,10%)]/40 backdrop-blur-md text-[hsl(0,72%,70%)] px-5 py-4 text-sm">
              {error}
            </div>
          )}

          {isRateLimited && (
            <div className="rounded-xl border border-[hsl(38,80%,30%)] bg-[hsl(38,80%,10%)]/40 backdrop-blur-md px-5 py-5 animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[hsl(38,92%,50%)] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-[hsl(38,92%,60%)] mb-1">Session Limit Reached</h4>
                  <p className="text-sm text-[hsl(0,0%,50%)] mb-3 font-light">
                    You've reached the AI usage limit for this session.
                  </p>
                  <Button
                    onClick={clearChat}
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-[hsl(38,80%,30%)] text-[hsl(38,92%,60%)] hover:bg-[hsl(38,80%,15%)]"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Start New Chat
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input - Glass bottom bar */}
      <div className="flex-shrink-0 px-4 pb-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-[hsl(0,0%,13%)] bg-[hsl(0,0%,6%)]/70 backdrop-blur-xl p-1">
            <ChatInput onSend={handleSendMessage} isLoading={isLoading} disabled={isRateLimited} />
          </div>
          <p className="text-[11px] text-[hsl(0,0%,30%)] text-center mt-3 font-light">
            PropScholar AI can only answer questions related to PropScholar products and services.
          </p>
        </div>
      </div>
    </div>
  );
};
