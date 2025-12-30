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
  
  // Suggested Questions
  suggestedQuestions: string[];
  
  // Footer
  footerText: string;
  showFooter: boolean;
  
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
}

const defaultConfig: WidgetConfig = {
  // Header - Vibrant blue flowing gradient
  headerGradientStart: "#6366f1",
  headerGradientMiddle: "#4f46e5",
  headerGradientEnd: "#7c3aed",
  headerGradientAngle: 180,
  
  // Greeting
  greetingText: "Hello Trader!",
  greetingEmoji: "👋",
  greetingSubtext: "How can I help?",
  greetingTextColor: "#c7d2fe",
  greetingSubtextColor: "#ffffff",
  
  // Bot Identity
  botName: "Scholaris AI",
  botSubtitle: "Online",
  
  // Logo
  logoUrl: "",
  launcherLogoUrl: "",
  showLogo: true,
  logoSize: 48,
  logoBorderRadius: 12,
  
  // Colors
  primaryColor: "#6366f1",
  accentColor: "#818cf8",
  backgroundColor: "#e0e7ff",
  cardBackgroundColor: "#ffffff",
  textColor: "#111827",
  mutedTextColor: "#6b7280",
  
  // Tab Colors
  activeTabColor: "#3b82f6",
  inactiveTabColor: "#9ca3af",
  
  // Cards
  cardBorderRadius: 12,
  cardShadow: "0 1px 3px rgba(0,0,0,0.1)",
  showDiscordCard: true,
  discordLink: "https://discord.gg/propscholar",
  discordCardText: "Join Discord",
  showMessageCard: true,
  messageCardText: "Send us a message",
  messageCardGradientStart: "#667eea",
  messageCardGradientEnd: "#764ba2",
  
  // Help Section
  showHelpSearch: true,
  helpSearchText: "Search for help",
  supportEmail: "support@propscholar.com",
  showSupportCard: true,
  supportCardGradientStart: "#3b82f6",
  supportCardGradientEnd: "#2563eb",
  
  // Suggested Questions
  suggestedQuestions: [
    "How PropScholar works?",
    "What are the drawdown rules?",
    "How do payouts work?",
    "Tell me about evaluations",
  ],
  
  // Footer
  footerText: "Powered by PropScholar",
  showFooter: true,
  
  // Dimensions
  widgetWidth: 380,
  widgetHeight: 600,
  
  // Animations
  enableAnimations: true,
  animationSpeed: "normal",
  
  // Online Indicator
  showOnlineIndicator: true,
  onlineIndicatorColor: "#22c55e",
  
  // Notification Popup
  showNotificationPopup: true,
  notificationPopupDelay: 20,
  notificationPopupText: "Hi there! 👋 I can help you with any questions!",
  
  // Chat Messages
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
};

interface WidgetConfigContextType {
  config: WidgetConfig;
  updateConfig: (updates: Partial<WidgetConfig>) => void;
  resetConfig: () => void;
  saveConfig: () => void;
}

const WidgetConfigContext = createContext<WidgetConfigContextType | undefined>(undefined);

const STORAGE_KEY = "widget-config";
const DB_ROW_ID = "default";

export const WidgetConfigProvider = ({ children }: { children: ReactNode }) => {
  const [config, setConfig] = useState<WidgetConfig>(defaultConfig);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  // Load config from backend on mount (public read, no auth required)
  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("widget_config" as any)
          .select("config")
          .eq("id", DB_ROW_ID)
          .maybeSingle() as { data: { config: any } | null; error: any };

        if (!error && data && data.config && typeof data.config === "object") {
          setConfig((prev) => ({ ...prev, ...(data.config as Partial<WidgetConfig>) }));
        } else {
          // Fallback to localStorage for backwards compat
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            setConfig((prev) => ({ ...prev, ...JSON.parse(stored) }));
          }
        }
      } catch {
        // Fallback to localStorage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            setConfig((prev) => ({ ...prev, ...JSON.parse(stored) }));
          }
        } catch {}
      }
      setLoaded(true);
    };
    load();
  }, []);

  // Persist to backend (debounced). Backend accepts only from admins; if it fails we still keep localStorage
  const persistToBackend = async (cfg: WidgetConfig) => {
    try {
      const { error } = await supabase
        .from("widget_config" as any)
        .upsert({ id: DB_ROW_ID, config: cfg as any } as any, { onConflict: "id" });
      if (error) {
        console.warn("Failed to persist widget config to backend:", error.message);
      }
    } catch (e) {
      console.warn("Error persisting widget config:", e);
    }
    // Always persist to localStorage as fallback
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {}
  };

  const updateConfig = (updates: Partial<WidgetConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      // Debounced persist
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        persistToBackend(next);
      }, 600);
      return next;
    });
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
    localStorage.removeItem(STORAGE_KEY);
    persistToBackend(defaultConfig);
  };

  const saveConfig = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    persistToBackend(config);
  };

  // Listen for config updates from parent window (for iframe widgets receiving real-time pushes)
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
    <WidgetConfigContext.Provider value={{ config, updateConfig, resetConfig, saveConfig }}>
      {children}
    </WidgetConfigContext.Provider>
  );
};

export const useWidgetConfig = () => {
  const context = useContext(WidgetConfigContext);
  if (!context) {
    // Return default config if not in provider
    return {
      config: defaultConfig,
      updateConfig: () => {},
      resetConfig: () => {},
      saveConfig: () => {},
    };
  }
  return context;
};

export { defaultConfig };
