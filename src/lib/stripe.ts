import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return _stripe;
}

// Plan configuration
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    maxAgents: 3,
    maxTeams: 1,
    maxRequests: 1000,
    stripePriceId: null,
  },
  pro: {
    name: "Pro",
    price: 49,
    maxAgents: 20,
    maxTeams: Infinity,
    maxRequests: 50000,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID || null,
  },
  enterprise: {
    name: "Enterprise",
    price: 199,
    maxAgents: Infinity,
    maxTeams: Infinity,
    maxRequests: Infinity,
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function getPlanLimits(plan: PlanId) {
  return PLANS[plan] || PLANS.free;
}
