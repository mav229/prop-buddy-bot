import { useState, forwardRef } from "react";
import { 
  Palette, Type, Layout, Image, Sparkles, MessageSquare, 
  RotateCcw, Save, Eye, Plus, Trash2, GripVertical,
  ChevronDown, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";
import { EmbeddableChat } from "./EmbeddableChat";
import { toast } from "sonner";

const ColorPicker = ({ 
  label, 
  value, 
  onChange 
}: { 
  label: string; 
  value: string; 
  onChange: (value: string) => void;
}) => (
  <div className="space-y-2">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="flex items-center gap-2">
      <div 
        className="w-10 h-10 rounded-lg border border-border/50 cursor-pointer overflow-hidden"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-background/50 font-mono text-xs h-10"
        placeholder="#000000"
      />
    </div>
  </div>
);

interface SectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Section = ({ title, icon: Icon, children, defaultOpen = true }: SectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-3 rounded-lg bg-card/30 hover:bg-card/50 transition-colors">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">{title}</span>
          </div>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const WidgetCustomizer = () => {
  const { config, updateConfig, resetConfig, saveConfig } = useWidgetConfig();
  const [newQuestion, setNewQuestion] = useState("");

  const addQuestion = () => {
    if (newQuestion.trim()) {
      updateConfig({
        suggestedQuestions: [...config.suggestedQuestions, newQuestion.trim()]
      });
      setNewQuestion("");
      toast.success("Question added");
    }
  };

  const removeQuestion = (index: number) => {
    updateConfig({
      suggestedQuestions: config.suggestedQuestions.filter((_, i) => i !== index)
    });
    toast.success("Question removed");
  };

  const handleReset = () => {
    resetConfig();
    toast.success("Settings reset to defaults");
  };

  const handleSave = () => {
    saveConfig();
    toast.success("Settings saved!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold tracking-tight">Widget Customizer</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Full control over your widget appearance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-2">
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr,400px] gap-6">
        {/* Settings Panel */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <Tabs defaultValue="colors" className="space-y-4">
              <TabsList className="w-full bg-background/50 p-1 grid grid-cols-5">
                <TabsTrigger value="colors" className="text-xs gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  Colors
                </TabsTrigger>
                <TabsTrigger value="content" className="text-xs gap-1.5">
                  <Type className="w-3.5 h-3.5" />
                  Content
                </TabsTrigger>
                <TabsTrigger value="cards" className="text-xs gap-1.5">
                  <Layout className="w-3.5 h-3.5" />
                  Cards
                </TabsTrigger>
                <TabsTrigger value="logo" className="text-xs gap-1.5">
                  <Image className="w-3.5 h-3.5" />
                  Logo
                </TabsTrigger>
                <TabsTrigger value="advanced" className="text-xs gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Advanced
                </TabsTrigger>
              </TabsList>

              {/* Colors Tab */}
              <TabsContent value="colors" className="space-y-4 mt-4">
                <Section title="Header Gradient" icon={Palette}>
                  <div className="grid grid-cols-3 gap-3">
                    <ColorPicker
                      label="Start Color"
                      value={config.headerGradientStart}
                      onChange={(v) => updateConfig({ headerGradientStart: v })}
                    />
                    <ColorPicker
                      label="Middle Color"
                      value={config.headerGradientMiddle}
                      onChange={(v) => updateConfig({ headerGradientMiddle: v })}
                    />
                    <ColorPicker
                      label="End Color"
                      value={config.headerGradientEnd}
                      onChange={(v) => updateConfig({ headerGradientEnd: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Gradient Angle: {config.headerGradientAngle}°</Label>
                    <Slider
                      value={[config.headerGradientAngle]}
                      onValueChange={([v]) => updateConfig({ headerGradientAngle: v })}
                      min={0}
                      max={360}
                      step={5}
                      className="w-full"
                    />
                  </div>
                  {/* Preview */}
                  <div 
                    className="h-16 rounded-lg border border-border/30"
                    style={{
                      background: `linear-gradient(${config.headerGradientAngle}deg, ${config.headerGradientStart} 0%, ${config.headerGradientMiddle} 50%, ${config.headerGradientEnd} 100%)`
                    }}
                  />
                </Section>

                <Section title="Primary Colors" icon={Palette} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorPicker
                      label="Primary"
                      value={config.primaryColor}
                      onChange={(v) => updateConfig({ primaryColor: v })}
                    />
                    <ColorPicker
                      label="Accent"
                      value={config.accentColor}
                      onChange={(v) => updateConfig({ accentColor: v })}
                    />
                  </div>
                </Section>

                <Section title="Background Colors" icon={Palette} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorPicker
                      label="Background"
                      value={config.backgroundColor}
                      onChange={(v) => updateConfig({ backgroundColor: v })}
                    />
                    <ColorPicker
                      label="Card Background"
                      value={config.cardBackgroundColor}
                      onChange={(v) => updateConfig({ cardBackgroundColor: v })}
                    />
                  </div>
                </Section>

                <Section title="Text Colors" icon={Type} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorPicker
                      label="Text Color"
                      value={config.textColor}
                      onChange={(v) => updateConfig({ textColor: v })}
                    />
                    <ColorPicker
                      label="Muted Text"
                      value={config.mutedTextColor}
                      onChange={(v) => updateConfig({ mutedTextColor: v })}
                    />
                    <ColorPicker
                      label="Greeting Text"
                      value={config.greetingTextColor}
                      onChange={(v) => updateConfig({ greetingTextColor: v })}
                    />
                    <ColorPicker
                      label="Greeting Subtext"
                      value={config.greetingSubtextColor}
                      onChange={(v) => updateConfig({ greetingSubtextColor: v })}
                    />
                  </div>
                </Section>

                <Section title="Tab Colors" icon={Layout} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorPicker
                      label="Active Tab"
                      value={config.activeTabColor}
                      onChange={(v) => updateConfig({ activeTabColor: v })}
                    />
                    <ColorPicker
                      label="Inactive Tab"
                      value={config.inactiveTabColor}
                      onChange={(v) => updateConfig({ inactiveTabColor: v })}
                    />
                  </div>
                </Section>

                <Section title="Support Card Gradient" icon={Palette} defaultOpen={false}>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorPicker
                      label="Start"
                      value={config.supportCardGradientStart}
                      onChange={(v) => updateConfig({ supportCardGradientStart: v })}
                    />
                    <ColorPicker
                      label="End"
                      value={config.supportCardGradientEnd}
                      onChange={(v) => updateConfig({ supportCardGradientEnd: v })}
                    />
                  </div>
                </Section>

                <Section title="Online Indicator" icon={Sparkles} defaultOpen={false}>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Show Online Indicator</Label>
                    <Switch
                      checked={config.showOnlineIndicator}
                      onCheckedChange={(v) => updateConfig({ showOnlineIndicator: v })}
                    />
                  </div>
                  <ColorPicker
                    label="Indicator Color"
                    value={config.onlineIndicatorColor}
                    onChange={(v) => updateConfig({ onlineIndicatorColor: v })}
                  />
                </Section>
              </TabsContent>

              {/* Content Tab */}
              <TabsContent value="content" className="space-y-4 mt-4">
                <Section title="Bot Identity" icon={MessageSquare}>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Bot Name</Label>
                      <Input
                        value={config.botName}
                        onChange={(e) => updateConfig({ botName: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Bot Subtitle</Label>
                      <Input
                        value={config.botSubtitle}
                        onChange={(e) => updateConfig({ botSubtitle: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>
                  </div>
                </Section>

                <Section title="Greeting" icon={Type}>
                  <div className="space-y-3">
                    <div className="grid grid-cols-[1fr,80px] gap-2">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Greeting Text</Label>
                        <Input
                          value={config.greetingText}
                          onChange={(e) => updateConfig({ greetingText: e.target.value })}
                          className="bg-background/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Emoji</Label>
                        <Input
                          value={config.greetingEmoji}
                          onChange={(e) => updateConfig({ greetingEmoji: e.target.value })}
                          className="bg-background/50 text-center"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Subtext</Label>
                      <Input
                        value={config.greetingSubtext}
                        onChange={(e) => updateConfig({ greetingSubtext: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>
                  </div>
                </Section>

                <Section title="Suggested Questions" icon={MessageSquare}>
                  <div className="space-y-3">
                    {config.suggestedQuestions.map((q, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                        <Input
                          value={q}
                          onChange={(e) => {
                            const updated = [...config.suggestedQuestions];
                            updated[i] = e.target.value;
                            updateConfig({ suggestedQuestions: updated });
                          }}
                          className="flex-1 bg-background/50 text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeQuestion(i)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <Input
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="Add new question..."
                        className="flex-1 bg-background/50 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && addQuestion()}
                      />
                      <Button size="sm" onClick={addQuestion} className="gap-1">
                        <Plus className="w-4 h-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                </Section>

                <Section title="Footer" icon={Type} defaultOpen={false}>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm">Show Footer</Label>
                    <Switch
                      checked={config.showFooter}
                      onCheckedChange={(v) => updateConfig({ showFooter: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Footer Text</Label>
                    <Input
                      value={config.footerText}
                      onChange={(e) => updateConfig({ footerText: e.target.value })}
                      className="bg-background/50"
                    />
                  </div>
                </Section>
              </TabsContent>

              {/* Cards Tab */}
              <TabsContent value="cards" className="space-y-4 mt-4">
                <Section title="Discord Card" icon={Layout}>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm">Show Discord Card</Label>
                    <Switch
                      checked={config.showDiscordCard}
                      onCheckedChange={(v) => updateConfig({ showDiscordCard: v })}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Button Text</Label>
                      <Input
                        value={config.discordCardText}
                        onChange={(e) => updateConfig({ discordCardText: e.target.value })}
                        className="bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Discord Link</Label>
                      <Input
                        value={config.discordLink}
                        onChange={(e) => updateConfig({ discordLink: e.target.value })}
                        className="bg-background/50"
                        placeholder="https://discord.gg/..."
                      />
                    </div>
                  </div>
                </Section>

                <Section title="Message Card" icon={MessageSquare}>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm">Show Message Card</Label>
                    <Switch
                      checked={config.showMessageCard}
                      onCheckedChange={(v) => updateConfig({ showMessageCard: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Button Text</Label>
                    <Input
                      value={config.messageCardText}
                      onChange={(e) => updateConfig({ messageCardText: e.target.value })}
                      className="bg-background/50"
                    />
                  </div>
                </Section>

                <Section title="Support Card" icon={Layout}>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm">Show Support Card</Label>
                    <Switch
                      checked={config.showSupportCard}
                      onCheckedChange={(v) => updateConfig({ showSupportCard: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Support Email</Label>
                    <Input
                      value={config.supportEmail}
                      onChange={(e) => updateConfig({ supportEmail: e.target.value })}
                      className="bg-background/50"
                      placeholder="support@example.com"
                    />
                  </div>
                </Section>

                <Section title="Help Search" icon={Layout} defaultOpen={false}>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm">Show Help Search</Label>
                    <Switch
                      checked={config.showHelpSearch}
                      onCheckedChange={(v) => updateConfig({ showHelpSearch: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Search Label</Label>
                    <Input
                      value={config.helpSearchText}
                      onChange={(e) => updateConfig({ helpSearchText: e.target.value })}
                      className="bg-background/50"
                    />
                  </div>
                </Section>

                <Section title="Card Styling" icon={Layout} defaultOpen={false}>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Border Radius: {config.cardBorderRadius}px</Label>
                      <Slider
                        value={[config.cardBorderRadius]}
                        onValueChange={([v]) => updateConfig({ cardBorderRadius: v })}
                        min={0}
                        max={24}
                        step={2}
                      />
                    </div>
                  </div>
                </Section>
              </TabsContent>

              {/* Logo Tab */}
              <TabsContent value="logo" className="space-y-4 mt-4">
                <Section title="Logo Settings" icon={Image}>
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm">Show Logo</Label>
                    <Switch
                      checked={config.showLogo}
                      onCheckedChange={(v) => updateConfig({ showLogo: v })}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Header Logo URL</Label>
                      <Input
                        value={config.logoUrl}
                        onChange={(e) => updateConfig({ logoUrl: e.target.value })}
                        className="bg-background/50"
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Launcher Logo URL</Label>
                      <Input
                        value={config.launcherLogoUrl}
                        onChange={(e) => updateConfig({ launcherLogoUrl: e.target.value })}
                        className="bg-background/50"
                        placeholder="https://example.com/launcher-logo.png"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Logo Size: {config.logoSize}px</Label>
                      <Slider
                        value={[config.logoSize]}
                        onValueChange={([v]) => updateConfig({ logoSize: v })}
                        min={32}
                        max={80}
                        step={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Border Radius: {config.logoBorderRadius}px</Label>
                      <Slider
                        value={[config.logoBorderRadius]}
                        onValueChange={([v]) => updateConfig({ logoBorderRadius: v })}
                        min={0}
                        max={40}
                        step={2}
                      />
                    </div>
                  </div>
                </Section>
              </TabsContent>

              {/* Advanced Tab */}
              <TabsContent value="advanced" className="space-y-4 mt-4">
                <Section title="Dimensions" icon={Layout}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Width: {config.widgetWidth}px</Label>
                      <Slider
                        value={[config.widgetWidth]}
                        onValueChange={([v]) => updateConfig({ widgetWidth: v })}
                        min={320}
                        max={480}
                        step={10}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Height: {config.widgetHeight}px</Label>
                      <Slider
                        value={[config.widgetHeight]}
                        onValueChange={([v]) => updateConfig({ widgetHeight: v })}
                        min={400}
                        max={800}
                        step={20}
                      />
                    </div>
                  </div>
                </Section>

                <Section title="Animations" icon={Sparkles}>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Enable Animations</Label>
                    <Switch
                      checked={config.enableAnimations}
                      onCheckedChange={(v) => updateConfig({ enableAnimations: v })}
                    />
                  </div>
                </Section>

                <Section title="Notification Popup" icon={MessageSquare}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Show Notification Popup</Label>
                      <Switch
                        checked={config.showNotificationPopup}
                        onCheckedChange={(v) => updateConfig({ showNotificationPopup: v })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Delay: {config.notificationPopupDelay} seconds</Label>
                      <Slider
                        value={[config.notificationPopupDelay]}
                        onValueChange={([v]) => updateConfig({ notificationPopupDelay: v })}
                        min={5}
                        max={60}
                        step={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Popup Message</Label>
                      <Input
                        value={config.notificationPopupText}
                        onChange={(e) => updateConfig({ notificationPopupText: e.target.value })}
                        className="bg-background/50"
                        placeholder="Hi there! 👋 I can help you..."
                      />
                    </div>
                  </div>
                </Section>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm sticky top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Live Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div 
              className="relative rounded-xl overflow-hidden shadow-2xl bg-gray-100"
              style={{ 
                width: `${Math.min(config.widgetWidth, 380)}px`, 
                height: `${Math.min(config.widgetHeight, 550)}px`,
                margin: "0 auto"
              }}
            >
              <EmbeddableChat isWidget={true} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
