import { Bot, LogOut, MessageSquare, Database, ArrowLeft, Brain, Users, LayoutDashboard, Settings, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { KnowledgeBaseManager } from "./KnowledgeBaseManager";
import { ChatHistoryView } from "./ChatHistoryView";
import { DiscordSettings } from "./DiscordSettings";
import { DiscordMemoryView } from "./DiscordMemoryView";
import { TrainingCenter } from "./TrainingCenter";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { EmbedCustomization } from "./EmbedCustomization";
import { Link } from "react-router-dom";

// Discord icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

export const AdminDashboard = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                <Bot className="w-5 h-5 text-background" />
              </div>
              <div>
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
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="dashboard" className="space-y-8">
          <TabsList className="bg-card/50 border border-border/50 p-1.5 rounded-xl backdrop-blur-sm">
            <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg">
              <Database className="w-4 h-4" />
              Knowledge
            </TabsTrigger>
            <TabsTrigger value="training" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg">
              <Brain className="w-4 h-4" />
              Training
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg">
              <MessageSquare className="w-4 h-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="discord-memory" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="embed" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg">
              <Code className="w-4 h-4" />
              Embed
            </TabsTrigger>
            <TabsTrigger value="discord" className="gap-2 data-[state=active]:bg-foreground data-[state=active]:text-background rounded-lg">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

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

          <TabsContent value="embed">
            <EmbedCustomization />
          </TabsContent>

          <TabsContent value="discord">
            <DiscordSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
