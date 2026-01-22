import { useState, useEffect } from "react";
import { X, Send, CheckCircle, Phone, Mail, MessageSquare, Loader2 } from "lucide-react";
import { validateEmail } from "@/lib/emailValidation";
import { playSound } from "@/hooks/useSounds";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sessionId: string;
  chatHistory?: string;
}

export const TicketModal = ({ isOpen, onClose, onSuccess, sessionId, chatHistory }: TicketModalProps) => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      playSound("notification", 0.15);
      // Pre-fill problem with chat context if available
      if (chatHistory && !problem) {
        setProblem(`Issue from chat:\n${chatHistory.slice(0, 500)}`);
      }
    }
  }, [isOpen, chatHistory]);

  const validatePhone = (phoneNumber: string): boolean => {
    // Basic phone validation - allows various formats
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
    return phoneRegex.test(phoneNumber.replace(/\s/g, ""));
  };

  const handleSubmit = async () => {
    setError("");

    // Validate email
    const emailValidation = validateEmail(email.trim().toLowerCase());
    if (!emailValidation.isValid) {
      setError((emailValidation as any).errorMessage || "Please enter a valid email address.");
      return;
    }

    // Validate phone
    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }
    if (!validatePhone(phone.trim())) {
      setError("Please enter a valid phone number.");
      return;
    }

    // Validate problem description
    if (!problem.trim() || problem.trim().length < 10) {
      setError("Please describe your issue in at least 10 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the edge function to create ticket
      const { data, error: fnError } = await supabase.functions.invoke("create-ticket", {
        body: {
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          problem: problem.trim(),
          session_id: sessionId,
          chat_history: chatHistory || null,
        },
      });

      if (fnError) {
        console.error("Ticket creation error:", fnError);
        throw new Error(fnError.message || "Failed to create ticket");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      playSound("notification", 0.15);
      setTicketId(data?.ticket_id || null);
      setSubmitted(true);
      onSuccess?.();
    } catch (err: any) {
      console.error("Ticket submission failed:", err);
      setError(err.message || "Failed to create ticket. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setEmail("");
      setPhone("");
      setProblem("");
      setError("");
      setSubmitted(false);
      setTicketId(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div 
        className="w-full max-w-[320px] rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
        }}
      >
        {/* Header */}
        <div 
          className="px-4 py-3 flex items-center justify-between"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-white" strokeWidth={1.5} />
            <span className="text-thin text-[14px] text-white">Create Support Ticket</span>
          </div>
          <button 
            onClick={handleClose}
            disabled={isSubmitting}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5 text-white/80" strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {submitted ? (
            <div className="text-center py-4 content-fade">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-thin text-[15px] text-gray-800 mb-1">Ticket Created!</h3>
              <p className="text-ultra-thin text-[12px] text-gray-500 mb-3">
                We've received your request and sent a confirmation to your email.
              </p>
              {ticketId && (
                <p className="text-ultra-thin text-[11px] text-gray-400 mb-4">
                  Reference: #{ticketId.slice(0, 8).toUpperCase()}
                </p>
              )}
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-[12px] text-white font-medium"
                style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-ultra-thin text-[12px] text-gray-500 mb-4">
                Fill in your details and we'll get back to you via email.
              </p>

              {/* Email Input */}
              <div className="mb-3">
                <label className="flex items-center gap-1.5 text-ultra-thin text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">
                  <Mail className="w-3 h-3" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] text-gray-700 bg-gray-50/80 border border-gray-200/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-gray-300"
                  disabled={isSubmitting}
                />
              </div>

              {/* Phone Input */}
              <div className="mb-3">
                <label className="flex items-center gap-1.5 text-ultra-thin text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">
                  <Phone className="w-3 h-3" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] text-gray-700 bg-gray-50/80 border border-gray-200/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-gray-300"
                  disabled={isSubmitting}
                />
              </div>

              {/* Problem Description */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-ultra-thin text-[11px] text-gray-400 uppercase tracking-wide mb-1.5">
                  <MessageSquare className="w-3 h-3" />
                  Describe Your Issue
                </label>
                <textarea
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  placeholder="Please describe the issue you're experiencing..."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] text-gray-700 bg-gray-50/80 border border-gray-200/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-gray-300 resize-none"
                  disabled={isSubmitting}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-ultra-thin text-[11px] text-red-600">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn(
                  "w-full py-3 rounded-xl text-[13px] text-white font-medium flex items-center justify-center gap-2 transition-all",
                  isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:opacity-90 active:scale-[0.98]"
                )}
                style={{ background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" }}
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
