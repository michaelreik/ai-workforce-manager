"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { TeamCard, type TeamWithStats } from "@/components/teams/team-card";
import { TeamFormModal } from "@/components/teams/team-form-modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import type { Team, Agent, BudgetEntry, OrgMember } from "@/types/database";

export default function TeamsPage() {
  const { t } = useTranslations("teams");
  const { t: tCommon } = useTranslations("common");
  const { currentOrg } = useOrg();

  const [teams, setTeams] = useState<TeamWithStats[]>([]);
  const [orgMembers, setOrgMembers] = useState<
    { user_id: string; email: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<TeamWithStats | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (currentOrg) loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function loadTeams() {
    setLoading(true);
    try {
      const currentMonthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      )
        .toISOString()
        .split("T")[0];

      const [teamsRes, agentsRes, budgetRes, membersRes] = await Promise.all([
        supabase.from("teams").select("*").order("name"),
        supabase.from("agents").select("id, team_id"),
        supabase
          .from("budget_entries")
          .select("*")
          .eq("period_type", "monthly")
          .gte("period_start", currentMonthStart),
        supabase.from("org_members").select("user_id, role"),
      ]);

      if (teamsRes.error) throw teamsRes.error;

      const teamsData = (teamsRes.data || []) as Team[];
      const agentsData = (agentsRes.data || []) as Pick<Agent, "id" | "team_id">[];
      const budgetData = (budgetRes.data || []) as BudgetEntry[];
      const membersData = (membersRes.data || []) as OrgMember[];

      // Build spent-per-team map from budget entries
      const teamSpentMap = new Map<string, number>();
      for (const entry of budgetData) {
        if (entry.team_id) {
          teamSpentMap.set(
            entry.team_id,
            (teamSpentMap.get(entry.team_id) || 0) + Number(entry.spent)
          );
        }
      }

      // Build agent count per team
      const agentCountMap = new Map<string, number>();
      for (const agent of agentsData) {
        if (agent.team_id) {
          agentCountMap.set(
            agent.team_id,
            (agentCountMap.get(agent.team_id) || 0) + 1
          );
        }
      }

      // Fetch lead user emails
      const leadUserIds = teamsData
        .map((t) => t.lead_user_id)
        .filter(Boolean) as string[];
      const leadEmailMap = new Map<string, string>();
      if (leadUserIds.length > 0) {
        // Use org_members user_ids to look up — we know the lead must be an org member
        for (const m of membersData) {
          leadEmailMap.set(m.user_id, m.user_id); // placeholder
        }
      }

      // Store org members for modal
      const memberEmails: { user_id: string; email: string }[] = membersData.map(
        (m) => ({
          user_id: m.user_id,
          email: m.user_id.slice(0, 8) + "...", // fallback display
        })
      );
      setOrgMembers(memberEmails);

      const enrichedTeams: TeamWithStats[] = teamsData.map((team) => ({
        ...team,
        agentCount: agentCountMap.get(team.id) || 0,
        budgetSpent: teamSpentMap.get(team.id) || 0,
        leadName: team.lead_user_id
          ? leadEmailMap.get(team.lead_user_id) || null
          : null,
      }));

      setTeams(enrichedTeams);
    } catch (err) {
      console.error("Failed to load teams:", err);
      toast.error("Failed to load teams");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTeam(data: {
    name: string;
    description: string | null;
    icon: string;
    color: string;
    budget_monthly: number;
    lead_user_id: string | null;
  }) {
    const { error } = await supabase.from("teams").insert({
      name: data.name,
      description: data.description,
      icon: data.icon,
      color: data.color,
      budget_monthly: data.budget_monthly,
      lead_user_id: data.lead_user_id,
    });

    if (error) {
      toast.error("Failed to create team");
      return;
    }

    // Audit log
    if (currentOrg) {
      await supabase.from("audit_log").insert({
        org_id: currentOrg.id,
        action: "team_created",
        target_type: "team",
        details: { name: data.name },
      });
    }

    toast.success(t("teamCreated"));
    setFormModalOpen(false);
    loadTeams();
  }

  async function handleEditTeam(data: {
    name: string;
    description: string | null;
    icon: string;
    color: string;
    budget_monthly: number;
    lead_user_id: string | null;
  }) {
    if (!editingTeam) return;

    const { error } = await supabase
      .from("teams")
      .update({
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
        budget_monthly: data.budget_monthly,
        lead_user_id: data.lead_user_id,
      })
      .eq("id", editingTeam.id);

    if (error) {
      toast.error("Failed to update team");
      return;
    }

    if (currentOrg) {
      await supabase.from("audit_log").insert({
        org_id: currentOrg.id,
        action: "team_updated",
        target_type: "team",
        target_id: editingTeam.id,
        details: { name: data.name },
      });
    }

    toast.success(t("teamUpdated"));
    setEditingTeam(null);
    loadTeams();
  }

  async function handleDeleteTeam() {
    if (!teamToDelete || deleteConfirmName !== teamToDelete.name) return;

    // Unassign agents first
    await supabase
      .from("agents")
      .update({ team_id: null })
      .eq("team_id", teamToDelete.id);

    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", teamToDelete.id);

    if (error) {
      toast.error("Failed to delete team");
      return;
    }

    if (currentOrg) {
      await supabase.from("audit_log").insert({
        org_id: currentOrg.id,
        action: "team_deleted",
        target_type: "team",
        target_id: teamToDelete.id,
        details: { name: teamToDelete.name },
      });
    }

    toast.success(t("teamDeleted"));
    setDeleteDialogOpen(false);
    setTeamToDelete(null);
    setDeleteConfirmName("");
    loadTeams();
  }

  const filteredTeams = useMemo(() => {
    if (!searchQuery) return teams;
    const q = searchQuery.toLowerCase();
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(q) ||
        team.description?.toLowerCase().includes(q)
    );
  }, [teams, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setFormModalOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("createTeam")}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={tCommon("search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Team Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">{t("noTeams")}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery ? t("noTeamsFiltered") : t("noTeamsYet")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              onEdit={(t) => setEditingTeam(t)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <TeamFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        orgMembers={orgMembers}
        onSave={handleCreateTeam}
      />

      {/* Edit Modal */}
      <TeamFormModal
        open={!!editingTeam}
        onOpenChange={(open) => {
          if (!open) setEditingTeam(null);
        }}
        team={editingTeam}
        orgMembers={orgMembers}
        onSave={handleEditTeam}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("deleteConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("deleteConfirmType")}{" "}
              <strong>{teamToDelete?.name}</strong>
            </p>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={teamToDelete?.name}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== teamToDelete?.name}
              onClick={handleDeleteTeam}
            >
              {tCommon("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
