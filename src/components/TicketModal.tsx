import { useState, useEffect } from "react";
import { X, Send, CheckCircle, Phone, Mail, MessageSquare, Loader2 } from "lucide-react";
import { validateEmail } from "@/lib/emailValidation";
import { playSound } from "@/hooks/useSounds";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  role: string;
  content: string;
}

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticketNumber?: string) => void;
  sessionId: string;
  chatHistory?: ChatMessage[];
}

export const TicketModal = ({ isOpen, onClose, onSuccess, sessionId, chatHistory }: TicketModalProps) => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      playSound("notification", 0.15);
    }
  }, [isOpen]);

  const closeAndReset = (force = false) => {
    if (isSubmitting && !force) return;
    setEmail("");
    setPhone("");
    setProblem("");
    setError("");
    setSubmitted(false);
    setTicketNumber(null);
    onClose();
  };

  const handleSubmit = async () => {
    setError("");

    // Validate email (required)
    const emailValidation = validateEmail(email.trim().toLowerCase());
    if (!emailValidation.isValid) {
      setError((emailValidation as any).errorMessage || "Please enter a valid email address.");
      return;
    }

    // Validate problem description (required)
    if (!problem.trim() || problem.trim().length < 10) {
      setError("Please describe your issue in at least 10 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Call our own edge function instead of external API
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

  const handleClose = () => closeAndReset(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
      <div 
        className="w-full max-w-[360px] rounded-2xl overflow-hidden shadow-2xl border border-blue-400/20"
        style={{
          background: "linear-gradient(145deg, rgba(15, 30, 60, 0.98) 0%, rgba(10, 25, 50, 0.98) 100%)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Header - Blue/White Theme */}
        <div 
          className="px-5 py-4 flex items-center justify-between border-b border-blue-400/20"
          style={{
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.35) 100%)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <MessageSquare className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
            <span className="text-[15px] font-medium text-white">Create Support Ticket</span>
          </div>
          <button 
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 text-white/70" strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {submitted ? (
            <div className="text-center py-6 content-fade">
              <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                <CheckCircle className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-[16px] font-medium text-white mb-2">
                Ticket #{ticketNumber} created!
              </h3>
              <p className="text-[13px] text-blue-200/60 mb-5">
                Check your email for confirmation.
              </p>
              <button
                onClick={() => closeAndReset(true)}
                className="px-6 py-2.5 rounded-xl text-[13px] text-white font-medium transition-all hover:opacity-90 shadow-lg shadow-blue-500/30"
                style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-[12px] text-blue-200/50 mb-5">
                Fill in your details and we'll get back to you via email.
              </p>

              {/* Email Input (Required) */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-[10px] text-blue-200/50 uppercase tracking-wider mb-2">
                  <Mail className="w-3 h-3" />
                  Email Address <span className="text-blue-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-xl text-[13px] text-white bg-blue-950/50 border border-blue-400/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400/50 transition-all placeholder:text-blue-200/30"
                  disabled={isSubmitting}
                />
              </div>

              {/* Phone Input (Optional) */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-[10px] text-blue-200/50 uppercase tracking-wider mb-2">
                  <Phone className="w-3 h-3" />
                  Phone Number <span className="text-blue-200/30">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 rounded-xl text-[13px] text-white bg-blue-950/50 border border-blue-400/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400/50 transition-all placeholder:text-blue-200/30"
                  disabled={isSubmitting}
                />
              </div>

              {/* Problem Description (Required) */}
              <div className="mb-5">
                <label className="flex items-center gap-1.5 text-[10px] text-blue-200/50 uppercase tracking-wider mb-2">
                  <MessageSquare className="w-3 h-3" />
                  Describe Your Issue <span className="text-blue-400">*</span>
                </label>
                <textarea
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="Please describe the issue you're experiencing..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl text-[13px] text-white bg-blue-950/50 border border-blue-400/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400/50 transition-all placeholder:text-blue-200/30 resize-none"
                  disabled={isSubmitting}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-[12px] text-red-400">{error}</p>
                </div>
              )}

              {/* Submit Button - Blue Gradient */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "w-full py-3.5 rounded-xl text-[14px] text-white font-medium flex items-center justify-center gap-2 transition-all shadow-lg",
                  isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:opacity-90 hover:shadow-xl active:scale-[0.98]"
                )}
                style={{ 
                  background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  boxShadow: "0 4px 20px rgba(59, 130, 246, 0.35)"
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Ticket...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" strokeWidth={1.5} />
                    Submit Ticket
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
