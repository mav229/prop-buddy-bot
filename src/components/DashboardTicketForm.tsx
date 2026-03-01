import { useState } from "react";
import {
  Send,
  CheckCircle,
  Phone,
  Mail,
  User,
  FileText,
  Loader2,
  X,
  Sparkles,
  Shield,
} from "lucide-react";
import { validateEmail } from "@/lib/emailValidation";
import { playSound } from "@/hooks/useSounds";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  role: string;
  content: string;
}

interface DashboardTicketFormProps {
  onClose: () => void;
  onSuccess?: (ticketNumber?: string) => void;
  sessionId: string;
  chatHistory?: ChatMessage[];
}

export const DashboardTicketForm = ({
  onClose,
  onSuccess,
  sessionId,
  chatHistory,
}: DashboardTicketFormProps) => {
  const [name, setName] = useState("");
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
      setError(
        (emailValidation as any).errorMessage ||
          "Please enter a valid email address."
      );
      return;
    }

    if (!problem.trim() || problem.trim().length < 10) {
      setError("Please describe your issue in at least 10 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "create-ticket",
        {
          body: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || "",
            problem: problem.trim(),
            session_id: sessionId,
            chat_history: JSON.stringify(chatHistory || []),
          },
        }
      );

      if (fnError) {
        throw new Error(fnError.message || "Failed to create ticket");
      }

      playSound("notification", 0.15);
      const newTicketNumber =
        data?.ticket_id?.slice(0, 8).toUpperCase() || "TICKET";
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
      <div className="max-w-md mx-auto animate-fade-in">
        <div className="rounded-2xl border border-[hsl(0,0%,14%)] bg-[hsl(0,0%,6%)] overflow-hidden">
          {/* Success glow */}
          <div className="relative px-8 py-10 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-[hsl(142,60%,20%,0.08)] to-transparent pointer-events-none" />
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-[hsl(142,60%,15%)] border border-[hsl(142,60%,25%)] flex items-center justify-center mx-auto mb-5 shadow-[0_0_40px_hsl(142,60%,20%,0.3)]">
                <CheckCircle className="w-7 h-7 text-[hsl(142,76%,50%)]" />
              </div>
              <h3 className="text-lg font-semibold text-[hsl(0,0%,92%)] mb-1.5 tracking-tight">
                Ticket #{ticketNumber}
              </h3>
              <p className="text-sm text-[hsl(0,0%,45%)] mb-1 font-light">
                Created successfully
              </p>
              <p className="text-xs text-[hsl(0,0%,30%)] mb-6">
                Our team will reach out within 4 hours
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-sm text-[hsl(0,0%,8%)] font-medium bg-white hover:bg-white/90 transition-all active:scale-[0.97]"
              >
                Continue Chatting
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto animate-fade-in">
      <div className="rounded-2xl border border-[hsl(0,0%,14%)] bg-[hsl(0,0%,6%)] overflow-hidden shadow-[0_8px_60px_-12px_hsl(0,0%,0%,0.8)]">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-[hsl(0,0%,11%)]">
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(220,60%,15%,0.1)] via-transparent to-[hsl(280,60%,15%,0.05)] pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(0,0%,15%)] to-[hsl(0,0%,10%)] border border-[hsl(0,0%,18%)] flex items-center justify-center">
                <Shield className="w-5 h-5 text-[hsl(0,0%,60%)]" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[hsl(0,0%,92%)] tracking-tight">
                  Escalate to Support
                </h3>
                <p className="text-[11px] text-[hsl(0,0%,35%)] font-light">
                  We'll get back to you within 4 hours
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[hsl(0,0%,12%)] transition-colors"
            >
              <X className="w-4 h-4 text-[hsl(0,0%,35%)]" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Name */}
          <Field
            icon={<User className="w-3.5 h-3.5" />}
            label="Name"
            optional
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              disabled={isSubmitting}
              className="form-input-field"
            />
          </Field>

          {/* Email */}
          <Field
            icon={<Mail className="w-3.5 h-3.5" />}
            label="Email"
            required
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isSubmitting}
              className="form-input-field"
            />
          </Field>

          {/* Phone */}
          <Field
            icon={<Phone className="w-3.5 h-3.5" />}
            label="Phone"
            optional
          >
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 123-4567"
              disabled={isSubmitting}
              className="form-input-field"
            />
          </Field>

          {/* Issue */}
          <Field
            icon={<FileText className="w-3.5 h-3.5" />}
            label="Issue"
            required
          >
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={3}
              disabled={isSubmitting}
              className="form-input-field resize-none"
            />
          </Field>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-[hsl(0,50%,20%)] bg-[hsl(0,50%,8%)] px-4 py-3">
              <p className="text-xs text-[hsl(0,60%,60%)]">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all duration-200",
              "bg-white text-[hsl(0,0%,8%)] shadow-[0_0_20px_hsl(0,0%,100%,0.06)]",
              isSubmitting
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-white/90 hover:shadow-[0_0_30px_hsl(0,0%,100%,0.1)] active:scale-[0.98]"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating ticket...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 -rotate-45" />
                Submit Ticket
              </>
            )}
          </button>

          {/* Footer note */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <Sparkles className="w-3 h-3 text-[hsl(0,0%,22%)]" />
            <p className="text-[10px] text-[hsl(0,0%,22%)] font-light">
              Chat transcript will be attached automatically
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Reusable field wrapper ── */
const Field = ({
  icon,
  label,
  required,
  optional,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) => (
  <div>
    <label className="flex items-center gap-1.5 text-[11px] text-[hsl(0,0%,40%)] uppercase tracking-widest mb-2 font-medium">
      {icon}
      {label}
      {required && (
        <span className="text-[hsl(0,0%,55%)] text-[10px] normal-case tracking-normal">
          *
        </span>
      )}
      {optional && (
        <span className="text-[hsl(0,0%,25%)] text-[10px] normal-case tracking-normal">
          optional
        </span>
      )}
    </label>
    {children}
  </div>
);
