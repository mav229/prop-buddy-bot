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
  <a href="https://propscholar.com" style="background: #4A90D9; color: #ffffff; padding: 14px 44px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block; letter-spacing: 0.3px;">
    Complete Your Purchase
  </a>
</div>`;

export const cartEmailTemplates: CartEmailTemplate[] = [
  {
    id: "friendly-nudge",
    name: "Friendly Nudge",
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
  {
    id: "smooth-closer",
    name: "Smooth Closer",
    subject: (name) => `${name}, your picks are still saved ✨`,
    buildHtml: (firstName, cartItems) => cleanCard(`
      <h2 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 20px;">Good news, ${firstName}.</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        We saved your <strong style="color: #111827;">${cartItems} item${cartItems > 1 ? "s" : ""}</strong> so you don't have to start over. Smart choices deserve a smooth checkout.
      </p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 8px;">
        One click and ${cartItems > 1 ? "they're" : "it's"} yours. Easy as that.
      </p>
      ${ctaButton}
    `),
  },
  {
    id: "hype-king",
    name: "Hype King",
    subject: (name) => `${name}, start your trading journey now 🔥`,
    buildHtml: (firstName, cartItems) => cleanCard(`
      <h2 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 20px;">Real talk, ${firstName}.</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        Those <strong style="color: #111827;">${cartItems} item${cartItems > 1 ? "s" : ""}</strong> you picked? Absolute fire. You clearly know what you want — now go get it.
      </p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 8px;">
        The best traders don't hesitate. Lock it in and level up.
      </p>
      ${ctaButton}
    `),
  },
  {
    id: "chill-vibes",
    name: "Chill Vibes",
    subject: (name) => `${name}, your journey to big payouts starts here 🙌`,
    buildHtml: (firstName, cartItems) => cleanCard(`
      <h2 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 20px;">Quick check-in, ${firstName}.</h2>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 12px;">
        No pressure at all — just wanted to let you know your <strong style="color: #111827;">${cartItems} item${cartItems > 1 ? "s are" : " is"}</strong> still in your cart whenever you're ready.
      </p>
      <p style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 8px;">
        We're here if you need anything. Take your time, we've got you.
      </p>
      ${ctaButton}
    `),
  },
];

export const getTemplateById = (id: string) => cartEmailTemplates.find((t) => t.id === id);
