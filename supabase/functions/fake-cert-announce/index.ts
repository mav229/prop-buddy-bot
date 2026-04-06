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

// --- Template URLs ---
const TEMPLATE_URLS = {
  achievement: "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/cert-templates/achievement-blank.png",
  completion: "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/cert-templates/completion-blank.png",
};

// --- Generate certificate image with name using AI ---
async function generateCertificateImage(
  supabase: any,
  userName: string,
  certType: "achievement" | "completion"
): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("LOVABLE_API_KEY not set, skipping image generation");
    return null;
  }

  const templateUrl = TEMPLATE_URLS[certType];
  const nameUpper = userName.toUpperCase();

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Add the name "${nameUpper}" to this certificate in the empty name field area (the dark rectangle/area below "PROUDLY PRESENTED TO"). The name should be in white color, bold, centered in that area, matching the certificate's style. Do not change anything else on the certificate.`,
              },
              {
                type: "image_url",
                image_url: { url: templateUrl },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      console.error("AI image gen failed:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageData) {
      console.error("No image in AI response");
      return null;
    }

    // Upload to storage
    const base64 = imageData.replace(/^data:image\/\w+;base64,/, "");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const fileName = `fake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

    const { error: uploadError } = await supabase.storage
      .from("generated-certs")
      .upload(fileName, bytes, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("generated-certs")
      .getPublicUrl(fileName);

    console.log(`Generated cert image for ${userName}: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (e) {
    console.error("Cert image generation error:", e);
    return null;
  }
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

// --- Build a fake cert with AI-generated image ---
async function buildFakeCert(supabase: any) {
  const isAchievement = Math.random() < 0.2;
  const certType = isAchievement ? "achievement" : "completion";
  const userName = randomName();
  const accountNumber = randomAccountNumber();

  // Generate image with name overlaid
  const generatedUrl = await generateCertificateImage(supabase, userName, certType);

  // Fallback: use a random real cert if AI generation fails
  let certificateUrl = generatedUrl;
  if (!certificateUrl) {
    const { data: realCerts } = await supabase
      .from("hall_of_fame_certificates")
      .select("certificate_url")
      .order("created_at", { ascending: false })
      .limit(50);
    const certUrls = realCerts?.map((c: any) => c.certificate_url) || [];
    certificateUrl = certUrls.length > 0
      ? certUrls[Math.floor(Math.random() * certUrls.length)]
      : TEMPLATE_URLS[certType];
  }

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

    const cfg = await getConfig(supabase);
    const nextDelay = 30 + Math.floor(Math.random() * 150);
    const nextRun = new Date(Date.now() + nextDelay * 60 * 1000).toISOString();
    await saveConfig(supabase, { ...cfg, last_run: new Date().toISOString(), next_run: nextRun });

    return new Response(JSON.stringify({
      success: true,
      sent: fakeCert.user_name,
      type: fakeCert.certificate_type,
      generated_image: !!fakeCert.certificate_url?.includes("generated-certs"),
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

  const fakeCert = await buildFakeCert(supabase);
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
