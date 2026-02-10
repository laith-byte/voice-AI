// Seed script — run with: npx tsx scripts/seed.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  console.log("Seeding database...");

  // 1. Create organization
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name: "Invaria Labs", slug: "invaria-labs" })
    .select()
    .single();

  if (orgErr) {
    console.error("Org error:", orgErr.message);
    // Try to fetch existing
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select()
      .eq("slug", "invaria-labs")
      .single();
    if (!existingOrg) {
      console.error("Cannot create or find organization. Exiting.");
      process.exit(1);
    }
    console.log("Using existing org:", existingOrg.id);
    await seedWithOrg(existingOrg.id);
    return;
  }

  console.log("Created organization:", org.id);
  await seedWithOrg(org.id);
}

async function seedWithOrg(orgId: string) {
  // 2. Link auth user to users table
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const laith = authUsers?.users?.find((u) => u.email === "laith@invarialabs.com");

  if (laith) {
    const { error: userErr } = await supabase.from("users").upsert({
      id: laith.id,
      email: "laith@invarialabs.com",
      name: "Laith",
      role: "startup_admin",
      organization_id: orgId,
    });
    if (userErr) console.error("User error:", userErr.message);
    else console.log("Linked user:", laith.id);
  } else {
    console.log("Auth user laith@invarialabs.com not found, inserting user manually...");
    // Get user ID from a direct query approach
    const { data: existingUser } = await supabase
      .from("users")
      .select()
      .eq("email", "laith@invarialabs.com")
      .single();
    if (!existingUser) {
      console.log("Skipping user link — sign in first, then re-run this script.");
    }
  }

  // 3. Create organization_settings
  const { error: settingsErr } = await supabase.from("organization_settings").upsert({
    organization_id: orgId,
    gdpr_enabled: true,
    hipaa_enabled: false,
  }, { onConflict: "organization_id" });
  if (settingsErr) console.error("Settings error:", settingsErr.message);
  else console.log("Created organization_settings");

  // 4. Create whitelabel_settings
  const { error: wlErr } = await supabase.from("whitelabel_settings").upsert({
    organization_id: orgId,
    website_title: "Invaria Labs",
    color_theme: "#2563eb",
    loading_icon: "ring",
    loading_icon_size: "lg",
  }, { onConflict: "organization_id" });
  if (wlErr) console.error("Whitelabel error:", wlErr.message);
  else console.log("Created whitelabel_settings");

  // 5. Create default email templates
  const templates = [
    { template_type: "password_setup", subject: "Set Up Your Password — {{startup_name}}", greeting: "Hello {{client_name}},", body: "Welcome to {{startup_name}}! Click the link below to set up your password and access your dashboard." },
    { template_type: "password_reset", subject: "Reset Your Password — {{startup_name}}", greeting: "Hello {{client_name}},", body: "We received a request to reset your password. Click the link below to choose a new password." },
    { template_type: "startup_invite", subject: "You're Invited to {{startup_name}}", greeting: "Hello {{client_name}},", body: "You've been invited to join {{startup_name}}. Click below to accept your invitation and get started." },
  ];
  for (const t of templates) {
    const { error } = await supabase.from("email_templates").upsert(
      { organization_id: orgId, ...t },
      { onConflict: "organization_id,template_type" }
    );
    if (error) console.error(`Template ${t.template_type} error:`, error.message);
  }
  console.log("Created email templates");

  // 6. Create a sample client
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .insert({
      organization_id: orgId,
      name: "Acme Corp",
      slug: "acme-corp",
      status: "active",
      language: "English",
      dashboard_theme: "light",
    })
    .select()
    .single();
  if (clientErr) console.error("Client error:", clientErr.message);
  else console.log("Created sample client:", client.id);

  console.log("\nSeed complete! Organization ID:", orgId);
}

seed().catch(console.error);
