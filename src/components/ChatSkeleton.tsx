import { cn } from "@/lib/utils";

export const ChatSkeleton = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[280px] px-6 stagger-item">
      {/* Avatar skeleton - refined Apple-like loading */}
      <div className="relative w-16 h-16 mb-5">
        <div className="absolute inset-0 rounded-2xl skeleton" />
        <div className="absolute inset-0 rounded-2xl shimmer" />
      </div>
      
      {/* Title skeleton */}
      <div className="relative h-5 w-44 mb-3">
        <div className="absolute inset-0 skeleton rounded-full" />
      </div>
      
      {/* Subtitle skeleton */}
      <div className="relative h-4 w-56 mb-2">
        <div className="absolute inset-0 skeleton rounded-full" />
      </div>
      <div className="relative h-4 w-36 mb-8">
        <div className="absolute inset-0 skeleton rounded-full" />
      </div>
      
      {/* Suggestion buttons skeleton - staggered reveal */}
      <div className="w-full max-w-[280px] space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div 
            key={i} 
            className={cn(
              "relative h-11 w-full stagger-item",
              i === 0 && "stagger-1",
              i === 1 && "stagger-2",
              i === 2 && "stagger-3"
            )}
          >
            <div className="absolute inset-0 skeleton rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const MessageSkeleton = () => {
  return (
    <div className="flex gap-3 stagger-item">
      {/* Avatar */}
      <div className="relative w-8 h-8 flex-shrink-0">
        <div className="absolute inset-0 rounded-xl skeleton" />
      </div>
      
      {/* Message content */}
      <div className="flex-1 space-y-2 py-1">
        <div className="relative h-4 w-[85%]">
          <div className="absolute inset-0 skeleton rounded-full" />
        </div>
        <div className="relative h-4 w-[60%]">
          <div className="absolute inset-0 skeleton rounded-full" />
        </div>
      </div>
    </div>
  );
};

// Card skeleton for home tab
export const CardSkeleton = () => {
  return (
    <div className="space-y-3 stagger-item">
      {[0, 1, 2].map((i) => (
        <div 
          key={i} 
          className={cn(
            "relative h-14 w-full stagger-item",
            i === 0 && "stagger-1",
            i === 1 && "stagger-2",
            i === 2 && "stagger-3"
          )}
        >
          <div className="absolute inset-0 skeleton rounded-2xl" />
        </div>
      ))}
    </div>
  );
};
