"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  RefreshCw,
  Zap,
  Upload,
  PenLine,
  Cable,
  Loader2,
  CircleDot,
} from "lucide-react";
import type { UsageSource } from "@/types/database";

const PROVIDERS = [
  { value: "openai", label: "OpenAI", products: ["ChatGPT Enterprise", "ChatGPT Team", "API Usage"] },
  { value: "anthropic", label: "Anthropic", products: ["Claude Team", "Claude Enterprise", "API Usage"] },
  { value: "google", label: "Google AI", products: ["Gemini for Workspace", "Vertex AI", "AI Studio"] },
  { value: "microsoft", label: "Microsoft", products: ["Copilot for M365", "Azure OpenAI"] },
  { value: "github", label: "GitHub", products: ["Copilot Business", "Copilot Enterprise"] },
  { value: "cursor", label: "Cursor", products: ["Cursor Pro", "Cursor Business"] },
  { value: "custom", label: "Other", products: ["Custom Tool"] },
];

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  proxy: { label: "Proxy", color: "bg-purple-500/15 text-purple-500 border-purple-500/20", icon: Zap },
  api_sync: { label: "API Sync", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20", icon: RefreshCw },
  csv_import: { label: "CSV Import", color: "bg-blue-500/15 text-blue-500 border-blue-500/20", icon: Upload },
  manual: { label: "Manual", color: "bg-muted text-muted-foreground", icon: PenLine },
};

const SYNC_STATUS_CONFIG: Record<string, { color: string }> = {
  success: { color: "bg-emerald-500" },
  error: { color: "bg-red-500" },
  syncing: { color: "bg-amber-500" },
  pending: { color: "bg-muted-foreground" },
};

