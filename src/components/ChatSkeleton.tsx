import { cn } from "@/lib/utils";

export const ChatSkeleton = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[280px] px-6 stagger-item">
      <div className="w-14 h-14 rounded-2xl skeleton mb-5" />
      <div className="h-4 w-40 skeleton rounded-full mb-3" />
      <div className="h-3 w-52 skeleton rounded-full mb-2" />
      <div className="h-3 w-32 skeleton rounded-full mb-8" />
      <div className="w-full max-w-[260px] space-y-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("h-10 w-full skeleton rounded-xl stagger-item", `stagger-${i + 1}`)} />
        ))}
      </div>
    </div>
  );
};

export const MessageSkeleton = () => {
  return (
    <div className="flex gap-3 stagger-item">
      <div className="w-7 h-7 rounded-full skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-[80%] skeleton rounded-full" />
        <div className="h-3 w-[55%] skeleton rounded-full" />
      </div>
    </div>
  );
};

export const CardSkeleton = () => {
  return (
    <div className="space-y-3 stagger-item">
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn("h-14 w-full skeleton rounded-xl stagger-item", `stagger-${i + 1}`)} />
      ))}
    </div>
  );
};
