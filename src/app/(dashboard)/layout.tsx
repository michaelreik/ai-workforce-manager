import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { TranslationProvider } from "@/components/providers/translation-provider";
import { OrgProvider } from "@/components/providers/org-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { defaultLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages(defaultLocale);

  return (
    <TranslationProvider locale={defaultLocale} messages={messages}>
      <OrgProvider>
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              <AppHeader />
              <div className="flex-1 overflow-auto">
                <div className="px-6 py-4">
                  <Breadcrumbs />
                </div>
                <main className="px-6 pb-8">{children}</main>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </OrgProvider>
    </TranslationProvider>
  );
}
