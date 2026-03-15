"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import {
  DollarSign,
  AlertTriangle,
  TrendingDown,
  Users,
  Layers,
  Sparkles,
  Eye,
} from "lucide-react";
import Link from "next/link";
import type { WorkspaceMember, MemberToolAssignment, HumanUsage, UsageSource } from "@/types/database";

type Recommendation = {
  type: "unused" | "underutilized" | "duplicate" | "forecast";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  impact: string;
  savingsMonthly: number;
  members?: string[];
};

export default function OptimizationPage() {
  const { t } = useTranslations("workspace");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [totalSavings, setTotalSavings] = useState(0);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentOrg) return;

    async function analyze() {
      setLoading(true);
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

      const [membersRes, assignRes, usageRes, sourcesRes] = await Promise.all([
        supabase.from("workspace_members").select("*").eq("org_id", currentOrg!.id),
        supabase.from("member_tool_assignments").select("*").eq("org_id", currentOrg!.id),
        supabase.from("human_usage").select("member_id, messages_count, source_id").eq("org_id", currentOrg!.id).gte("date", monthStart),
        supabase.from("usage_sources").select("id, name").eq("org_id", currentOrg!.id),
      ]);

      const members = (membersRes.data || []) as WorkspaceMember[];
      const assignments = (assignRes.data || []) as MemberToolAssignment[];
      const usage = (usageRes.data || []) as Pick<HumanUsage, "member_id" | "messages_count" | "source_id">[];
      const sources = (sourcesRes.data || []) as Pick<UsageSource, "id" | "name">[];
      const sourceMap = new Map(sources.map((s) => [s.id, s.name]));

      // Aggregate messages per member per source
      const memberSourceUsage = new Map<string, Map<string, number>>();
      for (const u of usage) {
        if (!u.member_id) continue;
        if (!memberSourceUsage.has(u.member_id)) memberSourceUsage.set(u.member_id, new Map());
        const sourceMap2 = memberSourceUsage.get(u.member_id)!;
        sourceMap2.set(u.source_id || "", (sourceMap2.get(u.source_id || "") || 0) + u.messages_count);
      }

      const recs: Recommendation[] = [];

      // 1. Unused seats: members with assignment but 0 messages
      const assignmentsByMember = new Map<string, MemberToolAssignment[]>();
      for (const a of assignments) {
        if (!assignmentsByMember.has(a.member_id)) assignmentsByMember.set(a.member_id, []);
        assignmentsByMember.get(a.member_id)!.push(a);
      }

      const unusedMembers: string[] = [];
      let unusedSavings = 0;
      for (const [memberId, memberAssigns] of assignmentsByMember) {
        const totalMessages = Array.from(memberSourceUsage.get(memberId)?.values() || []).reduce((s, v) => s + v, 0);
        if (totalMessages === 0) {
          const member = members.find((m) => m.id === memberId);
          if (member) unusedMembers.push(member.name || member.email);
          unusedSavings += memberAssigns.reduce((s, a) => s + Number(a.monthly_cost), 0);
        }
      }

      if (unusedMembers.length > 0) {
        recs.push({
          type: "unused",
          severity: "critical",
          title: t("optUnusedTitle", { count: unusedMembers.length }),
          description: t("optUnusedDesc", { count: unusedMembers.length }),
          impact: `$${unusedSavings.toFixed(0)}${t("perMonth")}`,
          savingsMonthly: unusedSavings,
          members: unusedMembers.slice(0, 5),
        });
      }

      // 2. Underutilized: members with <10 messages/month
      const underutilized: string[] = [];
      let underSavings = 0;
      for (const [memberId, memberAssigns] of assignmentsByMember) {
        const totalMessages = Array.from(memberSourceUsage.get(memberId)?.values() || []).reduce((s, v) => s + v, 0);
        if (totalMessages > 0 && totalMessages < 10) {
          const member = members.find((m) => m.id === memberId);
          if (member) underutilized.push(member.name || member.email);
          // Estimate 20% savings by downgrading
          underSavings += memberAssigns.reduce((s, a) => s + Number(a.monthly_cost) * 0.2, 0);
        }
      }

      if (underutilized.length > 0) {
        recs.push({
          type: "underutilized",
          severity: "warning",
          title: t("optUnderutilizedTitle", { count: underutilized.length }),
          description: t("optUnderutilizedDesc", { count: underutilized.length }),
          impact: `$${underSavings.toFixed(0)}${t("perMonth")}`,
          savingsMonthly: underSavings,
          members: underutilized.slice(0, 5),
        });
      }

      // 3. Duplicate coverage: members with 2+ tool assignments
      const duplicateMembers: string[] = [];
      let dupSavings = 0;
      for (const [memberId, memberAssigns] of assignmentsByMember) {
        if (memberAssigns.length >= 2) {
          const member = members.find((m) => m.id === memberId);
          if (member) duplicateMembers.push(member.name || member.email);
          // Lowest cost assignment could be dropped
          const sorted = [...memberAssigns].sort((a, b) => Number(a.monthly_cost) - Number(b.monthly_cost));
          dupSavings += Number(sorted[0].monthly_cost);
        }
      }

      if (duplicateMembers.length > 0) {
        recs.push({
          type: "duplicate",
          severity: "info",
          title: t("optDuplicateTitle", { count: duplicateMembers.length }),
          description: t("optDuplicateDesc", { count: duplicateMembers.length }),
          impact: `$${dupSavings.toFixed(0)}${t("perMonth")}`,
          savingsMonthly: dupSavings,
          members: duplicateMembers.slice(0, 5),
        });
      }

      const total = unusedSavings + underSavings + dupSavings;
      setRecommendations(recs);
      setTotalSavings(total);
      setLoading(false);
    }

    analyze();
  }, [currentOrg, supabase, t]);

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  const severityIcon = {
    critical: AlertTriangle,
    warning: TrendingDown,
    info: Layers,
  };

  const severityColor = {
    critical: "text-red-500",
    warning: "text-amber-500",
    info: "text-blue-500",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("optTitle")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("optSubtitle")}</p>
      </div>

      {/* Total savings */}
      <Card className={totalSavings > 0 ? "border-emerald-500/30" : ""}>
        <CardContent className="py-6 flex items-center gap-4">
          <div className="rounded-full bg-emerald-500/10 p-3">
            <DollarSign className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("optPotentialSavings")}</p>
            <p className="text-3xl font-bold">${totalSavings.toFixed(0)}<span className="text-lg font-normal text-muted-foreground">{t("perMonth")}</span></p>
            <p className="text-xs text-muted-foreground">{t("optAnnualImpact")}: ${(totalSavings * 12).toFixed(0)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t("optAllClear")}
          description={t("optAllClearDesc")}
        />
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec, i) => {
            const Icon = severityIcon[rec.severity];
            const color = severityColor[rec.severity];

            return (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{rec.title}</p>
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 shrink-0">
                          {rec.impact}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                      {rec.members && rec.members.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {rec.members.map((m, j) => (
                            <Badge key={j} variant="secondary" className="text-[10px]">{m}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/workspace/members" />}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
