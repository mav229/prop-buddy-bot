

# Hall of Fame Page — Full Code with API Key

This is a simple code fix — you just need to replace `YOUR_API_KEY` with the actual anon key in your fetch URL.

Here's the full corrected code:

```tsx
import Link from "next/link";
import Image from "next/image";

async function getCertificates() {
  try {
    const res = await fetch(
      "https://pcvkjrxrlibhyyxldbzs.supabase.co/rest/v1/hall_of_fame_certificates?select=*&apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmtqcnhybGliaHl5eGxkYnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODE5MTgsImV4cCI6MjA4MjQ1NzkxOH0.Ix2sX2oONBKUY-V7PVAnY7FO33TXvm_imZvMuCk849E",
      {
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) {
      console.error("Fetch failed:", res.status);
      return [];
    }
    return await res.json();
  } catch (error) {
    console.error("Fetch error:", error);
    return [];
  }
}

export default async function FundedTradersPage() {
  const certificates = (await getCertificates()) || [];

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-3">Scholar Traders</h1>
        <p className="text-white/50">Funded Traders at PropScholar</p>
      </div>

      {certificates.length === 0 && (
        <p className="text-center text-white/40">Certificates loading...</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {certificates.map((cert: any) => {
          const isAchievement = cert.certificate_type === "achievement";
          return (
            <Link
              key={cert.account_number}
              href={`/funded-traders/${cert.account_number}`}
              className="border border-white/10 rounded-xl overflow-hidden hover:border-yellow-400/40 transition group"
            >
              <div className="relative aspect-[2000/1414]">
                <Image
                  src={cert.certificate_url}
                  alt={`${cert.user_name} PropScholar ${
                    isAchievement ? "Funded Trader" : "Phase 1"
                  } Certificate`}
                  fill
                  className="object-cover group-hover:scale-105 transition"
                />
              </div>
              <div className="p-3">
                <h2 className="font-semibold text-sm">{cert.user_name}</h2>
                <p className="text-xs text-white/40">
                  {isAchievement ? "Funded Trader" : "Phase 1"}
                </p>
                <p className="text-[10px] text-white/25 mt-1 line-clamp-2">
                  {isAchievement
                    ? `${cert.user_name} earned a funded account after successfully completing the PropScholar evaluation.`
                    : `${cert.user_name} completed Phase 1 of the PropScholar evaluation.`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
```

The only change is line 7 — `YOUR_API_KEY` replaced with the actual anon key. This is a publishable key so it's safe to use in client/server code. The `revalidate: 3600` means Next.js will re-fetch every hour, matching your cron sync schedule.

