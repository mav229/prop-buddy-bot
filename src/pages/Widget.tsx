import { useEffect } from "react";
import { Lock } from "lucide-react";
import propscholarIcon from "@/assets/propscholar-icon.png";

const Widget = () => {
  useEffect(() => {
    document.documentElement.classList.add("widget-mode");
    document.body.classList.add("widget-mode");
    document.documentElement.style.background = "transparent";
    document.documentElement.style.backgroundColor = "transparent";
    document.body.style.background = "transparent";
    document.body.style.backgroundColor = "transparent";
    const root = document.getElementById("root");
    if (root) {
      root.style.background = "transparent";
      root.style.backgroundColor = "transparent";
    }
    return () => {
      document.documentElement.classList.remove("widget-mode");
      document.body.classList.remove("widget-mode");
    };
  }, []);

  return (
    <div className="w-full h-full sm:aspect-video flex items-center justify-center relative overflow-hidden rounded-2xl" style={{ background: "hsl(0,0%,6%)" }}>
      {/* Blurred background mockup */}
      <div className="absolute inset-0 flex flex-col opacity-30 blur-[6px] scale-105 pointer-events-none select-none">
        <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-white/10">
          <div className="w-8 h-8 rounded-full bg-white/10" />
          <div className="space-y-1">
            <div className="w-24 h-3 rounded bg-white/15" />
            <div className="w-16 h-2 rounded bg-white/10" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-3">
          <div className="flex gap-2"><div className="w-6 h-6 rounded-full bg-white/10" /><div className="w-48 h-10 rounded-xl bg-white/8" /></div>
          <div className="flex gap-2 justify-end"><div className="w-36 h-8 rounded-xl bg-white/12" /><div className="w-6 h-6 rounded-full bg-white/10" /></div>
          <div className="flex gap-2"><div className="w-6 h-6 rounded-full bg-white/10" /><div className="w-56 h-14 rounded-xl bg-white/8" /></div>
        </div>
        <div className="px-4 pb-4"><div className="w-full h-10 rounded-xl bg-white/10" /></div>
      </div>

      {/* Coming Soon overlay */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 mb-4 shadow-lg shadow-black/40">
          <img src={propscholarIcon} alt="Scholaris" className="w-full h-full object-cover" />
        </div>
        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <Lock className="w-5 h-5 text-white/50" />
        </div>
        <h2 className="text-white/90 text-lg font-semibold tracking-tight">Coming Soon</h2>
      </div>
    </div>
  );
};

export default Widget;
