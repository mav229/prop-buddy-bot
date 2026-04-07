import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Realistic certificate name pools by identity group (no mixed-culture combos) ---
const CERT_NAME_GROUPS = [
  {
    first: [
      "Aarav", "Arjun", "Vivaan", "Aditya", "Vihaan", "Sai", "Reyansh", "Krishna",
      "Ishaan", "Shaurya", "Atharva", "Advik", "Pranav", "Dhruv", "Kabir", "Ritvik",
      "Ananya", "Saanvi", "Aanya", "Diya", "Myra", "Aadhya", "Anika", "Prisha",
      "Ravi", "Amit", "Raj", "Vikram", "Nikhil", "Rohan", "Akash", "Rahul", "Gaurav",
      "Manav", "Kunal", "Neha", "Pooja", "Sneha", "Kriti", "Tanvi", "Yash", "Dev",
    ],
    last: [
      "Sharma", "Patel", "Singh", "Kumar", "Gupta", "Verma", "Joshi", "Chauhan",
      "Reddy", "Nair", "Mehta", "Shah", "Kapoor", "Iyer", "Rao", "Desai", "Patil",
      "Bhatt", "Saxena", "Tiwari", "Yadav", "Srivastava", "Das", "Bose", "Banerjee",
      "Kulkarni", "Agarwal", "Mishra", "Pandey",
    ],
    initials: ["S", "K", "P", "M", "G", "V", "R", "D", "T", "B", "J", "N", "A", "L", "H", "Y"],
  },
  {
    first: [
      "James", "Michael", "David", "Robert", "Daniel", "William", "Joseph", "Thomas",
      "Samuel", "Benjamin", "Nathan", "Ethan", "Alexander", "Ryan", "Lucas", "Emma",
      "Olivia", "Sophia", "Grace", "Hannah", "Chloe", "Lily", "Mia", "Ella",
    ],
    last: [
      "Smith", "Johnson", "Williams", "Brown", "Davis", "Wilson", "Taylor", "Anderson",
      "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Moore", "Clark",
      "Walker", "Hall", "Young",
    ],
    initials: ["S", "J", "W", "B", "D", "T", "A", "C", "H", "M", "P", "R"],
  },
  {
    first: ["Emeka", "Chinedu", "Tunde", "Kojo", "Kwame", "Adebayo", "Ada", "Amara", "Ife", "Zuri"],
    last: ["Okafor", "Adeyemi", "Mensah", "Osei", "Nkrumah", "Diallo", "Traore", "Bello", "Owusu"],
    initials: ["O", "A", "M", "N", "D", "T", "B", "K"],
  },
  {
    first: ["Mohammed", "Ahmed", "Omar", "Hassan", "Ali", "Yusuf", "Ibrahim", "Amina", "Fatima", "Noor"],
    last: ["Khan", "Al-Rashid", "Bakr", "El-Sayed", "Haddad", "Qureshi", "Rahman"],
    initials: ["K", "R", "B", "E", "H", "Q"],
  },
  {
    first: ["Carlos", "Diego", "Luis", "Pablo", "Marco", "Andre", "Felipe", "Sofia", "Camila", "Valeria"],
    last: ["Rodriguez", "Martinez", "Lopez", "Garcia", "Hernandez", "Silva", "Santos", "Fernandez"],
    initials: ["R", "M", "L", "G", "H", "S", "F"],
  },
] as const;

function randomName(): string {
  const group = CERT_NAME_GROUPS[Math.floor(Math.random() * CERT_NAME_GROUPS.length)];
  const first = group.first[Math.floor(Math.random() * group.first.length)];

  // Prefer natural short format like "Gaurav T" often, otherwise matched surname from same group
  if (Math.random() < 0.55) {
    const initial = group.initials[Math.floor(Math.random() * group.initials.length)];
    return `${first} ${initial}`;
  }

  const last = group.last[Math.floor(Math.random() * group.last.length)];
  return `${first} ${last}`;
}

