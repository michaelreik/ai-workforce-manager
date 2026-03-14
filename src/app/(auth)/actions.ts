"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // After signup, create a default organization for the user
  if (data.user) {
    const orgName = email.split("@")[0] + "'s Org";
    const orgSlug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");

    // Use service role to bypass RLS for initial setup
    const { createClient: createServiceClient } = await import(
      "@/lib/supabase/service"
    );
    const serviceClient = createServiceClient();

    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .insert({ name: orgName, slug: orgSlug })
      .select()
      .single();

    if (orgError) {
      return { error: "Account created but org setup failed: " + orgError.message };
    }

    // Add user as owner of the org
    await serviceClient.from("org_members").insert({
      org_id: org.id,
      user_id: data.user.id,
      role: "owner",
    });
  }

  redirect("/onboarding");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
