import { useState } from "react";
import { 
  Bot, LogOut, MessageSquare, Database, ArrowLeft, Brain, Users, 
  LayoutDashboard, Settings, Code, Palette, Ticket, Menu, Mail, Headphones, Monitor
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { KnowledgeBaseManager } from "./KnowledgeBaseManager";
import { ChatHistoryView } from "./ChatHistoryView";
import { DiscordSettings } from "./DiscordSettings";
import { DiscordMemoryView } from "./DiscordMemoryView";
import { TrainingCenter } from "./TrainingCenter";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { EmbedCustomization } from "./EmbedCustomization";
import { WidgetCustomizer } from "./WidgetCustomizer";
import { CouponsManager } from "./CouponsManager";
import { LeadsManager } from "./LeadsManager";
import { TicketsManager } from "./TicketsManager";
import { FullpageUsageLogs } from "./FullpageUsageLogs";
import { Link } from "react-router-dom";

const navItems = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "knowledge", label: "Knowledge", icon: Database },
  { value: "training", label: "Training", icon: Brain },
  { value: "history", label: "History", icon: MessageSquare },
  { value: "discord-memory", label: "Users", icon: Users },
  { value: "leads", label: "Leads", icon: Mail },
  { value: "tickets", label: "Tickets", icon: Headphones },
  { value: "coupons", label: "Coupons", icon: Ticket },
  { value: "customizer", label: "Customize", icon: Palette },
  { value: "embed", label: "Embed", icon: Code },
  { value: "fullpage", label: "16:9", icon: Monitor },
  { value: "discord", label: "Settings", icon: Settings },
];

export const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setMobileMenuOpen(false);
  };

  const MobileNav = () => (
    <div className="flex flex-col gap-1 p-2">
      {navItems.map((item) => (
        <button
          key={item.value}
          onClick={() => handleTabChange(item.value)}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
            activeTab === item.value
              ? "bg-foreground text-background"
              : "hover:bg-card/50 text-foreground"
          }`}
        >
          <item.icon className="w-5 h-5" />
          <span className="font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl px-4 sm:px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Mobile menu button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="flex items-center gap-3 p-4 border-b border-border/50">
                  <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                    <Bot className="w-5 h-5 text-background" />
                  </div>
                  <div>
                    <h1 className="font-display text-lg font-bold">Command Center</h1>
                    <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <MobileNav />
              </SheetContent>
            </Sheet>

            <Link
              to="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-foreground flex items-center justify-center">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-background" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-display text-xl font-bold tracking-tight">
                  Command Center
                </h1>
                <p className="text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          <Button 
            variant="ghost" 
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground"
            size="sm"
          >
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 sm:space-y-8">
          {/* Desktop Tab Navigation */}
          <TabsList className="hidden lg:flex bg-card/50 border border-border/50 p-1.5 rounded-xl backdrop-blur-sm flex-wrap gap-1">
            {navItems.map((item) => (
              <TabsTrigger 
                key={item.value}
                value={item.value} 
                className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Mobile current tab indicator */}
          <div className="lg:hidden flex items-center justify-between bg-card/50 border border-border/50 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              {(() => {
                const current = navItems.find(i => i.value === activeTab);
                if (!current) return null;
                return (
                  <>
                    <current.icon className="w-5 h-5 text-primary" />
                    <span className="font-medium">{current.label}</span>
                  </>
                );
              })()}
            </div>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  Change
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
                <div className="py-2">
                  <h3 className="font-semibold text-center mb-4">Navigation</h3>
                  <MobileNav />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <TabsContent value="dashboard">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="knowledge">
            <KnowledgeBaseManager />
          </TabsContent>

          <TabsContent value="training">
            <TrainingCenter />
          </TabsContent>

          <TabsContent value="history">
            <ChatHistoryView />
          </TabsContent>

          <TabsContent value="discord-memory">
            <DiscordMemoryView />
          </TabsContent>

          <TabsContent value="leads">
            <LeadsManager />
          </TabsContent>

          <TabsContent value="tickets">
            <TicketsManager />
          </TabsContent>

          <TabsContent value="coupons">
            <CouponsManager />
          </TabsContent>

          <TabsContent value="customizer">
            <WidgetCustomizer />
          </TabsContent>

          <TabsContent value="embed">
            <EmbedCustomization />
          </TabsContent>

          <TabsContent value="fullpage">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">16:9 Full-Page Chat</h2>
                <p className="text-muted-foreground">A premium full-screen chat experience for scholaris.space</p>
              </div>
              
              <div className="border border-border/50 rounded-xl p-6 bg-card/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Preview</h3>
                  <a href="/fullpage" target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
                    Open Full Screen <Monitor className="w-3.5 h-3.5" />
                  </a>
                </div>
                
                <div className="rounded-xl overflow-hidden border border-border/30 bg-black" style={{ aspectRatio: "16/9" }}>
                  <iframe
                    src="/fullpage"
                    className="w-full h-full border-0"
                    title="16:9 Fullpage Chat Preview"
                  />
                </div>
                
                <div className="pt-4 border-t border-border/30">
                  <h4 className="text-sm font-medium mb-2">Embed Code</h4>
                  <p className="text-xs text-muted-foreground mb-3">Use this to embed the full-page chat on any website.</p>
                  <div className="bg-background border border-border rounded-lg p-3">
                    <code className="text-xs text-muted-foreground break-all">
                      {`<iframe src="https://scholaris.space/fullpage" style="width:100%;height:100vh;border:none;" allow="clipboard-write"></iframe>`}
                    </code>
                  </div>
                </div>
              </div>

              <FullpageUsageLogs />
            </div>
          </TabsContent>

          <TabsContent value="discord">
            <DiscordSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
