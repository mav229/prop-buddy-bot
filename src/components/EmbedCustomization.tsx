import { useState } from "react";
import { Code, Copy, Check, ExternalLink, Layout, MessageSquare, Globe, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";

export const EmbedCustomization = () => {
  const { config, updateConfig, saveConfig, isSaving } = useWidgetConfig();
  const [copied, setCopied] = useState<string | null>(null);

  const previewUrl = window.location.origin;
  
  // Host URL: use custom domain if set, otherwise current origin
  const hostUrl = (config.customDomain?.trim() || previewUrl).replace(/\/+$/, "");

  // Simple iFrame embed code
  const iframeCode = `<iframe 
  src="${hostUrl}/embed" 
  width="100%" 
  height="${config.embedHeight}px" 
  frameborder="0"
  style="border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);"
></iframe>`;

  // Dynamic widget code that fetches config from API
  const widgetCode = `<!-- Scholaris Chat Widget -->
<script>
(function() {
  var GLOBAL_KEY = '__scholaris_widget_loaded__';
  if (window[GLOBAL_KEY]) return;
  window[GLOBAL_KEY] = true;

  var host = '${hostUrl}';
  var configUrl = host + '/functions/v1/widget-config';

  // Remove any existing widget
  var old = document.getElementById('scholaris-widget-container');
  if (old) old.remove();

  // Fetch live config
  fetch(configUrl)
    .then(function(r) { return r.json(); })
    .then(function(data) { initWidget(data.config || {}); })
    .catch(function() { initWidget({}); });

  function initWidget(cfg) {
    var blockedUrls = cfg.blockedUrls || [];
    var launcherImg = cfg.launcherLogoUrl || '${config.launcherLogoUrl}';
    var requestedW = cfg.embedWidth || ${config.embedWidth};
    var requestedH = cfg.embedHeight || ${config.embedHeight};

    // Check blocklist
    var currentUrl = window.location.href;
    var currentPath = window.location.pathname;
    for (var i = 0; i < blockedUrls.length; i++) {
      if (currentUrl.indexOf(blockedUrls[i]) !== -1 || currentPath.indexOf(blockedUrls[i]) !== -1) return;
    }

    var allowedOrigin = '';
    try { allowedOrigin = new URL(host).origin; } catch(e) {}

    var bubbleSize = 64;

    function calcW() { return Math.min(requestedW, Math.max(280, window.innerWidth * 0.92)); }
    function calcH() { return Math.min(requestedH, Math.max(360, window.innerHeight * 0.82)); }

    function setImp(el, prop, val) {
      try { el.style.setProperty(prop, val, 'important'); } catch(e) {}
    }

    // Container
    var container = document.createElement('div');
    container.id = 'scholaris-widget-container';
    setImp(container, 'position', 'fixed');
    setImp(container, 'right', 'calc(16px + env(safe-area-inset-right))');
    setImp(container, 'bottom', 'calc(16px + env(safe-area-inset-bottom))');
    setImp(container, 'z-index', '2147483647');

    // Launcher button
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open chat');
    setImp(btn, 'width', bubbleSize + 'px');
    setImp(btn, 'height', bubbleSize + 'px');
    setImp(btn, 'border', 'none');
    setImp(btn, 'padding', '0');
    setImp(btn, 'border-radius', '9999px');
    setImp(btn, 'overflow', 'hidden');
    setImp(btn, 'background', 'transparent');
    setImp(btn, 'cursor', 'pointer');

    var img = document.createElement('img');
    img.src = launcherImg;
    img.alt = 'Chat';
    setImp(img, 'width', '100%');
    setImp(img, 'height', '100%');
    setImp(img, 'display', 'block');
    setImp(img, 'object-fit', 'cover');
    setImp(img, 'border-radius', '9999px');
    btn.appendChild(img);

    // Panel
    var panel = document.createElement('div');
    setImp(panel, 'display', 'none');
    setImp(panel, 'overflow', 'hidden');
    setImp(panel, 'background', 'transparent');

    var iframe = document.createElement('iframe');
    iframe.src = host + '/widget?v=' + Date.now();
    iframe.allow = 'clipboard-write';
    iframe.title = 'Scholaris chat';
    setImp(iframe, 'width', '100%');
    setImp(iframe, 'height', '100%');
    setImp(iframe, 'border', 'none');
    setImp(iframe, 'display', 'block');
    setImp(iframe, 'background', '#0b1020');

    panel.appendChild(iframe);
    container.appendChild(btn);
    container.appendChild(panel);
    document.body.appendChild(container);

    var isExpanded = false;

    function postToWidget(action) {
      try { iframe.contentWindow.postMessage({ type: 'scholaris:host', action: action }, allowedOrigin || '*'); } catch(e) {}
    }

    function setSize(expanded) {
      if (!expanded) return;
      var w = calcW(), h = calcH();
      var small = window.innerWidth < 520;
      if (small) {
        setImp(container, 'left', '0'); setImp(container, 'right', '0');
        setImp(container, 'top', '0'); setImp(container, 'bottom', '0');
        setImp(panel, 'width', '100vw'); setImp(panel, 'height', '100dvh');
        setImp(panel, 'border-radius', '0'); setImp(iframe, 'border-radius', '0');
      } else {
        setImp(container, 'left', 'auto'); setImp(container, 'top', 'auto');
        setImp(container, 'right', 'calc(16px + env(safe-area-inset-right))');
        setImp(container, 'bottom', 'calc(16px + env(safe-area-inset-bottom))');
        setImp(panel, 'width', w + 'px'); setImp(panel, 'height', h + 'px');
        setImp(panel, 'border-radius', '24px'); setImp(iframe, 'border-radius', '24px');
      }
    }

    function open() {
      isExpanded = true;
      btn.style.display = 'none';
      panel.style.display = 'block';
      setSize(true);
      postToWidget('expand');
    }

    function close() {
      isExpanded = false;
      setImp(container, 'left', 'auto'); setImp(container, 'top', 'auto');
      setImp(container, 'right', 'calc(16px + env(safe-area-inset-right))');
      setImp(container, 'bottom', 'calc(16px + env(safe-area-inset-bottom))');
      panel.style.display = 'none';
      btn.style.display = 'block';
      postToWidget('minimize');
    }

    btn.onclick = open;
    window.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', function() { if (isExpanded) setSize(true); });
    window.addEventListener('message', function(e) {
      if (!e.data || e.data.type !== 'scholaris:widget') return;
      if (e.data.action === 'minimized') close();
    });

    close();
  }
})();
</script>`;

  const handleCopy = async (code: string, type: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(type);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveDomain = async () => {
    await saveConfig();
    toast.success("Embed settings saved!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Embed Widget</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Add Scholaris AI to your website
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a 
            href={`${previewUrl}/embed`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Preview</span>
          </a>
        </div>
      </div>

      {/* Embed Settings */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Embed Settings
          </CardTitle>
          <CardDescription>Configure your embed URL and dimensions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customDomain" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Published App URL
            </Label>
            <Input
              id="customDomain"
              placeholder="https://your-app.lovable.app"
              value={config.customDomain || ""}
              onChange={(e) => updateConfig({ customDomain: e.target.value })}
              className="bg-background/50"
            />
            <p className="text-xs text-muted-foreground">
              Enter your published app URL. The embed code will load the chat from this URL.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="width">Width (px)</Label>
              <Input
                id="width"
                type="number"
                value={config.embedWidth || 384}
                onChange={(e) => updateConfig({ embedWidth: parseInt(e.target.value) || 384 })}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height (px)</Label>
              <Input
                id="height"
                type="number"
                value={config.embedHeight || 600}
                onChange={(e) => updateConfig({ embedHeight: parseInt(e.target.value) || 600 })}
                className="bg-background/50"
              />
            </div>
          </div>
          <Button onClick={handleSaveDomain} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Embed Codes */}
      <Tabs defaultValue="widget" className="space-y-4">
        <TabsList className="bg-card/50 border border-border/50 w-full sm:w-auto">
          <TabsTrigger value="widget" className="flex-1 sm:flex-initial gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Floating Widget</span>
            <span className="sm:hidden">Widget</span>
          </TabsTrigger>
          <TabsTrigger value="iframe" className="flex-1 sm:flex-initial gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background">
            <Code className="w-4 h-4" />
            <span className="hidden sm:inline">iFrame Embed</span>
            <span className="sm:hidden">iFrame</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="widget">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Floating Widget (Recommended)</CardTitle>
                  <CardDescription className="text-sm">Adds a chat bubble to the corner of your site. Updates automatically when you change settings.</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(widgetCode, "widget")}
                  className="gap-2 w-full sm:w-auto"
                >
                  {copied === "widget" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === "widget" ? "Copied!" : "Copy Code"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-background/80 border border-border/50 rounded-lg p-4 text-xs overflow-x-auto max-h-64">
                <code className="text-muted-foreground">{widgetCode}</code>
              </pre>
              <p className="text-xs text-muted-foreground mt-3">
                ✨ This widget fetches settings from your API automatically. Change colors, text, or logo in the Customize tab - live widgets update without code changes.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="iframe">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">iFrame Embed</CardTitle>
                  <CardDescription className="text-sm">Embed the chat in a specific section of your page</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(iframeCode, "iframe")}
                  className="gap-2 w-full sm:w-auto"
                >
                  {copied === "iframe" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === "iframe" ? "Copied!" : "Copy Code"}
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
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Full Page Embed</p>
            <p className="text-xs text-muted-foreground truncate">{previewUrl}/embed</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Widget Preview</p>
            <p className="text-xs text-muted-foreground truncate">{previewUrl}/widget</p>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </a>
      </div>
    </div>
  );
};
