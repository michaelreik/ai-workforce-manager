"use client";

import dynamic from "next/dynamic";

// Prevent SSR to avoid hydration mismatch from Base UI's
// auto-generated IDs in DropdownMenu components
const AppHeader = dynamic(
  () =>
    import("@/components/layout/app-header").then((mod) => ({
      default: mod.AppHeader,
    })),
  { ssr: false }
);

export function AppHeaderClient() {
  return <AppHeader />;
}
