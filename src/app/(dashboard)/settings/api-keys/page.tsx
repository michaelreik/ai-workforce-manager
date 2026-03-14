"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/components/providers/org-provider";
import { useTranslations } from "@/i18n/use-translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Key } from "lucide-react";
import type { ApiKey, Agent } from "@/types/database";

export default function ApiKeysPage() {
  const { t } = useTranslations("settings");
  const { t: tCommon } = useTranslations("common");
  const { currentOrg } = useOrg();

  const [keys, setKeys] = useState<(ApiKey & { agent_name?: string })[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAgentId, setFormAgentId] = useState<string>("all");
  const [formExpiry, setFormExpiry] = useState<string>("never");

  // Key reveal modal
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (currentOrg) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function loadData() {
    setLoading(true);
    const [keysRes, agentsRes] = await Promise.all([
      supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("agents").select("id, name"),
    ]);

    const agentsData = (agentsRes.data || []) as Agent[];
    const agentMap = new Map(agentsData.map((a) => [a.id, a.name]));
    setAgents(agentsData);

    setKeys(
      ((keysRes.data || []) as ApiKey[]).map((k) => ({
        ...k,
        agent_name: k.agent_id ? agentMap.get(k.agent_id) || "Unknown" : undefined,
      }))
    );
    setLoading(false);
  }

  async function handleCreate() {
    if (!formName.trim() || !currentOrg) return;

    const expiryDays: Record<string, number | undefined> = {
      never: undefined,
      "30": 30,
      "90": 90,
      "365": 365,
    };

    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName.trim(),
        org_id: currentOrg.id,
        agent_id: formAgentId === "all" ? undefined : formAgentId,
        expires_in_days: expiryDays[formExpiry],
      }),
    });

    if (!res.ok) {
      toast.error("Failed to create API key");
      return;
    }

    const { key } = await res.json();
    setRevealedKey(key);
    setCreateOpen(false);
    setFormName("");
    setFormAgentId("all");
    setFormExpiry("never");
    loadData();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/keys?id=${deleteId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete API key");
      return;
    }
    toast.success(t("keyDeleted"));
    setDeleteId(null);
    loadData();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success(t("keyCopied"));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("apiKeys")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("apiKeysDesc")}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("createKey")}
        </Button>
      </div>

      {/* Keys Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Key className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">{t("noKeys")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("noKeysDesc")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("keyName")}</TableHead>
                  <TableHead>{t("keyPrefix")}</TableHead>
                  <TableHead>{t("keyAgent")}</TableHead>
                  <TableHead>{t("keyCreated")}</TableHead>
                  <TableHead>{t("keyLastUsed")}</TableHead>
                  <TableHead>{t("keyExpires")}</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {key.key_prefix}...
                      </code>
                    </TableCell>
                    <TableCell>
                      {key.agent_name ? (
                        <Badge variant="secondary">{key.agent_name}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {t("allAgents")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(key.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {key.expires_at
                        ? new Date(key.expires_at).toLocaleDateString()
                        : t("keyNever")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeleteId(key.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Key Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createKey")}</DialogTitle>
            <DialogDescription>{t("createKeyDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">{t("keyName")}</Label>
              <Input
                id="key-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("keyNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("keyScope")}</Label>
              <Select value={formAgentId} onValueChange={(v) => v && setFormAgentId(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allAgents")}</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("keyExpiration")}</Label>
              <Select value={formExpiry} onValueChange={(v) => v && setFormExpiry(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">{t("keyNever")}</SelectItem>
                  <SelectItem value="30">{t("key30Days")}</SelectItem>
                  <SelectItem value="90">{t("key90Days")}</SelectItem>
                  <SelectItem value="365">{t("key365Days")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={!formName.trim()}>
              {tCommon("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key Reveal Modal */}
      <Dialog open={!!revealedKey} onOpenChange={() => setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("keyCreated")}</DialogTitle>
            <DialogDescription>{t("keyRevealWarning")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted p-3 text-xs break-all select-all">
                {revealedKey}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => revealedKey && copyToClipboard(revealedKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedKey(null)}>
              {t("keyDone")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteKey")}</DialogTitle>
            <DialogDescription>{t("deleteKeyDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
