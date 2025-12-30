import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  isWidget?: boolean;
}

export const ChatInput = ({ onSend, isLoading, disabled, isWidget = false }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { config } = useWidgetConfig();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !disabled) {
      onSend(input);
      setInput("");
      // Refocus the textarea after sending
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const inputContainerStyle = isWidget ? {
    backgroundColor: config.chatInputBgColor,
    borderColor: config.chatInputBorderColor,
  } : undefined;

  const textareaStyle = isWidget ? {
    color: config.chatInputTextColor,
  } : undefined;

  const buttonStyle = isWidget ? {
    backgroundColor: config.sendButtonBgColor,
    color: config.sendButtonIconColor,
  } : undefined;

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div 
        className={cn(
          "p-1.5 flex items-end gap-2 rounded-xl transition-shadow input-glass",
          isWidget ? "border" : "glass-panel"
        )}
        style={inputContainerStyle}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          disabled={isLoading || disabled}
          rows={1}
          className={cn(
            "flex-1 bg-transparent border-0 resize-none focus:ring-0 focus:outline-none px-3 py-2.5 max-h-28 scrollbar-hide text-[14px] text-thin",
            !isWidget && "text-foreground placeholder:text-muted-foreground"
          )}
          style={textareaStyle}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading || disabled}
          className={cn(
            "flex-shrink-0 w-8 h-8 rounded-lg",
            isWidget && "hover:opacity-90 disabled:opacity-50"
          )}
          style={buttonStyle}
          variant={isWidget ? undefined : "premium"}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </form>
  );
};
