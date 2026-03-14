"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Organization, OrgMember } from "@/types/database";

type OrgWithRole = Organization & {
  role: OrgMember["role"];
};

type OrgContextType = {
  currentOrg: OrgWithRole | null;
  orgs: OrgWithRole[];
  loading: boolean;
  setCurrentOrg: (org: OrgWithRole) => void;
  refreshOrgs: () => Promise<void>;
};

const OrgContext = createContext<OrgContextType>({
  currentOrg: null,
  orgs: [],
  loading: true,
  setCurrentOrg: () => {},
  refreshOrgs: async () => {},
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [currentOrg, setCurrentOrgState] = useState<OrgWithRole | null>(null);
  const [orgs, setOrgs] = useState<OrgWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = useMemo(() => createClient(), []);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setOrgs([]);
        setCurrentOrgState(null);
        return;
      }

      // Fetch memberships with org data
      const { data: memberships, error } = await supabase
        .from("org_members")
        .select("role, organizations(*)")
        .eq("user_id", user.id);

      if (error) {
        console.error("Failed to fetch organizations:", error);
        return;
      }

      const orgsWithRole: OrgWithRole[] = (memberships || [])
        .filter((m) => m.organizations)
        .map((m) => ({
          ...(m.organizations as unknown as Organization),
          role: m.role as OrgMember["role"],
        }));

      setOrgs(orgsWithRole);

      // Auto-select: try localStorage, then fall back to first org
      const savedOrgId =
        typeof window !== "undefined"
          ? localStorage.getItem("current_org_id")
          : null;

      const savedOrg = savedOrgId
        ? orgsWithRole.find((o) => o.id === savedOrgId)
        : null;

      const selected = savedOrg || orgsWithRole[0] || null;
      setCurrentOrgState(selected);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  // Listen for auth state changes (login/logout)
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        fetchOrgs();
      } else if (event === "SIGNED_OUT") {
        setOrgs([]);
        setCurrentOrgState(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchOrgs]);

  const setCurrentOrg = useCallback((org: OrgWithRole) => {
    setCurrentOrgState(org);
    if (typeof window !== "undefined") {
      localStorage.setItem("current_org_id", org.id);
    }
  }, []);

  return (
    <OrgContext.Provider
      value={{ currentOrg, orgs, loading, setCurrentOrg, refreshOrgs: fetchOrgs }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error("useOrg must be used within an OrgProvider");
  }
  return context;
}