export default function SourcesPage() {
  const { t } = useTranslations("workspace");
  const { t: tCommon } = useTranslations("common");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [sources, setSources] = useState<UsageSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Form state
  const [formProvider, setFormProvider] = useState("openai");
  const [formProduct, setFormProduct] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"api_sync" | "csv_import" | "manual">("manual");
  const [formSeats, setFormSeats] = useState("");
  const [formCostPerSeat, setFormCostPerSeat] = useState("");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentOrg) return;
    async function fetchSources() {
      setLoading(true);
      const { data } = await supabase
        .from("usage_sources")
        .select("*")
        .eq("org_id", currentOrg!.id)
        .order("created_at");
      setSources((data || []) as UsageSource[]);
      setLoading(false);
    }
    fetchSources();
  }, [currentOrg, supabase]);

  function resetForm() {
    setFormProvider("openai");
    setFormProduct("");
    setFormName("");
    setFormType("manual");
    setFormSeats("");
    setFormCostPerSeat("");
  }

  async function handleSave() {
    if (!currentOrg || !formName.trim()) return;
    setSaving(true);

    const seats = parseInt(formSeats) || 0;
    const costPerSeat = parseFloat(formCostPerSeat) || 0;

    const { data, error } = await supabase
      .from("usage_sources")
      .insert({
        org_id: currentOrg.id,
        name: formName,
        type: formType,
        provider: formProvider,
        product: formProduct || null,
        config: {
          seats,
          cost_per_seat: costPerSeat,
          total_monthly_cost: seats * costPerSeat,
        },
      })
      .select()
      .single();

    if (error) {
      toast.error(t("saveFailed"));
    } else {
      setSources((prev) => [...prev, data as UsageSource]);
      toast.success(t("sourceAdded"));
      setShowAddModal(false);
      resetForm();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    await supabase.from("usage_sources").delete().eq("id", id);
    setSources((prev) => prev.filter((s) => s.id !== id));
    toast.success(t("sourceDeleted"));
  }

  function formatTimeAgo(dateStr: string | null): string {
    if (!dateStr) return t("never");
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(diffMs / 3600000);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
  }

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const providerOptions = PROVIDERS.find((p) => p.value === formProvider);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("sourcesTitle")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("sourcesSubtitle")}</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          {t("addSource")}
        </Button>
      </div>

      {sources.length === 0 ? (
        <EmptyState
          icon={Cable}
          title={t("noSources")}
          description={t("noSourcesDesc")}
          actionLabel={t("addSource")}
          onAction={() => setShowAddModal(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => {
            const typeInfo = TYPE_CONFIG[source.type] || TYPE_CONFIG.manual;
            const syncColor = SYNC_STATUS_CONFIG[source.sync_status]?.color || "bg-muted-foreground";
            const config = source.config as Record<string, number>;

            return (
              <Card key={source.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{source.name}</CardTitle>
                    <Badge variant="outline" className={typeInfo.color}>
                      {typeInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">{t("provider")}:</span>{" "}
                      <span className="font-medium capitalize">{source.provider}</span>
                    </div>
                    {source.product && (
                      <div>
                        <span className="text-muted-foreground">{t("product")}:</span>{" "}
                        <span className="font-medium">{source.product}</span>
                      </div>
                    )}
                    {config.seats > 0 && (
                      <div>
                        <span className="text-muted-foreground">{t("seats")}:</span>{" "}
                        <span className="font-medium">{config.seats}</span>
                      </div>
                    )}
                    {config.total_monthly_cost > 0 && (
                      <div>
                        <span className="text-muted-foreground">{t("monthlyCost")}:</span>{" "}
                        <span className="font-medium">${config.total_monthly_cost}</span>
                      </div>
                    )}
                    <div className="col-span-2 flex items-center gap-1.5">
                      <CircleDot className={`h-2.5 w-2.5 ${syncColor} rounded-full`} />
                      <span className="text-muted-foreground">{t("lastSync")}:</span>{" "}
                      <span className="font-medium">{formatTimeAgo(source.last_sync_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    {source.type === "api_sync" && (
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={syncingId === source.id}
                        onClick={async () => {
                          setSyncingId(source.id);
                          try {
                            const res = await fetch("/api/sync", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ source_id: source.id }),
                            });
                            const data = await res.json();
                            if (data.results?.[0]?.success) {
                              toast.success(t("syncSuccess"));
                              setSources((prev) =>
                                prev.map((s) =>
                                  s.id === source.id
                                    ? { ...s, sync_status: "success" as const, last_sync_at: new Date().toISOString() }
                                    : s
                                )
                              );
                            } else {
                              toast.error(t("syncError"));
                              setSources((prev) =>
                                prev.map((s) =>
                                  s.id === source.id ? { ...s, sync_status: "error" as const } : s
                                )
                              );
                            }
                          } catch {
                            toast.error(t("syncError"));
                          } finally {
                            setSyncingId(null);
                          }
                        }}
                      >
                        {syncingId === source.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        {t("syncNow")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleDelete(source.id)}
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

      {/* Add Source Modal */}
      <Dialog open={showAddModal} onOpenChange={(o) => { if (!o) resetForm(); setShowAddModal(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addSource")}</DialogTitle>
            <DialogDescription>{t("addSourceDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("selectProvider")}</Label>
              <Select value={formProvider} onValueChange={(v) => { if (v) { setFormProvider(v); setFormProduct(""); } }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {providerOptions && (
              <div className="space-y-2">
                <Label>{t("selectProduct")}</Label>
                <Select value={formProduct} onValueChange={(v) => { if (v) { setFormProduct(v); if (!formName) setFormName(v); } }}>
                  <SelectTrigger><SelectValue placeholder={t("selectProduct")} /></SelectTrigger>
                  <SelectContent>
                    {providerOptions.products.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("sourceName")}</Label>
              <Input
                placeholder={t("sourceNamePlaceholder")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("connectionMethod")}</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["api_sync", "csv_import", "manual"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormType(type)}
                    className={`rounded-lg border p-3 text-left text-xs transition-colors cursor-pointer ${
                      formType === type ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <p className="font-medium">{t(type === "api_sync" ? "apiSync" : type === "csv_import" ? "csvImport" : "manualEntry")}</p>
                    <p className="text-muted-foreground mt-0.5">
                      {t(type === "api_sync" ? "apiSyncDesc" : type === "csv_import" ? "csvImportDesc" : "manualEntryDesc")}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("seatCount")}</Label>
                <Input type="number" min="0" value={formSeats} onChange={(e) => setFormSeats(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("costPerSeat")}</Label>
                <Input type="number" min="0" step="0.01" value={formCostPerSeat} onChange={(e) => setFormCostPerSeat(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }}>{tCommon("cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
