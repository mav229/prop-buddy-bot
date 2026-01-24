import { useState } from "react";
import { 
  Bot, LogOut, MessageSquare, Database, ArrowLeft, Brain, Users, 
  LayoutDashboard, Settings, Code, Palette, Ticket, Menu, X, Mail, Headphones, Zap, Shield 
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
import { AutobotSettings } from "./AutobotSettings";
import { PsModSettings } from "./PsModSettings";
import { Link } from "react-router-dom";

// Discord icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

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
  { value: "autobot", label: "Autobot", icon: Zap },
  { value: "ps-mod", label: "Schola", icon: Shield },
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

          <TabsContent value="autobot">
            <AutobotSettings />
          </TabsContent>

          <TabsContent value="ps-mod">
            <PsModSettings />
          </TabsContent>

          <TabsContent value="discord">
            <DiscordSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
