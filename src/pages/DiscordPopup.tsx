import { useEffect, useMemo } from "react";
import { Check, CircleAlert, Discord, ExternalLink } from "lucide-react";
import { useSearchParams } from "react-router-dom";

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

  const progressStyle = useMemo(
    () => ({ animationDuration: `${Math.max(closeMs, 1000)}ms` }),
    [closeMs]
  );

  const theme =
    status === "success"
      ? {
          ring: "hsl(var(--success) / 0.18)",
          glow: "hsl(var(--success) / 0.14)",
          border: "hsl(var(--success) / 0.18)",
          badge: "border-success/20 bg-success/10 text-success",
          iconWrap: "border-success/15 bg-success/10 text-success",
          progress: "from-success via-success to-primary",
          icon: <Check className="h-8 w-8" strokeWidth={2.75} />,
        }
      : {
          ring: "hsl(var(--destructive) / 0.18)",
          glow: "hsl(var(--destructive) / 0.14)",
          border: "hsl(var(--destructive) / 0.18)",
          badge: "border-destructive/20 bg-destructive/10 text-destructive",
          iconWrap: "border-destructive/15 bg-destructive/10 text-destructive",
          progress: "from-destructive via-destructive to-primary",
          icon: <CircleAlert className="h-8 w-8" strokeWidth={2.25} />,
        };

  return (
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
        <div className={`absolute bottom-0 left-0 h-1 w-full origin-left bg-gradient-to-r ${theme.progress} animate-[shrink_var(--duration)_linear_forwards]`} style={{ ["--duration" as string]: `${Math.max(closeMs, 1000)}ms`, ...progressStyle }} />

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
                  <Discord className="h-5 w-5" />
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
  );
};

export default DiscordPopup;
