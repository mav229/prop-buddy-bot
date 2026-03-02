import { useState, useEffect } from "react";
import { Headphones, Clock } from "lucide-react";

interface AgentConnectMessageProps {
  requestedAt: Date;
}

export const AgentConnectMessage = ({ requestedAt }: AgentConnectMessageProps) => {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - requestedAt.getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      if (hrs > 0) {
        setElapsed(`${hrs}h ${remainingMins}m ago`);
      } else if (mins > 0) {
        setElapsed(`${mins}m ago`);
      } else {
        setElapsed("just now");
      }
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [requestedAt]);

  return (
    <div className="max-w-[85%] rounded-2xl rounded-tl-md overflow-hidden border border-[hsl(142,40%,20%)] bg-[hsl(142,30%,8%)]">
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-[hsl(142,50%,15%)] border border-[hsl(142,50%,25%)] flex items-center justify-center">
            <Headphones className="w-4 h-4 text-[hsl(142,76%,46%)]" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-[hsl(142,76%,56%)]">
              Live agent connecting
            </p>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[hsl(0,0%,40%)]" />
              <span className="text-[10px] text-[hsl(0,0%,40%)]">Requested {elapsed}</span>
            </div>
          </div>
        </div>
        <p className="text-[13px] text-[hsl(0,0%,65%)] leading-relaxed">
          A real agent will join this conversation within <strong className="text-[hsl(0,0%,85%)]">4 hours</strong>. Stay in this chat — they'll reply right here.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[hsl(142,76%,46%)] animate-pulse" />
          <span className="text-[11px] text-[hsl(142,60%,40%)]">Waiting for agent...</span>
        </div>
      </div>
    </div>
  );
};
