const BANNER_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/cart-banner.png";

export interface CartEmailTemplate {
  id: string;
  name: string;
  subject: (firstName: string) => string;
  buildHtml: (firstName: string, cartItems: number) => string;
}

const cleanCard = (content: string) => `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff;">
  <!-- Banner -->
  <div style="width: 100%; overflow: hidden;">
    <img src="${BANNER_URL}" alt="PropScholar" style="width: 100%; display: block;" />
  </div>
  <!-- Body -->
  <div style="padding: 40px 36px;">
    ${content}
    <!-- Divider -->
    <div style="height: 1px; background: #e5e7eb; margin: 32px 0;"></div>
    <p style="color: #9ca3af; font-size: 13px; line-height: 1.7; margin: 0 0 16px;">Got questions? Just reply to this email — our team has your back.</p>
    <p style="color: #9ca3af; font-size: 13px; margin: 0;">Warm regards,<br/><strong style="color: #6b7280;">Team PropScholar</strong></p>
  </div>
</div>`;

const ctaButton = `
<div style="text-align: center; margin: 32px 0 0;">
  <a href="https://propscholar.com" style="background: #111827; color: #ffffff; padding: 14px 44px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; letter-spacing: 0.3px;">
    Complete Your Purchase
  </a>
</div>`;

export const cartEmailTemplates: CartEmailTemplate[] = [
  {
    id: "urgency",
    name: "Urgency",
    subject: (name) => `${name}, your cart won't wait forever ⏰`,
    buildHtml: (firstName, cartItems) => cleanCard(`
      <h2 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 20px;">Time's Running Out, ${firstName}.</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        Your <strong style="color: #111827;">${cartItems} item${cartItems > 1 ? "s" : ""}</strong> ${cartItems > 1 ? "are" : "is"} still in your cart — but stock is limited and we can't hold ${cartItems > 1 ? "them" : "it"} forever.
      </p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 8px;">
        Others are eyeing the same picks. Don't let someone else grab what's yours.
      </p>
      ${ctaButton}
    `),
  },
  {
    id: "friendly-nudge",
    name: "Friendly Reminder",
    subject: (name) => `Hey ${name}, you left something behind 👋`,
    buildHtml: (firstName, cartItems) => cleanCard(`
      <h2 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 20px;">Hey ${firstName},</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        Life gets busy — we get it. But you left <strong style="color: #111827;">${cartItems} item${cartItems > 1 ? "s" : ""}</strong> in your cart.
      </p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 8px;">
        ${cartItems > 1 ? "They're" : "It's"} still waiting for you. Your trading journey is just one click away.
      </p>
      ${ctaButton}
    `),
  },
  {
    id: "bold-direct",
    name: "Bold & Direct",
    subject: (name) => `${name}, finish what you started 💪`,
    buildHtml: (firstName, cartItems) => cleanCard(`
      <h2 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 20px;">No Excuses, ${firstName}.</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        You picked <strong style="color: #111827;">${cartItems} item${cartItems > 1 ? "s" : ""}</strong> because you knew ${cartItems > 1 ? "they were" : "it was"} exactly what you needed. That instinct was right.
      </p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 8px;">
        Winners don't leave things half-done. Your future self will thank you.
      </p>
      ${ctaButton}
    `),
  },
];

export const getTemplateById = (id: string) => cartEmailTemplates.find((t) => t.id === id);
