import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, PLANS, type PlanId } from "@/lib/stripe";

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for plan upgrades.
 * Body: { plan: "pro" | "enterprise" }
 */
export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const plan = body.plan as PlanId;

  if (!plan || !PLANS[plan] || plan === "free") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = PLANS[plan].stripePriceId;
  if (!priceId) {
    return NextResponse.json(
      { error: "Price ID not configured for this plan" },
      { status: 400 }
    );
  }

  // Get user's org
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(id, name, stripe_customer_id)")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin"])
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json(
      { error: "No admin access to any organization" },
      { status: 403 }
    );
  }

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    stripe_customer_id: string | null;
  };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Create or reuse Stripe customer
  let customerId = org.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: org.name,
      metadata: { org_id: org.id },
    });
    customerId = customer.id;

    // Store customer ID
    const { createClient: createServiceClient } = await import(
      "@/lib/supabase/service"
    );
    const serviceClient = createServiceClient();
    await serviceClient
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", org.id);
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/settings?tab=billing&checkout=success`,
    cancel_url: `${baseUrl}/settings?tab=billing&checkout=cancelled`,
    metadata: { org_id: org.id, plan },
  });

  return NextResponse.json({ url: session.url });
}
