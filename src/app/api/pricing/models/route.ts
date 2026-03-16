import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAvailableModels, MODEL_PRICING } from "@/lib/pricing";

/**
 * GET /api/pricing/models — Public endpoint returning all available models with pricing.
 * No auth required.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    // Return static fallback
    const models = Object.entries(MODEL_PRICING).map(([id, pricing]) => ({
      id,
      name: id,
      provider: pricing.provider,
      input_price: pricing.input,
      output_price: pricing.output,
      context_length: null,
    }));
    return NextResponse.json({ models, source: "static" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const models = await getAvailableModels(supabase);

  return NextResponse.json({
    models,
    source: "database",
    count: models.length,
  });
}
