import { useState } from "react";
import { Code, Copy, Check, ExternalLink, Palette, MessageSquare, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const EmbedCustomization = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const [config, setConfig] = useState({
    botName: "Scholaris AI",
    welcomeMessage: "Hey! I'm Scholaris 👋",
    subtitle: "Your AI assistant for PropScholar",
    position: "bottom-right",
    width: "384",
    height: "600",
  });

  const baseUrl = window.location.origin;

  const iframeCode = `<iframe 
  src="${baseUrl}/embed" 
  width="100%" 
  height="${config.height}px" 
  frameborder="0"
  style="border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);"
></iframe>`;

  const widgetCode = `<!-- Scholaris Chat Widget -->
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${baseUrl}/widget';
    iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:100%;height:100%;border:none;z-index:2147483647;pointer-events:none;';
    iframe.allow = 'clipboard-write';
    document.body.appendChild(iframe);
    
    // Enable pointer events only on the widget
    window.addEventListener('message', function(e) {
      if (e.data === 'widget-hover') iframe.style.pointerEvents = 'auto';
      if (e.data === 'widget-leave') iframe.style.pointerEvents = 'none';
    });
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
          href={`${baseUrl}/embed`} 
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
          href={`${baseUrl}/embed`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layout className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Full Page Embed</p>
            <p className="text-xs text-muted-foreground">{baseUrl}/embed</p>
          </div>
          <ExternalLink className="w-4 h-4 ml-auto text-muted-foreground" />
        </a>
        <a 
          href={`${baseUrl}/widget`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/30 hover:bg-card/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">Widget Preview</p>
            <p className="text-xs text-muted-foreground">{baseUrl}/widget</p>
          </div>
          <ExternalLink className="w-4 h-4 ml-auto text-muted-foreground" />
        </a>
      </div>
    </div>
  );
};
