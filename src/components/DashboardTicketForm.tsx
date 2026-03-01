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
} from "lucide-react";
import { validateEmail } from "@/lib/emailValidation";
import { playSound } from "@/hooks/useSounds";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import propscholarIcon from "@/assets/propscholar-icon.png";

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
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);

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
      // Insert directly into support_tickets — no external API
      const { data, error: dbError } = await supabase
        .from("support_tickets")
        .insert({
          email: email.trim().toLowerCase(),
          phone: phone.trim() || "",
          problem: problem.trim(),
          session_id: sessionId,
          chat_history: JSON.stringify(chatHistory || []),
          status: "open",
          source: "dashboard",
        })
        .select("ticket_number, id")
        .single();

      if (dbError) throw dbError;

      playSound("notification", 0.15);
      const num = data?.ticket_number || 0;
      setTicketNumber(num);
      setSubmitted(true);
      onSuccess?.(`${num}`);
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
        <div className="rounded-2xl border border-[hsl(0,0%,14%)] bg-[hsl(0,0%,5%)] overflow-hidden">
          <div className="relative px-8 py-10 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-[hsl(142,60%,20%,0.06)] to-transparent pointer-events-none" />
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-[hsl(142,60%,12%)] border border-[hsl(142,60%,22%)] flex items-center justify-center mx-auto mb-5 shadow-[0_0_50px_hsl(142,60%,20%,0.2)]">
                <CheckCircle className="w-7 h-7 text-[hsl(142,76%,46%)]" />
              </div>
              <h3 className="text-xl font-bold text-[hsl(0,0%,94%)] mb-1 tracking-tight font-mono">
                Ticket #{ticketNumber}
              </h3>
              <p className="text-sm text-[hsl(0,0%,45%)] mb-1 font-light">
                Created successfully
              </p>
              <p className="text-xs text-[hsl(0,0%,28%)] mb-7">
                Our team will reach out within 4 hours
              </p>
              <button
                onClick={onClose}
                className="px-7 py-2.5 rounded-xl text-sm text-[hsl(0,0%,5%)] font-semibold bg-white hover:bg-white/90 transition-all active:scale-[0.97]"
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
      <div className="rounded-2xl border border-[hsl(0,0%,13%)] bg-[hsl(0,0%,5%)] overflow-hidden shadow-[0_12px_80px_-16px_hsl(0,0%,0%,0.9)]">
        {/* Header with Scholaris logo */}
        <div className="relative px-6 py-5 border-b border-[hsl(0,0%,10%)]">
          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(0,0%,8%)] via-[hsl(0,0%,6%)] to-[hsl(0,0%,8%)] pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full overflow-hidden border border-[hsl(0,0%,16%)] bg-black shadow-[0_0_20px_hsl(0,0%,0%,0.5)]">
                <img src={propscholarIcon} alt="Scholaris" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[hsl(0,0%,93%)] tracking-tight">
                  Create Support Ticket
                </h3>
                <p className="text-[11px] text-[hsl(0,0%,32%)] font-light">
                  Fill in your details and we'll get back to you
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[hsl(0,0%,12%)] transition-colors"
            >
              <X className="w-4 h-4 text-[hsl(0,0%,32%)]" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Name */}
          <Field icon={<User className="w-3.5 h-3.5" />} label="Name" optional>
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
          <Field icon={<Mail className="w-3.5 h-3.5" />} label="Email" required>
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
          <Field icon={<Phone className="w-3.5 h-3.5" />} label="Phone" optional>
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
          <Field icon={<FileText className="w-3.5 h-3.5" />} label="Issue" required>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Describe your issue..."
              rows={3}
              disabled={isSubmitting}
              className="form-input-field resize-none"
            />
          </Field>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-[hsl(0,50%,18%)] bg-[hsl(0,50%,6%)] px-4 py-3">
              <p className="text-xs text-[hsl(0,60%,58%)]">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn(
              "w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200",
              "bg-white text-[hsl(0,0%,5%)] shadow-[0_2px_24px_hsl(0,0%,100%,0.06)]",
              isSubmitting
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-white/90 hover:shadow-[0_4px_32px_hsl(0,0%,100%,0.1)] active:scale-[0.98]"
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

          {/* Footer */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <Sparkles className="w-3 h-3 text-[hsl(0,0%,20%)]" />
            <p className="text-[10px] text-[hsl(0,0%,20%)] font-light">
              Chat transcript attached automatically
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
    <label className="flex items-center gap-1.5 text-[11px] text-[hsl(0,0%,38%)] uppercase tracking-widest mb-2 font-medium">
      {icon}
      {label}
      {required && (
        <span className="text-[hsl(0,0%,50%)] text-[10px] normal-case tracking-normal">*</span>
      )}
      {optional && (
        <span className="text-[hsl(0,0%,22%)] text-[10px] normal-case tracking-normal">optional</span>
      )}
    </label>
    {children}
  </div>
);
