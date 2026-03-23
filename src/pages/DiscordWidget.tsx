import { useSearchParams } from "react-router-dom";
import { DiscordConnectWidget } from "@/components/DiscordConnectWidget";

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const DiscordWidgetPage = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || undefined;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative"
      style={{ fontFamily: "'Inter', sans-serif", background: "#050505" }}
    >
      {/* Main card with entry animation */}
      <div
        className="relative w-full max-w-[420px]"
        style={{ animation: "cardIn 0.9s cubic-bezier(0.16,1,0.3,1) forwards" }}
      >
        {/* Reflection glow beneath the card */}
        <div
          className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[80%] h-24 rounded-full blur-[40px] opacity-[0.12]"
          style={{ background: "linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.5) 50%, transparent 90%)" }}
        />

        {/* Card */}
        <div
          className="relative rounded-[28px] overflow-hidden"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 0 80px -20px rgba(0,0,0,0.8), inset 0 1px 0 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* Noise/grain texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundSize: "128px 128px",
            }}
          />

          {/* Top edge highlight */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3/5"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }}
          />

          <div className="relative px-10 pt-14 pb-10 flex flex-col items-center text-center">
            {/* Discord icon in dark square */}
            <div
              className="mb-8"
              style={{ animation: "fadeUp 0.6s 0.2s both" }}
            >
              <div
                className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 8px 32px -8px rgba(0,0,0,0.5)",
                }}
              >
                <DiscordIcon className="w-9 h-9 text-white/80" />
              </div>
            </div>

            {/* Eyebrow */}
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/25 mb-5"
              style={{ animation: "fadeUp 0.6s 0.3s both" }}
            >
              Community
            </span>

            {/* Heading */}
            <h1
              className="text-[28px] font-bold text-white leading-tight mb-3"
              style={{ animation: "fadeUp 0.6s 0.35s both" }}
            >
              Join the<br />conversation
            </h1>

            {/* Subtitle */}
            <p
              className="text-[13px] text-white/30 max-w-[260px] leading-relaxed mb-10"
              style={{ animation: "fadeUp 0.6s 0.4s both" }}
            >
              Connect your account and get your role
              assigned automatically.
            </p>

            {/* Connect widget */}
            <div
              className="w-full flex justify-center"
              style={{ animation: "fadeUp 0.6s 0.5s both" }}
            >
              <DiscordConnectWidget emailOverride={email} minimal />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(32px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default DiscordWidgetPage;
