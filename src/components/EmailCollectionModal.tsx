import { useState } from "react";
import { X, Gift, Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWidgetConfig } from "@/contexts/WidgetConfigContext";
import { cn } from "@/lib/utils";

interface EmailCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sessionId: string;
}

interface Coupon {
  code: string;
  discount_type: string;
  discount_value: number;
  description: string | null;
  benefits: string | null;
}

export const EmailCollectionModal = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  sessionId 
}: EmailCollectionModalProps) => {
  const { config } = useWidgetConfig();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [noCoupon, setNoCoupon] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Save email to widget_leads
      const { error: insertError } = await supabase
        .from("widget_leads")
        .insert({
          email: email.trim().toLowerCase(),
          session_id: sessionId,
          source: "discount_popup",
          page_url: window.location.href,
        });

      if (insertError) {
        // Check if it's a duplicate email error
        if (insertError.code === "23505") {
          // Email already exists, still show them a coupon
        } else {
          throw insertError;
        }
      }

      // Fetch active coupon
      const now = new Date().toISOString();
      const { data: coupons } = await supabase
        .from("coupons")
        .select("code, discount_type, discount_value, description, benefits")
        .eq("is_active", true)
        .or(`valid_until.is.null,valid_until.gt.${now}`)
        .limit(1);

      if (coupons && coupons.length > 0) {
        setCoupon(coupons[0]);
      } else {
        setNoCoupon(true);
      }

      setSubmitted(true);
      onSuccess();
    } catch (err) {
      console.error("Email collection error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (coupon) {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discount_type === "percentage") {
      return `${coupon.discount_value}% off`;
    }
    return `$${coupon.discount_value} off`;
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-[320px] rounded-2xl overflow-hidden shadow-2xl animate-scale-in"
        style={{ 
          background: config.cardBackgroundColor,
        }}
      >
        {/* Header */}
        <div 
          className="relative px-5 py-6 text-center"
          style={{
            background: `linear-gradient(135deg, ${config.messageCardGradientStart} 0%, ${config.messageCardGradientEnd} 100%)`,
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <Gift className="w-7 h-7 text-white" />
          </div>
          
          {!submitted ? (
            <>
              <h3 className="text-lg font-semibold text-white mb-1">
                Unlock a Special Discount
              </h3>
              <p className="text-sm text-white/80">
                Enter your email to get an exclusive coupon code
              </p>
            </>
          ) : coupon ? (
            <>
              <h3 className="text-lg font-semibold text-white mb-1">
                🎉 Here's Your Discount!
              </h3>
              <p className="text-sm text-white/80">
                {formatDiscount(coupon)}
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-white mb-1">
                Thanks for Subscribing!
              </h3>
              <p className="text-sm text-white/80">
                We'll notify you of future deals
              </p>
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter your email"
                  className={cn(
                    "w-full px-4 py-3 rounded-xl text-sm transition-all outline-none",
                    "bg-white/80 border border-gray-200",
                    "focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
                    "placeholder:text-gray-400"
                  )}
                  style={{ color: config.textColor }}
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-red-500 mt-1.5 px-1">{error}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "w-full py-3 rounded-xl text-white font-medium text-sm",
                  "transition-all transform active:scale-[0.98]",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  "flex items-center justify-center gap-2"
                )}
                style={{
                  background: `linear-gradient(135deg, ${config.messageCardGradientStart} 0%, ${config.messageCardGradientEnd} 100%)`,
                }}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Get My Discount Code"
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                Maybe later
              </button>
            </form>
          ) : coupon ? (
            <div className="space-y-4">
              {/* Coupon Code Display */}
              <div 
                className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-dashed"
                style={{ borderColor: config.messageCardGradientStart }}
              >
                <code className="text-lg font-bold tracking-wider" style={{ color: config.messageCardGradientStart }}>
                  {coupon.code}
                </code>
                <button
                  onClick={handleCopy}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    copied 
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              {coupon.description && (
                <p className="text-xs text-center text-gray-500">
                  {coupon.description}
                </p>
              )}

              <button
                onClick={onClose}
                className={cn(
                  "w-full py-3 rounded-xl text-white font-medium text-sm",
                  "transition-all"
                )}
                style={{
                  background: `linear-gradient(135deg, ${config.messageCardGradientStart} 0%, ${config.messageCardGradientEnd} 100%)`,
                }}
              >
                Continue Chatting
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-600">
                No discount codes available right now, but join our Discord for exclusive deals and updates!
              </p>

              <a
                href={config.discordLink}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "w-full py-3 rounded-xl text-white font-medium text-sm",
                  "transition-all flex items-center justify-center gap-2"
                )}
                style={{
                  background: "#5865F2",
                  display: "flex",
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Join PropScholar Discord
              </a>

              <button
                onClick={onClose}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                Continue Chatting
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};