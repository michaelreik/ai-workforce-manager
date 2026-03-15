-- Atomic budget increment using INSERT ... ON CONFLICT
-- Eliminates the SELECT→UPDATE race condition

CREATE OR REPLACE FUNCTION increment_budget_spent(
  p_org_id UUID,
  p_agent_id UUID,
  p_period_type TEXT,
  p_period_start DATE,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO budget_entries (org_id, agent_id, period_type, period_start, allocated, spent)
  VALUES (p_org_id, p_agent_id, p_period_type, p_period_start, 0, p_amount)
  ON CONFLICT (org_id, agent_id, period_type, period_start)
  DO UPDATE SET
    spent = budget_entries.spent + EXCLUDED.spent,
    updated_at = now();
END;
$$;
