-- Dynamic model pricing table (global, not org-scoped)
CREATE TABLE model_pricing (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_price DECIMAL(12,8) NOT NULL,
  output_price DECIMAL(12,8) NOT NULL,
  context_length INT,
  openrouter_id TEXT,
  is_available BOOLEAN DEFAULT true,
  is_custom BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Updated_at trigger
CREATE TRIGGER model_pricing_updated_at
  BEFORE UPDATE ON model_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed with current hardcoded values as fallback
INSERT INTO model_pricing (id, name, provider, input_price, output_price, context_length) VALUES
  ('gpt-4o', 'GPT-4o', 'openai', 2.5, 10, 128000),
  ('gpt-4o-mini', 'GPT-4o Mini', 'openai', 0.15, 0.6, 128000),
  ('o3-mini', 'O3 Mini', 'openai', 1.1, 4.4, 200000),
  ('claude-opus', 'Claude Opus', 'anthropic', 15, 75, 200000),
  ('claude-sonnet', 'Claude Sonnet', 'anthropic', 3, 15, 200000),
  ('claude-haiku', 'Claude Haiku', 'anthropic', 0.25, 1.25, 200000),
  ('gemini-pro', 'Gemini Pro', 'google', 1.25, 5, 1000000),
  ('gemini-flash', 'Gemini Flash', 'google', 0.075, 0.3, 1000000);
