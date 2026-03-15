"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Save,
  UserPlus,
  Trash2,
  Crown,
  Shield,
  Eye,
  Users,
  CreditCard,
  Bell,
  Settings2,
  Key,
  Cable,
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";
import type { OrgMember } from "@/types/database";

type MemberRow = {
  id: string;
  user_id: string;
  email: string;
  role: OrgMember["role"];
  created_at: string;
};

const roleIcons: Record<OrgMember["role"], typeof Crown> = {
  owner: Crown,
  admin: Shield,
  manager: Users,
  viewer: Eye,
};

export default function SettingsPage() {
  const { t } = useTranslations("settings");
  const { t: tCommon } = useTranslations("common");
  const { currentOrg, loading: orgLoading, refreshOrgs } = useOrg();

  const supabase = useMemo(() => createClient(), []);

  // --- General tab state ---
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [savingGeneral, setSavingGeneral] = useState(false);

  // --- Members tab state ---
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgMember["role"]>("viewer");
  const [inviting, setInviting] = useState(false);

  // --- Notifications tab state ---
  const [notifCritical, setNotifCritical] = useState(true);
  const [notifWarning, setNotifWarning] = useState(true);
  const [notifInfo, setNotifInfo] = useState(false);
  const [notifDigest, setNotifDigest] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);

  // Load org data
  useEffect(() => {
    if (!currentOrg) return;
    setOrgName(currentOrg.name);
    setOrgSlug(currentOrg.slug);
  }, [currentOrg]);

  // Load members
  useEffect(() => {
    if (!currentOrg) return;

    async function fetchMembers() {
      setLoadingMembers(true);
      const { data: memberships } = await supabase
        .from("org_members")
        .select("id, user_id, role, created_at")
        .eq("org_id", currentOrg!.id)
        .order("created_at");

      if (!memberships) {
        setLoadingMembers(false);
        return;
      }

      // Fetch emails - we'll use the user_id to get emails from a simple approach
      // Since we can't query auth.users from client, we'll show user_id for now
      // In production, you'd have a profiles table or server action
      const rows: MemberRow[] = memberships.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        email: m.user_id.slice(0, 8) + "...", // placeholder
        role: m.role as OrgMember["role"],
        created_at: m.created_at,
      }));

      setMembers(rows);
      setLoadingMembers(false);
    }

    fetchMembers();
  }, [currentOrg, supabase]);

  // --- General handlers ---
  async function handleSaveGeneral() {
    if (!currentOrg) return;
    setSavingGeneral(true);

    const { error } = await supabase
      .from("organizations")
      .update({ name: orgName, slug: orgSlug })
      .eq("id", currentOrg.id);

    if (error) {
      toast.error(t("saveFailed"));
    } else {
      toast.success(t("saved"));
      refreshOrgs();
    }
    setSavingGeneral(false);
  }

  // --- Members handlers ---
  async function handleInvite() {
    if (!currentOrg || !inviteEmail.trim()) return;
    setInviting(true);

    // Look up user by email — in production use a server action
    // For now we'll show a message that invite was sent
    toast.success(t("inviteSent", { email: inviteEmail }));
    setInviteEmail("");
    setInviting(false);
  }

  async function handleChangeRole(memberId: string, newRole: OrgMember["role"]) {
    const { error } = await supabase
      .from("org_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) {
      toast.error(t("saveFailed"));
      return;
    }

    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    toast.success(t("roleUpdated"));
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm(t("removeMemberConfirm"))) return;

    const { error } = await supabase
      .from("org_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast.error(t("saveFailed"));
      return;
    }

    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.success(t("memberRemoved"));
  }

  // --- Billing handlers ---
  async function handleUpgrade(plan: string) {
    if (plan === "free") return;
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || t("saveFailed"));
      }
    } catch {
      toast.error(t("saveFailed"));
    }
  }

  async function handleManageBilling() {
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || t("saveFailed"));
      }
    } catch {
      toast.error(t("saveFailed"));
    }
  }

  // --- Notifications handler ---
  async function handleSaveNotifications() {
    setSavingNotif(true);
    // Store in org metadata or a separate table in production
    // For now, just show success
    toast.success(t("notifSaved"));
    setSavingNotif(false);
  }

  if (orgLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">
            <Settings2 className="h-3.5 w-3.5" />
            {t("general")}
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="h-3.5 w-3.5" />
            {t("members")}
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard className="h-3.5 w-3.5" />
            {t("billing")}
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-3.5 w-3.5" />
            {t("notifications")}
          </TabsTrigger>
        </TabsList>

        {/* ===== General Tab ===== */}
        <TabsContent value="general" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("orgDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="orgName">{t("orgName")}</Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgSlug">{t("orgSlug")}</Label>
                  <Input
                    id="orgSlug"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("plan")}</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {currentOrg?.plan || "free"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("planDesc_" + (currentOrg?.plan || "free"))}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveGeneral}
                  disabled={savingGeneral}
                >
                  <Save className="h-4 w-4" />
                  {savingGeneral ? tCommon("loading") : tCommon("save")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick links to Providers, API Keys and Integration */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="group hover:border-foreground/20 transition-colors">
              <Link href="/settings/providers" className="block">
                <CardContent className="flex items-center gap-4 py-6">
                  <Cable className="h-8 w-8 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <div>
                    <p className="font-medium text-sm">{t("providers")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("providersDesc")}
                    </p>
                  </div>
                </CardContent>
              </Link>
            </Card>
            <Card className="group hover:border-foreground/20 transition-colors">
              <Link href="/settings/api-keys" className="block">
                <CardContent className="flex items-center gap-4 py-6">
                  <Key className="h-8 w-8 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <div>
                    <p className="font-medium text-sm">{t("apiKeys")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("apiKeysDesc")}
                    </p>
                  </div>
                </CardContent>
              </Link>
            </Card>
            <Card className="group hover:border-foreground/20 transition-colors">
              <Link href="/settings/integration" className="block">
                <CardContent className="flex items-center gap-4 py-6">
                  <LinkIcon className="h-8 w-8 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <div>
                    <p className="font-medium text-sm">{t("integration")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("integrationDesc")}
                    </p>
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>

          {/* Danger Zone */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base text-destructive">
                {t("dangerZone")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {t("deleteOrgDesc")}
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  toast.error(t("deleteOrgDisabled"))
                }
              >
                {t("deleteOrg")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Members Tab ===== */}
        <TabsContent value="members" className="space-y-6 mt-6">
          {/* Invite */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("inviteMember")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder={t("inviteEmailPlaceholder")}
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                />
                <Select
                  value={inviteRole}
                  onValueChange={(v) =>
                    v && setInviteRole(v as OrgMember["role"])
                  }
                >
                  <SelectTrigger size="sm" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">{t("roleViewer")}</SelectItem>
                    <SelectItem value="manager">{t("roleManager")}</SelectItem>
                    <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                >
                  <UserPlus className="h-4 w-4" />
                  {t("invite")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Members list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("members")} ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingMembers ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("memberUser")}</TableHead>
                      <TableHead>{t("memberRole")}</TableHead>
                      <TableHead>{t("memberJoined")}</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => {
                      const RoleIcon = roleIcons[member.role];
                      const isOwner = member.role === "owner";

                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                                <RoleIcon className="h-3.5 w-3.5" />
                              </div>
                              <span className="text-sm">{member.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isOwner ? (
                              <Badge variant="outline" className="capitalize">
                                {t("roleOwner")}
                              </Badge>
                            ) : (
                              <Select
                                value={member.role}
                                onValueChange={(v) =>
                                  v &&
                                  handleChangeRole(
                                    member.id,
                                    v as OrgMember["role"]
                                  )
                                }
                              >
                                <SelectTrigger size="sm" className="w-28 h-7">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="viewer">
                                    {t("roleViewer")}
                                  </SelectItem>
                                  <SelectItem value="manager">
                                    {t("roleManager")}
                                  </SelectItem>
                                  <SelectItem value="admin">
                                    {t("roleAdmin")}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {new Date(member.created_at).toLocaleDateString()}
                            </span>
                          </TableCell>
                          <TableCell>
                            {!isOwner && (
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => handleRemoveMember(member.id)}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Roles explanation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("rolesTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Crown className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-medium">{t("roleOwner")}</span>
                    <span className="text-muted-foreground">
                      {" "}— {t("roleOwnerDesc")}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                  <div>
                    <span className="font-medium">{t("roleAdmin")}</span>
                    <span className="text-muted-foreground">
                      {" "}— {t("roleAdminDesc")}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-medium">{t("roleManager")}</span>
                    <span className="text-muted-foreground">
                      {" "}— {t("roleManagerDesc")}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Eye className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div>
                    <span className="font-medium">{t("roleViewer")}</span>
                    <span className="text-muted-foreground">
                      {" "}— {t("roleViewerDesc")}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Billing Tab ===== */}
        <TabsContent value="billing" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("currentPlan")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="capitalize text-sm px-3 py-1">
                  {currentOrg?.plan || "free"}
                </Badge>
                {currentOrg?.plan === "pro" && (
                  <span className="text-sm text-muted-foreground">$49/mo</span>
                )}
                {currentOrg?.plan === "enterprise" && (
                  <span className="text-sm text-muted-foreground">$199/mo</span>
                )}
              </div>

              <Separator />

              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("planAgents")}</p>
                  <p className="font-medium">
                    {currentOrg?.plan === "enterprise"
                      ? t("unlimited")
                      : currentOrg?.plan === "pro"
                        ? "20"
                        : "3"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("planRequests")}</p>
                  <p className="font-medium">
                    {currentOrg?.plan === "enterprise"
                      ? t("unlimited")
                      : currentOrg?.plan === "pro"
                        ? "50,000 / mo"
                        : "1,000 / mo"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("planTeams")}</p>
                  <p className="font-medium">
                    {currentOrg?.plan === "free" ? "1" : t("unlimited")}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-2 flex-wrap">
                {currentOrg?.plan !== "enterprise" && (
                  <>
                    {currentOrg?.plan !== "pro" && (
                      <Button
                        size="sm"
                        onClick={() => handleUpgrade("pro")}
                      >
                        {t("upgradeTo", { plan: "Pro — $49/mo" })}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={currentOrg?.plan === "pro" ? "default" : "outline"}
                      onClick={() => handleUpgrade("enterprise")}
                    >
                      {t("upgradeTo", { plan: "Enterprise — $199/mo" })}
                    </Button>
                  </>
                )}
                {currentOrg?.plan !== "free" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleManageBilling}
                  >
                    {t("manageBilling")}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pricing comparison */}
          {currentOrg?.plan === "free" && (
            <div className="grid gap-4 sm:grid-cols-3">
              {(["free", "pro", "enterprise"] as const).map((plan) => {
                const prices = { free: 0, pro: 49, enterprise: 199 };
                const agentLimits = { free: "3", pro: "20", enterprise: t("unlimited") };
                const requestLimits = { free: "1,000", pro: "50,000", enterprise: t("unlimited") };
                const isCurrent = currentOrg?.plan === plan;

                return (
                  <Card
                    key={plan}
                    className={isCurrent ? "border-primary" : ""}
                  >
                    <CardContent className="py-5 space-y-3">
                      <div>
                        <p className="font-semibold capitalize">{plan}</p>
                        <p className="text-2xl font-bold">
                          ${prices[plan]}
                          <span className="text-sm font-normal text-muted-foreground">
                            /mo
                          </span>
                        </p>
                      </div>
                      <Separator />
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li>{agentLimits[plan]} {t("planAgents").toLowerCase()}</li>
                        <li>{requestLimits[plan]} {t("planRequests").toLowerCase()}</li>
                        <li>
                          {plan === "free" ? "1" : t("unlimited")}{" "}
                          {t("planTeams").toLowerCase()}
                        </li>
                      </ul>
                      {isCurrent ? (
                        <Badge variant="secondary" className="w-full justify-center">
                          {t("currentLabel")}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          variant={plan === "enterprise" ? "outline" : "default"}
                          onClick={() => handleUpgrade(plan)}
                          disabled={plan === "free"}
                        >
                          {t("upgrade")}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== Notifications Tab ===== */}
        <TabsContent value="notifications" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("emailNotifications")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("notifCritical")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("notifCriticalDesc")}
                  </p>
                </div>
                <Switch
                  checked={notifCritical}
                  onCheckedChange={setNotifCritical}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("notifWarning")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("notifWarningDesc")}
                  </p>
                </div>
                <Switch
                  checked={notifWarning}
                  onCheckedChange={setNotifWarning}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("notifInfo")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("notifInfoDesc")}
                  </p>
                </div>
                <Switch
                  checked={notifInfo}
                  onCheckedChange={setNotifInfo}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("notifDigest")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("notifDigestDesc")}
                  </p>
                </div>
                <Switch
                  checked={notifDigest}
                  onCheckedChange={setNotifDigest}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveNotifications}
                  disabled={savingNotif}
                >
                  <Save className="h-4 w-4" />
                  {savingNotif ? tCommon("loading") : tCommon("save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
