import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  className?: string;
}

export const TypingIndicator = ({ className }: TypingIndicatorProps) => {
  return (
    <div className={cn("flex items-center gap-1 px-3 py-2", className)}>
      <div className="flex items-center gap-[3px]">
        <span 
          className="w-[6px] h-[6px] rounded-full bg-gray-400 typing-dot"
          style={{ animationDelay: "0ms" }}
        />
        <span 
          className="w-[6px] h-[6px] rounded-full bg-gray-400 typing-dot"
          style={{ animationDelay: "200ms" }}
        />
        <span 
          className="w-[6px] h-[6px] rounded-full bg-gray-400 typing-dot"
          style={{ animationDelay: "400ms" }}
        />
      </div>
    </div>
  );
};
