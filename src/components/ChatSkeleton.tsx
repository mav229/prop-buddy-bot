export const ChatSkeleton = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] px-6 animate-fade-in">
      {/* Avatar skeleton */}
      <div className="w-20 h-20 rounded-full skeleton mb-5" />
      
      {/* Title skeleton */}
      <div className="h-6 w-48 skeleton mb-3" />
      
      {/* Subtitle skeleton */}
      <div className="h-4 w-64 skeleton mb-2" />
      <div className="h-4 w-40 skeleton mb-8" />
      
      {/* Suggestion buttons skeleton */}
      <div className="w-full max-w-xs space-y-3">
        <div className="h-12 w-full skeleton" />
        <div className="h-12 w-full skeleton" />
        <div className="h-12 w-full skeleton" />
      </div>
    </div>
  );
};

export const MessageSkeleton = () => {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full skeleton flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 skeleton" />
        <div className="h-4 w-1/2 skeleton" />
      </div>
    </div>
  );
};
