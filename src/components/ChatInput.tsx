import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  isWidget?: boolean;
}

export const ChatInput = ({ onSend, isLoading, disabled, isWidget = false }: ChatInputProps) => {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading && !disabled) {
      onSend(input);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className={cn(
        "p-2 flex items-end gap-2 rounded-2xl",
        isWidget 
          ? "bg-white border border-gray-200 shadow-sm" 
          : "glass-panel"
      )}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask PropScholar AI a question..."
          disabled={isLoading || disabled}
          rows={1}
          className={cn(
            "flex-1 bg-transparent border-0 resize-none focus:ring-0 focus:outline-none px-3 py-2 max-h-36 scrollbar-hide",
            isWidget 
              ? "text-gray-900 placeholder:text-gray-400" 
              : "text-foreground placeholder:text-muted-foreground"
          )}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading || disabled}
          className={cn(
            "flex-shrink-0 rounded-xl",
            isWidget 
              ? "bg-[#007AFF] hover:bg-[#0056CC] text-white shadow-sm" 
              : ""
          )}
          variant={isWidget ? undefined : "premium"}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </form>
  );
};
