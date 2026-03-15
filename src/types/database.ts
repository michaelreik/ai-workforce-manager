export type Organization = {
  id: string;
  name: string;
  slug: string;
  stripe_customer_id: string | null;
  plan: "free" | "pro" | "enterprise";
  created_at: string;
};

export type OrgMember = {
  id: string;
  org_id: string;
  user_id: string;
  role: "viewer" | "manager" | "admin" | "owner";
  created_at: string;
};

export type Team = {
  id: string;
  org_id: string;
  name: string;
  budget_monthly: number;
  description: string | null;
  color: string;
  icon: string;
  lead_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: "member" | "lead";
  created_at: string;
};

export type UserProfile = {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string;
  theme: "light" | "dark" | "system";
  two_factor_enabled: boolean;
  notification_prefs: {
    critical: boolean;
    warning: boolean;
    info: boolean;
    digest: boolean;
  };
  created_at: string;
  updated_at: string;
};

export type AgentStatus = "active" | "paused" | "error" | "stopped";

export type Guardrails = {
  max_budget_daily: number | null;
  max_budget_monthly: number | null;
  max_task_duration_seconds: number | null;
  max_tokens_per_request: number | null;
  rate_limit_rpm: number | null;
  spike_detection: boolean;
  auto_pause_on_budget: boolean;
  auto_downgrade_model: boolean;
};

export type Agent = {
  id: string;
  org_id: string;
  team_id: string | null;
  name: string;
  description: string | null;
  status: AgentStatus;
  model: string;
  fallback_model: string | null;
  tags: string[];
  guardrails: Guardrails;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TaskStatus = "running" | "completed" | "failed" | "killed";

export type Task = {
  id: string;
  org_id: string;
  agent_id: string;
  status: TaskStatus;
  model_used: string;
  tokens_input: number;
  tokens_output: number;
  cost: number;
  duration_ms: number | null;
  task_type: string | null;
  result_quality: number | null;
  output_units: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
  started_at: string;
  finished_at: string | null;
};

export type BudgetEntry = {
  id: string;
  org_id: string;
  agent_id: string | null;
  team_id: string | null;
  period_type: "daily" | "weekly" | "monthly";
  period_start: string;
  allocated: number;
  spent: number;
  created_at: string;
  updated_at: string;
};

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertType =
  | "budget_warning"
  | "budget_exceeded"
  | "rate_limit"
  | "error_spike"
  | "loop_detected"
  | "kill_switch";

export type Alert = {
  id: string;
  org_id: string;
  agent_id: string | null;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  resolved: boolean;
  created_at: string;
};

export type ApiKey = {
  id: string;
  org_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  agent_id: string | null;
  permissions: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type AuditLog = {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type ProviderType = "openai" | "anthropic" | "google" | "azure" | "custom";
export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export type Provider = {
  id: string;
  org_id: string;
  provider_type: ProviderType;
  display_name: string;
  api_key_encrypted: string;
  base_url: string | null;
  rate_limit_rpm: number | null;
  is_default: boolean;
  health_status: HealthStatus;
  last_health_check: string | null;
  created_at: string;
  updated_at: string;
};

// --- Workspace Analytics ---

export type UsageSourceType = "proxy" | "api_sync" | "csv_import" | "manual";
export type SyncStatus = "pending" | "syncing" | "success" | "error";

export type UsageSource = {
  id: string;
  org_id: string;
  name: string;
  type: UsageSourceType;
  provider: string;
  product: string | null;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  sync_status: SyncStatus;
  sync_error: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  org_id: string;
  email: string;
  name: string | null;
  department: string | null;
  team_id: string | null;
  role: string | null;
  scim_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type MemberToolAssignment = {
  id: string;
  org_id: string;
  member_id: string;
  source_id: string;
  seat_type: string | null;
  monthly_cost: number;
  assigned_at: string;
};

export type HumanUsage = {
  id: string;
  org_id: string;
  source_id: string | null;
  member_id: string | null;
  date: string;
  messages_count: number;
  conversations_count: number;
  tokens_used: number;
  cost: number;
  active_minutes: number;
  models_used: string[];
  task_categories: Record<string, number>;
  tools_used: string[];
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SurveyStatus = "draft" | "active" | "closed";

export type SurveyQuestion = {
  id: string;
  type: "rating" | "scale" | "single_choice" | "multi_choice" | "text" | "number";
  text: string;
  options?: string[];
};

export type Survey = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  questions: SurveyQuestion[];
  status: SurveyStatus;
  target: string;
  is_anonymous: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type SurveyResponse = {
  id: string;
  org_id: string;
  survey_id: string;
  member_id: string | null;
  answers: Record<string, unknown>;
  submitted_at: string;
};
