import { MongoClient, ObjectId } from "npm:mongodb@6.12.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function safeArray(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}

// All collections in the test database to scan
const COLLECTIONS = [
  "users",
  "adminusers",
  "accounts",
  "credentialkeys",
  "credentials_reports",
  "orders",
  "purchases",
  "payouts",
  "referrals",
  "referralcommissions",
  "referralpayouts",
  "referralusages",
  "coupons",
  "couponusages",
  "violations",
  "tickets",
  "qas",
  "products",
  "variants",
  "blogs",
  "blogposts",
  "categories",
  "collections",
  "contentarticles",
  "logs_automation",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require service role key for authentication
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const uri = Deno.env.get("MONGO_URI");
  if (!uri) {
    return new Response(
      JSON.stringify({ error: "MONGO_URI not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";
  let client: MongoClient | null = null;

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Find user by email
    const user = await db.collection("users").findOne({ email: normalizedEmail });

    if (!user) {
      // Try case-insensitive search
      const userAlt = await db.collection("users").findOne({ 
        email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (!userAlt) {
        return new Response(
          JSON.stringify({ user: null, collections: {} }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Use the alt user
      const userId = userAlt._id;
      const result = await fetchAllCollections(db, userId, userAlt, normalizedEmail);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user._id;
    const result = await fetchAllCollections(db, userId, user, normalizedEmail);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("MongoDB user context error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch user context" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (client) {
      try { await client.close(); } catch (_) { /* ignore */ }
    }
  }
});

async function fetchAllCollections(db: any, userId: any, user: any, email: string) {
  const collections: Record<string, unknown[]> = {};

  const userIdStr = userId.toString();
  let userOid: any = null;
  try { userOid = new ObjectId(userIdStr); } catch (_) { /* not a valid ObjectId */ }


  // --- SPECIAL: credentialkeys - search nested credentials array by assignedTo email OR userId ---
  let userAccountNumbers: number[] = [];
  try {
    const emailRegex = new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const credOrConditions: any[] = [
      { "credentials.assignedTo": { $regex: emailRegex } },
      { "credentials.assignedTo": { $regex: emailRegex } },
      { "credentials.assignedTo": userIdStr },
    ];
    if (userOid) {
      credOrConditions.push({ "credentials.assignedTo": userOid });
    }
    // Also search by user field at document level
    credOrConditions.push(
      { user: userId },
      { user: userIdStr },
      { userId: userId },
      { userId: userIdStr },
    );
    if (userOid) {
      credOrConditions.push(
        { user: userOid },
        { userId: userOid },
      );
    }

    const credKeyDocs = await db.collection("credentialkeys").find({
      $or: credOrConditions
    }).limit(50).toArray();

    if (credKeyDocs.length > 0) {
      // Filter credentials array to only show this user's credentials
      const filtered = credKeyDocs.map((doc: any) => {
        const userCreds = (doc.credentials || []).filter((c: any) => {
          const assignedTo = (c.assignedTo || "").toString().toLowerCase();
          return assignedTo.includes(email) || assignedTo === userIdStr;
        });
        // Collect account numbers (loginId) for credentials_reports lookup
        for (const c of userCreds) {
          if (c.loginId) {
            const num = parseInt(c.loginId, 10);
            if (!isNaN(num)) userAccountNumbers.push(num);
          }
        }
        // If no matching credentials in array but doc matched at top level, include all credentials
        if (userCreds.length === 0) {
          for (const c of (doc.credentials || [])) {
            if (c.loginId) {
              const num = parseInt(c.loginId, 10);
              if (!isNaN(num)) userAccountNumbers.push(num);
            }
          }
          return doc;
        }
        // Strip sensitive password fields from credentials
        const sanitizedDoc = { ...doc, credentials: userCreds.map((c: any) => {
          const { investorPassword, investor_password, masterPassword, master_password, password, passwordHash, ...safe } = c;
          return safe;
        })};
        return sanitizedDoc;
      });
      collections["credentialkeys"] = filtered;
      console.log(`Found ${filtered.length} credentialkeys docs, ${userAccountNumbers.length} account numbers: ${userAccountNumbers.join(", ")}`);
    } else {
      console.log(`No credentialkeys found for email ${email} or userId ${userIdStr}`);
    }
  } catch (err) {
    console.error("Error fetching credentialkeys:", err);
  }

  // --- SPECIAL: credentials_reports - search by account numbers ---
  if (userAccountNumbers.length > 0) {
    try {
      const reportDocs = await db.collection("credentials_reports").find({
        account: { $in: userAccountNumbers }
      }).limit(50).toArray();
      if (reportDocs.length > 0) {
        collections["credentials_reports"] = reportDocs;
        console.log(`Found ${reportDocs.length} credentials_reports for accounts ${userAccountNumbers.join(", ")}`);
      } else {
        console.log(`No credentials_reports found for accounts ${userAccountNumbers.join(", ")}`);
      }
    } catch (err) {
      console.error("Error fetching credentials_reports:", err);
    }
  }

  // --- All other collections: standard userId/email search ---
  const skipCollections = new Set(["users", "credentialkeys", "credentials_reports"]);
  
  const fetchPromises = COLLECTIONS.filter(c => !skipCollections.has(c)).map(async (colName) => {
    try {
      const col = db.collection(colName);
      const orConditions: any[] = [
        { userId: userId },
        { user_id: userId },
        { userId: userIdStr },
        { user_id: userIdStr },
        { user: userId },
        { user: userIdStr },
        { email: email },
        { userEmail: email },
        { user_email: email },
        { customerEmail: email },
        { customer_email: email },
        { buyerEmail: email },
        { ownerEmail: email },
        { owner: userId },
        { owner: userIdStr },
        { customerId: userId },
        { customerId: userIdStr },
        { customer_id: userId },
        { customer_id: userIdStr },
        { createdBy: userId },
        { createdBy: userIdStr },
        { assignedTo: userId },
        { assignedTo: userIdStr },
      ];
      if (userOid) {
        orConditions.push(
          { userId: userOid },
          { user_id: userOid },
          { user: userOid },
          { owner: userOid },
          { customerId: userOid },
          { customer_id: userOid },
          { createdBy: userOid },
          { assignedTo: userOid },
        );
      }
      const docs = await col.find({ $or: orConditions }).limit(50).toArray();
      if (docs.length === 0) {
        console.log(`No docs found in ${colName} for user ${userIdStr}`);
      }
      return { name: colName, docs: safeArray(docs) };
    } catch (err) {
      console.error(`Error fetching ${colName}:`, err);
      return { name: colName, docs: [] };
    }
  });

  const results = await Promise.all(fetchPromises);
  for (const r of results) {
    if (r.docs.length > 0) {
      collections[r.name] = r.docs;
    }
  }

  return { user, collections };
}
