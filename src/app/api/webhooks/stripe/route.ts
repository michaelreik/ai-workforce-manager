import { NextRequest, NextResponse } from "next/server";
import { getStripe, type PlanId } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/service";

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events for subscription lifecycle.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orgId = session.metadata?.org_id;
      const plan = session.metadata?.plan as PlanId | undefined;

      if (orgId && plan) {
        await supabase
          .from("organizations")
          .update({
            plan,
            stripe_customer_id: session.customer as string,
          })
          .eq("id", orgId);

        await supabase.from("audit_log").insert({
          org_id: orgId,
          action: "plan_upgraded",
          target_type: "organization",
          target_id: orgId,
          details: { plan, stripe_session_id: session.id },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;

      // Find org by stripe_customer_id
      const { data: org } = await supabase
        .from("organizations")
        .select("id, plan")
        .eq("stripe_customer_id", customerId)
        .single();

      if (org) {
        // Determine plan from price
        const priceId = subscription.items.data[0]?.price?.id;
        let newPlan: PlanId = "free";
        if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
          newPlan = "pro";
        } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
          newPlan = "enterprise";
        }

        if (newPlan !== org.plan) {
          await supabase
            .from("organizations")
            .update({ plan: newPlan })
            .eq("id", org.id);

          await supabase.from("audit_log").insert({
            org_id: org.id,
            action: "plan_changed",
            target_type: "organization",
            target_id: org.id,
            details: { old_plan: org.plan, new_plan: newPlan },
          });
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;

      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (org) {
        await supabase
          .from("organizations")
          .update({ plan: "free" })
          .eq("id", org.id);

        await supabase.from("audit_log").insert({
          org_id: org.id,
          action: "plan_downgraded",
          target_type: "organization",
          target_id: org.id,
          details: { new_plan: "free", reason: "subscription_cancelled" },
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = invoice.customer as string;

      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (org) {
        // Import createAlert to notify admins
        const { createAlert } = await import("@/lib/alerts");
        await createAlert({
          supabase,
          org_id: org.id,
          type: "budget_warning",
          severity: "critical",
          message:
            "Payment failed for your subscription. Please update your payment method to avoid service interruption.",
        });
      }
      break;
    }

    default:
      // Unhandled event type
      break;
  }

  return NextResponse.json({ received: true });
}
