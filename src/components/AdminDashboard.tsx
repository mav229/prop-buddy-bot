import { useState } from "react";
import { 
  Bot, LogOut, MessageSquare, Database, Brain, Users, 
  LayoutDashboard, Settings, Code, Palette, Ticket, Menu, Mail, Headphones, Monitor, Coins, Zap, PlugZap, ShoppingCart, Send, LinkIcon, Puzzle, Crosshair, PackageCheck, Star, Shield, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { AdminContent } from "./AdminContent";

const navItems = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "knowledge", label: "Knowledge", icon: Database },
  { value: "training", label: "Training", icon: Brain },
  { value: "history", label: "History", icon: MessageSquare },
  { value: "discord-memory", label: "Users", icon: Users },
  { value: "leads", label: "Leads", icon: Mail },
  { value: "tickets", label: "Tickets", icon: Headphones },
  { value: "coupons", label: "Coupons", icon: Ticket },
  { value: "auto-replies", label: "Auto-Replies", icon: Zap },
  { value: "customizer", label: "Customize", icon: Palette },
  { value: "embed", label: "Embed", icon: Code },
  { value: "fullpage", label: "16:9", icon: Monitor },
  { value: "credits", label: "Credits", icon: Coins },
  { value: "abandoned", label: "Cart", icon: ShoppingCart },
  { value: "email-logs", label: "Email Logs", icon: Send },
  { value: "ref-links", label: "Ref Links", icon: LinkIcon },
  { value: "tones", label: "Tones", icon: Puzzle },
  { value: "manual-push", label: "Manual Push", icon: Crosshair },
  { value: "testimonials", label: "Testimonials", icon: Star },
  { value: "violations", label: "Scanner", icon: Shield },
  { value: "pela-peli", label: "Pela Peli", icon: AlertTriangle },
  { value: "orders", label: "Orders", icon: PackageCheck },
  { value: "extension", label: "Extension", icon: Puzzle },
  { value: "conn-logs", label: "Logs", icon: PlugZap },
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

  const NavList = () => (
    <div className="flex flex-col gap-0.5 px-3">
      {navItems.map((item) => {
        const isActive = activeTab === item.value;
        return (
          <button
            key={item.value}
            onClick={() => handleTabChange(item.value)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all duration-150 ${
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-primary" : ""}`} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen h-screen flex bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-border/40 bg-sidebar-background shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border/40">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">PropScholar</h1>
            <p className="text-[11px] text-muted-foreground">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-3">
          <NavList />
        </ScrollArea>

        {/* User + Sign Out */}
        <div className="border-t border-border/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground shrink-0">
              {user?.email?.charAt(0).toUpperCase() || "A"}
            </div>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start text-muted-foreground hover:text-foreground h-9 px-3 text-sm"
            size="sm"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (mobile header + desktop page title) */}
        <header className="flex items-center justify-between border-b border-border/40 bg-sidebar-background px-4 lg:px-8 h-14 shrink-0">
          {/* Mobile menu */}
          <div className="lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar-background border-border/40">
                <div className="flex items-center gap-3 px-5 py-5 border-b border-border/40">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-sm font-semibold text-foreground">PropScholar</h1>
                    <p className="text-[11px] text-muted-foreground">Admin Panel</p>
                  </div>
                </div>
                <ScrollArea className="flex-1 py-3 h-[calc(100vh-80px)]">
                  <NavList />
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>

          {/* Page title */}
          <div className="flex items-center gap-2">
            {(() => {
              const current = navItems.find(i => i.value === activeTab);
              if (!current) return null;
              return (
                <h2 className="text-lg font-semibold text-foreground">{current.label}</h2>
              );
            })()}
          </div>

          {/* Desktop user info */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground">
                {user?.email?.charAt(0).toUpperCase() || "A"}
              </div>
              <span className="text-sm text-muted-foreground">{user?.email}</span>
            </div>
          </div>

          {/* Mobile sign out */}
          <div className="lg:hidden">
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9 text-muted-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8 max-w-7xl">
            <AdminContent activeTab={activeTab} />
          </div>
        </main>
      </div>
    </div>
  );
};
