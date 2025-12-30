import { useState } from "react";
import { Code, Copy, Check, ExternalLink, Palette, MessageSquare, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";

export const EmbedCustomization = () => {
  const { config: widgetConfig } = useWidgetConfig();
  const [copied, setCopied] = useState<string | null>(null);
  const [config, setConfig] = useState({
    botName: "Scholaris AI",
    welcomeMessage: "Hey! I'm Scholaris 👋",
    subtitle: "Your AI assistant for PropScholar",
    position: "bottom-right",
    width: "384",
    height: "600",
    customDomain: "",
  });

  const previewUrl = window.location.origin;

  // Host URL used in the embed code (production/custom domain). Preview links below always use the current app URL.
  const hostUrl = (config.customDomain.trim() || previewUrl).replace(/\/+$/, "");

  const iframeCode = `<iframe 
  src="${hostUrl}/embed" 
  width="100%" 
  height="${config.height}px" 
  frameborder="0"
  style="border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);"
  ></iframe>`;

  const blockedUrlsJson = JSON.stringify(widgetConfig.blockedUrls || []);

  const widgetCode = `<!-- Scholaris Chat Widget -->
<script>
  (function() {
    var host = '${hostUrl}';
    var blockedUrls = ${blockedUrlsJson};
    
    // Check if current URL matches any blocked pattern
    var currentUrl = window.location.href;
    var currentPath = window.location.pathname;
    for (var i = 0; i < blockedUrls.length; i++) {
      var pattern = blockedUrls[i];
      if (currentUrl.indexOf(pattern) !== -1 || currentPath.indexOf(pattern) !== -1) {
        console.log('Scholaris widget blocked on this page:', pattern);
        return; // Exit without loading widget
      }
    }
    
    var allowedOrigin = '';
    try { allowedOrigin = new URL(host).origin; } catch (e) { allowedOrigin = ''; }

    var bubbleSize = 64;
    var requestedW = parseInt('${config.width}', 10) || 384;
    var requestedH = parseInt('${config.height}', 10) || 600;

    function calcExpandedW() {
      var maxW = Math.max(280, Math.floor(window.innerWidth * 0.92));
      return Math.min(requestedW, maxW);
    }
    function calcExpandedH() {
      var maxH = Math.max(360, Math.floor(window.innerHeight * 0.82));
      return Math.min(requestedH, maxH);
    }

    var container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.right = 'calc(16px + env(safe-area-inset-right))';
    container.style.bottom = 'calc(16px + env(safe-area-inset-bottom))';
    container.style.width = bubbleSize + 'px';
    container.style.height = bubbleSize + 'px';
    container.style.zIndex = '2147483647';
    container.style.transition = 'width 240ms ease, height 240ms ease, left 240ms ease, right 240ms ease, bottom 240ms ease';

    var iframe = document.createElement('iframe');
    iframe.src = host + '/widget';
    iframe.allow = 'clipboard-write';
    iframe.title = 'Scholaris chat widget';

    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.display = 'block';
    iframe.style.overflow = 'hidden';
    iframe.style.borderRadius = '999px';
    iframe.style.background = 'transparent';
    iframe.style.pointerEvents = 'none';
    iframe.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,0.35)';
    iframe.style.transition = 'border-radius 220ms ease, box-shadow 220ms ease';

    var overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.setAttribute('aria-label', 'Open chat');
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.border = 'none';
    overlay.style.padding = '0';
    overlay.style.margin = '0';
    overlay.style.background = 'transparent';
    overlay.style.cursor = 'pointer';
    overlay.style.borderRadius = '999px';
    overlay.style.pointerEvents = 'auto';
    overlay.style.touchAction = 'manipulation';

    container.appendChild(iframe);
    container.appendChild(overlay);
    document.body.appendChild(container);

    // Notification bubble rendered OUTSIDE the iframe (host DOM)
    var nudge = document.createElement('div');
    nudge.setAttribute('data-scholaris-nudge', 'true');
    nudge.style.position = 'fixed';
    nudge.style.right = 'calc(16px + env(safe-area-inset-right))';
    nudge.style.bottom = 'calc(' + (bubbleSize + 28) + 'px + env(safe-area-inset-bottom))';
    nudge.style.maxWidth = '190px';
    nudge.style.padding = '10px 12px';
    nudge.style.borderRadius = '16px';
    nudge.style.background = 'rgba(255,255,255,0.98)';
    nudge.style.boxShadow = '0 10px 30px rgba(0,0,0,0.18)';
    nudge.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    nudge.style.display = 'none';
    nudge.style.zIndex = '2147483647';
    nudge.style.backdropFilter = 'blur(10px)';

    var nudgeText = document.createElement('div');
    nudgeText.style.fontSize = '13px';
    nudgeText.style.fontWeight = '700';
    nudgeText.style.color = '#111827';
    nudgeText.textContent = '${widgetConfig.notificationPopupText.replace(/'/g, "\\'")}';

    var nudgeClose = document.createElement('button');
    nudgeClose.type = 'button';
    nudgeClose.textContent = '×';
    nudgeClose.setAttribute('aria-label', 'Dismiss message');
    nudgeClose.style.position = 'absolute';
    nudgeClose.style.top = '-8px';
    nudgeClose.style.right = '-8px';
    nudgeClose.style.width = '22px';
    nudgeClose.style.height = '22px';
    nudgeClose.style.borderRadius = '999px';
    nudgeClose.style.border = 'none';
    nudgeClose.style.background = '#e5e7eb';
    nudgeClose.style.cursor = 'pointer';
    nudgeClose.style.fontWeight = '700';
    nudgeClose.style.color = '#4b5563';

    nudge.appendChild(nudgeText);
    nudge.appendChild(nudgeClose);
    document.body.appendChild(nudge);

    var nudgeTimer = null;
    var NUDGE_KEY = 'scholaris_nudge_dismissed_session';

    function hideNudge() {
      nudge.style.display = 'none';
      if (nudgeTimer) clearTimeout(nudgeTimer);
      nudgeTimer = null;
    }

    function showNudge() {
      try { if (sessionStorage.getItem(NUDGE_KEY) === '1') return; } catch (e) {}
      nudge.style.display = 'block';
    }

    function scheduleNudge() {
      ${!widgetConfig.showNotificationPopup ? 'return;' : ''}
      try { if (sessionStorage.getItem(NUDGE_KEY) === '1') return; } catch (e) {}
      if (nudgeTimer) return;
      nudgeTimer = setTimeout(function() {
        if (!isExpanded) showNudge();
      }, ${widgetConfig.notificationPopupDelay * 1000});
    }

    nudge.addEventListener('click', function() {
      hideNudge();
      try { sessionStorage.setItem(NUDGE_KEY, '1'); } catch (e) {}
      applyExpandedStyles(true, true);
    });

    nudgeClose.addEventListener('click', function(e) {
      e.stopPropagation();
      hideNudge();
      try { sessionStorage.setItem(NUDGE_KEY, '1'); } catch (e) {}
    });

    var isExpanded = false;
    
    // Preload chime sound for widget open
    var chimeSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    chimeSound.volume = 0.3;

    function postToWidget(action) {
      try {
        var target = allowedOrigin || '*';
        iframe.contentWindow && iframe.contentWindow.postMessage({ type: 'scholaris:host', action: action }, target);
      } catch (e) {}
    }

    function applyExpandedStyles(expand, playSound) {
      isExpanded = !!expand;

      if (isExpanded) {
        hideNudge();
        // Play chime sound when opening (only if triggered by user action)
        if (playSound) {
          try { chimeSound.currentTime = 0; chimeSound.play().catch(function(){}); } catch(e){}
        }
        var w = calcExpandedW();
        var h = calcExpandedH();

        var isSmall = window.innerWidth < 520;
        if (isSmall) {
          container.style.left = '0';
          container.style.right = '0';
          container.style.bottom = '0';
          container.style.width = '100vw';
          container.style.height = '100dvh';
          iframe.style.borderRadius = '0px';
        } else {
          container.style.left = 'auto';
          container.style.right = 'calc(16px + env(safe-area-inset-right))';
          container.style.bottom = 'calc(16px + env(safe-area-inset-bottom))';
          container.style.width = w + 'px';
          container.style.height = h + 'px';
          iframe.style.borderRadius = '16px';
        }

        iframe.style.boxShadow = '0 25px 60px -18px rgba(0,0,0,0.5)';
        iframe.style.pointerEvents = 'auto';
        overlay.style.display = 'none';
        postToWidget('expand');
      } else {
        container.style.left = 'auto';
        container.style.right = 'calc(16px + env(safe-area-inset-right))';
        container.style.bottom = 'calc(16px + env(safe-area-inset-bottom))';
        container.style.width = bubbleSize + 'px';
        container.style.height = bubbleSize + 'px';
        iframe.style.borderRadius = '999px';
        iframe.style.boxShadow = '0 25px 50px -12px rgba(0,0,0,0.35)';
        iframe.style.pointerEvents = 'none';
        overlay.style.display = 'block';
        postToWidget('minimize');
        scheduleNudge();
      }
    }

    overlay.addEventListener('click', function() { applyExpandedStyles(true, true); });

    window.addEventListener('keydown', function(e) {
      if (e && e.key === 'Escape') applyExpandedStyles(false, false);
    });

    iframe.addEventListener('load', function() {
      postToWidget(isExpanded ? 'expand' : 'minimize');
    });

    window.addEventListener('resize', function() {
      if (!isExpanded) return;
      applyExpandedStyles(true, false);
    });

    window.addEventListener('message', function(e) {
      if (!e || !e.data || e.data.type !== 'scholaris:widget') return;
      if (allowedOrigin && e.origin && e.origin !== allowedOrigin) return;
      if (e.data.action === 'expanded') applyExpandedStyles(true, true);
      if (e.data.action === 'minimized') applyExpandedStyles(false, false);
    });

    applyExpandedStyles(false, false);
    scheduleNudge();
  })();
</script>`;

  const handleCopy = async (code: string, type: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(type);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight">Embed Widget</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Add Scholaris AI to your website with a simple embed code
          </p>
        </div>
        <a 
          href={`${previewUrl}/embed`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Preview
        </a>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Customization
            </CardTitle>
            <CardDescription>Configure your widget appearance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customDomain">Published App URL</Label>
              <Input
                id="customDomain"
                placeholder="https://your-app.lovable.app"
                value={config.customDomain}
                onChange={(e) => setConfig({ ...config, customDomain: e.target.value })}
                className="bg-background/50"
              />
              <p className="text-xs text-muted-foreground">
                Enter your published app URL (from the Publish screen). The embed code will load the chat from this URL.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="botName">Bot Name</Label>
              <Input
                id="botName"
                value={config.botName}
                onChange={(e) => setConfig({ ...config, botName: e.target.value })}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Input
                id="welcomeMessage"
                value={config.welcomeMessage}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                value={config.subtitle}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                className="bg-background/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="width">Width (px)</Label>
                <Input
                  id="width"
                  type="number"
                  value={config.width}
                  onChange={(e) => setConfig({ ...config, width: e.target.value })}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (px)</Label>
                <Input
                  id="height"
                  type="number"
                  value={config.height}
                  onChange={(e) => setConfig({ ...config, height: e.target.value })}
                  className="bg-background/50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layout className="w-5 h-5" />
              Live Preview
            </CardTitle>
            <CardDescription>See how the widget will look</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative bg-gradient-to-br from-muted/30 to-muted/10 rounded-xl p-4 min-h-[300px] flex items-end justify-end">
              {/* Mini preview */}
              <div className="w-64 h-80 bg-gradient-to-b from-[#0a1628] to-[#050d1a] rounded-xl border border-primary/20 shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-[#0a1628] to-[#0d1d35] px-3 py-2 border-b border-primary/20">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 animate-pulse" />
                    <div>
                      <p className="text-xs font-semibold text-white">{config.botName}</p>
                      <p className="text-[10px] text-primary/60">Online</p>
                    </div>
                  </div>
                </div>
                <div className="p-3 flex flex-col items-center justify-center h-48 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/20 mb-2" />
                  <p className="text-xs text-white font-medium">{config.welcomeMessage}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{config.subtitle}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Embed Codes */}
      <Tabs defaultValue="iframe" className="space-y-4">
        <TabsList className="bg-card/50 border border-border/50">
          <TabsTrigger value="iframe" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
            <Code className="w-4 h-4" />
            iFrame Embed
          </TabsTrigger>
          <TabsTrigger value="widget" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
            <MessageSquare className="w-4 h-4" />
            Floating Widget
          </TabsTrigger>
        </TabsList>

        <TabsContent value="iframe">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">iFrame Embed</CardTitle>
                  <CardDescription className="text-sm">Embed the chat in a specific section of your page</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(iframeCode, "iframe")}
                  className="gap-2"
                >
                  {copied === "iframe" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === "iframe" ? "Copied!" : "Copy"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-background/80 border border-border/50 rounded-lg p-4 text-xs overflow-x-auto">
                <code className="text-muted-foreground">{iframeCode}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="widget">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Floating Widget</CardTitle>
                  <CardDescription className="text-sm">Add a floating chat bubble to the bottom-right corner</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(widgetCode, "widget")}
                  className="gap-2"
                >
                  {copied === "widget" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === "widget" ? "Copied!" : "Copy"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-background/80 border border-border/50 rounded-lg p-4 text-xs overflow-x-auto">
                <code className="text-muted-foreground">{widgetCode}</code>
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <div className="grid sm:grid-cols-2 gap-4">
        <a 
          href={`${previewUrl}/embed`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layout className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Full Page Embed (Preview)</p>
            <p className="text-xs text-muted-foreground">{previewUrl}/embed</p>
          </div>
          <ExternalLink className="w-4 h-4 ml-auto text-muted-foreground" />
        </a>
        <a 
          href={`${previewUrl}/widget`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Widget Preview</p>
            <p className="text-xs text-muted-foreground">{previewUrl}/widget</p>
          </div>
          <ExternalLink className="w-4 h-4 ml-auto text-muted-foreground" />
        </a>
      </div>
    </div>
  );
};
