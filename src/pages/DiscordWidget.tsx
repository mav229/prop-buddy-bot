import { useSearchParams } from "react-router-dom";
import { DiscordConnectWidget } from "@/components/DiscordConnectWidget";

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
  </svg>
);

const DiscordWidgetPage = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || undefined;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 overflow-hidden relative"
         style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Subtle white glow background */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div
          className="rounded-full blur-[120px] opacity-[0.04]"
          style={{ width: 600, height: 600, background: "white" }}
        />
      </div>

      {/* Main card */}
      <div
        className="relative w-full max-w-md"
        style={{ animation: "cardIn 0.8s cubic-bezier(0.16,1,0.3,1) forwards" }}
      >
        {/* Card container */}
        <div className="relative rounded-3xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden">

          {/* Top edge shine */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
            }}
          />

          <div className="px-8 pt-10 pb-8 flex flex-col items-center text-center">

            {/* Floating Discord icon */}
            <div className="relative mb-8">
              <div
                className="w-20 h-20 rounded-2xl border border-white/10 bg-white/[0.04] flex items-center justify-center"
                style={{ animation: "float 4s ease-in-out infinite" }}
              >
                <DiscordIcon className="w-10 h-10 text-[#5865F2]" />
              </div>
              {/* Shadow beneath */}
              <div
                className="absolute -bottom-4 left-1/2 w-14 h-3 rounded-full bg-white/10 blur-sm"
                style={{ animation: "shadowPulse 4s ease-in-out infinite", transform: "translateX(-50%)" }}
              />
            </div>

            {/* Eyebrow */}
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30 mb-4"
              style={{ animation: "fadeUp 0.6s 0.3s both" }}
            >
              Community
            </span>

            {/* Heading */}
            <h1 className="mb-3" style={{ animation: "fadeUp 0.6s 0.4s both" }}>
              <span className="block text-3xl font-bold text-white/40">
                Join the
              </span>
              <span className="block text-3xl font-bold text-white mt-1">
                conversation
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="text-sm text-white/30 max-w-[260px] leading-relaxed mb-8"
              style={{ animation: "fadeUp 0.6s 0.5s both" }}
            >
              Connect your account and get your role assigned automatically.
            </p>

            {/* Discord Connect Widget */}
            <div
              className="w-full flex justify-center"
              style={{ animation: "fadeUp 0.6s 0.6s both" }}
            >
              <DiscordConnectWidget emailOverride={email} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-14px); }
        }
        @keyframes shadowPulse {
          0%,100% { opacity: 0.7; transform: translateX(-50%) scaleX(1); }
          50%     { opacity: 0.15; transform: translateX(-50%) scaleX(0.55); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(40px) scale(0.93); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default DiscordWidgetPage;
