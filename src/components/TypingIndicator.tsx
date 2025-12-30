import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
  className?: string;
}

export const TypingIndicator = ({ className }: TypingIndicatorProps) => {
  return (
    <div className={cn("flex items-center gap-1 px-3 py-2", className)}>
      <div className="flex items-center gap-[3px]">
        <span 
          className="w-[6px] h-[6px] rounded-full bg-primary/60 animate-bounce"
          style={{ animationDelay: "0ms", animationDuration: "600ms" }}
        />
        <span 
          className="w-[6px] h-[6px] rounded-full bg-primary/60 animate-bounce"
          style={{ animationDelay: "150ms", animationDuration: "600ms" }}
        />
        <span 
          className="w-[6px] h-[6px] rounded-full bg-primary/60 animate-bounce"
          style={{ animationDelay: "300ms", animationDuration: "600ms" }}
        />
      </div>
    </div>
  );
};
