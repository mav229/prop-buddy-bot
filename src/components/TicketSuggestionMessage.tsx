import { Ticket } from "lucide-react";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";
import scholarisLogo from "@/assets/scholaris-logo.png";

interface TicketSuggestionMessageProps {
  onCreateTicket: () => void;
}

export const TicketSuggestionMessage = ({ onCreateTicket }: TicketSuggestionMessageProps) => {
  const { config } = useWidgetConfig();

  return (
    <div className="flex flex-col gap-1 message-in items-start">
      <div className="flex gap-2.5">
        {/* Avatar (assistant) */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden bg-transparent">
          <img src={scholarisLogo} alt="AI" className="w-full h-full object-cover rounded-full" />
        </div>

        {/* Bubble */}
        <div
          className="max-w-[80%] px-4 py-3 leading-relaxed"
          style={{
            backgroundColor: config.aiMessageBgColor,
            color: config.aiMessageTextColor,
            borderRadius: `${config.aiMessageBorderRadius}px`,
            fontSize: `${config.chatMessageFontSize}px`,
          }}
        >
          <div className="flex items-start gap-2">
            <Ticket className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: config.primaryColor }} />
            <div className="flex-1">
              <p className="text-thin whitespace-pre-line">
                Want us to handle this faster? Create a support ticket and we’ll follow up via email.
              </p>
              <button
                type="button"
                onClick={onCreateTicket}
                className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-opacity hover:opacity-90"
                style={{
                  background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.accentColor} 100%)`,
                  color: "white",
                }}
              >
                <Ticket className="w-4 h-4" />
                Create Support Ticket
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
