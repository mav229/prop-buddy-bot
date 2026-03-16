import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WidgetConfig {
  // Header
  headerGradientStart: string;
  headerGradientMiddle: string;
  headerGradientEnd: string;
  headerGradientAngle: number;
  
  // Greeting
  greetingText: string;
  greetingEmoji: string;
  greetingSubtext: string;
  greetingTextColor: string;
  greetingSubtextColor: string;
  
  // Bot Identity
  botName: string;
  botSubtitle: string;
  
  // Logo
  logoUrl: string;
  launcherLogoUrl: string;
  launcherStyle: "nohalo" | "clean" | "new" | "transparent" | "original";
  showLogo: boolean;
  logoSize: number;
  logoBorderRadius: number;
  
  // Colors
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardBackgroundColor: string;
  textColor: string;
  mutedTextColor: string;
  
  // Tab Colors
  activeTabColor: string;
  inactiveTabColor: string;
  
  // Cards
  cardBorderRadius: number;
  cardShadow: string;
  showDiscordCard: boolean;
  discordLink: string;
  discordCardText: string;
  showMessageCard: boolean;
  messageCardText: string;
  messageCardGradientStart: string;
  messageCardGradientEnd: string;
  
  // Help Section
  showHelpSearch: boolean;
  helpSearchText: string;
  supportEmail: string;
  showSupportCard: boolean;
  supportCardGradientStart: string;
  supportCardGradientEnd: string;
  
  // Chat Messages Settings
  showTimestamps: boolean;
  chatMessageFontSize: number;
  
  // Suggested Questions
  suggestedQuestions: string[];
  
  // Footer
  footerText: string;
  showFooter: boolean;
  footerTextColor: string;
  
  // Dimensions
  widgetWidth: number;
  widgetHeight: number;
  
  // Animations
  enableAnimations: boolean;
  animationSpeed: "slow" | "normal" | "fast";
  
  // Online Indicator
  showOnlineIndicator: boolean;
  onlineIndicatorColor: string;
  
  // Notification Popup
  showNotificationPopup: boolean;
  notificationPopupDelay: number;
  notificationPopupText: string;
  
  // Chat Messages
  chatBackgroundColor: string;
  userMessageBgColor: string;
  userMessageTextColor: string;
  userMessageBorderRadius: number;
  aiMessageBgColor: string;
  aiMessageTextColor: string;
  aiMessageBorderRadius: number;
  chatInputBgColor: string;
  chatInputTextColor: string;
  chatInputBorderColor: string;
  sendButtonBgColor: string;
  sendButtonIconColor: string;
  
  // URL Blocklist
  blockedUrls: string[];
  
  // Embed Settings (unified)
  embedWidth: number;
  embedHeight: number;
  customDomain: string;
}

const defaultConfig: WidgetConfig = {
  headerGradientStart: "#6366f1",
  headerGradientMiddle: "#4f46e5",
  headerGradientEnd: "#7c3aed",
  headerGradientAngle: 180,
  greetingText: "Hello Trader!",
  greetingEmoji: "👋",
  greetingSubtext: "How can I help?",
  greetingTextColor: "#c7d2fe",
  greetingSubtextColor: "#ffffff",
  botName: "Scholaris AI",
  botSubtitle: "Online",
  logoUrl: "",
  launcherLogoUrl: "https://res.cloudinary.com/dzozyqlqr/image/upload/v1767166947/Untitled_design_5_pjs1rs.png",
  launcherStyle: "nohalo",
  showLogo: true,
  logoSize: 48,
  logoBorderRadius: 12,
  primaryColor: "#6366f1",
  accentColor: "#818cf8",
  backgroundColor: "rgba(15, 23, 42, 0.95)",
  cardBackgroundColor: "rgba(30, 41, 59, 0.9)",
  textColor: "#111827",
  mutedTextColor: "#6b7280",
  activeTabColor: "#3b82f6",
  inactiveTabColor: "#9ca3af",
  cardBorderRadius: 12,
  cardShadow: "0 1px 3px rgba(0,0,0,0.1)",
  showDiscordCard: true,
  discordLink: "https://discord.gg/propscholar",
  discordCardText: "Join Discord",
  showMessageCard: true,
  messageCardText: "Send us a message",
  messageCardGradientStart: "#667eea",
  messageCardGradientEnd: "#764ba2",
  showHelpSearch: true,
  helpSearchText: "Search for help",
  supportEmail: "support@propscholar.com",
  showSupportCard: true,
  supportCardGradientStart: "#3b82f6",
  supportCardGradientEnd: "#2563eb",
  showTimestamps: true,
  chatMessageFontSize: 14,
  suggestedQuestions: [
    "How PropScholar works?",
    "What are the drawdown rules?",
    "How do payouts work?",
    "Tell me about evaluations",
  ],
  footerText: "Powered by PropScholar",
  showFooter: true,
  footerTextColor: "#667eea",
  widgetWidth: 380,
  widgetHeight: 600,
  enableAnimations: true,
  animationSpeed: "normal",
  showOnlineIndicator: true,
  onlineIndicatorColor: "#22c55e",
  showNotificationPopup: true,
  notificationPopupDelay: 20,
  notificationPopupText: "Hi there! 👋 I can help you with any questions!",
  chatBackgroundColor: "#f9fafb",
  userMessageBgColor: "#6366f1",
  userMessageTextColor: "#ffffff",
  userMessageBorderRadius: 16,
  aiMessageBgColor: "#f3f4f6",
  aiMessageTextColor: "#374151",
  aiMessageBorderRadius: 16,
  chatInputBgColor: "#ffffff",
  chatInputTextColor: "#111827",
  chatInputBorderColor: "#e5e7eb",
  sendButtonBgColor: "#6366f1",
  sendButtonIconColor: "#ffffff",
  blockedUrls: [],
  embedWidth: 384,
  embedHeight: 600,
  customDomain: "",
};

