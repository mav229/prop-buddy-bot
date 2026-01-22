import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playSound } from "@/hooks/useSounds";
import { extractValidEmail } from "@/lib/emailValidation";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Pricing for google/gemini-2.5-flash (per 1M tokens)
const INPUT_COST_PER_MILLION = 0.15; // $0.15 per 1M input tokens
const OUTPUT_COST_PER_MILLION = 0.60; // $0.60 per 1M output tokens
const SESSION_COST_LIMIT = 0.40; // $0.40 per session

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const [emailCollectedInChat, setEmailCollectedInChat] = useState(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Check if session is rate limited
    if (isRateLimited) {
      setError("Session limit reached. Please start a new chat to continue.");
      return;
    }

    setError(null);
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setUserMessageCount((prev) => prev + 1);
    setIsLoading(true);

    // Detect and log email in user message (with strict validation)
    const validEmail = extractValidEmail(content);
    if (validEmail && !emailCollectedInChat) {
      console.log("Valid email detected in chat:", validEmail);
      
      // Save to widget_leads
      supabase.from("widget_leads").insert({
        email: validEmail,
        session_id: sessionIdRef.current,
        source: "chat_discount_request",
      }).then(({ error }) => {
        if (error) {
          console.error("Error saving email lead:", error);
        } else {
          console.log("Email lead saved successfully");
          setEmailCollectedInChat(true);
        }
      });
    }

    try {
      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      
      const response = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          sessionId: sessionIdRef.current,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get response");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId = crypto.randomUUID();

      // Create assistant message placeholder
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            
            // Check for usage data (sent at end of stream)
            if (parsed.usage) {
              const { inputTokens, outputTokens } = parsed.usage;
              const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION;
              const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION;
              const messageCost = inputCost + outputCost;
              
              setSessionCost((prev) => {
                const newCost = prev + messageCost;
                console.log(`Session cost: $${newCost.toFixed(4)} (limit: $${SESSION_COST_LIMIT})`);
                if (newCost >= SESSION_COST_LIMIT) {
                  setIsRateLimited(true);
                }
                return newCost;
              });
              continue;
            }
            
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: assistantContent } : m
                )
              );
            }
          } catch {
            // Incomplete JSON, put it back
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Store both messages in history
      if (assistantContent) {
        // Play receive sound when bot finishes responding
        playSound("receive", 0.1);
        
        // Store user message
        await supabase.from("chat_history").insert({
          session_id: sessionIdRef.current,
          role: "user",
          content: content.trim(),
        });

        // Store assistant response
        await supabase.from("chat_history").insert({
          session_id: sessionIdRef.current,
          role: "assistant",
          content: assistantContent,
        });

        // Log to training feedback for review
        await supabase.from("training_feedback").insert({
          question: content.trim(),
          bot_answer: assistantContent,
          confidence: 0.85,
          session_id: sessionIdRef.current,
        });
      }
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      // Remove the empty assistant message on error
      setMessages((prev) => prev.filter((m) => m.content !== "" || m.role !== "assistant"));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isRateLimited]);

  const appendAssistantMessage = useCallback((content: string) => {
    const msg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSessionCost(0);
    setIsRateLimited(false);
    setUserMessageCount(0);
    setEmailCollectedInChat(false);
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    isRateLimited,
    sessionCost,
    userMessageCount,
    sessionId: sessionIdRef.current,
    emailCollectedInChat,
    appendAssistantMessage,
  };
};
