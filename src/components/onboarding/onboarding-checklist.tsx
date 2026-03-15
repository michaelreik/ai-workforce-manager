"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import {
  Check,
  Circle,
  X,
  Users,
  Bot,
  Key,
  ChevronRight,
} from "lucide-react";

type ChecklistItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  done: boolean;
};

export function OnboardingChecklist() {
  const { currentOrg } = useOrg();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;

    // Check if onboarding was completed or permanently dismissed
    const isComplete = localStorage.getItem(
      `onboarding_complete_${currentOrg.id}`
    );
    const isDismissed = localStorage.getItem(
      `onboarding_dismissed_${currentOrg.id}`
    );

    if (isComplete === "true" || isDismissed === "true") {
      setDismissed(true); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }

    async function checkStatus() {
      const [teamsRes, agentsRes, apiKeysRes] = await Promise.all([
        supabase
          .from("teams")
          .select("id")
          .eq("org_id", currentOrg!.id)
          .limit(1),
        supabase
          .from("agents")
          .select("id")
          .eq("org_id", currentOrg!.id)
          .limit(1),
        supabase
          .from("api_keys")
          .select("id")
          .eq("org_id", currentOrg!.id)
          .limit(1),
      ]);

      const checklist: ChecklistItem[] = [
        {
          key: "team",
          label: "Create a team",
          href: "/agents",
          icon: <Users className="h-3.5 w-3.5" />,
          done: (teamsRes.data?.length ?? 0) > 0,
        },
        {
          key: "agent",
          label: "Add an agent",
          href: "/agents",
          icon: <Bot className="h-3.5 w-3.5" />,
          done: (agentsRes.data?.length ?? 0) > 0,
        },
        {
          key: "apikey",
          label: "Create an API key",
          href: "/settings/api-keys",
          icon: <Key className="h-3.5 w-3.5" />,
          done: (apiKeysRes.data?.length ?? 0) > 0,
        },
      ];

      // If all done, mark as complete
      if (checklist.every((c) => c.done)) {
        localStorage.setItem(
          `onboarding_complete_${currentOrg!.id}`,
          "true"
        );
        setDismissed(true);
        return;
      }

      setItems(checklist);
    }

    checkStatus();
  }, [currentOrg, supabase]);

  function handleDismiss() {
    if (currentOrg) {
      localStorage.setItem(
        `onboarding_dismissed_${currentOrg.id}`,
        "true"
      );
    }
    setDismissed(true);
  }

  if (dismissed || !items) return null;

  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm font-medium">
                Finish setting up your workspace
              </p>
              <span className="text-xs text-muted-foreground">
                {doneCount}/{items.length} complete
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-muted mb-4">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{
                  width: `${(doneCount / items.length) * 100}%`,
                }}
              />
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    item.done
                      ? "text-muted-foreground"
                      : "hover:bg-muted/50 text-foreground"
                  }`}
                >
                  {item.done ? (
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  )}
                  <span className="flex items-center gap-2 flex-1">
                    {item.icon}
                    <span className={item.done ? "line-through" : ""}>
                      {item.label}
                    </span>
                  </span>
                  {!item.done && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Link>
              ))}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDismiss}
            className="shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