interface WidgetConfigContextType {
  config: WidgetConfig;
  updateConfig: (updates: Partial<WidgetConfig>) => void;
  resetConfig: () => void;
  saveConfig: () => Promise<void>;
  isSaving: boolean;
}

const WidgetConfigContext = createContext<WidgetConfigContextType | undefined>(undefined);

const STORAGE_KEY = "widget-config";
const DB_ROW_ID = "default";

const sanitizeConfig = (cfg: WidgetConfig): WidgetConfig => {
  const blockedUrls = (cfg.blockedUrls || [])
    .map((u) => (u || "").toString().trim())
    .filter(Boolean);
  const customDomain = (cfg.customDomain || "").toString().trim();
  return { ...cfg, blockedUrls, customDomain };
};

export const WidgetConfigProvider = ({ children }: { children: ReactNode }) => {
  // ── SPEED FIX: Initialize from localStorage cache instantly ──
  const [config, setConfig] = useState<WidgetConfig>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        return sanitizeConfig({ ...defaultConfig, ...JSON.parse(cached) });
      }
    } catch {}
    return defaultConfig;
  });
  const [loaded, setLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  // Load from DB in background (update if different)
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("widget_config" as any)
          .select("config")
          .eq("id", DB_ROW_ID)
          .maybeSingle() as { data: { config: any } | null; error: any };

        if (!error && data && data.config && typeof data.config === "object") {
          const fresh = sanitizeConfig({ ...defaultConfig, ...(data.config as Partial<WidgetConfig>) } as WidgetConfig);
          setConfig(fresh);
          // Update localStorage cache
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch {}
        }
      } catch {}
      setLoaded(true);
    };
    load();
  }, []);

  const persistToBackend = async (cfg: WidgetConfig): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("widget_config" as any)
        .upsert({ id: DB_ROW_ID, config: cfg as any } as any, { onConflict: "id" });
      if (error) {
        console.warn("Failed to persist widget config:", error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn("Error persisting widget config:", e);
      return false;
    } finally {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
    }
  };

  const updateConfig = (updates: Partial<WidgetConfig>) => {
    setConfig((prev) => {
      const next = sanitizeConfig({ ...prev, ...updates } as WidgetConfig);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => { persistToBackend(next); }, 600);
      return next;
    });
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
    localStorage.removeItem(STORAGE_KEY);
    persistToBackend(defaultConfig);
  };

  const saveConfig = async (): Promise<void> => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setIsSaving(true);
    await persistToBackend(sanitizeConfig(config));
    setIsSaving(false);
  };

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e?.data || typeof e.data !== "object") return;
      const data = e.data as { type?: string; config?: Partial<WidgetConfig> };
      if (data.type === "scholaris:config" && data.config) {
        setConfig((prev) => ({ ...prev, ...data.config }));
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <WidgetConfigContext.Provider value={{ config, updateConfig, resetConfig, saveConfig, isSaving }}>
      {children}
    </WidgetConfigContext.Provider>
  );
};

export const useWidgetConfig = () => {
  const context = useContext(WidgetConfigContext);
  if (!context) {
    return {
      config: defaultConfig,
      updateConfig: () => {},
      resetConfig: () => {},
      saveConfig: async () => {},
      isSaving: false,
    };
  }
  return context;
};

export { defaultConfig };
