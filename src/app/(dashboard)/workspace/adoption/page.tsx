"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import {
  Gauge,
  Star,
  BookOpen,
  Users,
  TrendingUp,
  Lightbulb,
  GraduationCap,
  Crown,
} from "lucide-react";
import type { WorkspaceMember, HumanUsage } from "@/types/database";

type Champion = {
  name: string;
  email: string;
  department: string;
  messages: number;
  toolCount: number;
};

export default function AdoptionPage() {
  const { t } = useTranslations("workspace");
  const { currentOrg, loading: orgLoading } = useOrg();
  const [loading, setLoading] = useState(true);

  const [totalMembers, setTotalMembers] = useState(0);
  const [activeMembers, setActiveMembers] = useState(0);
  const [avgMessages, setAvgMessages] = useState(0);
  const [champions, setChampions] = useState<Champion[]>([]);
  const [adoptionScore, setAdoptionScore] = useState(0);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!currentOrg) return;

    async function analyze() {
      setLoading(true);
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
        .toISOString()
        .split("T")[0];

      const [membersRes, usageRes] = await Promise.all([
        supabase.from("workspace_members").select("*").eq("org_id", currentOrg!.id),
        supabase.from("human_usage").select("member_id, messages_count, source_id").eq("org_id", currentOrg!.id).gte("date", monthStart),
      ]);

      const members = (membersRes.data || []) as WorkspaceMember[];
      const usage = (usageRes.data || []) as Pick<HumanUsage, "member_id" | "messages_count" | "source_id">[];

      // Aggregate per member
      const memberMessages = new Map<string, { messages: number; sources: Set<string> }>();
      for (const u of usage) {
        if (!u.member_id) continue;
        const existing = memberMessages.get(u.member_id) || { messages: 0, sources: new Set() };
        existing.messages += u.messages_count;
        if (u.source_id) existing.sources.add(u.source_id);
        memberMessages.set(u.member_id, existing);
      }

      const total = members.length;
      const active = Array.from(memberMessages.values()).filter((m) => m.messages > 0).length;
      const avgMsg = active > 0
        ? Array.from(memberMessages.values()).reduce((s, m) => s + m.messages, 0) / active
        : 0;

      setTotalMembers(total);
      setActiveMembers(active);
      setAvgMessages(Math.round(avgMsg));

      // Adoption score (0-100)
      const adoptionPct = total > 0 ? (active / total) * 100 : 0;
      const msgScore = Math.min(avgMsg / 50, 1) * 100; // 50+ messages = max
      const toolDiversity = Array.from(memberMessages.values())
        .filter((m) => m.sources.size >= 2).length;
      const diversityScore = active > 0 ? (toolDiversity / active) * 100 : 0;
      const score = Math.round(adoptionPct * 0.4 + msgScore * 0.3 + diversityScore * 0.3);
      setAdoptionScore(Math.min(score, 100));

      // Champions: top 10% by messages with diverse tool usage
      const ranked = Array.from(memberMessages.entries())
        .map(([memberId, data]) => {
          const member = members.find((m) => m.id === memberId);
          return {
            name: member?.name || member?.email || "Unknown",
            email: member?.email || "",
            department: member?.department || "—",
            messages: data.messages,
            toolCount: data.sources.size,
          };
        })
        .sort((a, b) => b.messages - a.messages);

      const top10pct = Math.max(1, Math.ceil(ranked.length * 0.1));
      setChampions(ranked.slice(0, Math.min(top10pct, 10)));
      setLoading(false);
    }

    analyze();
  }, [currentOrg, supabase]);

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  const adoptionStage =
    adoptionScore < 30 ? "low" : adoptionScore < 60 ? "medium" : "high";
  const scoreColor =
    adoptionScore < 30
      ? "text-red-500"
      : adoptionScore < 60
        ? "text-amber-500"
        : "text-emerald-500";

  const playbooks: Record<string, { icon: typeof BookOpen; title: string; desc: string; actions: string[] }[]> = {
    low: [
      {
        icon: Lightbulb,
        title: t("playAwarenessTitle"),
        desc: t("playAwarenessDesc"),
        actions: [t("playAwarenessAction1"), t("playAwarenessAction2"), t("playAwarenessAction3")],
      },
      {
        icon: GraduationCap,
        title: t("playTrainingTitle"),
        desc: t("playTrainingDesc"),
        actions: [t("playTrainingAction1"), t("playTrainingAction2")],
      },
    ],
    medium: [
      {
        icon: Users,
        title: t("playTargetTitle"),
        desc: t("playTargetDesc"),
        actions: [t("playTargetAction1"), t("playTargetAction2"), t("playTargetAction3")],
      },
      {
        icon: GraduationCap,
        title: t("playAdvancedTitle"),
        desc: t("playAdvancedDesc"),
        actions: [t("playAdvancedAction1"), t("playAdvancedAction2")],
      },
    ],
    high: [
      {
        icon: TrendingUp,
        title: t("playOptimizeTitle"),
        desc: t("playOptimizeDesc"),
        actions: [t("playOptimizeAction1"), t("playOptimizeAction2"), t("playOptimizeAction3")],
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("adoptionTitle")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("adoptionSubtitle")}</p>
      </div>

      {/* Adoption Scorecard */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="relative">
                <Gauge className={`h-16 w-16 ${scoreColor}`} />
                <span className={`absolute inset-0 flex items-center justify-center text-xl font-bold ${scoreColor}`}>
                  {adoptionScore}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t("adoptionScore")}</p>
            </div>
            <Separator orientation="vertical" className="h-16" />
            <div className="grid grid-cols-3 gap-6 flex-1">
              <div>
                <p className="text-2xl font-bold">{activeMembers}<span className="text-sm font-normal text-muted-foreground">/{totalMembers}</span></p>
                <p className="text-xs text-muted-foreground">{t("activeUsers")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0}%</p>
                <p className="text-xs text-muted-foreground">{t("adoptionRate")}</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{avgMessages}</p>
                <p className="text-xs text-muted-foreground">{t("avgMessagesPerUser")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Champions */}
      {champions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              {t("championsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">{t("championsDesc")}</p>
            <div className="space-y-2">
              {champions.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.department} · {c.toolCount} tools</p>
                    </div>
                  </div>
                  <Badge variant="secondary">{c.messages} {t("messages")}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Adoption Playbook */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          {t("playbookTitle")}
          <Badge variant="outline" className="capitalize">{adoptionStage} adoption</Badge>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(playbooks[adoptionStage] || []).map((item, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <item.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    <ul className="mt-2 space-y-1">
                      {item.actions.map((a, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Star className="h-2.5 w-2.5 text-primary shrink-0" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
