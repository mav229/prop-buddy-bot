import { UserCheck } from "lucide-react";

export const AgentJoinedMessage = () => (
  <div className="flex items-center gap-3 py-2 px-4">
    <div className="flex-1 h-px bg-[hsl(142,30%,20%)]" />
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(142,30%,10%)] border border-[hsl(142,40%,20%)]">
      <UserCheck className="w-3.5 h-3.5 text-[hsl(142,76%,46%)]" />
      <span className="text-[11px] font-medium text-[hsl(142,76%,56%)]">Live Agent has joined</span>
    </div>
    <div className="flex-1 h-px bg-[hsl(142,30%,20%)]" />
  </div>
);
