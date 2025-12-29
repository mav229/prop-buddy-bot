export const ChatSkeleton = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] px-6 animate-fade-in">
      {/* Avatar skeleton */}
      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer mb-5" />
      
      {/* Title skeleton */}
      <div className="h-6 w-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-lg mb-3" />
      
      {/* Subtitle skeleton */}
      <div className="h-4 w-64 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-lg mb-2" />
      <div className="h-4 w-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-lg mb-8" />
      
      {/* Suggestion buttons skeleton */}
      <div className="w-full max-w-xs space-y-3">
        <div className="h-12 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-2xl" />
        <div className="h-12 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-2xl" />
        <div className="h-12 w-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-2xl" />
      </div>
    </div>
  );
};

export const MessageSkeleton = () => {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-lg" />
        <div className="h-4 w-1/2 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded-lg" />
      </div>
    </div>
  );
};
