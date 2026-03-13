"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { Organization } from "@/types/database";

type OrgContextType = {
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization) => void;
};

const OrgContext = createContext<OrgContextType>({
  currentOrg: null,
  setCurrentOrg: () => {},
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);

  const setCurrentOrg = useCallback((org: Organization) => {
    setCurrentOrgState(org);
    if (typeof window !== "undefined") {
      localStorage.setItem("current_org_id", org.id);
    }
  }, []);

  return (
    <OrgContext.Provider value={{ currentOrg, setCurrentOrg }}>
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
