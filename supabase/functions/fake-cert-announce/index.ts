import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- Realistic name pools ---
const FIRST_NAMES = [
  "Aarav", "Arjun", "Vivaan", "Aditya", "Vihaan", "Sai", "Reyansh", "Krishna",
  "Ishaan", "Shaurya", "Atharva", "Advik", "Pranav", "Advaith", "Dhruv",
  "Kabir", "Ritvik", "Aarush", "Kayaan", "Darsh", "Ananya", "Saanvi", "Aanya",
  "Diya", "Myra", "Aadhya", "Ira", "Anika", "Prisha", "Riya", "Avni",
  "James", "Michael", "David", "Robert", "Daniel", "William", "Joseph", "Thomas",
  "Samuel", "Benjamin", "Nathan", "Ethan", "Alexander", "Ryan", "Lucas",
  "Oluwaseun", "Chinedu", "Emeka", "Tunde", "Kojo", "Kwame", "Adebayo",
  "Mohammed", "Ahmed", "Omar", "Hassan", "Ali", "Yusuf", "Ibrahim",
  "Carlos", "Diego", "Luis", "Pablo", "Marco", "André", "Felipe",
  "Ravi", "Amit", "Suresh", "Raj", "Vikram", "Nikhil", "Rohan", "Siddharth",
  "Akash", "Deepak", "Manish", "Rahul", "Gaurav", "Pradeep", "Harsh",
];

const LAST_NAMES = [
  "Sharma", "Patel", "Singh", "Kumar", "Gupta", "Verma", "Joshi", "Chauhan",
  "Reddy", "Nair", "Pillai", "Mehta", "Shah", "Malhotra", "Kapoor", "Chopra",
  "Iyer", "Rao", "Desai", "Kulkarni", "Bhat", "Agarwal", "Mishra", "Pandey",
  "Smith", "Johnson", "Williams", "Brown", "Davis", "Wilson", "Taylor", "Anderson",
  "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Moore",
  "Okafor", "Adeyemi", "Mensah", "Osei", "Nkrumah", "Diallo", "Traore",
  "Khan", "Al-Rashid", "Bakr", "El-Sayed", "Haddad",
  "Rodriguez", "Martinez", "Lopez", "Garcia", "Hernandez", "Silva", "Santos",
  "Kambli", "Patil", "Bhatt", "Saxena", "Tiwari", "Yadav", "Srivastava",
  "Das", "Bose", "Chatterjee", "Banerjee", "Mukherjee",
];

function randomName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}

function randomAccountNumber(): string {
  return `279${Math.floor(100000 + Math.random() * 900000)}`;
}

// --- Cloudinary config ---
const CLOUDINARY_CLOUD = "dzozyqlqr";

// Blank template URLs (from Supabase storage)
const TEMPLATE_URLS = {
  achievement: "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/cert-templates/achievement-blank.png",
  completion: "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/cert-templates/completion-blank.png",
};

// Text positioning config matching the original certificate generator
const TEXT_CONFIG = {
  achievement: { nameY: 830, fontSize: 60, xOffset: 300 },
  completion: { nameY: 830, fontSize: 60, xOffset: 300 },
};

// --- Generate certificate URL using Cloudinary text overlay ---
function generateCertificateUrl(
  userName: string,
  certType: "achievement" | "completion"
): string {
  const config = TEXT_CONFIG[certType];
  const templateUrl = TEMPLATE_URLS[certType];
  const nameUpper = userName.toUpperCase();

  // Encode the name for URL (spaces become %20)
  const encodedName = encodeURIComponent(nameUpper).replace(/%20/g, "%20");

  // Cloudinary fetch URL with text overlay
  // l_text:FontFamily_Size_Weight:Text,co_rgb:color,g_gravity,y_offset
  // Using g_north so y is from top, x_offset from center
  const textOverlay = `l_text:Roboto_${config.fontSize}_bold:${encodedName},co_rgb:FFFFFF,g_north,y_${config.nameY},x_${config.xOffset}`;

  // Base64 encode the source URL for Cloudinary fetch
  const base64Url = btoa(templateUrl);

  const cloudinaryUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/fetch/${textOverlay}/https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/cert-templates/${certType === "achievement" ? "achievement-blank.png" : "completion-blank.png"}`;

  console.log(`Generated Cloudinary cert URL for ${userName}: ${cloudinaryUrl}`);
  return cloudinaryUrl;
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

// --- Build a fake cert with Cloudinary text overlay ---
function buildFakeCert() {
  const isAchievement = Math.random() < 0.2;
  const certType = isAchievement ? "achievement" : "completion";
  const userName = randomName();
  const accountNumber = randomAccountNumber();

  // Generate certificate URL with name overlay via Cloudinary
  const certificateUrl = generateCertificateUrl(userName, certType);

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

    const fakeCert = buildFakeCert();
    await sendDiscordEmbed(botToken, channelIds, fakeCert);

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

  // --- CRON tick: check if it's time to post ---
  const cfg = await getConfig(supabase);

  if (!cfg.enabled) {
    return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = Date.now();
  const nextRun = cfg.next_run ? new Date(cfg.next_run).getTime() : 0;

  if (now < nextRun) {
    return new Response(JSON.stringify({
      skipped: true,
      reason: "not_yet",
      next_run: cfg.next_run,
      minutes_left: Math.round((nextRun - now) / 60000),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Time to post!
  const channelIds = await getChannelIds(supabase);
  if (!botToken || channelIds.length === 0) {
    return new Response(JSON.stringify({ error: "Bot or channels not configured" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const fakeCert = buildFakeCert();
  await sendDiscordEmbed(botToken, channelIds, fakeCert);

  const nextDelay = 30 + Math.floor(Math.random() * 150);
  const nextRunTime = new Date(now + nextDelay * 60 * 1000).toISOString();
  await saveConfig(supabase, {
    ...cfg,
    enabled: true,
    last_run: new Date().toISOString(),
    next_run: nextRunTime,
  });

  return new Response(JSON.stringify({
    success: true,
    sent: fakeCert.user_name,
    type: fakeCert.certificate_type,
    next_run: nextRunTime,
    next_in_minutes: nextDelay,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
