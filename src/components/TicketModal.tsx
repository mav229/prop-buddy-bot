import { useState, useEffect } from "react";
import { X, Send, CheckCircle, Phone, Mail, MessageSquare, Loader2 } from "lucide-react";
import { validateEmail } from "@/lib/emailValidation";
import { playSound } from "@/hooks/useSounds";
import { cn } from "@/lib/utils";

// External support ticket API configuration
const SUPPORT_API_URL = "https://tisijoiblvcrigwhzprn.supabase.co/functions/v1/create-chatbot-ticket";
const SUPPORT_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpc2lqb2libHZjcmlnd2h6cHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MzI4ODQsImV4cCI6MjA4MTQwODg4NH0.7A7QN4wjF1QEoBjdqBqhSALCzcKYhdVzBCpaIkgG5p8";

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
      const response = await fetch(SUPPORT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPPORT_API_KEY
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          problem: problem.trim(),
          session_id: sessionId,
          chat_history: chatHistory || []
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create ticket");
      }

      playSound("notification", 0.15);
      const newTicketNumber = data.ticket_number;
      setTicketNumber(newTicketNumber || null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
      <div 
        className="w-full max-w-[340px] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        style={{
          background: "linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Header */}
        <div 
          className="px-5 py-4 flex items-center justify-between border-b border-white/10"
          style={{
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
            <span className="text-thin text-[15px] text-white">Create Support Ticket</span>
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
              <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-thin text-[16px] text-white mb-2">
                Ticket #{ticketNumber} created!
              </h3>
              <p className="text-ultra-thin text-[13px] text-white/60 mb-5">
                Check your email for confirmation.
              </p>
              <button
                onClick={() => closeAndReset(true)}
                className="px-6 py-2.5 rounded-xl text-[13px] text-white font-medium transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-ultra-thin text-[12px] text-white/50 mb-5">
                Fill in your details and we'll get back to you via email.
              </p>

              {/* Email Input (Required) */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-ultra-thin text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  <Mail className="w-3 h-3" />
                  Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-xl text-[13px] text-white bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400/50 transition-all placeholder:text-white/20"
                  disabled={isSubmitting}
                />
              </div>

              {/* Phone Input (Optional) */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-ultra-thin text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  <Phone className="w-3 h-3" />
                  Phone Number <span className="text-white/30">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 rounded-xl text-[13px] text-white bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400/50 transition-all placeholder:text-white/20"
                  disabled={isSubmitting}
                />
              </div>

              {/* Problem Description (Required) */}
              <div className="mb-5">
                <label className="flex items-center gap-1.5 text-ultra-thin text-[10px] text-white/40 uppercase tracking-wider mb-2">
                  <MessageSquare className="w-3 h-3" />
                  Describe Your Issue <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="Please describe the issue you're experiencing..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl text-[13px] text-white bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400/50 transition-all placeholder:text-white/20 resize-none"
                  disabled={isSubmitting}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-ultra-thin text-[12px] text-red-400">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "w-full py-3.5 rounded-xl text-[14px] text-white font-medium flex items-center justify-center gap-2 transition-all shadow-lg",
                  isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:opacity-90 hover:shadow-xl active:scale-[0.98]"
                )}
                style={{ 
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  boxShadow: "0 4px 20px rgba(99, 102, 241, 0.3)"
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
