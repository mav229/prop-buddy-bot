import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ChatSession {
  session_id: string;
  last_message: string;
  last_role: string;
  message_count: number;
  created_at: string;
}

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastSessions, setPastSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  // Fetch past sessions on mount
  const fetchPastSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const { data, error } = await supabase
        .from("chat_history")
        .select("session_id, content, role, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        // Group by session_id and get latest message for each
        const sessionMap = new Map<string, ChatSession>();
        
        data.forEach((msg) => {
          if (!sessionMap.has(msg.session_id)) {
            sessionMap.set(msg.session_id, {
              session_id: msg.session_id,
              last_message: msg.content,
              last_role: msg.role,
              message_count: 1,
              created_at: msg.created_at,
            });
          } else {
            const session = sessionMap.get(msg.session_id)!;
            session.message_count++;
          }
        });

        // Convert to array and take only sessions with at least 2 messages (user + assistant)
        const sessions = Array.from(sessionMap.values())
          .filter((s) => s.message_count >= 2 && s.session_id !== sessionIdRef.current)
          .slice(0, 5); // Limit to 5 recent sessions

        setPastSessions(sessions);
      }
    } catch (err) {
      console.error("Failed to fetch past sessions:", err);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchPastSessions();
  }, [fetchPastSessions]);

  // Load a specific session's messages
  const loadSession = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from("chat_history")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data) {
        const loadedMessages: Message[] = data.map((msg) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.content,
          timestamp: new Date(msg.created_at),
        }));

        setMessages(loadedMessages);
        sessionIdRef.current = sessionId;
      }
    } catch (err) {
      console.error("Failed to load session:", err);
      setError("Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    setError(null);
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

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

        // Refresh past sessions
        fetchPastSessions();
      }
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
      // Remove the empty assistant message on error
      setMessages((prev) => prev.filter((m) => m.content !== "" || m.role !== "assistant"));
    } finally {
      setIsLoading(false);
    }
  }, [messages, fetchPastSessions]);

  const clearChat = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    pastSessions,
    isLoadingSessions,
    loadSession,
    currentSessionId: sessionIdRef.current,
  };
};
