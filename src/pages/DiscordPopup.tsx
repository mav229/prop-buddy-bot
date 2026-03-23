import { useEffect } from "react";
import { Check, CircleAlert, ExternalLink } from "lucide-react";
import { useSearchParams } from "react-router-dom";

const DiscordGlyph = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const DiscordPopup = () => {
  const [searchParams] = useSearchParams();

  const status = searchParams.get("status") === "error" ? "error" : "success";
  const title = searchParams.get("title") || (status === "success" ? "Discord Connected" : "Connection Failed");
  const subtitle = searchParams.get("subtitle") || (status === "success" ? "You're all set" : "Please try again");
  const username = searchParams.get("username") || "test.user";
  const role = searchParams.get("role") || "Student";
  const message =
    searchParams.get("message") ||
    (status === "success"
      ? "Your role has been assigned based on your PropScholar account."
      : "We couldn't finish the connection flow.");
  const note =
    searchParams.get("note") ||
    (status === "success" ? "Syncing role in background" : "This window will close automatically");
  const closeMs = Number(searchParams.get("close") || (status === "success" ? "5000" : "8000"));
  const returnTo = searchParams.get("returnTo") || "/fullpage";

  useEffect(() => {
    if (!closeMs || Number.isNaN(closeMs)) return;
    const timer = window.setTimeout(() => window.close(), closeMs);
    return () => window.clearTimeout(timer);
  }, [closeMs]);

  const theme =
    status === "success"
      ? {
          ring: "hsl(var(--success) / 0.18)",
          glow: "hsl(var(--success) / 0.14)",
          border: "hsl(var(--success) / 0.18)",
          badge: "border-success/20 bg-success/10 text-success",
          iconWrap: "border-success/15 bg-success/10 text-success",
          progress: "linear-gradient(90deg, hsl(var(--success)), hsl(var(--success)), hsl(var(--primary)))",
          icon: <Check className="h-8 w-8" strokeWidth={2.75} />,
        }
      : {
          ring: "hsl(var(--destructive) / 0.18)",
          glow: "hsl(var(--destructive) / 0.14)",
          border: "hsl(var(--destructive) / 0.18)",
          badge: "border-destructive/20 bg-destructive/10 text-destructive",
          iconWrap: "border-destructive/15 bg-destructive/10 text-destructive",
          progress: "linear-gradient(90deg, hsl(var(--destructive)), hsl(var(--destructive)), hsl(var(--primary)))",
          icon: <CircleAlert className="h-8 w-8" strokeWidth={2.25} />,
        };

  return (
    <>
      <style>{`@keyframes discordPopupShrink{from{transform:scaleX(1)}to{transform:scaleX(0)}}`}</style>
      <div
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 text-foreground"
        style={{
          backgroundImage: `radial-gradient(circle at top, ${theme.glow}, transparent 26%), linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--card)) 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, hsl(var(--primary) / 0.05), transparent 20%), radial-gradient(circle at 80% 10%, hsl(var(--foreground) / 0.04), transparent 18%), radial-gradient(circle at 50% 100%, hsl(var(--muted-foreground) / 0.08), transparent 28%)",
          }}
        />

        <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-border/80 bg-card/80 shadow-2xl backdrop-blur-xl">
          <div
            className="absolute inset-x-10 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.18), transparent)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 h-1 w-full origin-left"
            style={{
              background: theme.progress,
              animation: `discordPopupShrink ${Math.max(closeMs, 1000)}ms linear forwards`,
            }}
          />

          <div className="relative px-7 pb-8 pt-10 text-center sm:px-9">
            <div
              className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border shadow-lg"
              style={{
                background: `radial-gradient(circle, ${theme.ring} 0%, transparent 72%)`,
                borderColor: theme.border,
                boxShadow: `0 0 0 1px ${theme.border} inset`,
              }}
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-full border ${theme.iconWrap}`}>
                {theme.icon}
              </div>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>

            {status === "success" && (
              <>
                <div className="mt-7 inline-flex max-w-full items-center gap-3 rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3 text-left">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-background/60 text-primary">
                    <DiscordGlyph className="h-5 w-5" />
                  </div>
                  <span className="truncate text-sm font-medium text-foreground">{username}</span>
                </div>

                <div className={`mt-4 inline-flex items-center rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${theme.badge}`}>
                  {role}
                </div>
              </>
            )}

            <p className="mx-auto mt-5 max-w-xs text-sm leading-6 text-muted-foreground">{message}</p>

            <div className="mt-5 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${status === "success" ? "bg-success" : "bg-destructive"}`} />
              {note}
            </div>

            <a
              href={returnTo}
              className="mt-7 inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/70 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Back to Dashboard
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default DiscordPopup;
