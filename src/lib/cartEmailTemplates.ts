const BANNER_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/cart-banner.png";

export interface CartEmailTemplate {
  id: string;
  name: string;
  subject: (firstName: string) => string;
  buildHtml: (firstName: string, cartItems: number) => string;
}

const glassCard = (content: string) => `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #0a0e1a;">
  <!-- Banner -->
  <div style="width: 100%; border-radius: 12px 12px 0 0; overflow: hidden;">
    <img src="${BANNER_URL}" alt="PropScholar - Your Cart is Waiting" style="width: 100%; display: block;" />
  </div>
  <!-- Body -->
  <div style="padding: 40px 20px; background: linear-gradient(180deg, #0a0e1a 0%, #0d1525 50%, #0a0e1a 100%);">
    <div style="background: linear-gradient(145deg, rgba(20,30,60,0.85) 0%, rgba(12,18,36,0.95) 100%); border: 1px solid rgba(100,160,255,0.15); border-radius: 16px; padding: 40px 36px; box-shadow: 0 0 60px rgba(60,130,255,0.08), inset 0 1px 0 rgba(255,255,255,0.05);">
      ${content}
      <!-- Divider -->
      <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(100,160,255,0.2), transparent); margin: 28px 0;"></div>
      <p style="color: #6b7589; font-size: 14px; line-height: 1.7; margin: 0 0 24px;">Got questions? Just reply to this email — our team has your back.</p>
      <p style="color: #4a5568; font-size: 13px; margin: 0;">Warm regards,<br/><strong style="color: #8b95a8;">Team PropScholar</strong></p>
    </div>
  </div>
</div>`;

const ctaButton = (text: string) => `
<div style="text-align: center; margin: 0 0 32px;">
  <a href="https://propscholar.com" style="background: linear-gradient(135deg, #2563eb 0%, #4A90D9 50%, #2563eb 100%); color: #ffffff; padding: 16px 48px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; letter-spacing: 0.3px; box-shadow: 0 4px 24px rgba(74,144,217,0.35), 0 0 40px rgba(74,144,217,0.15); border: 1px solid rgba(100,170,255,0.2);">
    ${text}
  </a>
</div>`;

export const cartEmailTemplates: CartEmailTemplate[] = [
  {
    id: "urgency-fomo",
    name: "🔥 Urgency & FOMO",
    subject: (name) => `${name}, your cart won't wait forever! ⏰`,
    buildHtml: (firstName, cartItems) => glassCard(`
      <h2 style="color: #ffffff; font-size: 26px; font-weight: 700; margin: 0 0 16px;">⏰ Time's Running Out, ${firstName}!</h2>
      <p style="color: #8b95a8; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        Your <strong style="color: #f59e0b; font-size: 17px;">${cartItems} item${cartItems > 1 ? "s" : ""}</strong> ${cartItems > 1 ? "are" : "is"} still in your cart — but stock is limited and we can't hold ${cartItems > 1 ? "them" : "it"} forever.
      </p>
      <p style="color: #8b95a8; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        Others are eyeing the same picks. Don't let someone else grab what's yours.
      </p>
      <p style="color: #e2e8f0; font-size: 17px; font-weight: 600; line-height: 1.8; margin: 0 0 32px; text-align: center;">
        🔥 Secure your spot before it's gone 🔥
      </p>
      ${ctaButton("Grab It Now →")}
    `),
  },
  {
    id: "friendly-nudge",
    name: "😊 Friendly Nudge",
    subject: (name) => `Hey ${name}, forgot something? 🛒`,
    buildHtml: (firstName, cartItems) => glassCard(`
      <h2 style="color: #ffffff; font-size: 26px; font-weight: 700; margin: 0 0 16px;">Hey ${firstName}! 👋</h2>
      <p style="color: #8b95a8; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        Life gets busy — we totally get it! But you left <strong style="color: #4A90D9; font-size: 17px;">${cartItems} awesome item${cartItems > 1 ? "s" : ""}</strong> chilling in your cart.
      </p>
      <p style="color: #8b95a8; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        ${cartItems > 1 ? "They're" : "It's"} patiently waiting for you to come back and finish what you started. Your trading journey is just one click away! 🚀
      </p>
      <p style="color: #c4b5fd; font-size: 16px; font-style: italic; line-height: 1.8; margin: 0 0 32px; text-align: center;">
        "The best investment you can make is in yourself."
      </p>
      ${ctaButton("Complete Your Purchase 🎯")}
    `),
  },
  {
    id: "bold-direct",
    name: "💪 Bold & Direct",
    subject: (name) => `${name}, finish what you started 💪`,
    buildHtml: (firstName, cartItems) => glassCard(`
      <h2 style="color: #ffffff; font-size: 28px; font-weight: 800; margin: 0 0 20px; text-transform: uppercase; letter-spacing: 1px;">No Excuses, ${firstName}.</h2>
      <p style="color: #8b95a8; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        You picked <strong style="color: #22d3ee; font-size: 17px;">${cartItems} item${cartItems > 1 ? "s" : ""}</strong> because you knew ${cartItems > 1 ? "they were" : "it was"} exactly what you needed. That instinct was right.
      </p>
      <p style="color: #8b95a8; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        Winners don't leave things half-done. Your cart is loaded. Your future self will thank you.
      </p>
      <div style="background: rgba(34,211,238,0.08); border-left: 3px solid #22d3ee; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 0 0 32px;">
        <p style="color: #e2e8f0; font-size: 15px; margin: 0; font-weight: 500;">
          💎 Level up your game. Stop scrolling. Start doing.
        </p>
      </div>
      ${ctaButton("Lock It In Now 🔒")}
    `),
  },
];

export const getTemplateById = (id: string) => cartEmailTemplates.find((t) => t.id === id);
