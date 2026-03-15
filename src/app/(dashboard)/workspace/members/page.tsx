"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Users,
  UserCheck,
  DollarSign,
  TrendingUp,
  Search,
} from "lucide-react";
import type { WorkspaceMember, HumanUsage } from "@/types/database";

export default function MembersPage() {
  const { t } = useTranslations("workspace");
  const { t: tCommon } = useTranslations("common");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [usageMap, setUsageMap] = useState<Map<string, { messages: number; lastActive: string | null }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDept, setFormDept] = useState("");
  const [formRole, setFormRole] = useState("");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentOrg) return;
    async function fetchData() {
      setLoading(true);
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

      const [membersRes, usageRes] = await Promise.all([
        supabase.from("workspace_members").select("*").eq("org_id", currentOrg!.id).order("name"),
        supabase.from("human_usage").select("member_id, messages_count, date").eq("org_id", currentOrg!.id).gte("date", monthStart),
      ]);

      setMembers((membersRes.data || []) as WorkspaceMember[]);

      // Aggregate usage by member
      const map = new Map<string, { messages: number; lastActive: string | null }>();
      for (const u of (usageRes.data || []) as Pick<HumanUsage, "member_id" | "messages_count" | "date">[]) {
        if (!u.member_id) continue;
        const existing = map.get(u.member_id) || { messages: 0, lastActive: null };
        existing.messages += u.messages_count;
        if (!existing.lastActive || u.date > existing.lastActive) existing.lastActive = u.date;
        map.set(u.member_id, existing);
      }
      setUsageMap(map);
      setLoading(false);
    }
    fetchData();
  }, [currentOrg, supabase]);

  async function handleAdd() {
    if (!currentOrg || !formEmail.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("workspace_members")
      .insert({
        org_id: currentOrg.id,
        email: formEmail,
        name: formName || null,
        department: formDept || null,
        role: formRole || null,
      })
      .select()
      .single();

    if (error) {
      toast.error(t("saveFailed"));
    } else {
      setMembers((prev) => [...prev, data as WorkspaceMember]);
      toast.success(t("memberAdded"));
      setShowAddModal(false);
      setFormName(""); setFormEmail(""); setFormDept(""); setFormRole("");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("workspace_members").delete().eq("id", id);
    setMembers((prev) => prev.filter((m) => m.id !== id));
    toast.success(t("memberDeleted"));
  }

  const filtered = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.department?.toLowerCase().includes(q)
    );
  });

  const totalMembers = members.length;
  const activeThisMonth = Array.from(usageMap.values()).filter((u) => u.messages > 0).length;
  const adoptionRate = totalMembers > 0 ? Math.round((activeThisMonth / totalMembers) * 100) : 0;

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("membersTitle")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("membersSubtitle")}</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          {t("addMember")}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t("totalMembers")}</p>
              <p className="text-2xl font-bold">{totalMembers}</p>
            </div>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t("activeThisMonth")}</p>
              <p className="text-2xl font-bold">{activeThisMonth}</p>
            </div>
            <UserCheck className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t("totalSeatCosts")}</p>
              <p className="text-2xl font-bold">—</p>
            </div>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{t("adoptionRate")}</p>
              <p className="text-2xl font-bold">{adoptionRate}%</p>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={tCommon("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 && members.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("noMembers")}
          description={t("noMembersDesc")}
          actionLabel={t("addMember")}
          onAction={() => setShowAddModal(true)}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("memberName")}</TableHead>
                <TableHead>{t("memberEmail")}</TableHead>
                <TableHead>{t("memberDepartment")}</TableHead>
                <TableHead>{t("memberRole")}</TableHead>
                <TableHead>{t("memberMessages")}</TableHead>
                <TableHead>{t("memberStatus")}</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member) => {
                const usage = usageMap.get(member.id);
                const isActive = usage && usage.messages > 0;

                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name || "—"}</TableCell>
                    <TableCell className="text-sm">{member.email}</TableCell>
                    <TableCell className="text-sm">{member.department || "—"}</TableCell>
                    <TableCell className="text-sm">{member.role || "—"}</TableCell>
                    <TableCell className="text-sm">{usage?.messages || 0}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          isActive
                            ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                            : ""
                        }
                      >
                        {isActive ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="xs" onClick={() => handleDelete(member.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Member Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addMember")}</DialogTitle>
            <DialogDescription>{t("addMemberDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("memberName")}</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>{t("memberEmail")} *</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="john@company.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("memberDepartment")}</Label>
                <Input value={formDept} onChange={(e) => setFormDept(e.target.value)} placeholder="Engineering" />
              </div>
              <div className="space-y-2">
                <Label>{t("memberRole")}</Label>
                <Input value={formRole} onChange={(e) => setFormRole(e.target.value)} placeholder="Developer" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>{tCommon("cancel")}</Button>
            <Button onClick={handleAdd} disabled={saving || !formEmail.trim()}>{tCommon("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
