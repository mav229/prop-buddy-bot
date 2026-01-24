import { useRef, useEffect, useCallback, useState } from "react";
import { Bot, RefreshCw, Settings, AlertTriangle, Monitor } from "lucide-react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { InlineTicketForm } from "./InlineTicketForm";

export const ChatInterface = () => {
  const { messages, isLoading, error, sendMessage, clearChat, isRateLimited, sessionId, appendAssistantMessage } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = useCallback(
    (msg: string) => {
      sendMessage(msg);
    },
    [sendMessage]
  );

  // Handle ticket button click from bot message
  const handleTicketButtonClick = () => {
    setShowTicketForm(true);
  };

  // Handle successful ticket creation - bot confirms it
  const handleTicketSuccess = (ticketNumber?: string) => {
    setShowTicketForm(false);
    if (ticketNumber) {
      appendAssistantMessage(`✅ **Your ticket #${ticketNumber} has been created!**


Our support team will reach out to you within **4 hours**.


In the meantime, feel free to ask me anything else! 🙂`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex-shrink-0 glass-panel border-b border-border/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-gradient-primary">
                PropScholar AI
              </h1>
              <p className="text-xs text-muted-foreground">
                Official Support Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/embed-checker">
              <Button variant="ghost" size="icon" title="Embed checker">
                <Monitor className="w-4 h-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              title="Clear chat"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Link to="/admin">
              <Button variant="ghost" size="icon" title="Admin Dashboard">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center animate-fade-in">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6 animate-float">
                <Bot className="w-10 h-10 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Welcome to PropScholar Support
              </h2>
              <p className="text-muted-foreground max-w-md mb-8">
                I can help you with questions about evaluations, rules, payouts,
                accounts, and trading conditions.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                {[
                  "What are the drawdown rules?",
                  "How do payouts work?",
                  "Tell me about evaluations",
                  "What is Scholar Score?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="glass-panel-subtle px-4 py-3 text-sm text-left hover:bg-secondary/50 transition-colors duration-200"
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
              onTicketButtonClick={handleTicketButtonClick}
            />
          ))}

          {/* Inline Ticket Form - shown when bot offers support button */}
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
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {isRateLimited && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-4 animate-fade-in">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-500 mb-1">Session Limit Reached</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    You've reached the AI usage limit for this session. This helps us provide free support to everyone.
                  </p>
                  <Button 
                    onClick={clearChat} 
                    variant="outline" 
                    size="sm"
                    className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
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

      {/* Input */}
      <div className="flex-shrink-0 px-6 pb-6">
        <div className="max-w-4xl mx-auto">
          <ChatInput onSend={handleSendMessage} isLoading={isLoading} disabled={isRateLimited} />
          <p className="text-xs text-muted-foreground text-center mt-3">
            PropScholar AI can only answer questions related to PropScholar
            products and services.
          </p>
        </div>
      </div>
    </div>
  );
};
