import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, RotateCcw } from "lucide-react";
import { WidgetTestEmbed } from "@/components/WidgetTestEmbed";

function setMetaTag(name: string, content: string) {
  let tag = document.querySelector(`meta[name=\"${name}\"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

type WidgetState = "minimized" | "expanded";

type PageBg = "dark" | "light" | "checker";

function MinimalIframeEmbed() {
  const [widgetState, setWidgetState] = useState<WidgetState>("minimized");
  const [reloadKey, setReloadKey] = useState(0);
  const [pageBg, setPageBg] = useState<PageBg>("dark");

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e?.data || typeof e.data !== "object") return;
      const data = e.data as { type?: string; action?: string };
      if (data.type !== "scholaris:widget") return;
      if (data.action === "expanded") setWidgetState("expanded");
      if (data.action === "minimized") setWidgetState("minimized");
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const dims = useMemo(() => {
    const bubble = 64;
    const expW = 384;
    const expH = 600;

    const calcW = () => Math.min(expW, Math.max(280, Math.floor(window.innerWidth * 0.92)));
    const calcH = () => Math.min(expH, Math.max(360, Math.floor(window.innerHeight * 0.82)));

    if (widgetState === "minimized") {
      return {
        width: bubble,
        height: bubble,
        borderRadius: "9999px",
        fullscreen: false,
      };
    }

    const small = window.innerWidth < 520;
    if (small) {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
        borderRadius: "0px",
        fullscreen: true,
      };
    }

    return {
      width: calcW(),
      height: calcH(),
      borderRadius: "24px",
      fullscreen: false,
    };
  }, [widgetState]);

  // Recompute on resize
  useEffect(() => {
    const onResize = () => {
      // force re-render to update dims
      setWidgetState((s) => s);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const pageBgClass =
    pageBg === "dark"
      ? "bg-background"
      : pageBg === "light"
        ? "bg-muted"
        : "bg-[linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%,hsl(var(--muted))),linear-gradient(45deg,hsl(var(--muted))_25%,transparent_25%,transparent_75%,hsl(var(--muted))_75%,hsl(var(--muted)))] bg-[length:28px_28px] bg-[position:0_0,14px_14px]";

  return (
    <div className={pageBgClass + " relative min-h-[560px] rounded-2xl border border-border/60 overflow-hidden"}>
      <div className="absolute inset-x-0 top-0 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Mode: minimal host</Badge>
            <Badge variant={widgetState === "expanded" ? "default" : "outline"}>
              Widget: {widgetState}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={pageBg === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setPageBg("dark")}
            >
              Dark bg
            </Button>
            <Button
              variant={pageBg === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setPageBg("light")}
            >
              Light bg
            </Button>
            <Button
              variant={pageBg === "checker" ? "default" : "outline"}
              size="sm"
              onClick={() => setPageBg("checker")}
            >
              Checker bg
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setWidgetState("minimized");
                setReloadKey((k) => k + 1);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reload iframe
            </Button>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground max-w-3xl">
          If the white sheet appears here (with a clean host container + single iframe), its coming from inside the iframe app.
        </p>
      </div>

      {/* Fake page content to prove the host stays normal */}
      <div className="pt-28 px-4 pb-24">
        <Card className="glass-panel p-4">
          <h1 className="font-display text-lg font-semibold">Embed checker playground</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Click around while opening/closing the widget. Change the host background to make it obvious whether the flash is in the iframe.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary">Host button A</Button>
            <Button variant="secondary">Host button B</Button>
            <Button variant="outline">Host outline</Button>
          </div>
        </Card>
      </div>

      {/* The actual minimal embed */}
      <div
        style={{
          position: "fixed",
          right: dims.fullscreen ? 0 : 16,
          bottom: dims.fullscreen ? 0 : 16,
          top: dims.fullscreen ? 0 : "auto",
          left: dims.fullscreen ? 0 : "auto",
          width: dims.fullscreen ? "100vw" : dims.width,
          height: dims.fullscreen ? "100dvh" : dims.height,
          borderRadius: dims.borderRadius,
          overflow: "hidden",
          zIndex: 2147483647,
          background: "transparent",
          boxShadow: "none",
        }}
      >
        <iframe
          key={reloadKey}
          src={`/widget?debug=1&r=${reloadKey}`}
          title="Widget (minimal host)"
          allow="clipboard-write"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
            background: "#0b1020",
            borderRadius: dims.borderRadius,
          }}
        />
      </div>
    </div>
  );
}

export default function EmbedChecker() {
  useEffect(() => {
    document.title = "Embed Checker | Widget";
    setMetaTag(
      "description",
      "Embed checker to confirm whether widget flashes are coming from the host site or from inside the iframe widget app."
    );
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-bold">Embed checker</h1>
            <p className="text-sm text-muted-foreground">
              Compare minimal iframe embed vs host simulation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="outline">Back to chat</Button>
            </Link>
            <a href="/widget" target="_blank" rel="noreferrer">
              <Button variant="secondary">
                Open /widget <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-6">
        <Card className="glass-panel p-5">
          <h2 className="font-display text-base font-semibold">How to use this page</h2>
          <ol className="mt-2 text-sm text-muted-foreground list-decimal pl-5 space-y-1">
            <li>Open and close the widget a few times in each tab.</li>
            <li>If you see the white sheet in the <b>Minimal host</b> tab, its coming from inside the iframe widget app.</li>
            <li>If it happens only in <b>Host simulation</b>, its caused by host-side overlays/styles.</li>
          </ol>
          <Separator className="my-4" />
          <p className="text-sm text-muted-foreground">
            Tip: switch between <b>Dark</b>/<b>Light</b>/<b>Checker</b> backgrounds in the Minimal tab to make flashes obvious.
          </p>
        </Card>

        <div className="mt-6">
          <Tabs defaultValue="minimal">
            <TabsList>
              <TabsTrigger value="minimal">Minimal host</TabsTrigger>
              <TabsTrigger value="host">Host simulation</TabsTrigger>
              <TabsTrigger value="direct">Direct routes</TabsTrigger>
            </TabsList>

            <TabsContent value="minimal" className="mt-4">
              <MinimalIframeEmbed />
            </TabsContent>

            <TabsContent value="host" className="mt-4">
              <Card className="glass-panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-base font-semibold">Host simulation (legacy)</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      This mounts the in-app <code>WidgetTestEmbed</code> (iframe + overlay button + nudge). If the flash only happens here,
                      its host-layer related.
                    </p>
                  </div>
                  <Badge variant="outline">Mounts fixed widget</Badge>
                </div>
                <Separator className="my-4" />
                <div className="rounded-xl border border-border/60 p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    The widget is now mounted bottom-right on this page. Test open/close here.
                  </p>
                </div>
                <WidgetTestEmbed />
              </Card>
            </TabsContent>

            <TabsContent value="direct" className="mt-4">
              <Card className="glass-panel p-5">
                <h3 className="font-display text-base font-semibold">Direct routes</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Use these to test behavior without any embed container logic.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href="/widget" target="_blank" rel="noreferrer">
                    <Button variant="secondary">
                      Open /widget <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                  <a href="/embed" target="_blank" rel="noreferrer">
                    <Button variant="outline">
                      Open /embed <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </main>
  );
}
