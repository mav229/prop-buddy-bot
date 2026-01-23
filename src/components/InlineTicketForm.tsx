import { useState } from "react";
import { Send, CheckCircle, Phone, Mail, MessageSquare, Loader2, X } from "lucide-react";
import { validateEmail } from "@/lib/emailValidation";
import { playSound } from "@/hooks/useSounds";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  role: string;
  content: string;
}

interface InlineTicketFormProps {
  onClose: () => void;
  onSuccess?: (ticketNumber?: string) => void;
  sessionId: string;
  chatHistory?: ChatMessage[];
}

export const InlineTicketForm = ({ onClose, onSuccess, sessionId, chatHistory }: InlineTicketFormProps) => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError("");

    const emailValidation = validateEmail(email.trim().toLowerCase());
    if (!emailValidation.isValid) {
      setError((emailValidation as any).errorMessage || "Please enter a valid email address.");
      return;
    }

    if (!problem.trim() || problem.trim().length < 10) {
      setError("Please describe your issue in at least 10 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-ticket", {
        body: {
          email: email.trim().toLowerCase(),
          phone: phone.trim() || "",
          problem: problem.trim(),
          session_id: sessionId,
          chat_history: JSON.stringify(chatHistory || []),
        },
      });

      if (fnError) {
        throw new Error(fnError.message || "Failed to create ticket");
      }

      playSound("notification", 0.15);
      const newTicketNumber = data?.ticket_id?.slice(0, 8).toUpperCase() || "TICKET";
      setTicketNumber(newTicketNumber);
      setSubmitted(true);
      onSuccess?.(newTicketNumber);
    } catch (err: any) {
      console.error("Support ticket error:", err);
      setError("Failed to submit ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl overflow-hidden border border-blue-400/30 bg-gradient-to-br from-blue-950/90 to-slate-900/90 backdrop-blur-xl p-4">
        <div className="text-center py-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-sm font-medium text-white mb-1">
            Ticket #{ticketNumber} created!
          </h3>
          <p className="text-xs text-blue-200/60 mb-3">
            Check your email for confirmation.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-white font-medium bg-gradient-to-r from-blue-500 to-blue-600 hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-blue-400/30 bg-gradient-to-br from-blue-950/90 to-slate-900/90 backdrop-blur-xl">
      {/* Compact Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-blue-400/20 bg-blue-500/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <MessageSquare className="w-3 h-3 text-white" strokeWidth={2} />
          </div>
          <span className="text-xs font-medium text-white">Create Support Ticket</span>
        </div>
        <button 
          onClick={onClose}
          disabled={isSubmitting}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-white/70" strokeWidth={2} />
        </button>
      </div>

      {/* Compact Form */}
      <div className="p-4 space-y-3">
        <p className="text-[11px] text-blue-200/50">
          Fill in your details and we'll get back to you.
        </p>

        {/* Email */}
        <div>
          <label className="flex items-center gap-1 text-[10px] text-blue-200/50 uppercase tracking-wider mb-1.5">
            <Mail className="w-2.5 h-2.5" />
            Email <span className="text-blue-400">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-3 py-2 rounded-lg text-xs text-white bg-blue-950/60 border border-blue-400/20 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-blue-200/30"
            disabled={isSubmitting}
          />
        </div>

        {/* Phone */}
        <div>
          <label className="flex items-center gap-1 text-[10px] text-blue-200/50 uppercase tracking-wider mb-1.5">
            <Phone className="w-2.5 h-2.5" />
            Phone <span className="text-blue-200/30">(optional)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 123-4567"
            className="w-full px-3 py-2 rounded-lg text-xs text-white bg-blue-950/60 border border-blue-400/20 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-blue-200/30"
            disabled={isSubmitting}
          />
        </div>

        {/* Problem */}
        <div>
          <label className="flex items-center gap-1 text-[10px] text-blue-200/50 uppercase tracking-wider mb-1.5">
            <MessageSquare className="w-2.5 h-2.5" />
            Issue <span className="text-blue-400">*</span>
          </label>
          <textarea
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="Describe your issue..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-xs text-white bg-blue-950/60 border border-blue-400/20 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-blue-200/30 resize-none"
            disabled={isSubmitting}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={cn(
            "w-full py-2.5 rounded-lg text-xs text-white font-medium flex items-center justify-center gap-1.5 transition-all bg-gradient-to-r from-blue-500 to-blue-600",
            isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:opacity-90 active:scale-[0.98]"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
              Submit Ticket
            </>
          )}
        </button>
      </div>
    </div>
  );
};
