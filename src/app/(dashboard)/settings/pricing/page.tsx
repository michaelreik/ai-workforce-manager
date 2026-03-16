"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  RefreshCw,
  Loader2,
  ArrowLeft,
  Pencil,
  DollarSign,
  Cpu,
  Search,
} from "lucide-react";
import Link from "next/link";
import type { ModelPricingRecord } from "@/types/database";

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  anthropic: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  google: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  xai: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  meta: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  microsoft: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  deepseek: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  mistralai: "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

function getProviderBadgeClass(provider: string): string {
  return PROVIDER_COLORS[provider] || "bg-muted text-muted-foreground";
}

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

export default function PricingSettingsPage() {
  const supabase = createClient();

  const [models, setModels] = useState<ModelPricingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [editModel, setEditModel] = useState<ModelPricingRecord | null>(null);
  const [editInput, setEditInput] = useState("");
  const [editOutput, setEditOutput] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchModels = async () => {
    const { data, error } = await supabase
      .from("model_pricing")
      .select("*")
      .order("provider")
      .order("name");

    if (!error && data) {
      setModels(data as ModelPricingRecord[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const providers = useMemo(() => {
    const set = new Set(models.map((m) => m.provider));
    return Array.from(set).sort();
  }, [models]);

  const filtered = useMemo(() => {
    return models.filter((m) => {
      if (providerFilter !== "all" && m.provider !== providerFilter)
        return false;
      if (
        search &&
        !m.name.toLowerCase().includes(search.toLowerCase()) &&
        !m.id.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [models, search, providerFilter]);

  const lastSynced = useMemo(() => {
    const synced = models.filter((m) => m.last_synced_at);
    if (synced.length === 0) return null;
    synced.sort(
      (a, b) =>
        new Date(b.last_synced_at!).getTime() -
        new Date(a.last_synced_at!).getTime()
    );
    return synced[0].last_synced_at;
  }, [models]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const internalSecret = process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || "";
      const res = await fetch("/api/pricing/sync", {
        method: "POST",
        headers: { "x-internal-secret": internalSecret },
      });
      const data = await res.json();

      if (res.ok || res.status === 207) {
        toast.success(
          `Synced ${data.synced} models${data.skipped ? `, ${data.skipped} skipped` : ""}${data.errors?.length ? `, ${data.errors.length} errors` : ""}`
        );
        await fetchModels();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch {
      toast.error("Sync request failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleAvailable = async (model: ModelPricingRecord) => {
    const { error } = await supabase
      .from("model_pricing")
      .update({ is_available: !model.is_available })
      .eq("id", model.id);

    if (error) {
      toast.error("Failed to update model");
    } else {
      setModels((prev) =>
        prev.map((m) =>
          m.id === model.id ? { ...m, is_available: !m.is_available } : m
        )
      );
    }
  };

  const handleEditSave = async () => {
    if (!editModel) return;
    setSaving(true);

    const inputPrice = parseFloat(editInput);
    const outputPrice = parseFloat(editOutput);

    if (isNaN(inputPrice) || isNaN(outputPrice) || inputPrice < 0 || outputPrice < 0) {
      toast.error("Invalid price values");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("model_pricing")
      .update({
        input_price: inputPrice,
        output_price: outputPrice,
        is_custom: true,
      })
      .eq("id", editModel.id);

    if (error) {
      toast.error("Failed to update pricing");
    } else {
      toast.success(`Updated pricing for ${editModel.name}`);
      setModels((prev) =>
        prev.map((m) =>
          m.id === editModel.id
            ? {
                ...m,
                input_price: inputPrice,
                output_price: outputPrice,
                is_custom: true,
              }
            : m
        )
      );
      setEditModel(null);
    }
    setSaving(false);
  };

  const handleResetCustom = async (model: ModelPricingRecord) => {
    const { error } = await supabase
      .from("model_pricing")
      .update({ is_custom: false })
      .eq("id", model.id);

    if (error) {
      toast.error("Failed to reset");
    } else {
      toast.success(`${model.name} will be updated on next sync`);
      setModels((prev) =>
        prev.map((m) =>
          m.id === model.id ? { ...m, is_custom: false } : m
        )
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" render={<Link href="/settings" />}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Settings
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Model Pricing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-synced from OpenRouter. Override prices for custom billing.
            {lastSynced && (
              <span className="ml-2">
                Last synced:{" "}
                {new Date(lastSynced).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync from OpenRouter
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Models</p>
            <p className="text-2xl font-bold">{models.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Providers</p>
            <p className="text-2xl font-bold">{providers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-2xl font-bold">
              {models.filter((m) => m.is_available).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Custom Overrides</p>
            <p className="text-2xl font-bold">
              {models.filter((m) => m.is_custom).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={providerFilter} onValueChange={(val) => setProviderFilter(val || "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All providers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No models found"
          description={
            search || providerFilter !== "all"
              ? "Try adjusting your filters."
              : "Click 'Sync from OpenRouter' to import model pricing."
          }
          actionLabel={!search && providerFilter === "all" ? "Sync Now" : undefined}
          onAction={!search && providerFilter === "all" ? handleSync : undefined}
        />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {filtered.length} model{filtered.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-medium">Model</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Provider
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Input / 1M
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Output / 1M
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Context
                    </th>
                    <th className="px-4 py-3 text-center font-medium">
                      Available
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((model) => (
                    <tr
                      key={model.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {model.name}
                          </span>
                          {model.is_custom && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              Custom
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {model.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={getProviderBadgeClass(model.provider)}
                        >
                          {model.provider}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {formatPrice(Number(model.input_price))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {formatPrice(Number(model.output_price))}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {model.context_length
                          ? `${(model.context_length / 1000).toFixed(0)}K`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Switch
                          checked={model.is_available}
                          onCheckedChange={() => handleToggleAvailable(model)}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditModel(model);
                              setEditInput(String(Number(model.input_price)));
                              setEditOutput(String(Number(model.output_price)));
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {model.is_custom && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetCustom(model)}
                              title="Reset to auto-sync"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      <Dialog
        open={!!editModel}
        onOpenChange={(open) => !open && setEditModel(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Edit Pricing — {editModel?.name}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Custom prices won&apos;t be overwritten by auto-sync. Reset to
              re-enable sync for this model.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Input Price (per 1M tokens)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={editInput}
                  onChange={(e) => setEditInput(e.target.value)}
                  placeholder="2.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Output Price (per 1M tokens)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={editOutput}
                  onChange={(e) => setEditOutput(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModel(null)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
