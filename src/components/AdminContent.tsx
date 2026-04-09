import { Monitor } from "lucide-react";
import { KnowledgeBaseManager } from "./KnowledgeBaseManager";
import { DiscordOrders } from "./DiscordOrders";
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
import { CreditUsageCalendar } from "./CreditUsageCalendar";
import { AutoRepliesManager } from "./AutoRepliesManager";
import { ConnectionLogsView } from "./ConnectionLogsView";
import { AbandonedCheckouts } from "./AbandonedCheckouts";
import { EmailLogsView } from "./EmailLogsView";
import { ReferenceLinksManager } from "./ReferenceLinksManager";
import { ExtensionAnalytics } from "./ExtensionAnalytics";
import { TonePresetsManager } from "./TonePresetsManager";
import { ManualPush } from "./ManualPush";
import { TestimonialManager } from "./TestimonialManager";
import { ViolationScanner } from "./ViolationScanner";

interface AdminContentProps {
  activeTab: string;
}

export const AdminContent = ({ activeTab }: AdminContentProps) => {
  switch (activeTab) {
    case "dashboard":
      return <AnalyticsDashboard />;
    case "knowledge":
      return <KnowledgeBaseManager />;
    case "training":
      return <TrainingCenter />;
    case "history":
      return <ChatHistoryView />;
    case "discord-memory":
      return <DiscordMemoryView />;
    case "leads":
      return <LeadsManager />;
    case "tickets":
      return <TicketsManager />;
    case "coupons":
      return <CouponsManager />;
    case "auto-replies":
      return <AutoRepliesManager />;
    case "customizer":
      return <WidgetCustomizer />;
    case "embed":
      return <EmbedCustomization />;
    case "fullpage":
      return (
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
            <div className="rounded-xl overflow-hidden border border-border/30 bg-background" style={{ aspectRatio: "16/9" }}>
              <iframe src="/fullpage" className="w-full h-full border-0" title="16:9 Fullpage Chat Preview" />
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
      );
    case "credits":
      return <CreditUsageCalendar />;
    case "abandoned":
      return <AbandonedCheckouts />;
    case "email-logs":
      return <EmailLogsView />;
    case "ref-links":
      return <ReferenceLinksManager />;
    case "tones":
      return <TonePresetsManager />;
    case "manual-push":
      return <ManualPush />;
    case "testimonials":
      return <TestimonialManager />;
    case "violations":
      return <ViolationScanner />;
    case "orders":
      return <DiscordOrders />;
    case "extension":
      return <ExtensionAnalytics />;
    case "conn-logs":
      return <ConnectionLogsView />;
    case "discord":
      return <DiscordSettings />;
    default:
      return <AnalyticsDashboard />;
  }
};
