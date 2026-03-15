import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

/**
 * POST /api/stripe/portal
 * Creates a Stripe Customer Portal session for managing subscriptions.
 */
export async function POST() {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's org with stripe_customer_id
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(stripe_customer_id)")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "No admin access" },
      { status: 403 }
    );
  }

  const org = membership.organizations as unknown as {
    stripe_customer_id: string | null;
  };

  if (!org.stripe_customer_id) {
    return NextResponse.json(
      { error: "No billing account. Upgrade first." },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${baseUrl}/settings?tab=billing`,
  });

  return NextResponse.json({ url: session.url });
}