// --- Indian-only name pool for fake orders ---
const INDIAN_FIRST_NAMES = [
  "Aarav", "Arjun", "Vivaan", "Aditya", "Vihaan", "Sai", "Reyansh", "Krishna",
  "Ishaan", "Shaurya", "Atharva", "Advik", "Pranav", "Advaith", "Dhruv",
  "Kabir", "Ritvik", "Aarush", "Kayaan", "Darsh", "Ravi", "Amit", "Suresh",
  "Raj", "Vikram", "Nikhil", "Rohan", "Siddharth", "Akash", "Deepak",
  "Manish", "Rahul", "Gaurav", "Pradeep", "Harsh", "Manav", "Kunal",
  "Ananya", "Saanvi", "Aanya", "Diya", "Myra", "Aadhya", "Ira", "Anika",
  "Prisha", "Riya", "Avni", "Neha", "Pooja", "Sneha", "Kriti", "Tanvi",
  "Yash", "Dev", "Aryan", "Karan", "Varun", "Mohit", "Sahil", "Aman",
  "Naveen", "Tarun", "Chirag", "Vishal", "Neeraj", "Ankit", "Ashish",
];

const INDIAN_LAST_INITIALS = [
  "S", "K", "P", "M", "G", "V", "R", "D", "T", "B", "J", "C", "N", "A", "L", "H", "Y",
];

const INDIAN_LAST_NAMES = [
  "Sharma", "Patel", "Singh", "Kumar", "Gupta", "Verma", "Joshi", "Chauhan",
  "Reddy", "Nair", "Mehta", "Shah", "Kapoor", "Iyer", "Rao", "Desai",
  "Patil", "Bhatt", "Saxena", "Tiwari", "Yadav", "Srivastava", "Das",
  "Bose", "Chatterjee", "Banerjee", "Kulkarni", "Agarwal", "Mishra", "Pandey",
];

function randomIndianOrderName(): string {
  const first = INDIAN_FIRST_NAMES[Math.floor(Math.random() * INDIAN_FIRST_NAMES.length)];
  // 60% chance short format "Manav K", 40% full name "Manav Kumar"
  if (Math.random() < 0.6) {
    const initial = INDIAN_LAST_INITIALS[Math.floor(Math.random() * INDIAN_LAST_INITIALS.length)];
    return `${first} ${initial}`;
  }
  const last = INDIAN_LAST_NAMES[Math.floor(Math.random() * INDIAN_LAST_NAMES.length)];
  return `${first} ${last}`;
}

// Weighted account sizes: $2K & $5K most frequent, $10K frequent, $25K moderate, $50K rare
const ORDER_ACCOUNT_SIZES_WEIGHTED = [
  "$2K", "$2K", "$2K", "$2K", "$2K",       // ~25%
  "$5K", "$5K", "$5K", "$5K", "$5K",       // ~25%
  "$10K", "$10K", "$10K", "$10K",           // ~20%
  "$25K", "$25K", "$25K",                   // ~15%
  "$50K", "$50K",                           // ~10% (~2 per day)
];
const ORDER_PAYMENT_METHODS_OTHER = ["PayPal", "Crypto", "Crypto"];

function randomOrderPayment(): string {
  // 65% UPI (Indian traders), 35% PayPal/Crypto
  if (Math.random() < 0.65) {
    return "UPI";
  }
  return ORDER_PAYMENT_METHODS_OTHER[Math.floor(Math.random() * ORDER_PAYMENT_METHODS_OTHER.length)];
}

function randomAccountSize(): string {
  return ORDER_ACCOUNT_SIZES_WEIGHTED[Math.floor(Math.random() * ORDER_ACCOUNT_SIZES_WEIGHTED.length)];
}

function randomAccountNumber(): string {
  return `279${Math.floor(100000 + Math.random() * 900000)}`;
}

// --- Cloudinary config ---
const CLOUDINARY_CLOUD = "dcg7tqfyg";

// Public IDs for uploaded blank templates (will be set after first upload)
const TEMPLATE_PUBLIC_IDS = {
  achievement: "cert-templates/achievement-blank",
  completion: "cert-templates/completion-blank",
};

