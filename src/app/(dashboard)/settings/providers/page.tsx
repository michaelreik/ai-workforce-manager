"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  RefreshCw,
  Star,
  Zap,
  CircleDot,
  Loader2,
  ArrowLeft,
  Cable,
} from "lucide-react";
import Link from "next/link";
import type { Provider, ProviderType, HealthStatus } from "@/types/database";

const PROVIDER_INFO: Record<
  ProviderType,
  { label: string; color: string }
> = {
  openai: { label: "OpenAI", color: "text-emerald-500" },
  anthropic: { label: "Anthropic", color: "text-orange-500" },
  google: { label: "Google AI", color: "text-blue-500" },
  azure: { label: "Azure OpenAI", color: "text-cyan-500" },
  custom: { label: "Custom", color: "text-purple-500" },
};

const HEALTH_CONFIG: Record<
  HealthStatus,
  { label: string; color: string; dotColor: string }
> = {
  healthy: {
    label: "Healthy",
    color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
    dotColor: "bg-emerald-500",
  },
  degraded: {
    label: "Degraded",
    color: "bg-amber-500/15 text-amber-500 border-amber-500/20",
    dotColor: "bg-amber-500",
  },
  down: {
    label: "Down",
    color: "bg-red-500/15 text-red-500 border-red-500/20",
    dotColor: "bg-red-500",
  },
  unknown: {
    label: "Unknown",
    color: "bg-muted text-muted-foreground",
    dotColor: "bg-muted-foreground",
  },
};

