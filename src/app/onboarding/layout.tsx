export const dynamic = "force-dynamic";

import { TranslationProvider } from "@/components/providers/translation-provider";
import { OrgProvider } from "@/components/providers/org-provider";
import { defaultLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages(defaultLocale);

  return (
    <TranslationProvider locale={defaultLocale} messages={messages}>
      <OrgProvider>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="w-full max-w-2xl">{children}</div>
        </div>
      </OrgProvider>
    </TranslationProvider>
  );
}