// Supabase storage URLs for the blank templates
const TEMPLATE_STORAGE_URLS = {
  achievement: "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/cert-templates/achievement-blank.png",
  completion: "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/cert-templates/completion-blank.png",
};

// Text positioning config matching the original certificate generator
const TEXT_CONFIG = {
  achievement: { fontSize: 60, gravity: "center", yOffset: 120, xOffset: 300 },
  completion: { fontSize: 60, gravity: "center", yOffset: 120, xOffset: 300 },
};

// --- Upload template to Cloudinary if not already there ---
async function ensureTemplateUploaded(
  certType: "achievement" | "completion"
): Promise<string> {
  const publicId = TEMPLATE_PUBLIC_IDS[certType];
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY")!;
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET")!;

  // Check if already exists
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const checkStr = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const checkSigBytes = new Uint8Array(
    await crypto.subtle.digest("SHA-1", new TextEncoder().encode(checkStr))
  );
  const checkSig = Array.from(checkSigBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  try {
    const checkRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/resources/image/upload/${publicId}`,
      {
        headers: {
          Authorization: "Basic " + btoa(`${apiKey}:${apiSecret}`),
        },
      }
    );
    if (checkRes.ok) {
      console.log(`Template ${certType} already exists in Cloudinary`);
      return publicId;
    }
  } catch (_) {}

  // Upload from Supabase storage URL
  const sourceUrl = TEMPLATE_STORAGE_URLS[certType];
  const uploadTimestamp = Math.floor(Date.now() / 1000).toString();
  const sigStr = `folder=cert-templates&public_id=${certType}-blank&timestamp=${uploadTimestamp}${apiSecret}`;
  const sigBytes = new Uint8Array(
    await crypto.subtle.digest("SHA-1", new TextEncoder().encode(sigStr))
  );
  const signature = Array.from(sigBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const formData = new FormData();
  formData.append("file", sourceUrl);
  formData.append("public_id", `${certType}-blank`);
  formData.append("folder", "cert-templates");
  formData.append("timestamp", uploadTimestamp);
  formData.append("api_key", apiKey);
  formData.append("signature", signature);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    console.error(`Cloudinary upload failed for ${certType}:`, err);
    throw new Error(`Cloudinary upload failed: ${err}`);
  }

  const result = await uploadRes.json();
  console.log(`Uploaded ${certType} template to Cloudinary: ${result.public_id}`);
  return result.public_id;
}

// --- Generate certificate URL using Cloudinary text overlay ---
function generateCertificateUrl(
  publicId: string,
  userName: string,
  certType: "achievement" | "completion"
): string {
  const config = TEXT_CONFIG[certType];
  const nameUpper = userName.toUpperCase();

  const encodedName = encodeURIComponent(nameUpper);

  // g_center with offsets: xOffset pushes right (toward cert text area), yOffset pushes down to name bar
  const transformation = `l_text:Roboto_${config.fontSize}_bold:${encodedName},co_rgb:FFFFFF,g_${config.gravity},y_${config.yOffset},x_${config.xOffset}`;

  const url = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/${transformation}/${publicId}`;
  console.log(`Generated Cloudinary cert URL for ${userName}: ${url}`);
  return url;
}

// --- Channel IDs from config ---
async function getChannelIds(supabase: any): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("widget_config")
      .select("config")
      .eq("id", "cert_announce_channel")
      .maybeSingle();
    if (!data?.config || typeof data.config !== "object") return [];
    const cfg = data.config as Record<string, string>;
    const ids: string[] = [];
    if (cfg.channel_id_1 || cfg.channel_id) ids.push(cfg.channel_id_1 || cfg.channel_id);
    if (cfg.channel_id_2) ids.push(cfg.channel_id_2);
    return ids.filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function getConfig(supabase: any) {
  const { data } = await supabase
    .from("widget_config")
    .select("config")
    .eq("id", "fake_cert_config")
    .maybeSingle();
  return data?.config || {};
}

async function saveConfig(supabase: any, config: any) {
  await supabase
    .from("widget_config")
    .upsert({ id: "fake_cert_config", config }, { onConflict: "id" });
}

// --- Order auto config ---
async function getOrderAutoConfig(supabase: any) {
  const { data } = await supabase
    .from("widget_config")
    .select("config")
    .eq("id", "fake_order_config")
    .maybeSingle();
  return data?.config || {};
}

async function saveOrderAutoConfig(supabase: any, config: any) {
  await supabase
    .from("widget_config")
    .upsert({ id: "fake_order_config", config }, { onConflict: "id" });
}

// --- Build a fake order ---
async function buildFakeOrder(supabase: any) {
  const orderCfg = await getOrderAutoConfig(supabase);
  const todayKey = new Date().toISOString().slice(0, 10);
  const recentOrderNames: { name: string; date: string }[] = orderCfg.recent_order_names || [];
  const todayNames = recentOrderNames.filter((r: any) => r.date === todayKey);
  // Count how many times each name was used today — allow up to 3 repeats
  const nameCount: Record<string, number> = {};
  for (const r of todayNames) {
    const key = r.name.toLowerCase();
    nameCount[key] = (nameCount[key] || 0) + 1;
  }

  let customerName = randomIndianOrderName();
  for (let i = 0; i < 20; i++) {
    const count = nameCount[customerName.toLowerCase()] || 0;
    if (count < 3) break;
    customerName = randomIndianOrderName();
  }

  todayNames.push({ name: customerName, date: todayKey });
  await saveOrderAutoConfig(supabase, { ...orderCfg, recent_order_names: todayNames });

  const accountSize = randomAccountSize();
  const paymentMethod = randomOrderPayment();
  return { customer_name: customerName, account_size: accountSize, payment_method: paymentMethod };
}

// --- Send order embed to Discord ---
async function sendOrderEmbed(
  botToken: string,
  channelIds: string[],
  order: { customer_name: string; account_size: string; payment_method: string }
) {
  const embed = {
    title: "🛒 New Order Confirmed!",
    description: `**${order.customer_name}** has purchased a PropScholar account!`,
    color: 0x3b82f6,
    fields: [
      { name: "Customer", value: order.customer_name, inline: true },
      { name: "Account Size", value: order.account_size, inline: true },
      { name: "Payment Method", value: order.payment_method, inline: true },
    ],
    footer: { text: "PropScholar Orders" },
    timestamp: new Date().toISOString(),
  };

  for (const channelId of channelIds) {
    try {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ embeds: [embed] }),
        }
      );
      if (!res.ok) {
        console.error(`Discord order failed ch:${channelId} (${res.status}):`, await res.text());
      } else {
        console.log(`Fake order sent for ${order.customer_name} to ${channelId}`);
      }
    } catch (e) {
      console.error(`Discord order error ch:${channelId}:`, e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

// Helper to save auto-cert to hall of fame website
async function saveAutoCertToHall(supabase: any, cert: any) {
  const slug = cert.user_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const { error } = await supabase.from("hall_of_fame_certificates").insert({
    user_name: cert.user_name,
    account_number: cert.account_number,
    certificate_url: cert.certificate_url,
    certificate_type: cert.certificate_type,
    phase: cert.phase,
    slug: `${slug}-${Date.now()}`,
    mongo_source_id: `auto-${Date.now()}`,
    mongo_collection: "auto_push",
    status: "active",
  });
  if (error) console.error("Failed to save auto cert to hall:", error);
  else console.log(`Auto cert saved to hall of fame: ${cert.user_name}`);
}

// --- Natural-looking random delay: irregular seconds, mix of odd/even, never round ---
function randomDelayMs(minMinutes: number, maxMinutes: number): number {
  // Pick a base between min and max with fractional minutes (not round)
  const baseMinutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
  // Add irregular seconds offset: prefer odd-ish seconds like 07, 13, 23, 37, 47, 53
  const irregularSeconds = [3, 7, 11, 13, 17, 19, 23, 27, 29, 31, 37, 41, 43, 47, 49, 53, 57, 59,
    2, 6, 8, 14, 18, 22, 26, 34, 38, 42, 46, 51, 54, 58];
  const extraSec = irregularSeconds[Math.floor(Math.random() * irregularSeconds.length)];
  const extraMs = Math.floor(Math.random() * 999); // random milliseconds for true irregularity
  return Math.floor(baseMinutes * 60 * 1000) + extraSec * 1000 + extraMs;
}

// --- Discord embed sender ---
async function sendDiscordEmbed(
  botToken: string,
  channelIds: string[],
  cert: { user_name: string; account_number: string; certificate_url: string; certificate_type: string; phase: string }
) {
  const isAchievement = cert.certificate_type === "achievement";
  const color = isAchievement ? 0xfbbf24 : 0x22c55e;
  const title = isAchievement ? `🏆 New Funded Trader!` : `✅ Phase 1 Completed!`;
  const description = isAchievement
    ? `**${cert.user_name}** has earned a funded account after successfully completing the PropScholar evaluation!`
    : `**${cert.user_name}** has successfully completed Phase 1 of the PropScholar evaluation!`;

  const embed = {
    title,
    description,
    color,
    image: { url: cert.certificate_url },
    fields: [
      { name: "Account", value: cert.account_number, inline: true },
      {
        name: "Type",
        value: isAchievement ? "Achievement Certificate" : "Completion Certificate",
        inline: true,
      },
    ],
    footer: { text: "PropScholar Hall of Fame" },
    timestamp: new Date().toISOString(),
  };

  for (const channelId of channelIds) {
    try {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ embeds: [embed] }),
        }
      );
      if (!res.ok) {
        console.error(`Discord failed ch:${channelId} (${res.status}):`, await res.text());
      } else {
        console.log(`Fake cert sent for ${cert.user_name} to ${channelId}`);
      }
    } catch (e) {
      console.error(`Discord error ch:${channelId}:`, e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

// --- Build a fake cert with Cloudinary text overlay, avoiding recent names ---
async function buildFakeCert(supabase: any) {
  const isAchievement = Math.random() < 0.2;
  const certType = isAchievement ? "achievement" : "completion";

  // Load recently used names (last 4 days) to avoid repeats
  const cfg = await getConfig(supabase);
  const recentNames: { name: string; ts: number }[] = cfg.recent_cert_names || [];
  const fourDaysAgo = Date.now() - 4 * 24 * 60 * 60 * 1000;
  const activeRecent = recentNames.filter((r: any) => r.ts > fourDaysAgo);
  const recentSet = new Set(activeRecent.map((r: any) => r.name.toLowerCase()));

  // Try up to 20 times to get a unique name
  let userName = randomName();
  for (let i = 0; i < 20; i++) {
    if (!recentSet.has(userName.toLowerCase())) break;
    userName = randomName();
  }

  // Save this name to recent list
  activeRecent.push({ name: userName, ts: Date.now() });
  await saveConfig(supabase, { ...cfg, recent_cert_names: activeRecent });

  const accountNumber = randomAccountNumber();
  const publicId = await ensureTemplateUploaded(certType);
  const certificateUrl = generateCertificateUrl(publicId, userName, certType);

  return {
    user_name: userName,
    account_number: accountNumber,
    certificate_url: certificateUrl,
    certificate_type: certType,
    phase: isAchievement ? "funded" : "phase-1",
  };
}

// --- Main handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let body: any = {};
  try { body = await req.json(); } catch (_) {}

  // Manual toggle on/off
  if (body?.action === "toggle") {
    const cfg = await getConfig(supabase);
    const newEnabled = body.enabled !== undefined ? !!body.enabled : !cfg.enabled;
    await saveConfig(supabase, { ...cfg, enabled: newEnabled });
    return new Response(JSON.stringify({ success: true, enabled: newEnabled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get status
  if (body?.action === "status") {
    const cfg = await getConfig(supabase);
    return new Response(JSON.stringify({ enabled: !!cfg.enabled, last_run: cfg.last_run, next_run: cfg.next_run }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Force send one now (manual trigger)
  if (body?.action === "send_now") {
    const channelIds = await getChannelIds(supabase);
    if (!botToken || channelIds.length === 0) {
      return new Response(JSON.stringify({ error: "Bot or channels not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fakeCert = await buildFakeCert(supabase);
    await sendDiscordEmbed(botToken, channelIds, fakeCert);
    await saveAutoCertToHall(supabase, fakeCert);

    const cfg = await getConfig(supabase);
    const nextDelay = 30 + Math.floor(Math.random() * 150);
    const nextRun = new Date(Date.now() + nextDelay * 60 * 1000).toISOString();
    await saveConfig(supabase, { ...cfg, last_run: new Date().toISOString(), next_run: nextRun });

    return new Response(JSON.stringify({
      success: true,
      sent: fakeCert.user_name,
      type: fakeCert.certificate_type,
      certificate_url: fakeCert.certificate_url,
      next_run: nextRun,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Order confirmation: send purchase notification to Discord
  if (body?.action === "order_confirm") {
    const customerName = body.customer_name?.trim();
    const accountSize = body.account_size?.trim() || "N/A";
    const paymentMethod = body.payment_method?.trim() || "N/A";
    const orderNumber = body.order_number?.trim() || "";
    const amount = body.amount || 0;
    const email = body.email?.trim() || "";

    if (!customerName) {
      return new Response(JSON.stringify({ error: "Customer name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channelIds = await getChannelIds(supabase);
    if (!botToken || channelIds.length === 0) {
      return new Response(JSON.stringify({ error: "Bot or channels not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embed = {
      title: "🛒 New Order Confirmed!",
      description: `**${customerName}** has purchased a PropScholar account!`,
      color: 0x3b82f6,
      fields: [
        { name: "Customer", value: customerName, inline: true },
        { name: "Account Size", value: accountSize, inline: true },
        { name: "Payment Method", value: paymentMethod, inline: true },
        ...(amount ? [{ name: "Amount", value: `$${Number(amount).toLocaleString()}`, inline: true }] : []),
        ...(orderNumber ? [{ name: "Order #", value: orderNumber, inline: true }] : []),
        ...(email ? [{ name: "Email", value: email, inline: true }] : []),
      ],
      footer: { text: "PropScholar Orders" },
      timestamp: new Date().toISOString(),
    };

    for (const channelId of channelIds) {
      try {
        const res = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bot ${botToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ embeds: [embed] }),
          }
        );
        if (!res.ok) {
          console.error(`Discord order confirm failed ch:${channelId} (${res.status}):`, await res.text());
        }
      } catch (e) {
        console.error(`Discord order confirm error ch:${channelId}:`, e);
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(JSON.stringify({
      success: true,
      sent: customerName,
      account_size: accountSize,
      payment_method: paymentMethod,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Manual push: admin specifies name and cert type
  if (body?.action === "manual_push") {
    const userName = body.name?.trim();
    const certType = body.cert_type === "achievement" ? "achievement" : "completion";
    if (!userName) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channelIds = await getChannelIds(supabase);
    if (!botToken || channelIds.length === 0) {
      return new Response(JSON.stringify({ error: "Bot or channels not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountNumber = randomAccountNumber();
    const publicId = await ensureTemplateUploaded(certType);
    const certificateUrl = generateCertificateUrl(publicId, userName, certType);

    const cert = {
      user_name: userName,
      account_number: accountNumber,
      certificate_url: certificateUrl,
      certificate_type: certType,
      phase: certType === "achievement" ? "funded" : "phase-1",
    };

    await sendDiscordEmbed(botToken, channelIds, cert);

    // Also save to hall_of_fame_certificates if requested
    let saved_to_hall = false;
    if (body.save_to_hall !== false) {
      const slug = userName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const { error: insertErr } = await supabase.from("hall_of_fame_certificates").insert({
        user_name: userName,
        account_number: accountNumber,
        certificate_url: certificateUrl,
        certificate_type: certType,
        phase: cert.phase,
        slug: `${slug}-${Date.now()}`,
        mongo_source_id: `manual-${Date.now()}`,
        mongo_collection: "manual_push",
        status: "active",
      });
      if (insertErr) {
        console.error("Failed to save to hall_of_fame:", insertErr);
      } else {
        saved_to_hall = true;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent: cert.user_name,
      type: cert.certificate_type,
      certificate_url: cert.certificate_url,
      saved_to_hall,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // --- Order auto toggle ---
  if (body?.action === "order_auto_toggle") {
    const cfg = await getOrderAutoConfig(supabase);
    const newEnabled = body.enabled !== undefined ? !!body.enabled : !cfg.enabled;
    const nextMs = randomDelayMs(5, 120);
    const nextRun = new Date(Date.now() + nextMs).toISOString();
    await saveOrderAutoConfig(supabase, { ...cfg, enabled: newEnabled, next_run: newEnabled ? nextRun : cfg.next_run });
    return new Response(JSON.stringify({ success: true, enabled: newEnabled, next_run: newEnabled ? nextRun : cfg.next_run }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Order auto status ---
  if (body?.action === "order_auto_status") {
    const cfg = await getOrderAutoConfig(supabase);
    return new Response(JSON.stringify({ enabled: !!cfg.enabled, last_run: cfg.last_run, next_run: cfg.next_run }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // --- Order auto send now ---
  if (body?.action === "order_auto_send_now") {
    const channelIds = await getChannelIds(supabase);
    if (!botToken || channelIds.length === 0) {
      return new Response(JSON.stringify({ error: "Bot or channels not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fakeOrder = await buildFakeOrder(supabase);
    await sendOrderEmbed(botToken, channelIds, fakeOrder);
    const cfg = await getOrderAutoConfig(supabase);
    const nextMs = randomDelayMs(5, 120);
    const nextRun = new Date(Date.now() + nextMs).toISOString();
    await saveOrderAutoConfig(supabase, { ...cfg, last_run: new Date().toISOString(), next_run: nextRun });
    return new Response(JSON.stringify({
      success: true,
      sent: fakeOrder.customer_name,
      account_size: fakeOrder.account_size,
      payment_method: fakeOrder.payment_method,
      next_run: nextRun,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // --- CRON tick: check both cert and order auto ---
  const cfg = await getConfig(supabase);
  const orderCfg = await getOrderAutoConfig(supabase);
  const now = Date.now();
  const channelIds = await getChannelIds(supabase);
  const results: any = {};

  // Certificate auto
  if (cfg.enabled) {
    const nextRun = cfg.next_run ? new Date(cfg.next_run).getTime() : 0;
    if (now >= nextRun && botToken && channelIds.length > 0) {
      const fakeCert = await buildFakeCert(supabase);
      await sendDiscordEmbed(botToken, channelIds, fakeCert);
      await saveAutoCertToHall(supabase, fakeCert);
      const nextMs = randomDelayMs(30, 180);
      const nextRunTime = new Date(now + nextMs).toISOString();
      await saveConfig(supabase, { ...cfg, enabled: true, last_run: new Date().toISOString(), next_run: nextRunTime });
      results.cert = { sent: fakeCert.user_name, type: fakeCert.certificate_type, next_run: nextRunTime };
    } else {
      results.cert = { skipped: true, next_run: cfg.next_run };
    }
  } else {
    results.cert = { skipped: true, reason: "disabled" };
  }

  // Order auto
  if (orderCfg.enabled) {
    const nextRun = orderCfg.next_run ? new Date(orderCfg.next_run).getTime() : 0;
    if (now >= nextRun && botToken && channelIds.length > 0) {
      const fakeOrder = await buildFakeOrder(supabase);
      await sendOrderEmbed(botToken, channelIds, fakeOrder);
      const nextMs = randomDelayMs(5, 120);
      const nextRunTime = new Date(now + nextMs).toISOString();
      await saveOrderAutoConfig(supabase, { ...orderCfg, enabled: true, last_run: new Date().toISOString(), next_run: nextRunTime });
      results.order = { sent: fakeOrder.customer_name, account_size: fakeOrder.account_size, next_run: nextRunTime };
    } else {
      results.order = { skipped: true, next_run: orderCfg.next_run };
    }
  } else {
    results.order = { skipped: true, reason: "disabled" };
  }

  return new Response(JSON.stringify({ success: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