export default function ProvidersPage() {
  const { t } = useTranslations("providers");
  const { t: tCommon } = useTranslations("common");
  const { currentOrg, loading: orgLoading } = useOrg();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Add form state
  const [formType, setFormType] = useState<ProviderType>("openai");
  const [formName, setFormName] = useState("");
  const [formKey, setFormKey] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formRpm, setFormRpm] = useState("");
  const [formTesting, setFormTesting] = useState(false);
  const [formTestResult, setFormTestResult] = useState<{
    status: HealthStatus;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentOrg) return;

    async function fetchProviders() {
      setLoading(true);
      const { data } = await supabase
        .from("providers")
        .select("*")
        .eq("org_id", currentOrg!.id)
        .order("created_at");

      setProviders((data || []) as Provider[]);
      setLoading(false);
    }

    fetchProviders();
  }, [currentOrg, supabase]);

  function resetForm() {
    setFormType("openai");
    setFormName("");
    setFormKey("");
    setFormBaseUrl("");
    setFormRpm("");
    setFormTesting(false);
    setFormTestResult(null);
  }

  async function handleTestConnection() {
    setFormTesting(true);
    setFormTestResult(null);

    try {
      const res = await fetch("/api/providers/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_type: formType,
          api_key: formKey,
          base_url: formBaseUrl || undefined,
        }),
      });
      const result = await res.json();
      setFormTestResult(result);
    } catch {
      setFormTestResult({ status: "down", message: "Request failed" });
    } finally {
      setFormTesting(false);
    }
  }

  async function handleSave() {
    if (!currentOrg || !formName.trim() || !formKey.trim()) return;
    setSaving(true);

    const isFirstProvider = providers.length === 0;

    try {
      // Use API route to encrypt API key server-side
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: currentOrg.id,
          provider_type: formType,
          display_name: formName,
          api_key: formKey, // Raw key — encrypted server-side
          base_url: formBaseUrl || null,
          rate_limit_rpm: formRpm ? parseInt(formRpm) : null,
          is_default: isFirstProvider,
          health_status: formTestResult?.status || "unknown",
          last_health_check: formTestResult
            ? new Date().toISOString()
            : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("saveFailed"));
      } else {
        setProviders((prev) => [...prev, data as Provider]);
        toast.success(t("providerAdded"));
        setShowAddModal(false);
        resetForm();
      }
    } catch {
      toast.error(t("saveFailed"));
    }
    setSaving(false);
  }

  async function handleTestExisting(providerId: string) {
    setTestingId(providerId);
    try {
      const res = await fetch("/api/providers/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId }),
      });
      const result = await res.json();

      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? {
                ...p,
                health_status: result.status,
                last_health_check: new Date().toISOString(),
              }
            : p
        )
      );

      const config = HEALTH_CONFIG[result.status as HealthStatus];
      if (result.status === "healthy") {
        toast.success(`${config.label}: ${result.message}`);
      } else {
        toast.error(`${config.label}: ${result.message}`);
      }
    } catch {
      toast.error("Health check failed");
    } finally {
      setTestingId(null);
    }
  }

  async function handleSetDefault(providerId: string) {
    if (!currentOrg) return;

    // Unset all defaults first
    await supabase
      .from("providers")
      .update({ is_default: false })
      .eq("org_id", currentOrg.id);

    // Set new default
    await supabase
      .from("providers")
      .update({ is_default: true })
      .eq("id", providerId);

    setProviders((prev) =>
      prev.map((p) => ({
        ...p,
        is_default: p.id === providerId,
      }))
    );
    toast.success(t("defaultSet"));
  }

  async function handleDelete(providerId: string) {
    if (!confirm(t("deleteConfirm"))) return;

    const { error } = await supabase
      .from("providers")
      .delete()
      .eq("id", providerId);

    if (error) {
      toast.error(t("saveFailed"));
      return;
    }

    setProviders((prev) => prev.filter((p) => p.id !== providerId));
    toast.success(t("providerDeleted"));
  }

  function formatTimeAgo(dateStr: string | null): string {
    if (!dateStr) return t("never");
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t("justNow");
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(diffMs / 3600000);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
  }

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            nativeButton={false}
            render={<Link href="/settings" />}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("subtitle")}
            </p>
          </div>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          {t("addProvider")}
        </Button>
      </div>

      {/* Provider Cards */}
      {providers.length === 0 ? (
        <EmptyState
          icon={Cable}
          title={t("noProviders")}
          description={t("noProvidersDesc")}
          actionLabel={t("addProvider")}
          onAction={() => setShowAddModal(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {providers.map((provider) => {
            const info = PROVIDER_INFO[provider.provider_type] || PROVIDER_INFO.custom;
            const health = HEALTH_CONFIG[provider.health_status];
            const isTesting = testingId === provider.id;

            return (
              <Card key={provider.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className={`h-4 w-4 ${info.color}`} />
                      <CardTitle className="text-sm font-semibold">
                        {provider.display_name}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {provider.is_default && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5"
                        >
                          <Star className="h-2.5 w-2.5 fill-current" />
                          {t("default")}
                        </Badge>
                      )}
                      <Badge variant="outline" className={health.color}>
                        <CircleDot className="h-2.5 w-2.5" />
                        {health.label}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">
                        {t("type")}:
                      </span>{" "}
                      <span className="font-medium">{info.label}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {t("rateLimit")}:
                      </span>{" "}
                      <span className="font-medium">
                        {provider.rate_limit_rpm
                          ? `${provider.rate_limit_rpm} RPM`
                          : t("noLimit")}
                      </span>
                    </div>
                    {provider.base_url && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">
                          {t("endpoint")}:
                        </span>{" "}
                        <span className="font-medium text-xs truncate">
                          {provider.base_url}
                        </span>
                      </div>
                    )}
                    <div className="col-span-2">
                      <span className="text-muted-foreground">
                        {t("lastCheck")}:
                      </span>{" "}
                      <span className="font-medium">
                        {formatTimeAgo(provider.last_health_check)}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleTestExisting(provider.id)}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      {t("testConnection")}
                    </Button>
                    {!provider.is_default && (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => handleSetDefault(provider.id)}
                      >
                        <Star className="h-3 w-3" />
                        {t("setDefault")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleDelete(provider.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Provider Modal */}
      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setShowAddModal(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addProvider")}</DialogTitle>
            <DialogDescription>{t("addProviderDesc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("providerType")}</Label>
              <Select
                value={formType}
                onValueChange={(v) => v && setFormType(v as ProviderType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="google">Google AI</SelectItem>
                  <SelectItem value="azure">Azure OpenAI</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                {t("displayName")}
                <HelpTooltip content={t("helpDisplayName")} className="ml-1" />
              </Label>
              <Input
                placeholder={t("displayNamePlaceholder")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("apiKey")}</Label>
              <Input
                type="password"
                placeholder={t("apiKeyPlaceholder")}
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
              />
            </div>

            {(formType === "azure" || formType === "custom") && (
              <div className="space-y-2">
                <Label>
                  {t("baseUrl")}
                  <HelpTooltip content={t("helpBaseUrl")} className="ml-1" />
                </Label>
                <Input
                  placeholder="https://your-resource.openai.azure.com"
                  value={formBaseUrl}
                  onChange={(e) => setFormBaseUrl(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>
                {t("rateLimitRpm")}
                <HelpTooltip content={t("helpRateLimit")} className="ml-1" />
              </Label>
              <Input
                type="number"
                min="0"
                placeholder={t("rateLimitPlaceholder")}
                value={formRpm}
                onChange={(e) => setFormRpm(e.target.value)}
              />
            </div>

            {/* Test Connection */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={formTesting || !formKey.trim()}
              >
                {formTesting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {t("testConnection")}
              </Button>
              {formTestResult && (
                <Badge
                  variant="outline"
                  className={
                    HEALTH_CONFIG[formTestResult.status].color
                  }
                >
                  {formTestResult.message}
                  {formTestResult.latencyMs &&
                    ` (${formTestResult.latencyMs}ms)`}
                </Badge>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formName.trim() || !formKey.trim()}
            >
              {saving ? tCommon("loading") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
