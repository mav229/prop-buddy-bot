import React, { useState, useEffect } from "react";
import { Gift, Copy, Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { playSound } from "@/hooks/useSounds";
import { validateEmail } from "@/lib/emailValidation";

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
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [noCoupon, setNoCoupon] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Play notification sound when popup appears
  useEffect(() => {
    if (isOpen) {
      playSound("notification", 0.1);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateEmail(email);
    if (!validation.isValid) {
      setError(validation.error || "Please enter a valid email");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Save email to widget_leads (use validated email)
      const { error: insertError } = await supabase
        .from("widget_leads")
        .insert({
          email: validation.email!,
          session_id: sessionId,
          source: "discount_popup",
          page_url: window.location.href,
        });

      if (insertError && insertError.code !== "23505") {
        throw insertError;
      }

      // Fetch active coupon from coupons table
      const now = new Date().toISOString();
      const { data: coupons } = await supabase
        .from("coupons")
        .select("code, discount_type, discount_value, description, benefits")
        .eq("is_active", true)
        .or(`valid_until.is.null,valid_until.gte.${now}`)
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
      setError("Something went wrong");
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
    <div 
      className={cn(
        "absolute top-0 left-0 right-0 z-50 p-3",
        "animate-in slide-in-from-top-4 duration-300 ease-out"
      )}
    >
      <div 
        className={cn(
          "w-full rounded-2xl overflow-hidden",
          "bg-white/40 backdrop-blur-3xl backdrop-saturate-150",
          "border border-white/20",
          "shadow-[0_8px_40px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.5)]"
        )}
      >
        {!submitted ? (
          /* Email Input State */
          <form onSubmit={handleSubmit} className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-black/5 backdrop-blur-sm border border-black/10 flex items-center justify-center flex-shrink-0">
                <Gift className="w-4 h-4 text-black/70" strokeWidth={1.5} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-light text-black/90 tracking-[-0.01em]">
                  Unlock a special discount
                </p>
                <p className="text-[11px] font-light text-black/50 mt-0.5 tracking-[-0.01em]">
                  Enter your email to get an exclusive code
                </p>
                
                <div className="mt-3 flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder="your@email.com"
                    className={cn(
                      "flex-1 min-w-0 px-3 py-2 rounded-xl text-[12px] font-light",
                      "bg-white/50 backdrop-blur-sm border border-black/10",
                      "placeholder:text-black/30 text-black/90",
                      "focus:outline-none focus:ring-1 focus:ring-black/20 focus:border-black/20",
                      "transition-all duration-200"
                    )}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[12px] font-light text-white",
                      "bg-black/90 hover:bg-black",
                      "backdrop-blur-sm",
                      "transition-all duration-200",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center gap-1.5"
                    )}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Unlock"
                    )}
                  </button>
                </div>
                
                {error && (
                  <p className="text-[10px] text-red-600/80 mt-1.5 font-light">{error}</p>
                )}
              </div>
              
              <button
                type="button"
                onClick={onClose}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5 text-black/40" strokeWidth={1.5} />
              </button>
            </div>
          </form>
        ) : coupon ? (
          /* Coupon Success State */
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-black/5 backdrop-blur-sm border border-black/10 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-black/70" strokeWidth={2} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-light text-black/90 tracking-[-0.01em]">
                  Your discount code
                </p>
                <p className="text-[11px] font-light text-black/50 mt-0.5 tracking-[-0.01em]">
                  {formatDiscount(coupon)} • {coupon.description || "Apply at checkout"}
                </p>
                
                <div className="mt-3 flex items-center gap-2">
                  <div 
                    className={cn(
                      "flex-1 px-3 py-2 rounded-xl",
                      "bg-white/50 backdrop-blur-sm border border-dashed border-black/20"
                    )}
                  >
                    <code className="text-[13px] font-medium tracking-wider text-black/90">
                      {coupon.code}
                    </code>
                  </div>
                  <button
                    onClick={handleCopy}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[12px] font-light",
                      "backdrop-blur-sm transition-all duration-200 flex items-center gap-1.5",
                      copied 
                        ? "bg-black/10 text-black/70"
                        : "bg-black/5 text-black/60 hover:bg-black/10"
                    )}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5 text-black/40" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ) : (
          /* No Coupon - Thanks State */
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-black/5 backdrop-blur-sm border border-black/10 flex items-center justify-center flex-shrink-0">
                <Gift className="w-4 h-4 text-black/70" strokeWidth={1.5} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-light text-black/90 tracking-[-0.01em]">
                  Thanks for subscribing
                </p>
                <p className="text-[11px] font-light text-black/50 mt-0.5 tracking-[-0.01em]">
                  We'll notify you of future deals
                </p>
              </div>
              
              <button
                onClick={onClose}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5 text-black/40" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
